// src/state/storage.js
import { DEFAULT_STATE } from "./defaultState.js";

const STORAGE_KEY = "gatewayToService_appState_v1";

// Shallow-safe merge helpers to keep older localStorage saves compatible
function isObj(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}

function mergeDeepDefaults(defaults, saved) {
  // Arrays: prefer saved array if it exists; else defaults
  if (Array.isArray(defaults)) return Array.isArray(saved) ? saved : defaults;

  // Objects: recursively merge
  if (isObj(defaults)) {
    const out = { ...defaults };
    if (isObj(saved)) {
      for (const k of Object.keys(saved)) {
        // If key exists in defaults, merge; otherwise keep saved extra fields
        if (k in defaults) out[k] = mergeDeepDefaults(defaults[k], saved[k]);
        else out[k] = saved[k];
      }
    }
    return out;
  }

  // Primitives: prefer saved if defined, else defaults
  return saved !== undefined ? saved : defaults;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);

    const parsed = JSON.parse(raw);

    // Minimal safety: if version missing or wrong, fallback.
    if (!parsed || typeof parsed !== "object" || parsed.version !== 1) {
      return structuredClone(DEFAULT_STATE);
    }

    // ✅ Back-compat: fill missing defaults without deleting existing data
    const merged = mergeDeepDefaults(structuredClone(DEFAULT_STATE), parsed);

    // ✅ Extra safety: ensure required top-level shapes always exist
    if (!Array.isArray(merged.volunteers)) merged.volunteers = [];
    if (!Array.isArray(merged.weeks)) merged.weeks = [];
    if (!merged.settings || typeof merged.settings !== "object") {
      merged.settings = structuredClone(DEFAULT_STATE.settings);
    }
    if (!merged.settings.messages || typeof merged.settings.messages !== "object") {
      merged.settings.messages = structuredClone(DEFAULT_STATE.settings.messages);
    }

    return merged;
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
