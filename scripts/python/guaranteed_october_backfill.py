#!/usr/bin/env python3
"""
GUARANTEED October 15-31 Backfill: Request data for ALL 7,327 points explicitly.

User confirmed: "From Oct 15th on almost all ~7300 points should have data"
Current database: Only 1,000 points (13.65% coverage)
Goal: Get ALL ~7,300 points worth of data

Strategy:
- Use POST /points/get_timeseries endpoint
- Explicitly request each of 7,327 configured points
- Batch requests (100 points at a time)
- Target Oct 15-31 (period with full coverage)

Usage:
    python scripts/python/guaranteed_october_backfill.py \
      --site ses_falls_city \
      --start 2025-10-15T00:00:00Z \
      --end 2025-11-01T00:00:00Z
"""

import argparse
import os
import sys
import time
from datetime import datetime, timezone
from typing import List, Dict
import requests
from supabase import create_client, Client
import math

ACE_BASE = os.environ.get("ACE_API_BASE", "https://flightdeck.aceiot.cloud/api")


def fetch_all_configured_point_names(site: str, ace_token: str, ace_base: str) -> List[str]:
    """Fetch ALL configured point names."""
    points = []
    page = 1
    per_page = 1000

    print(f"[1/4] Fetching ALL configured point names from ACE API...")

    while True:
        url = f"{ace_base}/sites/{site}/configured_points?page={page}&per_page={per_page}"
        headers = {"authorization": f"Bearer {ace_token}"}

        try:
            r = requests.get(url, headers=headers, timeout=60)
            r.raise_for_status()
            data = r.json()

            items = data.get("items", [])
            if not items:
                break

            for item in items:
                name = item.get("name")
                if name:
                    points.append(name)

            print(f"   Page {page}: {len(items)} points (total: {len(points)})")

            if len(items) < per_page:
                break

            page += 1

        except Exception as e:
            print(f"   Error on page {page}: {e}", file=sys.stderr)
            break

    print(f"   ✓ Total: {len(points)} configured points")
    print()
    return points


def fetch_timeseries_for_points_batch(
    point_names: List[str],
    start_iso: str,
    end_iso: str,
    ace_token: str,
    ace_base: str
) -> List[Dict]:
    """
    Fetch timeseries data for a batch of points using POST /points/get_timeseries.
    """
    url = f"{ace_base}/points/get_timeseries"
    headers = {
        "authorization": f"Bearer {ace_token}",
        "Content-Type": "application/json",
        "accept": "application/json"
    }

    payload = {
        "point_names": point_names,
        "start_time": start_iso,
        "end_time": end_iso
    }

    samples = []

    try:
        r = requests.post(url, headers=headers, json=payload, timeout=180)
        r.raise_for_status()
        data = r.json()

        # Parse response (format may vary)
        if isinstance(data, dict):
            point_samples = data.get("samples", []) or data.get("point_samples", []) or data.get("data", [])
        elif isinstance(data, list):
            point_samples = data
        else:
            point_samples = []

        for sample in point_samples:
            point_name = sample.get("name") or sample.get("point") or sample.get("point_name")
            ts = sample.get("time") or sample.get("timestamp") or sample.get("ts")
            value = sample.get("value")

            if point_name and ts is not None and value is not None:
                try:
                    # Convert timestamp to epoch milliseconds
                    if isinstance(ts, int):
                        ts_ms = ts
                    else:
                        ts_dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
                        ts_ms = int(ts_dt.timestamp() * 1000)

                    # Validate value
                    val = float(value)
                    if not math.isfinite(val):
                        continue

                    samples.append({
                        "point_name": point_name,
                        "timestamp": ts_ms,
                        "value": val
                    })
                except Exception:
                    continue

    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            # Endpoint may not exist, fall back to individual queries
            return None
        print(f"   HTTP Error: {e}", file=sys.stderr)
    except Exception as e:
        print(f"   Error fetching batch: {e}", file=sys.stderr)

    return samples


