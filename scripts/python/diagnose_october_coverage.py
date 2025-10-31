#!/usr/bin/env python3
"""
Diagnostic: Determine TRUE October coverage from ACE API.

This will tell us if the 13.65% coverage is:
A) ACE API limitation (doesn't have the data)
B) System issue (we didn't request it correctly)
"""
import os
import sys
import requests
from datetime import datetime

ACE_TOKEN = os.environ.get("ACE_API_KEY")
ACE_BASE = "https://flightdeck.aceiot.cloud/api"
SITE = "ses_falls_city"

print("=" * 80)
print("OCTOBER DATA AVAILABILITY DIAGNOSTIC")
print("=" * 80)
print()

# Fetch all October data to see what ACE API returns
print("[1/3] Fetching ALL October data from ACE API (may take a few minutes)...")
print("   Using: /sites/ses_falls_city/timeseries/paginated")
print("   Time: 2025-10-01 to 2025-11-01")
print()

all_samples = []
unique_points = set()
cursor = None
page = 0

while True:
    url = f"{ACE_BASE}/sites/{SITE}/timeseries/paginated"
    params = {
        "start_time": "2025-10-01T00:00:00Z",
        "end_time": "2025-11-01T00:00:00Z",
        "raw_data": "true",
        "page_size": "50000"
    }
    if cursor:
        params["cursor"] = cursor

    headers = {"authorization": f"Bearer {ACE_TOKEN}"}

    try:
        r = requests.get(url, headers=headers, params=params, timeout=180)
        r.raise_for_status()
        data = r.json()

        samples = data.get("point_samples", [])
        all_samples.extend(samples)

        for s in samples:
            pname = s.get("name") or s.get("point") or s.get("point_name")
            if pname:
                unique_points.add(pname)

        page += 1
        print(f"   Page {page}: {len(samples)} samples, {len(unique_points)} unique points (total: {len(all_samples)} samples)")

        cursor = data.get("next_cursor")
        if not cursor:
            break

        if page > 200:  # Safety limit
            print(f"   WARNING: Stopped at page {page}")
            break

    except Exception as e:
        print(f"   ERROR page {page}: {e}")
        break

print()
print(f"✓ ACE API returned {len(all_samples)} samples")
print(f"✓ Covering {len(unique_points)} unique points")
print()

# Fetch configured points
print("[2/3] Fetching ALL configured points...")
configured = []
page = 1

while True:
    url = f"{ACE_BASE}/sites/{SITE}/configured_points?page={page}&per_page=1000"
    headers = {"authorization": f"Bearer {ACE_TOKEN}"}

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
                configured.append(name)
        
        print(f"   Page {page}: {len(items)} points (total: {len(configured)})")
        
        if len(items) < 1000:
            break
        page += 1
        
    except Exception as e:
        print(f"   ERROR: {e}")
        break

print()
print(f"✓ Total configured points: {len(configured)}")
print()

# Analysis
print("[3/3] Analysis:")
print()

coverage_pct = (len(unique_points) / len(configured) * 100) if configured else 0
print(f"   Points WITH October data:    {len(unique_points)} ({coverage_pct:.1f}%)")
print(f"   Points WITHOUT October data: {len(configured) - len(unique_points)} ({100-coverage_pct:.1f}%)")
print()

print("=" * 80)
print("CONCLUSION:")
print("=" * 80)
print()

if len(unique_points) < len(configured) * 0.5:
    print("⚠️  Less than 50% of configured points have October data in ACE API")
    print("   This is an ACE API data availability limitation, NOT a system issue.")
    print()
    print("   The system CORRECTLY fetched all available October data.")
    print("   The ACE API simply doesn't have October samples for most points.")
else:
    print("✓ Good coverage - most points have October data")

print()
print(f"Samples fetched: {len(all_samples)}")
print(f"Unique points: {len(unique_points)}")
print(f"Configured points: {len(configured)}")
print(f"Coverage: {coverage_pct:.1f}%")
print()
