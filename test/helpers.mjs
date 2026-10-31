import { act } from 'react';
import { JSDOM } from 'jsdom';
export async function setup() {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://example.test/' });
  const originals = new Map();
  const replace = (key, value) => {
    if (!originals.has(key)) originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  };
  replace('window', dom.window);
  replace('document', dom.window.document);
  replace('IS_REACT_ACT_ENVIRONMENT', true);
  const { createRoot } = await import('react-dom/client');
  const container = document.getElementById('root');
  const root = createRoot(container);
  return {
    dom,
    container,
    replace,
    render: (node) => act(() => root.render(node)),
    async cleanup() {
      replace('window', dom.window);
      replace('document', dom.window.document);
      await act(() => root.unmount());
      dom.window.close();
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    },
  };
}
export const click = (node, options) =>
  act(async () => {
    node.dispatchEvent(
      new window.MouseEvent('click', { bubbles: true, cancelable: true, ...options }),
    );
    await Promise.resolve();
  });
export const key = (node, value, options) =>
  act(async () => {
    node.dispatchEvent(
      new window.KeyboardEvent('keydown', {
        key: value,
        bubbles: true,
        cancelable: true,
        ...options,
      }),
    );
    await Promise.resolve();
  });
export const input = (node, value) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(
      node,
      value,
    );
    node.dispatchEvent(new window.Event('input', { bubbles: true }));
    await Promise.resolve();
  });
