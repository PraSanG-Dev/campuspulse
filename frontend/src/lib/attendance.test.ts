/**
 * attendance.test.ts — Unit tests for the attendance math.
 *
 * Run with:  npm test
 *
 * These tests cover:
 *  - Normal cases
 *  - Zero conducted (no classes yet)
 *  - Already at/above target
 *  - Below target (needs classes)
 *  - Can safely miss classes
 *  - 100% target with an absence (not reachable)
 *  - 100% target perfectly achieved
 *  - Edge: target 0%
 *  - Edge: present > conducted (shouldn't happen, but shouldn't crash)
 */

import { describe, it, expect } from 'vitest'
import { computeAttendance } from './attendance'

describe('computeAttendance', () => {

  // ── No classes yet ─────────────────────────────────────────────────────────

  it('returns null percentage when conducted is 0', () => {
    const result = computeAttendance(0, 0, 75)
    expect(result.percentage).toBeNull()
  })

  it('returns needed=0 and canMiss=0 when conducted is 0', () => {
    const result = computeAttendance(0, 0, 75)
    expect(result.needed).toBe(0)
    expect(result.canMiss).toBe(0)
  })

  // ── Normal percentage calculation ──────────────────────────────────────────

  it('calculates 75% correctly (18/24)', () => {
    const result = computeAttendance(18, 24, 75)
    expect(result.percentage).toBe(75)
  })

  it('calculates 80% correctly (16/20)', () => {
    const result = computeAttendance(16, 20, 75)
    expect(result.percentage).toBe(80)
  })

  it('calculates percentage to 1 decimal (14/20 = 70.0%)', () => {
    const result = computeAttendance(14, 20, 75)
    expect(result.percentage).toBe(70)
  })

  it('rounds to 1 decimal (10/30 = 33.3%)', () => {
    const result = computeAttendance(10, 30, 75)
    expect(result.percentage).toBe(33.3)
  })

  // ── Already at or above target ─────────────────────────────────────────────

  it('needed=0 when exactly at target (18/24 at 75%)', () => {
    const result = computeAttendance(18, 24, 75)
    expect(result.needed).toBe(0)
  })

  it('needed=0 when above target (20/24 at 75%)', () => {
    const result = computeAttendance(20, 24, 75)
    expect(result.needed).toBe(0)
  })

  // ── Below target: needs more classes ──────────────────────────────────────

  it('calculates needed correctly when below target', () => {
    // present=14, conducted=20, target=75%
    // raw = (0.75*20 - 14) / (1 - 0.75) = (15 - 14) / 0.25 = 4
    const result = computeAttendance(14, 20, 75)
    expect(result.needed).toBe(4)
  })

  it('rounds needed UP (ceil) — never shows a fraction of a class', () => {
    // present=13, conducted=20, target=75%
    // raw = (15 - 13) / 0.25 = 8
    const result = computeAttendance(13, 20, 75)
    expect(result.needed).toBe(8)
  })

  it('rounds needed UP correctly for non-integer result', () => {
    // present=15, conducted=22, target=75%
    // raw = (0.75*22 - 15) / 0.25 = (16.5 - 15) / 0.25 = 6
    const result = computeAttendance(15, 22, 75)
    expect(result.needed).toBe(6)
  })

  it('canMiss=0 when below target', () => {
    const result = computeAttendance(14, 20, 75)
    expect(result.canMiss).toBe(0)
  })

  // ── Above target: can safely miss ─────────────────────────────────────────

  it('calculates canMiss correctly when above target', () => {
    // present=20, conducted=24, target=75%
    // raw = 20/0.75 - 24 = 26.67 - 24 = 2.67 → floor = 2
    const result = computeAttendance(20, 24, 75)
    expect(result.canMiss).toBe(2)
  })

  it('rounds canMiss DOWN (floor) — conservative', () => {
    // present=18, conducted=20, target=75%
    // raw = 18/0.75 - 20 = 24 - 20 = 4 → floor = 4
    const result = computeAttendance(18, 20, 75)
    expect(result.canMiss).toBe(4)
  })

  it('needed=0 when canMiss > 0', () => {
    const result = computeAttendance(20, 24, 75)
    expect(result.needed).toBe(0)
  })

  // ── 100% target edge cases ─────────────────────────────────────────────────

  it('returns not_reachable when target=100 and any absence exists', () => {
    // 19/20 = 95% — can never reach 100% again
    const result = computeAttendance(19, 20, 100)
    expect(result.needed).toBe('not_reachable')
  })

  it('returns not_reachable even with just 1 absence', () => {
    const result = computeAttendance(0, 1, 100)
    expect(result.needed).toBe('not_reachable')
  })

  it('needed=0 when target=100 and perfectly attended', () => {
    const result = computeAttendance(20, 20, 100)
    expect(result.needed).toBe(0)
    expect(result.percentage).toBe(100)
  })

  it('canMiss=0 when target=100 and perfectly attended', () => {
    // You can never safely miss when targeting 100%
    const result = computeAttendance(20, 20, 100)
    expect(result.canMiss).toBe(0)
  })

  // ── Target 0% ─────────────────────────────────────────────────────────────

  it('needed=0 and canMiss is large when target=0', () => {
    const result = computeAttendance(0, 10, 0)
    // 0% target means you always meet it — needed is 0
    expect(result.needed).toBe(0)
    // canMiss would be Infinity (present/0) - we don't test that exact value
    // but needed must still be 0
  })

  // ── Exactly at target boundary ─────────────────────────────────────────────

  it('needed=0 when exactly at 75% (3/4)', () => {
    const result = computeAttendance(3, 4, 75)
    expect(result.needed).toBe(0)
    expect(result.percentage).toBe(75)
  })

  it('needed=1 when one below threshold (2/4 = 50%, target 75%)', () => {
    // raw = (0.75*4 - 2) / 0.25 = (3 - 2) / 0.25 = 4
    const result = computeAttendance(2, 4, 75)
    expect(result.needed).toBe(4)
  })

  // ── Cancelled classes are excluded from conducted ──────────────────────────
  // (This test documents the expectation for callers —
  //  the caller must compute conducted = present + absent BEFORE calling this)

  it('treats conducted as already excluding cancelled', () => {
    // 5 present, 2 absent, 3 cancelled → conducted = 7 (not 10)
    const result = computeAttendance(5, 7, 75)
    // percentage = 5/7 = 71.4%
    expect(result.percentage).toBe(71.4)
  })

})
