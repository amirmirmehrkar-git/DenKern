/**
 * Outcome Timeline contracts — DenkKern Sprint 7
 *
 * Source of truth: docs/strategy/outcome-reality-model-v1.md
 * Implementation plan: docs/sprints/sprint-7-plan.md
 * Owner: Orchestration layer (Amir)
 *
 * DESIGN PRINCIPLES
 *
 *   OutcomeTimeline is PARALLEL to DecisionRecord.outcome (OutcomeRecord | null).
 *   It does NOT replace or modify the Sprint 6 DecisionRecord / OutcomeRecord model.
 *   Timeline feeds the final record; the merge is a Sprint 8+ decision.
 *
 *   Key decisions:
 *   1. Outcome is a timeline of checkpoints, not a single event.
 *   2. Checkpoints are tasks requiring confirmation, not reminders.
 *   3. Three dimensions (operational / financial / business) — all optional.
 *   4. No auto-close: reminder_3 → unresolved, never auto-confirmed.
 *   5. OutcomeDimension is an open string union — new values never break the schema.
 *   6. Decision Quality is NEVER captured here — see DecisionRecord.outcome.decision_quality.
 *
 * IMMUTABILITY RULES
 *   schema_version  — written once at initialization; never overwritten.
 *   initialized_at  — written once at initialization; never overwritten.
 *   id, case_id,
 *   decision_id,
 *   dimension,
 *   task_description,
 *   recipient_id    — written once at checkpoint creation; never overwritten.
 *   status,
 *   outcome_data,
 *   reminder_count,
 *   sent_at,
 *   confirmed_at,
 *   confirmed_by,
 *   last_reminder_at — mutable via lifecycle helpers (DK-703).
 */

// ---------------------------------------------------------------------------
// CheckpointStatus — full reminder lifecycle
//
// Terminal states:  'confirmed', 'unresolved'
// Intermediate:     'pending', 'sent', 'reminder_1', 'reminder_2', 'reminder_3'
//
// Valid transitions (enforced by lifecycle helpers, not the type):
//   pending → sent
//   sent → reminder_1 → reminder_2 → reminder_3 → unresolved
//   <any non-terminal> → confirmed  (via confirmCheckpoint)
//   <any non-terminal> → unresolved (via markCheckpointUnresolved)
// ---------------------------------------------------------------------------

export type CheckpointStatus =
  | 'pending'      // task created; not yet sent to recipient
  | 'sent'         // task notification dispatched; awaiting response
  | 'reminder_1'   // first reminder dispatched (no response to 'sent')
  | 'reminder_2'   // second reminder dispatched
  | 'reminder_3'   // third and final reminder dispatched
  | 'confirmed'    // recipient confirmed — TERMINAL
  | 'unresolved';  // no response after reminder_3 — TERMINAL (no auto-close)

// ---------------------------------------------------------------------------
// OutcomeDimension — controlled vocabulary with open-ended escape hatch.
//
// The `(string & {})` intersection prevents TypeScript from collapsing the
// union to plain `string`, so IDEs still autocomplete the three known values
// while arbitrary strings (discovered in Domain Expert interviews) are never
// a type error. New dimensions require ZERO schema or code changes.
// ---------------------------------------------------------------------------

export type OutcomeDimension =
  | 'operational'
  | 'financial'
  | 'business'
  | (string & {});  // open escape hatch — interviews may surface new dimensions

// ---------------------------------------------------------------------------
// OutcomeCheckpoint — a single task on the outcome timeline.
//
// One checkpoint = one confirmable task assigned to one recipient.
// Checkpoints are auto-generated from config/checkpoint-defaults.json
// when the outcome_capture_initiated event fires (DK-705).
// ---------------------------------------------------------------------------

export interface OutcomeCheckpoint {
  /**
   * Stable identifier. Format: <id_prefix>-<caseId>-<sequence>.
   * Generated at timeline initialization; never changes.
   * Example: "chk-op-CASE-001-1"
   */
  id: string;

  /** Denormalized for single-document reads without a join. */
  case_id: string;

  /** DecisionRecord.id — links checkpoint to the decision that created it. */
  decision_id: string;

  /**
   * Which dimension of the outcome this checkpoint covers.
   * Not all dimensions are required per case — some cases may have no
   * financial checkpoint if cost tracking is not applicable.
   */
  dimension: OutcomeDimension;

