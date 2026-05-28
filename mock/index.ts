/**
 * mock/ — DenkKern dev data layer
 *
 * Exports the MockDataAdapter and the DataAdapter interface.
 * The real adapter (apps/web/src/adapters/real-adapter.ts) will implement
 * the same DataAdapter interface — zero if(mock) branches in application code.
 *
 * Usage in Next.js API routes:
 *   import { MockDataAdapter } from '../../mock/index.js';
 *   const adapter = new MockDataAdapter();
 */

export type { DataAdapter } from './adapters/data-adapter.js';
export { MockDataAdapter } from './adapters/mock-adapter.js';
