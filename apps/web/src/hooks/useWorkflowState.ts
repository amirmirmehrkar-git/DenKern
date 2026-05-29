'use client';

/**
 * useWorkflowState — polling hook for workflow state
 *
 * Polls GET /api/cases/:caseId/state on a fixed interval and returns the
 * current state + available actions. This is the single source of truth
 * for workflow state on any client page.
 *
 * Architecture rule: no component fetches workflow state independently.
 * All state-dependent UI reads from this hook.
 *
 * Source: docs/architecture/08-page-flow-map.md §9.5
 */

import { useState, useEffect, useCallback } from 'react';
import type { WorkflowStateResponse, WorkflowState, WorkflowEvent } from '@denkkern/types';

export interface WorkflowStateHook {
  state: WorkflowState | null;
  availableActions: WorkflowEvent[];
  updatedAt: string | null;
  isLoading: boolean;
  error: string | null;
  /** Manually trigger a single poll without waiting for the next interval. */
  refresh: () => Promise<void>;
}

export function useWorkflowState(
  caseId: string,
  intervalMs = 3_000
): WorkflowStateHook {
  const [data, setData] = useState<WorkflowStateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}/state`, { cache: 'no-store' });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      const json = (await res.json()) as WorkflowStateResponse;
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setIsLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    let cancelled = false;

    const safePoll = async () => {
      if (!cancelled) await poll();
    };

    void safePoll();
    const id = setInterval(() => { void safePoll(); }, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [caseId, intervalMs, poll]);

  return {
    state: data?.state ?? null,
    availableActions: data?.available_actions ?? [],
    updatedAt: data?.updated_at ?? null,
    isLoading,
    error,
    refresh: poll,
  };
}
