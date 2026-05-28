/**
 * Adapter factory — DenkKern web app
 *
 * Returns the active DataAdapter for the current environment.
 * All server-side code should obtain its adapter via getAdapter().
 * No if(mock) branches should appear in any file that imports from here.
 *
 * MOCK_ROOT is injected by next.config.js at build time so the mock adapter
 * can locate seed files at the monorepo root regardless of Next.js's cwd.
 */

import { MockDataAdapter } from '@denkkern/mock';
import type { DataAdapter } from '@denkkern/mock';

// ---------------------------------------------------------------------------
// Singleton instance per Node.js module lifetime
// (Next.js App Router: one module lifetime per worker process)
// ---------------------------------------------------------------------------

let _adapter: DataAdapter | null = null;

export function getAdapter(): DataAdapter {
  if (_adapter !== null) return _adapter;

  const mockRoot = process.env['MOCK_ROOT'];
  if (mockRoot === undefined || mockRoot === '') {
    throw new Error(
      'MOCK_ROOT environment variable is not set. ' +
      'Check next.config.js — it must set env.MOCK_ROOT to the monorepo root.'
    );
  }

  _adapter = new MockDataAdapter(mockRoot);
  return _adapter;
}

// Exposed for tests that need to inject a fresh adapter.
export function _resetAdapterForTests(adapter?: DataAdapter): void {
  _adapter = adapter ?? null;
}
