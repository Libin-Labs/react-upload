import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile, copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const root = resolve('.');
await rm('dist', { recursive: true, force: true });
await mkdir('dist/cjs', { recursive: true });
execFileSync(
  process.execPath,
  [require.resolve('typescript/bin/tsc'), '--project', 'tsconfig.json'],
  { stdio: 'inherit' },
);
await Promise.all(
  [
    ['esm', 'dist/index.js'],
    ['cjs', 'dist/cjs/index.js'],
  ].map(([format, outfile]) =>
    build({
      entryPoints: ['src/index.tsx'],
      outfile,
      bundle: true,
      minify: true,
      sourcemap: true,
      format,
      platform: 'neutral',
      target: 'es2022',
      external: ['react', 'react/*'],
      banner: { js: '"use client";' },
    }),
  ),
);
await writeFile('dist/cjs/package.json', '{"type":"commonjs"}\n');
await copyFile('dist/types/index.d.ts', 'dist/index.d.ts');
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0);
assert.equal(pkg.exports['.'].require, pkg.main);
assert.equal(pkg.exports['.'].import, pkg.module);
const esm = await import(pathToFileURL(resolve(root, pkg.module)));
const cjs = require(resolve(root, pkg.main));
for (const name of Object.keys(esm)) assert.ok(name in cjs, `Missing export ${name}`);
await build({
  entryPoints: [pkg.browser],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'esm',
  external: ['react', 'react/*'],
  logLevel: 'silent',
});
const size = gzipSync(await readFile(pkg.module)).length;
assert.ok(size <= 16384, 'Bundle exceeds 16 KiB gzip budget.');
console.log(`${pkg.name}: ${size} bytes gzip; declarations and ESM/CJS/browser exports verified.`);
