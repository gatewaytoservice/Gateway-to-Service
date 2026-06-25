// app/src/App.jsx
import React, { useMemo, useState } from "react";
import CoordinatorPage from "./pages/CoordinatorPage.jsx";
import VolunteersPage from "./pages/VolunteersPage.jsx";
import MessagesPage from "./pages/MessagesPage.jsx";
import HandoffPage from "./pages/HandoffPage.jsx";
import ExportImportPage from "./pages/ExportImportPage.jsx";
import PastMeetingsPage from "./pages/PastMeetingsPage.jsx"; // ✅ ADD BACK
import { loadState, resetState, saveState } from "./state/storage.js";

// ✅ NEW: Dashboard
import DashboardPage from "./pages/DashboardPage.jsx";

// Version 2 of Coordinator Page
import CoordinatorPageV2 from "./pages/CoordinatorPageV2.jsx";
//Version 2 of Volunteer Page
import VolunteersPageV2 from "./pages/VolunteersPageV2.jsx";

// ✅ Friday nudge helpers
import { getUpcomingFridayISO, formatFriendlyDate } from "./utils/date.js";

// ✅ Clerk Auth (added)
import { SignedIn, SignedOut, SignIn, UserButton } from "@clerk/clerk-react";

const MISSION =
  "Gateway to Service exists to help members show up for Friday Night service at Gateway, ensuring the responsibility of coordinating the list can be easily passed on to the next service member.";

// =========================
// Gateway Calm theme tokens
// =========================
const THEME = {
  navy: "#243447", // Slate Navy
  teal: "#4A8F8B", // Muted Teal
  bg: "#FAFAFA", // Off-white
  card: "#FFFFFF",
  border: "#E2E6EA",
  muted: "#6B7280",
  shadow: "0 1px 10px rgba(36, 52, 71, 0.06)",
};

// =========================
// Finalize Nudges (Friday @ noon CT, hourly until finalized)
// =========================
const CT_TZ = "America/Chicago";

// Safely read "America/Chicago" date parts regardless of the device timezone.
function getNowPartsInTZ(timeZone = CT_TZ) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = dtf.formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;

  const weekday = get("weekday"); // "Fri"
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));

  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;

  return { weekday, year, month, day, hour, minute, iso };
}

// ✅ Access restricted screen (added)
function AccessRestricted() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#111827",
        color: "#F9FAFB",
        textAlign: "center",
      }}
    >
      <h2 style={{ marginBottom: 8 }}>Access Restricted</h2>
      <p style={{ maxWidth: 520, opacity: 0.9, lineHeight: 1.5 }}>
        This portal is for approved list coordinators only. If you are interested in
        volunteering, please contact the list coordinator.
        andrew@gatewaytosevice.com
      </p>

      <div style={{ marginTop: 18, width: "min(420px, 100%)" }}>
        {/* No sign-up; hash routing works without React Router */}
        <SignIn
          routing="hash"
          signUpUrl={null}
          appearance={{
            elements: {
              footer: "hidden",
            },
          }}
        />
      </div>
    </div>
  );
}

