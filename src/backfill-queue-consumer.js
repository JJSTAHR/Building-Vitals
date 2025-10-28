/**
 * Backfill Queue Consumer
 *
 * Consumes messages: { site, start_iso, end_iso }
 * Fetches ACE raw timeseries for that window and inserts into Supabase (idempotent).
 */

import * as Supa from './lib/supabase-store.js';

async function fetchWithTimeout(url, init = {}, timeoutMs = 55000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort('timeout'), timeoutMs);
  try {
    const resp = await fetch(url, { ...init, signal: controller.signal });
    return resp;
  } finally { clearTimeout(t); }
}

function getAceToken(env) {
  return env.ACE_API_KEY || '';
}

async function fetchAcePaginated(env, site, startISO, endISO, pointNames = null) {
  const base = env.ACE_API_BASE || 'https://flightdeck.aceiot.cloud/api';
  const out = [];
  let cursor = null;
  let pages = 0;
  const started = Date.now();
  do {
    const u = new URL(`${base}/sites/${site}/timeseries/paginated`);
    u.searchParams.set('start_time', startISO);
    u.searchParams.set('end_time', endISO);
    u.searchParams.set('raw_data', 'true');
    u.searchParams.set('page_size', '10000');
    if (cursor) u.searchParams.set('cursor', cursor);
    if (Array.isArray(pointNames) && pointNames.length > 0) {
      u.searchParams.set('point_names', pointNames.join(','));
    }
    const timeLeft = Math.max(1000, 55000 - (Date.now() - started));
    const resp = await fetchWithTimeout(u.toString(), { headers: { 'authorization': `Bearer ${getAceToken(env)}`, 'Accept': 'application/json' } }, timeLeft);
    if (!resp.ok) throw new Error(`ACE ${resp.status}`);
    const data = await resp.json().catch(()=>({}));
    const pts = Array.isArray(data.point_samples) ? data.point_samples : [];
    for (const s of pts) {
      const ts = Date.parse(s.time);
      const val = Number(s.value);
      if (Number.isFinite(ts) && Number.isFinite(val) && s.name) {
        out.push({ point_name: s.name, timestamp: ts, value: val });
      }
    }
    cursor = data.next_cursor || null;
    pages++;
    if (pages > 200) break;
  } while (cursor);
  return out;
}


async function acquire(env, key, ttlSec) {
  try {
    const now = Date.now();
    const ex = await env.ETL_STATE.get(key, { type: 'json' });
    if (ex && ex.expiresAt > now) return false;
    await env.ETL_STATE.put(key, JSON.stringify({ expiresAt: now + ttlSec * 1000 }), { expirationTtl: ttlSec });
    return true;
  } catch { return true; }
}

async function done(env, key) {
  try { await env.ETL_STATE.put(key, '1', { expirationTtl: 86400 * 30 }); } catch {}
}

export default {
  async queue(batch, env, ctx) {
    for (const msg of batch.messages) {
      try {
        const payload = typeof msg.body === 'string' ? JSON.parse(msg.body) : msg.body;
        const site = payload.site;
        const startISO = payload.start_iso || payload.startISO || payload.start;
        const endISO = payload.end_iso || payload.endISO || payload.end;
        const pointNames = Array.isArray(payload.point_names) ? payload.point_names : null;
        if (!site || !startISO || !endISO) { msg.ack(); continue; }

        // Dedupe key per exact window
        const key = `q:done:${site}:${startISO}:${endISO}`;
        const doneFlag = await env.ETL_STATE.get(key);
        if (doneFlag) { msg.ack(); continue; }

        // Per-site short lock to avoid burst
        const lockOk = await acquire(env, `q:lock:${site}`, 10);
        if (!lockOk) { msg.retry(); continue; }

        // Strict requirement: use ONLY the paginated endpoint (raw_data=true),
        // optionally narrowed by point_names when provided.
        const samples = await fetchAcePaginated(env, site, startISO, endISO, pointNames);
        if (samples && samples.length > 0) {
          await Supa.insertRaw(env, site, samples);
        }
        await done(env, key);
        msg.ack();
      } catch (e) {
        // Retry with backoff
        msg.retry({ delaySeconds: 10 });
      }
    }
  }
};
