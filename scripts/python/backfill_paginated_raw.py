#!/usr/bin/env python3
"""
Backfill RAW samples from ACE paginated endpoint into Supabase (points, timeseries).

- RAW only: uses /sites/{site}/timeseries/paginated?raw_data=true&page_size=...
- Idempotent writes: upsert points on (site_name,name) and timeseries on (point_id,ts)
- Chunked windows: default 10-minute windows walking from end -> start

Usage (env or CLI):
- Env:
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ACE_API_KEY
- CLI:
  --site SITE --start 2025-10-01T00:00:00Z --end 2025-10-27T00:00:00Z --chunk-minutes 10 --page-size 10000 --max-chunks 120

Examples:
  python scripts/python/backfill_paginated_raw.py \
    --site ses_falls_city --start 2025-10-01T00:00:00Z --end 2025-10-27T00:00:00Z \
    --chunk-minutes 10 --page-size 10000 --max-chunks 200

  # Tail-fill last 60 minutes by omitting --start/--end
  python scripts/python/backfill_paginated_raw.py --site ses_falls_city
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Tuple, Optional

import requests
import math
import json
import random
import shlex
import subprocess
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from supabase import create_client, Client
import math

ACE_BASE_DEFAULT = os.environ.get("ACE_API_BASE", "https://flightdeck.aceiot.cloud/api")

def _ace_supports_point_names(ace_base: str) -> bool:
    """Return True if the ACE base is known to support point_names filtering.
    Vendor flightdeck base typically does not; proxy/custom bases may.
    """
    try:
        base = (ace_base or "").lower()
        if "flightdeck.aceiot.cloud/api" in base:
            return False
        # Assume non-vendor bases (e.g., custom proxy) support point_names
        return True
    except Exception:
        return False


def parse_iso(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def chunk(lst, size):
    for i in range(0, len(lst), size):
        yield lst[i : i + size]


def get_site_earliest_ts(supabase_url: str, supabase_key: str, site: str) -> int | None:
    base = supabase_url.rstrip("/")
    url = f"{base}/rest/v1/timeseries?select=ts,points!inner(site_name)&points.site_name=eq.{site}&order=ts.asc&limit=1"
    headers = {"apikey": supabase_key, "Authorization": f"Bearer {supabase_key}", "accept": "application/json"}
    try:
        r = requests.get(url, headers=headers, timeout=30)
        if not r.ok:
            return None
        data = r.json() if r.content else []
        if not data:
            return None
        ts_iso = data[0].get("ts")
        if not ts_iso:
            return None
        return int(datetime.fromisoformat(ts_iso.replace("Z","+00:00")).timestamp() * 1000)
    except Exception:
        return None


def fetch_paginated_window(
    site: str,
    start_iso: str,
    end_iso: str,
    ace_token: str,
    page_size: int = 100000,
    timeout_sec: int = 180,
    ace_base: str = ACE_BASE_DEFAULT,
    point_names: Optional[List[str]] = None,
) -> List[Dict]:
    """Fetch RAW samples for a site/time window using ACE paginated endpoint (raw_data=true)."""
    out: List[Dict] = []
    cursor = None
    started = time.time()
    pages = 0
    session = requests.Session()
    retry = Retry(total=5, connect=3, read=3, backoff_factor=0.5,
                  status_forcelist=(429, 500, 502, 503, 504, 520, 521, 522, 523),
                  allowed_methods=frozenset(["GET"]),
                  respect_retry_after_header=True)
    adapter = HTTPAdapter(max_retries=retry, pool_maxsize=4)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    session.headers.update({
        "authorization": f"Bearer {ace_token}",
        "accept": "application/json",
        "accept-encoding": "identity",
        "connection": "keep-alive",
        "user-agent": "bv-backfill/1.0"
    })

    # Cap page size conservatively to reduce chunked transfer failures
    effective_page_size = max(10000, min(int(page_size), 50000))

    while True:
        url = f"{ace_base}/sites/{site}/timeseries/paginated"
        params = {
            "start_time": start_iso,
            "end_time": end_iso,
            "raw_data": "true",
            "page_size": str(effective_page_size),
        }
        if cursor:
            params["cursor"] = cursor
        if point_names and _ace_supports_point_names(ace_base):
            # Pass a reduced set of names to keep payload sizes small
            params["point_names"] = ",".join(point_names)

        # Remaining time budget guard
        elapsed = time.time() - started
        time_left = max(1, timeout_sec - int(elapsed))
        if time_left <= 2:
            break

        # Robust fetch+parse with retries; downsize page + backoff on failures
        last_err = None
        data = {}
        for attempt in range(4):
            try:
                resp = session.get(url, params=params, timeout=time_left, stream=True)
                if not resp.ok:
                    raise RuntimeError(f"ACE {resp.status_code}: {resp.text[:200]}")
                buf = bytearray()
                for chunk in resp.iter_content(chunk_size=65536):
                    if chunk:
                        buf.extend(chunk)
                text = buf.decode(resp.encoding or 'utf-8', errors='replace')
                data = json.loads(text) if text else {}
                break
            except (requests.exceptions.ChunkedEncodingError,
                    requests.exceptions.ContentDecodingError,
                    requests.exceptions.RequestException,
                    json.JSONDecodeError) as e:
                last_err = e
                if effective_page_size > 10000:
                    effective_page_size = max(10000, int(effective_page_size * 0.6))
                    params["page_size"] = str(effective_page_size)
                time.sleep(0.5 * (attempt + 1) + random.uniform(0, 0.2))
                continue
        else:
            raise last_err
        rows = data.get("point_samples") or []

        # Track empty pages to avoid infinite loops on bad cursors
        if not rows:
            # Empty page - check if this is the end or a cursor issue
            cursor = data.get("next_cursor") or None
            if not cursor:
                break  # No more data
            # If cursor exists but no data, try one more time then stop
            pages += 1
            if pages > 200:
                break
            continue  # Try next cursor

        for r in rows:
            name = r.get("name") or r.get("point") or r.get("point_name")
            t = r.get("time") or r.get("timestamp") or r.get("ts")
            try:
                ts = int(t) if isinstance(t, int) else int(datetime.fromisoformat(str(t).replace("Z","+00:00")).timestamp() * 1000)
            except Exception:
                continue
            try:
                val_raw = r.get("value")
                # Reject explicit string NaN/Inf first
                if isinstance(val_raw, str) and val_raw.strip().lower() in ("nan", "+inf", "-inf", "inf", "infinity"):
                    continue
                val = float(val_raw)
                if not math.isfinite(val):
                    continue
            except Exception:
                continue
            if not name:
                continue
            out.append({"point_name": name, "timestamp": ts, "value": val})

        cursor = data.get("next_cursor") or None
        pages += 1
        if not cursor or pages > 200:
            break

    return out


def get_point_names_from_supabase(client: Client, site: str, limit: int = 100000) -> List[str]:
    names: List[str] = []
    try:
        # Fetch up to limit names from points table for this site
        res = client.table("points").select("name").eq("site_name", site).execute()
        for r in (res.data or []):
            n = str(r.get("name") or "").strip()
            if n:
                names.append(n)
    except Exception:
        return []
    # De-duplicate, capped by limit
    out = list(dict.fromkeys(names))
    return out[:limit]


def fetch_window_via_cli(
    site: str,
    start_iso: str,
    end_iso: str,
    ace_token: str,
    page_size: int,
    point_names: Optional[List[str]] = None,
    timeout_sec: int = 120,
) -> List[Dict]:
    """Use aceiot-models-cli to fetch a window; returns list of {point_name,timestamp,value}.
    Falls back to empty list on error; caller may retry with smaller params.
    """
    base_cmd = os.environ.get("ACE_CLI_CMD", "aceiot-models")
    args = [
        base_cmd,
        "timeseries",
        "--site", site,
        "--start", start_iso,
        "--end", end_iso,
        "--raw-data",
        "--page-size", str(page_size),
        "--format", "json",
    ]
    if point_names:
        args += ["--point-names", ",".join(point_names)]
    env = dict(os.environ)
    # Many CLIs read token from env; provide explicitly
    env["ACE_API_KEY"] = ace_token
    # Also pass base if provided in environment
    if os.environ.get("ACE_API_BASE"):
        env["ACE_API_BASE"] = os.environ.get("ACE_API_BASE")
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=timeout_sec, env=env)
        if p.returncode != 0:
            return []
        text = p.stdout.strip()
        data: List[Dict] = []
        try:
            obj = json.loads(text)
            # Accept either {point_samples:[..]} or list
            rows = obj.get("point_samples") if isinstance(obj, dict) else obj
            if isinstance(rows, list):
                for s in rows:
                    n = s.get("name") or s.get("point") or s.get("point_name")
                    t = s.get("time") or s.get("timestamp") or s.get("ts")
                    v = s.get("value")
                    try:
                        ts = int(t) if isinstance(t, int) else int(datetime.fromisoformat(str(t).replace("Z","+00:00")).timestamp() * 1000)
                    except Exception:
                        continue
                    try:
                        val = float(v)
                    except Exception:
                        continue
                    if n and math.isfinite(val):
                        data.append({"point_name": n, "timestamp": ts, "value": val})
        except json.JSONDecodeError:
            # Try NDJSON fallback
            for line in text.splitlines():
                line = line.strip()
                if not line:
                    continue
                try:
                    s = json.loads(line)
                    n = s.get("name") or s.get("point") or s.get("point_name")
                    t = s.get("time") or s.get("timestamp") or s.get("ts")
                    v = s.get("value")
                    ts = int(t) if isinstance(t, int) else int(datetime.fromisoformat(str(t).replace("Z","+00:00")).timestamp() * 1000)
                    val = float(v)
                    if n and math.isfinite(val):
                        data.append({"point_name": n, "timestamp": ts, "value": val})
                except Exception:
                    continue
        return data
    except Exception:
        return []


def load_all_point_ids(client: Client, site: str) -> Dict[str, int]:
    """Pre-load ALL existing point IDs for the site to avoid repeated upserts"""
    name_to_id: Dict[str, int] = {}
    offset = 0
    batch_size = 1000

    while True:
        res = (
            client.table("points")
            .select("id,name")
            .eq("site_name", site)
            .range(offset, offset + batch_size - 1)
            .execute()
        )
        if not res.data:
            break
        for r in res.data:
            name_to_id[r["name"]] = int(r["id"])
        if len(res.data) < batch_size:
            break
        offset += batch_size

    return name_to_id


def upsert_points(client: Client, site: str, names: List[str], point_cache: Dict[str, int]) -> Dict[str, int]:
    """Insert only NEW points, use cache for existing ones. Avoids expensive upserts."""
    names = sorted(set([n for n in names if n]))
    if not names:
        return {}

    # Identify which points are new (not in cache)
    new_names = [n for n in names if n not in point_cache]

    if new_names:
        # Insert new points in small batches
        rows = [{"site_name": site, "name": n} for n in new_names]
        for batch_rows in chunk(rows, 50):
            try:
                # Use insert instead of upsert - faster and won't timeout
                # If duplicate, the DB will reject it and we'll fetch the ID
                client.table("points").insert(batch_rows).execute()
            except Exception:
                # Conflict means point already exists, will fetch ID below
                pass

        # Fetch IDs for the new points we just inserted
        for batch in chunk(new_names, 100):
            res = (
                client.table("points")
                .select("id,name")
                .eq("site_name", site)
                .in_("name", batch)
                .execute()
            )
            for r in res.data or []:
                point_cache[r["name"]] = int(r["id"])

    # Return IDs for requested names (from cache)
    return {n: point_cache[n] for n in names if n in point_cache}


def upsert_timeseries(client: Client, site: str, samples: List[Dict], point_cache: Dict[str, int]) -> int:
    """Insert timeseries data using pre-loaded point cache. Uses INSERT for speed."""
    if not samples:
        return 0

    # Map names to ids using cache
    names = list({s["point_name"] for s in samples if s.get("point_name")})
    map_ids = upsert_points(client, site, names, point_cache)

    # Prepare rows
    total = 0
    rows = []
    for s in samples:
        pid = map_ids.get(s["point_name"])  # type: ignore
        ts_ms = int(s["timestamp"])  # milliseconds
        # Filter non-finite values (NaN/Inf)
        try:
            val = float(s["value"])
        except Exception:
            continue
        if not math.isfinite(val):
            continue
        if pid is None:
            continue
        # Convert ms -> ISO timestamptz
        ts_iso = iso(datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc))
        rows.append({"point_id": pid, "ts": ts_iso, "value": val})

    # Deduplicate rows by (point_id, ts)
    deduped = {}
    for row in rows:
        key = (row["point_id"], row["ts"])
        deduped[key] = row
    unique_rows = list(deduped.values())

    # Use INSERT with larger batches (50) - faster than upsert, conflicts are ignored
    for batch in chunk(unique_rows, 50):
        try:
            # Try insert - faster than upsert
            client.table("timeseries").insert(batch).execute()
            total += len(batch)
        except Exception:
            # If conflict (duplicate data), try upsert with smaller batch
            for mini_batch in chunk(batch, 10):
                try:
                    client.table("timeseries").upsert(mini_batch, on_conflict="point_id,ts").execute()
                    total += len(mini_batch)
                except Exception:
                    # Skip this batch if still failing
                    pass

    return total


def get_ingest_cursor(client: Client, site: str) -> str | None:
    try:
        res = client.table("ingest_state").select("backfill_end").eq("site_name", site).limit(1).execute()
        data = res.data or []
        if data and data[0].get("backfill_end"):
            return str(data[0]["backfill_end"])  # ISO string
    except Exception:
        return None
    return None


def set_ingest_cursor(client: Client, site: str, end_iso: str) -> None:
    try:
        client.table("ingest_state").upsert({"site_name": site, "backfill_end": end_iso}, on_conflict="site_name").execute()
    except Exception:
        pass


def run_backfill(
    client: Client,
    site: str,
    start_dt: datetime,
    end_dt: datetime,
    chunk_minutes: int,
    page_size: int,
    ace_token: str,
    max_chunks: int,
    update_state: bool = False,
) -> Tuple[int, int]:
    processed = 0
    inserted = 0
    total_samples_fetched = 0
    total_points_discovered = set()
    start_time = time.time()

    # Pre-load ALL existing point IDs for this site to avoid expensive upserts
    print(f"\n{'='*80}")
    print(f"BACKFILL STARTING - {site}")
    print(f"{'='*80}")
    print(f"Time range: {start_dt.isoformat()} -> {end_dt.isoformat()}")
    print(f"Chunk size: {chunk_minutes} minutes")
    print(f"Max chunks: {max_chunks}")
    print(f"Page size: {page_size}")
    print(f"{'='*80}\n")

    print(f"[1/3] Pre-loading existing point IDs for {site}...")
    cache_start = time.time()
    point_cache = load_all_point_ids(client, site)
    cache_time = time.time() - cache_start
    print(f"      OK Loaded {len(point_cache)} existing points ({cache_time:.1f}s)")

    window_end = end_dt
    window_delta = timedelta(minutes=chunk_minutes)

    print(f"\n[2/3] Fetching data from ACE API...")

    chunk_num = 0
    while processed < max_chunks and window_end > start_dt:
        chunk_num += 1
        window_start = max(start_dt, window_end - window_delta)
        s_iso = iso(window_start)
        e_iso = iso(window_end)

        window_start_time = time.time()
        print(f"\n   Chunk {chunk_num}/{max_chunks}: {s_iso} -> {e_iso}")

        # Prefer point-chunked fetch to keep payload sizes small
        point_names = get_point_names_from_supabase(client, site)
        total_window_samples = 0
        window_points = set()
        if point_names:
            for pn_chunk in chunk(point_names, 300):
                use_cli = os.environ.get("USE_ACE_CLI", "0") == "1"
                if use_cli:
                    samples = fetch_window_via_cli(site, s_iso, e_iso, ace_token, page_size, list(pn_chunk))
                    # Retry with smaller pages if nothing returned
                    if not samples:
                        # second CLI attempt with smaller page size, then HTTP fallback
                        samples = fetch_window_via_cli(site, s_iso, e_iso, ace_token, max(5000, int(page_size*0.6)), list(pn_chunk))
                        if not samples:
                            samples = fetch_paginated_window(
                                site, s_iso, e_iso, ace_token, page_size=max(5000, int(page_size*0.6)), point_names=list(pn_chunk)
                            )
                else:
                    samples = fetch_paginated_window(
                        site, s_iso, e_iso, ace_token, page_size=page_size, point_names=list(pn_chunk)
                    )
                if samples:
                    # Track unique points
                    for s in samples:
                        if s.get("point_name"):
                            window_points.add(s["point_name"])
                            total_points_discovered.add(s["point_name"])

                    ins = upsert_timeseries(client, site, samples, point_cache)
                    inserted += ins
                    total_window_samples += len(samples)
                    total_samples_fetched += len(samples)
        else:
            # Fallback to site-wide fetch if no names cached in Supabase
            samples = fetch_paginated_window(
                site, s_iso, e_iso, ace_token, page_size=page_size
            )
            if samples:
                # Track unique points
                for s in samples:
                    if s.get("point_name"):
                        window_points.add(s["point_name"])
                        total_points_discovered.add(s["point_name"])

                ins = upsert_timeseries(client, site, samples, point_cache)
                inserted += ins
                total_window_samples = len(samples)
                total_samples_fetched += len(samples)

        window_time = time.time() - window_start_time
        elapsed = time.time() - start_time

        print(f"      --> Chunk complete: {total_window_samples} samples, {len(window_points)} unique points ({window_time:.1f}s)")
        print(f"      --> Total progress: {total_samples_fetched} samples, {len(total_points_discovered)} points, {inserted} inserted ({elapsed:.1f}s elapsed)")

        processed += 1
        window_end = window_start

    # Persist new resume cursor for deep backfill
    if update_state:
        try:
            set_ingest_cursor(client, site, iso(window_end))
        except Exception as e:
            print(f"[State] failed to update cursor: {e}", file=sys.stderr)

    total_time = time.time() - start_time

    print(f"\n[3/3] Backfill complete!")
    print(f"\n{'='*80}")
    print(f"BACKFILL SUMMARY")
    print(f"{'='*80}")
    print(f"Total time:           {total_time:.1f}s ({total_time/60:.1f} minutes)")
    print(f"Chunks processed:     {processed}/{max_chunks}")
    print(f"Samples fetched:      {total_samples_fetched}")
    print(f"Samples inserted:     {inserted}")
    print(f"Unique points:        {len(total_points_discovered)}")
    print(f"Insert efficiency:    {(inserted/total_samples_fetched*100):.1f}%" if total_samples_fetched > 0 else "N/A")
    print(f"Throughput:           {total_samples_fetched/total_time:.0f} samples/sec" if total_time > 0 else "N/A")
    print(f"{'='*80}\n")

    return processed, inserted


def main():
    ap = argparse.ArgumentParser(description="RAW paginated backfill to Supabase")
    ap.add_argument("--site", required=True, help="Site name (e.g., ses_falls_city)")
    ap.add_argument("--start", help="Start ISO (default: 2025-01-01T00:00:00Z if omitted)")
    ap.add_argument("--end", help="End ISO (default: earliest existing ts for site, or now if none)")
    ap.add_argument("--chunk-minutes", type=int, default=10, help="Chunk size minutes")
    ap.add_argument("--page-size", type=int, default=100000, help="ACE paginated page size")
    ap.add_argument("--max-chunks", type=int, default=120, help="Max chunks to process per run")
    ap.add_argument("--timeout-sec", type=int, default=180, help="Per-window ACE request time budget")

    args = ap.parse_args()

    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    ace_token = os.environ.get("ACE_API_KEY")
    if not supabase_url or not supabase_key or not ace_token:
        print("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY or ACE_API_KEY in env", file=sys.stderr)
        sys.exit(2)

    # Determine start/end strategy for deep backfill
    now = datetime.now(tz=timezone.utc)
    start_default = datetime(2025, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    start_dt = parse_iso(args.start) if args.start else start_default
    client: Client = create_client(supabase_url, supabase_key)

    if args.end:
        end_dt = parse_iso(args.end)
        stateful = False
    else:
        cur = get_ingest_cursor(client, args.site)
        if cur:
            end_dt = parse_iso(cur)
            stateful = True
        else:
            earliest_ms = get_site_earliest_ts(supabase_url, supabase_key, args.site)
            end_dt = datetime.fromtimestamp(earliest_ms / 1000, tz=timezone.utc) if earliest_ms else now
            stateful = True

    processed, inserted = run_backfill(
        client,
        site=args.site,
        start_dt=start_dt,
        end_dt=end_dt,
        chunk_minutes=max(1, int(args.chunk_minutes)),
        page_size=max(10, int(args.page_size)),
        ace_token=ace_token,
        max_chunks=max(1, int(args.max_chunks)),
        update_state=stateful,
    )

    print(f"Done. processed_chunks={processed} rows_inserted={inserted}")


if __name__ == "__main__":
    main()

