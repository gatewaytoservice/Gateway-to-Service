// app/scripts/backfillVolunteerDates.js
//
// ✅ One-time backfill script (SAFE workflow)
// ------------------------------------------------------------
// Purpose:
// - You export a backup JSON from the app (Export page).
// - Run this script against that exported file.
// - It writes a NEW JSON file (does NOT overwrite your original).
// - Then you can Import the NEW file back into the app.
//
// What it backfills:
// 1) volunteer.createdAt
//    - If missing, set it to the earliest known “activity” we can find.
//    - We use dates already in your data: lastConfirmedDate, lastInvitedAt,
//      lastDeclinedDate, nextInviteDate (if present).
//
// 2) volunteer.nextInviteDate
//    - If missing, set it using Scheduling System V2 logic.
//    - If lastConfirmedDate exists -> compute nextInviteDate using cadence rules.
//    - If NO lastConfirmedDate exists -> set nextInviteDate to upcoming Friday
//      so they show up as “due” for the next meeting (no one gets stuck).
//
// IMPORTANT:
// - This script does NOT change cadence.
// - This script does NOT change weekly invites/weeks history.
// - This script does NOT modify your existing export file.
// - This script only writes a new export file you can inspect + import.
//
// Usage (from repo root):
//   node app/scripts/backfillVolunteerDates.js ./gateway-to-service-backup-2026-04-21.json
//
// Optional:
//   node app/scripts/backfillVolunteerDates.js ./backup.json --out ./backup.backfilled.json
//
// ------------------------------------------------------------

const fs = require("fs");
const path = require("path");

// ----------------------------
// CLI args
// ----------------------------
const args = process.argv.slice(2);
const inputPath = args[0];

if (!inputPath) {
  console.error(
    [
      "Missing input file.",
      "Usage:",
      "  node app/scripts/backfillVolunteerDates.js <exported-backup.json> [--out <output.json>]",
    ].join("\n")
  );
  process.exit(1);
}

function getArgValue(flag) {
  const idx = args.indexOf(flag);
  if (idx === -1) return null;
  return args[idx + 1] || null;
}

const outArg = getArgValue("--out");

// ----------------------------
// Helpers (ISO handling)
// ----------------------------
function normalizeISODate(isoOrTs) {
  if (!isoOrTs) return null;
  const s = String(isoOrTs).trim();
  if (!s) return null;
  // accept either YYYY-MM-DD or ISO datetime; always return YYYY-MM-DD
  return s.length >= 10 ? s.slice(0, 10) : null;
}

