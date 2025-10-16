// Quick test to understand parquet-wasm API
import { Table, writeParquet, WriterPropertiesBuilder } from 'parquet-wasm';
import * as arrow from 'apache-arrow';

// Create simple Arrow table
const data = {
  timestamp: [BigInt(1704067200000), BigInt(1704067500000)],
  point_name: ['temp1', 'temp2'],
  value: [72.5, 68.3],
  site_name: ['building_a', 'building_a']
};

const arrowTable = arrow.tableFromArrays(data);
console.log('Arrow Table created:', arrowTable.numRows, 'rows');

// Serialize Arrow table to IPC Stream format
const bytes = arrow.tableToIPC(arrowTable, 'stream');
console.log('Arrow IPC bytes:', bytes.length);

// Create parquet-wasm Table from Arrow IPC bytes
try {
  const wasmTable = Table.fromIPCStream(bytes);
  console.log('✅ WASM Table created');

  // Test 1: No options
  console.log('\nTest 1: No options');
  const bytes1 = writeParquet(wasmTable);
  console.log('✅ SUCCESS (no options):', bytes1.length, 'bytes');

  // Test 2: With WriterPropertiesBuilder
  console.log('\nTest 2: With WriterPropertiesBuilder');
  const writerProps = new WriterPropertiesBuilder()
    .setCompression('snappy')
    .build();
  const bytes2 = writeParquet(wasmTable, writerProps);
  console.log('✅ SUCCESS (with props):', bytes2.length, 'bytes');

  // Verify magic number
  const magic = String.fromCharCode(bytes2[0], bytes2[1], bytes2[2], bytes2[3]);
  console.log('Magic number:', magic);

} catch (error) {
  console.log('❌ FAILED:', error.message);
  console.log('Stack:', error.stack);
}
