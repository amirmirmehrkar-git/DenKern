/**
 * WeatherContextAgent — test suite
 *
 * Covers:
 *   - signal_type is always WEATHER_CONTEXT
 *   - severity classification: storm, fog, high_wind, high_swell, visibility_disruption
 *   - engine effect rules
 *   - relevance filtering (port match, route match, region match, no match)
 *   - fixture integration (Hamburg CASE-001 context)
 *   - signal shape passes validator
 *
 * No real APIs. No LLM calls. No Scenario Engine changes.
 */

import { describe, it, expect } from 'vitest';
import { WeatherContextAgent } from '../agents/weather-context.js';
import type { RawWeatherEvent } from '../agents/weather-context.js';
import type { AgentContext } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(override: Partial<AgentContext> = {}): AgentContext {
  return {
    case_id: 'CASE-001',
    shipment_id: 'SHIP-001',
    destination_port: 'Hamburg',
    route: 'North Sea route',
    required_by: '2026-06-10',
    ...override,
  };
}

function makeEvent(override: Partial<RawWeatherEvent> = {}): RawWeatherEvent {
  return {
    event_id: 'TEST-001',
    region: 'North Sea / Hamburg approaches',
    affected_ports: ['Hamburg'],
    routes: [],
    event_type: 'storm',
    description: 'Test storm event',
    reported_at: '2026-05-26T06:00:00Z',
    valid_from: '2026-05-27',
    confidence: 0.85,
    estimated_impact_hours: 24,
    wind_speed_kt: 50,
    wave_height_m: null,
    visibility_nm: null,
    severity_hint: 'high',
    ...override,
  };
}

// ---------------------------------------------------------------------------
// signal_type is always WEATHER_CONTEXT
// ---------------------------------------------------------------------------

describe('WeatherContextAgent — signal_type', () => {
  it('always emits signal_type WEATHER_CONTEXT regardless of event_type', async () => {
    const agent = new WeatherContextAgent([
      makeEvent({ event_type: 'storm' }),
      makeEvent({ event_id: 'TEST-002', event_type: 'fog', wind_speed_kt: null, visibility_nm: 0.2 }),
      makeEvent({ event_id: 'TEST-003', event_type: 'high_swell', wind_speed_kt: null, wave_height_m: 3.0 }),
    ]);
    const signals = await agent.run(makeContext());
    expect(signals.length).toBe(3);
    for (const s of signals) {
      expect(s.signal_type).toBe('WEATHER_CONTEXT');
    }
  });
});

// ---------------------------------------------------------------------------
// Severity classification
// ---------------------------------------------------------------------------

describe('WeatherContextAgent — severity: storm', () => {
  it('CRITICAL when wind >= 64 kt', async () => {
    const agent = new WeatherContextAgent([makeEvent({ wind_speed_kt: 65 })]);
    const [s] = await agent.run(makeContext());
    expect(s?.severity).toBe('CRITICAL');
  });

  it('HIGH when wind 34–63 kt', async () => {
    const agent = new WeatherContextAgent([makeEvent({ wind_speed_kt: 50 })]);
    const [s] = await agent.run(makeContext());
    expect(s?.severity).toBe('HIGH');
  });

  it('MEDIUM when wind > 0 but < 34 kt', async () => {
    const agent = new WeatherContextAgent([makeEvent({ wind_speed_kt: 20 })]);
    const [s] = await agent.run(makeContext());
    expect(s?.severity).toBe('MEDIUM');
  });

  it('falls back to severity_hint when no wind_speed_kt', async () => {
    const agent = new WeatherContextAgent([makeEvent({ wind_speed_kt: null, severity_hint: 'high' })]);
    const [s] = await agent.run(makeContext());
    expect(s?.severity).toBe('HIGH');
  });
});

