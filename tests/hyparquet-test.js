// Test hyparquet output format
import { parquetRead } from 'hyparquet';
import { writeParquet, Table } from 'parquet-wasm';
import * as arrow from 'apache-arrow';

// Create test Parquet file
const data = {
  timestamp: [BigInt(1704067200000)],
  point_name: ['temp1'],
  value: [72.5],
  site_name: ['building_a']
};

const arrowTable = arrow.tableFromArrays(data);
const ipcBytes = arrow.tableToIPC(arrowTable, 'stream');
const wasmTable = Table.fromIPCStream(ipcBytes);
const parquetBytes = writeParquet(wasmTable);

console.log('Parquet file created:', parquetBytes.length, 'bytes\n');

// Read with hyparquet
console.log('Reading with hyparquet...');
await parquetRead({
  file: parquetBytes.buffer,
  onComplete: (data, metadata) => {
    console.log('\n=== DATA ===');
    console.log('Type:', typeof data);
    console.log('IsArray:', Array.isArray(data));
    console.log('Length:', data?.length);
    console.log('First row fields:', Object.keys(data[0]));
    console.log('[0]:', typeof data[0][0], data[0][0]);
    console.log('[1]:', typeof data[0][1], data[0][1]);
    console.log('[2]:', typeof data[0][2], data[0][2]);
    console.log('[3]:', typeof data[0][3], data[0][3]);

    console.log('\n=== METADATA ===');
    if (metadata) {
      console.log('Has metadata:', typeof metadata);
      console.log('Keys:', Object.keys(metadata));
    } else {
      console.log('No metadata provided');
    }
  }
});
