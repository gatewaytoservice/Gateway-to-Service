// src/state/storage.js
import { DEFAULT_STATE } from "./defaultState.js";

const STORAGE_KEY = "gatewayToService_appState_v1";

// Shallow-safe merge helpers to keep older localStorage saves compatible
function isObj(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}

function safeClone(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
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

/**
 * normalizeState
 *
 * Purpose:
 * - Fill in any missing new defaults after importing older backup files.
 * - Preserve existing volunteers, weeks, settings, and extra fields.
 * - Make sure required top-level app shapes always exist.
 *
 * This is important because the app changes over time, but old backup files
 * may not have newer fields such as new message templates or new week tracking.
 */
export function normalizeState(state) {
  const base = safeClone(DEFAULT_STATE);
  const incoming = isObj(state) ? state : {};

  const merged = mergeDeepDefaults(base, incoming);

  // Keep app version stable.
  merged.version = DEFAULT_STATE.version ?? 1;

  // Extra safety: ensure required top-level shapes always exist
  if (!Array.isArray(merged.volunteers)) merged.volunteers = [];
  if (!Array.isArray(merged.weeks)) merged.weeks = [];

  if (!merged.settings || typeof merged.settings !== "object") {
    merged.settings = safeClone(DEFAULT_STATE.settings);
  }

  if (!merged.settings.messages || typeof merged.settings.messages !== "object") {
    merged.settings.messages = safeClone(DEFAULT_STATE.settings.messages);
  }

  return merged;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return safeClone(DEFAULT_STATE);

    const parsed = JSON.parse(raw);

    // Minimal safety: if version missing or wrong, fallback.
    if (!parsed || typeof parsed !== "object" || parsed.version !== 1) {
      return safeClone(DEFAULT_STATE);
    }

    // Back-compat: fill missing defaults without deleting existing data
    return normalizeState(parsed);
  } catch (err) {
    console.error("Failed to load state:", err);
    return safeClone(DEFAULT_STATE);
  }
}

export function saveState(state) {
  try {
    const normalized = normalizeState(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch (err) {
    console.error("Failed to save state:", err);
  }
}

/**
 * replaceState
 *
 * Use this after importing/taking over data.
 * It normalizes the imported state, saves it immediately, and returns the
 * normalized version so React state and localStorage match exactly.
 */
export function replaceState(nextState) {
  const normalized = normalizeState(nextState);
  saveState(normalized);
  return normalized;
}

export function resetState() {
  const fresh = safeClone(DEFAULT_STATE);
  saveState(fresh);
  return fresh;
}