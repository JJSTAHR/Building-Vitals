"""
Firebase Cloud Functions (2nd Gen) - Python Implementation
Production-ready functions for Building Vitals IoT data ingestion

Functions:
1. continuous_sync - Runs every 5 minutes via Cloud Scheduler
2. backfill_historical - HTTP trigger for manual backfills

Architecture:
- Fetches data from FlightDeck ACE IoT API
- Transforms and validates data
- Upserts to Supabase PostgreSQL
- Comprehensive error handling and retry logic
- Secrets management via Google Secret Manager
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
import time

import functions_framework
from flask import Request, jsonify
import requests
from google.cloud import secretmanager
from supabase import create_client, Client
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# Configuration
# ============================================================================

@dataclass
class Config:
    """Configuration loaded from environment and secrets"""
    ace_api_base: str = "https://flightdeck.aceiot.cloud/api"
    ace_api_key: str = ""
    supabase_url: str = ""
    supabase_key: str = ""
    default_site: str = "building-vitals-hq"
    page_size: int = 5000
    upsert_batch_size: int = 250
    sync_window_minutes: int = 10
    max_retries: int = 3
    retry_delay_seconds: int = 2
    request_timeout: int = 30

# Global config instance
config = Config()

# ============================================================================
# Secret Manager Integration
# ============================================================================

class SecretManager:
    """Manages access to Google Cloud Secret Manager"""

    def __init__(self, project_id: Optional[str] = None):
        self.project_id = project_id or os.environ.get('GCP_PROJECT')
        if self.project_id:
            self.client = secretmanager.SecretManagerServiceClient()
        else:
            self.client = None
            logger.warning("No GCP_PROJECT set - using environment variables only")

    def get_secret(self, secret_id: str, version: str = "latest") -> Optional[str]:
        """Retrieve a secret from Secret Manager"""
        try:
            if not self.client:
                return None

            name = f"projects/{self.project_id}/secrets/{secret_id}/versions/{version}"
            response = self.client.access_secret_version(request={"name": name})
            payload = response.payload.data.decode("UTF-8")
            logger.info(f"Successfully retrieved secret: {secret_id}")
            return payload
        except Exception as e:
            logger.error(f"Error retrieving secret {secret_id}: {e}")
            return None

# Global secret manager instance
secret_manager = SecretManager()

# ============================================================================
# Configuration Loader
# ============================================================================

def load_config() -> Config:
    """Load configuration from environment and Secret Manager"""
    global config

    # Try Secret Manager first, fallback to environment variables
    ace_api_key = (
        secret_manager.get_secret("ACE_API_KEY") or
        os.environ.get("ACE_API_KEY", "")
    )

    supabase_url = (
        secret_manager.get_secret("SUPABASE_URL") or
        os.environ.get("SUPABASE_URL", "")
    )

    supabase_key = (
        secret_manager.get_secret("SUPABASE_SERVICE_ROLE_KEY") or
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    )

    config = Config(
        ace_api_key=ace_api_key,
        supabase_url=supabase_url,
        supabase_key=supabase_key,
        default_site=os.environ.get("DEFAULT_SITE", "building-vitals-hq"),
        page_size=int(os.environ.get("PAGE_SIZE", "5000")),
        upsert_batch_size=int(os.environ.get("UPSERT_BATCH_SIZE", "250")),
        sync_window_minutes=int(os.environ.get("SYNC_WINDOW_MINUTES", "10")),
    )

    # Validate required config
    if not config.ace_api_key:
        raise ValueError("ACE_API_KEY not configured")
    if not config.supabase_url:
        raise ValueError("SUPABASE_URL not configured")
    if not config.supabase_key:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY not configured")

    logger.info(f"Configuration loaded: site={config.default_site}, page_size={config.page_size}")
    return config

# ============================================================================
# HTTP Client with Retry Logic
# ============================================================================

def create_http_session() -> requests.Session:
    """Create HTTP session with retry logic"""
    session = requests.Session()

    retry_strategy = Retry(
        total=config.max_retries,
        backoff_factor=config.retry_delay_seconds,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET", "POST"]
    )

    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("http://", adapter)
    session.mount("https://", adapter)

    return session

# ============================================================================
# ACE API Client
# ============================================================================

class ACEAPIClient:
    """Client for FlightDeck ACE IoT API"""

    def __init__(self, api_key: str, base_url: str):
        self.api_key = api_key
        self.base_url = base_url
        self.session = create_http_session()

    def fetch_timeseries_page(
        self,
        site: str,
        start_time: str,
        end_time: str,
        cursor: Optional[str] = None
    ) -> Tuple[List[Dict], Optional[str], Optional[str]]:
        """
        Fetch a single page of timeseries data

        Returns:
            Tuple of (data, next_cursor, error_message)
        """
        url = f"{self.base_url}/sites/{site}/timeseries/paginated"

        params = {
            "start_time": start_time,
            "end_time": end_time,
            "page_size": config.page_size,
            "raw_data": "true"
        }

        if cursor:
            params["cursor"] = cursor

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json"
        }

        try:
            logger.info(f"Fetching data from ACE API: site={site}, cursor={cursor}")
            response = self.session.get(
                url,
                params=params,
                headers=headers,
                timeout=config.request_timeout
            )

            response.raise_for_status()
            data = response.json()

            samples = data.get("point_samples", [])
            next_cursor = data.get("next_cursor")

            logger.info(f"Fetched {len(samples)} samples, has_more={bool(next_cursor)}")
            return samples, next_cursor, None

        except requests.exceptions.HTTPError as e:
            error_msg = f"ACE API HTTP error ({e.response.status_code}): {e.response.text[:200]}"
            logger.error(error_msg)
            return [], None, error_msg
        except requests.exceptions.RequestException as e:
            error_msg = f"ACE API request error: {str(e)}"
            logger.error(error_msg)
            return [], None, error_msg
        except Exception as e:
            error_msg = f"Unexpected error fetching data: {str(e)}"
            logger.error(error_msg)
            return [], None, error_msg

    def get_sites(self) -> List[str]:
        """Get list of available sites"""
        url = f"{self.base_url}/sites"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json"
        }

        try:
            response = self.session.get(url, headers=headers, timeout=config.request_timeout)
            response.raise_for_status()
            data = response.json()
            sites = [site.get("name") for site in data.get("sites", []) if site.get("name")]
            logger.info(f"Found {len(sites)} sites")
            return sites
        except Exception as e:
            logger.error(f"Error fetching sites: {e}")
            return [config.default_site]

# ============================================================================
# Supabase Client
# ============================================================================

class SupabaseClient:
    """Client for Supabase operations"""

    def __init__(self, url: str, key: str):
        self.client: Client = create_client(url, key)
        self.point_cache: Dict[str, int] = {}

    def get_sites_from_db(self) -> List[str]:
        """Get unique site names from points table"""
        try:
            response = self.client.table("points").select("site_name").execute()
            sites = list(set(point["site_name"] for point in response.data if point.get("site_name")))
            logger.info(f"Found {len(sites)} sites in database")
            return sites
        except Exception as e:
            logger.error(f"Error fetching sites from database: {e}")
            return []

    def load_point_cache(self, site: str) -> None:
        """Load point ID cache for a site"""
        try:
            logger.info(f"Loading point cache for site: {site}")
            response = self.client.table("points").select("id, name").eq("site_name", site).execute()

            self.point_cache.clear()
            for point in response.data:
                self.point_cache[point["name"]] = point["id"]

            logger.info(f"Loaded {len(self.point_cache)} points into cache")
        except Exception as e:
            logger.error(f"Error loading point cache: {e}")
            self.point_cache.clear()

    def upsert_points(self, site: str, point_names: List[str]) -> None:
        """Create new points if they don't exist"""
        new_points = [name for name in point_names if name not in self.point_cache]

        if not new_points:
            return

        logger.info(f"Creating {len(new_points)} new points")

        point_rows = [
            {
                "site_name": site,
                "name": name,
                "source": "ace_api"
            }
            for name in new_points
        ]

        try:
            self.client.table("points").insert(point_rows).execute()

            # Refresh cache for new points
            response = self.client.table("points").select("id, name").eq("site_name", site).in_("name", new_points).execute()

            for point in response.data:
                self.point_cache[point["name"]] = point["id"]

            logger.info(f"Successfully created and cached {len(new_points)} points")
        except Exception as e:
            logger.error(f"Error upserting points: {e}")

    def upsert_timeseries(self, samples: List[Dict]) -> int:
        """Upsert timeseries data in batches"""
        if not samples:
            return 0

        total_inserted = 0

        # Process in batches
        for i in range(0, len(samples), config.upsert_batch_size):
            batch = samples[i:i + config.upsert_batch_size]

            try:
                self.client.table("timeseries").upsert(
                    batch,
                    on_conflict="point_id,ts"
                ).execute()
                total_inserted += len(batch)
                logger.info(f"Upserted batch {i//config.upsert_batch_size + 1}: {len(batch)} samples")
            except Exception as e:
                logger.error(f"Error upserting batch at index {i}: {e}")

        return total_inserted

