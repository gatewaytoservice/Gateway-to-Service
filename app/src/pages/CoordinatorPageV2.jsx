// app/src/pages/CoordinatorPageV2.jsx
// Gateway to Service — Coordinator Screen (V2 UI)
//
// IMPORTANT:
// - This file keeps your existing logic & flows (week creation, invite flow, status engine, backfill, overflow trim,
//   SMS modal behavior, finalize/reminders, filters, accordion rows).
// - This update adds a “Coverage Check — Add Alt Roles?” popup that triggers when required roles are missing coverage,
//   INCLUDING when a required-role volunteer is Declined or No Response.
// - “Removal” is from COVERAGE only (we do NOT delete them from the week list). Declined/No Response stays on the week
//   so it appears in the Declined filter for record/history.
// - Popup button now adapts:
//   - Add Alt to Week (if Alt exists/active and not on week)
//   - Send Invite (if Alt is on week and Not Invited)
//   - Open Invite Actions (if Alt is on week and Invited)
//   - Already Confirmed (if Alt is on week and Confirmed)
//   - Alt already declined (if Alt is on week and Declined/No Response)
//   - Go Assign Alt in Volunteers (if no Alt assigned, OR assigned but Paused)
// - Required Roles display becomes week-aware:
//   - If primary is Declined/No Response, we show “Alt covering” ONLY if Alt is Confirmed.
//   - If Alt is Paused, it will not be suggested in the popup (per your request).

// app/src/pages/CoordinatorPageV2.jsx
// Gateway to Service — Coordinator Screen (V2 UI)
//
// ✅ This file keeps ALL existing logic + functionality.
// ✅ Adds: "1st Step Lead" assignment workflow AFTER the week is finalized.
// ✅ Does NOT modify or interfere with the existing invite workflow.
//
// -----------------------------------------------------------------------------
// NEW FEATURE (First Step Lead) — WHAT IT DOES
// After the upcoming Friday week is finalized:
// 1) Shows confirmed volunteers (from week.invites where status === "Confirmed").
// 2) Coordinator can click “Request 1st Step Lead” on ONE confirmed volunteer.
// 3) This reuses the existing SMS modal system (Open Text App / Copy Message).
// 4) After sending/copying, the app stores a small state machine inside the week:
//    week.firstStepLead = { status, volunteerId, requestedAt, responseAt, history[] }
// 5) The UI then shows “Waiting on response” with 3 buttons:
//    - Yes (Confirmed)
//    - No
//    - No Response
// 6) If Yes -> locks in the assignment as "confirmed" (coverage badge shown).
//    If No/No Response -> returns to "idle" so coordinator can request someone else.
//
// IMPORTANT:
// - This is independent from invites. We are NOT changing invite statuses.
// - We are NOT removing anyone from week.invites.
// - This is coverage/assignment tracking only, stored under week.firstStepLead.
// -----------------------------------------------------------------------------

// app/src/pages/CoordinatorPageV2.jsx
// Gateway to Service — Coordinator Screen (V2 UI)
//
// IMPORTANT GUARANTEES
// - We do NOT remove any invite rows from the week list.
// - We do NOT change anyone's coreRole.
// - "Swap out" means: Required Roles COVERAGE DISPLAY swaps to the Alt when Alt is Confirmed.
// - The Invite workflow remains the source of truth for statuses & history.
//
// FIXES / FEATURES INCLUDED
// 1) No scroll-to-top jump when clicking a volunteer row (uses div role="button" + preventDefault).
// 2) 1st Step Lead workflow in Step 3 (restored).
// 3) Suggested Next Up / Add Volunteers area hides when finalized, reappears after edits unfinalize.
// 4) Coverage prompt suggests Alt regardless of scheduling due date (coverage overrides scheduling).
// 5) NEW: If Alt Chairperson / Alt Discussion Lead / Alt Big Book Lead is Confirmed,
//    the Required Roles section will DISPLAY the Alt as the covered person for that role.

// app/src/pages/CoordinatorPageV2.jsx
// ✅ Update in this pass (ONLY):
// 1) Copy List format => "Name — 234-567-8901" per line (phones formatted)
// 2) Remove the "Delete This Week (Dev)" button from the UI
//
// IMPORTANT:
// - No other functionality/logic is removed.
// - The delete handler is still kept in the file (so logic stays intact),
//   but the UI button is removed to prevent accidental taps (esp on mobile).

import React, { useEffect, useMemo, useState } from "react";
import { getUpcomingFridayISO, formatFriendlyDate } from "../utils/date.js";

// ✅ Scheduling System V2 (date-driven)
import {
  sortInviteCandidates,
  isEligibleThisWeek,
  getCadenceKey,
  buildAutoWeekInviteIds,
  getNextInviteDateAfterConfirm,
} from "../utils/rotationV2.js";

import { buildChairText } from "../utils/shareList.js";

// ✅ First Step Lead helpers
import { ensureFirstStepLead } from "../utils/firstStepLead.js";

// ✅ Alt-role coverage prompts
import { getAltRolePrompts } from "../utils/requiredRolePrompts.js";

const CORE_ROLE_ORDER = [
  "Chairperson",
  "List Coordinator",
  "Meeting Steward",
  "Discussion Group Lead",
  "Big Book Lead",
];

const STATUS_ORDER = ["Not Invited", "Invited", "Confirmed", "Declined", "No Response"];

function getRole(v) {
  return v.coreRole || "Volunteer";
}

const ROLE_SORT_PRIORITY = [
  "Chairperson",
  "Alt Chairperson",
  "List Coordinator",
  "Meeting Steward",
  "Discussion Group Lead",
  "Alt Discussion Lead",
  "Big Book Lead",
  "Alt Big Book Lead",
  "Volunteer",
];

function roleRank(role) {
  const idx = ROLE_SORT_PRIORITY.indexOf(role);
  return idx === -1 ? 999 : idx;
}

// ✅ The 3 required roles that have Alt coverage swaps
const ALT_ROLE_MAP = {
  Chairperson: "Alt Chairperson",
  "Discussion Group Lead": "Alt Discussion Lead",
  "Big Book Lead": "Alt Big Book Lead",
};

// ----- Date helpers -----
function isoToDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function dateToISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function addWeeksISO(iso, weeks) {
  const dt = isoToDate(iso);
  dt.setDate(dt.getDate() + weeks * 7);
  return dateToISO(dt);
}

