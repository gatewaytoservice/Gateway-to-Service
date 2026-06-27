// src/utils/rotationV2.js
// Scheduling System V2
//
// Main idea:
// - Cadence is a schedule rule, not a cooldown rule.
// - nextInviteDate is the source of truth for "who is due".
// - nextInviteDate ONLY advances when a volunteer is confirmed.
//
// What this file handles:
// 1) validate cadence + monthly pattern values
// 2) determine if a volunteer is due this week
// 3) sort volunteers by scheduling priority
// 4) calculate the nextInviteDate after a confirmation
// 5) auto-build a weekly list from scheduled volunteers only

// app/src/utils/rotationV2.js
//
// Scheduling System V2 (Friday-anchored)
//
// ✅ Core concept:
// - nextInviteDate is the SOURCE OF TRUTH (YYYY-MM-DD).
// - A volunteer is "due" for an upcoming Friday if: nextInviteDate <= fridayISO
// - This file does NOT decide whether you actually invited them; it only answers:
//   "who is due by Friday?" and "what is the next scheduled Friday after confirmation?"
//
// ✅ New additions in this version:
// - Public helper(s) to compute Snooze dates without changing the V2 model.
//   Snooze means: "They were due (or we considered them), but we didn't invite them
//   / we want to push them out to a later Friday so they don't keep showing up as due."
//
// IMPORTANT:
// - RotationV2 is still anchored on FRIDAY (not Monday).
// - If the app wants to "roll over" someone who wasn't invited, it should SET a Snoozed
//   nextInviteDate to a future Friday (ex: +1 week). This prevents them from being stuck as "due"
//   every time you build a week.
//
// --------------------------------------------------
// Core roles (used for sorting / pinned logic)
// --------------------------------------------------

const CORE_ROLES = new Set([
  "Chairperson",
  "Alt Chairperson",
  "List Coordinator",
  "Meeting Steward",
  "Discussion Group Lead",
  "Alt Discussion Lead",
  "Big Book Lead",
  "Alt Big Book Lead",
]);

export function isCoreRole(role) {
  return CORE_ROLES.has(role || "");
}

// Backward-friendly export name if you still want this in V2 code.
// In Scheduling System V2, pinned/core handling should usually happen
// in CoordinatorPageV2 when building required roles first.
export function isCoreRoleNoCooldown(role) {
  return isCoreRole(role);
}

// --------------------------------------------------
// Cadence + pattern definitions
// --------------------------------------------------

export const INVITE_CADENCES = [
  { key: "weekly", label: "Weekly" },
  { key: "biweekly", label: "Biweekly" },
  { key: "monthly", label: "Monthly" },
  { key: "quarterly", label: "Quarterly" },
  { key: "yearly", label: "Yearly" },
  { key: "monthly_pattern", label: "Monthly Pattern" },
];

export const MONTHLY_PATTERN_OPTIONS = [
  { key: "first_friday", label: "1st Friday" },
  { key: "second_friday", label: "2nd Friday" },
  { key: "third_friday", label: "3rd Friday" },
  { key: "fourth_friday", label: "4th Friday" },
  { key: "last_friday", label: "Last Friday" },
];

// ✅ Backfill anchor for this cadence cleanup pass.
// This does NOT force the app to always use this date.
// It gives CoordinatorPageV2 / VolunteersPageV2 a stable fallback when older data
// has no last response / last invite date to anchor from.
export const CADENCE_BACKFILL_ANCHOR_ISO = "2026-06-26";

// --------------------------------------------------
// ISO date helpers (YYYY-MM-DD only)
// --------------------------------------------------

export function normalizeISODate(isoOrTs) {
  if (!isoOrTs) return null;
  const s = String(isoOrTs).trim();
  if (!s) return null;
  return s.length >= 10 ? s.slice(0, 10) : null;
}