function isValidISODate(iso) {
  const d = normalizeISODate(iso);
  return !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function isoToDate(iso) {
  const dateOnly = normalizeISODate(iso);
  if (!dateOnly) return null;
  const [y, m, d] = dateOnly.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
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

// Upcoming Friday (local)
function getUpcomingFridayISO(fromDate = new Date()) {
  const dt = new Date(fromDate);
  dt.setHours(0, 0, 0, 0);

  const day = dt.getDay(); // 0 Sun ... 5 Fri ... 6 Sat
  const delta = (5 - day + 7) % 7; // days until Friday
  dt.setDate(dt.getDate() + delta);
  return dateToISO(dt);
}

function minISODate(dates) {
  const cleaned = (dates || []).map(normalizeISODate).filter(isValidISODate);
  if (!cleaned.length) return null;
  cleaned.sort((a, b) => a.localeCompare(b));
  return cleaned[0];
}

// createdAt wants a datetime string; we’ll store it at noon UTC for consistency.
function toCreatedAtISO(dateISO) {
  const d = normalizeISODate(dateISO);
  if (!d) return null;
  return `${d}T12:00:00.000Z`;
}

// ----------------------------
// Scheduling System V2 logic
// (mirrors src/utils/rotationV2.js behavior)
// ----------------------------
const INVITE_CADENCE_KEYS = new Set([
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "yearly",
  "monthly_pattern",
]);

const MONTHLY_PATTERN_KEYS = new Set([
  "first_friday",
  "second_friday",
  "third_friday",
  "fourth_friday",
  "last_friday",
]);

function getCadenceKey(v, defaultKey = "monthly") {
  const key = String(v?.inviteCadence || "").toLowerCase().trim();
  if (!key) return defaultKey;
  if (INVITE_CADENCE_KEYS.has(key)) return key;
  return defaultKey;
}

function getMonthlyPatternKey(v) {
  const key = String(v?.monthlyPattern || "").toLowerCase().trim();
  if (!key) return "";
  if (MONTHLY_PATTERN_KEYS.has(key)) return key;
  return "";
}

function addMonthsToYearMonth(year, monthIndex, monthsToAdd) {
  const total = year * 12 + monthIndex + Number(monthsToAdd || 0);
  const nextYear = Math.floor(total / 12);
  const nextMonthIndex = total % 12;
  return { year: nextYear, monthIndex: nextMonthIndex };
}

function getFridaysInMonth(year, monthIndex) {
  const out = [];
  const dt = new Date(year, monthIndex, 1);

  while (dt.getMonth() === monthIndex) {
    if (dt.getDay() === 5) out.push(dateToISO(dt));
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

  // If month has fewer Fridays than source (ex: 5th Friday), fall back to last Friday
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

// Mirrors rotationV2.js getNextInviteDateAfterConfirm
function getNextInviteDateAfterConfirm(v, confirmedFridayISO) {
  const cadence = getCadenceKey(v, "monthly");
  const monthlyPattern = getMonthlyPatternKey(v);
  const baseISO = normalizeISODate(v?.nextInviteDate) || normalizeISODate(confirmedFridayISO);

  if (!baseISO) return null;

  if (cadence === "weekly") return addDaysISO(baseISO, 7);
  if (cadence === "biweekly") return addDaysISO(baseISO, 14);

  const baseDate = isoToDate(baseISO);
  if (!baseDate) return null;

  const baseYear = baseDate.getFullYear();
  const baseMonthIndex = baseDate.getMonth();

  // monthly_pattern: next month’s named Friday
  if (cadence === "monthly_pattern") {
    const pattern = monthlyPattern || "third_friday";
    const target = addMonthsToYearMonth(baseYear, baseMonthIndex, 1);
    return getFridayByMonthlyPattern(target.year, target.monthIndex, pattern);
  }

  // monthly/quarterly/yearly preserve “Friday occurrence index”
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

  // safe fallback: treat like monthly
  const fallbackTarget = addMonthsToYearMonth(baseYear, baseMonthIndex, 1);
  return getFridayByOccurrenceIndex(fallbackTarget.year, fallbackTarget.monthIndex, occurrenceIndex);
}

// ----------------------------
// Backfill rules
// ----------------------------

/**
 * Backfill createdAt:
 * - If missing, set createdAt based on earliest known activity date.
 * - Earliest is computed from:
 *    lastConfirmedDate, lastInvitedAt, lastDeclinedDate, nextInviteDate
 * - If none exist, set createdAt to today (noon UTC).
 */
function backfillCreatedAt(v) {
  if (v?.createdAt) return { v, changed: false };

  const earliest = minISODate([
    v?.lastConfirmedDate,
    v?.lastInvitedAt,
    v?.lastDeclinedDate,
    v?.nextInviteDate,
  ]);

  const fallback = dateToISO(new Date()); // today
  const createdAt = toCreatedAtISO(earliest || fallback);

  return {
    v: { ...v, createdAt },
    changed: true,
  };
}

/**
 * Backfill nextInviteDate:
 * - If already present (and valid), keep it.
 * - Else:
 *    a) If lastConfirmedDate exists: nextInviteDate = getNextInviteDateAfterConfirm(v, lastConfirmedDate)
 *    b) Else: nextInviteDate = upcomingFriday (so they don’t get “stuck”)
 *
 * This is the “no one gets screwed over” default:
 * - People with real confirmation history get their true cadence schedule.
 * - People without confirmation history get scheduled for the next meeting.
 */
function backfillNextInviteDate(v) {
  const existing = normalizeISODate(v?.nextInviteDate);
  if (existing) return { v, changed: false };

  const lastConfirmed = normalizeISODate(v?.lastConfirmedDate);
  if (lastConfirmed) {
    const computed = getNextInviteDateAfterConfirm(v, lastConfirmed);
    if (computed) return { v: { ...v, nextInviteDate: computed }, changed: true };
  }

  // No confirmations to anchor from -> schedule for the next meeting.
  const upcomingFriday = getUpcomingFridayISO(new Date());
  return { v: { ...v, nextInviteDate: upcomingFriday }, changed: true };
}

// ----------------------------
// Run
// ----------------------------
let raw;
try {
  raw = fs.readFileSync(inputPath, "utf8");
} catch (e) {
  console.error(`Could not read file: ${inputPath}`);
  console.error(e.message || e);
  process.exit(1);
}

let state;
try {
  state = JSON.parse(raw);
} catch (e) {
  console.error("Input is not valid JSON.");
  console.error(e.message || e);
  process.exit(1);
}

if (!state || typeof state !== "object") {
  console.error("Input JSON root must be an object.");
  process.exit(1);
}

if (!Array.isArray(state.volunteers)) {
  console.error("Input JSON does not contain a volunteers array: state.volunteers");
  process.exit(1);
}

const beforeCount = state.volunteers.length;

let createdAtChanged = 0;
let nextInviteChanged = 0;

const updatedVolunteers = state.volunteers.map((orig) => {
  const v0 = orig && typeof orig === "object" ? orig : {};

  // 1) createdAt
  const c1 = backfillCreatedAt(v0);
  if (c1.changed) createdAtChanged++;

  // 2) nextInviteDate
  const c2 = backfillNextInviteDate(c1.v);
  if (c2.changed) nextInviteChanged++;

  return c2.v;
});

const nextState = {
  ...state,
  volunteers: updatedVolunteers,
};

// Determine output path
const resolvedIn = path.resolve(process.cwd(), inputPath);
const inDir = path.dirname(resolvedIn);
const inBase = path.basename(resolvedIn);

const defaultOut = path.join(
  inDir,
  inBase.replace(/\.json$/i, "") + ".backfilled.json"
);

const outputPath = outArg ? path.resolve(process.cwd(), outArg) : defaultOut;

// Write
try {
  fs.writeFileSync(outputPath, JSON.stringify(nextState, null, 2), "utf8");
} catch (e) {
  console.error(`Could not write output file: ${outputPath}`);
  console.error(e.message || e);
  process.exit(1);
}

// Summary
console.log("✅ Backfill complete.");
console.log(`Input:  ${resolvedIn}`);
console.log(`Output: ${outputPath}`);
console.log(`Volunteers: ${beforeCount}`);
console.log(`createdAt backfilled: ${createdAtChanged}`);
console.log(`nextInviteDate backfilled: ${nextInviteChanged}`);
console.log("");
console.log("Next step:");
console.log("- Open the output JSON quickly to sanity-check a few volunteers.");
console.log("- Then Import the output file in your app (Export/Import page).");