describe('WeatherContextAgent — severity: fog', () => {
  it('HIGH when visibility <= 0.1 nm', async () => {
    const agent = new WeatherContextAgent([
      makeEvent({ event_type: 'fog', wind_speed_kt: null, visibility_nm: 0.08 }),
    ]);
    const [s] = await agent.run(makeContext());
    expect(s?.severity).toBe('HIGH');
  });

  it('MEDIUM when visibility 0.1–0.3 nm', async () => {
    const agent = new WeatherContextAgent([
      makeEvent({ event_type: 'fog', wind_speed_kt: null, visibility_nm: 0.2 }),
    ]);
    const [s] = await agent.run(makeContext());
    expect(s?.severity).toBe('MEDIUM');
  });

  it('LOW when visibility > 0.3 nm', async () => {
    const agent = new WeatherContextAgent([
      makeEvent({ event_type: 'fog', wind_speed_kt: null, visibility_nm: 0.5 }),
    ]);
    const [s] = await agent.run(makeContext());
    expect(s?.severity).toBe('LOW');
  });
});

describe('WeatherContextAgent — severity: high_wind', () => {
  it('HIGH when wind >= 48 kt', async () => {
    const agent = new WeatherContextAgent([makeEvent({ event_type: 'high_wind', wind_speed_kt: 52 })]);
    const [s] = await agent.run(makeContext());
    expect(s?.severity).toBe('HIGH');
  });

  it('MEDIUM when wind 34–47 kt', async () => {
    const agent = new WeatherContextAgent([makeEvent({ event_type: 'high_wind', wind_speed_kt: 38 })]);
    const [s] = await agent.run(makeContext());
    expect(s?.severity).toBe('MEDIUM');
  });
});

describe('WeatherContextAgent — severity: high_swell', () => {
  it('HIGH when wave >= 4.0 m', async () => {
    const agent = new WeatherContextAgent([
      makeEvent({ event_type: 'high_swell', wind_speed_kt: null, wave_height_m: 4.5 }),
    ]);
    const [s] = await agent.run(makeContext());
    expect(s?.severity).toBe('HIGH');
  });

  it('MEDIUM when wave 2.5–3.9 m', async () => {
    const agent = new WeatherContextAgent([
      makeEvent({ event_type: 'high_swell', wind_speed_kt: null, wave_height_m: 3.0 }),
    ]);
    const [s] = await agent.run(makeContext());
    expect(s?.severity).toBe('MEDIUM');
  });

  it('LOW when wave < 2.5 m', async () => {
    const agent = new WeatherContextAgent([
      makeEvent({ event_type: 'high_swell', wind_speed_kt: null, wave_height_m: 2.0 }),
    ]);
    const [s] = await agent.run(makeContext());
    expect(s?.severity).toBe('LOW');
  });
});

// ---------------------------------------------------------------------------
// Engine effect rules
// ---------------------------------------------------------------------------

describe('WeatherContextAgent — recommended_engine_effect', () => {
  it('flag_second_approval for CRITICAL severity', async () => {
    const agent = new WeatherContextAgent([makeEvent({ wind_speed_kt: 65 })]);
    const [s] = await agent.run(makeContext());
    expect(s?.recommended_engine_effect).toBe('flag_second_approval');
  });

  it('increase_wait_risk for HIGH storm', async () => {
    const agent = new WeatherContextAgent([makeEvent({ wind_speed_kt: 50 })]);
    const [s] = await agent.run(makeContext());
    expect(s?.recommended_engine_effect).toBe('increase_wait_risk');
  });

  it('increase_wait_risk for MEDIUM storm', async () => {
    const agent = new WeatherContextAgent([makeEvent({ wind_speed_kt: 20 })]);
    const [s] = await agent.run(makeContext());
    expect(s?.recommended_engine_effect).toBe('increase_wait_risk');
  });

  it('increase_urgency for LOW fog', async () => {
    const agent = new WeatherContextAgent([
      makeEvent({ event_type: 'fog', wind_speed_kt: null, visibility_nm: 0.5 }),
    ]);
    const [s] = await agent.run(makeContext());
    expect(s?.recommended_engine_effect).toBe('increase_urgency');
  });
});

// ---------------------------------------------------------------------------
// Relevance filtering
// ---------------------------------------------------------------------------

