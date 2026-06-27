// app/src/pages/ExportImportPage.jsx
import React, { useMemo, useRef, useState } from "react";
import { replaceState } from "../state/storage.js";

/**
 * ExportImportPage.jsx (UI refresh)
 *
 * ✅ IMPORTANT
 * - This file keeps the SAME core logic you already had:
 *   - Transfer Code copy/paste (clipboard)
 *   - Backup file download
 *   - Backup file import (take over)
 *   - Transfer code modal (take over)
 *   - Validation + confirm “replace this device”
 *
 * ✅ What changed
 * - Layout + styling only (cleaner “Send” / “Take Over” split, calmer theme, clearer safety notes).
 * - No behavior changes to how data is encoded/decoded or imported.
 *
 * ✅ How this works (developer notes)
 * - “Send”:
 *   - Transfer Code: compact JSON → base64 (unicode-safe) → prefix “GTS1:” → copy to clipboard.
 *   - Backup File: pretty JSON → download .json file.
 * - “Take Over”:
 *   - Either paste Transfer Code OR import JSON file.
 *   - Both paths validate + ask confirmation, then replaceState(parsed) normalizes/saves local device data.
 */

const BACKUP_PREFIX = "GTS1:"; // versioned prefix for clipboard backups

// Calm theme (local to this page)
const THEME = {
  navy: "#243447",
  teal: "#4A8F8B",
  bg: "#FAFAFA",
  card: "#FFFFFF",
  border: "#E2E6EA",
  muted: "#6B7280",

  // status tints
  goodBg: "rgba(74, 143, 139, 0.12)",
  warnBg: "rgba(176, 141, 44, 0.12)",
  badBg: "rgba(185, 28, 28, 0.10)",
};

