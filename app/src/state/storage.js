// src/state/storage.js

import { DEFAULT_STATE } from "./defaultState.js";

const STORAGE_KEY = "gatewayToService_appState_v1";

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);

    const parsed = JSON.parse(raw);

    // Minimal safety: if version missing or wrong, fallback.
    if (!parsed || typeof parsed !== "object" || parsed.version !== 1) {
      return structuredClone(DEFAULT_STATE);
    }

    return parsed;
  } catch (err) {
    console.error("Failed to load state:", err);
    return structuredClone(DEFAULT_STATE);
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error("Failed to save state:", err);
  }
}

export function resetState() {
  const fresh = structuredClone(DEFAULT_STATE);
  saveState(fresh);
  return fresh;
}
