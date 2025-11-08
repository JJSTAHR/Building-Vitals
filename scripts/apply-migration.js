#!/usr/bin/env node
/**
 * Apply migration via Supabase service role key
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jywxcqcjsvlyehuvsoar.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5d3hjcWNqc3ZseWVodXZzb2FyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTU3NTQ5NywiZXhwIjoyMDc3MTUxNDk3fQ.gJ7JWmJr9tZHXYPqLZqO5Ev76Aql0LWF5hhC4M9GQ0Q';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function applyMigration() {
  console.log('📝 Reading migration file...');
  const sql = readFileSync('supabase/migrations/20251108000000_bulk_upsert_timeseries.sql', 'utf8');

  console.log('🚀 Applying migration...');
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }

  console.log('✅ Migration applied successfully!');
  console.log('🎯 Testing bulk_upsert_timeseries function...');

  // Test with empty array
  const { data: testData, error: testError } = await supabase.rpc('bulk_upsert_timeseries', {
    site_id: 'test',
    raw_data: []
  });

  if (testError) {
    console.error('❌ Function test failed:', testError);
    process.exit(1);
  }

  console.log('✅ Function is working!');
}

applyMigration().catch(console.error);
