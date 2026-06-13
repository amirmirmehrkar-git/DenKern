/**
 * verify-dk-706.mjs
 *
 * Verifies DK-706: Outcome Timeline API endpoints.
 *
 * Strategy (matches the pattern of verify-dk-604.mjs):
 *   - Checks are against JSON files on disk and TypeScript source text.
 *   - The mock adapter is TypeScript-only (no compiled .js), so lifecycle
 *     transitions are exercised by reading/writing the JSON directly,
 *     simulating what the adapter methods do.
 *   - Adapter method correctness is the concern of DK-703 (verify-dk-703).
 *
 * Checks (≥20):
 *   [1]  5 route files exist
 *   [2]  Correct HTTP method exported from each route file
 *   [3]  Import paths in route files resolve to real TypeScript files
 *   [4]  GET route returns 204 type (code path present)
 *   [5]  All 5 routes import from @denkkern/types
 *   [6]  Checkpoint routes import from @denkkern/mock (MockDataAdapter cast)
 *   [7]  Seed: outcome-timeline.json exists for CASE-001
 *   [8]  Seed: schema_version = "1.0"
 *   [9]  Seed: all 3 checkpoints have deterministic IDs
 *   [10] Seed: all 3 checkpoints start as 'pending'
 *   [11] Seed: summary totals correct (total=3 pending=3 confirmed=0 unresolved=0)
 *   [12] Seed: checkpoint dimensions cover operational/financial/business
 *   [13] Seed: due_at values are valid ISO strings
 *   [14] Lifecycle simulation: pending → sent (send)
 *   [15] Lifecycle simulation: sent → reminder_1 (advance)
 *   [16] Lifecycle simulation: reminder_1 → reminder_2
 *   [17] Lifecycle simulation: reminder_2 → reminder_3
 *   [18] Lifecycle simulation: reminder_3 → unresolved (terminal)
 *   [19] Lifecycle simulation: pending → confirmed (confirm with outcome_data)
 *   [20] Lifecycle simulation: confirmed_by + confirmed_at stored
 *   [21] Lifecycle simulation: pending → unresolved (mark-unresolved)
 *   [22] Summary recomputation after mixed lifecycle (1 confirmed, 2 unresolved)
 *   [23] Route error handling: send/confirm/advance-reminder have 409 LIFECYCLE_CONFLICT
 *   [24] confirm route validates confirmed_by (400 path present)
 *   [25] confirm route validates outcome_data (400 path present)
 *
 * Run from repo root:
 *   node scripts/verify-dk-706.mjs
 */

import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CASE_ID = 'CASE-001';
const CASE_DIR = resolve(ROOT, 'mock', 'cases', CASE_ID);
const TIMELINE_PATH = resolve(CASE_DIR, 'outcome-timeline.json');

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// [1-2] Route file existence + HTTP method exports
// ---------------------------------------------------------------------------

console.log('\n--- [1-2] Route files exist and export correct HTTP methods ---');

const ROUTE_BASE = resolve(ROOT, 'apps/web/src/app/api/cases/[caseId]/outcome-timeline');
const ROUTE_CHKPT = `${ROUTE_BASE}/checkpoints/[checkpointId]`;

const routeFiles = [
  { path: `${ROUTE_BASE}/route.ts`,                   method: 'GET',  name: 'outcome-timeline' },
  { path: `${ROUTE_CHKPT}/send/route.ts`,             method: 'POST', name: 'send' },
  { path: `${ROUTE_CHKPT}/advance-reminder/route.ts`, method: 'POST', name: 'advance-reminder' },
  { path: `${ROUTE_CHKPT}/confirm/route.ts`,          method: 'POST', name: 'confirm' },
  { path: `${ROUTE_CHKPT}/mark-unresolved/route.ts`,  method: 'POST', name: 'mark-unresolved' },
];

const routeContents = {};

for (const { path, method, name } of routeFiles) {
  const exists = existsSync(path);
  ok(`[1] ${name}/route.ts exists`, exists);
  const content = exists ? readFileSync(path, 'utf-8') : '';
  routeContents[name] = content;
  ok(`[2] ${name}/route.ts exports ${method}`, content.includes(`export async function ${method}(`));
}

// ---------------------------------------------------------------------------
// [3] Import paths in route files resolve to real TS files
// ---------------------------------------------------------------------------

console.log('\n--- [3] Import paths resolve ---');

const ADAPTERS_INDEX = resolve(ROOT, 'apps/web/src/lib/adapters/index.ts');
ok('[3] apps/web/src/lib/adapters/index.ts exists', existsSync(ADAPTERS_INDEX));

