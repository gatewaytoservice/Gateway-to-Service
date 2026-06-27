// app/src/pages/VolunteersPageV2.jsx
//
// ✅ Volunteers (Scheduling System V2)
//
// IMPORTANT NOTES (so we don’t break existing behavior):
// - This file is ONLY the Volunteers page UI + CRUD for volunteer records.
// - We do NOT change CoordinatorPage logic here.
// - We keep nextInviteDate as the “source of truth” for scheduling (per your current setup).
// - We ONLY update “Due” checks to be based on the UPCOMING FRIDAY (not “today”),
//   because your invite workflow is week-based (Friday meeting), not date-of-view based.
// - We keep createdAt behavior:
//   - New volunteers: createdAt is set at creation time.
//   - Older volunteers: createdAt is set the first time they are edited + saved (non-breaking).
//
// What this update specifically fixes/alines:
// ✅ “Due” label logic now uses upcoming Friday ISO via getUpcomingFridayISO()
// ✅ No changes to your existing fields/shape beyond what you already had
// ✅ No changes to cadence options, monthly pattern behavior, or validation rules

import React, { useEffect, useMemo, useState } from "react";
import { getUpcomingFridayISO } from "../utils/date.js";

// ✅ Scheduling System V2 helpers
import {
  INVITE_CADENCES,
  MONTHLY_PATTERN_OPTIONS,
  getNextInviteDateISO,
  getNextInviteDateFromLastResponseOrInvite,
  isVolunteerDueThisWeek,
} from "../utils/rotationV2.js";

// Roles relevant to Gateway to Service (community-specific, not generic)
// NOTE: "Volunteer" is the default role so people always show up.
const ROLE_OPTIONS = [
  "Volunteer",
  "Chairperson",
  "Alt Chairperson",
  "List Coordinator",
  "Meeting Steward",
  "Discussion Group Lead",
  "Alt Discussion Lead",
  "Big Book Lead",
  "Alt Big Book Lead",
  "Gateway Employee",
  "Alt Gateway Employee",
];

function getRole(v) {
  return v.coreRole || "Volunteer";
}

// ✅ Invite cadence options (Scheduling System V2)
const CADENCE_OPTIONS = INVITE_CADENCES.map((c) => ({ value: c.key, label: c.label })).filter(Boolean);

function getCadence(v) {
  return v.inviteCadence || "monthly";
}

function getNextInviteDate(v) {
  return getNextInviteDateISO(v) || "";
}

function getMonthlyPattern(v) {
  return v.monthlyPattern || "";
}

function cadenceLabel(key) {
  return CADENCE_OPTIONS.find((c) => c.value === key)?.label || key || "—";
}

function monthlyPatternLabel(key) {
  return MONTHLY_PATTERN_OPTIONS.find((p) => p.key === key)?.label || key || "—";
}

