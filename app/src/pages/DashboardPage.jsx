// app/src/pages/DashboardPage.jsx
// Gateway to Service — Dashboard (with visuals + trends)
//
// PURPOSE
// - At-a-glance view for the coordinator
// - Adds lightweight, dependency-free visuals (SVG + bars)
// - Shows last-N weeks trends using existing appState.weeks
//
// IMPORTANT
// - READ-ONLY: does NOT mutate appState
// - Safe against missing fields (older weeks/volunteers)
// - Uses same Gateway Calm theme tokens as other pages



/**
 * DashboardPage.jsx
 * ---------------------------------------------------------
 * This dashboard is READ-ONLY (no state mutations).
 *
 * What this file does:
 * 1) Snapshot of upcoming Friday week (if it exists).
 * 2) Trend (last 8 Fridays) ✅ now shown in a split layout:
 *    - Left: Team trend (Confirmed vs Drops)
 *    - Right: Per-volunteer trend chart (top volunteers) with hover labels
 * 3) Reminder Completion (already in the snapshot + visual)
 * 4) Reliability window (4/8/12) ✅ now uses horizontal stacked bars for Top Reliability,
 *    with hover showing counts + percentages.
 * 5) Needs Attention ✅ intentionally left EXACTLY the same list UI as before
 *    (same ordering + same pill display) to avoid changing what already works.
 *
 * Important note about "List Sent" tracking (Copy List for Chair):
 * - This dashboard only READS whatever the app stores.
 * - If your Coordinator page does not store a field like `week.chairListCopies`,
 *   `week.chairListCopiedAt`, or similar, the dashboard will show "Not tracked yet".
 * - This is Mode B: display the status if present, otherwise show a reminder message.
 */

// app/src/pages/DashboardPage.jsx
import React, { useMemo, useState } from "react";
import { getUpcomingFridayISO, formatFriendlyDate } from "../utils/date.js";

/**
 * DashboardPage.jsx
 * ------------------------------------------------------------------
 * PURPOSE
 * - Read-only dashboard for the Gateway to Service coordinator.
 * - Surfaces current week health, trends, volunteer reliability, and follow-up items.
 *
 * IMPORTANT RULES FOR THIS FILE
 * - This page should NOT change app state.
 * - It should only read appState and display computed metrics.
 * - Keep imports ONLY here at the top of the file.
 *
 * THIS UPDATE INCLUDES
 * 1) Top Performers remains a dot-plot (one dot per volunteer per week).
 * 2) Top Reliability percentage pill is truly right-aligned.
 * 3) Top Reliability hover uses the same real tooltip system as charts.
 * 4) No other functionality/UI/logic was intentionally removed.
 */

// =========================
// Theme tokens
// =========================
const THEME = {
  navy: "#243447",
  teal: "#4A8F8B",
  bg: "#FAFAFA",
  card: "#FFFFFF",
  border: "#E2E6EA",
  muted: "#6B7280",
  shadow: "0 1px 10px rgba(36, 52, 71, 0.06)",

  gold: "rgba(176,141,44,0.95)",
  red: "rgba(185,28,28,0.95)",
  gray: "rgba(107,114,128,0.85)",

  faint: "rgba(36,52,71,0.12)",
  faint2: "rgba(36,52,71,0.08)",
};

const CORE_ROLE_ORDER = [
  "Chairperson",
  "List Coordinator",
  "Meeting Steward",
  "Discussion Group Lead",
  "Big Book Lead",
];

// =========================
// Basic helpers
// =========================
function getRole(v) {
  return v?.coreRole || "Volunteer";
}

function formatPhoneUS(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith("1")) {
    return `1-${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

function pillStyle(kind = "neutral") {
  const base = {
    fontSize: 12,
    fontWeight: 900,
    padding: "6px 10px",
    borderRadius: 999,
    border: `1px solid rgba(36,52,71,0.22)`,
    background: "rgba(36,52,71,0.06)",
    color: THEME.navy,
    whiteSpace: "nowrap",
  };

  if (kind === "good") {
    return {
      ...base,
      border: "1px solid rgba(74,143,139,0.55)",
      background: "rgba(74,143,139,0.12)",
    };
  }
  if (kind === "warn") {
    return {
      ...base,
      border: "1px solid rgba(176,141,44,0.55)",
      background: "rgba(176,141,44,0.14)",
    };
  }
  if (kind === "bad") {
    return {
      ...base,
      border: "1px solid rgba(185,28,28,0.45)",
      background: "rgba(185,28,28,0.10)",
      color: "rgba(185,28,28,0.95)",
    };
  }

  return base;
}

function cardStyle({ accent } = {}) {
  return {
    border: `1px solid ${THEME.border}`,
    background: THEME.card,
    borderRadius: 14,
    padding: 12,
    boxShadow: THEME.shadow,
    ...(accent ? { borderTop: `5px solid ${accent}` } : null),
  };
}

// =========================
// Date helpers
// =========================
function isoToDate(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return null;
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
  if (!dt) return iso;
  dt.setDate(dt.getDate() + weeks * 7);
  return dateToISO(dt);
}

function shortISO(iso) {
  if (!iso || String(iso).length < 10) return "—";
  return `${iso.slice(5, 7)}/${iso.slice(8, 10)}`;
}

function fmtTime(isoDateTime) {
  if (!isoDateTime) return "—";
  const s = String(isoDateTime);
  if (s.length < 16) return s;
  return `${s.slice(0, 10)} ${s.slice(11, 16)}`;
}

// =========================
// Status/count helpers
// =========================
function countInviteStatuses(invites = []) {
  const out = {
    notInvited: 0,
    invited: 0,
    confirmed: 0,
    declined: 0,
    noResponse: 0,
  };

  for (const inv of invites) {
    if (inv.status === "Not Invited") out.notInvited++;
    else if (inv.status === "Invited") out.invited++;
    else if (inv.status === "Confirmed") out.confirmed++;
    else if (inv.status === "Declined") out.declined++;
    else if (inv.status === "No Response") out.noResponse++;
  }

  return out;
}

function remindersSentCount(invites = []) {
  const confirmed = invites.filter((i) => i.status === "Confirmed");
  const sent = confirmed.filter((i) => !!i.reminderSentAt).length;
  return { confirmedTotal: confirmed.length, remindersSent: sent };
}

/**
 * Chair list copy tracking
 * Supports a few possible week shapes so the dashboard doesn't break
 * if tracking is stored slightly differently.
 */
function readChairListStats(week) {
  if (!week) return { supported: false, copies: 0, lastAt: null, log: [] };

  const nested = week.chairList || null;
  const copiedAt = (nested && nested.copiedAt) || week.chairListCopiedAt || null;

  const copies =
    (nested && typeof nested.copies === "number" ? nested.copies : null) ??
    (typeof week.chairListCopies === "number" ? week.chairListCopies : null) ??
    null;

  const log =
    (nested && Array.isArray(nested.log) ? nested.log : null) ??
    (Array.isArray(week.chairListCopyLog) ? week.chairListCopyLog : null) ??
    [];

  const supported = !!copiedAt || copies !== null || (Array.isArray(log) && log.length > 0);

  const lastAtFromLog =
    Array.isArray(log) && log.length
      ? (log[log.length - 1]?.at || log[log.length - 1]?.copiedAt || null)
      : null;

  return {
    supported,
    copies: copies ?? (Array.isArray(log) ? log.length : 0),
    lastAt: copiedAt || lastAtFromLog || null,
    log: Array.isArray(log) ? log : [],
  };
}

// =========================
// Chart helpers
// =========================
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function arcPath(cx, cy, r, startAngle, endAngle) {
  const sx = cx + r * Math.cos(startAngle);
  const sy = cy + r * Math.sin(startAngle);
  const ex = cx + r * Math.cos(endAngle);
  const ey = cy + r * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`;
}

