export const DAYS = [
  "星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日",
];

export const DAY_INDEX = {
  星期一: 0, 星期二: 1, 星期三: 2, 星期四: 3,
  星期五: 4, 星期六: 5, 星期日: 6,
};

export const DEFAULT_PERIODS = [
  { id: "1-2", label: "1-2", session: "上午" },
  { id: "3-4", label: "3-4", session: "上午" },
  { id: "5-6", label: "5-6", session: "下午" },
  { id: "7-8", label: "7-8", session: "下午" },
  { id: "9-11", label: "9-11", session: "晚上" },
];

export const PERIOD_TIME_RANGE = {
  "1-2": { start: "08:00", end: "09:35" },
  "3-4": { start: "10:00", end: "11:35" },
  "5-6": { start: "14:00", end: "15:35" },
  "7-8": { start: "16:00", end: "17:35" },
  "9-11": { start: "19:00", end: "21:35" },
};

export const ATOMIC_PERIOD_TIME_RANGE = {
  1: { start: "08:00", end: "08:45" },
  2: { start: "08:50", end: "09:35" },
  3: { start: "10:00", end: "10:45" },
  4: { start: "10:50", end: "11:35" },
  5: { start: "14:00", end: "14:45" },
  6: { start: "14:50", end: "15:35" },
  7: { start: "16:00", end: "16:45" },
  8: { start: "16:50", end: "17:35" },
  9: { start: "19:00", end: "19:45" },
  10: { start: "19:50", end: "20:35" },
  11: { start: "20:50", end: "21:35" },
};

export const VIEW_STATE_STORAGE_KEY = "timetable_ui_state_v1";
export const LEGACY_TERM_START_STORAGE_KEY = "term_start_date";
export const FAVORITE_CLASSES_STORAGE_KEY = "favorite_class_ids_v1";
export const RECENT_CLASSES_STORAGE_KEY = "recent_class_ids_v1";
export const THEME_STORAGE_KEY = "timetable_theme_v1";
export const MAX_RECENT_CLASSES = 8;

export const ICONS = {
  period: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 15"></polyline></svg>`,
  location: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
  teacher: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
  weeks: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
};
