/**
 * Confirmation token — DenkKern Sprint 6B
 *
 * Manages one-time tokens for email-channel outcome confirmation.
 *
 * A token is generated when the outcome notification email is sent and stored
 * in mock/cases/:caseId/confirmation-token.json. The confirmation form page
 * receives the token via URL query param. The confirm-outcome route validates
 * it before accepting an email-channel confirmation.
 *
 * Token lifecycle:
 *   generated → [email sent with link] → validated → used (single-use)
 *
 * Pilot assumptions (Sprint 6B):
 *   - One active token per case at a time (re-sending replaces the old one)
 *   - Tokens expire after 7 days
 *   - File-backed storage (mock adapter); Sprint 10 moves to DB
 *   - No cryptographic signing — UUID randomness is sufficient for pilot
 */

import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConfirmationToken {
  token: string;              // UUID v4
  case_id: string;
  created_at: string;         // ISO 8601
  expires_at: string;         // ISO 8601 — TOKEN_TTL_DAYS after created_at
  used: boolean;
  used_at: string | null;     // ISO 8601 — null until consumed
}

export type TokenValidationResult =
  | { valid: true;  token: ConfirmationToken }
  | { valid: false; reason: 'NOT_FOUND' | 'EXPIRED' | 'ALREADY_USED' };

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TOKEN_TTL_DAYS = 7;

function mockRoot(): string {
  return process.env['MOCK_ROOT'] ?? process.cwd();
}

function tokenPath(caseId: string): string {
  return join(mockRoot(), 'mock', 'cases', caseId, 'confirmation-token.json');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a new token for the given case.
 * Replaces any existing token (re-sending the notification invalidates the old link).
 */
export function generateToken(caseId: string): ConfirmationToken {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  const record: ConfirmationToken = {
    token:      randomUUID(),
    case_id:    caseId,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    used:       false,
    used_at:    null,
  };

  const path = tokenPath(caseId);
  writeFileSync(path, JSON.stringify(record, null, 2), 'utf-8');
  JSON.parse(readFileSync(path, 'utf-8')); // NTFS guard

  console.log(`[DK-6B] Token generated  case=${caseId}  token=${record.token}  expires=${expiresAt.toISOString()}`);
  return record;
}

/**
 * Validate a token for a given case.
 * Does NOT mark it as used — call markTokenUsed() after successful confirmation.
 */
export function validateToken(caseId: string, token: string): TokenValidationResult {
  const path = tokenPath(caseId);

  if (!existsSync(path)) {
    return { valid: false, reason: 'NOT_FOUND' };
  }

  const record = JSON.parse(readFileSync(path, 'utf-8')) as ConfirmationToken;

  if (record.token !== token) {
    return { valid: false, reason: 'NOT_FOUND' };
  }

  if (record.used) {
    return { valid: false, reason: 'ALREADY_USED' };
  }

  if (new Date() > new Date(record.expires_at)) {
    return { valid: false, reason: 'EXPIRED' };
  }

  return { valid: true, token: record };
}

/**
 * Mark a token as used (single-use enforcement).
 * Call immediately after a successful email-channel outcome confirmation.
 */
export function markTokenUsed(caseId: string, token: string): void {
  const path = tokenPath(caseId);

  if (!existsSync(path)) return;

  const record = JSON.parse(readFileSync(path, 'utf-8')) as ConfirmationToken;

  if (record.token !== token) return;

  const updated: ConfirmationToken = {
    ...record,
    used:    true,
    used_at: new Date().toISOString(),
  };

  writeFileSync(path, JSON.stringify(updated, null, 2), 'utf-8');
  JSON.parse(readFileSync(path, 'utf-8')); // NTFS guard

  console.log(`[DK-6B] Token marked used  case=${caseId}  token=${token}`);
}

/**
 * Read the current token record for a case (for display in the form page).
 * Returns null if no token exists.
 */
export function readToken(caseId: string): ConfirmationToken | null {
  const path = tokenPath(caseId);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8')) as ConfirmationToken;
}