# ============================================================================
# Data Processing
# ============================================================================

def transform_samples(
    raw_samples: List[Dict],
    point_cache: Dict[str, int]
) -> List[Dict]:
    """
    Transform ACE API samples to Supabase format

    Input format: {name, time, value}
    Output format: {point_id, ts, value}
    """
    transformed = []
    skipped = 0

    for sample in raw_samples:
        name = sample.get("name") or sample.get("point") or sample.get("point_name")
        time_val = sample.get("time") or sample.get("timestamp") or sample.get("ts")
        value = sample.get("value")

        if not name:
            skipped += 1
            continue

        point_id = point_cache.get(name)
        if not point_id:
            skipped += 1
            continue

        # Parse timestamp
        try:
            if isinstance(time_val, (int, float)):
                timestamp = datetime.fromtimestamp(time_val / 1000.0)
            else:
                timestamp = datetime.fromisoformat(time_val.replace('Z', '+00:00'))
        except Exception:
            skipped += 1
            continue

        # Parse value
        try:
            numeric_value = float(value)
            if not (numeric_value == numeric_value):  # Check for NaN
                skipped += 1
                continue
        except Exception:
            skipped += 1
            continue

        transformed.append({
            "point_id": point_id,
            "ts": timestamp.isoformat(),
            "value": numeric_value
        })

    if skipped > 0:
        logger.warning(f"Skipped {skipped} invalid samples")

    return transformed

