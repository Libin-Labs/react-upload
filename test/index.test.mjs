import { beforeEach, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { act, createElement } from 'react';
import { setup } from './helpers.mjs';
import { validateFiles, validateUploadUrl, useUpload } from '../dist/index.js';
let ui;
beforeEach(async () => (ui = await setup()));
afterEach(async () => ui.cleanup());
test('file caps and unsafe/cross-origin URLs fail closed', () => {
  const file = new window.File(['hello'], 'a.txt', { type: 'text/plain' });
  assert.throws(() => validateFiles([file], { maxFileSize: 2 }), /size/);
  assert.throws(() => validateFiles([file], { accept: '.png' }), /type/);
  assert.throws(() => validateUploadUrl('javascript:alert(1)', 'https://example.test/'));
  assert.throws(() => validateUploadUrl('https://elsewhere.test/', 'https://example.test/'));
});
test('upload workers cap concurrency and expose completion/progress', async () => {
  let api,
    active = 0,
    maximum = 0;
  function App() {
    api = useUpload({
      concurrency: 2,
      upload: async (file, { onProgress }) => {
        active++;
        maximum = Math.max(maximum, active);
        onProgress(50);
        await Promise.resolve();
        active--;
      },
    });
    return null;
  }
  await ui.render(createElement(App));
  await act(() =>
    api.addFiles([
      new window.File(['a'], 'a.txt'),
      new window.File(['b'], 'b.txt'),
      new window.File(['c'], 'c.txt'),
    ]),
  );
  await act(async () => api.start());
  assert.ok(maximum <= 2);
  assert.equal(api.entries.filter((entry) => entry.status === 'success').length, 3);
  assert.equal(api.entries[0].progress, 100);
});
