// src/pages/CoordinatorPage.jsx
// Gateway to Service — Coordinator Screen
//
// WHAT THIS PAGE DOES (end-to-end):
// 1) Builds/loads "This Friday" week object.
// 2) PINS required core roles (Chairperson, List Coordinator, Meeting Steward, Discussion, Big Book).
// 3) Lets you add people to this week's invite list (core roles + anyone active via "Add Volunteers").
// 4) Invite flow:
//    - Send Invite (copies invite message) -> status becomes "Invited"
//    - Mark Yes -> status "Confirmed" + saves lastConfirmedDate
//    - Mark No -> status "Declined" + saves lastDeclinedDate
//    - Send Follow-Up (copies follow-up) -> stamps followUpSentAt
//    - Mark No Response -> status "No Response" + saves lastDeclinedDate (treated like a decline later)
// 5) Finalize List:
//    - Disabled until Confirmed >= minConfirmed (default 9)
//    - Once finalized, list is "locked" conceptually (but you can still add last-minute volunteers).
// 6) Friday Reminder:
//    - Only appears AFTER finalize
//    - Only shows Confirmed volunteers
//    - Copy Reminder button next to each confirmed
// 7) Add Last-Minute Volunteer (NEW):
//    - Button in top card
//    - Opens a modal showing eligible volunteers not already on the week
//    - Choosing one adds them to "Invitations" as "Not Invited" so you can Send Invite + mark Yes/No
//
// Step 18 added:
// - Suggested Next Up (shows cooldown labels + eligible date)
// - Cooldown rules are editable via appState.settings if present,
//   otherwise defaults are used:
//   - cooldownAfterConfirmWeeks: 2
//   - cooldownAfterDeclineWeeks: 3
//
// Why this helps:
// - You can still manually add anyone (real life),
// - but the app recommends who should be next in line,
//   and flags people who recently served or declined.

// src/pages/CoordinatorPage.jsx
// Step 18.5 — Gateway Calm (Service-Warm) theme added HERE without changing logic.
// - Outlined buttons with teal hover/fill
// - Subtle app background + card borders
// - Keeps all functionality + layout exactly as you had it

// src/pages/CoordinatorPage.jsx
// Gateway to Service — Coordinator Screen
// Includes:
// - This Friday header + coverage
// - Create week if missing
// - Required Roles (pinned) + Add to This Week
// - Invitations list + Send Invite (copy) + Mark Yes/No + Follow-up + No Response
// - Finalize List (locked until Confirmed >= minConfirmed)
// - Add Last-Minute Volunteer (modal)
// - Step 18: Suggested Next Up (cooldown-aware ordering)
// - Step 18.5: Gateway Calm theme (navy/teal outline buttons + hover fill)
// - Step 21: Volunteer Status Safety (WARNINGS ONLY — no blocking)

// app/src/pages/CoordinatorPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { getUpcomingFridayISO, formatFriendlyDate } from "../utils/date.js";

// ✅ Option 2 rotation (cadence + last touch)
import {
  sortInviteCandidates,
  isEligibleThisWeek,
  getCadenceKey,
  buildAutoWeekInviteIds,
} from "../utils/rotation.js";

const CORE_ROLE_ORDER = [
  "Chairperson",
  "List Coordinator",
  "Meeting Steward",
  "Discussion Group Lead",
  "Big Book Lead",
];

// Controls sorting of invite rows in the Invitations section.
const STATUS_ORDER = ["Not Invited", "Invited", "Confirmed", "Declined", "No Response"];

// Normalize role so nobody is hidden just because role is missing
function getRole(v) {
  return v.coreRole || "Volunteer";
}

// Role sort priority for the "Add Volunteers" list.
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

// ----- Date helpers (local, safe, no new utils needed) -----
function isoToDate(iso) {
  // iso is "YYYY-MM-DD"
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

function maxISO(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

// =========================
// Gateway Calm theme tokens (NO logic changes)
// =========================
const THEME = {
  navy: "#243447", // Slate Navy (structure)
  teal: "#4A8F8B", // Muted Teal (service warmth)
  bg: "#FAFAFA", // Off-white background
  card: "#FFFFFF",
  border: "#E2E6EA",
  muted: "#6B7280",

  // Status colors (calm, readable)
  gold: "#B08D2C", // Invited
  goldBg: "rgba(176, 141, 44, 0.14)",
  greenBg: "rgba(74, 143, 139, 0.14)", // Confirmed bg (teal-tinted)
  navyBg: "rgba(36, 52, 71, 0.06)", // Not Invited bg (navy-tinted)
  red: "rgba(185, 28, 28, 0.95)", // Declined
  redBg: "rgba(185, 28, 28, 0.10)",
  grayBg: "rgba(107, 114, 128, 0.10)", // No Response
  grayBorder: "rgba(107, 114, 128, 0.35)",
};

// Button hover/fill is handled inline so you don't need a CSS refactor.
// hoveredBtn is a string key like "primary:createWeek" or "small:sendInvite:<id>"
function baseButtonStyle({ hovered, disabled, variant }) {
  // variant: "primary" or "small"
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
      return {
        fg: THEME.teal,
        bg: THEME.greenBg,
        border: "rgba(74, 143, 139, 0.55)",
      };
    case "Invited":
      return {
        fg: THEME.gold,
        bg: THEME.goldBg,
        border: "rgba(176, 141, 44, 0.55)",
      };
    case "Declined":
      return {
        fg: THEME.red,
        bg: THEME.redBg,
        border: "rgba(185, 28, 28, 0.45)",
      };
    case "No Response":
      return {
        fg: THEME.muted,
        bg: THEME.grayBg,
        border: THEME.grayBorder,
      };
    case "Not Invited":
    default:
      return {
        fg: THEME.navy,
        bg: THEME.navyBg,
        border: "rgba(36, 52, 71, 0.28)",
      };
  }
}

// Status pill tinting (calm but differentiated)
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

// Small left accent line on rows (subtle, not loud)
function rowAccentStyle(status) {
  const a = statusAccent(status);
  return {
    borderLeft: `6px solid ${a.fg}`,
    paddingLeft: 10,
  };
}

// =========================
// Step 21 — Volunteer Status Safety (WARNINGS ONLY)
// CLEANED: no extra eligible/cooldown dates shown on cards
// =========================
function servedLastWeek(fridayISO, lastConfirmedDate) {
  if (!lastConfirmedDate) return false;
  const lastWeekISO = addWeeksISO(fridayISO, -1);
  return lastConfirmedDate === lastWeekISO;
}

// "Recently declined" window (warning only)
// This is not a cooldown system — it’s just clarity.
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

  // Cadence-based “not due yet” warning (NO date spam)
  // Uses last touch (invite/confirm/decline) + cadence windows from rotation.js
  const eligibleNow = isEligibleThisWeek(v, fridayISO, "monthly");
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
  const weekday = get("weekday"); // e.g. "Fri"
  const hour = parseInt(get("hour"), 10);
  const minute = parseInt(get("minute"), 10);
  return { weekday, hour: Number.isFinite(hour) ? hour : 0, minute: Number.isFinite(minute) ? minute : 0 };
}

