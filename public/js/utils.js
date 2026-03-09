import { DEFAULT_PERIODS, PERIOD_TIME_RANGE, ATOMIC_PERIOD_TIME_RANGE, DAYS } from "./constants.js";

// ===== HTML / Download Helpers =====

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatDate(value) {
  if (!value) return "未知时间";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

export function toCsvField(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export function downloadFile(content, fileName, mimeType) {
  downloadBlob(new Blob([content], { type: mimeType }), fileName);
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("readonly", "readonly");
  helper.style.position = "fixed";
  helper.style.opacity = "0";
  document.body.appendChild(helper);
  helper.select();
  document.execCommand("copy");
  helper.remove();
}

// ===== Period Parsing =====

export function parsePeriodRange(value, startHint = "", lengthHint = "") {
  const raw = String(value ?? "").trim();
  const numbers = (raw.match(/\d+/g) || []).map((item) => Number.parseInt(item, 10));

  let start = numbers.length ? numbers[0] : Number.parseInt(String(startHint ?? "").trim(), 10);
  if (!Number.isFinite(start)) return null;

  let end = numbers.length >= 2 ? numbers[numbers.length - 1] : start;
  if (!Number.isFinite(end)) end = start;

  const length = Number.parseInt(String(lengthHint ?? "").trim(), 10);
  if (Number.isFinite(length) && length > 0) {
    end = Math.max(end, start + length - 1);
  }

  if (end < start) return { start: end, end: start };
  return { start, end };
}

export const FIXED_PERIOD_BOUNDS = DEFAULT_PERIODS.map((period) => {
  const bounds = parsePeriodRange(period.id);
  return { id: period.id, start: bounds?.start ?? 0, end: bounds?.end ?? 0 };
});

export function normalizePeriodText(value, startHint = "", lengthHint = "") {
  const bounds = parsePeriodRange(value, startHint, lengthHint);
  return bounds ? `${bounds.start}-${bounds.end}` : "";
}

export function getFixedPeriodBlocks(value, startHint = "", lengthHint = "") {
  const bounds = parsePeriodRange(value, startHint, lengthHint);
  if (!bounds) return [];
  return FIXED_PERIOD_BOUNDS
    .filter((period) => period.start <= bounds.end && period.end >= bounds.start)
    .map((period) => period.id);
}

export function normalizePeriodBlocks(value, periodText, startHint = "", lengthHint = "") {
  if (Array.isArray(value)) {
    const normalized = Array.from(
      new Set(
        value.map((item) => String(item ?? "").trim())
          .filter((item) => FIXED_PERIOD_BOUNDS.some((period) => period.id === item)),
      ),
    );
    if (normalized.length) return normalized;
  }
  return getFixedPeriodBlocks(periodText, startHint, lengthHint);
}

export function getSlotPeriodBlocks(slot) {
  if (Array.isArray(slot?.periodBlocks) && slot.periodBlocks.length) return slot.periodBlocks;
  return getFixedPeriodBlocks(slot?.period, slot?.startPeriod, slot?.continuousPeriods);
}

export function getTimeRangeForPeriod(periodText) {
  const bounds = parsePeriodRange(periodText);
  if (!bounds) return PERIOD_TIME_RANGE[periodText] || null;

  const startRange = ATOMIC_PERIOD_TIME_RANGE[bounds.start];
  const endRange = ATOMIC_PERIOD_TIME_RANGE[bounds.end];
  if (startRange && endRange) return { start: startRange.start, end: endRange.end };

  const blocks = getFixedPeriodBlocks(periodText, bounds.start, bounds.end - bounds.start + 1);
  if (!blocks.length) return null;
  return {
    start: PERIOD_TIME_RANGE[blocks[0]]?.start || "",
    end: PERIOD_TIME_RANGE[blocks[blocks.length - 1]]?.end || "",
  };
}

export function getSessionLabelForPeriod(periodText) {
  const bounds = parsePeriodRange(periodText);
  if (!bounds) return "";
  if (bounds.start <= 4) return "上午";
  if (bounds.start <= 8) return "下午";
  return "晚上";
}

// ===== Week Parsing =====

export function parseWeeksFromText(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return null;

  const compact = raw.replaceAll(" ", "").replaceAll("，", ",").replaceAll("至", "-");
  const numberMatches = compact.match(/\d+\s*-\s*\d+|\d+/g) || [];
  const weeks = new Set();

  for (const token of numberMatches) {
    if (token.includes("-")) {
      const [startRaw, endRaw] = token.split("-");
      const start = Number.parseInt(startRaw, 10);
      const end = Number.parseInt(endRaw, 10);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      const min = Math.min(start, end);
      const max = Math.max(start, end);
      for (let week = min; week <= max; week += 1) {
        if (week >= 1 && week <= 30) weeks.add(week);
      }
      continue;
    }
    const week = Number.parseInt(token, 10);
    if (Number.isFinite(week) && week >= 1 && week <= 30) weeks.add(week);
  }
  return weeks.size ? weeks : null;
}

export function parseWeeksFromBitmap(bitmap) {
  const value = String(bitmap ?? "").trim();
  if (!value || !/^[01]+$/.test(value)) return null;

  const weeks = new Set();
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "1") weeks.add(index + 1);
  }
  return weeks.size ? weeks : null;
}