def deduplicate_samples(samples: List[Dict]) -> List[Dict]:
    """Remove duplicate samples by (point_id, ts)"""
    seen = {}
    for sample in samples:
        key = (sample["point_id"], sample["ts"])
        seen[key] = sample

    unique = list(seen.values())
    duplicates_removed = len(samples) - len(unique)

    if duplicates_removed > 0:
        logger.info(f"Removed {duplicates_removed} duplicate samples")

    return unique

# ============================================================================
# Core Sync Logic
# ============================================================================

def sync_site(
    ace_client: ACEAPIClient,
    supabase_client: SupabaseClient,
    site: str,
    start_time: str,
    end_time: str,
    max_pages: int = 100
) -> Dict[str, Any]:
    """
    Sync data for a single site

    Returns:
        Dict with sync results
    """
    logger.info(f"Starting sync for site: {site}")

    # Load point cache
    supabase_client.load_point_cache(site)

    total_samples = 0
    total_inserted = 0
    pages_fetched = 0
    cursor = None
    unique_points = set()

    # Fetch and process pages
    while pages_fetched < max_pages:
        # Fetch page from ACE API
        raw_samples, next_cursor, error = ace_client.fetch_timeseries_page(
            site, start_time, end_time, cursor
        )

        if error:
            return {
                "site": site,
                "samples": total_samples,
                "inserted": total_inserted,
                "unique_points": len(unique_points),
                "pages": pages_fetched,
                "error": error
            }

        if not raw_samples:
            if not next_cursor:
                break
            cursor = next_cursor
            pages_fetched += 1
            continue

        # Track unique points
        for sample in raw_samples:
            name = sample.get("name") or sample.get("point")
            if name:
                unique_points.add(name)

        # Create new points if needed
        supabase_client.upsert_points(site, list(unique_points))

        # Transform samples
        transformed = transform_samples(raw_samples, supabase_client.point_cache)
        total_samples += len(raw_samples)

        # Deduplicate
        unique_samples = deduplicate_samples(transformed)

        # Upsert to Supabase
        if unique_samples:
            inserted = supabase_client.upsert_timeseries(unique_samples)
            total_inserted += inserted

        cursor = next_cursor
        pages_fetched += 1

        if not cursor:
            break

        # Progress logging
        if pages_fetched % 10 == 0:
            logger.info(f"Page {pages_fetched}: {total_samples} samples, {total_inserted} inserted")

    return {
        "site": site,
        "samples": total_samples,
        "inserted": total_inserted,
        "unique_points": len(unique_points),
        "pages": pages_fetched
    }

# ============================================================================
# Cloud Functions
# ============================================================================

