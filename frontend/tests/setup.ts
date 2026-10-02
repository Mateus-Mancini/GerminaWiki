import { cleanup, configure } from '@testing-library/react';
import { afterEach, expect } from 'vitest';
import * as axeMatchers from 'vitest-axe/matchers';
import 'vitest-axe/extend-expect';

expect.extend(axeMatchers);

// Vitest globals are off, so Testing Library can't register its automatic cleanup.
afterEach(cleanup);

// The editor marks itself changed after a short debounce plus an encode of the page; on a busy machine
// that passes Testing Library's 1 s default for findBy*/waitFor, so allow 5 s.
configure({ asyncUtilTimeout: 5_000 });

// DOM polyfills, for the jsdom environment only (a few tests run in node).
if (typeof Document !== 'undefined') {
  // jsdom has no layout. BlockNote's side menu hit-tests the pointer position on mouse moves.
  Document.prototype.elementFromPoint ??= () => null;
  Document.prototype.elementsFromPoint ??= () => [];
  // BlockNote's suggestion menu stores the trigger's position with DOMRect.toJSON(), which jsdom lacks.
  const boundingRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const rect = boundingRect.call(this);
    if (typeof rect.toJSON !== 'function') {
      const { x, y, width, height, top, right, bottom, left } = rect;
      Object.defineProperty(rect, 'toJSON', { value: () => ({ x, y, width, height, top, right, bottom, left }) });
    }
    return rect;
  };
}
