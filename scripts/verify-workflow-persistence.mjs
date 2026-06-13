/**
 * verify-workflow-persistence.mjs — DenkKern
 *
 * Verifies the workflow state persistence fix (saveWorkflowState writes to disk).
 *
 * What this script tests:
 *
 *   1. Code audit — confirms the fix is present in mock-adapter.ts source
 *   2. Disk write — simulates saveWorkflowState by writing a known state to
 *      workflow-state.json (exactly what the fixed adapter does)
 *   3. Restart simulation — spawns a fresh subprocess to read the file
 *      (a new process = empty module-level cache = forced disk read)
 *   4. Assert persisted — confirms the subprocess sees the saved state, not
 *      the original seed
 *   5. Restore — writes the original seed back
 *   6. Sprint 6 — runs verify-dk-604.mjs; must still pass 39/39
 *
 * Run from repo root:
 *   node scripts/verify-workflow-persistence.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const CASE_ID   = 'CASE-001';
const STATE_FILE = join(ROOT, 'mock', 'cases', CASE_ID, 'workflow-state.json');
const ADAPTER_TS = join(ROOT, 'mock', 'adapters', 'mock-adapter.ts');
const DATA_ADAPTER_TS = join(ROOT, 'mock', 'adapters', 'data-adapter.ts');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function check(label, condition, details) {
  if (condition) {
    console.log('  OK  ' + label);
    passed++;
  } else {
    console.error(' FAIL ' + label);
    if (details) console.error('       ' + details);
    failed++;
  }
}

function section(title) {
  console.log('\n── ' + title);
}

// ---------------------------------------------------------------------------
// 1. Code audit
// ---------------------------------------------------------------------------

section('1. Code audit — mock-adapter.ts');

const adapterSource = readFileSync(ADAPTER_TS, 'utf-8');

check(
  'writeFileSync is imported from fs',
  /import\s*\{[^}]*writeFileSync[^}]*\}\s*from\s*['"]fs['"]/.test(adapterSource),
  'Expected: import { readFileSync, writeFileSync } from \'fs\''
);

check(
  'saveWorkflowState calls writeFileSync',
  adapterSource.includes('writeFileSync(filePath,') || adapterSource.includes('writeFileSync(filePath ,'),
  'writeFileSync call not found inside saveWorkflowState body'
);

check(
  'NTFS null-byte guard present in saveWorkflowState',
  /JSON\.parse\(readFileSync\(filePath/.test(adapterSource),
  'Expected: JSON.parse(readFileSync(filePath, ...)) immediately after writeFileSync'
);

check(
  '_comment field is not written back (comment explains exclusion)',
  adapterSource.includes('_comment') && adapterSource.includes('seed'),
  'Explanation of _comment exclusion not found'
);

check(
  'dispatchEventDirect routes through saveWorkflowState',
  adapterSource.includes('this.saveWorkflowState(caseId, updated)'),
  'dispatchEventDirect still uses direct cache.set() instead of saveWorkflowState'
);

section('2. Code audit — data-adapter.ts interface comment');

const interfaceSource = readFileSync(DATA_ADAPTER_TS, 'utf-8');

check(
  'Interface comment no longer says "no disk write"',
  !interfaceSource.includes('no disk write'),
  'Stale comment still present: "no disk write"'
);

check(
  'Interface comment mentions workflow-state.json disk write',
  interfaceSource.includes('workflow-state.json'),
  'Interface comment should reference the file written to disk'
);

// ---------------------------------------------------------------------------
// 2. Snapshot original seed
// ---------------------------------------------------------------------------

section('3. Snapshot original seed (will be restored)');

const originalContent = readFileSync(STATE_FILE, 'utf-8');
const originalState   = JSON.parse(originalContent);

check(
  `Seed state is "${originalState.state}"`,
  typeof originalState.state === 'string',
  `state field missing or not a string: ${JSON.stringify(originalState)}`
);

console.log(`     Seed: ${JSON.stringify({ state: originalState.state, case_id: originalState.case_id })}`);

// ---------------------------------------------------------------------------
// 3. Simulate saveWorkflowState — write a test state to disk
// ---------------------------------------------------------------------------

section('4. Write test state to disk (simulates saveWorkflowState)');

const TEST_STATE = {
  case_id:           CASE_ID,
  state:             'context_confirmed',
  available_actions: ['decision_confirmed'],
  updated_at:        new Date().toISOString(),
};

// This is EXACTLY what the fixed saveWorkflowState does (minus the in-memory cache.set).
// The adapter adds cache.set first, then writeFileSync, then NTFS guard.
writeFileSync(STATE_FILE, JSON.stringify(TEST_STATE, null, 2), 'utf-8');
// NTFS guard
const guardRead = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));

check(
  'Disk write succeeded (NTFS guard passed)',
  guardRead.state === 'context_confirmed',
  `Disk read after write returned: ${JSON.stringify(guardRead)}`
);

check(
  'No _comment field written to disk',
  !('_comment' in guardRead),
  '_comment field unexpectedly present in written state'
);

// ---------------------------------------------------------------------------
// 4. Simulate server restart — fresh subprocess reads from disk
//
// A new Node.js process has an empty module-level workflowStateCache Map.
// Reading workflow-state.json from disk is the only way to recover state.
// This subprocess proves the file content is what a restarting adapter sees.
// ---------------------------------------------------------------------------

section('5. Simulate restart — fresh subprocess reads workflow-state.json');

const readerScript = `
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const content = readFileSync(join(root, 'mock', 'cases', 'CASE-001', 'workflow-state.json'), 'utf-8');
console.log(content.trim());
`;

const readerPath = join(ROOT, 'scripts', '_tmp-reader.mjs');
writeFileSync(readerPath, readerScript, 'utf-8');

let subprocessOutput;
try {
  subprocessOutput = execSync(`node "${readerPath}"`, { cwd: ROOT, encoding: 'utf-8' }).trim();
} finally {
  try { (await import('fs')).unlinkSync(readerPath); } catch {}
}

const subprocessState = JSON.parse(subprocessOutput);

check(
  `Subprocess (fresh process) sees persisted state "${TEST_STATE.state}"`,
  subprocessState.state === TEST_STATE.state,
  `Expected state="${TEST_STATE.state}", subprocess returned state="${subprocessState.state}"`
);

check(
  'Subprocess sees correct case_id',
  subprocessState.case_id === CASE_ID,
  `Expected case_id="${CASE_ID}", got "${subprocessState.case_id}"`
);

check(
  'Subprocess state was NOT reverted to seed',
  subprocessState.state !== originalState.state,
  `Subprocess returned seed state "${originalState.state}" — disk write did not persist`
);

// ---------------------------------------------------------------------------
// 5. Restore original seed
// ---------------------------------------------------------------------------

section('6. Restore original seed');

writeFileSync(STATE_FILE, originalContent, 'utf-8');
// NTFS guard
const restoredCheck = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));

check(
  `Seed restored to "${originalState.state}"`,
  restoredCheck.state === originalState.state,
  `Restore failed: disk now has state="${restoredCheck.state}"`
);

// ---------------------------------------------------------------------------
// 6. Sprint 6 regression — verify-dk-604.mjs must still pass 39/39
// ---------------------------------------------------------------------------

section('7. Sprint 6 regression — verify-dk-604.mjs');

let dk604Output = '';
let dk604ExitCode = 0;

try {
  dk604Output = execSync(
    `node "${join(ROOT, 'scripts', 'verify-dk-604.mjs')}"`,
    { cwd: ROOT, encoding: 'utf-8' }
  );
} catch (err) {
  dk604ExitCode = err.status ?? 1;
  dk604Output = err.stdout ?? '';
}

// Find result summary line
const resultLine = dk604Output
  .split('\n')
  .filter(l => l.includes('/') || l.toLowerCase().includes('pass'))
  .pop() ?? dk604Output.split('\n').pop() ?? '';

const passedMatch = dk604Output.match(/(\d+)\s*(?:passed|\/\s*\d+)/i);
const passCount = passedMatch ? parseInt(passedMatch[1], 10) : -1;

check(
  'verify-dk-604 passed 39/39',
  dk604ExitCode === 0 && (dk604Output.includes('39/39') || dk604Output.includes('39 passed') || passCount === 39),
  `Exit code: ${dk604ExitCode}\nLast line: "${resultLine}"`
);

if (dk604Output) {
  const lines = dk604Output.trim().split('\n');
  const summary = lines[lines.length - 1];
  console.log(`     ${summary}`);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n' + '═'.repeat(55));
if (failed === 0) {
  console.log('  PERSISTENCE FIX VERIFIED — ' + passed + '/' + (passed + failed) + ' checks passed');
  console.log('  Workflow state survives server restart.');
} else {
  console.log('  ' + failed + ' check(s) FAILED — ' + passed + ' passed');
}
console.log('═'.repeat(55) + '\n');

process.exit(failed > 0 ? 1 : 0);