function Donut({ segments, size = 120, thickness = 14, centerTop, centerBottom }) {
  const total = segments.reduce((s, x) => s + (x.value || 0), 0);
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;

  let angle = -Math.PI / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Breakdown">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(36,52,71,0.10)" strokeWidth={thickness} />

      {total > 0
        ? segments.map((seg, idx) => {
            const v = seg.value || 0;
            const frac = v / total;
            const nextAngle = angle + frac * Math.PI * 2;
            if (v <= 0) return null;

            const d = arcPath(cx, cy, r, angle, nextAngle);
            angle = nextAngle;

            return <path key={idx} d={d} fill="none" stroke={seg.color} strokeWidth={thickness} strokeLinecap="butt" />;
          })
        : null}

      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontSize: 12, fontWeight: 900, fill: THEME.navy }}
      >
        {centerTop ?? total ?? 0}
      </text>
      <text
        x={cx}
        y={cy + 12}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontSize: 10, fill: THEME.muted }}
      >
        {centerBottom ?? "total"}
      </text>
    </svg>
  );
}

function MiniBar({ value, max, labelLeft, labelRight }) {
  const pct = max > 0 ? clamp(value / max, 0, 1) : 0;

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, color: THEME.muted }}>
        <span style={{ fontWeight: 900 }}>{labelLeft}</span>
        <span>{labelRight}</span>
      </div>

      <div style={{ marginTop: 8, height: 10, borderRadius: 999, background: "rgba(36,52,71,0.10)", overflow: "hidden" }}>
        <div style={{ width: `${pct * 100}%`, height: "100%", background: THEME.teal }} />
      </div>
    </div>
  );
}

// =========================
// Real tooltip
// =========================
function Tooltip({ tip }) {
  if (!tip?.open) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: tip.x + 12,
        top: tip.y + 12,
        zIndex: 9999,
        pointerEvents: "none",
        background: "rgba(36,52,71,0.96)",
        color: "white",
        borderRadius: 10,
        padding: "8px 10px",
        fontSize: 12,
        lineHeight: 1.3,
        boxShadow: "0 8px 24px rgba(0,0,0,0.22)",
        maxWidth: 280,
        whiteSpace: "pre-wrap",
      }}
    >
      <div style={{ fontWeight: 900 }}>{tip.title}</div>
      {tip.body ? <div style={{ marginTop: 4, opacity: 0.92 }}>{tip.body}</div> : null}
    </div>
  );
}

