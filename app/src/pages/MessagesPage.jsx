import React from "react";

export default function MessagesPage({ appState, setAppState }) {
  const msgs = appState.settings.messages;

  /**
   * Updates one saved message in appState.settings.messages
   * - Keeps all other settings/messages intact
   * - Saves automatically as the user types
   */
  function setMsg(key, value) {
    setAppState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        messages: {
          ...prev.settings.messages,
          [key]: value,
        },
      },
    }));
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Messages</h2>
      <p style={{ opacity: 0.8, marginTop: 6 }}>
        Edit once. Reuse forever. These save automatically.
      </p>

      <MessageBox
        title="Weekly Invite"
        value={msgs.invite}
        onChange={(v) => setMsg("invite", v)}
      />

      <MessageBox
        title="Wednesday Follow-Up"
        value={msgs.followUp}
        onChange={(v) => setMsg("followUp", v)}
      />

      <MessageBox
        title="Friday Reminder"
        value={msgs.reminder}
        onChange={(v) => setMsg("reminder", v)}
      />

      <MessageBox
        title="First-Time Volunteer"
        value={msgs.firstTime}
        onChange={(v) => setMsg("firstTime", v)}
      />

      <MessageBox
        title="1st Step Lead Request"
        value={msgs.firstStepLeadRequest}
        onChange={(v) => setMsg("firstStepLeadRequest", v)}
      />

      {/* NEW: Used by DashboardPage.jsx "Text" button in Consider Pausing / Check-In */}
      <MessageBox
        title="Check-In / Consider Pausing"
        value={msgs.checkIn}
        onChange={(v) => setMsg("checkIn", v)}
      />
    </div>
  );
}

/**
 * Reusable message editor box
 * - Displays a title
 * - Shows auto-save note
 * - Uses textarea for easy message editing
 */
function MessageBox({ title, value, onChange }) {
  return (
    <section style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Saved automatically</div>
      </div>

      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={7}
        style={styles.textarea}
      />
    </section>
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
  cardHeader: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },
  textarea: {
    width: "100%",
    resize: "vertical",
    padding: 10,
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.12)",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 13,
    lineHeight: 1.35,
  },
};