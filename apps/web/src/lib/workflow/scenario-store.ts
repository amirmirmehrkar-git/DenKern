/**
 * Scenario result store — DenkKern web app
 *
 * In-memory singleton. Stores the output of runScenarioEngine() per caseId.
 * Populated by the dispatcher on `context_confirmed`.
 *
 * MVP: in-memory only — survives the process lifetime, not a restart.
 * Production: replace with database read/write through the DataAdapter.
 */

import type { ScenarioResult } from '@denkkern/types';

const _store = new Map<string, ScenarioResult>();

export const scenarioStore = {
  set(caseId: string, result: ScenarioResult): void {
    _store.set(caseId, result);
  },

  get(caseId: string): ScenarioResult | undefined {
    return _store.get(caseId);
  },

  has(caseId: string): boolean {
    return _store.has(caseId);
  },

  /** Wipe a single entry. Test helper only. */
  delete(caseId: string): void {
    _store.delete(caseId);
  },
};
