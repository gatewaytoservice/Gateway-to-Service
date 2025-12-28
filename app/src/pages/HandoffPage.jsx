// src/pages/HandoffPage.jsx
import React, { useMemo, useState } from "react";

export default function HandoffPage({ appState }) {
  const mission = appState?.settings?.mission;

  // Step 22: New Coordinator Checklist state (local only, no appState changes)
  const [checked, setChecked] = useState(() => ({}));
  const [openKey, setOpenKey] = useState("startWeek"); // one open at a time keeps it neat

  function toggleChecked(key) {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleOpen(key) {
    setOpenKey((prev) => (prev === key ? null : key));
  }

  const steps = useMemo(
    () => [
      {
        key: "import",
        title: "Import the file (if you received one)",
        oneLiner: "Go to Export tab → Import JSON → paste → Import.",
        details: (
          <>
            <div style={styles.detailLine}>
              <b>Where:</b> Bottom nav → <b>Export</b>
            </div>
            <div style={styles.detailLine}>
              <b>What:</b> If the previous coordinator sent you a JSON file/export, paste it
              into Import and click Import.
            </div>
            <div style={styles.detailLine}>
              <b>Why:</b> This restores volunteers, settings, and week history so you don’t start from scratch.
            </div>
          </>
        ),
      },
      {
        key: "settings",
        title: "Check settings + messages",
        oneLiner: "Confirm mission + templates are correct before inviting.",
        details: (
          <>
            <div style={styles.detailLine}>
              <b>Where:</b> Bottom nav → <b>Messages</b>
            </div>
            <div style={styles.detailLine}>
              <b>Check:</b> Invite text, follow-up text, Friday reminder text.
            </div>
            <div style={styles.detailLine}>
              <b>Tip:</b> If anything looks off, fix it here first so you don’t have to resend corrected texts later.
            </div>
          </>
        ),
      },
      {
        key: "volunteers",
        title: "Confirm volunteers + roles",
        oneLiner: "Make sure key roles are assigned and volunteers are Active.",
        details: (
          <>
            <div style={styles.detailLine}>
              <b>Where:</b> Bottom nav → <b>Volunteers</b>
            </div>
            <div style={styles.detailLine}>
              <b>Check:</b> Core roles are assigned (Chairperson, List Coordinator, Meeting Steward, Discussion Lead, Big Book Lead).
            </div>
            <div style={styles.detailLine}>
              <b>Also:</b> Verify phone numbers and that volunteers who can serve are marked <b>Active</b>.
            </div>
          </>
        ),
      },
      {
        key: "startWeek",
        title: "Start the week",
        oneLiner: "Coordinator tab → create week if needed (pinned roles auto-add).",
        details: (
          <>
            <div style={styles.detailLine}>
              <b>Where:</b> Bottom nav → <b>Coordinator</b>
            </div>
            <div style={styles.detailLine}>
              <b>Do:</b> If you see <b>Create This Week</b>, tap it.
            </div>
            <div style={styles.detailLine}>
              <b>Expected:</b> Core roles appear in “Required Roles” and can be added (or are already added, depending on your auto-add setup).
            </div>
            <div style={styles.detailLine}>
              <b>Goal:</b> Build toward <b>9–14</b> total volunteers.
            </div>
          </>
        ),
      },
      {
        key: "invite",
        title: "Send invitations",
        oneLiner: "Tap Send Invite next to each person; it copies the text.",
        details: (
          <>
            <div style={styles.detailLine}>
              <b>Flow:</b> Add volunteer → tap <b>Send Invite</b> → paste into your text app.
            </div>
            <div style={styles.detailLine}>
              <b>Tracking:</b> Status changes to <b>Invited</b> and stores the timestamp.
            </div>
          </>
        ),
      },
      {
        key: "responses",
        title: "Track responses (Yes / No)",
        oneLiner: "When they reply, tap Mark Yes or Mark No.",
        details: (
          <>
            <div style={styles.detailLine}>
              <b>Mark Yes:</b> sets status to <b>Confirmed</b> and updates last confirmed date for cooldown logic.
            </div>
            <div style={styles.detailLine}>
              <b>Mark No:</b> sets status to <b>Declined</b> and updates last declined date.
            </div>
            <div style={styles.detailLine}>
              <b>Tip:</b> Confirmed count at the top updates automatically.
            </div>
          </>
        ),
      },
      {
        key: "weds",
        title: "Wednesday follow-up (no reply)",
        oneLiner: "Send follow-up to anyone still Invited; mark No Response by end of day.",
        details: (
          <>
            <div style={styles.detailLine}>
              <b>Do:</b> Tap <b>Send Follow-Up</b> for anyone who hasn’t replied.
            </div>
            <div style={styles.detailLine}>
              <b>Then:</b> If no response by Wednesday evening, tap <b>Mark No Response</b> and invite a replacement.
            </div>
          </>
        ),
      },
      {
        key: "finalize",
        title: "Finalize the list",
        oneLiner: "Once you have the minimum confirmed, tap Finalize List.",
        details: (
          <>
            <div style={styles.detailLine}>
              <b>Rule:</b> Finalize unlocks the “Friday Reminder” section and signals you should stop inviting (unless a cancellation happens).
            </div>
            <div style={styles.detailLine}>
              <b>Target:</b> Minimum is your app setting (often 9). Preferred is typically higher.
            </div>
          </>
        ),
      },
      {
        key: "friday",
        title: "Friday reminder (confirmed only)",
        oneLiner: "Copy reminders for confirmed volunteers Friday morning.",
        details: (
          <>
            <div style={styles.detailLine}>
              <b>Where:</b> Coordinator tab → “Friday Reminder (Confirmed Only)” appears after finalize.
            </div>
            <div style={styles.detailLine}>
              <b>If cancellation:</b> Use <b>Add Last-Minute Volunteer</b> → send invite → mark yes/no like normal.
            </div>
          </>
        ),
      },
    ],
    []
  );

  const doneCount = Object.values(checked).filter(Boolean).length;
  const totalCount = steps.length;

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Handoff Mode</h2>

      {/* Mission */}
      <section style={styles.card}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>Mission</div>
        <div style={{ opacity: 0.9, lineHeight: 1.35 }}>{mission}</div>
      </section>

      {/* Step 22: New Coordinator Checklist */}
      <section style={styles.card}>
        <div style={styles.row}>
          <div style={{ fontWeight: 900 }}>New Coordinator Checklist</div>
          <div style={styles.progressPill}>
            {doneCount}/{totalCount} done
          </div>
        </div>

        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          {steps.map((s, idx) => {
            const isOpen = openKey === s.key;
            const isDone = !!checked[s.key];

            return (
              <div key={s.key} style={styles.stepCard}>
                <div style={styles.stepTopRow}>
                  <label style={styles.checkRow}>
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={() => toggleChecked(s.key)}
                      style={styles.checkbox}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={styles.stepTitleRow}>
                        <div style={styles.stepNum}>{idx + 1}</div>
                        <div style={styles.stepTitle}>{s.title}</div>
                      </div>
                      <div style={styles.oneLiner}>{s.oneLiner}</div>
                    </div>
                  </label>

                  <button
                    onClick={() => toggleOpen(s.key)}
                    style={styles.detailsBtn}
                    aria-expanded={isOpen}
                  >
                    {isOpen ? "Hide" : "Details"}
                  </button>
                </div>

                {isOpen ? <div style={styles.detailsBox}>{s.details}</div> : null}
              </div>
            );
          })}
        </div>

        <div style={styles.noteBox}>
          <b>Important:</b> It’s always okay to say no. It’s important to respond honestly
          so the meeting is fully supported.
        </div>
      </section>

      {/* Need Help */}
      <section style={styles.card}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Need Help?</div>
        <div style={{ opacity: 0.85, lineHeight: 1.35 }}>
          If you’re unsure what to do, reach out to the Chairperson or Meeting Steward.
        </div>
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
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  progressPill: {
    fontSize: 12,
    fontWeight: 900,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    opacity: 0.9,
    whiteSpace: "nowrap",
  },
  stepCard: {
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 12,
    padding: 10,
  },
  stepTopRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  checkRow: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    cursor: "pointer",
    flex: 1,
    minWidth: 0,
  },
  checkbox: {
    marginTop: 4,
    transform: "scale(1.05)",
  },
  stepTitleRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    minWidth: 0,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    flex: "0 0 auto",
  },
  stepTitle: {
    fontWeight: 900,
    lineHeight: 1.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  oneLiner: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.85,
    lineHeight: 1.35,
  },
  detailsBtn: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    fontWeight: 900,
    fontSize: 12,
    whiteSpace: "nowrap",
    cursor: "pointer",
  },
  detailsBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(0,0,0,0.02)",
    fontSize: 12,
    lineHeight: 1.4,
    opacity: 0.95,
  },
  detailLine: {
    marginTop: 6,
  },
  noteBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    opacity: 0.9,
    lineHeight: 1.35,
  },
};
