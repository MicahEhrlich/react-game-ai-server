import test from 'node:test'
import assert from 'node:assert/strict'
import { allowRequest, resetRateLimitsForTests } from '../src/rateLimit.ts'

test('rate limiter allows requests inside the window then blocks', () => {
  resetRateLimitsForTests()
  const rule = { windowMs: 1000, max: 2 }
  assert.equal(allowRequest('k', rule, 0), true)
  assert.equal(allowRequest('k', rule, 1), true)
  assert.equal(allowRequest('k', rule, 2), false)
})

test('rate limiter resets after the window', () => {
  resetRateLimitsForTests()
  const rule = { windowMs: 1000, max: 1 }
  assert.equal(allowRequest('k', rule, 0), true)
  assert.equal(allowRequest('k', rule, 1), false)
  assert.equal(allowRequest('k', rule, 1001), true)
})