// =========================
// Team Trend
// =========================
function TeamTrendChart({ points, onHover, onLeave, height = 120 }) {
  const count = points.length;
  const pad = 18;
  const h = height;
  const w = Math.max(360, count * 48);

  const ys = [];
  for (const p of points) {
    ys.push(p.confirmed || 0);
    ys.push(p.drops || 0);
  }
  const yMax = Math.max(1, ...ys);

  const xStep = count > 1 ? (w - pad * 2) / (count - 1) : 0;
  const toX = (i) => pad + i * xStep;
  const toY = (v) => pad + (h - pad * 2) * (1 - v / yMax);

  const pathFor = (key) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(p[key] || 0)}`).join(" ");

  const confirmedPath = pathFor("confirmed");
  const dropsPath = pathFor("drops");

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Team trend">
        <line x1={pad} y1={toY(yMax)} x2={w - pad} y2={toY(yMax)} stroke="rgba(36,52,71,0.10)" />
        <line x1={pad} y1={toY(Math.ceil(yMax / 2))} x2={w - pad} y2={toY(Math.ceil(yMax / 2))} stroke="rgba(36,52,71,0.08)" />
        <line x1={pad} y1={toY(0)} x2={w - pad} y2={toY(0)} stroke="rgba(36,52,71,0.10)" />

        <path d={confirmedPath} fill="none" stroke={THEME.teal} strokeWidth="2.75" />
        <path d={dropsPath} fill="none" stroke={THEME.red} strokeWidth="2.75" />

        {points.map((p, i) => {
          const x = toX(i);
          const yC = toY(p.confirmed || 0);
          const yD = toY(p.drops || 0);

          return (
            <g key={p.iso || i}>
              {p.finalized ? <circle cx={x} cy={yC - 10} r="2" fill="rgba(36,52,71,0.85)" /> : null}

              <circle
                cx={x}
                cy={yC}
                r="4"
                fill={THEME.teal}
                onMouseEnter={(e) =>
                  onHover?.(e, {
                    title: `Confirmed • ${p.label}`,
                    body: `Count: ${p.confirmed}\nPercent: ${Math.round((p.confirmedPct || 0) * 100)}%`,
                  })
                }
                onMouseMove={(e) => onHover?.(e, null, true)}
                onMouseLeave={onLeave}
              />

              <circle
                cx={x}
                cy={yD}
                r="4"
                fill={THEME.red}
                onMouseEnter={(e) =>
                  onHover?.(e, {
                    title: `Drops • ${p.label}`,
                    body: `Count: ${p.drops}\nPercent: ${Math.round((p.dropsPct || 0) * 100)}%`,
                  })
                }
                onMouseMove={(e) => onHover?.(e, null, true)}
                onMouseLeave={onLeave}
              />

              <text x={x} y={h - 4} textAnchor="middle" style={{ fontSize: 10, fill: THEME.muted }}>
                {p.xLabel}
              </text>
            </g>
          );
        })}

        <text x={w - pad} y={toY(yMax) - 6} textAnchor="end" style={{ fontSize: 10, fill: THEME.muted }}>
          {yMax}
        </text>
      </svg>
    </div>
  );
}

// =========================
// Top Performers Dot Plot
// =========================
function TopPerformersDotPlot({ rows, xLabels, onHover, onLeave, height = 230 }) {
  const rowCount = rows.length;
  const colCount = xLabels.length;

  const padL = 140;
  const padR = 16;
  const padT = 16;
  const padB = 26;

  const cellW = 34;
  const w = Math.max(520, padL + padR + colCount * cellW);
  const h = height;

  const gridW = w - padL - padR;
  const gridH = h - padT - padB;

  const rowH = rowCount > 0 ? gridH / rowCount : 1;
  const colW = colCount > 0 ? gridW / colCount : 1;

  const cx = (c) => padL + c * colW + colW / 2;
  const cy = (r) => padT + r * rowH + rowH / 2;

  function dotFor(status) {
    if (status === "Confirmed") return { fill: THEME.teal, stroke: "transparent" };
    if (status === "Declined") return { fill: THEME.red, stroke: "transparent" };
    if (status === "No Response") return { fill: THEME.gray, stroke: "transparent" };
    if (status === "Invited") return { fill: THEME.gold, stroke: "transparent" };
    if (status === "Not Invited") return { fill: "white", stroke: "rgba(36,52,71,0.65)" };
    return { fill: "white", stroke: THEME.faint };
  }

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Top performers dot plot">
        {Array.from({ length: colCount }).map((_, c) => (
          <line
            key={`v-${c}`}
            x1={padL + c * colW}
            y1={padT}
            x2={padL + c * colW}
            y2={h - padB}
            stroke={c % 2 === 0 ? "rgba(36,52,71,0.06)" : "rgba(36,52,71,0.03)"}
          />
        ))}

        {Array.from({ length: rowCount + 1 }).map((_, r) => (
          <line
            key={`h-${r}`}
            x1={padL}
            y1={padT + r * rowH}
            x2={w - padR}
            y2={padT + r * rowH}
            stroke="rgba(36,52,71,0.08)"
          />
        ))}

        {rows.map((row, r) => (
          <text
            key={`name-${row.key}`}
            x={padL - 10}
            y={cy(r) + 4}
            textAnchor="end"
            style={{ fontSize: 12, fill: THEME.navy, fontWeight: 900 }}
          >
            {row.label}
          </text>
        ))}

        {rows.map((row, r) =>
          row.points.map((p, c) => {
            const { fill, stroke } = dotFor(p.status);
            const x = cx(c);
            const y = cy(r);

            return (
              <circle
                key={`${row.key}-${c}`}
                cx={x}
                cy={y}
                r="5"
                fill={fill}
                stroke={stroke}
                strokeWidth="2"
                onMouseEnter={(e) =>
                  onHover?.(e, {
                    title: `${row.label} • ${p.label}`,
                    body: `Status: ${p.status}`,
                  })
                }
                onMouseMove={(e) => onHover?.(e, null, true)}
                onMouseLeave={onLeave}
              />
            );
          })
        )}

        {xLabels.map((lab, c) => (
          <text key={`x-${c}`} x={cx(c)} y={h - 8} textAnchor="middle" style={{ fontSize: 10, fill: THEME.muted }}>
            {lab}
          </text>
        ))}
      </svg>
    </div>
  );
}

function sectionTitleRow(title, rightNode) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
      <div style={{ fontWeight: 950, color: THEME.navy }}>{title}</div>
      {rightNode}
    </div>
  );
}

function smallIconButtonStyle({ active }) {
  return {
    padding: "7px 10px",
    borderRadius: 999,
    border: active ? "1px solid rgba(74,143,139,0.55)" : "1px solid rgba(36,52,71,0.22)",
    background: active ? "rgba(74,143,139,0.12)" : "rgba(36,52,71,0.06)",
    color: THEME.navy,
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

// =========================
// Top Reliability row
// NOTE:
// - This is the area you pointed out in your screenshot.
// - The pill is forced hard-right with grid columns.
// - The real tooltip is attached to the WHOLE row,
//   so hovering anywhere meaningful works reliably.
// =========================
function StackedBarRow({
  label,
  sublabel,
  confirmed,
  declined,
  noResponse,
  totalDecisions,
  onHover,
  onLeave,
}) {
  const total = Math.max(0, totalDecisions || confirmed + declined + noResponse);
  const cPct = total > 0 ? confirmed / total : 0;
  const dPct = total > 0 ? declined / total : 0;
  const nPct = total > 0 ? noResponse / total : 0;

  const pctText = `${Math.round(cPct * 100)}%`;

  const tooltipBody =
    `Confirmed: ${confirmed} (${Math.round(cPct * 100)}%)\n` +
    `Declined: ${declined} (${Math.round(dPct * 100)}%)\n` +
    `No Response: ${noResponse} (${Math.round(nPct * 100)}%)\n` +
    `Decisions: ${total}`;

  return (
    <div
      style={{ ...subRow, flexDirection: "column", gap: 10 }}
      onMouseEnter={(e) =>
        onHover?.(e, {
          title: `${label} • Reliability`,
          body: tooltipBody,
        })
      }
      onMouseMove={(e) => onHover?.(e, null, true)}
      onMouseLeave={onLeave}
    >
      {/* hard two-column layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) auto",
          alignItems: "start",
          gap: 12,
          width: "100%",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 900, color: THEME.navy }}>{label}</div>
          <div style={{ fontSize: 12, color: THEME.muted, marginTop: 2 }}>{sublabel}</div>
        </div>

        <div style={{ justifySelf: "end" }}>
          <span style={pillStyle(cPct >= 0.8 ? "good" : cPct >= 0.5 ? "warn" : "neutral")}>{pctText}</span>
        </div>
      </div>

      <div
        style={{
          height: 12,
          width: "100%",
          borderRadius: 999,
          overflow: "hidden",
          background: "rgba(36,52,71,0.08)",
          border: "1px solid rgba(36,52,71,0.10)",
          display: "flex",
        }}
      >
        <div style={{ width: `${cPct * 100}%`, background: THEME.teal }} />
        <div style={{ width: `${dPct * 100}%`, background: THEME.red }} />
        <div style={{ width: `${nPct * 100}%`, background: THEME.gray }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, color: THEME.muted }}>
        <span>Confirmed {confirmed}</span>
        <span>Declined {declined}</span>
        <span>No Resp {noResponse}</span>
      </div>
    </div>
  );
}

// =========================
// Consider Pausing helper
// =========================
function computeConsecutiveDrops(weeksByDate, weekDates, volunteerId) {
  let streak = 0;

  for (const iso of weekDates) {
    const w = weeksByDate.get(iso);
    const inv = (w?.invites || []).find((x) => x.volunteerId === volunteerId) || null;
    if (!inv) continue;

    if (inv.status === "Declined" || inv.status === "No Response") streak += 1;
    else if (inv.status === "Confirmed") streak = 0;
  }

  return streak;
}

// =========================
// SMS helpers
// =========================
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

function fillTemplate(template, volunteerName) {
  return (template || "").replaceAll("[Name]", volunteerName || "");
}

// =========================
// Main page
// =========================
export default function DashboardPage({ appState }) {
  const fridayISO = getUpcomingFridayISO();
  const week = (appState?.weeks || []).find((w) => w?.date === fridayISO) || null;

  const volunteers = appState?.volunteers || [];
  const settings = appState?.settings || {};
  const minConfirmed = settings.minConfirmed ?? 9;
  const maxVolunteers = settings.maxVolunteers ?? 14;
  const preferredConfirmed = settings.preferredConfirmed ?? 12;

  const [trendRange, setTrendRange] = useState("all"); // "all" | "90d" | "8w"
  const [windowWeeks, setWindowWeeks] = useState(8);

  // Tooltip state
  const [tip, setTip] = useState({ open: false, x: 0, y: 0, title: "", body: "" });

  function handleHover(e, payload, moveOnly = false) {
    const x = e?.clientX ?? 0;
    const y = e?.clientY ?? 0;

    if (moveOnly) {
      setTip((prev) => (prev.open ? { ...prev, x, y } : prev));
      return;
    }

    if (!payload) return;
    setTip({ open: true, x, y, title: payload.title, body: payload.body || "" });
  }

  function handleLeave() {
    setTip((prev) => ({ ...prev, open: false }));
  }

  const volunteersById = useMemo(() => {
    const m = new Map();
    for (const v of volunteers) m.set(v.id, v);
    return m;
  }, [volunteers]);

  const volunteersByRole = useMemo(() => {
    const m = new Map();
    for (const v of volunteers) {
      if (!v?.coreRole) continue;
      m.set(v.coreRole, v);
    }
    return m;
  }, [volunteers]);

  const invites = week?.invites || [];

  const inviteByVolunteerId = useMemo(() => {
    const m = new Map();
    for (const inv of invites) m.set(inv.volunteerId, inv);
    return m;
  }, [invites]);

  const counts = useMemo(() => countInviteStatuses(invites), [invites]);
  const reminderStats = useMemo(() => remindersSentCount(invites), [invites]);

  const stillNeeded = Math.max(0, minConfirmed - counts.confirmed);

  const headline = useMemo(() => {
    if (!week) return { text: "No list created yet", kind: "warn" };
    if (week.finalized) return { text: "List Finalized ✅", kind: "good" };
    if (counts.confirmed >= minConfirmed) return { text: "Minimum met — ready to finalize", kind: "good" };
    return { text: `Need ${stillNeeded} more confirmed`, kind: "warn" };
  }, [week, counts.confirmed, minConfirmed, stillNeeded]);

  const coverage = useMemo(() => {
    return CORE_ROLE_ORDER.map((role) => {
      const v = volunteersByRole.get(role) || null;
      const inv = v ? inviteByVolunteerId.get(v.id) || null : null;

      return {
        role,
        person: v,
        status: inv?.status || (v ? "Not on list" : "Unassigned"),
        paused: v ? !v.active : false,
      };
    });
  }, [volunteersByRole, inviteByVolunteerId]);

  const coverageHealth = useMemo(() => {
    if (!week) return "none";
    let anyBad = false;
    let anyWarn = false;

    for (const row of coverage) {
      if (!row.person) {
        anyBad = true;
        continue;
      }
      if (row.paused) {
        anyBad = true;
        continue;
      }
      if (row.status === "Declined" || row.status === "No Response") {
        anyBad = true;
        continue;
      }
      if (row.status === "Not on list" || row.status === "Not Invited" || row.status === "Invited") {
        anyWarn = true;
      }
    }

    if (anyBad) return "bad";
    if (anyWarn) return "warn";
    return "good";
  }, [week, coverage]);

  const donutSegments = useMemo(() => {
    return [
      { label: "Confirmed", value: counts.confirmed, color: THEME.teal },
      { label: "Invited", value: counts.invited, color: THEME.gold },
      { label: "Not Invited", value: counts.notInvited, color: "rgba(36,52,71,0.55)" },
      { label: "Declined", value: counts.declined, color: THEME.red },
      { label: "No Response", value: counts.noResponse, color: THEME.gray },
    ];
  }, [counts]);

  const weeksByDate = useMemo(() => {
    const m = new Map();
    for (const w of appState?.weeks || []) {
      if (w?.date) m.set(w.date, w);
    }
    return m;
  }, [appState?.weeks]);

  const trendPoints = useMemo(() => {
    const weekByDate = weeksByDate;
    let dates = [];

    if (trendRange === "8w") {
      for (let i = 7; i >= 0; i--) dates.push(addWeeksISO(fridayISO, -i));
    } else if (trendRange === "90d") {
      const now = new Date();
      const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const cutoffISO = dateToISO(cutoff);

      dates = Array.from(weekByDate.keys())
        .filter((iso) => iso >= cutoffISO)
        .sort((a, b) => a.localeCompare(b));

      if (!dates.includes(fridayISO)) dates.push(fridayISO);
    } else {
      dates = Array.from(weekByDate.keys()).sort((a, b) => a.localeCompare(b));
      if (!dates.includes(fridayISO)) dates.push(fridayISO);
    }

    return dates.map((iso) => {
      const w = weekByDate.get(iso) || null;
      const c = countInviteStatuses(w?.invites || []);
      const totalInvites = (w?.invites || []).length || 0;

      const confirmed = c.confirmed;
      const drops = c.declined + c.noResponse;

      return {
        iso,
        label: formatFriendlyDate(iso),
        xLabel: shortISO(iso),
        confirmed,
        drops,
        confirmedPct: totalInvites > 0 ? confirmed / totalInvites : 0,
        dropsPct: totalInvites > 0 ? drops / totalInvites : 0,
        finalized: !!w?.finalized,
      };
    });
  }, [weeksByDate, fridayISO, trendRange]);

  const windowWeekDates = useMemo(() => {
    const out = [];
    for (let i = windowWeeks - 1; i >= 0; i--) out.push(addWeeksISO(fridayISO, -i));
    return out;
  }, [windowWeeks, fridayISO]);

  const volunteerWindowStats = useMemo(() => {
    const statsById = new Map();

    for (const iso of windowWeekDates) {
      const w = weeksByDate.get(iso);
      const invs = w?.invites || [];
      for (const inv of invs) {
        const vid = inv.volunteerId;
        if (!vid) continue;

        const cur =
          statsById.get(vid) || {
            volunteerId: vid,
            weeksOnList: 0,
            confirmed: 0,
            declined: 0,
            noResponse: 0,
            invited: 0,
            notInvited: 0,
          };

        cur.weeksOnList += 1;

        if (inv.status === "Confirmed") cur.confirmed += 1;
        else if (inv.status === "Declined") cur.declined += 1;
        else if (inv.status === "No Response") cur.noResponse += 1;
        else if (inv.status === "Invited") cur.invited += 1;
        else if (inv.status === "Not Invited") cur.notInvited += 1;

        statsById.set(vid, cur);
      }
    }

    const list = Array.from(statsById.values()).map((s) => {
      const totalDecisions = s.confirmed + s.declined + s.noResponse;
      const confirmRate = totalDecisions > 0 ? s.confirmed / totalDecisions : 0;
      const dropRate = totalDecisions > 0 ? (s.declined + s.noResponse) / totalDecisions : 0;
      const noRespRate = totalDecisions > 0 ? s.noResponse / totalDecisions : 0;

      const v = volunteersById.get(s.volunteerId);

      return {
        ...s,
        name: v?.name || "Unknown",
        phone: v?.phone || "",
        role: getRole(v),
        active: v?.active ?? true,
        confirmRate,
        dropRate,
        noRespRate,
        totalDecisions,
      };
    });

    list.sort((a, b) => (b.confirmed - a.confirmed) || (a.name || "").localeCompare(b.name || ""));
    return list;
  }, [windowWeekDates, weeksByDate, volunteersById]);

  const windowTotals = useMemo(() => {
    let confirmed = 0;
    let declined = 0;
    let noResponse = 0;

    for (const iso of windowWeekDates) {
      const w = weeksByDate.get(iso);
      const c = countInviteStatuses(w?.invites || []);
      confirmed += c.confirmed;
      declined += c.declined;
      noResponse += c.noResponse;
    }

    const totalDecisions = confirmed + declined + noResponse;

    return {
      confirmed,
      declined,
      noResponse,
      totalDecisions,
      confirmRate: totalDecisions > 0 ? confirmed / totalDecisions : 0,
      dropRate: totalDecisions > 0 ? (declined + noResponse) / totalDecisions : 0,
      noRespRate: totalDecisions > 0 ? noResponse / totalDecisions : 0,
    };
  }, [windowWeekDates, weeksByDate]);

  const topReliable = useMemo(() => {
    const filtered = volunteerWindowStats.filter((s) => s.weeksOnList >= 2);
    return [...filtered]
      .sort((a, b) => (b.confirmRate - a.confirmRate) || (b.confirmed - a.confirmed))
      .slice(0, 5);
  }, [volunteerWindowStats]);

  const needsAttention = useMemo(() => {
    const filtered = volunteerWindowStats.filter((s) => s.weeksOnList >= 2);
    return [...filtered]
      .sort((a, b) => (b.noResponse - a.noResponse) || (b.dropRate - a.dropRate))
      .slice(0, 6);
  }, [volunteerWindowStats]);

  const considerPausing = useMemo(() => {
    return volunteerWindowStats
      .filter((s) => s.weeksOnList >= 3)
      .map((s) => ({ ...s, dropStreak: computeConsecutiveDrops(weeksByDate, windowWeekDates, s.volunteerId) }))
      .filter((s) => s.dropStreak >= 3)
      .sort((a, b) => (b.dropStreak - a.dropStreak) || (b.noResponse - a.noResponse))
      .slice(0, 6);
  }, [volunteerWindowStats, weeksByDate, windowWeekDates]);

  const topPerformersDotData = useMemo(() => {
    const dates = trendPoints.map((p) => p.iso);

    const totals = new Map();
    for (const iso of dates) {
      const w = weeksByDate.get(iso);
      const invs = w?.invites || [];
      for (const inv of invs) {
        if (!inv?.volunteerId) continue;
        if (inv.status !== "Confirmed") continue;
        totals.set(inv.volunteerId, (totals.get(inv.volunteerId) || 0) + 1);
      }
    }

    const topIds = Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([vid]) => vid);

    const rows = topIds.map((vid) => {
      const v = volunteersById.get(vid);
      const label = v?.name || "Unknown";

      const points = dates.map((iso) => {
        const w = weeksByDate.get(iso);
        const inv = (w?.invites || []).find((x) => x.volunteerId === vid) || null;
        const status = inv?.status || "Not on list";

        return {
          iso,
          label: shortISO(iso),
          status,
        };
      });

      return { key: vid, label, points };
    });

    return {
      xLabels: dates.map(shortISO),
      rows,
    };
  }, [trendPoints, weeksByDate, volunteersById]);

  const reminderPct = useMemo(() => {
    const total = reminderStats.confirmedTotal || 0;
    const sent = reminderStats.remindersSent || 0;
    return total > 0 ? sent / total : 0;
  }, [reminderStats]);

  const firstStepLead = week?.firstStepLead || null;
  const firstStepLeadLabel = useMemo(() => {
    if (!week?.finalized) return { text: "Available after finalize", kind: "neutral" };
    if (!firstStepLead || !firstStepLead.status) return { text: "Not started", kind: "warn" };

    if (firstStepLead.status === "confirmed") {
      const v = volunteersById.get(firstStepLead.volunteerId);
      return { text: `Confirmed: ${v?.name || "Unknown"}`, kind: "good" };
    }
    if (firstStepLead.status === "waiting") {
      const v = volunteersById.get(firstStepLead.volunteerId);
      return { text: `Waiting: ${v?.name || "Unknown"}`, kind: "warn" };
    }
    return { text: "Not assigned", kind: "warn" };
  }, [week?.finalized, firstStepLead, volunteersById]);

  const chairListStats = useMemo(() => readChairListStats(week), [week]);
  const chairListPct = useMemo(() => {
    if (!week) return 0;
    return chairListStats?.lastAt ? 1 : 0;
  }, [week, chairListStats]);

  const checkInTemplate =
    appState?.settings?.messages?.checkIn ||
    `Good afternoon [Name],\n\nJust checking in — I’ve noticed a few weeks recently where you couldn’t make it (or I didn’t hear back). No worries at all.\n\nWhat invite cadence would you prefer going forward (weekly, biweekly, monthly), or would you like me to pause you until you’re ready?\n\nThank you for your service 🙏🏾`;

  return (
    <div style={{ background: THEME.bg, minHeight: "100vh" }}>
      <Tooltip tip={tip} />

      <h2 style={{ marginTop: 0, color: THEME.navy }}>Dashboard</h2>

      {/* Top summary */}
      <section style={cardStyle({ accent: THEME.teal })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 950, color: THEME.navy, fontSize: 16 }}>
              Upcoming Friday: {formatFriendlyDate(fridayISO)}
            </div>
            <div style={{ marginTop: 6, color: THEME.muted, fontSize: 12, lineHeight: 1.35 }}>
              Quick health check for confirmations, coverage, reminders, and trends.
            </div>
          </div>

          <span style={pillStyle(headline.kind)}>{headline.text}</span>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <div style={miniStat}>
            <div style={miniLabel}>Confirmed</div>
            <div style={miniValue}>{counts.confirmed}</div>
            <div style={miniHint}>
              Goal: {minConfirmed}–{maxVolunteers} (preferred {preferredConfirmed})
            </div>
          </div>

          <div style={miniStat}>
            <div style={miniLabel}>Waiting</div>
            <div style={miniValue}>{counts.invited}</div>
            <div style={miniHint}>Invited, awaiting response</div>
          </div>

          <div style={miniStat}>
            <div style={miniLabel}>To Invite</div>
            <div style={miniValue}>{counts.notInvited}</div>
            <div style={miniHint}>On list but not invited</div>
          </div>

          <div style={miniStat}>
            <div style={miniLabel}>Drops</div>
            <div style={miniValue}>{counts.declined + counts.noResponse}</div>
            <div style={miniHint}>
              Declined: {counts.declined} • No Response: {counts.noResponse}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14, display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          <div style={{ ...miniStat, display: "flex", gap: 14, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 950, color: THEME.navy }}>Status Breakdown</div>
              <div style={{ fontSize: 12, color: THEME.muted, marginTop: 4, lineHeight: 1.35 }}>
                A quick look at how the week is shaping up.
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                {donutSegments.map((s) => (
                  <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: THEME.muted }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 3,
                        background: s.color,
                        display: "inline-block",
                      }}
                    />
                    <span style={{ minWidth: 92 }}>{s.label}</span>
                    <span style={{ fontWeight: 900, color: THEME.navy }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <Donut segments={donutSegments} />
          </div>

          <div style={miniStat}>
            <div style={{ fontWeight: 950, color: THEME.navy }}>Confirmed Progress</div>
            <div style={{ fontSize: 12, color: THEME.muted, marginTop: 4, lineHeight: 1.35 }}>
              Confirmed compared to your minimum and max.
            </div>

            <MiniBar value={counts.confirmed} max={maxVolunteers} labelLeft="Confirmed" labelRight={`${counts.confirmed} / ${maxVolunteers}`} />
            <MiniBar
              value={counts.confirmed}
              max={minConfirmed}
              labelLeft="Minimum"
              labelRight={counts.confirmed >= minConfirmed ? "Met ✅" : `Need ${stillNeeded}`}
            />
          </div>

          <div style={miniStat}>
            <div style={{ fontWeight: 950, color: THEME.navy }}>Reminder Completion</div>
            <div style={{ fontSize: 12, color: THEME.muted, marginTop: 4, lineHeight: 1.35 }}>
              Of confirmed volunteers, how many have received the Friday reminder.
            </div>

            <MiniBar
              value={reminderStats.remindersSent}
              max={Math.max(1, reminderStats.confirmedTotal)}
              labelLeft="Reminders"
              labelRight={`${reminderStats.remindersSent} / ${reminderStats.confirmedTotal}`}
            />

            <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
              <span style={pillStyle(reminderPct >= 1 ? "good" : reminderPct >= 0.5 ? "warn" : "neutral")}>
                {Math.round(reminderPct * 100)}% complete
              </span>
              <div style={{ fontSize: 12, color: THEME.muted }}>{week?.finalized ? "Finalized week" : "Visible after finalize"}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Trend */}
      <section style={{ ...cardStyle(), marginTop: 14 }}>
        {sectionTitleRow(
          "Trend",
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select
              value={trendRange}
              onChange={(e) => setTrendRange(e.target.value)}
              style={{
                padding: "8px 10px",
                borderRadius: 999,
                border: "1px solid rgba(36,52,71,0.22)",
                background: "rgba(36,52,71,0.06)",
                fontWeight: 900,
                color: THEME.navy,
              }}
              title="Trend range"
            >
              <option value="all">All Time</option>
              <option value="90d">Last 90 Days</option>
              <option value="8w">Last 8 Weeks</option>
            </select>

            <span style={pillStyle("neutral")}>● Confirmed</span>
            <span style={{ ...pillStyle("neutral"), borderColor: "rgba(185,28,28,0.35)", background: "rgba(185,28,28,0.06)" }}>
              ● Drops
            </span>
            <span style={pillStyle("neutral")}>• Finalized marker</span>
          </div>
        )}

        <div
          style={{
            marginTop: 12,
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            alignItems: "start",
          }}
        >
          <div style={miniStat}>
            <div style={{ fontWeight: 950, color: THEME.navy }}>Team Trend (Confirmed vs Drops)</div>
            <div style={{ fontSize: 12, color: THEME.muted, marginTop: 4, lineHeight: 1.35 }}>
              Dots are hoverable. Tooltip shows count + percent for that week.
            </div>

            <div style={{ marginTop: 10 }}>
              <TeamTrendChart points={trendPoints} onHover={handleHover} onLeave={handleLeave} height={130} />
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: THEME.muted, lineHeight: 1.35 }}>
              Tip: the small dot above a Confirmed point means that week was finalized.
            </div>
          </div>

          <div style={miniStat}>
            <div style={{ fontWeight: 950, color: THEME.navy }}>Top Performers (Dot Plot)</div>
            <div style={{ fontSize: 12, color: THEME.muted, marginTop: 4, lineHeight: 1.35 }}>
              One dot per volunteer per week. Dot color = status for that week.
            </div>

            {topPerformersDotData.rows.length === 0 ? (
              <div style={{ marginTop: 10, fontSize: 12, color: THEME.muted }}>Not enough history yet.</div>
            ) : (
              <>
                <div style={{ marginTop: 10 }}>
                  <TopPerformersDotPlot
                    rows={topPerformersDotData.rows}
                    xLabels={topPerformersDotData.xLabels}
                    onHover={handleHover}
                    onLeave={handleLeave}
                    height={230}
                  />
                </div>

                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 10, fontSize: 12, color: THEME.muted }}>
                  <span><span style={{ display: "inline-block", width: 10, height: 10, background: THEME.teal, borderRadius: 3, marginRight: 6 }} />Confirmed</span>
                  <span><span style={{ display: "inline-block", width: 10, height: 10, background: THEME.red, borderRadius: 3, marginRight: 6 }} />Declined</span>
                  <span><span style={{ display: "inline-block", width: 10, height: 10, background: THEME.gray, borderRadius: 3, marginRight: 6 }} />No Response</span>
                  <span><span style={{ display: "inline-block", width: 10, height: 10, background: THEME.gold, borderRadius: 3, marginRight: 6 }} />Invited</span>
                  <span><span style={{ display: "inline-block", width: 10, height: 10, background: "white", border: "2px solid rgba(36,52,71,0.65)", borderRadius: 3, marginRight: 6 }} />Not Invited</span>
                  <span><span style={{ display: "inline-block", width: 10, height: 10, background: "white", border: `2px solid ${THEME.faint}`, borderRadius: 3, marginRight: 6 }} />Not on list</span>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Coverage */}
      <section style={{ ...cardStyle(), marginTop: 14 }}>
        {sectionTitleRow(
          "Required Role Coverage",
          <span style={pillStyle(coverageHealth === "good" ? "good" : coverageHealth === "bad" ? "bad" : "warn")}>
            {coverageHealth === "good" ? "Healthy" : coverageHealth === "bad" ? "Needs Attention" : "In Progress"}
          </span>
        )}

        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          {coverage.map((row) => {
            const v = row.person;
            const status = row.status;

            const statusKind =
              status === "Confirmed"
                ? "good"
                : status === "Declined" || status === "No Response" || status === "Unassigned" || row.paused
                ? "bad"
                : "warn";

            return (
              <div key={row.role} style={rowLine}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, color: THEME.navy }}>{row.role}</div>
                  <div style={{ fontSize: 12, color: THEME.muted, marginTop: 2 }}>
                    {v ? `${v.name} • ${formatPhoneUS(v.phone) || v.phone} • ${getRole(v)}` : "No one assigned"}
                    {v && !v.active ? " • (Paused)" : ""}
                  </div>
                </div>

                <span style={pillStyle(statusKind)}>{status}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Reliability */}
      <section style={{ ...cardStyle(), marginTop: 14 }}>
        {sectionTitleRow(
          "Volunteer Reliability (Trend Window)",
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[4, 8, 12].map((n) => (
              <button key={n} type="button" style={smallIconButtonStyle({ active: windowWeeks === n })} onClick={() => setWindowWeeks(n)}>
                Last {n}
              </button>
            ))}
          </div>
        )}

        <div style={{ marginTop: 10, fontSize: 12, color: THEME.muted, lineHeight: 1.35 }}>
          This section looks across the last {windowWeeks} Fridays and summarizes outcomes <b>only when a volunteer was on a week list</b>.
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div style={miniStat}>
            <div style={miniLabel}>Confirm Rate</div>
            <div style={miniValue}>{Math.round(windowTotals.confirmRate * 100)}%</div>
            <div style={miniHint}>
              Confirmed {windowTotals.confirmed} / Decisions {windowTotals.totalDecisions}
            </div>
          </div>

          <div style={miniStat}>
            <div style={miniLabel}>Drop Rate</div>
            <div style={miniValue}>{Math.round(windowTotals.dropRate * 100)}%</div>
            <div style={miniHint}>
              Declined {windowTotals.declined} • No Response {windowTotals.noResponse}
            </div>
          </div>

          <div style={miniStat}>
            <div style={miniLabel}>No Response Rate</div>
            <div style={miniValue}>{Math.round(windowTotals.noRespRate * 100)}%</div>
            <div style={miniHint}>
              No Response {windowTotals.noResponse} / Decisions {windowTotals.totalDecisions}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14, display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {/* Top Reliability */}
          <div style={miniStat}>
            <div style={{ fontWeight: 950, color: THEME.navy }}>Top Reliability</div>
            <div style={{ fontSize: 12, color: THEME.muted, marginTop: 4 }}>
              Highest confirm-rate (min 2 appearances in window). Hover rows for counts + percentages.
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {topReliable.length === 0 ? (
                <div style={{ fontSize: 12, color: THEME.muted }}>Not enough history yet.</div>
              ) : (
                topReliable.map((s) => (
                  <StackedBarRow
                    key={s.volunteerId}
                    label={s.name}
                    sublabel={`${formatPhoneUS(s.phone) || s.phone} • ${s.role} • On-list: ${s.weeksOnList}`}
                    confirmed={s.confirmed}
                    declined={s.declined}
                    noResponse={s.noResponse}
                    totalDecisions={s.totalDecisions}
                    onHover={handleHover}
                    onLeave={handleLeave}
                  />
                ))
              )}
            </div>
          </div>

          {/* Needs Attention */}
          <div style={miniStat}>
            <div style={{ fontWeight: 950, color: THEME.navy }}>Needs Attention</div>
            <div style={{ fontSize: 12, color: THEME.muted, marginTop: 4 }}>
              Most no-responses (min 2 appearances in window).
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {needsAttention.length === 0 ? (
                <div style={{ fontSize: 12, color: THEME.muted }}>Not enough history yet.</div>
              ) : (
                needsAttention.map((s) => (
                  <div key={s.volunteerId} style={subRow}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, color: THEME.navy }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: THEME.muted, marginTop: 2 }}>
                        {formatPhoneUS(s.phone) || s.phone} • {s.role} • On-list: {s.weeksOnList}
                      </div>
                    </div>

                    <span style={pillStyle(s.noResponse > 0 ? "bad" : "neutral")}>NR: {s.noResponse}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Consider Pausing */}
        <div style={{ marginTop: 14 }}>
          <div style={{ ...miniStat }}>
            <div style={{ fontWeight: 950, color: THEME.navy }}>Consider Pausing / Check-In</div>
            <div style={{ fontSize: 12, color: THEME.muted, marginTop: 4, lineHeight: 1.35 }}>
              Volunteers with <b>3+ drops in a row</b> (Declined/No Response) across the selected window.
              Dashboard alert only (no automatic changes).
            </div>

            {considerPausing.length === 0 ? (
              <div style={{ marginTop: 10, fontSize: 12, color: THEME.muted }}>No one flagged in this window.</div>
            ) : (
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {considerPausing.map((s) => {
                  const smsBody = fillTemplate(checkInTemplate, s.name);
                  const smsHref = buildSmsLink(s.phone, smsBody);

                  return (
                    <div key={s.volunteerId} style={rowLine}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 900, color: THEME.navy }}>{s.name}</div>
                        <div style={{ fontSize: 12, color: THEME.muted, marginTop: 2 }}>
                          {formatPhoneUS(s.phone) || s.phone} • {s.role}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <a
                          href={smsHref}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: "1px solid rgba(36,52,71,0.22)",
                            background: "rgba(36,52,71,0.06)",
                            color: THEME.navy,
                            fontWeight: 900,
                            fontSize: 12,
                            textDecoration: "none",
                            whiteSpace: "nowrap",
                          }}
                          title="Open text app with check-in message"
                        >
                          Text
                        </a>

                        <span style={pillStyle("bad")} title="Consecutive drops in a row">
                          Streak: {s.dropStreak}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ marginTop: 10, fontSize: 12, color: THEME.muted, lineHeight: 1.35 }}>
              Reminder: add/edit the <b>Check-In</b> message in Messages later (key: <b>settings.messages.checkIn</b>).
            </div>
          </div>
        </div>
      </section>

      {/* Finalize & Remind Snapshot */}
      <section style={{ ...cardStyle(), marginTop: 14 }}>
        <div style={{ fontWeight: 950, color: THEME.navy }}>Finalize & Remind Snapshot</div>

        <div style={{ marginTop: 10, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div style={miniStat}>
            <div style={miniLabel}>List Status</div>
            <div style={miniValue}>{week ? (week.finalized ? "Finalized" : "Open") : "Not Created"}</div>
            <div style={miniHint}>Week exists: {week ? "Yes" : "No"}</div>
          </div>

          <div style={miniStat}>
            <div style={miniLabel}>List Sent (Chair Copy)</div>
            <div style={miniValue}>{chairListPct >= 1 ? "Sent ✅" : "Not Sent"}</div>

            {!week ? (
              <div style={miniHint}>Create the week list first.</div>
            ) : chairListStats.supported ? (
              <div style={miniHint}>
                Copies: {chairListStats.copies} • Last: {fmtTime(chairListStats.lastAt)}
              </div>
            ) : (
              <div style={miniHint}>
                Not tracked yet. If you want this tracked, store a timestamp on the week when “Copy List for Chair” is clicked.
              </div>
            )}

            <div style={{ marginTop: 10 }}>
              <MiniBar value={chairListPct} max={1} labelLeft="Completion" labelRight={`${Math.round(chairListPct * 100)}%`} />
            </div>

            {week ? (
              <div style={{ marginTop: 10, fontSize: 12, color: THEME.muted, lineHeight: 1.35 }}>
                If not sent yet, this section is your reminder to send to: <b>Jason</b>, <b>Meeting Steward</b>, and <b>Chairperson</b>.
              </div>
            ) : null}
          </div>

          {/* Reminders Sent mini-card intentionally removed */}

          <div style={miniStat}>
            <div style={miniLabel}>1st Step Lead</div>
            <div style={miniValue} title={firstStepLeadLabel.text}>
              {firstStepLeadLabel.text}
            </div>
            <div style={miniHint}>Only relevant after finalize</div>
          </div>
        </div>
      </section>
    </div>
  );
}

// =========================
// Shared styles
// =========================
const miniStat = {
  border: "1px solid rgba(36,52,71,0.10)",
  borderRadius: 12,
  padding: 12,
  background: "rgba(250,250,250,0.75)",
};

const miniLabel = {
  fontSize: 12,
  fontWeight: 900,
  color: THEME.muted,
};

const miniValue = {
  marginTop: 6,
  fontSize: 18,
  fontWeight: 950,
  color: THEME.navy,
};

const miniHint = {
  marginTop: 6,
  fontSize: 12,
  color: THEME.muted,
  lineHeight: 1.35,
};

const rowLine = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  border: "1px solid rgba(36,52,71,0.10)",
  borderRadius: 12,
  padding: 10,
  background: "#fff",
};

const subRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 10,
  border: "1px solid rgba(36,52,71,0.10)",
  borderRadius: 12,
  padding: 10,
  background: "#fff",
};