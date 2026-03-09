import { DEFAULT_PERIODS, DAYS, DAY_INDEX } from "./constants.js";
import {
  parsePeriodRange, normalizePeriodText, normalizePeriodBlocks,
  getSlotPeriodBlocks, toDayLabel,
  resolveSlotWeekSet, matchesWeekFilter, formatWeeksSet, getParityLabel,
  parseWeeksFromText, escapeHtml,
} from "./utils.js";
import { state } from "./state.js";

// ===== Data Normalization =====

function normalizeSlots(slots) {
  if (!Array.isArray(slots)) return [];

  return slots.map((slot) => {
    if (!slot || typeof slot !== "object") return null;

    const day = toDayLabel(slot.day ?? slot.weekday ?? slot.dayLabel ?? "");
    const period = normalizePeriodText(
      slot.period ?? slot.section ?? slot.time ?? "",
      slot.startPeriod ?? slot.Skjc ?? slot.start ?? "",
      slot.continuousPeriods ?? slot.Cxjc ?? slot.span ?? "",
    );
    const periodBlocks = normalizePeriodBlocks(
      slot.periodBlocks ?? slot.blocks ?? slot.fixedBlocks,
      period,
      slot.startPeriod ?? slot.Skjc ?? slot.start ?? "",
      slot.continuousPeriods ?? slot.Cxjc ?? slot.span ?? "",
    );
    const courseName = String(slot.courseName ?? slot.course ?? "").trim();
    if (!day || !period || !periodBlocks.length || !courseName) return null;

    const periodRange = parsePeriodRange(period);
    return {
      day, period, periodBlocks,
      startPeriod: periodRange?.start ?? "",
      endPeriod: periodRange?.end ?? "",
      continuousPeriods: periodRange ? periodRange.end - periodRange.start + 1 : "",
      courseCode: String(slot.courseCode ?? slot.code ?? slot.kch ?? "").trim(),
      courseSeq: String(slot.courseSeq ?? slot.kcxh ?? slot.seq ?? "").trim(),
      courseName,
      teacher: String(slot.teacher ?? slot.jsxm ?? "").trim(),
      location: String(slot.location ?? slot.room ?? slot.jas ?? "").trim(),
      weekBitmap: String(slot.weekBitmap ?? slot.skzc ?? slot.Skzc ?? "").trim(),
      weeks: String(slot.weeks ?? slot.week ?? slot.zcd ?? "").trim(),
      note: String(slot.note ?? slot.bz ?? "").trim(),
    };
  }).filter(Boolean);
}

export function normalizeDataset(raw) {
  if (!raw || typeof raw !== "object") return null;
  const classesRaw = Array.isArray(raw.classes) ? raw.classes : [];
  if (!classesRaw.length) return null;

  const classes = classesRaw.map((item, index) => {
    if (!item || typeof item !== "object") return null;
    const id = String(item.id || `class-${index + 1}`);
    const name = String(item.name || id);
    const term = String(item.term || raw.term || "");
    const slots = normalizeSlots(item.slots || item.courses || []);
    return {
      id, name, term,
      grade: String(item.grade ?? item.njdm ?? "").trim(),
      collegeCode: String(item.collegeCode ?? item.xsh ?? "").trim(),
      collegeName: String(item.collegeName ?? item.xsm ?? "").trim(),
      majorCode: String(item.majorCode ?? item.zyh ?? "").trim(),
      majorName: String(item.majorName ?? item.zym ?? "").trim(),
      directionCode: String(item.directionCode ?? item.zyfxh ?? "").trim(),
      directionName: String(item.directionName ?? item.zyfxm ?? item.fxmc ?? "").trim(),
      slots,
    };
  }).filter(Boolean);

  if (!classes.length) return null;
  return {
    generated_at: raw.generated_at || "",
    source: raw.source || "",
    term_start_date: String(raw.term_start_date ?? raw.termStartDate ?? "").trim(),
    periods: DEFAULT_PERIODS,
    classes,
  };
}

export function groupPeriods(periods) {
  const groups = [];
  for (const period of periods) {
    const current = groups[groups.length - 1];
    if (!current || current.session !== period.session) {
      groups.push({ session: period.session, periods: [period] });
      continue;
    }
    current.periods.push(period);
  }
  return groups;
}

// ===== Filtering & Merging =====

function slotMatchesKeyword(slot, loweredKeyword) {
  if (!loweredKeyword) return true;
  return [slot.courseCode, slot.courseSeq, slot.courseName, slot.period, slot.location, slot.teacher, slot.weeks, slot.note]
    .join(" ").toLowerCase().includes(loweredKeyword);
}

export function getFilteredSlots(slots, keyword, weekFilter, dayLabel = "") {
  const lowered = keyword.trim().toLowerCase();
  return slots.filter((slot) => {
    if (dayLabel && slot.day !== dayLabel) return false;
    if (!slotMatchesKeyword(slot, lowered)) return false;
    return matchesWeekFilter(slot, weekFilter);
  });
}