// =========================
// ✅ Phone formatting helper
// =========================
function formatPhoneUS(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith("1"))
    return `1-${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  return raw;
}

// =========================
// ✅ Date formatting helpers
// =========================
function formatDateFriendly(isoOrTs) {
  if (!isoOrTs) return "—";
  const s = String(isoOrTs).trim();
  if (!s) return "—";
  // accept either YYYY-MM-DD or ISO datetime
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/**
 * ✅ Scheduling System V2 “computed next invite”
 * If nextInviteDate is missing, we can still *suggest* one from:
 * - last response
 * - last invite
 * - or the June 26, 2026 fallback anchor inside rotationV2.js
 *
 * This does NOT change the schedule by itself — it only helps the coordinator backfill.
 */
function getSuggestedNextInviteDate(v) {
  const scheduled = getNextInviteDateISO(v);
  if (scheduled) return null;

  return getNextInviteDateFromLastResponseOrInvite(v);
}

/**
 * ✅ Recalculate next invite date when cadence/pattern changes.
 * This uses the volunteer's last response/invite date first,
 * and falls back to June 26, 2026 through rotationV2.js.
 */
function getRecalculatedNextInviteForVolunteer(v, inviteCadence, monthlyPattern) {
  return (
    getNextInviteDateFromLastResponseOrInvite({
      ...v,
      inviteCadence: inviteCadence || "monthly",
      monthlyPattern: inviteCadence === "monthly_pattern" ? monthlyPattern || "" : "",
    }) || ""
  );
}

// =========================
// ✅ Scheduling validation (lightweight)
// - This preserves your existing rule: nextInviteDate is required.
// - monthly_pattern requires a pattern selection.
// =========================
function validateSchedulingFields({ inviteCadence, nextInviteDate, monthlyPattern }) {
  if (!inviteCadence) return false;

  if (!nextInviteDate) {
    alert("Please set Next Invite Date (this powers the scheduling system).");
    return false;
  }

  if (inviteCadence === "monthly_pattern" && !monthlyPattern) {
    alert("Please select a Monthly Pattern.");
    return false;
  }

  return true;
}

// =========================
// ✅ Small icon (inline, no library dependency)
// =========================
function MagnifyingGlassIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block" }}
    >
      <path
        d="M10 18a8 8 0 1 1 5.293-14.293A8 8 0 0 1 10 18Zm11 3-6.1-6.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function VolunteersPageV2({ appState, setAppState }) {
  const fridayISO = getUpcomingFridayISO();

  // Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("Volunteer");
  const [firstTime, setFirstTime] = useState(false);

  // ✅ NEW: notes on add form (optional)
  const [notes, setNotes] = useState("");

  // Scheduling inputs (V2)
  const [cadence, setCadence] = useState("monthly");
  const [nextInviteDate, setNextInviteDate] = useState("");
  const [monthlyPattern, setMonthlyPattern] = useState("");

  // ✅ NEW: search
  const [searchQuery, setSearchQuery] = useState("");

  const volunteers = appState.volunteers || [];

  const activeCount = useMemo(() => volunteers.filter((v) => v.active).length, [volunteers]);

  // =========================
  // Edit Modal
  // =========================
  const [editModal, setEditModal] = useState({
    open: false,
    volunteerId: null,
    name: "",
    phone: "",
    coreRole: "Volunteer",
    inviteCadence: "monthly",
    nextInviteDate: "",
    monthlyPattern: "",
    firstTime: false,
    active: true,
    createdAt: null,
    notes: "", // ✅ NEW

    // ✅ Track originals so cadence changes can recalculate nextInviteDate without overwriting manual edits.
    originalInviteCadence: "monthly",
    originalMonthlyPattern: "",
    originalNextInviteDate: "",
  });

  function openEditModal(v) {
    const scheduled = getNextInviteDateISO(v) || "";
    const suggested = getSuggestedNextInviteDate(v) || "";
    const currentCadence = getCadence(v);
    const currentPattern = currentCadence === "monthly_pattern" ? getMonthlyPattern(v) : "";

    setEditModal({
      open: true,
      volunteerId: v.id,
      name: v.name || "",
      phone: v.phone || "",
      coreRole: getRole(v),
      inviteCadence: currentCadence,
      nextInviteDate: scheduled || suggested || "",
      monthlyPattern: currentPattern,
      firstTime: !!v.firstTime,
      active: !!v.active,
      createdAt: v.createdAt || null,
      notes: v.notes || "",

      originalInviteCadence: currentCadence,
      originalMonthlyPattern: currentPattern,
      originalNextInviteDate: scheduled || suggested || "",
    });
  }

  function closeEditModal() {
    setEditModal({
      open: false,
      volunteerId: null,
      name: "",
      phone: "",
      coreRole: "Volunteer",
      inviteCadence: "monthly",
      nextInviteDate: "",
      monthlyPattern: "",
      firstTime: false,
      active: true,
      createdAt: null,
      notes: "",

      originalInviteCadence: "monthly",
      originalMonthlyPattern: "",
      originalNextInviteDate: "",
    });
  }

  function saveEditModal() {
    const trimmedName = editModal.name.trim();
    const trimmedPhone = editModal.phone.trim();

    if (!trimmedName) return alert("Please enter a name.");
    if (!trimmedPhone) return alert("Please enter a phone number.");

    const nextMonthlyPattern =
      editModal.inviteCadence === "monthly_pattern" ? editModal.monthlyPattern || "" : "";

    const originalPattern =
      editModal.originalInviteCadence === "monthly_pattern" ? editModal.originalMonthlyPattern || "" : "";

    const cadenceChanged =
      editModal.inviteCadence !== editModal.originalInviteCadence ||
      nextMonthlyPattern !== originalPattern;

    const currentVolunteer = volunteers.find((v) => v.id === editModal.volunteerId) || null;

    const shouldAutoRecalculateNextInvite =
      cadenceChanged &&
      currentVolunteer &&
      (!editModal.nextInviteDate || editModal.nextInviteDate === editModal.originalNextInviteDate);

    const recalculatedNextInviteDate = shouldAutoRecalculateNextInvite
      ? getRecalculatedNextInviteForVolunteer(
          currentVolunteer,
          editModal.inviteCadence,
          nextMonthlyPattern
        )
      : "";

    const finalNextInviteDate = recalculatedNextInviteDate || editModal.nextInviteDate || "";

    if (
      !validateSchedulingFields({
        inviteCadence: editModal.inviteCadence,
        nextInviteDate: finalNextInviteDate,
        monthlyPattern: nextMonthlyPattern,
      })
    ) {
      return;
    }

    const formattedPhone = formatPhoneUS(trimmedPhone);

    setAppState((prev) => ({
      ...prev,
      volunteers: prev.volunteers.map((v) =>
        v.id === editModal.volunteerId
          ? {
              ...v,
              name: trimmedName,
              phone: formattedPhone,
              coreRole: editModal.coreRole,
              inviteCadence: editModal.inviteCadence,
              nextInviteDate: finalNextInviteDate,
              monthlyPattern: nextMonthlyPattern,
              firstTime: !!editModal.firstTime,
              active: !!editModal.active,
              notes: String(editModal.notes || "").trim(), // ✅ NEW

              // ✅ If createdAt missing on older records, set it when first edited
              createdAt: v.createdAt || editModal.createdAt || new Date().toISOString(),
            }
          : v
      ),
    }));

    closeEditModal();
  }

  // Lock body scroll when modal open
  useEffect(() => {
    if (!editModal.open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [editModal.open]);

  // =========================
  // Add volunteer
  // =========================
  function addVolunteer(e) {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) return alert("Please enter a name.");
    if (!trimmedPhone) return alert("Please enter a phone number.");

    if (
      !validateSchedulingFields({
        inviteCadence: cadence,
        nextInviteDate,
        monthlyPattern,
      })
    ) {
      return;
    }

    const formattedPhone = formatPhoneUS(trimmedPhone);
    const nowISO = new Date().toISOString();

    const newVolunteer = {
      id: crypto.randomUUID(),
      name: trimmedName,
      phone: formattedPhone,
      coreRole: role,
      firstTime: Boolean(firstTime),
      active: true,

      // ✅ createdAt for visibility + auditing
      createdAt: nowISO,

      // ✅ NEW: Notes (helps disambiguate same-name volunteers)
      notes: String(notes || "").trim(),

      // Scheduling system V2 (source of truth)
      inviteCadence: cadence || "monthly",
      nextInviteDate: nextInviteDate || "",
      monthlyPattern: cadence === "monthly_pattern" ? monthlyPattern || "" : "",

      // History
      lastInvitedAt: null,
      lastConfirmedDate: null,
      lastDeclinedDate: null,
    };

    setAppState((prev) => ({
      ...prev,
      volunteers: [newVolunteer, ...prev.volunteers],
    }));

    setName("");
    setPhone("");
    setRole("Volunteer");
    setFirstTime(false);
    setNotes("");
    setCadence("monthly");
    setNextInviteDate("");
    setMonthlyPattern("");
  }

  // =========================
  // Quick inline updates (existing behavior preserved)
  // =========================
  function toggleActive(volunteerId) {
    setAppState((prev) => ({
      ...prev,
      volunteers: prev.volunteers.map((v) => (v.id === volunteerId ? { ...v, active: !v.active } : v)),
    }));
  }

  function toggleFirstTime(volunteerId) {
    setAppState((prev) => ({
      ...prev,
      volunteers: prev.volunteers.map((v) => (v.id === volunteerId ? { ...v, firstTime: !v.firstTime } : v)),
    }));
  }

  function setVolunteerRole(volunteerId, newRole) {
    setAppState((prev) => ({
      ...prev,
      volunteers: prev.volunteers.map((v) => (v.id === volunteerId ? { ...v, coreRole: newRole } : v)),
    }));
  }

  function updateVolunteerCadence(volunteerId, inviteCadence) {
    setAppState((prev) => ({
      ...prev,
      volunteers: prev.volunteers.map((v) => {
        if (v.id !== volunteerId) return v;

        const nextMonthlyPattern =
          inviteCadence === "monthly_pattern" ? v.monthlyPattern || "" : "";

        const recalculatedNextInviteDate = getRecalculatedNextInviteForVolunteer(
          v,
          inviteCadence,
          nextMonthlyPattern
        );

        return {
          ...v,
          inviteCadence,
          monthlyPattern: nextMonthlyPattern,
          nextInviteDate: recalculatedNextInviteDate || v.nextInviteDate || "",
        };
      }),
    }));
  }

  function updateVolunteerNextInviteDate(volunteerId, nextInviteDateValue) {
    setAppState((prev) => ({
      ...prev,
      volunteers: prev.volunteers.map((v) => (v.id === volunteerId ? { ...v, nextInviteDate: nextInviteDateValue || "" } : v)),
    }));
  }

  function updateVolunteerMonthlyPattern(volunteerId, nextMonthlyPattern) {
    setAppState((prev) => ({
      ...prev,
      volunteers: prev.volunteers.map((v) => {
        if (v.id !== volunteerId) return v;

        const pattern = nextMonthlyPattern || "";
        const recalculatedNextInviteDate = getRecalculatedNextInviteForVolunteer(
          v,
          getCadence(v),
          pattern
        );

        return {
          ...v,
          monthlyPattern: pattern,
          nextInviteDate: recalculatedNextInviteDate || v.nextInviteDate || "",
        };
      }),
    }));
  }

  /**
   * ✅ One-click backfill for older volunteers.
   */
  function applySuggestedNextInviteDate(volunteerId) {
    setAppState((prev) => ({
      ...prev,
      volunteers: prev.volunteers.map((v) => {
        if (v.id !== volunteerId) return v;
        if (getNextInviteDateISO(v)) return v;

        const suggested = getSuggestedNextInviteDate(v);
        if (!suggested) return v;

        return { ...v, nextInviteDate: suggested };
      }),
    }));
  }

  function deleteVolunteer(volunteerId) {
    const ok = confirm("Delete this volunteer? This cannot be undone.");
    if (!ok) return;

    setAppState((prev) => ({
      ...prev,
      volunteers: prev.volunteers.filter((v) => v.id !== volunteerId),
    }));
  }

  // =========================
  // ✅ NEW: filtered volunteers
  // Notes:
  // - Search checks name, phone, role, cadence label, and notes.
  // - This is UI-only; does not modify data.
  // =========================
  const filteredVolunteers = useMemo(() => {
    const q = String(searchQuery || "").trim().toLowerCase();
    if (!q) return volunteers;

    return volunteers.filter((v) => {
      const nameTxt = String(v.name || "").toLowerCase();
      const phoneTxt = String(v.phone || "").toLowerCase();
      const roleTxt = String(getRole(v) || "").toLowerCase();
      const cadenceTxt = String(cadenceLabel(getCadence(v)) || "").toLowerCase();
      const notesTxt = String(v.notes || "").toLowerCase();
      return (
        nameTxt.includes(q) ||
        phoneTxt.includes(q) ||
        roleTxt.includes(q) ||
        cadenceTxt.includes(q) ||
        notesTxt.includes(q)
      );
    });
  }, [volunteers, searchQuery]);

  return (
    <div className="v-page">
      <h2 style={{ marginTop: 0 }}>Volunteers V2</h2>

      {/* ✅ NEW: Search Bar */}
      <section style={{ ...styles.card, marginTop: 10 }}>
        <div style={styles.searchWrap}>
          <div style={styles.searchIcon} aria-hidden="true">
            <MagnifyingGlassIcon size={16} />
          </div>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, role, cadence, or notes…"
            style={styles.searchInput}
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={styles.clearBtn}
              title="Clear search"
            >
              Clear
            </button>
          ) : null}
        </div>

        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
          Showing <b>{filteredVolunteers.length}</b> of <b>{volunteers.length}</b>
        </div>
      </section>

      {/* Add Volunteer */}
      <section style={styles.card}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>Add Volunteer</div>

        <form onSubmit={addVolunteer} className="v-form" style={{ display: "grid", gap: 10 }}>
          <label style={styles.label}>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John D."
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            Phone
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => setPhone((p) => formatPhoneUS(p))}
              placeholder="123-456-7890"
              style={styles.input}
              inputMode="tel"
            />
          </label>

          <label style={styles.label}>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value)} style={styles.input}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Invite Cadence
            <select
              value={cadence}
              onChange={(e) => {
                const value = e.target.value;
                setCadence(value);
                if (value !== "monthly_pattern") setMonthlyPattern("");
              }}
              style={styles.input}
            >
              {CADENCE_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Next Invite Date (Scheduled)
            <input
              type="date"
              value={nextInviteDate}
              onChange={(e) => setNextInviteDate(e.target.value)}
              style={styles.input}
            />
          </label>

          {cadence === "monthly_pattern" ? (
            <label style={styles.label}>
              Monthly Pattern
              <select
                value={monthlyPattern}
                onChange={(e) => setMonthlyPattern(e.target.value)}
                style={styles.input}
              >
                <option value="">Select a pattern</option>
                {MONTHLY_PATTERN_OPTIONS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="v-checkboxRow" style={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={firstTime}
              onChange={(e) => setFirstTime(e.target.checked)}
            />
            First-time volunteer
          </label>

          {/* ✅ NEW: Notes */}
          <label style={styles.label}>
            Notes (optional)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Example: ‘Works nights’ / ‘Lives in Waukegan’ / ‘Same name as Jim S.’"
              style={styles.textarea}
            />
          </label>

          <button type="submit" className="v-submitBtn" style={styles.primaryBtn}>
            Add Volunteer
          </button>
        </form>
      </section>

      {/* Roster */}
      <section style={styles.card}>
        <div style={styles.row}>
          <div style={{ fontWeight: 900 }}>Roster</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Active: {activeCount} / Total: {volunteers.length}
          </div>
        </div>

        {filteredVolunteers.length === 0 ? (
          <div style={{ marginTop: 10, opacity: 0.75 }}>No matches found.</div>
        ) : (
          <div className="v-list" style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {filteredVolunteers
              .slice()
              .sort((a, b) => {
                const ra = roleRank(getRole(a));
                const rb = roleRank(getRole(b));
                if (ra !== rb) return ra - rb;
                return String(a.name || "").localeCompare(String(b.name || ""));
              })
              .map((v) => {
                const scheduledNext = getNextInviteDateISO(v);
                const suggestedNext = getSuggestedNextInviteDate(v);

                // NOTE: This "Due" check is UI-only.
                // It now matches the Coordinator page by using the upcoming Friday.
                const dueNow = scheduledNext
                  ? isVolunteerDueThisWeek(v, fridayISO)
                  : false;

                const phoneFmt = formatPhoneUS(v.phone);
                const roleTxt = getRole(v);
                const cadenceTxt = cadenceLabel(getCadence(v));
                const addedTxt = formatDateFriendly(v.createdAt);
                const scheduledTxt = formatDateFriendly(scheduledNext);

                return (
                  <div key={v.id} className="v-card" style={styles.volRow}>
                    {/* LEFT: clean summary + info */}
                    <div style={{ minWidth: 0 }}>
                      {/* Top line: name + status */}
                      <div style={styles.volHeaderRow}>
                        <div style={{ fontWeight: 900, lineHeight: 1.2 }}>
                          {v.name}{" "}
                          {!v.active ? (
                            <span style={{ fontSize: 12, opacity: 0.7 }}>(Paused)</span>
                          ) : null}
                        </div>

                        {scheduledNext && dueNow ? (
                          <span style={styles.duePill}>Due</span>
                        ) : null}
                      </div>

                      {/* Phone */}
                      <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
                        {phoneFmt || v.phone}
                      </div>

                      {/* Inline meta: role + cadence + first time */}
                      <div style={styles.metaRow}>
                        <span>
                          <b>{roleTxt}</b> • {cadenceTxt}
                        </span>
                        <span>First-time: {v.firstTime ? "Yes" : "No"}</span>
                      </div>

                      {/* Notes preview */}
                      <div style={{ marginTop: 8 }}>
                        <div style={styles.smallLabel}>Notes</div>
                        <div style={styles.notesPreview}>
                          {String(v.notes || "").trim() ? v.notes : <span style={{ opacity: 0.7 }}>—</span>}
                        </div>
                      </div>

                      {/* Scheduling block */}
                      <div style={styles.block}>
                        <div style={styles.blockTitle}>Scheduling</div>

                        <div style={styles.kvGrid}>
                          <div style={styles.kvItem}>
                            <div style={styles.kvLabel}>Added</div>
                            <div style={styles.kvValue}>{addedTxt}</div>
                          </div>

                          <div style={styles.kvItem}>
                            <div style={styles.kvLabel}>Scheduled Next Invite</div>
                            <div style={styles.kvValue}>
                              {scheduledTxt}
                              {scheduledNext && dueNow ? <span style={{ marginLeft: 8, fontWeight: 900 }}>(Due)</span> : null}
                            </div>
                          </div>

                          {getCadence(v) === "monthly_pattern" ? (
                            <div style={styles.kvItem}>
                              <div style={styles.kvLabel}>Pattern</div>
                              <div style={styles.kvValue}>{monthlyPatternLabel(getMonthlyPattern(v))}</div>
                            </div>
                          ) : null}
                        </div>

                        {/* If missing schedule, show suggested */}
                        {!scheduledNext ? (
                          <div style={{ marginTop: 10 }}>
                            <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.35 }}>
                              <b>Suggested Next Invite:</b> {formatDateFriendly(suggestedNext)}
                            </div>

                            <button
                              type="button"
                              onClick={() => applySuggestedNextInviteDate(v.id)}
                              style={{ ...styles.smallBtn, marginTop: 8 }}
                              disabled={!suggestedNext}
                              title={!suggestedNext ? "Need response, invite history, or fallback anchor to suggest a schedule." : "Set schedule"}
                            >
                              Set Suggested Date
                            </button>
                          </div>
                        ) : null}
                      </div>

                      {/* History block */}
                      <div style={styles.block}>
                        <div style={styles.blockTitle}>History</div>
                        <div style={styles.kvGrid}>
                          <div style={styles.kvItem}>
                            <div style={styles.kvLabel}>Last Invited</div>
                            <div style={styles.kvValue}>{formatDateFriendly(v.lastInvitedAt)}</div>
                          </div>
                          <div style={styles.kvItem}>
                            <div style={styles.kvLabel}>Last Confirmed</div>
                            <div style={styles.kvValue}>{formatDateFriendly(v.lastConfirmedDate)}</div>
                          </div>
                          <div style={styles.kvItem}>
                            <div style={styles.kvLabel}>Last Declined</div>
                            <div style={styles.kvValue}>{formatDateFriendly(v.lastDeclinedDate)}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT: actions (existing behavior preserved) */}
                    <div className="v-actions" style={styles.actions}>
                      <button onClick={() => toggleActive(v.id)} style={styles.smallBtn}>
                        {v.active ? "Pause" : "Activate"}
                      </button>

                      <button onClick={() => toggleFirstTime(v.id)} style={styles.smallBtn}>
                        Toggle 1st
                      </button>

                      <select
                        value={getRole(v)}
                        onChange={(e) => setVolunteerRole(v.id, e.target.value)}
                        style={styles.smallSelect}
                        title="Set role"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>

                      <select
                        value={getCadence(v)}
                        onChange={(e) => updateVolunteerCadence(v.id, e.target.value)}
                        style={styles.smallSelect}
                        title="Set invite cadence"
                      >
                        {CADENCE_OPTIONS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>

                      <input
                        type="date"
                        value={getNextInviteDate(v)}
                        onChange={(e) => updateVolunteerNextInviteDate(v.id, e.target.value)}
                        style={styles.smallSelect}
                        title="Set next invite date"
                      />

                      {getCadence(v) === "monthly_pattern" ? (
                        <select
                          value={getMonthlyPattern(v)}
                          onChange={(e) => updateVolunteerMonthlyPattern(v.id, e.target.value)}
                          style={styles.smallSelect}
                          title="Set monthly pattern"
                        >
                          <option value="">Select pattern</option>
                          {MONTHLY_PATTERN_OPTIONS.map((p) => (
                            <option key={p.key} value={p.key}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      ) : null}

                      <div style={styles.inlineActionsRow}>
                        <button
                          onClick={() => openEditModal(v)}
                          style={styles.inlineBtn}
                          title="Edit volunteer details"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => deleteVolunteer(v.id)}
                          style={{ ...styles.inlineBtn, ...styles.inlineDeleteBtn }}
                          title="Delete volunteer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </section>

      {/* EDIT MODAL */}
      {editModal.open ? (
        <div style={styles.modalBackdrop} onClick={closeEditModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ fontWeight: 900 }}>Edit Volunteer</div>
              <button onClick={closeEditModal} style={styles.modalCloseBtn}>
                Close
              </button>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
              Added: {formatDateFriendly(editModal.createdAt)}
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              <label style={styles.label}>
                Name
                <input
                  value={editModal.name}
                  onChange={(e) => setEditModal((p) => ({ ...p, name: e.target.value }))}
                  style={styles.modalInput}
                />
              </label>

              <label style={styles.label}>
                Phone
                <input
                  value={editModal.phone}
                  onChange={(e) => setEditModal((p) => ({ ...p, phone: e.target.value }))}
                  onBlur={() => setEditModal((p) => ({ ...p, phone: formatPhoneUS(p.phone) }))}
                  style={styles.modalInput}
                  inputMode="tel"
                />
              </label>

              <label style={styles.label}>
                Role
                <select
                  value={editModal.coreRole}
                  onChange={(e) => setEditModal((p) => ({ ...p, coreRole: e.target.value }))}
                  style={styles.modalInput}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>

              <label style={styles.label}>
                Invite Cadence
                <select
                  value={editModal.inviteCadence}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEditModal((p) => ({
                      ...p,
                      inviteCadence: value,
                      monthlyPattern: value === "monthly_pattern" ? p.monthlyPattern : "",
                    }));
                  }}
                  style={styles.modalInput}
                >
                  {CADENCE_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={styles.label}>
                Next Invite Date (Scheduled)
                <input
                  type="date"
                  value={editModal.nextInviteDate}
                  onChange={(e) => setEditModal((p) => ({ ...p, nextInviteDate: e.target.value }))}
                  style={styles.modalInput}
                />
              </label>

              {editModal.inviteCadence === "monthly_pattern" ? (
                <label style={styles.label}>
                  Monthly Pattern
                  <select
                    value={editModal.monthlyPattern}
                    onChange={(e) => setEditModal((p) => ({ ...p, monthlyPattern: e.target.value }))}
                    style={styles.modalInput}
                  >
                    <option value="">Select a pattern</option>
                    {MONTHLY_PATTERN_OPTIONS.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label style={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={editModal.firstTime}
                  onChange={(e) => setEditModal((p) => ({ ...p, firstTime: e.target.checked }))}
                />
                First-time volunteer
              </label>

              <label style={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={editModal.active}
                  onChange={(e) => setEditModal((p) => ({ ...p, active: e.target.checked }))}
                />
                Active (unchecked = Paused)
              </label>

              {/* ✅ NEW: Notes in edit modal */}
              <label style={styles.label}>
                Notes
                <textarea
                  value={editModal.notes}
                  onChange={(e) => setEditModal((p) => ({ ...p, notes: e.target.value }))}
                  rows={4}
                  style={styles.textarea}
                  placeholder="Add any detail to distinguish this volunteer…"
                />
              </label>

              <div style={styles.modalFooter}>
                <button onClick={closeEditModal} style={styles.modalSecondaryBtn}>
                  Cancel
                </button>
                <button onClick={saveEditModal} style={styles.modalPrimaryBtn}>
                  Save Changes
                </button>
              </div>

              <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.35 }}>
                Tip: Next Invite Date is the “source of truth” for Scheduling System V2. If it’s blank, the person won’t appear as “due.”
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ✅ Small helper used in list sorting (keeps UI stable now that there’s more info)
function roleRank(role) {
  const idx = ROLE_SORT_PRIORITY.indexOf(role);
  return idx === -1 ? 999 : idx;
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
  "Gateway Employee",
  "Alt Gateway Employee",
  "Volunteer",
];

const styles = {
  card: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
  },
  row: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
  },
  label: {
    display: "grid",
    gap: 6,
    fontWeight: 800,
    fontSize: 14,
    opacity: 0.95,
  },
  input: {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.12)",
    fontSize: 14,
  },
  textarea: {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.12)",
    fontSize: 14,
    resize: "vertical",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
    lineHeight: 1.35,
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontWeight: 800,
    fontSize: 14,
  },
  primaryBtn: {
    width: "100%",
    padding: "14px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    fontWeight: 800,
    fontSize: 14,
  },

  // ✅ Search styles
  searchWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 12,
    padding: "10px 12px",
  },
  searchIcon: {
    color: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  searchInput: {
    flex: 1,
    border: "none",
    outline: "none",
    fontSize: 14,
  },
  clearBtn: {
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    padding: "8px 10px",
    borderRadius: 10,
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 13,
  },

  // ✅ Cleaner card layout
  volRow: {
    display: "flex",
    gap: 12,
    justifyContent: "space-between",
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 12,
    padding: 12,
  },
  volHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  duePill: {
    fontSize: 12,
    fontWeight: 900,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(0,0,0,0.04)",
  },
  metaRow: {
    marginTop: 6,
    fontSize: 12,
    opacity: 0.85,
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
  },

  smallLabel: {
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.8,
    marginBottom: 4,
  },
  notesPreview: {
    fontSize: 13,
    lineHeight: 1.35,
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(0,0,0,0.02)",
    whiteSpace: "pre-wrap",
  },

  block: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(0,0,0,0.02)",
  },
  blockTitle: {
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.8,
    marginBottom: 8,
  },
  kvGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  kvItem: {},
  kvLabel: {
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.75,
  },
  kvValue: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 1.25,
  },

  actions: {
    display: "grid",
    gap: 8,
    minWidth: 180,
    alignSelf: "flex-start",
  },
  smallBtn: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
  },
  smallSelect: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    fontWeight: 800,
    fontSize: 14,
  },
  inlineActionsRow: {
    display: "flex",
    gap: 10,
    width: "100%",
    marginTop: 4,
  },
  inlineBtn: {
    flex: 1,
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
  },
  inlineDeleteBtn: {
    borderColor: "rgba(185, 28, 28, 0.35)",
  },

  modalBackdrop: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.40)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    zIndex: 999,
  },
  modalCard: {
    width: "min(620px, calc(100vw - 28px))",
    maxHeight: "calc(100vh - 28px)",
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    background: "white",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.12)",
    padding: 14,
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  modalCloseBtn: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
  },
  modalInput: {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.12)",
    fontSize: 16,
    background: "white",
  },
  modalFooter: {
    display: "flex",
    gap: 10,
    marginTop: 6,
  },
  modalSecondaryBtn: {
    flex: 1,
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
  },
  modalPrimaryBtn: {
    flex: 1,
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
  },
};