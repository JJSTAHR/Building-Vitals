@echo off
REM STABLE October backfill - Proven reliable settings
REM Uses 100k page size (not 500k) to avoid database transaction errors

set ACE_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc0NDE2NzAzNiwianRpIjoiMTI5NmU5NjUtM2Q3OS00MTZkLTg3ZDEtMTY0NGI0ZGQ5N2YxIiwidHlwZSI6ImFjY2VzcyIsImlkZW50aXR5IjoianN0YWhyQHNwZWNpYWxpemVkZW5nLmNvbSIsIm5iZiI6MTc0NDE2NzAzNiwiZXhwIjoxODA3MjM5MDM2fQ.SXf6ZkYnWr4QqavqbTnVJRbhKwb0OrJ3c0hWllESbTg
set SUPABASE_URL=https://jywxcqcjsvlyehuvsoar.supabase.co
set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5d3hjcWNqc3ZseWVodXZzb2FyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTU3NTQ5NywiZXhwIjoyMDc3MTUxNDk3fQ.9haX3ImIZn4bnizDZtqCq4ITwJb3tWR9e90Oxfjj_0M
set ACE_API_BASE=https://flightdeck.aceiot.cloud/api

echo ==================================================
echo STABLE October Backfill Starting...
echo ==================================================
echo Page Size: 100,000 (STABLE - avoids DB timeouts)
echo Chunk Size: 30 minutes (proven reliable)
echo Date Range: 2025-10-01 to 2025-10-31
echo ==================================================
echo.

C:\Users\jstahr\AppData\Local\Programs\Python\Python311\python.exe scripts\python\backfill_paginated_raw.py --site ses_falls_city --start 2025-10-01T00:00:00Z --end 2025-10-31T23:59:59Z --chunk-minutes 30 --page-size 100000 --max-chunks 9999
