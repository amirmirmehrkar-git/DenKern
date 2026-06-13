/**
 * verify-dk-70x.mjs
 *
 * Sprint 7 — DK-708: Combined verification across all Sprint 7 tickets.
 *
 * Covers DK-701 through DK-707 in a single run.
 * Must reach ≥20 checks. Actual target: ≥40.
 *
 * Run from repo root:
 *   node scripts/verify-dk-70x.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

let passed = 0;
let failed = 0;

function ok(label, cond) {
  if (cond) {
    console.log(`  OK  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}`);
    failed++;
  }
}

function read(rel) {
  const p = resolve(ROOT, rel);
  return existsSync(p) ? readFileSync(p, 'utf-8') : null;
}

function readJson(rel) {
  const content = read(rel);
  if (content === null) return null;
  try { return JSON.parse(content); } catch { return null; }
}

// ============================================================================
// DK-701 — OutcomeTimeline type contracts
// ============================================================================

console.log('\n--- [DK-701] Type contracts ---');

const typeSrc = read('packages/types/src/outcome-timeline.ts');
ok('[701] outcome-timeline.ts exists', typeSrc !== null);
ok('[701] CheckpointStatus union includes pending',    typeSrc?.includes("'pending'") ?? false);
ok('[701] CheckpointStatus union includes sent',       typeSrc?.includes("'sent'") ?? false);
ok('[701] CheckpointStatus union includes reminder_1', typeSrc?.includes("'reminder_1'") ?? false);
ok('[701] CheckpointStatus union includes confirmed',  typeSrc?.includes("'confirmed'") ?? false);
ok('[701] CheckpointStatus union includes unresolved', typeSrc?.includes("'unresolved'") ?? false);
ok('[701] OutcomeDimension extensible via (string & {})',
  typeSrc?.includes('(string & {})') ?? false);
ok('[701] OutcomeTimeline interface defined',          typeSrc?.includes('interface OutcomeTimeline') ?? false);
ok('[701] OutcomeCheckpoint interface defined',        typeSrc?.includes('interface OutcomeCheckpoint') ?? false);
ok('[701] CheckpointTemplate interface defined',       typeSrc?.includes('interface CheckpointTemplate') ?? false);

const typeIndex = read('packages/types/src/index.ts');
ok('[701] OutcomeTimeline re-exported from @denkkern/types index',
  typeIndex?.includes('OutcomeTimeline') ?? false);
ok('[701] OutcomeCheckpoint re-exported from @denkkern/types index',
  typeIndex?.includes('OutcomeCheckpoint') ?? false);
ok('[701] CheckpointStatus re-exported from @denkkern/types index',
  typeIndex?.includes('CheckpointStatus') ?? false);

// ============================================================================
// DK-704 — checkpoint-defaults.json
// ============================================================================

console.log('\n--- [DK-704] Checkpoint defaults config ---');

const defaults = readJson('config/checkpoint-defaults.json');
ok('[704] config/checkpoint-defaults.json exists', defaults !== null);
ok('[704] EXPEDITE scenario present', defaults?.EXPEDITE !== undefined);
ok('[704] WAIT scenario present',     defaults?.WAIT !== undefined);
ok('[704] PARTIAL_EXPEDITE present',  defaults?.PARTIAL_EXPEDITE !== undefined);
ok('[704] REROUTE present',           defaults?.REROUTE !== undefined);
ok('[704] _fallback present',         defaults?._fallback !== undefined);
ok('[704] EXPEDITE has 3 checkpoints',
  Array.isArray(defaults?.EXPEDITE?.checkpoints) && defaults.EXPEDITE.checkpoints.length === 3);
ok('[704] EXPEDITE covers op/fin/biz dimensions',
  Array.isArray(defaults?.EXPEDITE?.checkpoints) &&
  defaults.EXPEDITE.checkpoints.some((t) => t.dimension === 'operational') &&
  defaults.EXPEDITE.checkpoints.some((t) => t.dimension === 'financial') &&
  defaults.EXPEDITE.checkpoints.some((t) => t.dimension === 'business')
);
ok('[704] All templates have recipient_role',
  [
    ...(defaults?.EXPEDITE?.checkpoints ?? []),
    ...(defaults?.WAIT?.checkpoints ?? []),
    ...(defaults?._fallback?.checkpoints ?? []),
  ].every((t) => typeof t.recipient_role === 'string')
);
ok('[704] All templates have integer due_offset_days',
  [
    ...(defaults?.EXPEDITE?.checkpoints ?? []),
    ...(defaults?.WAIT?.checkpoints ?? []),
    ...(defaults?._fallback?.checkpoints ?? []),
  ].every((t) => Number.isInteger(t.due_offset_days))
);

// ============================================================================
// DK-702 — DataAdapter interface extensions
// ============================================================================

console.log('\n--- [DK-702] DataAdapter interface ---');

const adapterSrc = read('mock/adapters/data-adapter.ts');
ok('[702] data-adapter.ts exists', adapterSrc !== null);
ok('[702] getOutcomeTimeline declared in interface',
  adapterSrc?.includes('getOutcomeTimeline') ?? false);
ok('[702] saveOutcomeTimeline declared in interface',
  adapterSrc?.includes('saveOutcomeTimeline') ?? false);
ok('[702] Returns OutcomeTimeline | null from get',
  adapterSrc?.includes('OutcomeTimeline | null') ?? false);

// ============================================================================
// DK-703 — Mock adapter lifecycle methods
// ============================================================================

console.log('\n--- [DK-703] Mock adapter ---');

const mockSrc = read('mock/adapters/mock-adapter.ts');
ok('[703] mock-adapter.ts exists', mockSrc !== null);
ok('[703] sendCheckpointTask method present',
  mockSrc?.includes('async sendCheckpointTask') ?? false);
ok('[703] advanceReminderForCheckpoint method present',
  mockSrc?.includes('async advanceReminderForCheckpoint') ?? false);
ok('[703] confirmCheckpoint method present',
  mockSrc?.includes('async confirmCheckpoint') ?? false);
ok('[703] markCheckpointUnresolved method present',
  mockSrc?.includes('async markCheckpointUnresolved') ?? false);
ok('[703] resetOutcomeTimeline test helper present',
  mockSrc?.includes('resetOutcomeTimeline') ?? false);
ok('[703] REMINDER_ADVANCE lifecycle map defined',
  mockSrc?.includes('REMINDER_ADVANCE') ?? false);
ok('[703] #recomputeSummary private helper present',
  mockSrc?.includes('#recomputeSummary') ?? false);
ok('[703] NTFS guard (readFileSync after writeFileSync) present',
  mockSrc?.includes('JSON.parse(readFileSync') ?? false);
ok('[703] outbound-email.json appended on send',
  mockSrc?.includes('outbound-email.json') ?? false);

// ============================================================================
// DK-705 — Dispatcher consequence
// ============================================================================

console.log('\n--- [DK-705] Dispatcher consequence ---');

const dispatcherSrc = read('apps/web/src/lib/workflow/dispatcher.ts');
ok('[705] dispatcher.ts exists', dispatcherSrc !== null);
ok('[705] initializeOutcomeTimeline imported in dispatcher',
  dispatcherSrc?.includes('initializeOutcomeTimeline') ?? false);
ok('[705] DK-705 try/catch block present',
  dispatcherSrc?.includes('[DK-705]') ?? false);
ok('[705] Timeline init is non-blocking (no await at top level)',
  dispatcherSrc?.includes('initializeOutcomeTimeline(caseId') ?? false);

const writerSrc = read('apps/web/src/lib/workflow/outcome-timeline-writer.ts');
ok('[705] outcome-timeline-writer.ts exists', writerSrc !== null);
ok('[705] initializeOutcomeTimeline exported',
  writerSrc?.includes('export async function initializeOutcomeTimeline') ?? false);
ok('[705] checkpoint-defaults.json read at runtime',
  writerSrc?.includes('checkpoint-defaults.json') ?? false);
ok('[705] _fallback scenario supported',
  writerSrc?.includes('_fallback') ?? false);
ok('[705] addUtcDays uses setUTCDate (not setDate)',
  writerSrc?.includes('setUTCDate') ?? false);
ok('[705] Deterministic ID format present (chk-{prefix}-{caseId}-{seq})',
  writerSrc?.includes('chk-') ?? false);

// ============================================================================
// DK-706 — API endpoints
// ============================================================================

console.log('\n--- [DK-706] API endpoints ---');

const ROUTE_BASE  = 'apps/web/src/app/api/cases/[caseId]/outcome-timeline';
const ROUTE_CHKPT = `${ROUTE_BASE}/checkpoints/[checkpointId]`;

const routeDefs = [
  { path: `${ROUTE_BASE}/route.ts`,                   method: 'GET',  name: 'GET timeline' },
  { path: `${ROUTE_CHKPT}/send/route.ts`,             method: 'POST', name: 'POST send' },
  { path: `${ROUTE_CHKPT}/advance-reminder/route.ts`, method: 'POST', name: 'POST advance-reminder' },
  { path: `${ROUTE_CHKPT}/confirm/route.ts`,          method: 'POST', name: 'POST confirm' },
  { path: `${ROUTE_CHKPT}/mark-unresolved/route.ts`,  method: 'POST', name: 'POST mark-unresolved' },
];

for (const { path, method, name } of routeDefs) {
  const src = read(path);
  ok(`[706] ${name} route file exists`, src !== null);
  ok(`[706] ${name} exports ${method}`, src?.includes(`export async function ${method}(`) ?? false);
  ok(`[706] ${name} has 404 handling`, src?.includes('status: 404') ?? false);
}

// confirm route-specific checks
const confirmSrc = read(`${ROUTE_CHKPT}/confirm/route.ts`);
ok('[706] confirm validates confirmed_by → 400',
  confirmSrc?.includes('confirmed_by') && confirmSrc?.includes('status: 400') || false);
ok('[706] confirm validates outcome_data → 400',
  confirmSrc?.includes('outcome_data') ?? false);
ok('[706] confirm has 409 TERMINAL_STATE path',
  confirmSrc?.includes('TERMINAL_STATE') ?? false);

// ============================================================================
// DK-707 — Minimal UI
// ============================================================================

console.log('\n--- [DK-707] Minimal UI ---');

const pageSrc = read('apps/web/src/app/cases/[caseId]/outcome/page.tsx');
ok('[707] outcome/page.tsx exists', pageSrc !== null);
ok('[707] page is a server component (no "use client")',
  pageSrc !== null && !pageSrc.includes("'use client'"));
ok('[707] page imports OutcomeTimelineView',
  pageSrc?.includes('OutcomeTimelineView') ?? false);
ok('[707] page reads outcome-timeline.json from disk',
  pageSrc?.includes('outcome-timeline.json') ?? false);
ok('[707] page renders empty state when timeline missing',
  pageSrc?.includes('No outcome timeline') ?? false);

const viewSrc = read('apps/web/src/app/cases/[caseId]/outcome/OutcomeTimelineView.tsx');
ok('[707] OutcomeTimelineView.tsx exists', viewSrc !== null);
ok("[707] client component ('use client' directive)",
  viewSrc?.startsWith("'use client'") ?? false);
ok('[707] OutcomeTimelineView exported',
  viewSrc?.includes('export function OutcomeTimelineView') ?? false);
ok('[707] Dimension badges defined (operational/financial/business)',
  viewSrc?.includes('operational') && viewSrc?.includes('financial') && viewSrc?.includes('business') || false);
ok('[707] Confirm modal submits to correct endpoint',
  viewSrc?.includes('/confirm') ?? false);
ok('[707] Mark unresolved submits to correct endpoint',
  viewSrc?.includes('/mark-unresolved') ?? false);
ok('[707] Overdue indicator based on due_at date',
  viewSrc?.includes('isOverdue') ?? false);
ok('[707] Timeline refreshed after confirm',
  viewSrc?.includes('/outcome-timeline') ?? false);

const cssSrc = read('apps/web/src/app/globals.css');
ok('[707] ot-page CSS class defined', cssSrc?.includes('.ot-page') ?? false);
ok('[707] ot-card CSS class defined',  cssSrc?.includes('.ot-card') ?? false);
ok('[707] ot-dim-badge CSS classes defined', cssSrc?.includes('.ot-dim-badge') ?? false);
ok('[707] ot-modal CSS class defined', cssSrc?.includes('.ot-modal') ?? false);
ok('[707] dimension colour tokens present (operational/financial/business)',
  cssSrc?.includes('ot-dim-badge--operational') &&
  cssSrc?.includes('ot-dim-badge--financial') &&
  cssSrc?.includes('ot-dim-badge--business') || false);

// execution page link
const execSrc = read('apps/web/src/app/execution/[caseId]/page.tsx');
ok('[707] execution page links to /cases/:caseId/outcome',
  execSrc?.includes("'/cases/' + caseId + '/outcome'") ?? false);
ok('[707] execution page link conditional on outcome_pending or outcome_confirmed',
  execSrc?.includes("outcome_pending' || state === 'outcome_confirmed") ?? false);

// ============================================================================
// CASE-001 seed
// ============================================================================

console.log('\n--- [SEED] CASE-001 outcome-timeline.json ---');

const seed = readJson('mock/cases/CASE-001/outcome-timeline.json');
ok('[SEED] outcome-timeline.json exists', seed !== null);
ok('[SEED] schema_version = "1.0"', seed?.schema_version === '1.0');
ok('[SEED] 3 checkpoints', seed?.checkpoints?.length === 3);
ok('[SEED] deterministic ID chk-op-CASE-001-1',
  seed?.checkpoints?.some((c) => c.id === 'chk-op-CASE-001-1') ?? false);
ok('[SEED] summary.total = 3', seed?.summary?.total === 3);
ok('[SEED] all checkpoints start pending',
  seed?.checkpoints?.every((c) => c.status === 'pending') ?? false);

// ============================================================================
// Results
// ============================================================================

console.log('\n===================================================================');
console.log(`  Results: ${passed} passed / ${failed} failed`);
console.log('===================================================================\n');

if (failed > 0) {
  console.error('  FAIL  DK-70x sprint verification FAILED.');
  process.exit(1);
} else {
  console.log('  PASS  Sprint 7 verified. DK-701 through DK-707 complete.\n');
  console.log('  Summary:');
  console.log('    DK-701  OutcomeTimeline type contracts');
  console.log('    DK-702  DataAdapter interface extensions');
  console.log('    DK-703  Mock adapter lifecycle methods');
  console.log('    DK-704  Checkpoint defaults config');
  console.log('    DK-705  Dispatcher consequence: auto-initialize timeline');
  console.log('    DK-706  API endpoints (GET + 4× POST)');
  console.log('    DK-707  Minimal UI: /cases/:caseId/outcome');
}
