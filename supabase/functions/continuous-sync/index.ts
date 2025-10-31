// Continuous sync Edge Function - Fetches last 10 minutes from ACE API every 5 minutes
// Auto-scheduled via pg_cron

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SITE = 'ses_falls_city'
const ACE_API_BASE = 'https://flightdeck.aceiot.cloud/api'
const PAGE_SIZE = 10000
const SYNC_WINDOW_MINUTES = 10 // Fetch last 10 minutes

interface Sample {
  point_name: string
  timestamp: number // milliseconds
  value: number
}

interface PointCache {
  [name: string]: number // point_id
}

Deno.serve(async (req) => {
  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const aceApiKey = Deno.env.get('ACE_API_KEY')!

    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log(`[${new Date().toISOString()}] Continuous sync starting...`)

    // Calculate time window (last 10 minutes)
    const endTime = new Date()
    const startTime = new Date(endTime.getTime() - SYNC_WINDOW_MINUTES * 60 * 1000)

    const startISO = startTime.toISOString()
    const endISO = endTime.toISOString()

    console.log(`Fetching: ${startISO} -> ${endISO}`)

    // Fetch data from ACE API with pagination
    const samples = await fetchPaginatedData(aceApiKey, startISO, endISO)

    console.log(`Fetched ${samples.length} samples`)

    if (samples.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No new data',
          samples: 0,
          timeWindow: `${startISO} -> ${endISO}`
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Pre-load point cache (existing points)
    const pointCache: PointCache = {}
    const { data: existingPoints } = await supabase
      .from('points')
      .select('id, name')
      .eq('site_name', SITE)
      .limit(10000)

    for (const point of existingPoints || []) {
      pointCache[point.name] = point.id
    }

    console.log(`Loaded ${Object.keys(pointCache).length} existing points`)

    // Upsert samples
    const inserted = await upsertTimeseries(supabase, samples, pointCache)

    console.log(`Inserted ${inserted} samples`)

    return new Response(
      JSON.stringify({
        success: true,
        samples: samples.length,
        inserted,
        timeWindow: `${startISO} -> ${endISO}`,
        uniquePoints: new Set(samples.map(s => s.point_name)).size
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Sync error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})

async function fetchPaginatedData(
  aceApiKey: string,
  startISO: string,
  endISO: string
): Promise<Sample[]> {
  const allSamples: Sample[] = []
  let cursor: string | null = null
  let pages = 0
  const maxPages = 50 // Safety limit

  const url = `${ACE_API_BASE}/sites/${SITE}/timeseries/paginated`

  while (pages < maxPages) {
    const params = new URLSearchParams({
      start_time: startISO,
      end_time: endISO,
      raw_data: 'true',
      page_size: PAGE_SIZE.toString()
    })

    if (cursor) {
      params.set('cursor', cursor)
    }

    const response = await fetch(`${url}?${params}`, {
      headers: {
        'Authorization': `Bearer ${aceApiKey}`,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`ACE API ${response.status}: ${text.substring(0, 200)}`)
    }

    const data = await response.json()
    const rows = data.point_samples || []

    // Empty page check
    if (rows.length === 0) {
      cursor = data.next_cursor || null
      if (!cursor) break
      pages++
      continue
    }

    // Process rows
    for (const row of rows) {
      const name = row.name || row.point || row.point_name
      const time = row.time || row.timestamp || row.ts
      const value = row.value

      if (!name) continue

      // Parse timestamp
      let timestampMs: number
      try {
        if (typeof time === 'number') {
          timestampMs = time
        } else {
          timestampMs = new Date(time).getTime()
        }
      } catch {
        continue
      }

      // Parse value
      let numValue: number
      try {
        numValue = parseFloat(value)
        if (!isFinite(numValue)) continue
      } catch {
        continue
      }

      allSamples.push({
        point_name: name,
        timestamp: timestampMs,
        value: numValue
      })
    }

    cursor = data.next_cursor || null
    pages++

    if (!cursor) break
  }

  return allSamples
}

async function upsertTimeseries(
  supabase: any,
  samples: Sample[],
  pointCache: PointCache
): Promise<number> {
  if (samples.length === 0) return 0

  // Get unique point names
  const uniqueNames = Array.from(new Set(samples.map(s => s.point_name)))

  // Upsert any new points
  const newNames = uniqueNames.filter(name => !pointCache[name])

  if (newNames.length > 0) {
    console.log(`Upserting ${newNames.length} new points`)

    const pointRows = newNames.map(name => ({
      site_name: SITE,
      name,
      source: 'ace_api'
    }))

    // Insert new points (ignore conflicts)
    try {
      await supabase.from('points').insert(pointRows)
    } catch (error) {
      // Conflicts are OK, we'll fetch IDs next
    }

    // Fetch IDs for new points
    const { data: newPoints } = await supabase
      .from('points')
      .select('id, name')
      .eq('site_name', SITE)
      .in('name', newNames)

    for (const point of newPoints || []) {
      pointCache[point.name] = point.id
    }
  }

  // Prepare timeseries rows
  const rows: any[] = []
  for (const sample of samples) {
    const pointId = pointCache[sample.point_name]
    if (!pointId) continue

    const ts = new Date(sample.timestamp).toISOString()

    rows.push({
      point_id: pointId,
      ts,
      value: sample.value
    })
  }

  // Deduplicate by (point_id, ts)
  const deduped = new Map()
  for (const row of rows) {
    const key = `${row.point_id}:${row.ts}`
    deduped.set(key, row)
  }

  const uniqueRows = Array.from(deduped.values())

  console.log(`Upserting ${uniqueRows.length} unique samples`)

  // Two-tier upsert: Try INSERT first, fall back to UPSERT
  let inserted = 0
  const chunkSize = 50

  for (let i = 0; i < uniqueRows.length; i += chunkSize) {
    const chunk = uniqueRows.slice(i, i + chunkSize)

    try {
      // Try fast INSERT
      await supabase.from('timeseries').insert(chunk)
      inserted += chunk.length
    } catch (error) {
      // Conflict - use UPSERT for this chunk
      const miniChunkSize = 10
      for (let j = 0; j < chunk.length; j += miniChunkSize) {
        const miniChunk = chunk.slice(j, j + miniChunkSize)
        try {
          await supabase
            .from('timeseries')
            .upsert(miniChunk, { onConflict: 'point_id,ts' })
          inserted += miniChunk.length
        } catch (error) {
          // Skip if still failing
          console.error(`Failed to upsert mini chunk:`, error)
        }
      }
    }
  }

  return inserted
}