function isoToDate(iso) {
  const dateOnly = normalizeISODate(iso);
  if (!dateOnly) return null;

  const [y, m, d] = dateOnly.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dateToISO(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDaysISO(iso, days) {
  const dt = isoToDate(iso);
  if (!dt) return null;
  dt.setDate(dt.getDate() + Number(days || 0));
  return dateToISO(dt);
}

// ✅ NEW (public): addWeeks helper (small convenience)
export function addWeeksISO(iso, weeks) {
  return addDaysISO(iso, Number(weeks || 0) * 7);
}

function addMonthsToYearMonth(year, monthIndex, monthsToAdd) {
  const total = year * 12 + monthIndex + Number(monthsToAdd || 0);
  const nextYear = Math.floor(total / 12);
  const nextMonthIndex = total % 12;
  return { year: nextYear, monthIndex: nextMonthIndex };
}

// --------------------------------------------------
// Cadence + pattern validation
// --------------------------------------------------

export function getCadenceKey(v, defaultKey = "monthly") {
  const key = (v?.inviteCadence || "").toLowerCase().trim();
  if (!key) return defaultKey;
  if (INVITE_CADENCES.some((c) => c.key === key)) return key;
  return defaultKey;
}

export function getMonthlyPatternKey(v) {
  const key = (v?.monthlyPattern || "").toLowerCase().trim();
  if (!key) return null;
  if (MONTHLY_PATTERN_OPTIONS.some((p) => p.key === key)) return key;
  return null;
}

// --------------------------------------------------
// Friday helpers (month calculations)
// --------------------------------------------------

function getFridaysInMonth(year, monthIndex) {
  const out = [];
  const dt = new Date(year, monthIndex, 1);

  while (dt.getMonth() === monthIndex) {
    if (dt.getDay() === 5) {
      out.push(dateToISO(dt));
    }
    dt.setDate(dt.getDate() + 1);
  }

  return out;
}

function getFridayOccurrenceIndex(iso) {
  const dt = isoToDate(iso);
  if (!dt) return null;
  if (dt.getDay() !== 5) return null;

  const fridays = getFridaysInMonth(dt.getFullYear(), dt.getMonth());
  const idx = fridays.indexOf(normalizeISODate(iso));
  if (idx === -1) return null;

  return idx + 1; // 1-based
}

function getFridayByOccurrenceIndex(year, monthIndex, occurrenceIndex) {
  const fridays = getFridaysInMonth(year, monthIndex);
  if (!fridays.length) return null;

  const idx = Math.max(1, Number(occurrenceIndex || 1));

  // If a month has fewer Fridays than the source month (ex: 5th Friday),
  // fall back to the last Friday available.
  return fridays[Math.min(idx, fridays.length) - 1];
}

function getFridayByMonthlyPattern(year, monthIndex, patternKey) {
  const fridays = getFridaysInMonth(year, monthIndex);
  if (!fridays.length) return null;

  switch (patternKey) {
    case "first_friday":
      return fridays[0] || null;
    case "second_friday":
      return fridays[1] || fridays[fridays.length - 1] || null;
    case "third_friday":
      return fridays[2] || fridays[fridays.length - 1] || null;
    case "fourth_friday":
      return fridays[3] || fridays[fridays.length - 1] || null;
    case "last_friday":
      return fridays[fridays.length - 1] || null;
    default:
      return null;
  }
}

// --------------------------------------------------
// Scheduling helpers
// --------------------------------------------------

export function getNextInviteDateISO(v) {
  return normalizeISODate(v?.nextInviteDate);
}

/**
 * Scheduling System V2:
 * A volunteer is due if:
 * - they have a nextInviteDate
 * - and nextInviteDate <= fridayISO
 *
 * No last-touch cooldown math here.
 */
export function isVolunteerDueThisWeek(v, fridayISO) {
  const dueISO = getNextInviteDateISO(v);
  const friday = normalizeISODate(fridayISO);

  if (!dueISO || !friday) return false;
  return friday >= dueISO;
}

// Backward-friendly name so CoordinatorPageV2 can swap more easily later.
export function isEligibleThisWeek(v, fridayISO) {
  return isVolunteerDueThisWeek(v, fridayISO);
}

// Backward-friendly export name.
// In V2 this just returns the scheduled due date, not a cooldown-derived date.
export function getEligibleISO(v) {
  return getNextInviteDateISO(v);
}

/**
 * Uses current nextInviteDate as the base schedule anchor.
 * If nextInviteDate is missing, fall back to the confirmed Friday.
 *
 * IMPORTANT:
 * - This helper is kept for existing Confirmed behavior.
 * - New response-based behavior should use getNextInviteDateAfterActivity().
 */
export function getNextInviteDateAfterConfirm(v, confirmedFridayISO) {
  const cadence = getCadenceKey(v, "monthly");
  const monthlyPattern = getMonthlyPatternKey(v);
  const baseISO = getNextInviteDateISO(v) || normalizeISODate(confirmedFridayISO);

  if (!baseISO) return null;

  if (cadence === "weekly") {
    return addDaysISO(baseISO, 7);
  }

  if (cadence === "biweekly") {
    return addDaysISO(baseISO, 14);
  }

  const baseDate = isoToDate(baseISO);
  if (!baseDate) return null;

  const baseYear = baseDate.getFullYear();
  const baseMonthIndex = baseDate.getMonth();

  // Monthly Pattern = use explicit named Friday rule
  if (cadence === "monthly_pattern") {
    const pattern = monthlyPattern || "third_friday";
    const target = addMonthsToYearMonth(baseYear, baseMonthIndex, 1);
    return getFridayByMonthlyPattern(target.year, target.monthIndex, pattern);
  }

  // Standard monthly / quarterly / yearly preserve Friday occurrence index
  const occurrenceIndex = getFridayOccurrenceIndex(baseISO) || 1;

  if (cadence === "monthly") {
    const target = addMonthsToYearMonth(baseYear, baseMonthIndex, 1);
    return getFridayByOccurrenceIndex(target.year, target.monthIndex, occurrenceIndex);
  }

  if (cadence === "quarterly") {
    const target = addMonthsToYearMonth(baseYear, baseMonthIndex, 3);
    return getFridayByOccurrenceIndex(target.year, target.monthIndex, occurrenceIndex);
  }

  if (cadence === "yearly") {
    const target = addMonthsToYearMonth(baseYear, baseMonthIndex, 12);
    return getFridayByOccurrenceIndex(target.year, target.monthIndex, occurrenceIndex);
  }

  // Safe fallback
  const fallbackTarget = addMonthsToYearMonth(baseYear, baseMonthIndex, 1);
  return getFridayByOccurrenceIndex(fallbackTarget.year, fallbackTarget.monthIndex, occurrenceIndex);
}

/**
 * ✅ NEW:
 * Calculate the next invite date from a specific Friday activity anchor.
 *
 * Use this for:
 * - Confirmed
 * - Declined / No
 * - No Response
 *
 * Why this exists:
 * getNextInviteDateAfterConfirm() uses the current nextInviteDate first.
 * That is useful for existing scheduling, but if nextInviteDate is old/stale,
 * a response on June 26, 2026 could accidentally advance from the old date.
 *
 * This helper forces the cadence calculation to anchor from the Friday being worked.
 */
export function getNextInviteDateAfterActivity(v, activityFridayISO) {
  const activityISO = normalizeISODate(activityFridayISO);
  if (!activityISO) return null;

  return getNextInviteDateAfterConfirm(
    {
      ...v,
      nextInviteDate: activityISO,
    },
    activityISO
  );
}

/**
 * ✅ NEW:
 * Returns the latest known response/invite activity date.
 *
 * This is useful for backfilling older volunteers when nextInviteDate needs to be
 * recalculated according to the volunteer's cadence.
 */
export function getLatestResponseOrInviteISO(v) {
  const candidates = [
    normalizeISODate(v?.lastConfirmedDate),
    normalizeISODate(v?.lastDeclinedDate),
    normalizeISODate(v?.lastInvitedAt),
  ].filter(Boolean);

  if (!candidates.length) return null;
  candidates.sort(); // ISO strings sort oldest -> newest
  return candidates[candidates.length - 1];
}

/**
 * ✅ NEW:
 * Pick the date we should use to recalculate a volunteer's schedule.
 *
 * Priority:
 * 1) latest response or invite date
 * 2) fallback date, defaulting to 2026-06-26 for this cleanup pass
 */
export function getCadenceBackfillAnchorISO(v, fallbackISO = CADENCE_BACKFILL_ANCHOR_ISO) {
  return getLatestResponseOrInviteISO(v) || normalizeISODate(fallbackISO);
}

/**
 * ✅ NEW:
 * Calculate nextInviteDate from the volunteer's latest response/invite date.
 *
 * If the volunteer has no last response/invite date, it uses the fallback date.
 * Default fallback is June 26, 2026.
 */
export function getNextInviteDateFromLastResponseOrInvite(
  v,
  fallbackISO = CADENCE_BACKFILL_ANCHOR_ISO
) {
  const anchorISO = getCadenceBackfillAnchorISO(v, fallbackISO);
  if (!anchorISO) return null;

  return getNextInviteDateAfterActivity(v, anchorISO);
}

// --------------------------------------------------
// ✅ NEW: Snooze helpers (V2-friendly rollover control)
// --------------------------------------------------

/**
 * Snooze concept:
 * - If someone is due (nextInviteDate <= fridayISO) but we did NOT invite them,
 *   they'll remain due forever unless we move nextInviteDate forward.
 *
 * These helpers return a NEW date value. They do NOT mutate state by themselves.
 * CoordinatorPageV2 should decide when to apply these.
 */

/**
 * Standard snooze: push nextInviteDate out by N weeks from the CURRENT fridayISO.
 * Example: snoozeWeeks=1 => nextInviteDate becomes next Friday.
 */
export function getSnoozedNextInviteDateISO(fridayISO, snoozeWeeks = 1) {
  const base = normalizeISODate(fridayISO);
  if (!base) return null;
  return addWeeksISO(base, snoozeWeeks);
}

/**
 * ✅ NEW:
 * Clearer helper for the exact rule:
 * - If a volunteer was due but was not invited this week,
 *   move their nextInviteDate to the next Friday.
 */
export function getNextInviteDateAfterNotInvited(fridayISO) {
  return getSnoozedNextInviteDateISO(fridayISO, 1);
}

/**
 * "No Response" snooze rule.
 *
 * Kept for backward compatibility.
 *
 * New cadence-based No Response behavior should use:
 * getNextInviteDateAfterActivity(v, fridayISO)
 *
 * Default remains 2 weeks so older code using this helper will not break.
 */
export function getNoResponseNextInviteDateISO(fridayISO, snoozeWeeks = 2) {
  return getSnoozedNextInviteDateISO(fridayISO, snoozeWeeks);
}

/**
 * Utility: pick the earliest known activity date on a volunteer (YYYY-MM-DD),
 * useful for backfilling createdAt / reasoning about anchors.
 */
export function getEarliestKnownActivityISO(v) {
  const candidates = [
    normalizeISODate(v?.createdAt),
    normalizeISODate(v?.lastConfirmedDate),
    normalizeISODate(v?.lastInvitedAt),
    normalizeISODate(v?.lastDeclinedDate),
    normalizeISODate(v?.nextInviteDate),
  ].filter(Boolean);

  if (!candidates.length) return null;
  candidates.sort(); // ISO strings sort lexicographically
  return candidates[0];
}

// --------------------------------------------------
// Sorting
// --------------------------------------------------

/**
 * Scheduling priority:
 * 1) active volunteers only (optional)
 * 2) excludeIds removed
 * 3) due volunteers first
 * 4) earlier nextInviteDate first
 * 5) name tie-break
 *
 * NOTE:
 * - Volunteers with no nextInviteDate are sorted last.
 * - This is intentionally simpler than cooldown rotation.
 */
export function sortInviteCandidates(volunteers, fridayISO, opts = {}) {
  const { excludeIds = new Set(), onlyActive = true } = opts;

  const excludeSet =
    excludeIds instanceof Set ? excludeIds : new Set(Array.from(excludeIds || []));

  const list = (volunteers || [])
    .filter((v) => (onlyActive ? !!v?.active : true))
    .filter((v) => !!v?.id && !excludeSet.has(v.id))
    .map((v) => {
      const nextInviteDate = getNextInviteDateISO(v);
      const dueNow = isVolunteerDueThisWeek(v, fridayISO);
      const sortDate = nextInviteDate || "9999-12-31";

      return {
        v,
        nextInviteDate,
        dueNow,
        sortDate,
      };
    });

  list.sort((a, b) => {
    // 1) Due first
    if (a.dueNow !== b.dueNow) return a.dueNow ? -1 : 1;

    // 2) Earlier scheduled date first
    if (a.sortDate !== b.sortDate) return a.sortDate.localeCompare(b.sortDate);

    // 3) Name
    return (a.v?.name || "").localeCompare(b.v?.name || "");
  });

  return list;
}

// --------------------------------------------------
// Auto-build weekly invite list
// --------------------------------------------------

/**
 * Auto-build rules for Scheduling System V2:
 * - Include pinned roles first if present + active
 * - Then include volunteers who are due this week
 * - DO NOT auto-fill with not-due volunteers
 *
 * Why:
 * - This keeps the new system trustworthy.
 * - Manual add can still be used for exceptions.
 */
export function buildAutoWeekInviteIds(volunteers, fridayISO, opts = {}) {
  const {
    targetCount = 12,
    pinnedRoles = [
      "Chairperson",
      "List Coordinator",
      "Meeting Steward",
      "Discussion Group Lead",
      "Big Book Lead",
    ],
  } = opts;

  const active = (volunteers || []).filter((v) => !!v?.active);

  const picked = [];
  const pickedSet = new Set();

  function pick(v) {
    if (!v || !v.id) return;
    if (pickedSet.has(v.id)) return;
    picked.push(v.id);
    pickedSet.add(v.id);
  }

  // 1) Pinned roles first
  for (const role of pinnedRoles) {
    const person = active.find((v) => (v.coreRole || "Volunteer") === role);
    if (person) pick(person);
  }

  // 2) Due volunteers only
  const dueCandidates = sortInviteCandidates(active, fridayISO, {
    excludeIds: pickedSet,
    onlyActive: true,
  }).filter((row) => row.dueNow);

  for (const row of dueCandidates) {
    if (picked.length >= targetCount) break;
    pick(row.v);
  }

  return picked.slice(0, targetCount);
}

// --------------------------------------------------
// Optional convenience helpers
// --------------------------------------------------

export function getScheduleSummary(v) {
  return {
    cadence: getCadenceKey(v, "monthly"),
    monthlyPattern: getMonthlyPatternKey(v),
    nextInviteDate: getNextInviteDateISO(v),
  };
}

export function inferMonthlyPatternFromDate(iso) {
  const occurrence = getFridayOccurrenceIndex(iso);
  if (!occurrence) return null;

  const dt = isoToDate(iso);
  if (!dt) return null;

  const fridays = getFridaysInMonth(dt.getFullYear(), dt.getMonth());
  const isLast = fridays[fridays.length - 1] === normalizeISODate(iso);

  // For explicit monthly pattern inference:
  // if the date is the last Friday, treat it as last_friday
  // otherwise use 1st/2nd/3rd/4th
  if (isLast) return "last_friday";
  if (occurrence === 1) return "first_friday";
  if (occurrence === 2) return "second_friday";
  if (occurrence === 3) return "third_friday";
  if (occurrence === 4) return "fourth_friday";

  // Rare case: 5th Friday that is also last Friday would already return above.
  return "last_friday";
}