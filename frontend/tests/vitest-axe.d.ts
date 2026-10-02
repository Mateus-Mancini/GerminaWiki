import 'vitest';
import type { AxeMatchers } from 'vitest-axe/matchers';

// vitest-axe 0.1 types its matchers for older Vitest; register them for Vitest 3.
declare module 'vitest' {
  interface Assertion<T = any> extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
