import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ||
  'postgresql://constructor:constructor@127.0.0.1:55432/constructor_test?schema=public';

const env = {
  ...process.env,
  NODE_ENV: 'test',
  TEST_DATABASE_URL: testDatabaseUrl,
  DATABASE_URL: testDatabaseUrl,
  TEST_SERVER_PORT: process.env.TEST_SERVER_PORT || '3011',
};

const testFiles = readdirSync(join(process.cwd(), 'tests', 'api'))
  .filter((name) => name.endsWith('.test.mjs'))
  .sort()
  .map((name) => join('tests', 'api', name));

const child = spawn(
  process.execPath,
  ['--test', '--test-concurrency=1', ...testFiles],
  {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
  }
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
