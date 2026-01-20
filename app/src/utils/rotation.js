// src/utils/rotation.js
// Option 2: Cadence + Rotation ordering (pure helpers)
//
// ✅ Cadence eligibility is based on the most recent "touch":
//    lastInvitedAt OR lastConfirmedDate OR lastDeclinedDate (whichever is later)
//
// Why:
// - We want Invited + Confirmed + Declined to all “count” as activity.
// - No separate “cooldown weeks” needed — cadence is the cooldown.

const CORE_ROLES_NO_COOLDOWN = new Set([
  "Chairperson",
  "Alt Chairperson",
  "List Coordinator",
  "Meeting Steward",
  "Discussion Group Lead",
  "Alt Discussion Lead",
  "Big Book Lead",
  "Alt Big Book Lead",
]);

export const INVITE_CADENCES = [
  { key: "weekly", label: "Weekly", cooldownDays: 0 },
  { key: "biweekly", label: "Biweekly", cooldownDays: 7 },
  { key: "monthly", label: "Monthly", cooldownDays: 21 },
  { key: "quarterly", label: "Quarterly", cooldownDays: 90 },
  { key: "yearly", label: "Yearly", cooldownDays: 364 },
];

// ---- Date helpers (work with YYYY-MM-DD) ----
function isoToDate(iso) {
  const dateOnly = normalizeISODate(iso);
  if (!dateOnly) return null;
  const [y, m, d] = dateOnly.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dateToISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDaysISO(iso, days) {
  const dt = isoToDate(iso);
  if (!dt) return null;
  dt.setDate(dt.getDate() + days);
  return dateToISO(dt);
}

// If you store timestamps (2025-12-30T...), this trims to date-only.
export function normalizeISODate(isoOrTs) {
  if (!isoOrTs) return null;
  const s = String(isoOrTs).trim();
  if (!s) return null;
  return s.length >= 10 ? s.slice(0, 10) : null;
}

function maxISO(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

// ---- Cadence helpers ----
export function getCadenceKey(v, defaultKey = "monthly") {
  const key = (v?.inviteCadence || "").toLowerCase().trim();
  if (!key) return defaultKey;
  if (INVITE_CADENCES.some((c) => c.key === key)) return key;
  return defaultKey;
}

export function getCooldownDaysForVolunteer(v, defaultCadence = "monthly") {
  const role = v?.coreRole || "Volunteer";
  const cadence = getCadenceKey(v, defaultCadence);

  // Core roles always eligible
  if (CORE_ROLES_NO_COOLDOWN.has(role)) return 0;

  // Weekly cadence = always eligible
  if (cadence === "weekly") return 0;

  const def = INVITE_CADENCES.find((c) => c.key === cadence);
  return def ? def.cooldownDays : 21; // fallback to monthly
}

// ✅ lastTouch includes Declined too (so declines affect cadence)
export function getLastTouchISO(v) {
  const lastInvited = normalizeISODate(v?.lastInvitedAt);
  const lastConfirmed = normalizeISODate(v?.lastConfirmedDate);
  const lastDeclined = normalizeISODate(v?.lastDeclinedDate);

  return maxISO(maxISO(lastInvited, lastConfirmed), lastDeclined);
}

// ✅ Eligible date is based on most recent "touch"
export function getEligibleISO(v, fridayISO, defaultCadence = "monthly") {
  const cooldownDays = getCooldownDaysForVolunteer(v, defaultCadence);
  if (cooldownDays === 0) return fridayISO;

  const lastTouch = getLastTouchISO(v);

  // Never touched -> eligible now
  if (!lastTouch) return fridayISO;

  return addDaysISO(lastTouch, cooldownDays);
}

export function isEligibleThisWeek(v, fridayISO, defaultCadence = "monthly") {
  const eligibleISO = getEligibleISO(v, fridayISO, defaultCadence);
  if (!eligibleISO) return true;
  return fridayISO >= eligibleISO;
}

// ---- Ordering rules (invite rotation spirit) ----
// 1) Weekly cadence first
// 2) Eligible first
// 3) Never touched first
// 4) Oldest lastTouch first
// 5) Name tie-break
export function sortInviteCandidates(volunteers, fridayISO, opts = {}) {
  const { excludeIds = new Set(), defaultCadence = "monthly", onlyActive = true } = opts;

  const list = (volunteers || [])
    .filter((v) => (onlyActive ? !!v.active : true))
    .filter((v) => !excludeIds.has(v.id))
    .map((v) => {
      const cadence = getCadenceKey(v, defaultCadence);
      const eligibleISO = getEligibleISO(v, fridayISO, defaultCadence);
      const eligibleNow = isEligibleThisWeek(v, fridayISO, defaultCadence);

      const lastTouch = getLastTouchISO(v);
      const neverTouched = !lastTouch;
      const lastTouchSort = lastTouch || "0000-00-00";

      return { v, cadence, eligibleISO, eligibleNow, neverTouched, lastTouchSort };
    });

  list.sort((a, b) => {
    // 1) Weekly first
    if (a.cadence !== b.cadence) {
      if (a.cadence === "weekly") return -1;
      if (b.cadence === "weekly") return 1;
    }

    // 2) Eligible first
    if (a.eligibleNow !== b.eligibleNow) return a.eligibleNow ? -1 : 1;

    // 3) Never touched first
    if (a.neverTouched !== b.neverTouched) return a.neverTouched ? -1 : 1;

    // 4) Oldest lastTouch first
    if (a.lastTouchSort !== b.lastTouchSort) {
      return a.lastTouchSort.localeCompare(b.lastTouchSort);
    }

    // 5) Name
    return (a.v?.name || "").localeCompare(b.v?.name || "");
  });

  return list;
}

/**
 * NEW: Auto-build a weekly invite list (IDs only)
 *
 * Rules:
 * - Include pinned roles (if present + active)
 * - Include cadence=weekly (if active)
 * - Fill remaining using sortInviteCandidates (cadence + lastTouch)
 */
export function buildAutoWeekInviteIds(volunteers, fridayISO, opts = {}) {
  const {
    targetCount = 12,
    defaultCadence = "monthly",
    pinnedRoles = [
      "Chairperson",
      "List Coordinator",
      "Meeting Steward",
      "Discussion Group Lead",
      "Big Book Lead",
    ],
  } = opts;

  const active = (volunteers || []).filter((v) => !!v.active);

  const picked = [];
  const pickedSet = new Set();

  function pick(v) {
    if (!v || !v.id) return;
    if (pickedSet.has(v.id)) return;
    picked.push(v.id);
    pickedSet.add(v.id);
  }

  // 1) Pinned roles first (one person per role)
  for (const role of pinnedRoles) {
    const person = active.find((v) => (v.coreRole || "Volunteer") === role);
    if (person) pick(person);
  }

  // 2) Weekly cadence always included
  const weeklyPeople = active
    .filter((v) => getCadenceKey(v, defaultCadence) === "weekly")
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  for (const v of weeklyPeople) pick(v);

  // 3) Fill remaining by rotation ordering
  if (picked.length < targetCount) {
    const remaining = sortInviteCandidates(active, fridayISO, {
      excludeIds: pickedSet,
      defaultCadence,
      onlyActive: true,
    });

    for (const row of remaining) {
      if (picked.length >= targetCount) break;
      pick(row.v);
    }
  }

  // If we have fewer than targetCount available, return what we have.
  return picked.slice(0, targetCount);
}
