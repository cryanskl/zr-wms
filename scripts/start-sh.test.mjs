import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { test } from 'node:test';

const scriptPath = new URL('../start.sh', import.meta.url);

test('start.sh is executable and covers the local startup workflow', async () => {
  await access(scriptPath, constants.X_OK);

  const script = await readFile(scriptPath, 'utf8');

  assert.match(script, /ensure_dependencies\(\)/);
  assert.match(script, /load_environment\(\)/);
  assert.match(script, /restart_port\(\)/);
  assert.match(script, /start_service\(\)/);
  assert.match(script, /DATABASE_URL/);
  assert.match(script, /mkdir -p "\$LOG_DIR"/);
  assert.match(script, /lsof -ti tcp:/);
  assert.match(script, /kill /);
  assert.match(script, /pnpm install/);
  assert.match(script, /pnpm --filter @zr-wms\/api dev/);
  assert.match(script, /pnpm --filter @zr-wms\/web dev/);
  assert.match(script, /open "\$APP_URL"/);
});

test('start.sh braces variables before non-ascii log text', async () => {
  const script = await readFile(scriptPath, 'utf8');

  assert.doesNotMatch(script, /\$name[^\w\s$"']/);
  assert.match(script, /启动 \$\{name\}/);
});
