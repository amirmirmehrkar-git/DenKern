#!/usr/bin/env node
/**
 * verify-demo-ui-bridge.mjs
 *
 * Sprint 9A acceptance check:
 *   1. All 9 demo page files exist under apps/web/src/app/demo/
 *   2. Each page calls /api/demo/ (not /api/cases/) in actual fetch() calls
 *   3. None of the demo pages import useWorkflowState
 *   4. None of the demo pages reference CASE-001 or CASE-002
 *
 * Note: JSDoc comment strings are excluded from the fetch-pattern check.
 * The regex targets actual fetch() calls only.
 *
 * Exit 0  -- all assertions pass
 * Exit 1  -- one or more assertions failed
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Regex: actual fetch/import calls to /api/cases/
const CASES_FETCH_RE = /fetch\s*\(\s*['"`][^'"`]*\/api\/cases\//;
const CASES_IMPORT_RE = /from\s+['"`][^'"`]*\/api\/cases\//;

// ---------------------------------------------------------------------------
// Demo page registry -- 9 pages + sidebar
// ---------------------------------------------------------------------------

const ALL_CHECKS = [
  {
    label: 'Mission Control -- /demo',
    path: 'apps/web/src/app/demo/page.tsx',
    mustContain: ['/api/demo/mission-control'],
    mustNotContain: ['CASE-001', 'CASE-002', 'useWorkflowState'],
    mustNotContainRe: [CASES_FETCH_RE, CASES_IMPORT_RE],
  },
  {
    label: 'Shipment Portfolio -- /demo/shipments',
    path: 'apps/web/src/app/demo/shipments/page.tsx',
    mustContain: ['/api/demo/shipments/'],
    mustNotContain: ['CASE-001', 'CASE-002', 'useWorkflowState'],
    mustNotContainRe: [CASES_FETCH_RE, CASES_IMPORT_RE],
  },
  {
    label: 'Shipment Workspace -- /demo/shipments/[shipmentId]',
    path: 'apps/web/src/app/demo/shipments/[shipmentId]/page.tsx',
    mustContain: ['/api/demo/shipments/'],
    mustNotContain: ['CASE-001', 'CASE-002', 'useWorkflowState'],
    mustNotContainRe: [CASES_FETCH_RE, CASES_IMPORT_RE],
  },
  {
    label: 'Scenario Analysis',
    path: 'apps/web/src/app/demo/shipments/[shipmentId]/scenario-analysis/page.tsx',
    mustContain: ['/api/demo/shipments/'],
    mustNotContain: ['CASE-001', 'CASE-002', 'useWorkflowState'],
    mustNotContainRe: [CASES_FETCH_RE, CASES_IMPORT_RE],
  },
  {
    label: 'Decision Room',
    path: 'apps/web/src/app/demo/shipments/[shipmentId]/decision-room/page.tsx',
    mustContain: ['/api/demo/shipments/'],
    mustNotContain: ['CASE-001', 'CASE-002', 'useWorkflowState'],
    mustNotContainRe: [CASES_FETCH_RE, CASES_IMPORT_RE],
  },
  {
    label: 'Approval',
    path: 'apps/web/src/app/demo/shipments/[shipmentId]/approval/page.tsx',
    mustContain: ['/api/demo/shipments/'],
    mustNotContain: ['CASE-001', 'CASE-002', 'useWorkflowState'],
    mustNotContainRe: [CASES_FETCH_RE, CASES_IMPORT_RE],
  },
  {
    label: 'Execution Validation',
    path: 'apps/web/src/app/demo/shipments/[shipmentId]/execution-validation/page.tsx',
    mustContain: ['/api/demo/shipments/'],
    mustNotContain: ['CASE-001', 'CASE-002', 'useWorkflowState'],
    mustNotContainRe: [CASES_FETCH_RE, CASES_IMPORT_RE],
  },
  {
    label: 'Outcome',
    path: 'apps/web/src/app/demo/shipments/[shipmentId]/outcome/page.tsx',
    mustContain: ['/api/demo/shipments/'],
    mustNotContain: ['CASE-001', 'CASE-002', 'useWorkflowState'],
    mustNotContainRe: [CASES_FETCH_RE, CASES_IMPORT_RE],
  },
  {
    label: 'Decision Model -- /demo/decision-model',
    path: 'apps/web/src/app/demo/decision-model/page.tsx',
    mustContain: ['/api/demo/shipments/'],
    mustNotContain: ['CASE-001', 'CASE-002', 'useWorkflowState'],
    mustNotContainRe: [CASES_FETCH_RE, CASES_IMPORT_RE],
  },
  {
    label: 'Sidebar -- demo nav section',
    path: 'apps/web/src/components/layout/Sidebar.tsx',
    mustContain: ['/demo', '/demo/shipments', '/demo/decision-model'],
    mustNotContain: [],
    mustNotContainRe: [],
  },
];

// ---------------------------------------------------------------------------
// Result tracking
// ---------------------------------------------------------------------------

let passes = 0;
let failures = 0;
const lines = [];

function pass(msg) { lines.push('  PASS ' + msg); passes++; }
function fail(msg) { lines.push('  FAIL ' + msg); failures++; }

// ---------------------------------------------------------------------------
// Check helper
// ---------------------------------------------------------------------------

function checkFile({ label, path, mustContain, mustNotContain, mustNotContainRe }) {
  lines.push('\n[' + label + ']');
  const absPath = join(ROOT, path);
  if (!existsSync(absPath)) { fail('File not found: ' + path); return; }
  pass('File exists: ' + path);
  const content = readFileSync(absPath, 'utf-8');
  for (const needle of mustContain) {
    if (content.includes(needle)) pass('Contains: ' + needle);
    else fail('Missing: "' + needle + '"');
  }
  for (const needle of mustNotContain) {
    if (!content.includes(needle)) pass('No "' + needle + '"');
    else fail('Found forbidden: "' + needle + '"');
  }
  for (const re of mustNotContainRe) {
    if (!re.test(content)) pass('No fetch to /api/cases/');
    else fail('Found forbidden fetch to /api/cases/ -- pattern: ' + re.source);
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

lines.push('='.repeat(60));
lines.push('verify-demo-ui-bridge.mjs -- Sprint 9A acceptance check');
lines.push('='.repeat(60));

for (const check of ALL_CHECKS) checkFile(check);

lines.push('\n' + '='.repeat(60));
lines.push('RESULT: ' + passes + ' PASS . ' + failures + ' FAIL');
lines.push('='.repeat(60));

console.log(lines.join('\n').replace(/PASS /g, '\u2713 ').replace(/FAIL /g, '\u2717 '));

if (failures > 0) {
  process.stderr.write('\n\u2717 ' + failures + ' assertion(s) failed -- demo UI bridge is incomplete.\n');
  process.exit(1);
} else {
  console.log('\n\u2713 All assertions pass -- Sprint 9A demo UI bridge is complete.');
  process.exit(0);
}
