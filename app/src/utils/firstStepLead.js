// app/src/utils/firstStepLead.js
// Helpers for the "1st Step Lead" workflow stored on week.firstStepLead

export function ensureFirstStepLead(week) {
  if (!week) return week;

  // If it already exists, return as-is
  if (week.firstStepLead && typeof week.firstStepLead === "object") {
    // ensure minimum shape even if older data exists
    return {
      ...week,
      firstStepLead: {
        status: week.firstStepLead.status ?? "idle",
        volunteerId: week.firstStepLead.volunteerId ?? null,
        requestedAt: week.firstStepLead.requestedAt ?? null,
        responseAt: week.firstStepLead.responseAt ?? null,
        history: Array.isArray(week.firstStepLead.history) ? week.firstStepLead.history : [],
      },
    };
  }

  // Default shape
  return {
    ...week,
    firstStepLead: {
      status: "idle", // "idle" | "waiting" | "confirmed"
      volunteerId: null,
      requestedAt: null,
      responseAt: null,
      history: [],
    },
  };
}

export function patchWeek(prevState, weekId, patcher) {
  return {
    ...prevState,
    weeks: prevState.weeks.map((w) => {
      if (w.id !== weekId) return w;
      return patcher(w);
    }),
  };
}

// Update firstStepLead safely in a week (keeps default shape)
export function patchFirstStepLead(prevState, weekId, patcher) {
  return patchWeek(prevState, weekId, (w) => {
    const safeWeek = ensureFirstStepLead(w);
    const nextFirstStepLead = patcher(safeWeek.firstStepLead);
    return { ...safeWeek, firstStepLead: nextFirstStepLead };
  });
}

// Update the most recent history entry for a volunteerId
export function updateLatestHistoryEntry(firstStepLead, volunteerId, patch) {
  const history = Array.isArray(firstStepLead.history) ? [...firstStepLead.history] : [];
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].volunteerId === volunteerId) {
      history[i] = { ...history[i], ...patch };
      break;
    }
  }
  return { ...firstStepLead, history };
}