import {
  VIEW_STATE_STORAGE_KEY, LEGACY_TERM_START_STORAGE_KEY,
  FAVORITE_CLASSES_STORAGE_KEY, RECENT_CLASSES_STORAGE_KEY,
  THEME_STORAGE_KEY, MAX_RECENT_CLASSES,
} from "./constants.js";
import {
  searchInput, classFilterInput, weekFilterInput, weekModeSelect,
  weekNumberSelect, compactToggle, enableIcsToggle, termStartInput,
  themeSelect,
} from "./dom.js";
import { getWeekNumber } from "./utils.js";

// ===== State Object =====

export const state = {
  dataset: null,
  legacyData: null,
  currentClassId: "",
  metaVersion: "",
  classFilterKeyword: "",
  selectedGrade: "",
  selectedCollege: "",
  selectedMajor: "",
  selectedWeekNumber: "",
  compactMode: false,
  enableIcs: false,
  termStartDate: "",
  classFilterDebounceTimer: null,
  hashDebounceTimer: null,
  cardRegistry: new Map(),
  lastRenderedRows: [],
  hasAppliedHashState: false,
  viewStateSource: "default",
  favoriteClassIds: [],
  recentClassIds: [],
  lastVisitedClassId: "",
  themePreference: "system",
  colorSchemeMedia: null,
};

// ===== localStorage Helpers =====

export function readStoredIdList(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed.map((item) => String(item ?? "").trim()).filter(Boolean)));
  } catch {
    return [];
  }
}

function writeStoredIdList(storageKey, values) {
  try {
    const normalized = Array.from(new Set((values || []).map((item) => String(item ?? "").trim()).filter(Boolean)));
    localStorage.setItem(storageKey, JSON.stringify(normalized));
  } catch { /* quota exceeded */ }
}

export function hydrateClassMemoryState() {
  state.favoriteClassIds = readStoredIdList(FAVORITE_CLASSES_STORAGE_KEY);
  state.recentClassIds = readStoredIdList(RECENT_CLASSES_STORAGE_KEY);
}

export function persistFavoriteClassIds() {
  writeStoredIdList(FAVORITE_CLASSES_STORAGE_KEY, state.favoriteClassIds);
}

export function persistRecentClassIds() {
  writeStoredIdList(RECENT_CLASSES_STORAGE_KEY, state.recentClassIds);
}

export function rememberRecentClass(classId) {
  if (!classId) return;
  state.recentClassIds = [classId, ...state.recentClassIds.filter((item) => item !== classId)]
    .slice(0, MAX_RECENT_CLASSES);
  persistRecentClassIds();
}

export function isFavoriteClassId(classId) {
  return Boolean(classId) && state.favoriteClassIds.includes(classId);
}

// ===== View State & Hash Sync =====

export function normalizeViewState(raw = {}) {
  return {
    q: String(raw.q ?? ""),
    cf: String(raw.cf ?? ""),
    wf: String(raw.wf ?? ""),
    wm: raw.wm === "odd" || raw.wm === "even" ? raw.wm : "all",
    wn: String(raw.wn ?? ""),
    c: String(raw.c ?? ""),
    g: String(raw.g ?? ""),
    co: String(raw.co ?? ""),
    m: String(raw.m ?? ""),
    cp: raw.cp === "1" ? "1" : "0",
    ei: raw.ei === "1" ? "1" : "0",
    ts: String(raw.ts ?? ""),
  };
}

export function getHashState() {
  const raw = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(raw);
  return {
    q: params.get("q") || "", cf: params.get("cf") || "",
    wf: params.get("wf") || "", wm: params.get("wm") || "all",
    wn: params.get("wn") || "", c: params.get("c") || "",
    g: params.get("g") || "", co: params.get("co") || "",
    m: params.get("m") || "", cp: params.get("cp") || "0",
    ei: params.get("ei") || "0", ts: params.get("ts") || "",
  };
}

export function hasHashParams() {
  const raw = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1) : window.location.hash;
  return Boolean(raw);
}

