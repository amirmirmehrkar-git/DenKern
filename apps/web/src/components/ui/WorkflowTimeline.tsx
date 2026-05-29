/**
 * WorkflowTimeline — vertical timeline of case state progression.
 * Read-only. Shows past states as dots, current state highlighted, future as muted.
 *
 * Architecture rule: receives pre-built event array from parent — no data fetching.
 */

import type { WorkflowState } from '@denkkern/types';
import { STATE_ORDER, STATE_LABELS } from '../../lib/workflow/state-order.js';

export interface TimelineEvent {
  state: WorkflowState;
  occurred_at?: string;
  actor?: string;
}

interface WorkflowTimelineProps {
  /** Completed or current state events — ordered oldest-first. */
  events: TimelineEvent[];
  currentState: WorkflowState;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export function WorkflowTimeline({ events, currentState }: WorkflowTimelineProps) {
  if (events.length === 0) {
    return <p className="text-muted" style={{ fontSize: 13 }}>No events recorded yet.</p>;
  }

  const currentOrder = STATE_ORDER[currentState];

  return (
    <div className="timeline">
      {events.map((ev, i) => {
        const order = STATE_ORDER[ev.state];
        const isCurrent = ev.state === currentState;
        const isPast = order < currentOrder;
        const isFuture = order > currentOrder;
        const isLast = i === events.length - 1;

        return (
          <div key={ev.state} className="timeline-item">
            <div className="timeline-track">
              <span
                className={`timeline-dot ${isCurrent ? 'current' : isPast ? 'past' : ''}`}
              />
              {!isLast && <span className="timeline-line" />}
            </div>
            <div className="timeline-content">
              <div className={`timeline-label${isFuture ? ' future' : ''}`}>
                {STATE_LABELS[ev.state]}
              </div>
              {ev.occurred_at !== undefined && (
                <div className="timeline-meta">
                  {formatDate(ev.occurred_at)}
                  {ev.actor !== undefined && ` · ${ev.actor}`}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
