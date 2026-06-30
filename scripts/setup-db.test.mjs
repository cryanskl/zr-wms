import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const setupPath = new URL('./setup-db.ts', import.meta.url);

test('setup-db runs warehouse visualization after authoritative and foundation SQL files', async () => {
  const setup = await readFile(setupPath, 'utf8');
  const orderedFiles = [
    'docs/wms_schema_v1.7.sql',
    'docs/wms_procedures_v1.7.sql',
    'docs/wms_logic_v1.7.sql',
    'scripts/sql/app-auth.sql',
    'scripts/sql/seed-foundation.sql',
    'scripts/sql/warehouse-visualization.sql',
  ];

  let previousIndex = -1;
  for (const file of orderedFiles) {
    const index = setup.indexOf(file);
    assert.notEqual(index, -1, `${file} should be included in setup-db order`);
    assert.ok(index > previousIndex, `${file} should run after previous setup file`);
    previousIndex = index;
  }
});