// ✅ Phone formatting (UI only)
// - 10 digits => 234-567-8901
// - 11 digits starting with 1 => 1-234-567-8901
function formatPhoneUS(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith("1"))
    return `1-${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  return raw;
}

// ✅ Next invite date display (UI-only)
function getNextInviteISOForDisplay(v) {
  const fromField = String(v?.nextInviteDate || "").trim();
  return fromField || "";
}

// =========================
// Theme tokens
// =========================
const THEME = {
  navy: "#243447",
  teal: "#4A8F8B",
  bg: "#FAFAFA",
  card: "#FFFFFF",
  border: "#E2E6EA",
  muted: "#6B7280",

  gold: "#B08D2C",
  goldBg: "rgba(176, 141, 44, 0.14)",
  greenBg: "rgba(74, 143, 139, 0.14)",
  navyBg: "rgba(36, 52, 71, 0.06)",
  red: "rgba(185, 28, 28, 0.95)",
  redBg: "rgba(185, 28, 28, 0.10)",
  grayBg: "rgba(107, 114, 128, 0.10)",
  grayBorder: "rgba(107, 114, 128, 0.35)",
};

function baseButtonStyle({ hovered, disabled, variant }) {
  const base =
    variant === "primary"
      ? {
          marginTop: 12,
          width: "100%",
          padding: "12px 10px",
          borderRadius: 12,
          fontWeight: 900,
          border: `1px solid ${THEME.navy}55`,
          background: "transparent",
          color: THEME.navy,
          cursor: "pointer",
          transition: "background 140ms ease, border-color 140ms ease, color 140ms ease",
        }
      : {
          padding: "8px 10px",
          borderRadius: 10,
          fontWeight: 900,
          fontSize: 12,
          border: `1px solid ${THEME.navy}55`,
          background: "transparent",
          color: THEME.navy,
          cursor: "pointer",
          transition: "background 140ms ease, border-color 140ms ease, color 140ms ease",
        };

  if (disabled) {
    return {
      ...base,
      border: `1px solid ${THEME.border}`,
      color: THEME.muted,
      background: "transparent",
      cursor: "not-allowed",
      opacity: 0.65,
    };
  }

  if (hovered) {
    return {
      ...base,
      border: `1px solid ${THEME.teal}`,
      background: THEME.teal,
      color: "#FFFFFF",
    };
  }

  return base;
}

function statusAccent(status) {
  switch (status) {
    case "Confirmed":
      return { fg: THEME.teal, bg: THEME.greenBg, border: "rgba(74, 143, 139, 0.55)" };
    case "Invited":
      return { fg: THEME.gold, bg: THEME.goldBg, border: "rgba(176, 141, 44, 0.55)" };
    case "Declined":
      return { fg: THEME.red, bg: THEME.redBg, border: "rgba(185, 28, 28, 0.45)" };
    case "No Response":
      return { fg: THEME.muted, bg: THEME.grayBg, border: THEME.grayBorder };
    case "Not Invited":
    default:
      return { fg: THEME.navy, bg: THEME.navyBg, border: "rgba(36, 52, 71, 0.28)" };
  }
}

function basePillStyle(status) {
  const a = statusAccent(status);
  return {
    textAlign: "center",
    fontSize: 12,
    fontWeight: 950,
    padding: "6px 10px",
    borderRadius: 999,
    border: `1px solid ${a.border}`,
    background: a.bg,
    color: a.fg,
    whiteSpace: "nowrap",
  };
}

// =========================
// Safety notes (warnings only)
// NOTE: We do not duplicate “Next Invite Date” here.
// =========================
function servedLastWeek(fridayISO, lastConfirmedDate) {
  if (!lastConfirmedDate) return false;
  const lastWeekISO = addWeeksISO(fridayISO, -1);
  return lastConfirmedDate === lastWeekISO;
}

const RECENT_DECLINE_WEEKS = 2;

function getSafetyNotes(v, fridayISO) {
  const notes = [];

  if (servedLastWeek(fridayISO, v.lastConfirmedDate)) {
    notes.push("Already served last week");
  }

  if (v.lastDeclinedDate) {
    const declineWindowEnd = addWeeksISO(v.lastDeclinedDate, RECENT_DECLINE_WEEKS);
    if (fridayISO < declineWindowEnd) {
      notes.push(`Recently declined (${formatFriendlyDate(v.lastDeclinedDate)})`);
    }
  }

  const eligibleNow = isEligibleThisWeek(v, fridayISO);
  if (!eligibleNow) {
    const cadenceKey = getCadenceKey(v, "monthly");
    notes.push(`Not due yet (${cadenceKey})`);
  }

  return notes;
}

function StatusKey() {
  const items = ["Not Invited", "Invited", "Confirmed", "Declined", "No Response"];
  return (
    <section style={styles.keyWrap}>
      <div style={styles.row}>
        <div style={{ fontWeight: 1000, color: THEME.navy }}>Key</div>
        <div style={{ fontSize: 12, color: THEME.muted }}>Status colors</div>
      </div>
      <div style={styles.keyRow}>
        {items.map((s) => (
          <span key={s} style={basePillStyle(s)}>
            {s}
          </span>
        ))}
      </div>
    </section>
  );
}

// =========================
// Finalize prompt window (America/Chicago)
// =========================
function getCentralParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = get("weekday");
  const hour = parseInt(get("hour"), 10);
  const minute = parseInt(get("minute"), 10);
  return { weekday, hour: Number.isFinite(hour) ? hour : 0, minute: Number.isFinite(minute) ? minute : 0 };
}

function inFridayFinalizeWindowCentral(now = new Date()) {
  const { weekday, hour } = getCentralParts(now);
  return weekday === "Fri" && hour >= 12 && hour < 19;
}

// =========================
// Chip style
// =========================
function chipStyle({ active, hovered }) {
  const base = {
    padding: "7px 10px",
    borderRadius: 999,
    border: `1px solid rgba(36, 52, 71, 0.28)`,
    background: "transparent",
    color: THEME.navy,
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
    transition: "background 140ms ease, border-color 140ms ease, color 140ms ease, transform 140ms ease",
    whiteSpace: "nowrap",
  };

  if (active) {
    return {
      ...base,
      border: `1px solid rgba(74, 143, 139, 0.65)`,
      background: "rgba(74, 143, 139, 0.12)",
      transform: "translateY(-1px)",
    };
  }

  if (hovered) {
    return {
      ...base,
      border: `1px solid rgba(74, 143, 139, 0.75)`,
      background: "rgba(74, 143, 139, 0.08)",
      transform: "translateY(-1px)",
    };
  }

  return base;
}

export default function CoordinatorPageV2({ appState, setAppState }) {
  const fridayISO = getUpcomingFridayISO();
  const weekRaw = appState.weeks.find((w) => w.date === fridayISO) || null;

  // ✅ Ensure week has firstStepLead shape if missing
  const week = useMemo(() => (weekRaw ? ensureFirstStepLead(weekRaw) : null), [weekRaw]);

  const [toast, setToast] = useState("");
  const [showLastMinute, setShowLastMinute] = useState(false);
  const [hoveredBtn, setHoveredBtn] = useState(null);

  const [activeFilter, setActiveFilter] = useState("all");
  const [hoveredChip, setHoveredChip] = useState(null);
  const [expandedInviteId, setExpandedInviteId] = useState(null);

  const [editStatus, setEditStatus] = useState({
    open: false,
    volunteerId: null,
    nextStatus: "Invited",
  });

  const [altPromptOpen, setAltPromptOpen] = useState(false);
  const [lastNudgeHour, setLastNudgeHour] = useState(null);

  const [showAddVolunteers, setShowAddVolunteers] = useState(false);

  const [smsModal, setSmsModal] = useState({
    open: false,
    kind: null, // "invite" | "followUp" | "reminder" | "firstStepLead"
    volunteerId: null,
    phone: "",
    name: "",
    message: "",
  });

  // Lock scroll when any modal is open
  useEffect(() => {
    const anyModalOpen = showLastMinute || smsModal.open || editStatus.open || altPromptOpen;
    if (!anyModalOpen) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showLastMinute, smsModal.open, editStatus.open, altPromptOpen]);

  // Lookups
  const volunteersById = useMemo(() => {
    const m = new Map();
    for (const v of appState.volunteers || []) m.set(v.id, v);
    return m;
  }, [appState.volunteers]);

  const volunteersByRole = useMemo(() => {
    const map = new Map();
    for (const v of appState.volunteers || []) {
      if (!v.coreRole) continue;
      map.set(v.coreRole, v);
    }
    return map;
  }, [appState.volunteers]);

  const inviteByVolunteerId = useMemo(() => {
    const m = new Map();
    if (!week) return m;
    for (const inv of week.invites || []) m.set(inv.volunteerId, inv);
    return m;
  }, [week]);

  // ✅ Alt role prompts (coverage-based; not schedule-based)
  const altRolePrompts = useMemo(() => {
    if (!week) return [];
    return getAltRolePrompts({
      week,
      volunteers: appState.volunteers,
      volunteersByRole,
      inviteByVolunteerId,
    });
  }, [week, appState.volunteers, volunteersByRole, inviteByVolunteerId]);

  // ✅ Coverage swaps map (UI-only)
  const coverageSwapByRequiredRole = useMemo(() => {
    if (!week) return new Map();

    const m = new Map(); // requiredRole -> { coveredByVolunteer, coveredByRole, altStatus }
    for (const requiredRole of Object.keys(ALT_ROLE_MAP)) {
      const altRole = ALT_ROLE_MAP[requiredRole];

      const altPerson = volunteersByRole.get(altRole) || null;
      if (!altPerson) continue;

      const altInvite = inviteByVolunteerId.get(altPerson.id) || null;
      const altStatus = altInvite?.status || null;

      if (altStatus === "Confirmed") {
        m.set(requiredRole, {
          coveredByVolunteer: altPerson,
          coveredByRole: altRole,
          altStatus,
        });
      }
    }
    return m;
  }, [week, volunteersByRole, inviteByVolunteerId]);

  // Show coverage prompt if needed (unless dismissed)
  useEffect(() => {
    if (!week) return;

    const dismissKey = `gts:altRolePrompt:dismissed:${fridayISO}`;
    const dismissed = localStorage.getItem(dismissKey) === "1";
    if (dismissed) return;

    if (!altRolePrompts.length) return;
    setAltPromptOpen(true);
  }, [week?.id, fridayISO, altRolePrompts.length]);

  const eligibleLastMinute = useMemo(() => {
    if (!week) return [];
    return (appState.volunteers || [])
      .filter((v) => v.active && !inviteByVolunteerId.has(v.id))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [appState.volunteers, week, inviteByVolunteerId]);

  // Capacity helpers
  function getTargetCount(state) {
    const preferred = state.settings.preferredConfirmed ?? 12;
    const maxVols = state.settings.maxVolunteers ?? 14;
    return Math.min(preferred, maxVols);
  }

  function isActivePoolStatus(status) {
    return status !== "Declined" && status !== "No Response";
  }

  function isProtectedFromAutoRemoval(volunteer) {
    const role = volunteer?.coreRole || "";
    return CORE_ROLE_ORDER.includes(role);
  }

  // Week patch helper
  function patchWeek(prevState, weekId, patcher) {
    return {
      ...prevState,
      weeks: prevState.weeks.map((w) => {
        if (w.id !== weekId) return w;
        return patcher(w);
      }),
    };
  }

  function unfinalizeWeekIfNeeded(weekObj) {
    if (!weekObj) return weekObj;
    if (!weekObj.finalized) return weekObj;
    return { ...weekObj, finalized: false };
  }

  // Auto backfill (Declined/No Response)
  function maybeBackfillAfterDrop(nextState, weekObj) {
    if (!weekObj) return { nextState, didAdd: false, addedName: "" };
    if (weekObj.finalized) return { nextState, didAdd: false, addedName: "" };

    const targetCount = getTargetCount(nextState);
    const invites = weekObj.invites || [];
    const activePoolCount = invites.filter((i) => isActivePoolStatus(i.status)).length;
    if (activePoolCount >= targetCount) return { nextState, didAdd: false, addedName: "" };

    const excludeIds = new Set(invites.map((i) => i.volunteerId));
    const candidates = sortInviteCandidates(nextState.volunteers, fridayISO, {
      excludeIds,
      onlyActive: true,
    });

    const picked = candidates.find((c) => c.dueNow)?.v || null;
    if (!picked?.id) return { nextState, didAdd: false, addedName: "" };

    const nowISO = new Date().toISOString();
    const newInvite = {
      id: crypto.randomUUID(),
      volunteerId: picked.id,
      status: "Not Invited",
      inviteSentAt: null,
      followUpSentAt: null,
      responseAt: null,
      createdAt: nowISO,
      autoAdded: true,
      autoAddedAt: nowISO,
      reminderSentAt: null,
    };

    const patchedWeek = { ...weekObj, invites: [...invites, newInvite] };

    return {
      nextState: {
        ...nextState,
        weeks: nextState.weeks.map((w) => (w.id === weekObj.id ? patchedWeek : w)),
      },
      didAdd: true,
      addedName: picked.name || "",
    };
  }

  // Overflow trim
  function trimOverflowIfNeeded(nextState, weekObj) {
    if (!weekObj) return { nextState, didRemove: false, removedName: "" };

    const targetCount = getTargetCount(nextState);
    const invites = weekObj.invites || [];
    const activePoolCount = invites.filter((i) => isActivePoolStatus(i.status)).length;
    if (activePoolCount <= targetCount) return { nextState, didRemove: false, removedName: "" };

    const byId = new Map(nextState.volunteers.map((v) => [v.id, v]));
    const getInviteCreated = (inv) =>
      inv.autoAddedAt || inv.createdAt || inv.inviteSentAt || "0000-00-00T00:00:00.000Z";

    const removable1 = invites
      .filter((inv) => inv.autoAdded && (inv.status === "Not Invited" || inv.status === "Invited"))
      .filter((inv) => !isProtectedFromAutoRemoval(byId.get(inv.volunteerId)));

    const removable2 = invites
      .filter((inv) => inv.status === "Not Invited" || inv.status === "Invited")
      .filter((inv) => !isProtectedFromAutoRemoval(byId.get(inv.volunteerId)));

    const pool = removable1.length ? removable1 : removable2;
    if (!pool.length) return { nextState, didRemove: false, removedName: "" };

    pool.sort((a, b) => getInviteCreated(b).localeCompare(getInviteCreated(a)));
    const toRemove = pool[0];
    const removedV = byId.get(toRemove.volunteerId);

    const patchedWeek = {
      ...weekObj,
      invites: invites.filter((inv) => inv.id !== toRemove.id),
    };

    const updatedState = {
      ...nextState,
      weeks: nextState.weeks.map((w) => (w.id === weekObj.id ? patchedWeek : w)),
    };

    return { nextState: updatedState, didRemove: true, removedName: removedV?.name || "" };
  }

  // Create week
  function createWeekIfMissing() {
    if (week) return;

    const targetCount = getTargetCount(appState);
    const used = new Set();
    const initialIds = [];

    const pushId = (id) => {
      if (!id) return;
      if (used.has(id)) return;
      used.add(id);
      initialIds.push(id);
    };

    // 1) Pinned roles first
    for (const role of CORE_ROLE_ORDER) {
      const v = (appState.volunteers || []).find((x) => x.active && (x.coreRole || "") === role);
      if (v) pushId(v.id);
      if (initialIds.length >= targetCount) break;
    }

    // 2) Fill remainder from dueNow only
    if (initialIds.length < targetCount) {
      const candidates = sortInviteCandidates(appState.volunteers || [], fridayISO, {
        excludeIds: used,
        onlyActive: true,
      });

      for (const item of candidates) {
        if (initialIds.length >= targetCount) break;
        if (!item.dueNow) continue;
        pushId(item.v?.id);
      }
    }

    // 3) Optional fallback
    if (initialIds.length === 0 && typeof buildAutoWeekInviteIds === "function") {
      const fallbackIds = buildAutoWeekInviteIds(appState.volunteers || [], fridayISO, {
        targetCount,
        pinnedRoles: CORE_ROLE_ORDER,
      });
      for (const id of fallbackIds || []) {
        if (initialIds.length >= targetCount) break;
        pushId(id);
      }
    }

    const nowISO = new Date().toISOString();
    const initialInvites = initialIds.map((volunteerId) => ({
      id: crypto.randomUUID(),
      volunteerId,
      status: "Not Invited",
      inviteSentAt: null,
      followUpSentAt: null,
      responseAt: null,
      createdAt: nowISO,
      autoAdded: false,
      autoAddedAt: null,
      reminderSentAt: null,
    }));

    const newWeek = ensureFirstStepLead({
      id: crypto.randomUUID(),
      date: fridayISO,
      neededCount: appState.settings.maxVolunteers,
      finalized: false,
      invites: initialInvites,
    });

    setAppState((prev) => ({
      ...prev,
      weeks: [newWeek, ...prev.weeks],
    }));
  }

  function addVolunteerToThisWeek(volunteerId) {
    if (!week) return;
    if (inviteByVolunteerId.has(volunteerId)) return;

    const nowISO = new Date().toISOString();
    const newInvite = {
      id: crypto.randomUUID(),
      volunteerId,
      status: "Not Invited",
      inviteSentAt: null,
      followUpSentAt: null,
      responseAt: null,
      createdAt: nowISO,
      autoAdded: false,
      autoAddedAt: null,
      reminderSentAt: null,
    };

    setAppState((prev) =>
      patchWeek(prev, week.id, (w) => ({
        ...unfinalizeWeekIfNeeded(w),
        invites: [...(w.invites || []), newInvite],
      }))
    );
  }

  function updateInvite(volunteerId, patch) {
    if (!week) return;

    setAppState((prev) =>
      patchWeek(prev, week.id, (w) => ({
        ...unfinalizeWeekIfNeeded(w),
        invites: (w.invites || []).map((inv) =>
          inv.volunteerId === volunteerId ? { ...inv, ...patch } : inv
        ),
      }))
    );
  }

  function removeFromThisWeek(volunteerId) {
    if (!week) return;

    setAppState((prev) =>
      patchWeek(prev, week.id, (w) => ({
        ...unfinalizeWeekIfNeeded(w),
        invites: (w.invites || []).filter((i) => i.volunteerId !== volunteerId),
      }))
    );
  }

  // Messages
  function fillTemplate(template, volunteerName) {
    return (template || "").replaceAll("[Name]", volunteerName || "");
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      setToast("Copied ✅");
      setTimeout(() => setToast(""), 1200);
    } catch (e) {
      console.error(e);
      setToast("Copy failed ❌");
      setTimeout(() => setToast(""), 1500);
    }
  }

  // ✅ UPDATED: Copy List formatting
  // Requirement: each line => "Name — 234-567-8901"
  // We intentionally keep buildChairText call available (in case you rely on it elsewhere),
  // but for the *Copy button*, we output the explicit format you requested.
  function handleCopyListForChair() {
    if (!week) return;

    // Preferred: when finalized, chair usually wants confirmed roster.
    // If not finalized yet, still copy the current Confirmed list (so chair isn't sent "Not Invited").
    const confirmed = (week.invites || []).filter((i) => i.status === "Confirmed");

    // If no one is confirmed yet, we fall back to the full invite list (so copy still produces output).
    const sourceInvites = confirmed.length ? confirmed : (week.invites || []);

    // Stable ordering: role priority then name (helps the chair)
    const rows = sourceInvites
      .map((inv) => volunteersById.get(inv.volunteerId))
      .filter(Boolean)
      .sort((a, b) => {
        const ra = roleRank(getRole(a));
        const rb = roleRank(getRole(b));
        if (ra !== rb) return ra - rb;
        return (a.name || "").localeCompare(b.name || "");
      })
      .map((v) => `${(v.name || "").trim()} — ${formatPhoneUS(v.phone) || (v.phone || "").trim()}`.trim());

    const header = `Gateway Volunteers — ${formatFriendlyDate(fridayISO)}`;
    const text = [header, "", ...rows].join("\n");

    copyText(text);

    // NOTE: We did not delete buildChairText() import or logic;
    // it's still here if you decide to switch back later.
    // eslint-disable-next-line no-unused-vars
    const _unusedLegacy = buildChairText;
  }

  // SMS helpers
  function getTemplateFor(kind, volunteer) {
    const msgs = appState?.settings?.messages || {};
    const firstTime = !!volunteer?.firstTime;

    if (kind === "invite") {
      if (firstTime && msgs.firstTime) return msgs.firstTime;
      return msgs.invite || "";
    }
    if (kind === "followUp") return msgs.followUp || "";
    if (kind === "reminder") return msgs.reminder || "";
    if (kind === "firstStepLead") return msgs.firstStepLeadRequest || "";
    return "";
  }

  function normalizePhoneForSMS(phone) {
    if (!phone) return "";
    const trimmed = String(phone).trim();
    const plus = trimmed.startsWith("+") ? "+" : "";
    const digits = trimmed.replace(/[^\d]/g, "");
    return plus + digits;
  }

  function buildSmsLink(phone, body) {
    const to = normalizePhoneForSMS(phone);
    const encoded = encodeURIComponent(body || "");
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const sep = isIOS ? "&" : "?";
    return `sms:${to}${sep}body=${encoded}`;
  }

  function openSmsModal(kind, volunteer) {
    const template = getTemplateFor(kind, volunteer);
    const message = fillTemplate(template, volunteer.name);

    setSmsModal({
      open: true,
      kind,
      volunteerId: volunteer.id,
      phone: volunteer.phone,
      name: volunteer.name,
      message,
    });
  }

  function closeSmsModal() {
    setSmsModal({ open: false, kind: null, volunteerId: null, phone: "", name: "", message: "" });
  }

  function applyAfterSend(kind, volunteerId) {
    const nowISO = new Date().toISOString();

    if (kind === "invite") {
      const v = volunteersById.get(volunteerId);
      updateInvite(volunteerId, {
        status: "Invited",
        inviteSentAt: nowISO,
        prevLastInvitedAt: v?.lastInvitedAt ?? null,
      });

      setAppState((prev) => ({
        ...prev,
        volunteers: (prev.volunteers || []).map((vv) =>
          vv.id === volunteerId ? { ...vv, lastInvitedAt: fridayISO } : vv
        ),
      }));
    }

    if (kind === "followUp") {
      updateInvite(volunteerId, { followUpSentAt: nowISO });
    }

    if (kind === "reminder") {
      updateInvite(volunteerId, { reminderSentAt: nowISO });
    }

    if (kind === "firstStepLead") {
      setAppState((prev) =>
        patchWeek(prev, week.id, (w) => {
          const ww = ensureFirstStepLead(w);
          const next = { ...ww.firstStepLead };

          next.status = "waiting";
          next.volunteerId = volunteerId;
          next.requestedAt = nowISO;
          next.responseAt = null;
          next.history = [
            ...(next.history || []),
            { volunteerId, status: "waiting", requestedAt: nowISO, responseAt: null },
          ];

          return { ...ww, firstStepLead: next };
        })
      );
    }
  }

  // Invite workflow status updates
  function applyStatus(volunteerId, nextStatus) {
    if (!week) return;
    const nowISO = new Date().toISOString();

    setAppState((prev) => {
      const w = prev.weeks.find((x) => x.id === week.id) || null;
      if (!w) return prev;

      const baseWeek = unfinalizeWeekIfNeeded(w);
      const currentInvite =
        (baseWeek.invites || []).find((i) => i.volunteerId === volunteerId) || null;
      if (!currentInvite) return prev;

      const v = (prev.volunteers || []).find((vv) => vv.id === volunteerId) || null;

      let invitePatch = { status: nextStatus };
      if (nextStatus === "Not Invited") {
        invitePatch = { ...invitePatch, inviteSentAt: null, followUpSentAt: null, responseAt: null };
      } else if (nextStatus === "Invited") {
        invitePatch = { ...invitePatch, inviteSentAt: currentInvite.inviteSentAt || nowISO, responseAt: null };
      } else if (nextStatus === "Confirmed" || nextStatus === "Declined" || nextStatus === "No Response") {
        invitePatch = { ...invitePatch, responseAt: nowISO };
      }

      let patchedVolunteers = prev.volunteers;

      if (v && nextStatus === "Confirmed") {
        const nextInviteDateAfterConfirm = getNextInviteDateAfterConfirm(v, fridayISO);
        patchedVolunteers = (patchedVolunteers || []).map((vv) =>
          vv.id === volunteerId
            ? {
                ...vv,
                lastConfirmedDate: fridayISO,
                nextInviteDate: nextInviteDateAfterConfirm || vv.nextInviteDate || "",
              }
            : vv
        );
      }

      if (v && (nextStatus === "Declined" || nextStatus === "No Response")) {
        patchedVolunteers = (patchedVolunteers || []).map((vv) =>
          vv.id === volunteerId ? { ...vv, lastDeclinedDate: fridayISO } : vv
        );
      }

      const patchedInvites = (baseWeek.invites || []).map((inv) =>
        inv.volunteerId === volunteerId ? { ...inv, ...invitePatch } : inv
      );

      let nextState = {
        ...prev,
        volunteers: patchedVolunteers,
        weeks: prev.weeks.map((x) =>
          x.id === baseWeek.id ? { ...baseWeek, invites: patchedInvites } : x
        ),
      };

      if (nextStatus === "Declined" || nextStatus === "No Response") {
        const updatedWeek = nextState.weeks.find((x) => x.id === baseWeek.id) || null;
        const res = maybeBackfillAfterDrop(nextState, updatedWeek);
        nextState = res.nextState;

        if (res.didAdd && res.addedName) {
          setTimeout(() => {
            setToast(`Auto-added: ${res.addedName}`);
            setTimeout(() => setToast(""), 1200);
          }, 0);
        }
      }

      const updatedWeek2 = nextState.weeks.find((x) => x.id === baseWeek.id) || null;
      if (updatedWeek2) {
        const res2 = trimOverflowIfNeeded(nextState, updatedWeek2);
        nextState = res2.nextState;

        if (res2.didRemove && res2.removedName) {
          setTimeout(() => {
            setToast(`Auto-removed (capacity): ${res2.removedName}`);
            setTimeout(() => setToast(""), 1400);
          }, 0);
        }
      }

      return nextState;
    });
  }

  // Invite workflow actions
  function handleSendInvite(volunteerId) {
    const v = volunteersById.get(volunteerId);
    if (!v) return;
    openSmsModal("invite", v);
  }
  function handleMarkYes(volunteerId) {
    applyStatus(volunteerId, "Confirmed");
  }
  function handleMarkNo(volunteerId) {
    applyStatus(volunteerId, "Declined");
  }
  function handleSendFollowUp(volunteerId) {
    const v = volunteersById.get(volunteerId);
    if (!v) return;
    openSmsModal("followUp", v);
  }
  function handleMarkNoResponse(volunteerId) {
    applyStatus(volunteerId, "No Response");
  }

  // Coverage + badge
  const confirmedCount = week ? (week.invites || []).filter((i) => i.status === "Confirmed").length : 0;
  const minConfirmed = appState.settings.minConfirmed;
  const stillNeeded = Math.max(0, minConfirmed - confirmedCount);

  const stateBadge = !week ? "Build" : week.finalized ? "Finalized" : confirmedCount >= minConfirmed ? "Confirm" : "Invite";

  const invitesSorted = useMemo(() => {
    if (!week) return [];
    return [...(week.invites || [])].sort(
      (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
    );
  }, [week]);

  const filteredInvites = useMemo(() => {
    if (!week) return [];
    if (activeFilter === "all") return invitesSorted;
    return invitesSorted.filter((inv) => {
      if (activeFilter === "to-invite") return inv.status === "Not Invited";
      if (activeFilter === "waiting") return inv.status === "Invited";
      if (activeFilter === "confirmed") return inv.status === "Confirmed";
      if (activeFilter === "declined") return inv.status === "Declined" || inv.status === "No Response";
      return true;
    });
  }, [week, invitesSorted, activeFilter]);

  function handleFinalizeWeek() {
    if (!week) return;
    if (confirmedCount < minConfirmed) return;

    setAppState((prev) => ({
      ...prev,
      weeks: prev.weeks.map((w) => (w.id === week.id ? { ...w, finalized: true } : w)),
    }));
  }

  function handleCopyReminderForVolunteer(volunteerId) {
    const v = volunteersById.get(volunteerId);
    if (!v) return;
    openSmsModal("reminder", v);
  }

  // NOTE: handler kept, but button removed from UI
  function handleDeleteThisWeek() {
    if (!week) return;
    const ok = window.confirm(`Delete the list for ${formatFriendlyDate(fridayISO)}?\n\nThis cannot be undone.`);
    if (!ok) return;

    setShowLastMinute(false);
    setAltPromptOpen(false);

    setAppState((prev) => ({
      ...prev,
      weeks: prev.weeks.filter((w) => w.id !== week.id),
    }));
  }

  // Friday nudge
  const showFinalizeNudgeBanner = !!week && !week.finalized && inFridayFinalizeWindowCentral(new Date());
  useEffect(() => {
    if (!week) return;
    if (week.finalized) return;

    const tick = () => {
      if (!inFridayFinalizeWindowCentral(new Date())) return;
      const { hour, minute } = getCentralParts(new Date());
      if (minute !== 0) return;
      if (lastNudgeHour === hour) return;
      setLastNudgeHour(hour);
      setToast("Reminder: finalize this week’s list ✅");
      setTimeout(() => setToast(""), 1600);
    };

    tick();
    const id = setInterval(tick, 60 * 1000);
    return () => clearInterval(id);
  }, [week?.id, week?.finalized, lastNudgeHour]);

  // Suggested Next Up (only when NOT finalized)
  const suggestedNextUp = useMemo(() => {
    if (!week) return [];
    const excludeIds = new Set((week.invites || []).map((i) => i.volunteerId));
    return sortInviteCandidates(appState.volunteers || [], fridayISO, { excludeIds, onlyActive: true });
  }, [appState.volunteers, week, fridayISO]);

  function SafetyNotes({ v }) {
    const notes = getSafetyNotes(v, fridayISO);
    if (!notes.length) return null;
    return (
      <div style={styles.notesWrap}>
        {notes.map((line, idx) => (
          <div key={idx} style={styles.noteLine}>
            {line}
          </div>
        ))}
      </div>
    );
  }

  // Edit status modal helpers
  function openEditStatus(volunteerId, currentStatus) {
    setEditStatus({ open: true, volunteerId, nextStatus: currentStatus || "Invited" });
  }
  function closeEditStatus() {
    setEditStatus({ open: false, volunteerId: null, nextStatus: "Invited" });
  }

  // First Step Lead derived data
  const firstStepLead = useMemo(() => (week ? ensureFirstStepLead(week).firstStepLead : null), [week]);
  const confirmedVolunteersForFirstStepLead = useMemo(() => {
    if (!week) return [];
    const ids = (week.invites || []).filter((i) => i.status === "Confirmed").map((i) => i.volunteerId);
    return ids.map((id) => volunteersById.get(id)).filter(Boolean);
  }, [week, volunteersById]);

  function requestFirstStepLead(volunteerId) {
    const v = volunteersById.get(volunteerId);
    if (!v) return;
    openSmsModal("firstStepLead", v);
  }

  function setFirstStepLeadResponse(nextStatus) {
    if (!week) return;
    const nowISO = new Date().toISOString();

    setAppState((prev) =>
      patchWeek(prev, week.id, (w) => {
        const ww = ensureFirstStepLead(w);
        const fsl = { ...ww.firstStepLead };

        if (fsl.status !== "waiting" || !fsl.volunteerId) return ww;

        const currentVolunteerId = fsl.volunteerId;
        fsl.responseAt = nowISO;

        if (nextStatus === "confirmed") {
          fsl.status = "confirmed";
        } else {
          fsl.status = "idle";
          fsl.volunteerId = null;
          fsl.requestedAt = null;
        }

        const history = Array.isArray(fsl.history) ? [...fsl.history] : [];
        for (let i = history.length - 1; i >= 0; i--) {
          const row = history[i];
          if (row?.volunteerId === currentVolunteerId && row?.status === "waiting") {
            history[i] = { ...row, status: nextStatus, responseAt: nowISO };
            break;
          }
        }
        fsl.history = history;

        return { ...ww, firstStepLead: fsl };
      })
    );
  }

  // ✅ Accordion row renderer (no scroll-jump)
  function InviteAccordionRow({ inv }) {
    const v = volunteersById.get(inv.volunteerId);
    if (!v) return null;

    const isOpen = expandedInviteId === inv.id;

    const phoneFmt = formatPhoneUS(v.phone);
    const role = getRole(v);
    const cadenceKey = getCadenceKey(v, "monthly");
    const nextInviteISO = getNextInviteISOForDisplay(v);
    const nextInviteLabel = nextInviteISO ? formatFriendlyDate(nextInviteISO) : "—";

    return (
      <div style={{ ...styles.invAccRow, border: `1px solid ${THEME.border}` }}>
        <div
          role="button"
          tabIndex={0}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setExpandedInviteId((cur) => (cur === inv.id ? null : inv.id))}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setExpandedInviteId((cur) => (cur === inv.id ? null : inv.id));
            }
          }}
          style={{
            width: "100%",
            textAlign: "left",
            background: "transparent",
            padding: 10,
            cursor: "pointer",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 950, color: THEME.navy, lineHeight: 1.15 }}>{v.name}</div>

            <div style={{ fontSize: 12, color: THEME.muted, marginTop: 4 }}>{phoneFmt || v.phone}</div>

            <div
              style={{
                fontSize: 12,
                color: THEME.muted,
                marginTop: 4,
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                alignItems: "center",
              }}
            >
              <span>
                <b style={{ color: THEME.navy }}>{role}</b> • {cadenceKey}
              </span>
              <span>First-time: {v.firstTime ? "Yes" : "No"}</span>
              <span>Next Invite: {nextInviteLabel}</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <span style={basePillStyle(inv.status)}>{inv.status}</span>
            <span style={{ fontWeight: 950, color: THEME.muted }}>{isOpen ? "▲" : "▼"}</span>
          </div>
        </div>

        {isOpen ? (
          <div style={{ padding: 10, borderTop: `1px solid ${THEME.border}` }}>
            <SafetyNotes v={v} />

            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {inv.status === "Not Invited" ? (
                <button
                  type="button"
                  style={baseButtonStyle({
                    hovered: hoveredBtn === `small:sendInvite:${inv.id}`,
                    disabled: false,
                    variant: "small",
                  })}
                  onMouseEnter={() => setHoveredBtn(`small:sendInvite:${inv.id}`)}
                  onMouseLeave={() => setHoveredBtn(null)}
                  onClick={() => handleSendInvite(inv.volunteerId)}
                >
                  Send Invite
                </button>
              ) : null}

              {inv.status === "Invited" ? (
                <>
                  <button
                    type="button"
                    style={baseButtonStyle({
                      hovered: hoveredBtn === `small:yes:${inv.id}`,
                      disabled: false,
                      variant: "small",
                    })}
                    onMouseEnter={() => setHoveredBtn(`small:yes:${inv.id}`)}
                    onMouseLeave={() => setHoveredBtn(null)}
                    onClick={() => handleMarkYes(inv.volunteerId)}
                  >
                    Mark Yes
                  </button>

                  <button
                    type="button"
                    style={baseButtonStyle({
                      hovered: hoveredBtn === `small:no:${inv.id}`,
                      disabled: false,
                      variant: "small",
                    })}
                    onMouseEnter={() => setHoveredBtn(`small:no:${inv.id}`)}
                    onMouseLeave={() => setHoveredBtn(null)}
                    onClick={() => handleMarkNo(inv.volunteerId)}
                  >
                    Mark No
                  </button>

                  <button
                    type="button"
                    style={baseButtonStyle({
                      hovered: hoveredBtn === `small:follow:${inv.id}`,
                      disabled: false,
                      variant: "small",
                    })}
                    onMouseEnter={() => setHoveredBtn(`small:follow:${inv.id}`)}
                    onMouseLeave={() => setHoveredBtn(null)}
                    onClick={() => handleSendFollowUp(inv.volunteerId)}
                    title={inv.followUpSentAt ? "Follow-up already sent" : "Send follow-up"}
                  >
                    {inv.followUpSentAt ? "Follow-Up Sent ✅" : "Send Follow-Up"}
                  </button>

                  <button
                    type="button"
                    style={baseButtonStyle({
                      hovered: hoveredBtn === `small:noresp:${inv.id}`,
                      disabled: false,
                      variant: "small",
                    })}
                    onMouseEnter={() => setHoveredBtn(`small:noresp:${inv.id}`)}
                    onMouseLeave={() => setHoveredBtn(null)}
                    onClick={() => handleMarkNoResponse(inv.volunteerId)}
                  >
                    Mark No Response
                  </button>
                </>
              ) : null}

              <button
                type="button"
                style={baseButtonStyle({
                  hovered: hoveredBtn === `small:edit:${inv.id}`,
                  disabled: false,
                  variant: "small",
                })}
                onMouseEnter={() => setHoveredBtn(`small:edit:${inv.id}`)}
                onMouseLeave={() => setHoveredBtn(null)}
                onClick={() => openEditStatus(inv.volunteerId, inv.status)}
              >
                Edit Status
              </button>

              <button
                type="button"
                style={{
                  ...baseButtonStyle({
                    hovered: hoveredBtn === `small:remove:${inv.id}`,
                    disabled: false,
                    variant: "small",
                  }),
                  border:
                    hoveredBtn === `small:remove:${inv.id}`
                      ? "1px solid rgba(185, 28, 28, 0.9)"
                      : "1px solid rgba(185, 28, 28, 0.45)",
                  color: hoveredBtn === `small:remove:${inv.id}` ? "#FFFFFF" : "rgba(185, 28, 28, 0.95)",
                  background:
                    hoveredBtn === `small:remove:${inv.id}` ? "rgba(185, 28, 28, 0.95)" : "transparent",
                }}
                onMouseEnter={() => setHoveredBtn(`small:remove:${inv.id}`)}
                onMouseLeave={() => setHoveredBtn(null)}
                onClick={() => {
                  const ok = window.confirm(`Remove ${v.name} from this week’s list?`);
                  if (!ok) return;
                  removeFromThisWeek(inv.volunteerId);
                }}
              >
                Remove
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // Suggested Next Up UI should hide when finalized
  const showSuggestedNextUp = !!week && !week.finalized;

  // Step 3 reminder list
  const confirmedInvites = week ? (week.invites || []).filter((inv) => inv.status === "Confirmed") : [];

  return (
    <div style={{ background: THEME.bg, minHeight: "100vh", paddingBottom: 30 }}>
      <h2 style={{ marginTop: 0, color: THEME.navy }}>This Friday</h2>
      <StatusKey />

      {/* STEP 1 */}
      <section style={styles.stepCard}>
        <div style={styles.accentLine} />
        <div style={styles.stepHeader}>
          <div>
            <div style={styles.stepTitle}>Step 1 — Build the List</div>
            <div style={styles.stepSubtitle}>{formatFriendlyDate(fridayISO)}</div>
          </div>
          <span style={{ ...styles.badge, color: THEME.navy, border: `1px solid ${THEME.border}` }}>
            {stateBadge}
          </span>
        </div>

        <div style={{ marginTop: 10, opacity: 0.95, lineHeight: 1.35, color: THEME.navy }}>
          <div>
            <b>Confirmed:</b> {confirmedCount}
          </div>
          <div>
            <b>Goal:</b> {minConfirmed}–{appState.settings.maxVolunteers}{" "}
            <span style={{ opacity: 0.7 }}>(preferred {appState.settings.preferredConfirmed})</span>
          </div>
          <div>
            <b>Still Needed (minimum):</b> {stillNeeded}
          </div>
        </div>

        {showFinalizeNudgeBanner ? (
          <div style={styles.nudgeBanner}>
            Friday reminder window is active (12pm–7pm Central). Please finalize the list when edits are done.
          </div>
        ) : null}

        {!week ? (
          <button
            type="button"
            onClick={createWeekIfMissing}
            style={baseButtonStyle({
              hovered: hoveredBtn === "primary:createWeek",
              disabled: false,
              variant: "primary",
            })}
            onMouseEnter={() => setHoveredBtn("primary:createWeek")}
            onMouseLeave={() => setHoveredBtn(null)}
          >
            Create This Week
          </button>
        ) : (
          <div style={{ marginTop: 10, color: THEME.muted, fontWeight: 900 }}>List created ✅</div>
        )}

        {week ? (
          <button
            type="button"
            onClick={handleCopyListForChair}
            style={baseButtonStyle({
              hovered: hoveredBtn === "primary:copyChair",
              disabled: false,
              variant: "primary",
            })}
            onMouseEnter={() => setHoveredBtn("primary:copyChair")}
            onMouseLeave={() => setHoveredBtn(null)}
          >
            Copy List for Chair
          </button>
        ) : null}

        {/* Required Roles */}
        {week ? (
          <div style={{ marginTop: 14 }}>
            <div style={styles.inlineHeaderRow}>
              <div style={{ fontWeight: 950, color: THEME.navy }}>Required Roles</div>
              <div style={{ fontSize: 12, color: THEME.muted }}>Pinned every week</div>
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {CORE_ROLE_ORDER.map((requiredRole) => {
                const primary = volunteersByRole.get(requiredRole) || null;

                const swap = coverageSwapByRequiredRole.get(requiredRole) || null;
                const effectiveVolunteer = swap?.coveredByVolunteer || primary;
                const coveredByAlt = !!swap;

                if (!effectiveVolunteer) {
                  return (
                    <div key={requiredRole} style={styles.roleRow}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 900, color: THEME.navy }}>{requiredRole}</div>
                        <div style={{ fontSize: 12, color: THEME.muted }}>
                          No volunteer assigned this role yet. Set it in Volunteers.
                        </div>
                      </div>
                      <span style={basePillStyle("Not Invited")}>Unassigned</span>
                    </div>
                  );
                }

                const inv = inviteByVolunteerId.get(effectiveVolunteer.id) || null;
                const status = inv?.status || "Not Invited";

                const phoneFmt = formatPhoneUS(effectiveVolunteer.phone);
                const cadenceKey = getCadenceKey(effectiveVolunteer, "monthly");
                const nextInviteISO = getNextInviteISOForDisplay(effectiveVolunteer);
                const nextInviteLabel = nextInviteISO ? formatFriendlyDate(nextInviteISO) : "—";

                return (
                  <div key={requiredRole} style={styles.roleRow}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, color: THEME.navy }}>
                        {requiredRole}: {effectiveVolunteer.name}
                        {coveredByAlt ? (
                          <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 900, color: THEME.teal }}>
                            (Covered by Alt)
                          </span>
                        ) : null}
                      </div>

                      <div style={{ fontSize: 12, color: THEME.muted, marginTop: 2 }}>
                        {phoneFmt || effectiveVolunteer.phone}
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          color: THEME.muted,
                          marginTop: 4,
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 10,
                          alignItems: "center",
                        }}
                      >
                        <span>
                          <b style={{ color: THEME.navy }}>{getRole(effectiveVolunteer)}</b> • {cadenceKey}
                        </span>
                        <span>First-time: {effectiveVolunteer.firstTime ? "Yes" : "No"}</span>
                        <span>Next Invite: {nextInviteLabel}</span>
                        <span>{effectiveVolunteer.active ? "Active" : "Paused"}</span>
                      </div>

                      <SafetyNotes v={effectiveVolunteer} />
                    </div>

                    <div style={{ display: "grid", gap: 6, minWidth: 150 }}>
                      <span style={basePillStyle(status)}>{status}</span>

                      {!inv ? (
                        <button
                          type="button"
                          style={baseButtonStyle({
                            hovered: hoveredBtn === `small:reqAdd:${effectiveVolunteer.id}`,
                            disabled: !effectiveVolunteer.active,
                            variant: "small",
                          })}
                          onMouseEnter={() => setHoveredBtn(`small:reqAdd:${effectiveVolunteer.id}`)}
                          onMouseLeave={() => setHoveredBtn(null)}
                          onClick={() => addVolunteerToThisWeek(effectiveVolunteer.id)}
                          disabled={!effectiveVolunteer.active}
                        >
                          Add to This Week
                        </button>
                      ) : (
                        <button
                          type="button"
                          style={baseButtonStyle({ hovered: false, disabled: true, variant: "small" })}
                          disabled
                        >
                          Added ✅
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {week ? (
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <button
              type="button"
              onClick={() => setShowLastMinute(true)}
              style={baseButtonStyle({
                hovered: hoveredBtn === "primary:lastMinute",
                disabled: false,
                variant: "primary",
              })}
              onMouseEnter={() => setHoveredBtn("primary:lastMinute")}
              onMouseLeave={() => setHoveredBtn(null)}
            >
              Add Last-Minute Volunteer
            </button>

            {/* ✅ REMOVED: Delete This Week (Dev) button
                - The handler still exists to preserve logic, but the UI is gone to prevent accidental taps.
            */}
          </div>
        ) : null}
      </section>

      {/* STEP 2 */}
      {week ? (
        <section style={styles.stepCard}>
          <div style={styles.accentLine} />
          <div style={styles.stepHeader}>
            <div>
              <div style={styles.stepTitle}>Step 2 — Invite & Track</div>
              <div style={styles.stepSubtitle}>Filter + tap a row to expand actions</div>
            </div>
          </div>

          <div style={styles.chipRow}>
            {[
              { key: "all", label: "All" },
              { key: "to-invite", label: "To Invite" },
              { key: "waiting", label: "Waiting" },
              { key: "confirmed", label: "Confirmed" },
              { key: "declined", label: "Declined" },
            ].map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setActiveFilter(c.key)}
                style={chipStyle({ active: activeFilter === c.key, hovered: hoveredChip === c.key })}
                onMouseEnter={() => setHoveredChip(c.key)}
                onMouseLeave={() => setHoveredChip(null)}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {filteredInvites.length === 0 ? (
              <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${THEME.border}`, color: THEME.muted }}>
                No volunteers in this category.
              </div>
            ) : (
              filteredInvites.map((inv) => <InviteAccordionRow key={inv.id} inv={inv} />)
            )}
          </div>

          {/* Suggested Next Up */}
          {showSuggestedNextUp ? (
            <div style={{ marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setShowAddVolunteers((v) => !v)}
                style={baseButtonStyle({
                  hovered: hoveredBtn === "small:toggleAddList",
                  disabled: false,
                  variant: "small",
                })}
                onMouseEnter={() => setHoveredBtn("small:toggleAddList")}
                onMouseLeave={() => setHoveredBtn(null)}
              >
                {showAddVolunteers ? "Hide Add Volunteers" : "Show Add Volunteers"}
              </button>

              {showAddVolunteers ? (
                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  {(appState.volunteers || [])
                    .filter((v) => v.active && !inviteByVolunteerId.has(v.id))
                    .sort((a, b) => {
                      const ra = roleRank(getRole(a));
                      const rb = roleRank(getRole(b));
                      if (ra !== rb) return ra - rb;
                      return (a.name || "").localeCompare(b.name || "");
                    })
                    .map((v) => (
                      <div key={v.id} style={styles.simpleRow}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 950, color: THEME.navy }}>{v.name}</div>
                          <div style={{ fontSize: 12, color: THEME.muted, marginTop: 4 }}>
                            {formatPhoneUS(v.phone) || v.phone}
                          </div>
                          <div style={{ fontSize: 12, color: THEME.muted, marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <span>
                              <b style={{ color: THEME.navy }}>{getRole(v)}</b> • {getCadenceKey(v, "monthly")}
                            </span>
                            <span>First-time: {v.firstTime ? "Yes" : "No"}</span>
                            <span>Next Invite: {getNextInviteISOForDisplay(v) ? formatFriendlyDate(getNextInviteISOForDisplay(v)) : "—"}</span>
                          </div>
                          <SafetyNotes v={v} />
                        </div>

                        <button
                          type="button"
                          style={baseButtonStyle({
                            hovered: hoveredBtn === `small:add:${v.id}`,
                            disabled: false,
                            variant: "small",
                          })}
                          onMouseEnter={() => setHoveredBtn(`small:add:${v.id}`)}
                          onMouseLeave={() => setHoveredBtn(null)}
                          onClick={() => addVolunteerToThisWeek(v.id)}
                        >
                          Add to This Week
                        </button>
                      </div>
                    ))}
                </div>
              ) : null}

              <div style={{ marginTop: 16 }}>
                <div style={styles.inlineHeaderRow}>
                  <div style={{ fontWeight: 950, color: THEME.navy }}>Suggested Next Up</div>
                  <div style={{ fontSize: 12, color: THEME.muted }}>Due-first ordering</div>
                </div>

                {suggestedNextUp.length === 0 ? (
                  <div style={{ marginTop: 10, color: THEME.muted }}>No candidates available.</div>
                ) : (
                  <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                    {suggestedNextUp.slice(0, 8).map(({ v, dueNow }) => (
                      <div key={v.id} style={styles.simpleRow}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 950, color: THEME.navy }}>{v.name}</div>
                          <div style={{ fontSize: 12, color: THEME.muted, marginTop: 4 }}>
                            {formatPhoneUS(v.phone) || v.phone}
                          </div>
                          <div style={{ fontSize: 12, color: THEME.muted, marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <span>
                              <b style={{ color: THEME.navy }}>{getRole(v)}</b> • {getCadenceKey(v, "monthly")}
                            </span>
                            <span>First-time: {v.firstTime ? "Yes" : "No"}</span>
                            <span>Next Invite: {getNextInviteISOForDisplay(v) ? formatFriendlyDate(getNextInviteISOForDisplay(v)) : "—"}</span>
                            <span style={{ fontWeight: 900, color: dueNow ? THEME.navy : THEME.muted }}>
                              {dueNow ? "Due ✅" : "Not due"}
                            </span>
                          </div>
                          <SafetyNotes v={v} />
                        </div>

                        <button
                          type="button"
                          style={baseButtonStyle({
                            hovered: hoveredBtn === `small:suggest:${v.id}`,
                            disabled: false,
                            variant: "small",
                          })}
                          onMouseEnter={() => setHoveredBtn(`small:suggest:${v.id}`)}
                          onMouseLeave={() => setHoveredBtn(null)}
                          onClick={() => addVolunteerToThisWeek(v.id)}
                        >
                          Add to This Week
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {toast ? <div style={styles.toast}>{toast}</div> : null}
        </section>
      ) : null}

      {/* STEP 3 */}
      {week ? (
        <section style={styles.stepCard}>
          <div style={styles.accentLine} />
          <div style={styles.stepHeader}>
            <div>
              <div style={styles.stepTitle}>Step 3 — Finalize & Remind</div>
              <div style={styles.stepSubtitle}>Finalize when edits are done</div>
            </div>
          </div>

          {!week.finalized ? (
            <>
              <button
                type="button"
                onClick={handleFinalizeWeek}
                disabled={confirmedCount < minConfirmed}
                style={baseButtonStyle({
                  hovered: hoveredBtn === "primary:finalize",
                  disabled: confirmedCount < minConfirmed,
                  variant: "primary",
                })}
                onMouseEnter={() => setHoveredBtn("primary:finalize")}
                onMouseLeave={() => setHoveredBtn(null)}
              >
                Finalize List
              </button>
            </>
          ) : (
            <div style={{ marginTop: 10, fontWeight: 900, color: THEME.navy }}>List Finalized ✅</div>
          )}

          {week.finalized ? (
            <div style={{ marginTop: 14 }}>
              <div style={styles.inlineHeaderRow}>
                <div style={{ fontWeight: 950, color: THEME.navy }}>Friday Reminder (Confirmed Only)</div>
                <div style={{ fontSize: 12, color: THEME.muted }}>Button changes after sent</div>
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {confirmedInvites.map((inv) => {
                  const v = volunteersById.get(inv.volunteerId);
                  if (!v) return null;

                  return (
                    <div key={inv.id} style={styles.simpleRow}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 950, color: THEME.navy }}>{v.name}</div>
                        <div style={{ fontSize: 12, color: THEME.muted, marginTop: 4 }}>
                          {formatPhoneUS(v.phone) || v.phone}
                        </div>
                        <div style={{ fontSize: 12, color: THEME.muted, marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <span>
                            <b style={{ color: THEME.navy }}>{getRole(v)}</b>
                          </span>
                          <span>First-time: {v.firstTime ? "Yes" : "No"}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        style={baseButtonStyle({
                          hovered: hoveredBtn === `small:rem:${inv.id}`,
                          disabled: false,
                          variant: "small",
                        })}
                        onMouseEnter={() => setHoveredBtn(`small:rem:${inv.id}`)}
                        onMouseLeave={() => setHoveredBtn(null)}
                        onClick={() => handleCopyReminderForVolunteer(inv.volunteerId)}
                      >
                        {inv.reminderSentAt ? "Reminder Sent ✅" : "Send Reminder"}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* 1st Step Lead */}
              <div style={{ marginTop: 18 }}>
                <div style={styles.inlineHeaderRow}>
                  <div style={{ fontWeight: 950, color: THEME.navy }}>Assign 1st Step Lead</div>
                  <div style={{ fontSize: 12, color: THEME.muted }}>Request one volunteer</div>
                </div>

                {firstStepLead?.status === "confirmed" && firstStepLead?.volunteerId ? (
                  <div style={{ marginTop: 10, padding: 12, borderRadius: 12, border: `1px solid ${THEME.border}` }}>
                    <div style={{ fontWeight: 950, color: THEME.navy }}>
                      1st Step Lead Confirmed: {volunteersById.get(firstStepLead.volunteerId)?.name || "—"}
                    </div>
                  </div>
                ) : null}

                {firstStepLead?.status === "waiting" && firstStepLead?.volunteerId ? (
                  <div style={{ marginTop: 10, padding: 12, borderRadius: 12, border: `1px solid ${THEME.border}` }}>
                    <div style={{ fontWeight: 950, color: THEME.navy }}>
                      Waiting on response from: {volunteersById.get(firstStepLead.volunteerId)?.name || "—"}
                    </div>

                    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                      <button
                        type="button"
                        style={baseButtonStyle({ hovered: hoveredBtn === "small:fslYes", disabled: false, variant: "small" })}
                        onMouseEnter={() => setHoveredBtn("small:fslYes")}
                        onMouseLeave={() => setHoveredBtn(null)}
                        onClick={() => setFirstStepLeadResponse("confirmed")}
                      >
                        Yes (Confirmed)
                      </button>

                      <button
                        type="button"
                        style={baseButtonStyle({ hovered: hoveredBtn === "small:fslNo", disabled: false, variant: "small" })}
                        onMouseEnter={() => setHoveredBtn("small:fslNo")}
                        onMouseLeave={() => setHoveredBtn(null)}
                        onClick={() => setFirstStepLeadResponse("declined")}
                      >
                        No
                      </button>

                      <button
                        type="button"
                        style={baseButtonStyle({ hovered: hoveredBtn === "small:fslNR", disabled: false, variant: "small" })}
                        onMouseEnter={() => setHoveredBtn("small:fslNR")}
                        onMouseLeave={() => setHoveredBtn(null)}
                        onClick={() => setFirstStepLeadResponse("no-response")}
                      >
                        No Response
                      </button>
                    </div>
                  </div>
                ) : null}

                {firstStepLead?.status === "idle" ? (
                  <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                    {confirmedVolunteersForFirstStepLead.map((v) => (
                      <div key={v.id} style={styles.simpleRow}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 950, color: THEME.navy }}>{v.name}</div>
                          <div style={{ fontSize: 12, color: THEME.muted, marginTop: 4 }}>
                            {formatPhoneUS(v.phone) || v.phone}
                          </div>
                        </div>

                        <button
                          type="button"
                          style={baseButtonStyle({
                            hovered: hoveredBtn === `small:fslReq:${v.id}`,
                            disabled: false,
                            variant: "small",
                          })}
                          onMouseEnter={() => setHoveredBtn(`small:fslReq:${v.id}`)}
                          onMouseLeave={() => setHoveredBtn(null)}
                          onClick={() => requestFirstStepLead(v.id)}
                        >
                          Request 1st Step Lead
                        </button>
                      </div>
                    ))}

                    {confirmedVolunteersForFirstStepLead.length === 0 ? (
                      <div style={{ marginTop: 8, color: THEME.muted }}>No confirmed volunteers available.</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* LAST-MINUTE MODAL */}
      {showLastMinute ? (
        <div style={styles.modalBackdrop} onClick={() => setShowLastMinute(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.row}>
              <div style={{ fontWeight: 900, color: THEME.navy }}>Add Last-Minute Volunteer</div>
              <button
                type="button"
                style={baseButtonStyle({ hovered: hoveredBtn === "small:closeLM", disabled: false, variant: "small" })}
                onMouseEnter={() => setHoveredBtn("small:closeLM")}
                onMouseLeave={() => setHoveredBtn(null)}
                onClick={() => setShowLastMinute(false)}
              >
                Close
              </button>
            </div>

            {eligibleLastMinute.length === 0 ? (
              <div style={{ marginTop: 10, color: THEME.muted }}>No eligible volunteers available.</div>
            ) : (
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {eligibleLastMinute.map((v) => (
                  <div key={v.id} style={styles.simpleRow}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, color: THEME.navy }}>{v.name}</div>
                      <div style={{ fontSize: 12, color: THEME.muted, marginTop: 4 }}>
                        {formatPhoneUS(v.phone) || v.phone}
                      </div>
                    </div>

                    <button
                      type="button"
                      style={baseButtonStyle({ hovered: hoveredBtn === `small:lmAdd:${v.id}`, disabled: false, variant: "small" })}
                      onMouseEnter={() => setHoveredBtn(`small:lmAdd:${v.id}`)}
                      onMouseLeave={() => setHoveredBtn(null)}
                      onClick={() => {
                        addVolunteerToThisWeek(v.id);
                        setShowLastMinute(false);
                      }}
                    >
                      Add to This Week
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* EDIT STATUS MODAL */}
      {editStatus.open ? (
        <div style={styles.modalBackdrop} onClick={closeEditStatus}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.row}>
              <div style={{ fontWeight: 1000, color: THEME.navy }}>Edit Status</div>
              <button
                type="button"
                style={baseButtonStyle({ hovered: hoveredBtn === "small:closeEdit", disabled: false, variant: "small" })}
                onMouseEnter={() => setHoveredBtn("small:closeEdit")}
                onMouseLeave={() => setHoveredBtn(null)}
                onClick={closeEditStatus}
              >
                Close
              </button>
            </div>

            {(() => {
              const v = volunteersById.get(editStatus.volunteerId);
              const inv = week ? inviteByVolunteerId.get(editStatus.volunteerId) : null;
              if (!v || !inv) return null;

              return (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 1000, color: THEME.navy }}>{v.name}</div>
                  <div style={{ fontSize: 12, color: THEME.muted, marginTop: 4 }}>
                    Current: <b>{inv.status}</b>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: THEME.navy }}>
                      Set new status
                    </label>
                    <select
                      value={editStatus.nextStatus}
                      onChange={(e) => setEditStatus((s) => ({ ...s, nextStatus: e.target.value }))}
                      style={{
                        width: "100%",
                        marginTop: 6,
                        padding: "10px 10px",
                        borderRadius: 12,
                        border: `1px solid ${THEME.border}`,
                        background: THEME.bg,
                        color: THEME.navy,
                        fontWeight: 900,
                      }}
                    >
                      {STATUS_ORDER.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>

                    <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                      <button
                        type="button"
                        style={baseButtonStyle({ hovered: hoveredBtn === "primary:applyEdit", disabled: false, variant: "primary" })}
                        onMouseEnter={() => setHoveredBtn("primary:applyEdit")}
                        onMouseLeave={() => setHoveredBtn(null)}
                        onClick={() => {
                          applyStatus(editStatus.volunteerId, editStatus.nextStatus);
                          closeEditStatus();
                        }}
                      >
                        Apply Change
                      </button>

                      <button
                        type="button"
                        style={baseButtonStyle({ hovered: hoveredBtn === "primary:cancelEdit", disabled: false, variant: "primary" })}
                        onMouseEnter={() => setHoveredBtn("primary:cancelEdit")}
                        onMouseLeave={() => setHoveredBtn(null)}
                        onClick={closeEditStatus}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      ) : null}

      {/* SMS MODAL */}
      {smsModal.open ? (
        <div style={styles.modalBackdrop} onClick={closeSmsModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.row}>
              <div style={{ fontWeight: 1000, color: THEME.navy }}>
                {smsModal.kind === "invite"
                  ? "Send Invite"
                  : smsModal.kind === "followUp"
                  ? "Send Follow-Up"
                  : smsModal.kind === "reminder"
                  ? "Send Reminder"
                  : "Request 1st Step Lead"}
              </div>

              <button
                type="button"
                style={baseButtonStyle({ hovered: hoveredBtn === "small:closeSms", disabled: false, variant: "small" })}
                onMouseEnter={() => setHoveredBtn("small:closeSms")}
                onMouseLeave={() => setHoveredBtn(null)}
                onClick={closeSmsModal}
              >
                Close
              </button>
            </div>

            <div style={{ marginTop: 10, color: THEME.navy, lineHeight: 1.35 }}>
              <div style={{ fontWeight: 1000 }}>{smsModal.name}</div>
              <div style={{ fontSize: 12, color: THEME.muted, marginTop: 4 }}>
                {formatPhoneUS(smsModal.phone) || smsModal.phone}
              </div>
            </div>

            <div
              style={{
                marginTop: 12,
                padding: 10,
                borderRadius: 12,
                border: `1px solid ${THEME.border}`,
                background: THEME.bg,
                color: THEME.navy,
                whiteSpace: "pre-wrap",
                lineHeight: 1.35,
                fontSize: 13,
              }}
            >
              {smsModal.message}
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              <button
                type="button"
                style={baseButtonStyle({ hovered: hoveredBtn === "primary:openSms", disabled: false, variant: "primary" })}
                onMouseEnter={() => setHoveredBtn("primary:openSms")}
                onMouseLeave={() => setHoveredBtn(null)}
                onClick={() => {
                  const link = buildSmsLink(smsModal.phone, smsModal.message);
                  window.location.href = link;
                  applyAfterSend(smsModal.kind, smsModal.volunteerId);
                  closeSmsModal();
                }}
              >
                Open Text App
              </button>

              <button
                type="button"
                style={baseButtonStyle({ hovered: hoveredBtn === "primary:copySms", disabled: false, variant: "primary" })}
                onMouseEnter={() => setHoveredBtn("primary:copySms")}
                onMouseLeave={() => setHoveredBtn(null)}
                onClick={() => {
                  copyText(smsModal.message);
                  applyAfterSend(smsModal.kind, smsModal.volunteerId);
                  closeSmsModal();
                }}
              >
                Copy Message
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ALT ROLE PROMPT MODAL */}
      {altPromptOpen ? (
        <div style={styles.modalBackdrop} onClick={() => setAltPromptOpen(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.row}>
              <div style={{ fontWeight: 1000, color: THEME.navy }}>Coverage Check — Add Alt Roles?</div>

              <button
                type="button"
                style={baseButtonStyle({ hovered: hoveredBtn === "small:closeAlt", disabled: false, variant: "small" })}
                onMouseEnter={() => setHoveredBtn("small:closeAlt")}
                onMouseLeave={() => setHoveredBtn(null)}
                onClick={() => setAltPromptOpen(false)}
              >
                Close
              </button>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: THEME.muted, lineHeight: 1.35 }}>
              One or more required roles aren’t covered for this week. Suggested Alt actions are based on coverage (not scheduling).
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {altRolePrompts.map((p) => {
                let btnLabel = "Assign Alt in Volunteers";
                let btnDisabled = true;
                let btnClick = () => {};

                if (p.action === "addToWeek" && p.altPerson?.id) {
                  btnLabel = "Add Alt";
                  btnDisabled = false;
                  btnClick = () => addVolunteerToThisWeek(p.altPerson.id);
                } else if (p.action === "sendInvite" && p.altPerson?.id) {
                  btnLabel = "Invite";
                  btnDisabled = false;
                  btnClick = () => handleSendInvite(p.altPerson.id);
                } else if (p.action === "openActions" && p.altPerson?.id) {
                  btnLabel = "Open Actions";
                  btnDisabled = false;
                  btnClick = () => {
                    const inv = inviteByVolunteerId.get(p.altPerson.id);
                    if (inv?.id) setExpandedInviteId(inv.id);
                    setAltPromptOpen(false);
                  };
                } else if (p.action === "confirmed") {
                  btnLabel = "Alt Confirmed ✅";
                  btnDisabled = true;
                } else if (p.action === "declined") {
                  btnLabel = "Alt Declined";
                  btnDisabled = true;
                }

                return (
                  <div
                    key={p.key}
                    style={{
                      border: `1px solid ${THEME.border}`,
                      borderRadius: 12,
                      padding: 10,
                      background: THEME.card,
                    }}
                  >
                    <div style={{ fontWeight: 950, color: THEME.navy }}>Missing: {p.requiredRole}</div>

                    <div style={{ fontSize: 12, color: THEME.muted, marginTop: 4, lineHeight: 1.35 }}>
                      Reason: <b>{p.missingReason}</b>
                    </div>

                    <div style={{ marginTop: 8, display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 900, color: THEME.navy }}>Suggested: {p.altRole}</div>
                        <div style={{ fontSize: 12, color: THEME.muted, marginTop: 2 }}>
                          {p.altPerson
                            ? `${p.altPerson.name} • ${formatPhoneUS(p.altPerson.phone) || p.altPerson.phone}`
                            : "No Alt assigned — set it in Volunteers."}
                        </div>
                      </div>

                      <button
                        type="button"
                        style={baseButtonStyle({
                          hovered: hoveredBtn === `small:altAction:${p.key}`,
                          disabled: btnDisabled,
                          variant: "small",
                        })}
                        onMouseEnter={() => setHoveredBtn(`small:altAction:${p.key}`)}
                        onMouseLeave={() => setHoveredBtn(null)}
                        disabled={btnDisabled}
                        onClick={btnClick}
                      >
                        {btnLabel}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              style={baseButtonStyle({ hovered: hoveredBtn === "primary:dismissAlt", disabled: false, variant: "primary" })}
              onMouseEnter={() => setHoveredBtn("primary:dismissAlt")}
              onMouseLeave={() => setHoveredBtn(null)}
              onClick={() => {
                localStorage.setItem(`gts:altRolePrompt:dismissed:${fridayISO}`, "1");
                setAltPromptOpen(false);
              }}
            >
              Dismiss for This Week
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Styles
const styles = {
  stepCard: {
    position: "relative",
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    border: `1px solid ${THEME.border}`,
    background: THEME.card,
    overflow: "hidden",
  },
  accentLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 4,
    background: THEME.teal,
    opacity: 0.85,
  },
  stepHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  stepTitle: { fontWeight: 1000, color: THEME.navy, letterSpacing: "-0.1px" },
  stepSubtitle: { marginTop: 4, fontSize: 12, color: THEME.muted },
  inlineHeaderRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
  badge: { fontSize: 12, fontWeight: 950, padding: "6px 10px", borderRadius: 999, background: THEME.card },
  keyWrap: { marginTop: 10, padding: 12, borderRadius: 12, border: `1px solid ${THEME.border}`, background: THEME.card },
  keyRow: { marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 },
  chipRow: { marginTop: 12, display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" },
  nudgeBanner: { marginTop: 10, padding: 10, borderRadius: 12, border: `1px solid ${THEME.border}`, background: THEME.bg, color: THEME.navy, fontWeight: 900, lineHeight: 1.35 },
  roleRow: { display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", border: `1px solid ${THEME.border}`, borderRadius: 12, padding: 10 },
  invAccRow: { borderRadius: 12, background: THEME.card, overflow: "hidden" },
  simpleRow: { display: "flex", gap: 12, justifyContent: "space-between", alignItems: "flex-start", border: `1px solid ${THEME.border}`, borderRadius: 12, padding: 10 },
  notesWrap: { marginTop: 6, display: "grid", gap: 2 },
  noteLine: { fontSize: 12, fontWeight: 900, color: THEME.muted },
  toast: { marginTop: 14, padding: 10, borderRadius: 12, border: `1px solid ${THEME.border}`, fontWeight: 900, textAlign: "center", background: THEME.card, color: THEME.navy },
  modalBackdrop: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.35)", overflowY: "auto", WebkitOverflowScrolling: "touch", display: "block", padding: 16, zIndex: 999 },
  modalCard: { width: "min(720px, 100%)", background: THEME.card, borderRadius: 14, border: `1px solid ${THEME.border}`, padding: 14, maxHeight: "calc(100vh - 32px)", overflowY: "auto", WebkitOverflowScrolling: "touch", margin: "16px auto" },
};