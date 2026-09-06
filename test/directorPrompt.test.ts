import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPlanPayload, PLAN_FORMAT, EPITAPH_FORMAT } from '../server/directorPrompt.ts'

test('director schemas omit constraints rejected by Anthropic structured output', () => {
  for (const format of [PLAN_FORMAT, EPITAPH_FORMAT]) {
    const schema = JSON.stringify(format.schema)
    for (const keyword of ['minimum', 'maximum', 'maxLength', 'minLength', 'minItems', 'maxItems']) {
      assert.equal(schema.includes(`"${keyword}":`), false, keyword)
    }
  }
})

test('completed-stage telemetry keeps its mode when the next stage has already started', () => {
  const payload = JSON.parse(buildPlanPayload({
    kind: 'plan', runId: 'test', forShiftIndex: 2, persona: 0,
    metrics: {
      mode: 'shooter', windowMs: 25000, shotsFired: 20, shotsHit: 5,
      damageTaken: 40, pickups: 0, jumps: 0, avgReactionMs: 500,
      healthFraction: 0.3, msPerMode: { platformer: 0, shooter: 25000, runner: 0, brick: 0 },
    },
    history: { shiftIndex: 1, currentMode: 'runner', modeHistory: ['shooter', 'runner'], chaosLastStage: false },
    stages: [],
  }))
  assert.equal(payload.forbiddenMode, 'runner')
  assert.equal(payload.justPlayed.mode, 'shooter')
  assert.equal(payload.justPlayed.label, 'STARFIGHT')
  assert.equal(payload.justPlayed.accuracyPct, 25)
  assert.equal(payload.justPlayed.healthPct, 30)
  assert.equal(payload.justPlayed.damageTaken, 40)
})
