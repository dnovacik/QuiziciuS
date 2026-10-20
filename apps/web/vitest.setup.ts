import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// @testing-library/react only self-registers its afterEach(cleanup) when it detects
// a global `afterEach` (i.e. Vitest's `test.globals: true`), which this project does
// not enable. Without this, renderHook/render results from one test are never
// unmounted before the next test runs, leaking document-level listeners (e.g.
// visibilitychange) and DOM nodes across tests in the same file.
afterEach(() => {
  cleanup();
});