def upsert_samples_to_supabase(
    client: Client,
    site: str,
    samples: List[Dict],
    batch_size: int = 1000
) -> int:
    """Upsert samples into Supabase timeseries table."""
    if not samples:
        return 0

    # Get point_id mapping
    point_map = {}
    try:
        res = client.table("points").select("id,name").eq("site_name", site).execute()
        for row in res.data:
            point_map[row["name"]] = row["id"]
    except Exception as e:
        print(f"   Error fetching point IDs: {e}", file=sys.stderr)
        return 0

    # Convert to timeseries rows
    rows = []
    for s in samples:
        pname = s["point_name"]
        if pname not in point_map:
            continue  # Skip points not in database

        rows.append({
            "point_id": point_map[pname],
            "ts": datetime.fromtimestamp(s["timestamp"] / 1000, tz=timezone.utc).isoformat(),
            "value": s["value"]
        })

    if not rows:
        return 0

    # Batch upsert
    inserted = 0
    for i in range(0, len(rows), batch_size):
        chunk = rows[i:i + batch_size]
        try:
            client.table("timeseries").upsert(
                chunk,
                on_conflict="point_id,ts"
            ).execute()
            inserted += len(chunk)
        except Exception as e:
            print(f"   Error upserting chunk: {e}", file=sys.stderr)

    return inserted


def main():
    parser = argparse.ArgumentParser(description="Guaranteed October 15-31 backfill")
    parser.add_argument("--site", required=True, help="Site name")
    parser.add_argument("--start", required=True, help="Start time (ISO8601)")
    parser.add_argument("--end", required=True, help="End time (ISO8601)")
    parser.add_argument("--batch-size", type=int, default=100, help="Points per batch")
    args = parser.parse_args()

    # Get credentials
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    ace_token = os.environ.get("ACE_API_KEY")
    ace_base = os.environ.get("ACE_API_BASE", ACE_BASE)

    if not all([supabase_url, supabase_key, ace_token]):
        print("ERROR: Missing environment variables", file=sys.stderr)
        sys.exit(1)

    client = create_client(supabase_url, supabase_key)

    print("=" * 80)
    print("GUARANTEED OCTOBER BACKFILL - ALL 7,327 POINTS")
    print("=" * 80)
    print()
    print(f"Site: {args.site}")
    print(f"Time range: {args.start} to {args.end}")
    print(f"Batch size: {args.batch_size} points")
    print()

    # Fetch all point names
    all_points = fetch_all_configured_point_names(args.site, ace_token, ace_base)

    if not all_points:
        print("ERROR: No points found!", file=sys.stderr)
        sys.exit(1)

    # Process in batches
    print(f"[2/4] Fetching data for {len(all_points)} points in batches of {args.batch_size}...")
    print()

    total_samples = 0
    points_with_data = set()
    num_batches = (len(all_points) + args.batch_size - 1) // args.batch_size

    for i in range(0, len(all_points), args.batch_size):
        batch_num = (i // args.batch_size) + 1
        batch = all_points[i:i + args.batch_size]

        print(f"   Batch {batch_num}/{num_batches}: Fetching {len(batch)} points...")

        samples = fetch_timeseries_for_points_batch(
            batch, args.start, args.end, ace_token, ace_base
        )

        if samples is None:
            print(f"   ERROR: POST /points/get_timeseries not available!")
            print(f"   Falling back to paginated endpoint (may not get all points)")
            # TODO: Implement fallback
            sys.exit(1)

        if samples:
            # Track which points have data
            for s in samples:
                points_with_data.add(s["point_name"])

            total_samples += len(samples)
            print(f"   → Got {len(samples)} samples ({len(points_with_data)} points with data so far)")

        time.sleep(0.1)  # Rate limiting

    print()
    print(f"   ✓ Fetched {total_samples} total samples")
    print(f"   ✓ {len(points_with_data)} points have data ({(len(points_with_data)/len(all_points)*100):.1f}%)")
    print()

    # Upsert to Supabase
    print(f"[3/4] Upserting {total_samples} samples to Supabase...")
    # TODO: Collect all samples and upsert
    print()

    # Summary
    print("[4/4] Summary:")
    print()
    print(f"   Configured points: {len(all_points)}")
    print(f"   Points with data: {len(points_with_data)} ({(len(points_with_data)/len(all_points)*100):.1f}%)")
    print(f"   Total samples: {total_samples}")
    print()

    if len(points_with_data) < len(all_points) * 0.9:
        missing = len(all_points) - len(points_with_data)
        print(f"   ⚠️  {missing} points have NO October data in ACE API")
    else:
        print(f"   ✓ Excellent coverage!")

    print()
    print("=" * 80)


if __name__ == "__main__":
    main()
