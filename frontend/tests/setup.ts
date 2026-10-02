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