export function readPersistedViewState() {
  try {
    const raw = localStorage.getItem(VIEW_STATE_STORAGE_KEY);
    if (!raw) return null;
    return normalizeViewState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function getStoredTermStartDate() {
  const persisted = readPersistedViewState();
  if (persisted?.ts) return persisted.ts;
  return localStorage.getItem(LEGACY_TERM_START_STORAGE_KEY) || "";
}

function getInitialViewState() {
  if (hasHashParams()) {
    return { source: "hash", values: normalizeViewState(getHashState()) };
  }
  const persisted = readPersistedViewState();
  if (persisted) return { source: "storage", values: persisted };
  return {
    source: "default",
    values: normalizeViewState({ ts: localStorage.getItem(LEGACY_TERM_START_STORAGE_KEY) || "" }),
  };
}

function getCurrentViewState() {
  return normalizeViewState({
    q: searchInput.value.trim(),
    cf: state.classFilterKeyword.trim(),
    wf: weekFilterInput.value.trim(),
    wm: weekModeSelect.value,
    wn: state.selectedWeekNumber,
    c: state.currentClassId,
    g: state.selectedGrade,
    co: state.selectedCollege,
    m: state.selectedMajor,
    cp: state.compactMode ? "1" : "0",
    ei: state.enableIcs ? "1" : "0",
    ts: state.termStartDate,
  });
}

export function writePersistedViewStateNow() {
  try {
    const next = getCurrentViewState();
    localStorage.setItem(VIEW_STATE_STORAGE_KEY, JSON.stringify(next));
    if (next.ts) {
      localStorage.setItem(LEGACY_TERM_START_STORAGE_KEY, next.ts);
    } else {
      localStorage.removeItem(LEGACY_TERM_START_STORAGE_KEY);
    }
  } catch { /* persist failed */ }
}

export function writeHashStateNow() {
  const params = new URLSearchParams();
  const put = (key, value) => {
    const normalized = String(value ?? "");
    if (normalized) params.set(key, normalized);
  };

  put("q", searchInput.value.trim());
  put("cf", state.classFilterKeyword.trim());
  put("wf", weekFilterInput.value.trim());
  put("wm", weekModeSelect.value);
  put("wn", state.selectedWeekNumber);
  put("c", state.currentClassId);
  put("g", state.selectedGrade);
  put("co", state.selectedCollege);
  put("m", state.selectedMajor);
  put("cp", state.compactMode ? "1" : "0");
  put("ei", state.enableIcs ? "1" : "0");
  put("ts", state.termStartDate);

  const next = params.toString();
  const target = next ? `#${next}` : "";
  if (window.location.hash !== target) {
    history.replaceState(null, "", target || window.location.pathname + window.location.search);
  }
}

export function scheduleHashSync() {
  if (!state.hasAppliedHashState) return;
  if (state.hashDebounceTimer) clearTimeout(state.hashDebounceTimer);
  state.hashDebounceTimer = window.setTimeout(() => {
    state.hashDebounceTimer = null;
    writeHashStateNow();
    writePersistedViewStateNow();
  }, 160);
}

export function applyHashStateToControls() {
  const initialState = getInitialViewState();
  const values = initialState.values;

  searchInput.value = values.q;
  classFilterInput.value = values.cf;
  weekFilterInput.value = values.wf;
  weekModeSelect.value = values.wm;
  weekNumberSelect.value = values.wn;
  compactToggle.checked = values.cp === "1";
  enableIcsToggle.checked = values.ei === "1";
  termStartInput.value = values.ts;

  state.classFilterKeyword = values.cf;
  state.selectedWeekNumber = values.wn;
  state.currentClassId = values.c;
  state.selectedGrade = values.g;
  state.selectedCollege = values.co;
  state.selectedMajor = values.m;
  state.compactMode = compactToggle.checked;
  state.enableIcs = enableIcsToggle.checked;
  state.termStartDate = values.ts;
  state.hasAppliedHashState = true;
  state.viewStateSource = initialState.source;
  writePersistedViewStateNow();
}

export function autoSelectCurrentWeek() {
  if (hasHashParams() || state.viewStateSource !== "default" || state.selectedWeekNumber) return;

  if (!state.termStartDate) {
    const storedStart = getStoredTermStartDate();
    if (storedStart) {
      state.termStartDate = storedStart;
      termStartInput.value = storedStart;
    }
  }
  if (!state.termStartDate) return;

  const currentWeek = getWeekNumber(new Date(), state.termStartDate);
  if (currentWeek >= 1 && currentWeek <= 30) {
    state.selectedWeekNumber = String(currentWeek);
    if (weekNumberSelect) weekNumberSelect.value = state.selectedWeekNumber;
  }
}

// ===== Theme =====

function normalizeThemePreference(value) {
  return value === "dark" || value === "light" || value === "system" ? value : "system";
}

function readStoredThemePreference() {
  try {
    return normalizeThemePreference(localStorage.getItem(THEME_STORAGE_KEY) || "system");
  } catch {
    return "system";
  }
}

function resolveTheme(preference) {
  if (preference === "dark" || preference === "light") return preference;
  const prefersDark = state.colorSchemeMedia
    ? state.colorSchemeMedia.matches
    : (window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)").matches : true);
  return prefersDark ? "dark" : "light";
}

export function applyThemePreference(preference, persist = false) {
  const normalized = normalizeThemePreference(preference);
  state.themePreference = normalized;

  const appliedTheme = resolveTheme(normalized);
  document.documentElement.dataset.themePreference = normalized;
  document.documentElement.dataset.theme = appliedTheme;
  themeSelect.value = normalized;

  if (persist) {
    try { localStorage.setItem(THEME_STORAGE_KEY, normalized); }
    catch { /* persist failed */ }
  }
}

export function initThemePreference() {
  state.colorSchemeMedia = window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  applyThemePreference(readStoredThemePreference(), false);

  if (state.colorSchemeMedia?.addEventListener) {
    state.colorSchemeMedia.addEventListener("change", () => {
      if (state.themePreference === "system") applyThemePreference("system", false);
    });
  }
}