@functions_framework.http
def continuous_sync(request: Request):
    """
    Continuous sync function - runs every 5 minutes
    Fetches recent data (last 10 minutes) for all sites and upserts to Supabase

    Triggered by: Cloud Scheduler
    Schedule: */5 * * * * (every 5 minutes)
    """
    try:
        start_time = time.time()
        logger.info("="*80)
        logger.info("CONTINUOUS SYNC STARTED")
        logger.info("="*80)

        # Load configuration
        load_config()

        # Initialize clients
        ace_client = ACEAPIClient(config.ace_api_key, config.ace_api_base)
        supabase_client = SupabaseClient(config.supabase_url, config.supabase_key)

        # Calculate time window (last 10 minutes with overlap)
        end_dt = datetime.utcnow()
        start_dt = end_dt - timedelta(minutes=config.sync_window_minutes)

        start_iso = start_dt.isoformat() + "Z"
        end_iso = end_dt.isoformat() + "Z"

        logger.info(f"Time window: {start_iso} -> {end_iso}")

        # Get sites to process
        sites = supabase_client.get_sites_from_db()
        if not sites:
            sites = [config.default_site]

        logger.info(f"Processing {len(sites)} sites: {', '.join(sites)}")

        # Process each site
        results = []
        for site in sites:
            try:
                result = sync_site(
                    ace_client,
                    supabase_client,
                    site,
                    start_iso,
                    end_iso,
                    max_pages=100  # Limit for continuous sync
                )
                results.append(result)
                logger.info(f"Site {site}: {result['inserted']} samples inserted")
            except Exception as e:
                logger.error(f"Error syncing site {site}: {e}")
                results.append({
                    "site": site,
                    "samples": 0,
                    "inserted": 0,
                    "unique_points": 0,
                    "pages": 0,
                    "error": str(e)
                })

        # Calculate totals
        total_samples = sum(r["samples"] for r in results)
        total_inserted = sum(r["inserted"] for r in results)
        failed_sites = sum(1 for r in results if r.get("error"))
        duration = time.time() - start_time

        logger.info("="*80)
        logger.info(f"SYNC COMPLETE - Duration: {duration:.2f}s")
        logger.info(f"Sites: {len(results)}, Samples: {total_samples}, Inserted: {total_inserted}, Failed: {failed_sites}")
        logger.info("="*80)

        return jsonify({
            "success": failed_sites == 0,
            "time_window": f"{start_iso} -> {end_iso}",
            "sites_processed": len(results),
            "total_samples": total_samples,
            "total_inserted": total_inserted,
            "duration_seconds": duration,
            "results": results
        }), 200

    except Exception as e:
        logger.error(f"Continuous sync error: {e}", exc_info=True)
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@functions_framework.http
def backfill_historical(request: Request):
    """
    Historical backfill function - manual HTTP trigger
    Fetches data for a specified date range and site

    Request body (JSON):
    {
        "site": "site-name",  # Optional, defaults to configured site
        "start_date": "2024-01-01",  # Required
        "end_date": "2024-01-31",  # Required
        "max_pages": 1000  # Optional, defaults to 1000
    }

    Returns:
    {
        "success": true,
        "site": "site-name",
        "time_range": "2024-01-01 -> 2024-01-31",
        "samples": 123456,
        "inserted": 123450,
        "duration_seconds": 45.2
    }
    """
    try:
        start_time = time.time()
        logger.info("="*80)
        logger.info("HISTORICAL BACKFILL STARTED")
        logger.info("="*80)

        # Parse request
        request_json = request.get_json(silent=True) or {}

        site = request_json.get("site")
        start_date = request_json.get("start_date")
        end_date = request_json.get("end_date")
        max_pages = request_json.get("max_pages", 1000)

        # Validate required parameters
        if not start_date or not end_date:
            return jsonify({
                "success": False,
                "error": "Missing required parameters: start_date and end_date"
            }), 400

        # Load configuration
        load_config()

        site = site or config.default_site

        # Parse dates
        try:
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))

            start_iso = start_dt.isoformat() + "Z"
            end_iso = end_dt.isoformat() + "Z"
        except Exception as e:
            return jsonify({
                "success": False,
                "error": f"Invalid date format: {e}"
            }), 400

        logger.info(f"Backfill request: site={site}, range={start_iso} -> {end_iso}")

        # Initialize clients
        ace_client = ACEAPIClient(config.ace_api_key, config.ace_api_base)
        supabase_client = SupabaseClient(config.supabase_url, config.supabase_key)

        # Perform backfill
        result = sync_site(
            ace_client,
            supabase_client,
            site,
            start_iso,
            end_iso,
            max_pages=max_pages
        )

        duration = time.time() - start_time

        logger.info("="*80)
        logger.info(f"BACKFILL COMPLETE - Duration: {duration:.2f}s")
        logger.info(f"Site: {site}, Samples: {result['samples']}, Inserted: {result['inserted']}")
        logger.info("="*80)

        return jsonify({
            "success": not result.get("error"),
            "site": site,
            "time_range": f"{start_iso} -> {end_iso}",
            "samples": result["samples"],
            "inserted": result["inserted"],
            "unique_points": result["unique_points"],
            "pages": result["pages"],
            "duration_seconds": duration,
            "error": result.get("error")
        }), 200

    except Exception as e:
        logger.error(f"Historical backfill error: {e}", exc_info=True)
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ============================================================================
# Health Check
# ============================================================================

@functions_framework.http
def health_check(request: Request):
    """Health check endpoint"""
    try:
        load_config()
        return jsonify({
            "status": "healthy",
            "service": "building-vitals-functions",
            "version": "1.0.0",
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }), 200
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "error": str(e)
        }), 500
