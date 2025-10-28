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
from typing import Dict, List, Tuple

import requests
import math
import json
import random
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from supabase import create_client, Client
import math

ACE_BASE_DEFAULT = os.environ.get("ACE_API_BASE", "https://flightdeck.aceiot.cloud/api")


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


def upsert_points(client: Client, site: str, names: List[str]) -> Dict[str, int]:
    names = sorted(set([n for n in names if n]))
    if not names:
        return {}

    # Upsert all names for the site
    rows = [{"site_name": site, "name": n} for n in names]
    # on_conflict => unique(site_name,name)
    client.table("points").upsert(rows, on_conflict="site_name,name").execute()

    # Fetch ids back in manageable chunks
    name_to_id: Dict[str, int] = {}
    for batch in chunk(names, 100):
        res = (
            client.table("points")
            .select("id,name")
            .eq("site_name", site)
            .in_("name", batch)
            .execute()
        )
        for r in res.data or []:
            name_to_id[r["name"]] = int(r["id"])  # type: ignore

    return name_to_id


def upsert_timeseries(client: Client, site: str, samples: List[Dict]) -> int:
    if not samples:
        return 0
    # Map names to ids
    names = list({s["point_name"] for s in samples if s.get("point_name")})
    map_ids = upsert_points(client, site, names)

    # Prepare rows and batch upsert on (point_id,ts)
    total = 0
    rows = []
    for s in samples:
        pid = map_ids.get(s["point_name"])  # type: ignore
        ts_ms = int(s["timestamp"])  # milliseconds
        # Double-guard: filter non-finite values here as well (NaN/Inf)
        try:
            val = float(s["value"])  # double precision
        except Exception:
            continue
        if not math.isfinite(val):
            continue
        if pid is None:
            continue
        # Convert ms -> ISO timestamptz
        ts_iso = iso(datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc))
        rows.append({"point_id": pid, "ts": ts_iso, "value": val})

    for batch in chunk(rows, 1000):
        client.table("timeseries").upsert(batch, on_conflict="point_id,ts").execute()
        total += len(batch)

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

    window_end = end_dt
    window_delta = timedelta(minutes=chunk_minutes)

    while processed < max_chunks and window_end > start_dt:
        window_start = max(start_dt, window_end - window_delta)
        s_iso = iso(window_start)
        e_iso = iso(window_end)
        print(f"[Backfill] {site} {s_iso} -> {e_iso}")

        samples = fetch_paginated_window(
            site, s_iso, e_iso, ace_token, page_size=page_size
        )
        if samples:
            ins = upsert_timeseries(client, site, samples)
            inserted += ins
            print(f"  - fetched={len(samples)} inserted={ins}")
        else:
            print("  - no samples")

        processed += 1
        window_end = window_start

    # Persist new resume cursor for deep backfill
    if update_state:
        try:
            set_ingest_cursor(client, site, iso(window_end))
        except Exception as e:
            print(f"[State] failed to update cursor: {e}", file=sys.stderr)

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

