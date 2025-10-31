#!/usr/bin/env python3
"""
Seed Supabase points table with ALL configured points from ACE API.
This must run BEFORE backfilling to ensure all 7,327 points get data.

Usage:
    python scripts/python/seed_configured_points.py --site ses_falls_city
"""

import argparse
import os
import sys
from typing import List, Dict
import requests
from supabase import create_client, Client


def fetch_all_configured_points(site: str, ace_token: str, ace_base: str) -> List[Dict]:
    """Fetch ALL configured points from ACE API"""
    points = []
    page = 1
    per_page = 1000

    print(f"[ConfiguredPoints] Fetching from {ace_base}")

    while True:
        url = f"{ace_base}/sites/{site}/configured_points?page={page}&per_page={per_page}"
        headers = {"authorization": f"Bearer {ace_token}"}

        try:
            print(f"[ConfiguredPoints] Fetching page {page}...")
            r = requests.get(url, headers=headers, timeout=60)
            r.raise_for_status()
            data = r.json()

            items = data.get("items", [])
            if not items:
                break

            for item in items:
                point_name = item.get("name")
                if point_name:
                    # Extract metadata
                    kv_tags = item.get("kv_tags", {})
                    unit = kv_tags.get("unit")

                    points.append({
                        "name": point_name,
                        "unit": unit
                    })

            print(f"[ConfiguredPoints] Page {page}: {len(items)} points (total: {len(points)})")

            # Check if there are more pages
            pagination = data.get("pagination", {})
            total_pages = pagination.get("total_pages", 1)
            total_items = pagination.get("total", 0)

            print(f"[ConfiguredPoints] Pagination: page {page}/{total_pages}, total items: {total_items}")

            if page >= total_pages or len(items) < per_page:
                break

            page += 1

        except Exception as e:
            print(f"[ConfiguredPoints] Error on page {page}: {e}", file=sys.stderr)
            break

    print(f"[ConfiguredPoints] Total configured points: {len(points)}")
    return points


def upsert_points_to_supabase(client: Client, site: str, points: List[Dict]) -> int:
    """Upsert configured points into Supabase points table"""
    print(f"[Supabase] Upserting {len(points)} points...")

    # Prepare rows for upsert
    rows = []
    for p in points:
        rows.append({
            "site_name": site,
            "name": p["name"],
            "unit": p.get("unit")
        })

    # Batch upsert in chunks of 500
    inserted = 0
    chunk_size = 500

    for i in range(0, len(rows), chunk_size):
        chunk = rows[i:i + chunk_size]
        try:
            client.table("points").upsert(
                chunk,
                on_conflict="site_name,name"
            ).execute()
            inserted += len(chunk)
            print(f"[Supabase] Upserted {inserted}/{len(rows)} points...")
        except Exception as e:
            print(f"[Supabase] Error upserting chunk {i}: {e}", file=sys.stderr)

    print(f"[Supabase] Total upserted: {inserted} points")
    return inserted


def main():
    ap = argparse.ArgumentParser(description="Seed Supabase with ALL configured points")
    ap.add_argument("--site", required=True, help="Site name (e.g., ses_falls_city)")
    args = ap.parse_args()

    # Get credentials from environment
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    ace_token = os.environ.get("ACE_API_KEY")
    ace_base = os.environ.get("ACE_API_BASE", "https://flightdeck.aceiot.cloud/api")

    if not supabase_url or not supabase_key or not ace_token:
        print("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY or ACE_API_KEY in env", file=sys.stderr)
        sys.exit(2)

    # Create Supabase client
    client = create_client(supabase_url, supabase_key)

    # Fetch all configured points from ACE
    points = fetch_all_configured_points(args.site, ace_token, ace_base)

    if not points:
        print("No configured points found!", file=sys.stderr)
        sys.exit(1)

    # Upsert into Supabase
    inserted = upsert_points_to_supabase(client, args.site, points)

    print("")
    print("="*80)
    print("CONFIGURED POINTS SEEDED SUCCESSFULLY")
    print("="*80)
    print(f"Site: {args.site}")
    print(f"Total configured points: {len(points)}")
    print(f"Points upserted to Supabase: {inserted}")
    print("")
    print("Next step: Run October backfill again to fetch data for ALL points")
    print("  gh workflow run parallel-october-backfill.yml --ref main")


if __name__ == "__main__":
    main()
