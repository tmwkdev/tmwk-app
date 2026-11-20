import { describe, expect, it } from 'vitest'
import { findTelemetryKeyProblems } from './verify-tmwk-telemetry-key.mjs'

const KEY = 'phc_fakeKeyForTests1234'
const KEY_SHA256 = '770b6ca65a23db63646f3c5309185e37638c6bf9f4f7ca8d2a5d3ead8ffb45f8'

describe('verify-tmwk-telemetry-key', () => {
  it('passes with the matching key', () => {
    expect(findTelemetryKeyProblems(`var k="${KEY}";`, KEY_SHA256)).toEqual([])
  })

  it('fails with any other phc_ key', () => {
    const problems = findTelemetryKeyProblems('var k="phc_someOtherKey98765";', KEY_SHA256)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain("not tmwk's")
    expect(problems[0]).not.toContain('phc_someOtherKey98765')
  })

  it('fails with no key', () => {
    expect(findTelemetryKeyProblems('var k=null;', KEY_SHA256)).toEqual([
      "no PostHog write key baked in; a release must carry tmwk's"
    ])
  })

  it('fails when a second, different key is also present', () => {
    const problems = findTelemetryKeyProblems(
      `var k="${KEY}",o="phc_someOtherKey98765";`,
      KEY_SHA256
    )
    expect(problems).toHaveLength(1)
  })

  it('fails with the Orca diagnostics URL', () => {
    expect(
      findTelemetryKeyProblems(`var k="${KEY}",e="https://orca.dev/diagnostics/token";`, KEY_SHA256)
    ).toEqual(['forbidden endpoint orca.dev/diagnostics is baked in'])
  })
})
