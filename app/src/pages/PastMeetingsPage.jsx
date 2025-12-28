import React, { useMemo, useState } from "react";
import { formatFriendlyDate } from "../utils/date.js";

const STATUS_ORDER = ["Not Invited", "Invited", "Confirmed", "Declined", "No Response"];

function getRole(v) {
  return v?.coreRole || "Volunteer";
}

function fmtTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return "—";
  }
}

export default function PastMeetingsPage({ appState }) {
  const [selectedWeekId, setSelectedWeekId] = useState(null);

  const volunteersById = useMemo(() => {
    const m = new Map();
    for (const v of appState.volunteers) m.set(v.id, v);
    return m;
  }, [appState.volunteers]);

  const weeksSorted = useMemo(() => {
    return [...appState.weeks].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [appState.weeks]);

  const selectedWeek = useMemo(() => {
    if (!selectedWeekId) return weeksSorted[0] || null;
    return appState.weeks.find((w) => w.id === selectedWeekId) || null;
  }, [selectedWeekId, weeksSorted, appState.weeks]);

  const summary = useMemo(() => {
    if (!selectedWeek) return null;
    const counts = {
      total: selectedWeek.invites.length,
      "Not Invited": 0,
      Invited: 0,
      Confirmed: 0,
      Declined: 0,
      "No Response": 0,
    };
    for (const inv of selectedWeek.invites) {
      counts[inv.status] = (counts[inv.status] || 0) + 1;
    }
    return counts;
  }, [selectedWeek]);

  const invitesSorted = useMemo(() => {
    if (!selectedWeek) return [];
    return [...selectedWeek.invites].sort((a, b) => {
      const sa = STATUS_ORDER.indexOf(a.status);
      const sb = STATUS_ORDER.indexOf(b.status);
      if (sa !== sb) return sa - sb;

      const va = volunteersById.get(a.volunteerId);
      const vb = volunteersById.get(b.volunteerId);
      return (va?.name || "").localeCompare(vb?.name || "");
    });
  }, [selectedWeek, volunteersById]);

  if (weeksSorted.length === 0) {
    return (
      <div>
        <h2 style={{ marginTop: 0 }}>Past Meetings</h2>
        <div style={{ opacity: 0.75 }}>
          No weeks exist yet. Create a week on the Coordinator tab first.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Past Meetings</h2>

      {/* Week Picker */}
      <section style={styles.card}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Choose a week</div>
        <div style={{ display: "grid", gap: 8 }}>
          {weeksSorted.map((w) => (
            <button
              key={w.id}
              onClick={() => setSelectedWeekId(w.id)}
              style={{
                ...styles.weekBtn,
                border:
                  selectedWeek?.id === w.id
                    ? "1px solid rgba(0,0,0,0.45)"
                    : "1px solid rgba(0,0,0,0.12)",
              }}
            >
              <div style={{ fontWeight: 900 }}>{formatFriendlyDate(w.date)}</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                {w.finalized ? "Finalized" : "Not Finalized"} • {w.invites.length} invited
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Selected Week Summary */}
      {selectedWeek ? (
        <section style={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontWeight: 900 }}>{formatFriendlyDate(selectedWeek.date)}</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              {selectedWeek.finalized ? "Finalized ✅" : "Not Finalized"}
            </div>
          </div>

          {summary ? (
            <div style={{ marginTop: 10, lineHeight: 1.5 }}>
              <div><b>Total:</b> {summary.total}</div>
              <div><b>Confirmed:</b> {summary.Confirmed}</div>
              <div><b>Invited:</b> {summary.Invited}</div>
              <div><b>Declined:</b> {summary.Declined}</div>
              <div><b>No Response:</b> {summary["No Response"]}</div>
              <div><b>Not Invited:</b> {summary["Not Invited"]}</div>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Selected Week Details */}
      {selectedWeek ? (
        <section style={styles.card}>
          <div style={{ fontWeight: 900 }}>Week Details</div>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
            Full list + statuses + timestamps
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {invitesSorted.map((inv) => {
              const v = volunteersById.get(inv.volunteerId);
              if (!v) return null;

              return (
                <div key={inv.id} style={styles.rowCard}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900 }}>{v.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                      {v.phone} • {getRole(v)} • First-time: {v.firstTime ? "Yes" : "No"}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6, lineHeight: 1.4 }}>
                      <div><b>Invite sent:</b> {fmtTime(inv.inviteSentAt)}</div>
                      <div><b>Follow-up:</b> {fmtTime(inv.followUpSentAt)}</div>
                      <div><b>Response at:</b> {fmtTime(inv.responseAt)}</div>
                    </div>
                  </div>

                  <div style={{ minWidth: 130, textAlign: "right" }}>
                    <div style={styles.pill}>{inv.status}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
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
  weekBtn: {
    textAlign: "left",
    padding: 10,
    borderRadius: 12,
    background: "white",
    cursor: "pointer",
  },
  rowCard: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 12,
    padding: 10,
  },
  pill: {
    display: "inline-block",
    fontSize: 12,
    fontWeight: 900,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
  },
};