function inFridayFinalizeWindowCentral(now = new Date()) {
  const { weekday, hour } = getCentralParts(now);
  // Friday 12:00pm–6:59pm (meeting at 7pm)
  return weekday === "Fri" && hour >= 12 && hour < 19;
}

export default function CoordinatorPage({ appState, setAppState }) {
  // --- Week selection: always operate on the upcoming Friday ---
  const fridayISO = getUpcomingFridayISO();
  const week = appState.weeks.find((w) => w.date === fridayISO) || null;

  // Small toast for copy feedback
  const [toast, setToast] = useState("");

  // Last-minute modal state
  const [showLastMinute, setShowLastMinute] = useState(false);

  // Hover tracking for buttons
  const [hoveredBtn, setHoveredBtn] = useState(null);

  // Row edit state (status changes after-the-fact)
  const [editStatus, setEditStatus] = useState({
    open: false,
    volunteerId: null,
    nextStatus: "Invited",
  });

  // Track hourly nudges (Friday after 12pm Central until finalized)
  const [lastNudgeHour, setLastNudgeHour] = useState(null);

  // =========================
  // SMS Draft Modal (Invite / FollowUp / Reminder)
  // =========================
  const [smsModal, setSmsModal] = useState({
    open: false,
    kind: null, // "invite" | "followUp" | "reminder"
    volunteerId: null,
    phone: "",
    name: "",
    message: "",
  });

  useEffect(() => {
    const anyModalOpen = showLastMinute || smsModal.open || editStatus.open;
    if (!anyModalOpen) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev;
    };
  }, [showLastMinute, smsModal.open, editStatus.open]);

  // --- Lookups for fast access ---
  const volunteersById = useMemo(() => {
    const m = new Map();
    for (const v of appState.volunteers) m.set(v.id, v);
    return m;
  }, [appState.volunteers]);

  const volunteersByRole = useMemo(() => {
    const map = new Map();
    for (const v of appState.volunteers) {
      // This is only used by the "Required Roles" section.
      if (!v.coreRole) continue;
      map.set(v.coreRole, v);
    }
    return map;
  }, [appState.volunteers]);

  // Derived from "week" so it updates whenever week updates
  const inviteByVolunteerId = useMemo(() => {
    const m = new Map();
    if (!week) return m;
    for (const inv of week.invites) m.set(inv.volunteerId, inv);
    return m;
  }, [week]);

  // Eligible volunteers for the last-minute modal:
  // Active volunteers not already on THIS week.
  const eligibleLastMinute = useMemo(() => {
    if (!week) return [];
    return appState.volunteers
      .filter((v) => v.active && !inviteByVolunteerId.has(v.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [appState.volunteers, week, inviteByVolunteerId]);

  // =========================
  // Capacity helpers (preferred list size, not the hard max)
  // =========================
  function getTargetCount(state) {
    const preferred = state.settings.preferredConfirmed ?? 12;
    const maxVols = state.settings.maxVolunteers ?? 14;
    return Math.min(preferred, maxVols);
  }

  // "Active pool" are people still in play for this week.
  // Declined and No Response are treated as "dropped" from the pool.
  function isActivePoolStatus(status) {
    return status !== "Declined" && status !== "No Response";
  }

  function isProtectedFromAutoRemoval(volunteer) {
    const role = volunteer?.coreRole || "";
    return CORE_ROLE_ORDER.includes(role);
  }

  // =========================
  // Week patch helpers (unfinalize when edits happen)
  // =========================
  function patchWeek(prevState, weekId, patcher) {
    return {
      ...prevState,
      weeks: prevState.weeks.map((w) => {
        if (w.id !== weekId) return w;
        const next = patcher(w);
        return next;
      }),
    };
  }

  function unfinalizeWeekIfNeeded(weekObj) {
    if (!weekObj) return weekObj;
    if (!weekObj.finalized) return weekObj;
    return { ...weekObj, finalized: false };
  }

  // =========================
  // Auto Backfill (Declined / No Response)
  // =========================
  function maybeBackfillAfterDrop(nextState, weekObj, fridayISO) {
    if (!weekObj) return { nextState, didAdd: false, addedName: "" };

    // If it WAS finalized, we already unfinalized by the time we call this.
    if (weekObj.finalized) return { nextState, didAdd: false, addedName: "" };

    const targetCount = getTargetCount(nextState);
    const invites = weekObj.invites || [];
    const activePoolCount = invites.filter((i) => isActivePoolStatus(i.status)).length;

    if (activePoolCount >= targetCount) {
      return { nextState, didAdd: false, addedName: "" };
    }

    const excludeIds = new Set(invites.map((i) => i.volunteerId));

    const candidates = sortInviteCandidates(nextState.volunteers, fridayISO, {
      excludeIds,
      defaultCadence: "monthly",
      onlyActive: true,
    });

    // Prefer someone eligibleNow, else take the top candidate
    const picked = (candidates.find((c) => c.eligibleNow) || candidates[0])?.v || null;
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

  // =========================
  // Overflow handling:
  // If someone flips to YES late and we’re at capacity,
  // auto-remove the most recent auto-added "Not Invited/Invited" row
  // so the coordinator doesn’t accidentally invite extra people.
  // =========================
  function trimOverflowIfNeeded(nextState, weekObj) {
    if (!weekObj) return { nextState, didRemove: false, removedName: "" };

    const targetCount = getTargetCount(nextState);
    const invites = weekObj.invites || [];
    let activePoolCount = invites.filter((i) => isActivePoolStatus(i.status)).length;

    if (activePoolCount <= targetCount) {
      return { nextState, didRemove: false, removedName: "" };
    }

    const byId = new Map(nextState.volunteers.map((v) => [v.id, v]));
    const getInviteCreated = (inv) => inv.autoAddedAt || inv.createdAt || inv.inviteSentAt || "0000-00-00T00:00:00.000Z";

    // Candidates to remove:
    // 1) autoAdded AND (Not Invited or Invited) AND not protected role
    // 2) fallback: (Not Invited or Invited) AND not protected role
    const removable1 = invites
      .filter((inv) => inv.autoAdded && (inv.status === "Not Invited" || inv.status === "Invited"))
      .filter((inv) => !isProtectedFromAutoRemoval(byId.get(inv.volunteerId)));

    const removable2 = invites
      .filter((inv) => inv.status === "Not Invited" || inv.status === "Invited")
      .filter((inv) => !isProtectedFromAutoRemoval(byId.get(inv.volunteerId)));

    const pool = removable1.length ? removable1 : removable2;
    if (!pool.length) {
      // Nothing safe to auto-remove (we won't touch Confirmed or core roles automatically)
      return { nextState, didRemove: false, removedName: "" };
    }

    // Remove newest (most recently auto-added / created / invited)
    pool.sort((a, b) => getInviteCreated(b).localeCompare(getInviteCreated(a)));
    const toRemove = pool[0];
    const removedV = byId.get(toRemove.volunteerId);

    // Remove invite + restore volunteer "touch" if we stored prev values
    const patchedWeek = {
      ...weekObj,
      invites: invites.filter((inv) => inv.id !== toRemove.id),
    };

    let patchedVols = nextState.volunteers;

    if (removedV) {
      // Restore lastInvitedAt if this invite had set it and we stored the previous value
      if (toRemove.prevLastInvitedAt !== undefined && removedV.lastInvitedAt === fridayISO) {
        patchedVols = patchedVols.map((v) =>
          v.id === removedV.id ? { ...v, lastInvitedAt: toRemove.prevLastInvitedAt || null } : v
        );
      }
      // Restore lastConfirmedDate if we had set it via this invite edit (rare for overflow removal)
      if (toRemove.prevLastConfirmedDate !== undefined && removedV.lastConfirmedDate === fridayISO) {
        patchedVols = patchedVols.map((v) =>
          v.id === removedV.id ? { ...v, lastConfirmedDate: toRemove.prevLastConfirmedDate || null } : v
        );
      }
      // Restore lastDeclinedDate if we had set it via this invite edit (rare for overflow removal)
      if (toRemove.prevLastDeclinedDate !== undefined && removedV.lastDeclinedDate === fridayISO) {
        patchedVols = patchedVols.map((v) =>
          v.id === removedV.id ? { ...v, lastDeclinedDate: toRemove.prevLastDeclinedDate || null } : v
        );
      }
    }

    const updatedState = {
      ...nextState,
      volunteers: patchedVols,
      weeks: nextState.weeks.map((w) => (w.id === weekObj.id ? patchedWeek : w)),
    };

    activePoolCount -= 1;

    // If still overflowing (unlikely), we could loop, but we keep it simple: remove one at a time.
    // Coordinator can remove more manually if needed.

    return { nextState: updatedState, didRemove: true, removedName: removedV?.name || "" };
  }

  // =========================
  // A) Week creation (UPDATED: auto-build initial list)
  // =========================
  function createWeekIfMissing() {
    if (week) return;

    const targetCount = getTargetCount(appState);

    // ✅ Auto-build invite IDs directly here (so it works even if a helper misbehaves)
    const used = new Set();
    const initialIds = [];

    const pushId = (id) => {
      if (!id) return;
      if (used.has(id)) return;
      used.add(id);
      initialIds.push(id);
    };

    // 1) Pinned core roles (assigned + active)
    for (const role of CORE_ROLE_ORDER) {
      const v = appState.volunteers.find((x) => x.active && (x.coreRole || "") === role);
      if (v) pushId(v.id);
      if (initialIds.length >= targetCount) break;
    }

    // 2) Weekly cadence volunteers (active)
    if (initialIds.length < targetCount) {
      const weekly = appState.volunteers
        .filter((v) => v.active && getCadenceKey(v, "monthly") === "weekly")
        .sort((a, b) => {
          const ra = roleRank(getRole(a));
          const rb = roleRank(getRole(b));
          if (ra !== rb) return ra - rb;
          return (a.name || "").localeCompare(b.name || "");
        });

      for (const v of weekly) {
        if (initialIds.length >= targetCount) break;
        pushId(v.id);
      }
    }

    // 3) Fill remaining using rotation ordering (cadence + last touch)
    if (initialIds.length < targetCount) {
      const candidates = sortInviteCandidates(appState.volunteers, fridayISO, {
        excludeIds: used,
        defaultCadence: "monthly",
        onlyActive: true,
      });

      for (const item of candidates) {
        if (initialIds.length >= targetCount) break;
        pushId(item.v?.id);
      }
    }

    // Optional fallback to imported helper (rare)
    if (initialIds.length === 0 && typeof buildAutoWeekInviteIds === "function") {
      const fallbackIds = buildAutoWeekInviteIds(appState.volunteers, fridayISO, {
        targetCount,
        defaultCadence: "monthly",
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
    }));

    const newWeek = {
      id: crypto.randomUUID(),
      date: fridayISO,
      neededCount: appState.settings.maxVolunteers,
      finalized: false,
      invites: initialInvites, // ✅ auto-created list
    };

    setAppState((prev) => ({
      ...prev,
      weeks: [newWeek, ...prev.weeks],
    }));
  }

  // =========================
  // B) Add volunteer to this week (manual add)
  // =========================
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
    };

    setAppState((prev) =>
      patchWeek(prev, week.id, (w) => ({
        ...unfinalizeWeekIfNeeded(w),
        invites: [...w.invites, newInvite],
      }))
    );
  }

  // Patch a week invite record (status, timestamps, etc.)
  function updateInvite(volunteerId, patch) {
    if (!week) return;

    setAppState((prev) =>
      patchWeek(prev, week.id, (w) => ({
        ...unfinalizeWeekIfNeeded(w),
        invites: w.invites.map((inv) => (inv.volunteerId === volunteerId ? { ...inv, ...patch } : inv)),
      }))
    );
  }

  // Remove from THIS week only (should not count against volunteer).
  // If we have stored prev touch values on the invite record, restore them.
  function removeFromThisWeek(volunteerId) {
    if (!week) return;

    setAppState((prev) => {
      const w = prev.weeks.find((x) => x.id === week.id) || null;
      if (!w) return prev;

      const inv = (w.invites || []).find((i) => i.volunteerId === volunteerId) || null;

      let next = patchWeek(prev, week.id, (wk) => ({
        ...unfinalizeWeekIfNeeded(wk),
        invites: (wk.invites || []).filter((i) => i.volunteerId !== volunteerId),
      }));

      // Restore volunteer touch fields if we have prev values captured on the invite record.
      if (inv) {
        next = {
          ...next,
          volunteers: next.volunteers.map((v) => {
            if (v.id !== volunteerId) return v;

            const patch = { ...v };

            // Restore fields ONLY if the current value equals this week's fridayISO.
            if (inv.prevLastInvitedAt !== undefined && v.lastInvitedAt === fridayISO) {
              patch.lastInvitedAt = inv.prevLastInvitedAt || null;
            }
            if (inv.prevLastConfirmedDate !== undefined && v.lastConfirmedDate === fridayISO) {
              patch.lastConfirmedDate = inv.prevLastConfirmedDate || null;
            }
            if (inv.prevLastDeclinedDate !== undefined && v.lastDeclinedDate === fridayISO) {
              patch.lastDeclinedDate = inv.prevLastDeclinedDate || null;
            }

            return patch;
          }),
        };
      }

      return next;
    });
  }

  // =========================
  // C) Message helpers
  // =========================
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

  // =========================
  // SMS helpers (First-time logic + sms: link)
  // =========================
  function getTemplateFor(kind, volunteer) {
    const msgs = appState?.settings?.messages || {};
    const firstTime = !!volunteer?.firstTime;

    if (kind === "invite") {
      if (firstTime && msgs.inviteFirstTime) return msgs.inviteFirstTime;
      return msgs.invite;
    }

    if (kind === "followUp") {
      if (firstTime && msgs.followUpFirstTime) return msgs.followUpFirstTime;
      return msgs.followUp;
    }

    if (kind === "reminder") {
      if (firstTime && msgs.reminderFirstTime) return msgs.reminderFirstTime;
      return msgs.reminder;
    }

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
    setSmsModal({
      open: false,
      kind: null,
      volunteerId: null,
      phone: "",
      name: "",
      message: "",
    });
  }

  function applyAfterSend(kind, volunteerId) {
    const nowISO = new Date().toISOString();

    if (kind === "invite") {
      const v = volunteersById.get(volunteerId);

      updateInvite(volunteerId, {
        status: "Invited",
        inviteSentAt: nowISO,
        // capture prior "touch" so removal/edits can restore
        prevLastInvitedAt: v?.lastInvitedAt ?? null,
      });

      // stamp lastInvitedAt on volunteer (date-only)
      setAppState((prev) => ({
        ...prev,
        volunteers: prev.volunteers.map((vv) =>
          vv.id === volunteerId ? { ...vv, lastInvitedAt: fridayISO } : vv
        ),
      }));
    }

    if (kind === "followUp") {
      updateInvite(volunteerId, {
        followUpSentAt: nowISO,
      });
    }

    // reminder: no status changes
  }

  // =========================
  // D) Status change engine (used by buttons + Edit Status)
  // =========================
  function applyStatus(volunteerId, nextStatus) {
    if (!week) return;

    const nowISO = new Date().toISOString();

    setAppState((prev) => {
      const w = prev.weeks.find((x) => x.id === week.id) || null;
      if (!w) return prev;

      // Always unfinalize if edits happen
      const baseWeek = unfinalizeWeekIfNeeded(w);

      const currentInvite = (baseWeek.invites || []).find((i) => i.volunteerId === volunteerId) || null;
      if (!currentInvite) return prev;

      const v = prev.volunteers.find((vv) => vv.id === volunteerId) || null;

      // Build invite patch:
      let invitePatch = { status: nextStatus };

      // Normalize timestamps based on target status
      if (nextStatus === "Not Invited") {
        invitePatch = {
          ...invitePatch,
          inviteSentAt: null,
          followUpSentAt: null,
          responseAt: null,
        };
      } else if (nextStatus === "Invited") {
        invitePatch = {
          ...invitePatch,
          inviteSentAt: currentInvite.inviteSentAt || nowISO,
          responseAt: null,
        };
      } else if (nextStatus === "Confirmed" || nextStatus === "Declined" || nextStatus === "No Response") {
        invitePatch = {
          ...invitePatch,
          responseAt: nowISO,
        };
      }

      // Capture previous volunteer touch fields ONCE (so we can restore if status is corrected later)
      const ensurePrev = (key, value) => {
        if (currentInvite[key] !== undefined) return; // already captured
        invitePatch[key] = value ?? null;
      };

      // Volunteer touch updates + restore logic when switching away
      let patchedVolunteers = prev.volunteers;

      if (v) {
        // If leaving a status that wrote a touch, restore from prev stored values when applicable.
        const leavingStatus = currentInvite.status;

        // Restore lastConfirmedDate if leaving Confirmed
        if (leavingStatus === "Confirmed" && nextStatus !== "Confirmed") {
          if (currentInvite.prevLastConfirmedDate !== undefined && v.lastConfirmedDate === fridayISO) {
            patchedVolunteers = patchedVolunteers.map((vv) =>
              vv.id === volunteerId ? { ...vv, lastConfirmedDate: currentInvite.prevLastConfirmedDate || null } : vv
            );
          }
        }

        // Restore lastDeclinedDate if leaving Declined/No Response
        if ((leavingStatus === "Declined" || leavingStatus === "No Response") && nextStatus !== leavingStatus) {
          if (currentInvite.prevLastDeclinedDate !== undefined && v.lastDeclinedDate === fridayISO) {
            patchedVolunteers = patchedVolunteers.map((vv) =>
              vv.id === volunteerId ? { ...vv, lastDeclinedDate: currentInvite.prevLastDeclinedDate || null } : vv
            );
          }
        }

        // Restore lastInvitedAt if leaving Invited
        if (leavingStatus === "Invited" && nextStatus !== "Invited") {
          if (currentInvite.prevLastInvitedAt !== undefined && v.lastInvitedAt === fridayISO) {
            patchedVolunteers = patchedVolunteers.map((vv) =>
              vv.id === volunteerId ? { ...vv, lastInvitedAt: currentInvite.prevLastInvitedAt || null } : vv
            );
          }
        }

        // Now apply touch for the new status
        if (nextStatus === "Invited") {
          ensurePrev("prevLastInvitedAt", v.lastInvitedAt);
          patchedVolunteers = patchedVolunteers.map((vv) =>
            vv.id === volunteerId ? { ...vv, lastInvitedAt: fridayISO } : vv
          );
        }

        if (nextStatus === "Confirmed") {
          ensurePrev("prevLastConfirmedDate", v.lastConfirmedDate);
          patchedVolunteers = patchedVolunteers.map((vv) =>
            vv.id === volunteerId ? { ...vv, lastConfirmedDate: fridayISO } : vv
          );
        }

        if (nextStatus === "Declined" || nextStatus === "No Response") {
          ensurePrev("prevLastDeclinedDate", v.lastDeclinedDate);
          patchedVolunteers = patchedVolunteers.map((vv) =>
            vv.id === volunteerId ? { ...vv, lastDeclinedDate: fridayISO } : vv
          );
        }
      }

      // Patch invites
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

      // Backfill if someone DROPS (Declined / No Response)
      if (nextStatus === "Declined" || nextStatus === "No Response") {
        const updatedWeek = nextState.weeks.find((x) => x.id === baseWeek.id) || null;
        const res = maybeBackfillAfterDrop(nextState, updatedWeek, fridayISO);
        nextState = res.nextState;

        if (res.didAdd && res.addedName) {
          setTimeout(() => {
            setToast(`Auto-added: ${res.addedName}`);
            setTimeout(() => setToast(""), 1200);
          }, 0);
        }
      }

      // Trim overflow if someone is moved BACK into the active pool
      // (ex: No Response -> Confirmed, or Declined -> Invited, etc.)
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

  // =========================
  // D) Invite flow actions (buttons)
  // =========================
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

  // Wednesday follow-up tools (manual buttons)
  function handleSendFollowUp(volunteerId) {
    const v = volunteersById.get(volunteerId);
    if (!v) return;
    openSmsModal("followUp", v);
  }

  function handleMarkNoResponse(volunteerId) {
    applyStatus(volunteerId, "No Response");
  }

  // =========================
  // E) Coverage + week state badge
  // =========================
  const confirmedCount = week ? week.invites.filter((i) => i.status === "Confirmed").length : 0;

  const minConfirmed = appState.settings.minConfirmed;
  const preferredConfirmed = appState.settings.preferredConfirmed;
  const stillNeeded = Math.max(0, minConfirmed - confirmedCount);

  const stateBadge = !week
    ? "Build"
    : week.finalized
    ? "Finalized"
    : confirmedCount >= minConfirmed
    ? "Confirm"
    : "Invite";

  // Sort invites for display
  const invitesSorted = useMemo(() => {
    if (!week) return [];
    return [...week.invites].sort((a, b) => {
      const sa = STATUS_ORDER.indexOf(a.status);
      const sb = STATUS_ORDER.indexOf(b.status);
      return sa - sb;
    });
  }, [week]);

  // =========================
  // F) Finalize + Friday Reminder
  // =========================
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

  function handleDeleteThisWeek() {
    if (!week) return;

    const ok = window.confirm(
      `Delete the list for ${formatFriendlyDate(fridayISO)}?\n\nThis cannot be undone.`
    );
    if (!ok) return;

    setShowLastMinute(false);

    setAppState((prev) => ({
      ...prev,
      weeks: prev.weeks.filter((w) => w.id !== week.id),
    }));
  }

  // =========================
  // Friday 12pm–7pm Central: hourly prompt to finalize if not finalized
  // =========================
  const showFinalizeNudgeBanner = !!week && !week.finalized && inFridayFinalizeWindowCentral(new Date());

  useEffect(() => {
    if (!week) return;
    if (week.finalized) return;

    const tick = () => {
      if (!inFridayFinalizeWindowCentral(new Date())) return;

      const { hour, minute } = getCentralParts(new Date());
      // Nudge at the top of the hour
      if (minute !== 0) return;

      if (lastNudgeHour === hour) return;
      setLastNudgeHour(hour);

      setToast("Reminder: finalize this week’s list ✅");
      setTimeout(() => setToast(""), 1600);
    };

    // run once quickly
    tick();

    const id = setInterval(tick, 60 * 1000);
    return () => clearInterval(id);
  }, [week?.id, week?.finalized, lastNudgeHour]);

  // =========================
  // Step 18: Suggested Next Up (cadence + last touch ordering)
  // =========================
  const suggestedNextUp = useMemo(() => {
    if (!week) return [];

    const excludeIds = new Set(week.invites.map((i) => i.volunteerId));

    return sortInviteCandidates(appState.volunteers, fridayISO, {
      excludeIds,
      defaultCadence: "monthly",
      onlyActive: true,
    });
  }, [appState.volunteers, week, fridayISO]);

  // Step 21: tiny UI helper renderer for safety notes
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

  // =========================
  // Edit Status modal helpers
  // =========================
  function openEditStatus(volunteerId, currentStatus) {
    setEditStatus({
      open: true,
      volunteerId,
      nextStatus: currentStatus || "Invited",
    });
  }

  function closeEditStatus() {
    setEditStatus({ open: false, volunteerId: null, nextStatus: "Invited" });
  }

  // =========================
  // UI
  // =========================
  return (
    <div
      className="coordinatorPage"
      style={{ background: THEME.bg, minHeight: "100vh", paddingBottom: 30 }}
    >
      <h2 style={{ marginTop: 0, color: THEME.navy }}>This Friday</h2>

      {/* KEY (Legend) */}
      <StatusKey />

      {/* TOP CARD */}
      <section style={styles.card}>
        <div style={styles.accentLine} />

        <div style={styles.row}>
          <div style={{ fontWeight: 900, color: THEME.navy }}>{formatFriendlyDate(fridayISO)}</div>
          <span style={{ ...styles.badge, color: THEME.navy, border: `1px solid ${THEME.border}` }}>
            {stateBadge}
          </span>
        </div>

        <div style={{ marginTop: 10, opacity: 0.9, lineHeight: 1.35, color: THEME.navy }}>
          <div>
            <b>Confirmed:</b> {confirmedCount}
          </div>
          <div>
            <b>Goal:</b> {minConfirmed}–{appState.settings.maxVolunteers}{" "}
            <span style={{ opacity: 0.7 }}>(preferred {preferredConfirmed})</span>
          </div>
          <div>
            <b>Still Needed (minimum):</b> {stillNeeded}
          </div>
        </div>

        {showFinalizeNudgeBanner ? (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 12,
              border: `1px solid ${THEME.border}`,
              background: THEME.bg,
              color: THEME.navy,
              fontWeight: 900,
              lineHeight: 1.35,
            }}
          >
            Friday reminder window is active (12pm–7pm Central). Please finalize the list when edits are done.
          </div>
        ) : null}

        {!week ? (
          <button
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
          <div style={{ marginTop: 10, color: THEME.muted }}>Week created ✅</div>
        )}

        {/* Delete week (Dev) — needed to test Auto-Create */}
        {week ? (
          <button
            onClick={handleDeleteThisWeek}
            style={{
              ...baseButtonStyle({
                hovered: hoveredBtn === "primary:deleteWeek",
                disabled: false,
                variant: "primary",
              }),
              border:
                hoveredBtn === "primary:deleteWeek"
                  ? "1px solid rgba(185, 28, 28, 0.9)"
                  : "1px solid rgba(185, 28, 28, 0.45)",
              color: hoveredBtn === "primary:deleteWeek" ? "#FFFFFF" : "rgba(185, 28, 28, 0.95)",
              background:
                hoveredBtn === "primary:deleteWeek" ? "rgba(185, 28, 28, 0.95)" : "transparent",
            }}
            onMouseEnter={() => setHoveredBtn("primary:deleteWeek")}
            onMouseLeave={() => setHoveredBtn(null)}
            title="Dev tool: deletes the current upcoming Friday list so Auto-Create can be tested"
          >
            Delete This Week (Dev)
          </button>
        ) : null}

        {/* Finalize */}
        {week && !week.finalized ? (
          <button
            onClick={handleFinalizeWeek}
            disabled={confirmedCount < minConfirmed}
            style={baseButtonStyle({
              hovered: hoveredBtn === "primary:finalize",
              disabled: confirmedCount < minConfirmed,
              variant: "primary",
            })}
            onMouseEnter={() => setHoveredBtn("primary:finalize")}
            onMouseLeave={() => setHoveredBtn(null)}
            title={
              confirmedCount < minConfirmed
                ? `Need at least ${minConfirmed} confirmed to finalize`
                : "Finalize list"
            }
          >
            Finalize List
          </button>
        ) : null}

        {week && week.finalized ? (
          <div style={{ marginTop: 10, fontWeight: 900, color: THEME.navy }}>List Finalized ✅</div>
        ) : null}

        {/* Add Last-Minute Volunteer */}
        {week ? (
          <button
            onClick={() => setShowLastMinute(true)}
            style={baseButtonStyle({
              hovered: hoveredBtn === "primary:lastMinute",
              disabled: false,
              variant: "primary",
            })}
            onMouseEnter={() => setHoveredBtn("primary:lastMinute")}
            onMouseLeave={() => setHoveredBtn(null)}
            title="Open a quick picker to add someone if there’s a cancellation"
          >
            Add Last-Minute Volunteer
          </button>
        ) : null}
      </section>

      {/* REQUIRED ROLES */}
      {week ? (
        <section style={styles.card}>
          <div style={styles.accentLine} />

          <div style={styles.row}>
            <div style={{ fontWeight: 900, color: THEME.navy }}>Required Roles</div>
            <div style={{ fontSize: 12, color: THEME.muted }}>Pinned every week</div>
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {CORE_ROLE_ORDER.map((role) => {
              const v = volunteersByRole.get(role) || null;

              if (!v) {
                return (
                  <div key={role} style={styles.roleRow}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, color: THEME.navy }}>{role}</div>
                      <div style={{ fontSize: 12, color: THEME.muted }}>
                        No volunteer assigned this role yet. Set it in Volunteers.
                      </div>
                    </div>
                    <span style={basePillStyle("Not Invited")}>Unassigned</span>
                  </div>
                );
              }

              const inv = inviteByVolunteerId.get(v.id) || null;
              const status = inv?.status || "Not Invited";

              return (
                <div key={role} style={styles.roleRow}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900, color: THEME.navy }}>
                      {role}: {v.name}
                    </div>
                    <div style={{ fontSize: 12, color: THEME.muted, marginTop: 2 }}>
                      {v.phone} • First-time: {v.firstTime ? "Yes" : "No"} •{" "}
                      {v.active ? "Active" : "Paused"}
                    </div>

                    <SafetyNotes v={v} />
                  </div>

                  <div style={{ display: "grid", gap: 6, minWidth: 150 }}>
                    <span style={basePillStyle(status)}>{status}</span>

                    {!inv ? (
                      <button
                        style={baseButtonStyle({
                          hovered: hoveredBtn === `small:reqAdd:${v.id}`,
                          disabled: !v.active,
                          variant: "small",
                        })}
                        onMouseEnter={() => setHoveredBtn(`small:reqAdd:${v.id}`)}
                        onMouseLeave={() => setHoveredBtn(null)}
                        onClick={() => addVolunteerToThisWeek(v.id)}
                        disabled={!v.active}
                        title={!v.active ? "Volunteer is Paused" : "Add to week"}
                      >
                        Add to This Week
                      </button>
                    ) : (
                      <button
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
        </section>
      ) : null}

      {/* INVITATIONS */}
      {week ? (
        <section style={styles.card}>
          <div style={styles.accentLine} />

          <div style={styles.row}>
            <div style={{ fontWeight: 900, color: THEME.navy }}>Invitations</div>
            <div style={{ fontSize: 12, color: THEME.muted }}>
              Send Invite opens a message prompt. Then track Yes/No/Follow-ups here. You can also edit statuses later.
            </div>
          </div>

          {week.invites.length === 0 ? (
            <div style={{ marginTop: 10, color: THEME.muted }}>
              No one added to this week yet. Add your core roles above first.
            </div>
          ) : (
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {invitesSorted.map((inv) => {
                const v = volunteersById.get(inv.volunteerId);
                if (!v) return null;

                return (
                  <div
                    key={inv.id}
                    className="coordinatorRow"
                    style={{
                      ...styles.invRow,
                      ...rowAccentStyle(inv.status),
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, color: THEME.navy }}>{v.name}</div>
                      <div style={{ fontSize: 12, color: THEME.muted, marginTop: 2 }}>
                        {v.phone} • {getRole(v)} • First-time: {v.firstTime ? "Yes" : "No"}
                      </div>

                      <SafetyNotes v={v} />
                    </div>

                    <div className="coordinatorActions" style={styles.invActions}>
                      <span style={basePillStyle(inv.status)}>{inv.status}</span>

                      {/* Primary actions */}
                      {inv.status === "Not Invited" ? (
                        <button
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
                        <div style={{ display: "grid", gap: 6 }}>
                          <button
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
                        </div>
                      ) : null}

                      {/* Edit / Remove (always available) */}
                      <button
                        style={baseButtonStyle({
                          hovered: hoveredBtn === `small:edit:${inv.id}`,
                          disabled: false,
                          variant: "small",
                        })}
                        onMouseEnter={() => setHoveredBtn(`small:edit:${inv.id}`)}
                        onMouseLeave={() => setHoveredBtn(null)}
                        onClick={() => openEditStatus(inv.volunteerId, inv.status)}
                        title="Change status later (ex: No Response -> Yes)"
                      >
                        Edit Status
                      </button>

                      <button
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
                          color:
                            hoveredBtn === `small:remove:${inv.id}`
                              ? "#FFFFFF"
                              : "rgba(185, 28, 28, 0.95)",
                          background:
                            hoveredBtn === `small:remove:${inv.id}`
                              ? "rgba(185, 28, 28, 0.95)"
                              : "transparent",
                        }}
                        onMouseEnter={() => setHoveredBtn(`small:remove:${inv.id}`)}
                        onMouseLeave={() => setHoveredBtn(null)}
                        onClick={() => {
                          const ok = window.confirm(`Remove ${v.name} from this week’s list?`);
                          if (!ok) return;
                          removeFromThisWeek(inv.volunteerId);
                        }}
                        title="Remove from this week (does not count against them)"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {toast ? <div style={styles.toast}>{toast}</div> : null}
        </section>
      ) : null}

      {/* STEP 18: Suggested Next Up */}
      {week ? (
        <section style={styles.card}>
          <div style={styles.accentLine} />

          <div style={styles.row}>
            <div style={{ fontWeight: 900, color: THEME.navy }}>Suggested Next Up</div>
            <div style={{ fontSize: 12, color: THEME.muted }}>
              Ordered by cadence + most recent touch (invite/confirm/decline)
            </div>
          </div>

          {suggestedNextUp.length === 0 ? (
            <div style={{ marginTop: 10, color: THEME.muted }}>
              No candidates available (everyone active is already on this week).
            </div>
          ) : (
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {suggestedNextUp.map(({ v, eligibleNow }) => (
                <div key={v.id} className="coordinatorRow" style={styles.invRow}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900, color: THEME.navy }}>{v.name}</div>

                    <div style={{ fontSize: 12, color: THEME.muted, marginTop: 2 }}>
                      {v.phone} • {getRole(v)} • First-time: {v.firstTime ? "Yes" : "No"}
                    </div>

                    <SafetyNotes v={v} />

                    {eligibleNow ? (
                      <div style={{ marginTop: 6, fontSize: 12, fontWeight: 900, color: THEME.navy }}>
                        Ready ✅
                      </div>
                    ) : (
                      <div style={{ marginTop: 6, fontSize: 12, fontWeight: 900, color: THEME.muted }}>
                        Not due yet (cadence)
                      </div>
                    )}
                  </div>

                  <button
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
        </section>
      ) : null}

      {/* ADD VOLUNTEERS */}
      {week ? (
        <section style={styles.card}>
          <div style={styles.accentLine} />

          <div style={styles.row}>
            <div style={{ fontWeight: 900, color: THEME.navy }}>Add Volunteers</div>
            <div style={{ fontSize: 12, color: THEME.muted }}>Active + not already on this week</div>
          </div>

          {appState.volunteers.filter((v) => v.active && !inviteByVolunteerId.has(v.id)).length ===
          0 ? (
            <div style={{ marginTop: 10, color: THEME.muted }}>
              Everyone active is already on this week’s list (or you have no active volunteers).
            </div>
          ) : (
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {appState.volunteers
                .filter((v) => v.active && !inviteByVolunteerId.has(v.id))
                .sort((a, b) => {
                  const ra = roleRank(getRole(a));
                  const rb = roleRank(getRole(b));
                  if (ra !== rb) return ra - rb;
                  return a.name.localeCompare(b.name);
                })
                .map((v) => (
                  <div key={v.id} className="coordinatorRow" style={styles.invRow}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, color: THEME.navy }}>{v.name}</div>
                      <div style={{ fontSize: 12, color: THEME.muted, marginTop: 2 }}>
                        {v.phone} • {getRole(v)} • First-time: {v.firstTime ? "Yes" : "No"}
                      </div>

                      <SafetyNotes v={v} />
                    </div>

                    <button
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
          )}
        </section>
      ) : null}

      {/* FRIDAY REMINDER */}
      {week && week.finalized ? (
        <section style={styles.card}>
          <div style={styles.accentLine} />

          <div style={styles.row}>
            <div style={{ fontWeight: 900, color: THEME.navy }}>Friday Reminder (Confirmed Only)</div>
            <div style={{ fontSize: 12, color: THEME.muted }}>Open Text App or Copy Message</div>
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {week.invites
              .filter((inv) => inv.status === "Confirmed")
              .map((inv) => {
                const v = volunteersById.get(inv.volunteerId);
                if (!v) return null;

                return (
                  <div
                    key={inv.id}
                    className="coordinatorRow"
                    style={{ ...styles.invRow, ...rowAccentStyle("Confirmed") }}
                  >
                    <div>
                      <div style={{ fontWeight: 900, color: THEME.navy }}>{v.name}</div>
                      <div style={{ fontSize: 12, color: THEME.muted }}>{v.phone}</div>
                    </div>

                    <button
                      style={baseButtonStyle({
                        hovered: hoveredBtn === `small:rem:${inv.id}`,
                        disabled: false,
                        variant: "small",
                      })}
                      onMouseEnter={() => setHoveredBtn(`small:rem:${inv.id}`)}
                      onMouseLeave={() => setHoveredBtn(null)}
                      onClick={() => handleCopyReminderForVolunteer(inv.volunteerId)}
                    >
                      Send Reminder
                    </button>
                  </div>
                );
              })}
          </div>

          {week.invites.filter((inv) => inv.status === "Confirmed").length === 0 ? (
            <div style={{ marginTop: 10, color: THEME.muted }}>No confirmed volunteers yet.</div>
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
                style={baseButtonStyle({
                  hovered: hoveredBtn === "small:closeModal",
                  disabled: false,
                  variant: "small",
                })}
                onMouseEnter={() => setHoveredBtn("small:closeModal")}
                onMouseLeave={() => setHoveredBtn(null)}
                onClick={() => setShowLastMinute(false)}
              >
                Close
              </button>
            </div>

            {eligibleLastMinute.length === 0 ? (
              <div style={{ marginTop: 10, color: THEME.muted }}>
                No eligible volunteers available (everyone active is already on this week).
              </div>
            ) : (
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {eligibleLastMinute.map((v) => (
                  <div key={v.id} className="coordinatorRow" style={styles.invRow}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, color: THEME.navy }}>{v.name}</div>
                      <div style={{ fontSize: 12, color: THEME.muted, marginTop: 2 }}>
                        {v.phone} • {getRole(v)} • First-time: {v.firstTime ? "Yes" : "No"}
                      </div>

                      <SafetyNotes v={v} />
                    </div>

                    <button
                      style={baseButtonStyle({
                        hovered: hoveredBtn === `small:lmAdd:${v.id}`,
                        disabled: false,
                        variant: "small",
                      })}
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
                style={baseButtonStyle({
                  hovered: hoveredBtn === "small:closeEdit",
                  disabled: false,
                  variant: "small",
                })}
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
                  <div style={{ fontSize: 12, color: THEME.muted, marginTop: 2 }}>
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
                        style={baseButtonStyle({
                          hovered: hoveredBtn === "primary:applyEdit",
                          disabled: false,
                          variant: "primary",
                        })}
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
                        style={baseButtonStyle({
                          hovered: hoveredBtn === "primary:cancelEdit",
                          disabled: false,
                          variant: "primary",
                        })}
                        onMouseEnter={() => setHoveredBtn("primary:cancelEdit")}
                        onMouseLeave={() => setHoveredBtn(null)}
                        onClick={closeEditStatus}
                      >
                        Cancel
                      </button>
                    </div>

                    <div style={{ marginTop: 10, fontSize: 12, color: THEME.muted, lineHeight: 1.35 }}>
                      Notes: Any edit will automatically unfinalize the list (if it was finalized). If capacity is exceeded,
                      the app will auto-remove the most recent auto-added “Not Invited/Invited” row to avoid over-inviting.
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      ) : null}

      {/* SMS DRAFT MODAL (Invite / FollowUp / Reminder) */}
      {smsModal.open ? (
        <div style={styles.modalBackdrop} onClick={closeSmsModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.row}>
              <div style={{ fontWeight: 1000, color: THEME.navy }}>
                {smsModal.kind === "invite"
                  ? "Send Invite"
                  : smsModal.kind === "followUp"
                  ? "Send Follow-Up"
                  : "Send Reminder"}
              </div>

              <button
                style={baseButtonStyle({
                  hovered: hoveredBtn === "small:closeSms",
                  disabled: false,
                  variant: "small",
                })}
                onMouseEnter={() => setHoveredBtn("small:closeSms")}
                onMouseLeave={() => setHoveredBtn(null)}
                onClick={closeSmsModal}
              >
                Close
              </button>
            </div>

            <div style={{ marginTop: 10, color: THEME.navy, lineHeight: 1.35 }}>
              <div style={{ fontWeight: 1000 }}>{smsModal.name}</div>
              <div style={{ fontSize: 12, color: THEME.muted, marginTop: 2 }}>{smsModal.phone}</div>
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
                style={baseButtonStyle({
                  hovered: hoveredBtn === "primary:openSms",
                  disabled: false,
                  variant: "primary",
                })}
                onMouseEnter={() => setHoveredBtn("primary:openSms")}
                onMouseLeave={() => setHoveredBtn(null)}
                onClick={() => {
                  const link = buildSmsLink(smsModal.phone, smsModal.message);
                  window.location.href = link;

                  // tracking updates AFTER user action
                  applyAfterSend(smsModal.kind, smsModal.volunteerId);
                  closeSmsModal();
                }}
              >
                Open Text App
              </button>

              <button
                style={baseButtonStyle({
                  hovered: hoveredBtn === "primary:copySms",
                  disabled: false,
                  variant: "primary",
                })}
                onMouseEnter={() => setHoveredBtn("primary:copySms")}
                onMouseLeave={() => setHoveredBtn(null)}
                onClick={() => {
                  copyText(smsModal.message);

                  // tracking updates AFTER user action
                  applyAfterSend(smsModal.kind, smsModal.volunteerId);
                  closeSmsModal();
                }}
              >
                Copy Message
              </button>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: THEME.muted, lineHeight: 1.35 }}>
              Tip: On desktop, “Open Text App” may not work unless your device supports SMS handoff.
              “Copy Message” is the reliable fallback.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Styles
const styles = {
  card: {
    position: "relative",
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    border: `1px solid ${THEME.border}`,
    background: THEME.card,
    overflow: "hidden",
  },

  // Teal accent line (subtle)
  accentLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 4,
    background: THEME.teal,
    opacity: 0.85,
  },

  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  badge: {
    fontSize: 12,
    fontWeight: 950,
    padding: "6px 10px",
    borderRadius: 999,
    background: THEME.card,
  },

  keyWrap: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    border: `1px solid ${THEME.border}`,
    background: THEME.card,
  },
  keyRow: {
    marginTop: 8,
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },

  roleRow: {
    display: "flex",
    gap: 12,
    justifyContent: "space-between",
    alignItems: "center",
    border: `1px solid ${THEME.border}`,
    borderRadius: 12,
    padding: 10,
  },

  invRow: {
    display: "flex",
    gap: 12,
    justifyContent: "space-between",
    alignItems: "flex-start",
    border: `1px solid ${THEME.border}`,
    borderRadius: 12,
    padding: 10,
  },

  invActions: {
    display: "grid",
    gap: 6,
    minWidth: 150,
    justifyItems: "stretch",
  },

  notesWrap: {
    marginTop: 6,
    display: "grid",
    gap: 2,
  },
  noteLine: {
    fontSize: 12,
    fontWeight: 900,
    color: THEME.muted,
  },

  toast: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    border: `1px solid ${THEME.border}`,
    fontWeight: 900,
    textAlign: "center",
    background: THEME.card,
    color: THEME.navy,
  },

  modalBackdrop: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.35)",
    // IMPORTANT: allow the overlay to scroll on mobile
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    // IMPORTANT: don't vertically center tall modals (they become unscrollable)
    display: "block",
    padding: 16,
    zIndex: 999,
  },

  modalCard: {
    width: "min(720px, 100%)",
    background: THEME.card,
    borderRadius: 14,
    border: `1px solid ${THEME.border}`,
    padding: 14,

    // IMPORTANT: make the card scrollable when content is tall
    maxHeight: "calc(100vh - 32px)",
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",

    // Center horizontally since backdrop is now display:block
    margin: "16px auto",
  },
};
