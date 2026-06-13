/**
 * @denkkern/prediction-adapter — public API
 *
 * Only the types and functions listed here are part of the package contract.
 * Internal files (james-raw.ts, james-raw-schema.ts, mapper.ts) are NOT
 * re-exported and must not be imported from outside this package.
 */

// Port (interface) — import this type in the orchestration layer
export type { PredictionAdapterPort, PredictionRequestContext } from './port.js';

// Implementations — import to wire into the app
export { MockPredictionAdapter } from './mock-prediction-adapter.js';
export { JamesHTTPAdapter } from './james-http-adapter.js';
export type { JamesHTTPAdapterConfig } from './james-http-adapter.js';

// Factory — primary entry point for the app
export { createPredictionAdapter } from './factory.js';
export type { PredictionAdapterEnvConfig } from './factory.js';

// Errors — import in API route handlers to translate to HTTP status codes
export {
  MissingMmsiError,
  PredictionUnavailableError,
  JamesResponseInvalidError,
} from './errors.js';

// Mapper utilities — exported for unit testing only
// DO NOT import mapJamesRawToMinimal in production code outside this package.
export { heuristicPDelayOver3Days, gaussianPDelayOver3Days } from './mapper.js';
