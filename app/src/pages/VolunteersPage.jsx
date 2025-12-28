import React, { useMemo, useState } from "react";

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

export default function VolunteersPage({ appState, setAppState }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("Volunteer");
  const [firstTime, setFirstTime] = useState(false);

  const volunteers = appState.volunteers;

  const activeCount = useMemo(
    () => volunteers.filter((v) => v.active).length,
    [volunteers]
  );

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
      coreRole: role, // we keep the same field name to avoid refactors
      firstTime: Boolean(firstTime),
      active: true,
      lastConfirmedDate: null,
      lastDeclinedDate: null,
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
        <form
          onSubmit={addVolunteer}
          className="v-form"
          style={{ display: "grid", gap: 10 }}
        >
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
            />
          </label>

          <label style={styles.label}>
            Role
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={styles.input}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
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
          <div style={{ marginTop: 10, opacity: 0.75 }}>
            No volunteers yet. Add your first person above.
          </div>
        ) : (
          // Roster List Wrapper
          <div className="v-list" style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {volunteers.map((v) => (
              <div key={v.id} className="v-card" style={styles.volRow}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, lineHeight: 1.2 }}>
                    {v.name}{" "}
                    {!v.active ? (
                      <span style={{ fontSize: 12, opacity: 0.7 }}>
                        (Paused)
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                    {v.phone}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                    Role: {getRole(v)} • First-time: {v.firstTime ? "Yes" : "No"}
                  </div>
                </div>

                <div className="v-actions" style={styles.actions}>
                  <button
                    onClick={() => toggleActive(v.id)}
                    style={styles.smallBtn}
                  >
                    {v.active ? "Pause" : "Activate"}
                  </button>

                  <button
                    onClick={() => toggleFirstTime(v.id)}
                    style={styles.smallBtn}
                  >
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

                  <button
                    onClick={() => deleteVolunteer(v.id)}
                    style={{
                      ...styles.smallBtn,
                      borderColor: "rgba(0,0,0,0.25)",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
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
  input: {
    width: "100%",
    padding: 10,
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.12)",
    fontSize: 14,
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
    gap: 6,
    minWidth: 140,
  },
  smallBtn: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    fontWeight: 800,
    fontSize: 12,
  },
  smallSelect: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    fontWeight: 800,
    fontSize: 12,
  },
};
