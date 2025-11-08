@echo off
REM Ultra-fast October backfill - 2-hour chunks for maximum speed
set ACE_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc0NDE2NzAzNiwianRpIjoiMTI5NmU5NjUtM2Q3OS00MTZkLTg3ZDEtMTY0NGI0ZGQ5N2YxIiwidHlwZSI6ImFjY2VzcyIsImlkZW50aXR5IjoianN0YWhyQHNwZWNpYWxpemVkZW5nLmNvbSIsIm5iZiI6MTc0NDE2NzAzNiwiZXhwIjoxODA3MjM5MDM2fQ.SXf6ZkYnWr4QqavqbTnVJRbhKwb0OrJ3c0hWllESbTg
set SUPABASE_URL=https://jywxcqcjsvlyehuvsoar.supabase.co
set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5d3hjcWNqc3ZseWVodXZzb2FyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTU3NTQ5NywiZXhwIjoyMDc3MTUxNDk3fQ.9haX3ImIZn4bnizDZtqCq4ITwJb3tWR9e90Oxfjj_0M
set ACE_API_BASE=https://flightdeck.aceiot.cloud/api

REM Optimizations for maximum speed:
REM - chunk-minutes: 120 (2 hours per chunk = fewer API calls, more data per chunk)
REM - page-size: 100000 (maximum page size)
REM - max-chunks: 9999 (process entire month)
REM Expected: ~350 chunks total (29 days * 12 chunks/day), ~12-15 hours completion
C:\Users\jstahr\AppData\Local\Programs\Python\Python311\python.exe scripts\python\backfill_paginated_raw.py --site ses_falls_city --start 2025-10-01T00:00:00Z --end 2025-10-29T23:59:59Z --chunk-minutes 120 --page-size 100000 --max-chunks 9999
