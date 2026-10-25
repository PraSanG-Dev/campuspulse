/**
 * attendance.ts — Pure attendance math functions.
 *
 * "Pure" means: no React, no network calls, no side effects.
 * Given the same inputs, always returns the same output.
 * This makes them trivial to unit-test.
 *
 * Definitions (important — these match the spec):
 *   conducted = present + absent   (cancelled classes are EXCLUDED)
 *   target    = a number 0–100 (e.g., 75 means 75%)
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AttendanceStats {
  /** Attendance percentage, rounded to 1 decimal. null when conducted === 0. */
  percentage: number | null

  /**
   * How many MORE consecutive classes you must attend to reach the target.
   * 0 if already at or above target.
   * 'not_reachable' if target is 100% but you already have at least one absence.
   */
  needed: number | 'not_reachable'

  /**
   * How many upcoming classes you can skip WITHOUT falling below the target.
   * 0 if you're already below target or exactly at it.
   */
  canMiss: number
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * computeAttendance(present, conducted, targetPct)
 *
 * @param present    Number of classes attended
 * @param conducted  present + absent (NOT including cancelled)
 * @param targetPct  Target percentage, 0–100 (e.g. 75)
 *
 * Math for `needed`:
 *   We want (present + x) / (conducted + x) >= t
 *   Solving for x: x >= (t * conducted - present) / (1 - t)
 *   So needed = ceil of that, clamped to 0.
 *
 * Math for `canMiss`:
 *   We want present / (conducted + x) >= t
 *   Solving for x: x <= present / t - conducted
 *   So canMiss = floor of that, clamped to 0.
 */
export function computeAttendance(
  present: number,
  conducted: number,
  targetPct: number,
): AttendanceStats {
  // Guard: no classes recorded yet — show nothing, never NaN or 0%
  if (conducted === 0) {
    return { percentage: null, needed: 0, canMiss: 0 }
  }

  const t = targetPct / 100
  const percentage = Math.round((present / conducted) * 1000) / 10 // 1 decimal place

  // Special case: 100% target is not reachable once you have any absence
  if (targetPct === 100 && present < conducted) {
    return { percentage, needed: 'not_reachable', canMiss: 0 }
  }

  // Classes needed to reach target
  // Formula: ceil((t * conducted - present) / (1 - t))
  // When t === 1 and present === conducted the formula isn't needed (100% achieved)
  let needed: number | 'not_reachable' = 0
  if (t < 1) {
    const rawNeeded = (t * conducted - present) / (1 - t)
    needed = rawNeeded <= 0 ? 0 : Math.ceil(rawNeeded)
  }

  // Classes safely missable
  // Formula: floor(present / t - conducted)
  const rawCanMiss = present / t - conducted
  const canMiss = rawCanMiss <= 0 ? 0 : Math.floor(rawCanMiss)

  return { percentage, needed, canMiss }
}

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * statusColor — returns a Tailwind text color class based on percentage vs target.
 * Keeps color logic co-located with the math, not scattered in components.
 */
export function attendanceStatusColor(
  percentage: number | null,
  targetPct: number,
): 'text-green-600' | 'text-amber-500' | 'text-red-600' | 'text-gray-400' {
  if (percentage === null) return 'text-gray-400'
  if (percentage >= targetPct)      return 'text-green-600'
  if (percentage >= targetPct - 10) return 'text-amber-500'
  return 'text-red-600'
}

/**
 * attendanceBarColor — Tailwind bg color for the progress bar fill.
 */
export function attendanceBarColor(
  percentage: number | null,
  targetPct: number,
): 'bg-green-500' | 'bg-amber-400' | 'bg-red-400' | 'bg-gray-200' {
  if (percentage === null) return 'bg-gray-200'
  if (percentage >= targetPct)      return 'bg-green-500'
  if (percentage >= targetPct - 10) return 'bg-amber-400'
  return 'bg-red-400'
}