export function buildSlotMap(slots, keyword, weekFilter) {
  const map = new Map();
  for (const slot of getFilteredSlots(slots, keyword, weekFilter)) {
    for (const blockId of getSlotPeriodBlocks(slot)) {
      const key = `${blockId}|${slot.day}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(slot);
    }
  }
  return map;
}

export function mergeSlotsForDisplay(slots) {
  const merged = new Map();

  for (const slot of slots) {
    const key = [slot.day, slot.period, slot.location, slot.teacher, slot.courseCode, slot.courseSeq, slot.courseName].join("|");
    if (!merged.has(key)) {
      merged.set(key, { ...slot, _weeksSet: new Set(), _weeksText: new Set(), _teachers: new Set(), _notes: new Set() });
    }
    const item = merged.get(key);
    const parsedWeeks = resolveSlotWeekSet(slot);
    if (parsedWeeks && parsedWeeks.size) {
      for (const week of parsedWeeks) item._weeksSet.add(week);
    }
    if (slot.weeks) item._weeksText.add(slot.weeks);
    if (slot.teacher) item._teachers.add(slot.teacher);
    if (slot.note) item._notes.add(slot.note);
  }

  return Array.from(merged.values()).map((item) => {
    const weeks = item._weeksSet.size ? formatWeeksSet(item._weeksSet) : Array.from(item._weeksText).join(" + ");
    const teachers = Array.from(item._teachers);
    const teacher = teachers.length <= 3 ? teachers.join(" / ") : `${teachers.slice(0, 3).join(" / ")} 等${teachers.length}位`;
    const notes = Array.from(item._notes);
    const note = notes.length <= 1 ? (notes[0] || "") : `多教学班(${notes.length})`;
    const weeksSet = item._weeksSet.size ? new Set(item._weeksSet) : null;
    const parityLabel = getParityLabel(weeksSet);

    const normalized = { ...item, teacher, weeks, note, parityLabel, weeksSet };
    delete normalized._weeksSet;
    delete normalized._weeksText;
    delete normalized._teachers;
    delete normalized._notes;
    return normalized;
  });
}

export function getFilteredClasses(dataset) {
  if (!dataset) return [];
  const keyword = state.classFilterKeyword.trim().toLowerCase();
  return dataset.classes.filter((item) => {
    const searchable = `${item.id} ${item.name}`.toLowerCase();
    if (keyword && !searchable.includes(keyword)) return false;
    if (state.selectedGrade && item.grade !== state.selectedGrade) return false;
    if (state.selectedCollege && item.collegeCode !== state.selectedCollege) return false;
    if (state.selectedMajor && item.majorCode !== state.selectedMajor) return false;
    return true;
  });
}

export function currentClass() {
  if (!state.dataset) return null;
  const filteredClasses = getFilteredClasses(state.dataset);
  if (!filteredClasses.length) return null;
  return filteredClasses.find((item) => item.id === state.currentClassId) || filteredClasses[0];
}

export function findClassById(dataset, classId) {
  if (!dataset || !classId) return null;
  return dataset.classes.find((item) => item.id === classId) || null;
}

export function maxWeekInDataset(dataset) {
  if (!dataset || !Array.isArray(dataset.classes)) return 20;
  let maxWeek = 0;
  for (const classItem of dataset.classes) {
    for (const slot of classItem.slots || []) {
      const set = resolveSlotWeekSet(slot);
      if (!set || !set.size) continue;
      const localMax = Math.max(...set);
      if (localMax > maxWeek) maxWeek = localMax;
    }
  }
  return Math.max(maxWeek, 20);
}

export function getVisibleMergedRows(classItem, keyword, weekFilter, dayLabel = "") {
  if (!classItem) return [];

  const groups = new Map();
  for (const slot of getFilteredSlots(classItem.slots, keyword, weekFilter, dayLabel)) {
    const key = `${slot.day}|${slot.period}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(slot);
  }

  return Array.from(groups.values())
    .flatMap((items) => mergeSlotsForDisplay(items))
    .sort((left, right) => {
      const leftDay = DAY_INDEX[left.day] ?? 99;
      const rightDay = DAY_INDEX[right.day] ?? 99;
      if (leftDay !== rightDay) return leftDay - rightDay;
      const leftRange = parsePeriodRange(left.period);
      const rightRange = parsePeriodRange(right.period);
      const leftStart = leftRange?.start ?? 99;
      const rightStart = rightRange?.start ?? 99;
      if (leftStart !== rightStart) return leftStart - rightStart;
      const leftEnd = leftRange?.end ?? 99;
      const rightEnd = rightRange?.end ?? 99;
      if (leftEnd !== rightEnd) return leftEnd - rightEnd;
      return String(left.courseName || "").localeCompare(String(right.courseName || ""), "zh-CN");
    });
}

// ===== Option List Helpers =====

export function toOptionList(values, emptyLabel) {
  const unique = Array.from(new Set(values.filter(Boolean)));
  unique.sort((left, right) => left.localeCompare(right, "zh-CN"));
  return [
    `<option value="">${escapeHtml(emptyLabel)}</option>`,
    ...unique.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`),
  ].join("");
}

export function toOptionListByLabel(options, emptyLabel) {
  const normalized = options
    .filter((item) => item && item.value)
    .sort((left, right) => String(left.label).localeCompare(String(right.label), "zh-CN"));
  return [
    `<option value="">${escapeHtml(emptyLabel)}</option>`,
    ...normalized.map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`),
  ].join("");
}

export function toNamedOptions(classes, codeKey, nameKey, fallbackLabel) {
  const map = new Map();
  for (const item of classes) {
    const code = String(item[codeKey] ?? "").trim();
    if (!code) continue;
    const name = String(item[nameKey] ?? "").trim();
    if (!map.has(code)) map.set(code, new Set());
    if (name) map.get(code).add(name);
  }
  return Array.from(map.entries()).map(([code, names]) => {
    const preferredName = Array.from(names)[0] || "";
    return { value: code, label: preferredName || `${fallbackLabel}（编码 ${code}）` };
  });
}