export default function ExportImportPage({ appState, setAppState }) {
  const fileInputRef = useRef(null);

  const [status, setStatus] = useState("");
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreText, setRestoreText] = useState("");

  const filename = useMemo(() => {
    const stamp = new Date().toISOString().slice(0, 10);
    return `gateway-to-service-backup-${stamp}.json`;
  }, []);

  // ---------- helpers ----------
  function summarizeState(state) {
    try {
      const volunteers = Array.isArray(state?.volunteers) ? state.volunteers : [];
      const weeks = Array.isArray(state?.weeks) ? state.weeks : [];
      const activeCount = volunteers.filter((v) => !!v?.active).length;

      const mostRecentWeek = weeks[0] || null;
      const invites = Array.isArray(mostRecentWeek?.invites) ? mostRecentWeek.invites : [];
      const confirmed = invites.filter((i) => i?.status === "Confirmed").length;

      return {
        version: state?.version,
        volunteers: volunteers.length,
        active: activeCount,
        weeks: weeks.length,
        mostRecentWeekDate: mostRecentWeek?.date || "—",
        mostRecentWeekInvites: invites.length,
        mostRecentWeekConfirmed: confirmed,
      };
    } catch {
      return null;
    }
  }

  function validateImportedState(obj) {
    if (!obj || typeof obj !== "object") return "Invalid format.";
    if (obj.version !== 1) return "Wrong or missing version (expected version 1).";
    if (!obj.settings || !obj.volunteers || !obj.weeks) return "Missing required fields.";
    if (!obj.settings.messages) return "Missing message templates.";
    if (!Array.isArray(obj.volunteers) || !Array.isArray(obj.weeks)) return "Invalid volunteers/weeks.";
    return null;
  }

  function confirmReplaceThisDevice(label) {
    return window.confirm(
      `This will REPLACE the data stored on THIS device.\n\nContinue with: ${label}?`
    );
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copied ✅");
    } catch (e) {
      console.error(e);
      setStatus("Copy failed ❌");
    }
  }

  // base64 helpers (unicode-safe)
  function toBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary);
  }

  function fromBase64(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  // ---------- Share (clipboard code) ----------
  function buildTransferCode(state) {
    const json = JSON.stringify(state); // compact JSON for smaller code
    const b64 = toBase64(json);
    return `${BACKUP_PREFIX}${b64}`;
  }

  async function handleCopyTransferCode() {
    try {
      const code = buildTransferCode(appState);
      await copyToClipboard(code);
      setStatus("Transfer code copied ✅ (paste into a text/email)");
    } catch (e) {
      console.error(e);
      setStatus("Copy failed ❌");
    }
  }

  // ---------- Share (file) ----------
  function handleDownloadBackupFile() {
    try {
      const json = JSON.stringify(appState, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
      setStatus("Backup file downloaded ✅");
    } catch (e) {
      console.error(e);
      setStatus("Download failed ❌");
    }
  }

  // ---------- Take Over (file) ----------
  function triggerFilePicker() {
    setStatus("");
    fileInputRef.current?.click();
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      const err = validateImportedState(parsed);
      if (err) {
        setStatus(`Could not use that file ❌ ${err}`);
        e.target.value = "";
        return;
      }

      if (!confirmReplaceThisDevice("Take Over using backup file")) {
        setStatus("Cancelled.");
        e.target.value = "";
        return;
      }

      const normalized = replaceState(parsed);
      setAppState(normalized);
      setStatus("Take over complete ✅ (this device is now set up)");
      e.target.value = "";
    } catch (err) {
      console.error(err);
      setStatus("Import failed ❌ (could not read that file)");
      e.target.value = "";
    }
  }

  // ---------- Take Over (transfer code) ----------
  function openRestoreModal() {
    setRestoreText("");
    setRestoreOpen(true);
    setStatus("");
  }

  function closeRestoreModal() {
    setRestoreOpen(false);
    setRestoreText("");
  }

  function parseTransferCode(text) {
    const raw = String(text || "").trim();
    if (!raw) return { error: "Paste the transfer code first." };

    if (!raw.startsWith(BACKUP_PREFIX)) {
      return {
        error: `That doesn’t look like a Gateway transfer code. It should start with "${BACKUP_PREFIX}".`,
      };
    }

    const b64 = raw.slice(BACKUP_PREFIX.length).trim();
    if (!b64) return { error: "Transfer code is missing data." };

    try {
      const json = fromBase64(b64);
      const parsed = JSON.parse(json);

      const err = validateImportedState(parsed);
      if (err) return { error: err };

      return { parsed };
    } catch (e) {
      console.error(e);
      return { error: "Could not decode that transfer code." };
    }
  }

  function handleTakeOverFromCode() {
    const res = parseTransferCode(restoreText);
    if (res.error) {
      setStatus(`Take over failed ❌ ${res.error}`);
      return;
    }

    if (!confirmReplaceThisDevice("Take Over using transfer code")) {
      setStatus("Cancelled.");
      return;
    }

    const normalized = replaceState(res.parsed);
    setAppState(normalized);
    setStatus("Take over complete ✅ (this device is now set up)");
    closeRestoreModal();
  }

  // ---------- UI summary ----------
  const summary = useMemo(() => summarizeState(appState), [appState]);

  const statusTone = useMemo(() => {
    const s = String(status || "");
    if (!s) return "none";
    if (s.includes("✅")) return "good";
    if (s.includes("❌")) return "bad";
    return "warn";
  }, [status]);

  return (
    <div style={{ background: THEME.bg, minHeight: "100vh", paddingBottom: 30 }}>
      {/* Header */}
      <div style={styles.headerWrap}>
        <div style={styles.headerTitle}>Send / Receive System</div>
        <div style={styles.headerSub}>
          Move the entire Gateway system to a new coordinator, safely.
        </div>
      </div>

      {/* Snapshot */}
      {summary ? (
        <section style={styles.card}>
          <div style={styles.cardTopRow}>
            <div>
              <div style={styles.cardTitle}>This device snapshot</div>
              <div style={styles.cardHint}>What you’re about to send / what you’ll replace</div>
            </div>
            <span style={styles.smallPill}>v{summary.version ?? "—"}</span>
          </div>

          <div style={styles.kpiGrid}>
            <div style={styles.kpiItem}>
              <div style={styles.kpiLabel}>Volunteers</div>
              <div style={styles.kpiValue}>
                {summary.volunteers} <span style={styles.kpiSub}>({summary.active} active)</span>
              </div>
            </div>

            <div style={styles.kpiItem}>
              <div style={styles.kpiLabel}>Weeks saved</div>
              <div style={styles.kpiValue}>{summary.weeks}</div>
            </div>

            <div style={{ ...styles.kpiItem, gridColumn: "1 / -1" }}>
              <div style={styles.kpiLabel}>Most recent week</div>
              <div style={styles.kpiValue}>
                {summary.mostRecentWeekDate}{" "}
                <span style={styles.kpiSub}>
                  • {summary.mostRecentWeekInvites} invites • {summary.mostRecentWeekConfirmed} confirmed
                </span>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Main layout */}
      <div style={styles.twoCol}>
        {/* SEND */}
        <section style={styles.card}>
          <div style={styles.cardTopRow}>
            <div>
              <div style={styles.cardTitle}>Send to a new coordinator</div>
              <div style={styles.cardHint}>Best: Transfer Code (works great on phones)</div>
            </div>
          </div>

          <div style={styles.calloutGood}>
            <div style={styles.calloutTitle}>Recommended</div>
            <div style={styles.calloutText}>
              Tap <b>Copy Transfer Code</b> → paste into a text/email → new coordinator pastes it here.
            </div>
          </div>

          <button onClick={handleCopyTransferCode} style={styles.primaryBtn}>
            Copy Transfer Code
          </button>

          <div style={styles.divider} />

          <div style={styles.calloutWarn}>
            <div style={styles.calloutTitle}>Optional backup file</div>
            <div style={styles.calloutText}>
              Download a JSON file you can save to iCloud/Drive as a fallback.
            </div>
          </div>

          <button onClick={handleDownloadBackupFile} style={styles.secondaryBtn}>
            Download Backup File
          </button>

          <div style={{ marginTop: 10, fontSize: 12, color: THEME.muted, lineHeight: 1.35 }}>
            File name: <b>{filename}</b>
          </div>
        </section>

        {/* RECEIVE */}
        <section style={styles.card}>
          <div style={styles.cardTopRow}>
            <div>
              <div style={styles.cardTitle}>Take over on this device</div>
              <div style={styles.cardHint}>This replaces what’s stored on this device</div>
            </div>
          </div>

          <div style={styles.calloutBad}>
            <div style={styles.calloutTitle}>Heads up</div>
            <div style={styles.calloutText}>
              Take Over will overwrite local data on <b>this</b> device. You’ll be asked to confirm.
            </div>
          </div>

          <button onClick={openRestoreModal} style={styles.primaryBtn}>
            Paste Transfer Code to Take Over
          </button>

          <button onClick={triggerFilePicker} style={styles.secondaryBtn}>
            Import Backup File to Take Over
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={handleImportFile}
          />

          <div style={{ marginTop: 12, fontSize: 12, color: THEME.muted, lineHeight: 1.35 }}>
            Tip: Transfer Code is usually easiest (no file handling).
          </div>
        </section>
      </div>

      {/* Simple instructions */}
      <section style={styles.card}>
        <div style={styles.cardTopRow}>
          <div>
            <div style={styles.cardTitle}>Quick handoff steps (copy/paste)</div>
            <div style={styles.cardHint}>Send these to the new coordinator</div>
          </div>
        </div>

        <div style={styles.steps}>
          <div style={styles.stepLine}>
            <b>1)</b> Open <b>Send / Receive System</b>
          </div>
          <div style={styles.stepLine}>
            <b>2)</b> Tap <b>Copy Transfer Code</b>
          </div>
          <div style={styles.stepLine}>
            <b>3)</b> Paste into a text/email to the new coordinator
          </div>
          <div style={styles.stepLine}>
            <b>4)</b> They open this page → <b>Paste Transfer Code to Take Over</b>
          </div>
        </div>

        <button
          onClick={() =>
            copyToClipboard(
              "Handoff steps:\n1) Open Send / Receive System\n2) Tap “Copy Transfer Code”\n3) Paste into a text/email to me\n4) I open Send / Receive System → “Paste Transfer Code to Take Over”"
            )
          }
          style={styles.secondaryBtn}
        >
          Copy These Steps
        </button>
      </section>

      {/* Status banner */}
      {status ? (
        <div
          style={{
            ...styles.status,
            background:
              statusTone === "good"
                ? THEME.goodBg
                : statusTone === "bad"
                ? THEME.badBg
                : THEME.warnBg,
            borderColor: THEME.border,
            color: THEME.navy,
          }}
          role="status"
        >
          {status}
        </div>
      ) : null}

      {/* Transfer Code Modal */}
      {restoreOpen ? (
        <div style={styles.modalBackdrop} onClick={closeRestoreModal}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalRow}>
              <div style={{ fontWeight: 950, color: THEME.navy }}>Paste Transfer Code</div>
              <button onClick={closeRestoreModal} style={styles.modalBtn}>
                Close
              </button>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: THEME.muted, lineHeight: 1.35 }}>
              Paste the code here. It should start with <b>{BACKUP_PREFIX}</b>.
            </div>

            <textarea
              value={restoreText}
              onChange={(e) => setRestoreText(e.target.value)}
              rows={8}
              placeholder={`Paste here… (starts with ${BACKUP_PREFIX})`}
              style={styles.textarea}
            />

            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <button onClick={handleTakeOverFromCode} style={styles.primaryBtn}>
                Take Over Now
              </button>
              <button onClick={closeRestoreModal} style={styles.secondaryBtn}>
                Cancel
              </button>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: THEME.muted, lineHeight: 1.35 }}>
              Note: This replaces the data stored on this device.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const styles = {
  headerWrap: {
    padding: "14px 2px 6px 2px",
  },
  headerTitle: {
    marginTop: 0,
    fontSize: 20,
    fontWeight: 1000,
    color: THEME.navy,
    letterSpacing: "-0.2px",
  },
  headerSub: {
    marginTop: 6,
    fontSize: 13,
    color: THEME.muted,
    lineHeight: 1.35,
  },

  twoCol: {
    marginTop: 14,
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    alignItems: "start",
  },

  card: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    border: `1px solid ${THEME.border}`,
    background: THEME.card,
  },

  cardTopRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },

  cardTitle: {
    fontWeight: 1000,
    color: THEME.navy,
    letterSpacing: "-0.1px",
  },
  cardHint: {
    marginTop: 4,
    fontSize: 12,
    color: THEME.muted,
  },

  smallPill: {
    fontSize: 12,
    fontWeight: 900,
    padding: "6px 10px",
    borderRadius: 999,
    border: `1px solid ${THEME.border}`,
    color: THEME.navy,
    background: THEME.bg,
    whiteSpace: "nowrap",
  },

  kpiGrid: {
    display: "grid",
    gap: 10,
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },
  kpiItem: {
    border: `1px solid ${THEME.border}`,
    borderRadius: 12,
    padding: 10,
    background: THEME.bg,
  },
  kpiLabel: {
    fontSize: 12,
    color: THEME.muted,
    fontWeight: 900,
  },
  kpiValue: {
    marginTop: 4,
    fontSize: 14,
    color: THEME.navy,
    fontWeight: 1000,
    lineHeight: 1.2,
  },
  kpiSub: {
    fontSize: 12,
    color: THEME.muted,
    fontWeight: 900,
  },

  calloutGood: {
    border: `1px solid ${THEME.border}`,
    background: THEME.goodBg,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  calloutWarn: {
    border: `1px solid ${THEME.border}`,
    background: THEME.warnBg,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  calloutBad: {
    border: `1px solid ${THEME.border}`,
    background: THEME.badBg,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  calloutTitle: {
    fontWeight: 1000,
    color: THEME.navy,
    fontSize: 13,
  },
  calloutText: {
    marginTop: 4,
    fontSize: 12,
    color: THEME.navy,
    lineHeight: 1.35,
    opacity: 0.95,
  },

  divider: {
    height: 1,
    background: THEME.border,
    margin: "12px 0",
  },

  primaryBtn: {
    width: "100%",
    padding: "12px 10px",
    borderRadius: 12,
    border: `1px solid ${THEME.navy}55`,
    background: "transparent",
    fontWeight: 950,
    cursor: "pointer",
    color: THEME.navy,
  },
  secondaryBtn: {
    width: "100%",
    padding: "12px 10px",
    borderRadius: 12,
    border: `1px solid ${THEME.border}`,
    background: "transparent",
    fontWeight: 900,
    cursor: "pointer",
    color: THEME.navy,
    marginTop: 10,
  },

  steps: {
    marginTop: 2,
    border: `1px solid ${THEME.border}`,
    borderRadius: 12,
    padding: 10,
    background: THEME.bg,
    color: THEME.navy,
    lineHeight: 1.45,
    fontSize: 13,
  },
  stepLine: {
    marginTop: 6,
  },

  status: {
    marginTop: 14,
    padding: 10,
    borderRadius: 12,
    border: `1px solid ${THEME.border}`,
    fontWeight: 900,
  },

  // Modal
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "block",
    padding: 16,
    zIndex: 999,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
  },
  modalCard: {
    width: "min(720px, 100%)",
    margin: "16px auto",
    background: THEME.card,
    borderRadius: 14,
    border: `1px solid ${THEME.border}`,
    padding: 14,
    maxHeight: "calc(100vh - 32px)",
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
  },
  modalRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  modalBtn: {
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${THEME.border}`,
    background: "transparent",
    fontWeight: 900,
    cursor: "pointer",
    color: THEME.navy,
  },
  textarea: {
    width: "100%",
    resize: "vertical",
    padding: 12,
    borderRadius: 12,
    border: `1px solid ${THEME.border}`,
    background: THEME.bg,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 13,
    lineHeight: 1.35,
    marginTop: 10,
    color: THEME.navy,
  },
};