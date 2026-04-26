// app/src/utils/requiredRolePrompts.js
// Gateway to Service — Required Role Coverage Prompts (Alt Roles)
//
// PURPOSE
// - Central helper for Coordinator pages to determine when required-role coverage is missing
//   and which Alt role should be suggested.
//
// WHAT COUNTS AS "MISSING COVERAGE"
// For required roles that have an Alt mapping:
// - Primary is UNASSIGNED (no volunteer with that coreRole)
// - Primary is PAUSED (active === false)
// - Primary is NOT ON THIS WEEK (no invite row exists for them)
// - Primary is ON THIS WEEK but DROPPED (status === "Declined" OR "No Response")
//
// NOTE
// - This is "coverage missing", NOT removing anyone from the week list.
// - Declined/No Response stays on the week list for history + filters.
//
// OUTPUT SHAPE
// Returns an array of prompts:
//
// {
//   key: "Chairperson__Alt Chairperson",
//   requiredRole: "Chairperson",
//   altRole: "Alt Chairperson",
//
//   // why the required role is missing coverage
//   missingReason: "unassigned" | "paused" | "notOnWeek" | "declined" | "noResponse",
//
//   // primary info (may be null)
//   primaryPerson: {...} | null,
//   primaryOnWeek: boolean,
//   primaryStatus: string | null,
//
//   // alt info (may be null)
//   altPerson: {...} | null,
//   altExists: boolean,
//   altAssignedButInactive: boolean,
//   altOnWeek: boolean,
//   altStatus: string | null,
//
//   // suggested action for UI
//   // assignAlt: no alt assigned OR alt assigned but paused
//   // addToWeek: alt active, not on week
//   // sendInvite: alt on week + Not Invited
//   // openActions: alt on week + Invited
//   // confirmed: alt on week + Confirmed
//   // declined: alt on week + Declined/No Response
//   action: "assignAlt" | "addToWeek" | "sendInvite" | "openActions" | "confirmed" | "declined",
// }

const ALT_ROLE_MAP = {
  Chairperson: "Alt Chairperson",
  "Discussion Group Lead": "Alt Discussion Lead",
  "Big Book Lead": "Alt Big Book Lead",
};

// For now, we only prompt coverage checks for these three roles (your request).
const PROMPT_REQUIRED_ROLES = ["Chairperson", "Discussion Group Lead", "Big Book Lead"];

function isDropStatus(status) {
  return status === "Declined" || status === "No Response";
}

/**
 * getAltRolePrompts
 *
 * @param {Object} params
 * @param {Object} params.week - week object for the upcoming Friday
 * @param {Array}  params.volunteers - appState.volunteers
 * @param {Map}    params.volunteersByRole - Map(coreRole -> volunteer)
 * @param {Map}    params.inviteByVolunteerId - Map(volunteerId -> invite row for this week)
 *
 * @returns {Array} prompts
 */
export function getAltRolePrompts({
  week,
  volunteers,
  volunteersByRole,
  inviteByVolunteerId,
}) {
  if (!week) return [];

  const prompts = [];

  for (const requiredRole of PROMPT_REQUIRED_ROLES) {
    const altRole = ALT_ROLE_MAP[requiredRole];
    if (!altRole) continue;

    const primary = volunteersByRole?.get(requiredRole) || null;

    const primaryInvite = primary ? inviteByVolunteerId?.get(primary.id) || null : null;
    const primaryOnWeek = !!primaryInvite;
    const primaryStatus = primaryInvite?.status || null;

    // Determine if coverage is missing, and why
    let missing = false;
    let missingReason = "onList";

    if (!primary) {
      missing = true;
      missingReason = "unassigned";
    } else if (!primary.active) {
      missing = true;
      missingReason = "paused";
    } else if (!primaryOnWeek) {
      missing = true;
      missingReason = "notOnWeek";
    } else if (primaryStatus === "Declined") {
      missing = true;
      missingReason = "declined";
    } else if (primaryStatus === "No Response") {
      missing = true;
      missingReason = "noResponse";
    }

    if (!missing) continue;

    // Find Alt person assigned in Volunteers
    const altPerson = volunteersByRole?.get(altRole) || null;
    const altExists = !!altPerson;
    const altAssignedButInactive = !!altPerson && !altPerson.active;

    const altInvite = altPerson ? inviteByVolunteerId?.get(altPerson.id) || null : null;
    const altOnWeek = !!altInvite;
    const altStatus = altInvite?.status || null;

    // Decide action
    let action = "assignAlt";

    if (altPerson && altPerson.active) {
      if (!altOnWeek) action = "addToWeek";
      else if (altStatus === "Not Invited") action = "sendInvite";
      else if (altStatus === "Invited") action = "openActions";
      else if (altStatus === "Confirmed") action = "confirmed";
      else if (isDropStatus(altStatus)) action = "declined";
      else action = "sendInvite"; // safe fallback
    } else {
      // no alt assigned OR alt paused -> cannot auto-fix in popup
      action = "assignAlt";
    }

    prompts.push({
      key: `${requiredRole}__${altRole}`,
      requiredRole,
      altRole,

      missingReason,

      primaryPerson: primary,
      primaryOnWeek,
      primaryStatus,

      altPerson,
      altExists,
      altAssignedButInactive,
      altOnWeek,
      altStatus,

      action,
    });
  }

  return prompts;
}

export const __ALT_ROLE_MAP__ = ALT_ROLE_MAP;
export const __PROMPT_REQUIRED_ROLES__ = PROMPT_REQUIRED_ROLES;