  /** Human-readable prompt shown to the recipient. Never auto-generated from data. */
  task_description: string;

  /** user_id of the person responsible for confirming this checkpoint. */
  recipient_id: string;

  /**
   * Absolute deadline. Computed at initialization from decision date +
   * template.due_offset_days. ISO 8601.
   */
  due_at: string;

  /** Current position in the reminder lifecycle. */
  status: CheckpointStatus;

  /**
   * Flexible outcome data confirmed by the recipient.
   * Shape is UI-validated, not schema-validated here.
   * Example: { notes: "Shipment arrived 2 days late, production not stopped." }
   * null until the recipient confirms.
   */
  outcome_data: Record<string, unknown> | null;

  /**
   * Number of reminder notifications dispatched (0–3).
   * Incremented by advanceReminderForCheckpoint on each reminder_1/2/3 transition.
   */
  reminder_count: number;

  /** ISO 8601. Set when timeline is initialized. */
  created_at: string;

  /** ISO 8601. Set when status transitions to 'sent'. null before that. */
  sent_at: string | null;

  /** ISO 8601. Set when status transitions to 'confirmed'. null before that. */
  confirmed_at: string | null;

  /** user_id. Set when status transitions to 'confirmed'. null before that. */
  confirmed_by: string | null;

  /** ISO 8601 of the most recently dispatched reminder. null if no reminder sent. */
  last_reminder_at: string | null;
}

// ---------------------------------------------------------------------------
// OutcomeTimelineSummary — derived view, recomputed on every saveOutcomeTimeline.
//
// Never the authoritative source — recompute from checkpoints if in doubt.
// Stored for fast GET /api/cases/:caseId/outcome-timeline reads.
// ---------------------------------------------------------------------------

export interface OutcomeTimelineSummary {
  /** Total checkpoint count. */
  total: number;
  /** Count of checkpoints in 'confirmed' status. */
  confirmed: number;
  /** Count of checkpoints in 'unresolved' status. */
  unresolved: number;
  /**
   * Count of non-terminal checkpoints (pending + sent + reminder_1/2/3).
   * Derived: total - confirmed - unresolved.
   */
  pending: number;
}

// ---------------------------------------------------------------------------
// OutcomeTimeline — top-level container.
//
// Stored at mock/cases/:caseId/outcome-timeline.json (mock layer).
// Initialized when outcome_capture_initiated fires (DK-705).
// Lives in parallel with DecisionRecord — does NOT modify it.
// ---------------------------------------------------------------------------

export interface OutcomeTimeline {
  case_id: string;
  decision_id: string;        // DecisionRecord.id

  /**
   * Schema version for forward-compatibility.
   * Bump to '1.1' if the shape changes in a non-additive way.
   * Additive changes (new optional fields) do not require a bump.
   */
  schema_version: '1.0';

  /** ISO 8601. Set once when outcome_capture_initiated fires. */
  initialized_at: string;

  /**
   * Ordered list of checkpoints for this case.
   * Order is preserved from initialization (sorted by due_at ascending).
   * Never re-sorted after initialization.
   */
  checkpoints: OutcomeCheckpoint[];

  /**
   * Derived summary — recomputed on every saveOutcomeTimeline call.
   * Do not rely on this for authoritative counts; recompute if needed.
   */
  summary: OutcomeTimelineSummary;
}

// ---------------------------------------------------------------------------
// CheckpointTemplate — shape of one entry in config/checkpoint-defaults.json.
//
// Exported so the dispatcher (DK-705) and tests (DK-708) can type-check
// the config file without importing from the app layer.
// ---------------------------------------------------------------------------

export interface CheckpointTemplate {
  /**
   * Short prefix for generated checkpoint IDs.
   * Typically matches the dimension: 'op', 'fin', 'biz'.
   * Example generated id: "chk-op-CASE-001-1"
   */
  id_prefix: string;

  dimension: OutcomeDimension;

  /** Human-readable task prompt. May be overridden by orchestration layer. */
  task_description: string;

  /**
   * Role used to resolve recipient_id at runtime.
   * The dispatcher resolves 'case_owner' to the actual user_id from case context.
   * New roles can be added without changing this type.
   */
  recipient_role: string;

  /**
   * Days after decision date when the checkpoint task is due.
   * Example: 3 means due_at = decided_at + 3 days.
   */
  due_offset_days: number;
}
