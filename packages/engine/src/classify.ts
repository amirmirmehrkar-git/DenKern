/**
 * Classification helpers — DenkKern scenario engine
 *
 * Pure functions. No side effects. No imports from external layers.
 * Source of truth: docs/architecture/03-scenario-engine.md §4.2, §4.5
 */

import type { ConfidenceTier, RiskLevel, ScenarioConfig } from '@denkkern/types';

/**
 * Classify a confidence score (0.0–1.0) into a tier.
 *
 * HIGH   ≥ 0.75  → +0.0 wait modifier increment
 * MEDIUM ≥ 0.50  → +0.1 wait modifier increment
 * LOW    < 0.50  → +0.2 wait modifier increment
 *
 * Thresholds are read from ScenarioConfig so they are version-tracked.
 */
export function classifyConfidenceTier(
  confidence_score: number,
  config: ScenarioConfig
): ConfidenceTier {
  if (confidence_score >= config.confidence_tiers.HIGH.min_score) return 'HIGH';
  if (confidence_score >= config.confidence_tiers.MEDIUM.min_score) return 'MEDIUM';
  return 'LOW';
}

/**
 * Classify delay days into a risk level.
 *
 * 0–LOW_max_days       → LOW
 * LOW_max_days+1 to MEDIUM_max_days → MEDIUM
 * > MEDIUM_max_days    → HIGH
 */
export function classifyRiskLevel(
  delay_days: number,
  config: ScenarioConfig
): RiskLevel {
  if (delay_days <= config.risk_level_thresholds.LOW_max_days) return 'LOW';
  if (delay_days <= config.risk_level_thresholds.MEDIUM_max_days) return 'MEDIUM';
  return 'HIGH';
}

/**
 * Return the confidence increment for the WAIT modifier only.
 * REROUTE and REPLACE always get 0.
 */
export function getConfidenceIncrement(
  tier: ConfidenceTier,
  isWait: boolean,
  config: ScenarioConfig
): number {
  if (!isWait) return 0;
  return config.confidence_tiers[tier].wait_modifier_increment;
}

/**
 * Format a EUR value for label strings.
 * e.g. 975000 → "€975,000"
 */
export function formatEur(value: number): string {
  return `€${value.toLocaleString('en-US')}`;
}

/**
 * Calculate days between two ISO date strings.
 * Returns positive if end > start, 0 if equal, negative if end < start.
 */
export function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}