// ✅ NEW: Landing page / service tool hub
function LandingPage({ onSelectTool }) {
  const tools = [
    {
      key: "gateway",
      icon: "🤝",
      title: "Gateway to Service",
      description:
        "Friday night volunteer coordination, reminders, confirmations, handoff notes, and service roles.",
      buttonLabel: "Open Gateway Tool",
      active: true,
    },
    {
      key: "agents",
      icon: "⚡",
      title: "Agents of Action",
      description:
        "A future tool for organizing action-based service opportunities and volunteer support.",
      buttonLabel: "Coming Soon",
      active: false,
    },
    {
      key: "broadHighway",
      icon: "🛣️",
      title: "Broad Highway Wanderers Group",
      description:
        "A future tool for group service, communication, and volunteer coordination.",
      buttonLabel: "Coming Soon",
      active: false,
    },
  ];

  return (
    <div style={styles.landing}>
      <div style={styles.landingShell}>
        <header style={styles.landingHeader}>
          <div style={styles.landingBadge}>Volunteer Tools Hub</div>

          <h1 style={styles.landingTitle}>Gateway to Service</h1>

          <p style={styles.landingSubtitle}>
            Volunteer tools built to help groups stay organized, communicate clearly,
            and serve effectively.
          </p>
        </header>

        <div style={styles.toolGrid}>
          {tools.map((tool) => (
            <button
              key={tool.key}
              type="button"
              onClick={() => onSelectTool(tool.key)}
              style={{
                ...styles.toolCard,
                opacity: tool.active ? 1 : 0.82,
              }}
            >
              <div style={styles.toolTopRow}>
                <div style={styles.toolIcon}>{tool.icon}</div>

                {!tool.active && (
                  <div style={styles.comingSoonPill}>Coming Soon</div>
                )}
              </div>

              <h2 style={styles.toolTitle}>{tool.title}</h2>

              <p style={styles.toolDescription}>{tool.description}</p>

              <div
                style={{
                  ...styles.toolAction,
                  background: tool.active
                    ? "rgba(74, 143, 139, 0.12)"
                    : "rgba(107, 114, 128, 0.10)",
                  borderColor: tool.active
                    ? "rgba(74, 143, 139, 0.35)"
                    : "rgba(107, 114, 128, 0.25)",
                  color: tool.active ? THEME.navy : THEME.muted,
                }}
              >
                {tool.buttonLabel}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ✅ NEW: Placeholder page for future volunteer tools
function ComingSoonPage({ title, icon, onBack }) {
  return (
    <div style={styles.landing}>
      <div style={styles.placeholderShell}>
        <button type="button" onClick={onBack} style={styles.backToHubBtn}>
          ← Back to Service Hub
        </button>

        <div style={styles.placeholderCard}>
          <div style={styles.placeholderIcon}>{icon}</div>

          <h1 style={styles.placeholderTitle}>{title}</h1>

          <p style={styles.placeholderText}>
            This volunteer tool has a home now. We can build this section next when
            you are ready.
          </p>
        </div>
      </div>
    </div>
  );
}

// Tab button styling (outlined by default, teal tint when active/hover)
function tabButtonStyle({ active, hovered }) {
  const base = {
    flex: 1,
    padding: "10px 8px",
    borderRadius: 12,
    border: `1px solid rgba(36, 52, 71, 0.28)`,
    background: "transparent",
    color: THEME.navy,
    fontWeight: 800,
    cursor: "pointer",
    transition:
      "background 140ms ease, border-color 140ms ease, color 140ms ease, transform 140ms ease",
  };

  if (active) {
    return {
      ...base,
      border: `1px solid rgba(74, 143, 139, 0.55)`,
      background: "rgba(74, 143, 139, 0.12)",
      color: THEME.navy,
    };
  }

  if (hovered) {
    return {
      ...base,
      border: `1px solid rgba(74, 143, 139, 0.75)`,
      background: "rgba(74, 143, 139, 0.10)",
      transform: "translateY(-1px)",
    };
  }

  return base;
}

export default function App() {
  const tabs = useMemo(
    () => [
      // ✅ NEW: Dashboard tab
      { key: "dashboard", label: "Dashboard" },

      { key: "coordinator", label: "Coordinator" },

      // ✅ ADD: Coordinator Page V2 tab
      { key: "coordinatorV2", label: "Coordinator V2" },

      { key: "past", label: "Past" }, // ✅ ADD BACK

      { key: "volunteers", label: "Volunteers" },

      // ✅ ADD: Volunteers Page V2 tab
      { key: "volunteersV2", label: "Volunteers V2" },

      { key: "messages", label: "Messages" },
      { key: "handoff", label: "Handoff" },
      { key: "export", label: "Export" },
    ],
    []
  );

  const [activeTab, setActiveTab] = useState("coordinator");

  // ✅ NEW: controls the new landing page / volunteer tool hub
  const [activeTool, setActiveTool] = useState(null);

  const [appState, setAppState] = useState(() => loadState());

  // Hover state for nav tabs (makes theme feel alive)
  const [hoveredTab, setHoveredTab] = useState(null);
  // Mobile: hamburger menu state could go here if needed
  const [menuOpen, setMenuOpen] = useState(false);

  // Auto-save whenever state changes
  React.useEffect(() => {
    saveState(appState);
  }, [appState]);

  // =========================
  // ✅ FINALIZE NUDGES EFFECT
  // =========================
  React.useEffect(() => {
    // Nudge checks are lightweight; run every minute.
    const tick = () => {
      try {
        const fridayISO = getUpcomingFridayISO();
        const week =
          (appState?.weeks || []).find((w) => w?.date === fridayISO) || null;

        // Only nudge if the current "upcoming Friday" week exists and is NOT finalized
        if (!week || week.finalized) return;

        // We only start nudges on the actual Friday of that week, after 12pm CT
        const nowCT = getNowPartsInTZ(CT_TZ);
        if (nowCT.weekday !== "Fri") return;

        // Ensure we're talking about the same Friday date in CT
        // (prevents a device-timezone mismatch from nudging on the wrong day)
        if (nowCT.iso !== fridayISO) return;

        if (nowCT.hour < 12) return;

        // Once-per-hour key (so it won't spam within the hour)
        const hourKey = `${fridayISO}-${String(nowCT.hour).padStart(2, "0")}`;
        const storageKey = `gts:finalizeNudge:lastHourKey`;

        const lastHourKey = localStorage.getItem(storageKey);
        if (lastHourKey === hourKey) return;

        // Stamp immediately so even if user cancels, we don't re-prompt this hour
        localStorage.setItem(storageKey, hourKey);

        const ok = window.confirm(
          `Reminder: The list for ${formatFriendlyDate(
            fridayISO
          )} is not finalized.\n\nFinalize it now?`
        );

        if (ok) {
          setActiveTool("gateway");
          setActiveTab("coordinator");
          setMenuOpen(false);
        }
      } catch (e) {
        // Never break the app because of a reminder check
        console.error("Finalize nudge error:", e);
      }
    };

    tick(); // run once on mount/state change
    const id = window.setInterval(tick, 60 * 1000);

    return () => window.clearInterval(id);
  }, [appState]);

  const Page = (() => {
    switch (activeTab) {
      // ✅ NEW: Dashboard route
      case "dashboard":
        return <DashboardPage appState={appState} setAppState={setAppState} />;

      // ✅ ADD: Coodinator Page V2 route (minimal addition)
      case "coordinatorV2":
        return (
          <CoordinatorPageV2 appState={appState} setAppState={setAppState} />
        );

      // ✅ ADD: Volunteer Page V2 route
      case "volunteersV2":
        return (
          <VolunteersPageV2 appState={appState} setAppState={setAppState} />
        );

      // ✅ ADD:
      case "past":
        return (
          <PastMeetingsPage appState={appState} setAppState={setAppState} />
        ); // ✅ WIRED
      case "volunteers":
        return <VolunteersPage appState={appState} setAppState={setAppState} />;
      case "messages":
        return <MessagesPage appState={appState} setAppState={setAppState} />;
      case "handoff":
        return <HandoffPage appState={appState} />;
      case "export":
        return <ExportImportPage appState={appState} setAppState={setAppState} />;
      case "coordinator":
      default:
        return <CoordinatorPage appState={appState} setAppState={setAppState} />;
    }
  })();

  // ✅ Wrap existing app UI with Clerk gating (added; nothing removed)
  return (
    <>
      <SignedOut>
        <AccessRestricted />
      </SignedOut>

      <SignedIn>
        {!activeTool && <LandingPage onSelectTool={setActiveTool} />}

        {activeTool === "agents" && (
          <ComingSoonPage
            title="Agents of Action"
            icon="⚡"
            onBack={() => setActiveTool(null)}
          />
        )}

        {activeTool === "broadHighway" && (
          <ComingSoonPage
            title="Broad Highway Wanderers Group"
            icon="🛣️"
            onBack={() => setActiveTool(null)}
          />
        )}

        {activeTool === "gateway" && (
          <div style={styles.app}>
            <header style={styles.header}>
              {/* Banner block */}
              <div style={styles.brandRow}>
                <div style={styles.brandLeft}>
                  <div style={styles.brandTitle}>Gateway to Service</div>
                  <div style={styles.brandSubtitle}>
                    {appState.settings.mission || MISSION}
                  </div>
                </div>

                {/* ✅ Added UserButton next to your existing Reset button */}
                {/* Header actions: mobile menu + user + reset */}
                <div
                  className="gts-headerActions"
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  {/* ✅ NEW: Back to landing page */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTool(null);
                      setMenuOpen(false);
                    }}
                    style={styles.resetBtn}
                  >
                    Service Hub
                  </button>

                  {/* Mobile hamburger (CSS controls visibility) */}
                  <button
                    className="gts-menuBtn"
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    aria-expanded={menuOpen}
                    aria-label="Open menu"
                    style={styles.resetBtn}
                  >
                    ☰ Menu
                  </button>

                  {/* Clerk user menu */}
                  <UserButton />

                  {/* Dev reset button */}
                  <button
                    onClick={() => {
                      const ok = window.prompt("Type RESET to wipe app data:");
                      if (ok !== "RESET") return;
                      setAppState(resetState());
                    }}
                    style={styles.resetBtn}
                    title="Dev only"
                  >
                    Reset App (Dev)
                  </button>
                </div>
              </div>

              <div style={styles.devHint}>Dev tools won’t show in the final version.</div>
            </header>

            {/* Mobile menu panel (CSS will position + show only on phones) */}
            {menuOpen && (
              <div className="gts-menuPanel">
                {tabs.map((t) => {
                  const isActive = activeTab === t.key;
                  return (
                    <button
                      key={t.key}
                      className={`gts-menuItem ${isActive ? "isActive" : ""}`}
                      type="button"
                      onClick={() => {
                        setActiveTab(t.key);
                        setMenuOpen(false);
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            )}

            <main style={styles.main}>{Page}</main>

            <nav className="gts-nav" style={styles.nav}>
              {tabs.map((t) => {
                const isActive = activeTab === t.key;
                const isHovered = hoveredTab === t.key;

                return (
                  <button
                    key={t.key}
                    onClick={() => {
                      setActiveTab(t.key);
                      setMenuOpen(false);
                    }}
                    style={tabButtonStyle({ active: isActive, hovered: isHovered })}
                    onMouseEnter={() => setHoveredTab(t.key)}
                    onMouseLeave={() => setHoveredTab(null)}
                  >
                    {t.label}
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </SignedIn>
    </>
  );
}

const styles = {
  app: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    fontFamily: "system-ui, -apple-system, Arial",
    background: THEME.bg,
  },

  header: {
    margin: 14,
    marginBottom: 0,
    padding: 14,
    borderRadius: 16,
    border: `1px solid ${THEME.border}`,
    borderTop: `5px solid ${THEME.teal}`, // ✅ teal accent line
    background: THEME.card,
    boxShadow: THEME.shadow,
  },

  brandRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  brandLeft: { minWidth: 0 },
  brandTitle: {
    fontWeight: 950,
    fontSize: 20,
    letterSpacing: "-0.2px",
    color: THEME.navy,
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 12,
    background: "rgba(74, 143, 139, 0.10)",
    border: "1px solid rgba(74, 143, 139, 0.25)",
  },
  brandSubtitle: {
    marginTop: 8,
    fontSize: 12,
    color: THEME.muted,
    lineHeight: 1.35,
    maxWidth: 820,
  },

  resetBtn: {
    fontSize: 12,
    padding: "8px 10px",
    borderRadius: 12,
    border: `1px solid rgba(36, 52, 71, 0.28)`,
    background: "transparent",
    color: THEME.navy,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  devHint: {
    marginTop: 10,
    fontSize: 11,
    color: THEME.muted,
    opacity: 0.9,
  },

  main: {
    flex: 1,
    padding: 16,
    paddingBottom: 84,
  },

  nav: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    gap: 10,
    padding: 12,
    borderTop: `1px solid ${THEME.border}`,
    background: THEME.card,
    boxShadow: "0 -6px 18px rgba(36, 52, 71, 0.06)",
  },

  // =========================
  // ✅ NEW: Landing page styles
  // =========================
  landing: {
    minHeight: "100vh",
    padding: 24,
    background: THEME.bg,
    fontFamily: "system-ui, -apple-system, Arial",
  },

  landingShell: {
    maxWidth: 1000,
    margin: "0 auto",
  },

  landingHeader: {
    maxWidth: 760,
    margin: "0 auto 30px",
    textAlign: "center",
    paddingTop: 42,
  },

  landingBadge: {
    display: "inline-block",
    marginBottom: 14,
    padding: "7px 12px",
    borderRadius: 999,
    background: "rgba(74, 143, 139, 0.12)",
    border: "1px solid rgba(74, 143, 139, 0.28)",
    color: THEME.navy,
    fontSize: 12,
    fontWeight: 900,
  },

  landingTitle: {
    color: THEME.navy,
    fontSize: 36,
    lineHeight: 1.1,
    margin: "0 0 12px",
    letterSpacing: "-0.6px",
  },

  landingSubtitle: {
    color: THEME.muted,
    fontSize: 15,
    lineHeight: 1.55,
    margin: 0,
  },

  toolGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 18,
  },

  toolCard: {
    background: THEME.card,
    border: `1px solid ${THEME.border}`,
    borderTop: `5px solid ${THEME.teal}`,
    borderRadius: 18,
    padding: 22,
    textAlign: "left",
    cursor: "pointer",
    boxShadow: THEME.shadow,
    minHeight: 245,
    display: "flex",
    flexDirection: "column",
    transition:
      "transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease",
  },

  toolTopRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 14,
  },

  toolIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(74, 143, 139, 0.10)",
    border: "1px solid rgba(74, 143, 139, 0.22)",
    fontSize: 27,
  },

  comingSoonPill: {
    padding: "5px 8px",
    borderRadius: 999,
    background: "rgba(107, 114, 128, 0.10)",
    border: "1px solid rgba(107, 114, 128, 0.22)",
    color: THEME.muted,
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  toolTitle: {
    color: THEME.navy,
    fontSize: 20,
    lineHeight: 1.2,
    margin: "0 0 8px",
  },

  toolDescription: {
    color: THEME.muted,
    fontSize: 14,
    lineHeight: 1.45,
    margin: 0,
    flex: 1,
  },

  toolAction: {
    marginTop: 18,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(74, 143, 139, 0.35)",
    fontSize: 13,
    fontWeight: 900,
    textAlign: "center",
  },

  // =========================
  // ✅ NEW: Coming soon placeholder styles
  // =========================
  placeholderShell: {
    maxWidth: 760,
    margin: "0 auto",
    paddingTop: 32,
  },

  backToHubBtn: {
    fontSize: 13,
    padding: "9px 12px",
    borderRadius: 12,
    border: `1px solid rgba(36, 52, 71, 0.28)`,
    background: THEME.card,
    color: THEME.navy,
    fontWeight: 900,
    cursor: "pointer",
    marginBottom: 18,
    boxShadow: THEME.shadow,
  },

  placeholderCard: {
    background: THEME.card,
    border: `1px solid ${THEME.border}`,
    borderTop: `5px solid ${THEME.teal}`,
    borderRadius: 20,
    padding: 28,
    textAlign: "center",
    boxShadow: THEME.shadow,
  },

  placeholderIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
    background: "rgba(74, 143, 139, 0.10)",
    border: "1px solid rgba(74, 143, 139, 0.22)",
    fontSize: 34,
  },

  placeholderTitle: {
    color: THEME.navy,
    fontSize: 28,
    margin: "0 0 10px",
  },

  placeholderText: {
    color: THEME.muted,
    fontSize: 15,
    lineHeight: 1.5,
    margin: 0,
  },
};