export function formatWeeksSet(weeksSet) {
  const sorted = Array.from(weeksSet).sort((left, right) => left - right);
  if (!sorted.length) return "";

  const parts = [];
  let start = sorted[0];
  let previous = sorted[0];

  for (let index = 1; index <= sorted.length; index += 1) {
    const current = sorted[index];
    if (current === previous + 1) { previous = current; continue; }
    parts.push(start === previous ? `${start}` : `${start}-${previous}`);
    start = current;
    previous = current;
  }
  return `${parts.join(",")}周`;
}

export function getParityLabel(weeksSet) {
  if (!weeksSet || !weeksSet.size) return "";
  let hasOdd = false;
  let hasEven = false;
  for (const week of weeksSet) {
    if (week % 2 === 1) hasOdd = true;
    else hasEven = true;
    if (hasOdd && hasEven) return "单双周";
  }
  return hasOdd ? "单周" : "双周";
}

export function resolveSlotWeekSet(slot) {
  return parseWeeksFromBitmap(slot.weekBitmap) || parseWeeksFromText(slot.weeks);
}

export function parseWeekFilter(text, mode) {
  const raw = String(text ?? "").trim();
  const weeks = parseWeeksFromText(raw);
  const compact = raw.replaceAll(" ", "");
  const textParity = compact.includes("单") && !compact.includes("双")
    ? "odd"
    : compact.includes("双") && !compact.includes("单") ? "even" : null;

  const parity = mode === "odd" || mode === "even" ? mode : textParity;
  return {
    weeks, parity,
    enabled: Boolean(weeks || parity),
    label: [raw, mode === "odd" ? "仅单周" : mode === "even" ? "仅双周" : ""].filter(Boolean).join(" "),
  };
}

export function cloneWeekFilter(filter) {
  if (!filter) return { weeks: null, parity: null, enabled: false, label: "" };
  return {
    weeks: filter.weeks ? new Set(filter.weeks) : null,
    parity: filter.parity || null,
    enabled: Boolean(filter.enabled),
    label: filter.label || "",
  };
}

export function applySelectedWeekNumber(filter, weekNumberText) {
  const weekNumber = Number.parseInt(String(weekNumberText || "").trim(), 10);
  if (!Number.isFinite(weekNumber) || weekNumber < 1 || weekNumber > 30) return filter;

  const next = cloneWeekFilter(filter);
  const selectedSet = new Set([weekNumber]);
  if (next.weeks && next.weeks.size) {
    const intersection = new Set();
    for (const value of next.weeks) {
      if (selectedSet.has(value)) intersection.add(value);
    }
    next.weeks = intersection;
  } else {
    next.weeks = selectedSet;
  }

  next.label = [next.label, `当前周:${weekNumber}`].filter(Boolean).join("｜");
  next.enabled = true;
  return next;
}

export function matchesWeekFilter(slot, filter) {
  if (!filter || !filter.enabled) return true;

  const slotWeeks = resolveSlotWeekSet(slot);
  if (!slotWeeks || !slotWeeks.size) return false;

  let candidateWeeks = slotWeeks;
  if (filter.weeks) {
    const intersection = new Set();
    for (const week of slotWeeks) {
      if (filter.weeks.has(week)) intersection.add(week);
    }
    if (!intersection.size) return false;
    candidateWeeks = intersection;
  }

  if (filter.parity) {
    for (const week of candidateWeeks) {
      if ((week % 2 === 1 ? "odd" : "even") === filter.parity) return true;
    }
    return false;
  }
  return true;
}

export function getWeekNumber(date, start) {
  if (!date || !start) return 0;
  const current = new Date(date);
  current.setHours(0, 0, 0, 0);
  const termStart = new Date(start);
  termStart.setHours(0, 0, 0, 0);
  if (Number.isNaN(termStart.getTime())) return 0;
  const diffDays = Math.floor((current.getTime() - termStart.getTime()) / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
}

// ===== Misc Helpers =====

export function getCourseColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash % 360)}, 65%, 40%)`;
}

export function getTodayIndex() {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
}

export function getTodayLabel() {
  return DAYS[getTodayIndex()] || "";
}

export function toDayLabel(value) {
  if (typeof value === "number") return DAYS[value - 1] || "";
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const map = {
    周一: "星期一", 周二: "星期二", 周三: "星期三", 周四: "星期四",
    周五: "星期五", 周六: "星期六", 周日: "星期日", 星期天: "星期日",
    1: "星期一", 2: "星期二", 3: "星期三", 4: "星期四",
    5: "星期五", 6: "星期六", 7: "星期日",
  };
  return map[raw] || raw;
}
