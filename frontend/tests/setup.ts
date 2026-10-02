import { cleanup } from '@testing-library/react';
import { afterEach, expect } from 'vitest';
import * as axeMatchers from 'vitest-axe/matchers';
import 'vitest-axe/extend-expect';

expect.extend(axeMatchers);

// Vitest globals are off, so Testing Library can't register its automatic cleanup.
afterEach(cleanup);

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
