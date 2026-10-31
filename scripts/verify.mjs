import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const run = (args) => execFileSync(process.execPath, args, { stdio: 'inherit' });
run([
  require.resolve('prettier/bin/prettier.cjs'),
  '--check',
  'src/**/*.{ts,tsx}',
  'test/**/*.{mjs,ts,tsx}',
  'scripts/**/*.mjs',
  'README.md',
  'SECURITY.md',
  'package.json',
  'tsconfig.json',
  '.prettierrc.json',
  '.github/workflows/*.yml',
]);
run([require.resolve('typescript/bin/tsc'), '--noEmit']);
run(['scripts/build.mjs']);
const tests = (await readdir('test'))
  .filter((name) => name.endsWith('.test.mjs'))
  .map((name) => `test/${name}`);
assert.ok(tests.length, 'Every package must have tests.');
run(['--test', ...tests]);
const readme = await readFile('README.md', 'utf8');
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
for (const section of [
  'Installation',
  'Quick Start',
  'API',
  'Benefits',
  'Customization',
  'Security And Limits',
  'Support',
])
  assert.ok(readme.includes(`## ${section}`), `Missing README ${section}`);
assert.ok(readme.includes(`npm install ${pkg.name}`));
assert.equal(pkg.license, 'MIT', 'Use the approved package license.');
assert.ok(pkg.files?.includes('LICENSE'), 'LICENSE must be included in the npm package.');
run(['scripts/package.mjs']);
