import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const root = resolve('.');
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const npm = process.env.npm_execpath;
assert.ok(npm, 'Run with npm run verify or npm run test:package.');
const temp = await mkdtemp(join(tmpdir(), 'lp-package-'));
const run = (args) =>
  execFileSync(process.execPath, [npm, ...args, '--dry-run=false'], { encoding: 'utf8' });
try {
  const [packed] = JSON.parse(
    run(['pack', root, '--ignore-scripts', '--json', '--pack-destination', temp]),
  );
  const files = new Set(packed.files.map((file) => file.path));
  for (const name of [
    'dist/index.js',
    'dist/cjs/index.js',
    'dist/cjs/package.json',
    'dist/index.d.ts',
    'README.md',
    'SECURITY.md',
    'LICENSE',
  ])
    assert.ok(files.has(name), name);
  run([
    'install',
    '--prefix',
    temp,
    '--ignore-scripts',
    '--offline',
    '--no-audit',
    '--no-fund',
    join(temp, packed.filename),
    join(root, 'node_modules/react'),
    join(root, 'node_modules/react-dom'),
  ]);
  const require = createRequire(join(temp, 'consumer.cjs'));
  const cjs = require(pkg.name);
  assert.ok(Object.keys(cjs).length);
  assert.equal(cjs, require(join(temp, 'node_modules', pkg.name)));
  const code = `import assert from 'node:assert/strict'; import * as api from ${JSON.stringify(pkg.name)}; assert.ok(Object.keys(api).length);`;
  execFileSync(process.execPath, ['--input-type=module', '-e', code], { cwd: temp, stdio: 'pipe' });
  console.log(`${pkg.name}: isolated packed ESM/CJS consumers passed.`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
