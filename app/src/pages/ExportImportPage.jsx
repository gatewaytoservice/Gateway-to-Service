import React, { useMemo, useRef, useState } from "react";

export default function ExportImportPage({ appState, setAppState }) {
  const fileInputRef = useRef(null);
  const [status, setStatus] = useState("");

  const filename = useMemo(() => {
    const stamp = new Date().toISOString().slice(0, 10);
    return `gateway-to-service-backup-${stamp}.json`;
  }, []);

  function handleExport() {
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
      setStatus("Export complete ✅ (file downloaded)");
    } catch (e) {
      console.error(e);
      setStatus("Export failed ❌");
    }
  }

  function triggerImport() {
    setStatus("");
    fileInputRef.current?.click();
  }

  function validateImportedState(obj) {
    // Minimal validation to prevent garbage imports
    if (!obj || typeof obj !== "object") return "Invalid file format.";
    if (obj.version !== 1) return "Wrong or missing version (expected version 1).";
    if (!obj.settings || !obj.volunteers || !obj.weeks) return "Missing required fields.";
    if (!obj.settings.messages) return "Missing message templates.";
    return null; // valid
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      const err = validateImportedState(parsed);
      if (err) {
        setStatus(`Import failed ❌ ${err}`);
        return;
      }

      setAppState(parsed);
      setStatus("Import complete ✅ (this device now has the system)");

      // Reset input so you can import the same file again if needed
      e.target.value = "";
    } catch (err) {
      console.error(err);
      setStatus("Import failed ❌ (could not read JSON)");
    }
  }

  function copyToClipboard(text) {
    navigator.clipboard
      .writeText(text)
      .then(() => setStatus("Copied to clipboard ✅"))
      .catch(() => setStatus("Copy failed ❌"));
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Export / Import</h2>
      <p style={{ opacity: 0.8, marginTop: 6 }}>
        Use this to hand off Gateway to Service to another coordinator (Android/iPhone).
      </p>

      <section style={styles.card}>
        <h3 style={styles.h3}>Export</h3>
        <p style={styles.p}>
          Download a backup file you can text/email/AirDrop to the next coordinator.
        </p>
        <button onClick={handleExport} style={styles.primaryBtn}>
          Export Backup JSON
        </button>
      </section>

      <section style={styles.card}>
        <h3 style={styles.h3}>Import</h3>
        <p style={styles.p}>
          Import a backup JSON file from another coordinator to take over immediately.
        </p>

        <button onClick={triggerImport} style={styles.primaryBtn}>
          Import Backup JSON
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={handleImportFile}
        />
      </section>

      <section style={styles.card}>
        <h3 style={styles.h3}>Quick Tip</h3>
        <p style={styles.p}>
          After you export, send the file to the next coordinator. They open this page and
          tap Import.
        </p>
        <button
          onClick={() =>
            copyToClipboard(
              "Handoff tip: Export the Gateway to Service backup JSON and send it to the next coordinator. They can Import it on their phone to take over immediately."
            )
          }
          style={styles.secondaryBtn}
        >
          Copy Handoff Tip
        </button>
      </section>

      {status ? (
        <div style={styles.status} role="status">
          {status}
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
  h3: { margin: "0 0 6px 0" },
  p: { margin: "0 0 10px 0", opacity: 0.8, lineHeight: 1.35 },
  primaryBtn: {
    width: "100%",
    padding: "12px 10px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    fontWeight: 800,
  },
  secondaryBtn: {
    width: "100%",
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    fontWeight: 700,
  },
  status: {
    marginTop: 14,
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    fontWeight: 700,
  },
};
