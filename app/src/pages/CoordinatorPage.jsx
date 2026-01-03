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

// src/pages/CoordinatorPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { getUpcomingFridayISO, formatFriendlyDate } from "../utils/date.js";

// ✅ NEW (Option 2 rotation)
import { sortInviteCandidates } from "../utils/rotation.js";

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
// =========================
function getEligibilityISOForVolunteer(v, cooldownAfterConfirmWeeks, cooldownAfterDeclineWeeks) {
  const confirmEligibleISO = v.lastConfirmedDate
    ? addWeeksISO(v.lastConfirmedDate, cooldownAfterConfirmWeeks)
    : null;

  const declineEligibleISO = v.lastDeclinedDate
    ? addWeeksISO(v.lastDeclinedDate, cooldownAfterDeclineWeeks)
    : null;

  return maxISO(confirmEligibleISO, declineEligibleISO);
}

function servedLastWeek(fridayISO, lastConfirmedDate) {
  if (!lastConfirmedDate) return false;
  const lastWeekISO = addWeeksISO(fridayISO, -1);
  return lastConfirmedDate === lastWeekISO;
}

function getSafetyNotes(v, fridayISO, cooldownAfterConfirmWeeks, cooldownAfterDeclineWeeks) {
  const notes = [];

  if (servedLastWeek(fridayISO, v.lastConfirmedDate)) {
    notes.push("Already served last week");
  }

  if (v.lastDeclinedDate) {
    const declineEligibleISO = addWeeksISO(v.lastDeclinedDate, cooldownAfterDeclineWeeks);
    const stillInDeclineWindow = fridayISO < declineEligibleISO;
    if (stillInDeclineWindow) {
      notes.push(`Recently declined (${formatFriendlyDate(v.lastDeclinedDate)})`);
    }
  }

  const eligibleISO = getEligibilityISOForVolunteer(
    v,
    cooldownAfterConfirmWeeks,
    cooldownAfterDeclineWeeks
  );
  const inCooldown = eligibleISO ? fridayISO < eligibleISO : false;
  if (inCooldown) {
    notes.push(`Cooldown — eligible on ${formatFriendlyDate(eligibleISO)}`);
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
  const anyModalOpen = showLastMinute || smsModal.open;
  if (!anyModalOpen) return;

  const prev = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  return () => {
    document.body.style.overflow = prev;
  };
}, [showLastMinute, smsModal.open]);


  // Cooldown settings (fallback defaults)
  const cooldownAfterConfirmWeeks = appState.settings.cooldownAfterConfirmWeeks ?? 2;
  const cooldownAfterDeclineWeeks = appState.settings.cooldownAfterDeclineWeeks ?? 3;

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
  // A) Week creation
  // =========================
  function createWeekIfMissing() {
    if (week) return;

    const newWeek = {
      id: crypto.randomUUID(),
      date: fridayISO,
      neededCount: appState.settings.maxVolunteers,
      finalized: false,
      invites: [],
    };

    setAppState((prev) => ({
      ...prev,
      weeks: [newWeek, ...prev.weeks],
    }));
  }

  // =========================
  // B) Add volunteer to this week
  // =========================
  function addVolunteerToThisWeek(volunteerId) {
    if (!week) return;
    if (inviteByVolunteerId.has(volunteerId)) return;

    const newInvite = {
      id: crypto.randomUUID(),
      volunteerId,
      status: "Not Invited",
      inviteSentAt: null,
      followUpSentAt: null,
      responseAt: null,
    };

    setAppState((prev) => ({
      ...prev,
      weeks: prev.weeks.map((w) =>
        w.id === week.id ? { ...w, invites: [...w.invites, newInvite] } : w
      ),
    }));
  }

  // Patch a week invite record (status, timestamps, etc.)
  function updateInvite(volunteerId, patch) {
    if (!week) return;

    setAppState((prev) => ({
      ...prev,
      weeks: prev.weeks.map((w) => {
        if (w.id !== week.id) return w;
        return {
          ...w,
          invites: w.invites.map((inv) =>
            inv.volunteerId === volunteerId ? { ...inv, ...patch } : inv
          ),
        };
      }),
    }));
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
      updateInvite(volunteerId, {
        status: "Invited",
        inviteSentAt: nowISO,
      });

      // ✅ NEW (safe): stamp lastInvitedAt on volunteer (date-only)
      setAppState((prev) => ({
        ...prev,
        volunteers: prev.volunteers.map((v) =>
          v.id === volunteerId ? { ...v, lastInvitedAt: fridayISO } : v
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
  // D) Invite flow actions
  // =========================
  function handleSendInvite(volunteerId) {
    const v = volunteersById.get(volunteerId);
    if (!v) return;

    // NEW: open SMS prompt first (no state updates until user clicks Open/Copy)
    openSmsModal("invite", v);
  }

  function handleMarkYes(volunteerId) {
    const nowISO = new Date().toISOString();
    updateInvite(volunteerId, { status: "Confirmed", responseAt: nowISO });

    setAppState((prev) => ({
      ...prev,
      volunteers: prev.volunteers.map((v) =>
        v.id === volunteerId ? { ...v, lastConfirmedDate: fridayISO } : v
      ),
    }));
  }

  function handleMarkNo(volunteerId) {
    const nowISO = new Date().toISOString();
    updateInvite(volunteerId, { status: "Declined", responseAt: nowISO });

    setAppState((prev) => ({
      ...prev,
      volunteers: prev.volunteers.map((v) =>
        v.id === volunteerId ? { ...v, lastDeclinedDate: fridayISO } : v
      ),
    }));
  }

  // Wednesday follow-up tools (manual buttons)
  function handleSendFollowUp(volunteerId) {
    const v = volunteersById.get(volunteerId);
    if (!v) return;

    // NEW: open SMS prompt first
    openSmsModal("followUp", v);
  }

  function handleMarkNoResponse(volunteerId) {
    const nowISO = new Date().toISOString();
    updateInvite(volunteerId, { status: "No Response", responseAt: nowISO });

    // Treat like a decline for cooldown later
    setAppState((prev) => ({
      ...prev,
      volunteers: prev.volunteers.map((v) =>
        v.id === volunteerId ? { ...v, lastDeclinedDate: fridayISO } : v
      ),
    }));
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

    // NEW: open SMS prompt first
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
  // Step 18: Suggested Next Up (✅ Option 2 rotation)
  // =========================
  const suggestedNextUp = useMemo(() => {
    if (!week) return [];

    const excludeIds = new Set(week.invites.map((i) => i.volunteerId));

    // Default cadence is monthly for anyone missing inviteCadence
    return sortInviteCandidates(appState.volunteers, fridayISO, {
      excludeIds,
      defaultCadence: "monthly",
      onlyActive: true,
    });
  }, [appState.volunteers, week, fridayISO]);

  // Step 21: tiny UI helper renderer for safety notes
  function SafetyNotes({ v }) {
    const notes = getSafetyNotes(v, fridayISO, cooldownAfterConfirmWeeks, cooldownAfterDeclineWeeks);
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
              Send Invite opens a message prompt. Then track Yes/No/Follow-ups here.
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

                      {(inv.status === "Confirmed" ||
                        inv.status === "Declined" ||
                        inv.status === "No Response") && (
                        <button
                          style={baseButtonStyle({ hovered: false, disabled: true, variant: "small" })}
                          disabled
                        >
                          Done
                        </button>
                      )}
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
              Cooldown: served {cooldownAfterConfirmWeeks}w • declined {cooldownAfterDeclineWeeks}w
            </div>
          </div>

          {suggestedNextUp.length === 0 ? (
            <div style={{ marginTop: 10, color: THEME.muted }}>
              No candidates available (everyone active is already on this week).
            </div>
          ) : (
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {/* ✅ UPDATED: uses eligibleNow instead of inCooldown */}
              {suggestedNextUp.map(({ v, eligibleNow, eligibleISO }) => (
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
                        Cooldown — eligible on {eligibleISO ? formatFriendlyDate(eligibleISO) : "N/A"}
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
