import React, { useEffect, useMemo, useState } from "react";

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
];

function getRole(v) {
  // Backward compatibility: old records had null role
  return v.coreRole || "Volunteer";
}

// ✅ Invite cadence options (Option 2 rotation)
const CADENCE_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

function getCadence(v) {
  // Default existing volunteers to monthly unless set
  return v.inviteCadence || "monthly";
}

export default function VolunteersPage({ appState, setAppState }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("Volunteer");
  const [firstTime, setFirstTime] = useState(false);

  // ✅ Add Volunteer form cadence (defaults to monthly)
  const [cadence, setCadence] = useState("monthly");

  const volunteers = appState.volunteers;

  const activeCount = useMemo(
    () => volunteers.filter((v) => v.active).length,
    [volunteers]
  );

  // =========================
  // Edit Modal (NEW UI only)
  // =========================
  const [editModal, setEditModal] = useState({
    open: false,
    volunteerId: null,
    name: "",
    phone: "",
    coreRole: "Volunteer",
    inviteCadence: "monthly",
    firstTime: false,
    active: true,
  });

  function openEditModal(v) {
    setEditModal({
      open: true,
      volunteerId: v.id,
      name: v.name || "",
      phone: v.phone || "",
      coreRole: getRole(v),
      inviteCadence: getCadence(v),
      firstTime: !!v.firstTime,
      active: !!v.active,
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
      firstTime: false,
      active: true,
    });
  }

  function saveEditModal() {
    const trimmedName = editModal.name.trim();
    const trimmedPhone = editModal.phone.trim();

    if (!trimmedName) return alert("Please enter a name.");
    if (!trimmedPhone) return alert("Please enter a phone number.");

    // Patch volunteer (NEW) — does not change existing logic, just updates fields
    setAppState((prev) => ({
      ...prev,
      volunteers: prev.volunteers.map((v) =>
        v.id === editModal.volunteerId
          ? {
              ...v,
              name: trimmedName,
              phone: trimmedPhone,
              coreRole: editModal.coreRole,
              inviteCadence: editModal.inviteCadence,
              firstTime: !!editModal.firstTime,
              active: !!editModal.active,
            }
          : v
      ),
    }));

    closeEditModal();
  }

  // Lock body scroll when modal open (prevents background scroll/jank)
  useEffect(() => {
    if (!editModal.open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [editModal.open]);

  function addVolunteer(e) {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) return alert("Please enter a name.");
    if (!trimmedPhone) return alert("Please enter a phone number.");

    const newVolunteer = {
      id: crypto.randomUUID(),
      name: trimmedName,
      phone: trimmedPhone,
      coreRole: role,
      firstTime: Boolean(firstTime),
      active: true,
      lastConfirmedDate: null,
      lastDeclinedDate: null,

      // ✅ new fields
      inviteCadence: cadence || "monthly",
      lastInvitedAt: null,
    };

    setAppState((prev) => ({
      ...prev,
      volunteers: [newVolunteer, ...prev.volunteers],
    }));

    // reset form
    setName("");
    setPhone("");
    setRole("Volunteer");
    setFirstTime(false);
    setCadence("monthly");
  }

  function toggleActive(volunteerId) {
    setAppState((prev) => ({
      ...prev,
      volunteers: prev.volunteers.map((v) =>
        v.id === volunteerId ? { ...v, active: !v.active } : v
      ),
    }));
  }

  function toggleFirstTime(volunteerId) {
    setAppState((prev) => ({
      ...prev,
      volunteers: prev.volunteers.map((v) =>
        v.id === volunteerId ? { ...v, firstTime: !v.firstTime } : v
      ),
    }));
  }

  function setVolunteerRole(volunteerId, newRole) {
    setAppState((prev) => ({
      ...prev,
      volunteers: prev.volunteers.map((v) =>
        v.id === volunteerId ? { ...v, coreRole: newRole } : v
      ),
    }));
  }

  // ✅ NEW: update cadence per volunteer
  function updateVolunteerCadence(volunteerId, inviteCadence) {
    setAppState((prev) => ({
      ...prev,
      volunteers: prev.volunteers.map((v) =>
        v.id === volunteerId ? { ...v, inviteCadence } : v
      ),
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

  return (
    <div className="v-page">
      <h2 style={{ marginTop: 0 }}>Volunteers</h2>

      <section style={styles.card}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>Add Volunteer</div>
        {/* Volunteer Form */}
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
              placeholder="(555) 555-5555"
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

          {/* ✅ NEW: Cadence (defaults monthly) */}
          <label style={styles.label}>
            Invite Cadence
            <select value={cadence} onChange={(e) => setCadence(e.target.value)} style={styles.input}>
              {CADENCE_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="v-checkboxRow" style={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={firstTime}
              onChange={(e) => setFirstTime(e.target.checked)}
            />
            First-time volunteer
          </label>

          <button type="submit" className="v-submitBtn" style={styles.primaryBtn}>
            Add Volunteer
          </button>
        </form>
      </section>

      <section style={styles.card}>
        <div style={styles.row}>
          <div style={{ fontWeight: 900 }}>Roster</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Active: {activeCount} / Total: {volunteers.length}
          </div>
        </div>

        {volunteers.length === 0 ? (
          <div style={{ marginTop: 10, opacity: 0.75 }}>No volunteers yet. Add your first person above.</div>
        ) : (
          <div className="v-list" style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {volunteers.map((v) => (
              <div key={v.id} className="v-card" style={styles.volRow}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, lineHeight: 1.2 }}>
                    {v.name}{" "}
                    {!v.active ? <span style={{ fontSize: 12, opacity: 0.7 }}>(Paused)</span> : null}
                  </div>

                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{v.phone}</div>

                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                    Role: {getRole(v)} • First-time: {v.firstTime ? "Yes" : "No"}
                  </div>

                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                    Cadence:{" "}
                    {CADENCE_OPTIONS.find((c) => c.value === getCadence(v))?.label || "Monthly"}
                  </div>
                </div>

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

                  {/* ✅ NEW: inline Edit + Delete row (bigger + padded + even) */}
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
            ))}
          </div>
        )}
      </section>

      {/* =========================
          EDIT MODAL (responsive + fixed)
         ========================= */}
      {editModal.open ? (
        <div style={styles.modalBackdrop} onClick={closeEditModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ fontWeight: 900 }}>Edit Volunteer</div>
              <button onClick={closeEditModal} style={styles.modalCloseBtn}>
                Close
              </button>
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
                  onChange={(e) => setEditModal((p) => ({ ...p, inviteCadence: e.target.value }))}
                  style={styles.modalInput}
                >
                  {CADENCE_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>

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

              {/* Footer buttons */}
              <div style={styles.modalFooter}>
                <button onClick={closeEditModal} style={styles.modalSecondaryBtn}>
                  Cancel
                </button>
                <button onClick={saveEditModal} style={styles.modalPrimaryBtn}>
                  Save Changes
                </button>
              </div>

              <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.35 }}>
                Tip: On iPhone, inputs below 16px font can cause “zoom” — this modal uses 16px to prevent that.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

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
    fontSize: 12,
    opacity: 0.95,
  },

  // ✅ IMPORTANT: 16px prevents mobile iOS zoom on focus
  input: {
    width: "100%",
    padding: 10,
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.12)",
    fontSize: 16,
  },

  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontWeight: 800,
  },

  primaryBtn: {
    width: "100%",
    padding: "12px 10px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    fontWeight: 900,
    fontSize: 14,
  },

  volRow: {
    display: "flex",
    gap: 12,
    justifyContent: "space-between",
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 12,
    padding: 10,
  },

  actions: {
    display: "grid",
    gap: 8,
    minWidth: 160,
  },

  smallBtn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    fontWeight: 800,
    fontSize: 14,
  },

  smallSelect: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    fontWeight: 800,
    fontSize: 14,
  },

  // ✅ Inline Edit/Delete row — larger + even + padded from sides
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
  },
  inlineDeleteBtn: {
    borderColor: "rgba(185, 28, 28, 0.35)",
  },

  // =========================
  // Modal styling (fixed + responsive + scrollable)
  // =========================
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
    width: "min(560px, calc(100vw - 28px))",
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
  },

  // ✅ Keep modal inputs 16px to prevent zoom
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
  },
  modalPrimaryBtn: {
    flex: 1,
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    fontWeight: 900,
    fontSize: 14,
  },
};