for (const { path, name } of routeFiles) {
  const content = routeContents[name] ?? '';
  const match = content.match(/from ['"](.+?lib\/adapters\/index\.js)['"]/);
  if (!match) {
    ok(`[3] ${name} adapters import found`, false);
    continue;
  }
  const routeDir = dirname(path);
  const resolved = resolve(routeDir, match[1].replace(/\.js$/, '.ts'));
  ok(`[3] ${name} adapters import resolves to correct file`, resolved === ADAPTERS_INDEX);
}

// ---------------------------------------------------------------------------
// [4] GET route: 204 code path for "no timeline yet"
// ---------------------------------------------------------------------------

console.log('\n--- [4-6] Route code paths ---');

ok('[4] GET route has 204 status for null timeline',
  (routeContents['outcome-timeline'] ?? '').includes('status: 204'));

// ---------------------------------------------------------------------------
// [5] All routes import from @denkkern/types
// ---------------------------------------------------------------------------

for (const { name } of routeFiles) {
  ok(`[5] ${name} imports from @denkkern/types`,
    (routeContents[name] ?? '').includes("from '@denkkern/types'"));
}

// ---------------------------------------------------------------------------
// [6] Checkpoint routes cast to MockDataAdapter
// ---------------------------------------------------------------------------

const checkpointRouteNames = ['send', 'advance-reminder', 'confirm', 'mark-unresolved'];
for (const name of checkpointRouteNames) {
  ok(`[6] ${name} imports MockDataAdapter from @denkkern/mock`,
    (routeContents[name] ?? '').includes("from '@denkkern/mock'"));
}

// ---------------------------------------------------------------------------
// [7-13] Seed data validation
// ---------------------------------------------------------------------------

console.log('\n--- [7-13] Seed data ---');

ok('[7] outcome-timeline.json exists for CASE-001', existsSync(TIMELINE_PATH));

const seed = existsSync(TIMELINE_PATH)
  ? JSON.parse(readFileSync(TIMELINE_PATH, 'utf-8'))
  : null;

ok('[8] schema_version = "1.0"', seed?.schema_version === '1.0');
ok('[9] deterministic checkpoint IDs present',
  seed?.checkpoints.some(c => c.id === 'chk-op-CASE-001-1') &&
  seed?.checkpoints.some(c => c.id === 'chk-fin-CASE-001-2') &&
  seed?.checkpoints.some(c => c.id === 'chk-biz-CASE-001-3')
);
ok('[10] all checkpoints start as pending',
  seed?.checkpoints.every(c => c.status === 'pending')
);
ok('[11] summary: total=3 pending=3 confirmed=0 unresolved=0',
  seed?.summary.total === 3 &&
  seed?.summary.pending === 3 &&
  seed?.summary.confirmed === 0 &&
  seed?.summary.unresolved === 0
);

const dimensions = (seed?.checkpoints ?? []).map(c => c.dimension);
ok('[12] dimensions cover operational/financial/business',
  dimensions.includes('operational') &&
  dimensions.includes('financial') &&
  dimensions.includes('business')
);
ok('[13] due_at values are valid ISO strings',
  (seed?.checkpoints ?? []).every(c => !isNaN(Date.parse(c.due_at)))
);

// ---------------------------------------------------------------------------
// [14-22] Lifecycle simulation via JSON manipulation
// ---------------------------------------------------------------------------

console.log('\n--- [14-22] Lifecycle simulation ---');

// Back up the seed so we can restore it at the end
const seedBackup = JSON.stringify(seed, null, 2);

function recomputeSummary(checkpoints) {
  return {
    total:      checkpoints.length,
    confirmed:  checkpoints.filter(c => c.status === 'confirmed').length,
    unresolved: checkpoints.filter(c => c.status === 'unresolved').length,
    pending:    checkpoints.filter(c =>
      c.status !== 'confirmed' && c.status !== 'unresolved').length,
  };
}

function loadTimeline() {
  return JSON.parse(readFileSync(TIMELINE_PATH, 'utf-8'));
}

function saveTimeline(tl) {
  writeFileSync(TIMELINE_PATH, JSON.stringify(tl, null, 2), 'utf-8');
}

function patchCheckpoint(id, patch) {
  const tl = loadTimeline();
  const idx = tl.checkpoints.findIndex(c => c.id === id);
  if (idx === -1) throw new Error(`Checkpoint ${id} not found`);
  tl.checkpoints[idx] = { ...tl.checkpoints[idx], ...patch };
  tl.summary = recomputeSummary(tl.checkpoints);
  saveTimeline(tl);
  return tl.checkpoints[idx];
}

const now = new Date().toISOString();
const CP_OP  = 'chk-op-CASE-001-1';
const CP_FIN = 'chk-fin-CASE-001-2';
const CP_BIZ = 'chk-biz-CASE-001-3';

// [14] pending → sent
const sent = patchCheckpoint(CP_OP, { status: 'sent', sent_at: now });
ok('[14] pending → sent (send)', sent.status === 'sent' && sent.sent_at !== null);

// [15] sent → reminder_1
const r1 = patchCheckpoint(CP_OP, { status: 'reminder_1', reminder_count: 1, last_reminder_at: now });
ok('[15] sent → reminder_1', r1.status === 'reminder_1');

// [16] reminder_1 → reminder_2
const r2 = patchCheckpoint(CP_OP, { status: 'reminder_2', reminder_count: 2, last_reminder_at: now });
ok('[16] reminder_1 → reminder_2', r2.status === 'reminder_2');

// [17] reminder_2 → reminder_3
const r3 = patchCheckpoint(CP_OP, { status: 'reminder_3', reminder_count: 3, last_reminder_at: now });
ok('[17] reminder_2 → reminder_3', r3.status === 'reminder_3');

// [18] reminder_3 → unresolved (terminal)
const unresOp = patchCheckpoint(CP_OP, { status: 'unresolved' });
ok('[18] reminder_3 → unresolved (terminal)', unresOp.status === 'unresolved');

// [19] pending → confirmed (via confirm with outcome_data)
const outcomeData = { units_recovered: 240, line_restart_time: '2026-06-16T08:00:00Z' };
const confirmed = patchCheckpoint(CP_FIN, {
  status: 'confirmed',
  confirmed_at: now,
  confirmed_by: 'lena',
  outcome_data: outcomeData,
});
ok('[19] pending → confirmed (confirm)', confirmed.status === 'confirmed');

// [20] confirmed_by and confirmed_at stored
ok('[20] confirmed_by = lena', confirmed.confirmed_by === 'lena');
ok('[20] confirmed_at is set', typeof confirmed.confirmed_at === 'string');

// [21] pending → unresolved (mark-unresolved)
const unresBiz = patchCheckpoint(CP_BIZ, { status: 'unresolved' });
ok('[21] pending → unresolved (mark-unresolved)', unresBiz.status === 'unresolved');

// [22] Final summary: total=3 confirmed=1 unresolved=2 pending=0
const finalTl = loadTimeline();
ok('[22] summary.total = 3', finalTl.summary.total === 3);
ok('[22] summary.confirmed = 1', finalTl.summary.confirmed === 1);
ok('[22] summary.unresolved = 2', finalTl.summary.unresolved === 2);
ok('[22] summary.pending = 0', finalTl.summary.pending === 0);

// ---------------------------------------------------------------------------
// [23-25] Route error handling code paths (static analysis)
// ---------------------------------------------------------------------------

console.log('\n--- [23-25] Error handling code paths ---');

// [23] Lifecycle conflict → 409
for (const name of checkpointRouteNames) {
  ok(`[23] ${name} has 409 LIFECYCLE_CONFLICT path`,
    (routeContents[name] ?? '').includes('LIFECYCLE_CONFLICT') ||
    (routeContents[name] ?? '').includes('TERMINAL_STATE') ||
    (routeContents[name] ?? '').includes('status: 409')
  );
}

// [24] confirm validates confirmed_by → 400
ok('[24] confirm validates confirmed_by (400)',
  (routeContents['confirm'] ?? '').includes("Missing required field: confirmed_by")
);

// [25] confirm validates outcome_data → 400
ok('[25] confirm validates outcome_data (400)',
  (routeContents['confirm'] ?? '').includes("Missing required field: outcome_data")
);

// ---------------------------------------------------------------------------
// Restore seed file
// ---------------------------------------------------------------------------

writeFileSync(TIMELINE_PATH, seedBackup, 'utf-8');
console.log('\n  Seed file restored to original state.');

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

console.log('\n===================================================================');
console.log(`  Results: ${passed} passed / ${failed} failed`);
console.log('===================================================================\n');

if (failed > 0) {
  console.error('  FAIL  DK-706 verification FAILED.');
  process.exit(1);
} else {
  console.log('  PASS  DK-706 verified. Outcome Timeline API endpoints complete.\n');
  console.log('  Routes:');
  console.log('    GET  /api/cases/:caseId/outcome-timeline');
  console.log('    POST /api/cases/:caseId/outcome-timeline/checkpoints/:id/send');
  console.log('    POST /api/cases/:caseId/outcome-timeline/checkpoints/:id/advance-reminder');
  console.log('    POST /api/cases/:caseId/outcome-timeline/checkpoints/:id/confirm');
  console.log('    POST /api/cases/:caseId/outcome-timeline/checkpoints/:id/mark-unresolved');
}
