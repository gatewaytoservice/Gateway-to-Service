// src/utils/rotation.js
// Option 2: Cadence + Rotation ordering (pure helpers)
// ✅ Cadence eligibility is based on lastInvitedAt (NOT lastConfirmedDate)

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

// ✅ Eligible date is based on lastInvitedAt (invite frequency), not attendance.
export function getEligibleISO(v, fridayISO, defaultCadence = "monthly") {
  const cooldownDays = getCooldownDaysForVolunteer(v, defaultCadence);

  if (cooldownDays === 0) return fridayISO;

  const lastInvited = normalizeISODate(v?.lastInvitedAt);

  // Never invited -> eligible now
  if (!lastInvited) return fridayISO;

  return addDaysISO(lastInvited, cooldownDays);
}

export function isEligibleThisWeek(v, fridayISO, defaultCadence = "monthly") {
  const eligibleISO = getEligibleISO(v, fridayISO, defaultCadence);
  if (!eligibleISO) return true;
  return fridayISO >= eligibleISO;
}

// ---- Ordering rules (invite rotation spirit) ----
// 1) Weekly cadence first
// 2) Eligible first (not in cadence cooldown)
// 3) Never invited first
// 4) Then by lastInvitedAt (oldest invite first)
// 5) Then by lastConfirmedDate (oldest attendance first) as a secondary fairness tie-break
// 6) Name tie-break
export function sortInviteCandidates(volunteers, fridayISO, opts = {}) {
  const {
    excludeIds = new Set(),
    defaultCadence = "monthly",
    onlyActive = true,
  } = opts;

  const list = (volunteers || [])
    .filter((v) => (onlyActive ? !!v.active : true))
    .filter((v) => !excludeIds.has(v.id))
    .map((v) => {
      const cadence = getCadenceKey(v, defaultCadence);

      const eligibleISO = getEligibleISO(v, fridayISO, defaultCadence);
      const eligibleNow = isEligibleThisWeek(v, fridayISO, defaultCadence);

      const lastInvited = normalizeISODate(v?.lastInvitedAt);
      const neverInvited = !lastInvited;
      const lastInvitedSort = lastInvited || "0000-00-00";

      const lastConfirmed = normalizeISODate(v?.lastConfirmedDate);
      const lastConfirmedSort = lastConfirmed || "0000-00-00";

      return {
        v,
        cadence,
        eligibleISO,
        eligibleNow,
        neverInvited,
        lastInvitedSort,
        lastConfirmedSort,
      };
    });

  list.sort((a, b) => {
    // 1) Weekly first
    if (a.cadence !== b.cadence) {
      if (a.cadence === "weekly") return -1;
      if (b.cadence === "weekly") return 1;
    }

    // 2) Eligible first
    if (a.eligibleNow !== b.eligibleNow) return a.eligibleNow ? -1 : 1;

    // 3) Never invited first
    if (a.neverInvited !== b.neverInvited) return a.neverInvited ? -1 : 1;

    // 4) Oldest lastInvitedAt first
    if (a.lastInvitedSort !== b.lastInvitedSort) {
      return a.lastInvitedSort.localeCompare(b.lastInvitedSort);
    }

    // 5) Oldest lastConfirmedDate first (secondary fairness)
    if (a.lastConfirmedSort !== b.lastConfirmedSort) {
      return a.lastConfirmedSort.localeCompare(b.lastConfirmedSort);
    }

    // 6) Name
    return (a.v?.name || "").localeCompare(b.v?.name || "");
  });

  return list;
}