describe('WeatherContextAgent — relevance filtering', () => {
  it('includes event when affected_ports contains destination_port', async () => {
    const agent = new WeatherContextAgent([makeEvent({ affected_ports: ['Hamburg'] })]);
    const signals = await agent.run(makeContext({ destination_port: 'Hamburg' }));
    expect(signals).toHaveLength(1);
  });

  it('excludes event when affected_ports does not match destination and no route match', async () => {
    const agent = new WeatherContextAgent([
      makeEvent({ affected_ports: ['Rotterdam'], routes: [] }),
    ]);
    const signals = await agent.run(makeContext({ destination_port: 'Hamburg', route: 'Baltic route' }));
    expect(signals).toHaveLength(0);
  });

  it('includes event via route match when affected_ports is empty', async () => {
    const agent = new WeatherContextAgent([
      makeEvent({ affected_ports: [], routes: ['North Sea route'] }),
    ]);
    const signals = await agent.run(makeContext({ destination_port: 'Hamburg', route: 'North Sea route' }));
    expect(signals).toHaveLength(1);
  });

  it('includes event via region substring match on destination port', async () => {
    const agent = new WeatherContextAgent([
      makeEvent({ affected_ports: [], routes: [], region: 'Hamburg outer roads' }),
    ]);
    const signals = await agent.run(makeContext({ destination_port: 'Hamburg' }));
    expect(signals).toHaveLength(1);
  });

  it('returns empty array when no events match context', async () => {
    const agent = new WeatherContextAgent([
      makeEvent({ affected_ports: ['Rotterdam'], routes: ['Rhine delta'] }),
    ]);
    const signals = await agent.run(makeContext({ destination_port: 'Gdansk', route: 'Baltic route' }));
    expect(signals).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Signal shape
// ---------------------------------------------------------------------------

describe('WeatherContextAgent — signal shape', () => {
  it('produces a signal with all required fields present', async () => {
    const agent = new WeatherContextAgent([makeEvent()]);
    const [s] = await agent.run(makeContext());

    expect(s).toBeDefined();
    expect(typeof s?.signal_id).toBe('string');
    expect(s?.signal_id.startsWith('WX-')).toBe(true);
    expect(s?.signal_type).toBe('WEATHER_CONTEXT');
    expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(s?.severity);
    expect(typeof s?.confidence).toBe('number');
    expect(s?.confidence).toBeGreaterThan(0);
    expect(s?.source_type).toBe('simulated');
    expect(typeof s?.description).toBe('string');
    expect(typeof s?.decision_relevance).toBe('string');
    expect(typeof s?.time_window?.valid_from).toBe('string');
    expect(['increase_wait_risk', 'increase_urgency', 'flag_second_approval', 'none']).toContain(
      s?.recommended_engine_effect
    );
  });

  it('sets estimated_additional_delay_days when estimated_impact_hours present', async () => {
    const agent = new WeatherContextAgent([makeEvent({ estimated_impact_hours: 36 })]);
    const [s] = await agent.run(makeContext());
    expect(s?.estimated_additional_delay_days).toBe(2); // ceil(36/24)
  });

  it('omits estimated_additional_delay_days when not provided', async () => {
    const agent = new WeatherContextAgent([
      makeEvent({ event_id: 'TEST-NO-HOURS' })  // no estimated_impact_hours key,
    ]);
    const [s] = await agent.run(makeContext());
    expect(s?.estimated_additional_delay_days).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Fixture integration — Hamburg / CASE-001
// ---------------------------------------------------------------------------

describe('WeatherContextAgent — fixture integration (Hamburg / CASE-001)', () => {
  it('returns at least 4 signals for Hamburg + North Sea route context', async () => {
    const agent = new WeatherContextAgent(); // default fixture
    const signals = await agent.run(makeContext());
    expect(signals.length).toBeGreaterThanOrEqual(4);
  });

  it('all fixture signals have signal_type WEATHER_CONTEXT', async () => {
    const agent = new WeatherContextAgent();
    const signals = await agent.run(makeContext());
    for (const s of signals) {
      expect(s.signal_type).toBe('WEATHER_CONTEXT');
    }
  });

  it('at least one HIGH or CRITICAL signal for Hamburg storm events', async () => {
    const agent = new WeatherContextAgent();
    const signals = await agent.run(makeContext());
    const severe = signals.filter((s) => s.severity === 'HIGH' || s.severity === 'CRITICAL');
    expect(severe.length).toBeGreaterThanOrEqual(1);
  });

  it('returns 0 signals for an unrelated port with no route match', async () => {
    const agent = new WeatherContextAgent();
    const signals = await agent.run(
      makeContext({ destination_port: 'Shanghai', route: 'Pacific route' })
    );
    expect(signals).toHaveLength(0);
  });
});
