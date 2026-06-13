/**
 * errors.ts — DenkKern prediction-adapter
 *
 * All error types thrown by the prediction adapter layer.
 * Callers can import these to distinguish adapter failures from other errors.
 */

/**
 * Thrown when JamesHTTPAdapter is called without an MMSI and
 * no fallback is available.
 *
 * The orchestration layer should gate on shipment_context.mmsi being
 * present before dispatching context_confirmed if live prediction is required.
 */
export class MissingMmsiError extends Error {
  readonly code = 'MISSING_MMSI';
  constructor(shipmentId: string) {
    super(
      `JamesHTTPAdapter: no MMSI provided for shipment '${shipmentId}'. ` +
      `Set shipment_context.mmsi before requesting a live prediction, ` +
      `or set JAMES_FALLBACK_ENABLED=true to use mock data instead.`
    );
    this.name = 'MissingMmsiError';
  }
}

/**
 * Thrown when the James API call fails and JAMES_FALLBACK_ENABLED is false.
 *
 * Callers should translate this to a 503 response at the API boundary.
 */
export class PredictionUnavailableError extends Error {
  readonly code = 'PREDICTION_UNAVAILABLE';
  constructor(
    public readonly shipmentId: string,
    public readonly cause: unknown
  ) {
    super(
      `JamesHTTPAdapter: prediction unavailable for shipment '${shipmentId}'. ` +
      `James API call failed and JAMES_FALLBACK_ENABLED is false. ` +
      `Cause: ${cause instanceof Error ? cause.message : String(cause)}`
    );
    this.name = 'PredictionUnavailableError';
  }
}

/**
 * Thrown when the James API returns a response that fails structural validation.
 *
 * Distinct from PredictionUnavailableError: the call succeeded (HTTP 200) but
 * the body was malformed. Never silently falls back — operator must investigate.
 */
export class JamesResponseInvalidError extends Error {
  readonly code = 'JAMES_RESPONSE_INVALID';
  constructor(
    public readonly shipmentId: string,
    public readonly validationMessage: string
  ) {
    super(
      `JamesHTTPAdapter: James API returned an invalid response for shipment ` +
      `'${shipmentId}': ${validationMessage}`
    );
    this.name = 'JamesResponseInvalidError';
  }
}
