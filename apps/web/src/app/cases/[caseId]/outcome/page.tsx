/**
 * /cases/:caseId/outcome
 *
 * Sprint 7 — DK-707: Outcome Timeline page.
 *
 * Server component: reads outcome-timeline.json and decision-record.json
 * from disk, passes both to the OutcomeTimelineView client component.
 *
 * Architecture:
 *   - This page does NOT modify data. All mutations go through API routes.
 *   - OutcomeTimeline is separate from DecisionRecord — this page reads both
 *     for display but treats them as independent concerns.
 *   - No dependency on workflow state is required; the timeline may exist in
 *     any workflow state once outcome_capture_initiated has fired.
 *
 * Accessible via a link from /execution/:caseId when state is outcome_pending
 * or outcome_confirmed. No sidebar nav item added per Sprint 7 scope.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { OutcomeTimelineView } from './OutcomeTimelineView.js';
import type { OutcomeTimeline } from '@denkkern/types';

interface PageProps {
  params: { caseId: string };
}

function mockRoot(): string {
  return process.env['MOCK_ROOT'] ?? process.cwd();
}

export default function OutcomeTimelinePage({ params }: PageProps) {
  const { caseId } = params;

  const timelinePath = join(mockRoot(), 'mock', 'cases', caseId, 'outcome-timeline.json');
  const recordPath   = join(mockRoot(), 'mock', 'cases', caseId, 'decision-record.json');

  // Timeline not yet initialized (decision not yet made, or wrong workflow state)
  if (!existsSync(timelinePath)) {
    return (
      <div className="ot-page">
        <div className="ot-empty-card">
          <div className="ot-empty-icon">🕐</div>
          <h2 className="ot-empty-title">No outcome timeline yet</h2>
          <p className="ot-empty-body">
            The outcome timeline is created automatically when the decision is confirmed
            and outcome tracking begins. Check back after the decision has been approved.
          </p>
          <p className="ot-empty-case">Case {caseId}</p>
        </div>
      </div>
    );
  }

  const timeline = JSON.parse(readFileSync(timelinePath, 'utf-8')) as OutcomeTimeline;

  // Read decision record for header context (scenario, decision date)
  type RecordShape = {
    decision?: { approved_at?: string; scenario_id?: string };
    context_snapshot?: { shipment_context?: { supplier?: string } };
  };
  const record: RecordShape = existsSync(recordPath)
    ? (JSON.parse(readFileSync(recordPath, 'utf-8')) as RecordShape)
    : {};

  const decisionDate = record.decision?.approved_at?.slice(0, 10) ?? 'Unknown';
  const scenarioId   = record.decision?.scenario_id ?? 'Unknown';
  const supplier     = record.context_snapshot?.shipment_context?.supplier ?? null;

  return (
    <OutcomeTimelineView
      caseId={caseId}
      initialTimeline={timeline}
      decisionDate={decisionDate}
      scenarioId={scenarioId}
      supplier={supplier}
    />
  );
}
