// app/src/utils/shareList.js
// Builds a plain-text weekly list that can be copied + pasted into SMS/iMessage.
// Goal: Chair can see names + phone numbers quickly (NOT CSV).

import { formatFriendlyDate } from "./date.js";

function safeName(v) {
  return (v?.name || "").trim() || "Unknown";
}

function safePhone(v) {
  return (v?.phone || "").trim() || "";
}

function isActivePoolStatus(status) {
  // We usually do NOT want declined/no response in the Chair text.
  // Chair needs the "who to contact" list.
  return status !== "Declined" && status !== "No Response";
}

function isConfirmed(status) {
  return status === "Confirmed";
}

function isPending(status) {
  // "Pending / To Contact"
  return status === "Invited" || status === "Not Invited";
}

/**
 * Build a chair-ready text list.
 *
 * @param {Object} args
 * @param {string} args.fridayISO - YYYY-MM-DD for the upcoming Friday
 * @param {Object} args.week - week object { invites: [...] }
 * @param {Map} args.volunteersById - Map(volunteerId -> volunteer)
 * @param {Object} args.settings - appState.settings (meeting name/time)
 * @returns {string}
 */
export function buildChairText({ fridayISO, week, volunteersById, settings }) {
  if (!week) return "No week found.";

  const meetingName = settings?.meetingName || "Gateway Meeting";
  const meetingStartTime = settings?.meetingStartTime || "7:00 PM";
  const arriveTime = settings?.meetingArriveTime || "6:45 PM";

  const invites = Array.isArray(week.invites) ? week.invites : [];

  // Keep only rows that are still "in play"
  const activePool = invites.filter((inv) => isActivePoolStatus(inv.status));

  // Confirmed first
  const confirmed = activePool.filter((inv) => isConfirmed(inv.status));

  // Pending next (Invited + Not Invited)
  const pending = activePool.filter((inv) => isPending(inv.status));

  // Sort within groups by name for readability
  const byName = (a, b) => {
    const va = volunteersById.get(a.volunteerId);
    const vb = volunteersById.get(b.volunteerId);
    return safeName(va).localeCompare(safeName(vb));
  };

  confirmed.sort(byName);
  pending.sort(byName);

  const header = [
    `${meetingName} — ${formatFriendlyDate(fridayISO)}`,
    `Meeting: ${meetingStartTime} (Arrive ${arriveTime})`,
    "",
  ].join("\n");

  const fmtLines = (rows) =>
    rows.map((inv, idx) => {
      const v = volunteersById.get(inv.volunteerId);
      const name = safeName(v);
      const phone = safePhone(v);
      return `${idx + 1}) ${name}${phone ? ` — ${phone}` : ""}`;
    });

  const confirmedBlock = [
    `CONFIRMED (${confirmed.length})`,
    ...(confirmed.length ? fmtLines(confirmed) : ["(none yet)"]),
    "",
  ].join("\n");

  const pendingBlock = [
    `PENDING / TO CONTACT (${pending.length})`,
    ...(pending.length ? fmtLines(pending) : ["(none)"]),
    "",
  ].join("\n");

  // We intentionally omit Declined/No Response in the chair text.
  // If you ever want them, we can add an optional flag later.

  return header + confirmedBlock + pendingBlock;
}