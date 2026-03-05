const statusNode = document.getElementById("status");
const viewTitleNode = document.getElementById("viewTitle");
const tableContainer = document.getElementById("tableContainer");
const todaySchedule = document.getElementById("todaySchedule");
const searchInput = document.getElementById("searchInput");
const classSelect = document.getElementById("classSelect");
const gradeSelect = document.getElementById("gradeSelect");
const collegeSelect = document.getElementById("collegeSelect");
const majorSelect = document.getElementById("majorSelect");
const classFilterInput = document.getElementById("classFilterInput");
const weekFilterInput = document.getElementById("weekFilterInput");
const weekNumberSelect = document.getElementById("weekNumberSelect");
const weekModeSelect = document.getElementById("weekModeSelect");
const compactToggle = document.getElementById("compactToggle");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const enableIcsToggle = document.getElementById("enableIcsToggle");
const termStartInput = document.getElementById("termStartInput");
const exportIcsBtn = document.getElementById("exportIcsBtn");
const reloadButton = document.getElementById("reloadBtn");

const detailModal = document.getElementById("detailModal");
const detailModalBackdrop = document.getElementById("detailModalBackdrop");
const detailModalClose = document.getElementById("detailModalClose");
const detailModalBody = document.getElementById("detailModalBody");
const detailModalTitle = document.getElementById("detailModalTitle");
const toastContainer = document.getElementById("toast-container");
const loadingOverlay = document.getElementById("loading-overlay");

const DAYS = [
  "星期一",
  "星期二",
  "星期三",
  "星期四",
  "星期五",
  "星期六",
  "星期日",
];

const DAY_INDEX = {
  星期一: 0,
  星期二: 1,
  星期三: 2,
  星期四: 3,
  星期五: 4,
  星期六: 5,
  星期日: 6,
};

const DEFAULT_PERIODS = [
  { id: "1-2", label: "1-2", session: "上午" },
  { id: "3-4", label: "3-4", session: "上午" },
  { id: "5-6", label: "5-6", session: "下午" },
  { id: "7-8", label: "7-8", session: "下午" },
  { id: "9-11", label: "9-11", session: "晚上" },
];

const PERIOD_TIME_RANGE = {
  "1-2": { start: "08:00", end: "09:35" },
  "3-4": { start: "10:00", end: "11:35" },
  "5-6": { start: "14:00", end: "15:35" },
  "7-8": { start: "16:00", end: "17:35" },
  "9-11": { start: "19:00", end: "21:35" },
};

function normalizePeriodToFixedBlock(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }

  if (DEFAULT_PERIODS.some((period) => period.id === raw)) {
    return raw;
  }

  const numbers = raw.match(/\d+/g) || [];
  if (!numbers.length) {
    return "";
  }

  const start = Number.parseInt(numbers[0], 10);
  if (!Number.isFinite(start)) {
    return "";
  }

  if (start <= 2) {
    return "1-2";
  }
  if (start <= 4) {
    return "3-4";
  }
  if (start <= 6) {
    return "5-6";
  }
  if (start <= 8) {
    return "7-8";
  }
  return "9-11";
}

const state = {
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
};

function formatDate(value) {
  if (!value) {
    return "未知时间";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN", { hour12: false });
}

function setStatus(text, isError = false) {
  statusNode.textContent = text;
  statusNode.style.color = isError ? "#ff8c8c" : "#98afc7";
  if (isError) {
    showToast(text, "error");
  }
}

function showToast(message, type = "info") {
  if (!toastContainer) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
  
  toastContainer.appendChild(toast);
  
  // Auto remove after 3s
  setTimeout(() => {
    toast.style.animation = "fadeOut 0.3s forwards";
    toast.addEventListener("animationend", () => {
      toast.remove();
    });
  }, 3000);
}

function showLoading() {
  if (loadingOverlay) loadingOverlay.classList.add("visible");
}

function hideLoading() {
  if (loadingOverlay) loadingOverlay.classList.remove("visible");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getHashState() {
  const raw = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(raw);
  return {
    q: params.get("q") || "",
    cf: params.get("cf") || "",
    wf: params.get("wf") || "",
    wm: params.get("wm") || "all",
    wn: params.get("wn") || "",
    c: params.get("c") || "",
    g: params.get("g") || "",
    co: params.get("co") || "",
    m: params.get("m") || "",
    cp: params.get("cp") || "0",
    ei: params.get("ei") || "0",
    ts: params.get("ts") || "",
  };
}

function applyHashStateToControls() {
  const hashState = getHashState();
  searchInput.value = hashState.q;
  classFilterInput.value = hashState.cf;
  weekFilterInput.value = hashState.wf;
  weekModeSelect.value = hashState.wm === "odd" || hashState.wm === "even" ? hashState.wm : "all";
  weekNumberSelect.value = hashState.wn;
  compactToggle.checked = hashState.cp !== "0";
  enableIcsToggle.checked = hashState.ei === "1";
  termStartInput.value = hashState.ts;

  state.classFilterKeyword = hashState.cf;
  state.selectedWeekNumber = hashState.wn;
  state.currentClassId = hashState.c;
  state.selectedGrade = hashState.g;
  state.selectedCollege = hashState.co;
  state.selectedMajor = hashState.m;
  state.compactMode = compactToggle.checked;
  state.enableIcs = enableIcsToggle.checked;
  state.termStartDate = hashState.ts;
  state.hasAppliedHashState = true;
}

function writeHashStateNow() {
  const params = new URLSearchParams();
  const put = (key, value) => {
    const normalized = String(value ?? "");
    if (normalized) {
      params.set(key, normalized);
    }
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

function scheduleHashSync() {
  if (!state.hasAppliedHashState) {
    return;
  }
  if (state.hashDebounceTimer) {
    clearTimeout(state.hashDebounceTimer);
  }
  state.hashDebounceTimer = window.setTimeout(() => {
    state.hashDebounceTimer = null;
    writeHashStateNow();
  }, 160);
}

function toDayLabel(value) {
  if (typeof value === "number") {
    return DAYS[value - 1] || "";
  }

  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }

  const map = {
    周一: "星期一",
    周二: "星期二",
    周三: "星期三",
    周四: "星期四",
    周五: "星期五",
    周六: "星期六",
    周日: "星期日",
    星期天: "星期日",
    1: "星期一",
    2: "星期二",
    3: "星期三",
    4: "星期四",
    5: "星期五",
    6: "星期六",
    7: "星期日",
  };

  return map[raw] || raw;
}

function normalizePeriods() {
  return DEFAULT_PERIODS;
}

function normalizeSlots(slots) {
  if (!Array.isArray(slots)) {
    return [];
  }

  return slots
    .map((slot) => {
      if (!slot || typeof slot !== "object") {
        return null;
      }

      const day = toDayLabel(slot.day ?? slot.weekday ?? slot.dayLabel ?? "");
      const period = normalizePeriodToFixedBlock(slot.period ?? slot.section ?? slot.time ?? "");
      const courseName = String(slot.courseName ?? slot.course ?? "").trim();

      if (!day || !period || !courseName) {
        return null;
      }

      return {
        day,
        period,
        courseCode: String(slot.courseCode ?? slot.code ?? slot.kch ?? "").trim(),
        courseSeq: String(slot.courseSeq ?? slot.kcxh ?? slot.seq ?? "").trim(),
        courseName,
        teacher: String(slot.teacher ?? slot.jsxm ?? "").trim(),
        location: String(slot.location ?? slot.room ?? slot.jas ?? "").trim(),
        weekBitmap: String(slot.weekBitmap ?? slot.skzc ?? slot.Skzc ?? "").trim(),
        weeks: String(slot.weeks ?? slot.week ?? slot.zcd ?? "").trim(),
        note: String(slot.note ?? slot.bz ?? "").trim(),
      };
    })
    .filter(Boolean);
}

function normalizeDataset(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const classesRaw = Array.isArray(raw.classes) ? raw.classes : [];
  if (!classesRaw.length) {
    return null;
  }

  const classes = classesRaw
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const id = String(item.id || `class-${index + 1}`);
      const name = String(item.name || id);
      const term = String(item.term || raw.term || "");
      const slots = normalizeSlots(item.slots || item.courses || []);

      return {
        id,
        name,
        term,
        grade: String(item.grade ?? item.njdm ?? "").trim(),
        collegeCode: String(item.collegeCode ?? item.xsh ?? "").trim(),
        collegeName: String(item.collegeName ?? item.xsm ?? "").trim(),
        majorCode: String(item.majorCode ?? item.zyh ?? "").trim(),
        majorName: String(item.majorName ?? item.zym ?? "").trim(),
        directionCode: String(item.directionCode ?? item.zyfxh ?? "").trim(),
        directionName: String(item.directionName ?? item.zyfxm ?? item.fxmc ?? "").trim(),
        slots,
      };
    })
    .filter(Boolean);

  if (!classes.length) {
    return null;
  }

  return {
    generated_at: raw.generated_at || "",
    source: raw.source || "",
    term_start_date: String(raw.term_start_date ?? raw.termStartDate ?? "").trim(),
    periods: normalizePeriods(raw.periods),
    classes,
  };
}

function groupPeriods(periods) {
  const groups = [];

  for (const period of periods) {
    const current = groups[groups.length - 1];
    if (!current || current.session !== period.session) {
      groups.push({
        session: period.session,
        periods: [period],
      });
      continue;
    }
    current.periods.push(period);
  }

  return groups;
}

const ICONS = {
  location: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
  teacher: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
  weeks: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`
};

function getCourseColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Use HSL for better control: Hue varies, Saturation ~70%, Lightness ~40% for dark mode
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 65%, 40%)`;
}

function getTodayIndex() {
  const day = new Date().getDay(); // 0 is Sunday
  return day === 0 ? 6 : day - 1;
}

function renderTodaySchedule(classItem, dataset, weekFilter) {
  if (!classItem || !dataset) {
    todaySchedule.classList.add("hidden");
    return;
  }

  const todayIndex = getTodayIndex();
  const todayLabel = DAYS[todayIndex];
  
  // Reuse buildSlotMap but filter for today
  const slotMap = buildSlotMap(classItem.slots, "", weekFilter);
  const periods = dataset.periods;
  
  const todaySlots = [];
  for (const period of periods) {
    const key = `${period.id}|${todayLabel}`;
    const slots = slotMap.get(key) || [];
    if (slots.length > 0) {
      const merged = mergeSlotsForDisplay(slots);
      todaySlots.push({ period, items: merged });
    }
  }

  if (todaySlots.length === 0) {
    todaySchedule.innerHTML = `
      <div class="today-empty">
        <div class="today-header">📅 今日日程 (${todayLabel})</div>
        <div class="today-content">今日无课，好好休息！</div>
      </div>
    `;
    todaySchedule.classList.remove("hidden");
    return;
  }

  const cardsHtml = todaySlots.map(group => {
    return group.items.map(item => {
      const color = getCourseColor(item.courseName);
      return `
        <div class="today-card" style="border-left-color: ${color}">
          <div class="today-time">
            <span class="period-badge">${group.period.label}</span>
            <span class="session-label">${group.period.session}</span>
          </div>
          <div class="today-info">
            <div class="today-course">${escapeHtml(item.courseName)}</div>
            <div class="today-meta">
              <span class="meta-item">📍 ${escapeHtml(item.location || "未知")}</span>
              <span class="meta-item">👤 ${escapeHtml(item.teacher || "待定")}</span>
              ${item.weeks ? `<span class="meta-item">📅 ${escapeHtml(item.weeks)}</span>` : ""}
            </div>
          </div>
        </div>
      `;
    }).join("");
  }).join("");

  todaySchedule.innerHTML = `
    <div class="today-container">
      <div class="today-header">📅 今日日程 (${todayLabel})</div>
      <div class="today-grid">
        ${cardsHtml}
      </div>
    </div>
  `;
  todaySchedule.classList.remove("hidden");
}

function renderCourseCard(slot, registryKey) {
  const codeText = slot.courseCode
    ? `[${escapeHtml(slot.courseCode)}]`
    : "";
  
  const compactClass = state.compactMode ? "course-card compact" : "course-card";
  const bgColor = getCourseColor(slot.courseName);
  
  // New layout: Name (primary) takes full width. Code moved to title.
  // We hide the code in the card to save space, but keep it in the title attribute.
  return `
    <button type="button" class="${compactClass}" data-open-slot="${escapeHtml(registryKey)}" style="border-left: 3px solid ${bgColor};" title="${escapeHtml(slot.courseName)} ${codeText}">
      <div class="course-header">
        <span class="course-name">${escapeHtml(slot.courseName)}</span>
      </div>
      
      <div class="course-body">
        <div class="meta-row" title="地点">
          ${ICONS.location}
          <span>${escapeHtml(slot.location || "待定")}</span>
        </div>
        <div class="meta-row" title="教师">
          ${ICONS.teacher}
          <span>${escapeHtml(slot.teacher || "待定")}</span>
        </div>
        <div class="meta-row" title="周次">
          ${ICONS.weeks}
          <span>${escapeHtml(slot.weeks || "")}</span>
        </div>
      </div>
    </button>
  `;
}

function parseWeeksFromText(text) {
  const raw = String(text ?? "").trim();
  if (!raw) {
    return null;
  }

  const compact = raw.replaceAll(" ", "").replaceAll("，", ",").replaceAll("至", "-");
  const numberMatches = compact.match(/\d+\s*-\s*\d+|\d+/g) || [];
  const weeks = new Set();

  for (const token of numberMatches) {
    if (token.includes("-")) {
      const [startRaw, endRaw] = token.split("-");
      const start = Number.parseInt(startRaw, 10);
      const end = Number.parseInt(endRaw, 10);
      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        continue;
      }
      const min = Math.min(start, end);
      const max = Math.max(start, end);
      for (let week = min; week <= max; week += 1) {
        if (week >= 1 && week <= 30) {
          weeks.add(week);
        }
      }
      continue;
    }

    const week = Number.parseInt(token, 10);
    if (Number.isFinite(week) && week >= 1 && week <= 30) {
      weeks.add(week);
    }
  }

  return weeks.size ? weeks : null;
}

function parseWeeksFromBitmap(bitmap) {
  const value = String(bitmap ?? "").trim();
  if (!value || !/^[01]+$/.test(value)) {
    return null;
  }

  const weeks = new Set();
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "1") {
      weeks.add(index + 1);
    }
  }
  return weeks.size ? weeks : null;
}

function formatWeeksSet(weeksSet) {
  const sorted = Array.from(weeksSet).sort((left, right) => left - right);
  if (!sorted.length) {
    return "";
  }

  const parts = [];
  let start = sorted[0];
  let previous = sorted[0];

  for (let index = 1; index <= sorted.length; index += 1) {
    const current = sorted[index];
    if (current === previous + 1) {
      previous = current;
      continue;
    }
    parts.push(start === previous ? `${start}` : `${start}-${previous}`);
    start = current;
    previous = current;
  }

  return `${parts.join(",")}周`;
}

function getParityLabel(weeksSet) {
  if (!weeksSet || !weeksSet.size) {
    return "";
  }

  let hasOdd = false;
  let hasEven = false;
  for (const week of weeksSet) {
    if (week % 2 === 1) {
      hasOdd = true;
    } else {
      hasEven = true;
    }
    if (hasOdd && hasEven) {
      return "单双周";
    }
  }

  return hasOdd ? "单周" : "双周";
}

function parseWeekFilter(text, mode) {
  const raw = String(text ?? "").trim();
  const weeks = parseWeeksFromText(raw);
  const compact = raw.replaceAll(" ", "");
  const textParity = compact.includes("单") && !compact.includes("双")
    ? "odd"
    : compact.includes("双") && !compact.includes("单")
      ? "even"
      : null;

  const parity = mode === "odd" || mode === "even" ? mode : textParity;
  return {
    weeks,
    parity,
    enabled: Boolean(weeks || parity),
    label: [raw, mode === "odd" ? "仅单周" : mode === "even" ? "仅双周" : ""]
      .filter(Boolean)
      .join(" "),
  };
}

function cloneWeekFilter(filter) {
  if (!filter) {
    return { weeks: null, parity: null, enabled: false, label: "" };
  }
  return {
    weeks: filter.weeks ? new Set(filter.weeks) : null,
    parity: filter.parity || null,
    enabled: Boolean(filter.enabled),
    label: filter.label || "",
  };
}

function applySelectedWeekNumber(filter, weekNumberText) {
  const weekNumber = Number.parseInt(String(weekNumberText || "").trim(), 10);
  if (!Number.isFinite(weekNumber) || weekNumber < 1 || weekNumber > 30) {
    return filter;
  }

  const next = cloneWeekFilter(filter);
  const selectedSet = new Set([weekNumber]);
  if (next.weeks && next.weeks.size) {
    const intersection = new Set();
    for (const value of next.weeks) {
      if (selectedSet.has(value)) {
        intersection.add(value);
      }
    }
    next.weeks = intersection;
  } else {
    next.weeks = selectedSet;
  }

  const labels = [next.label, `当前周:${weekNumber}`].filter(Boolean);
  next.label = labels.join("｜");
  next.enabled = true;
  return next;
}

function resolveSlotWeekSet(slot) {
  return parseWeeksFromBitmap(slot.weekBitmap) || parseWeeksFromText(slot.weeks);
}

function matchesWeekFilter(slot, filter) {
  if (!filter || !filter.enabled) {
    return true;
  }

  const slotWeeks = resolveSlotWeekSet(slot);
  if (!slotWeeks || !slotWeeks.size) {
    return false;
  }

  let candidateWeeks = slotWeeks;
  if (filter.weeks) {
    const intersection = new Set();
    for (const week of slotWeeks) {
      if (filter.weeks.has(week)) {
        intersection.add(week);
      }
    }
    if (!intersection.size) {
      return false;
    }
    candidateWeeks = intersection;
  }

  if (filter.parity) {
    for (const week of candidateWeeks) {
      const weekParity = week % 2 === 1 ? "odd" : "even";
      if (weekParity === filter.parity) {
        return true;
      }
    }
    return false;
  }

  return true;
}

function mergeSlotsForDisplay(slots) {
  const merged = new Map();

  for (const slot of slots) {
    const key = [
      slot.day,
      slot.period,
      slot.location,
      slot.teacher,
      slot.courseCode,
      slot.courseSeq,
      slot.courseName,
    ].join("|");

    if (!merged.has(key)) {
      merged.set(key, {
        ...slot,
        _weeksSet: new Set(),
        _weeksText: new Set(),
        _teachers: new Set(),
        _notes: new Set(),
      });
    }

    const item = merged.get(key);
    const parsedWeeks = resolveSlotWeekSet(slot);
    if (parsedWeeks && parsedWeeks.size) {
      for (const week of parsedWeeks) {
        item._weeksSet.add(week);
      }
    }

    if (slot.weeks) {
      item._weeksText.add(slot.weeks);
    }

    if (slot.teacher) {
      item._teachers.add(slot.teacher);
    }

    if (slot.note) {
      item._notes.add(slot.note);
    }
  }

  return Array.from(merged.values()).map((item) => {
    const weeks = item._weeksSet.size
      ? formatWeeksSet(item._weeksSet)
      : Array.from(item._weeksText).join(" + ");

    const teachers = Array.from(item._teachers);
    const teacher = teachers.length <= 3
      ? teachers.join(" / ")
      : `${teachers.slice(0, 3).join(" / ")} 等${teachers.length}位`;

    const notes = Array.from(item._notes);
    const note = notes.length <= 1 ? (notes[0] || "") : `多教学班(${notes.length})`;

    const weeksSet = item._weeksSet.size ? new Set(item._weeksSet) : null;
    const parityLabel = getParityLabel(weeksSet);

    const normalized = {
      ...item,
      teacher,
      weeks,
      note,
      parityLabel,
      weeksSet,
    };
    delete normalized._weeksSet;
    delete normalized._weeksText;
    delete normalized._teachers;
    delete normalized._notes;
    return normalized;
  });
}

function buildSlotMap(slots, keyword, weekFilter) {
  const lowered = keyword.trim().toLowerCase();
  const map = new Map();

  for (const slot of slots) {
    const searchable = [
      slot.courseCode,
      slot.courseSeq,
      slot.courseName,
      slot.location,
      slot.teacher,
      slot.weeks,
      slot.note,
    ]
      .join(" ")
      .toLowerCase();

    if (lowered && !searchable.includes(lowered)) {
      continue;
    }

    if (!matchesWeekFilter(slot, weekFilter)) {
      continue;
    }

    const key = `${slot.period}|${slot.day}`;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(slot);
  }

  return map;
}

function getFilteredClasses(dataset) {
  if (!dataset) {
    return [];
  }

  const keyword = state.classFilterKeyword.trim().toLowerCase();
  return dataset.classes.filter((item) => {
    const searchable = `${item.id} ${item.name}`.toLowerCase();
    if (keyword && !searchable.includes(keyword)) {
      return false;
    }

    if (state.selectedGrade && item.grade !== state.selectedGrade) {
      return false;
    }

    if (state.selectedCollege && item.collegeCode !== state.selectedCollege) {
      return false;
    }

    if (state.selectedMajor && item.majorCode !== state.selectedMajor) {
      return false;
    }

    return true;
  });
}

function toOptionList(values, emptyLabel) {
  const unique = Array.from(new Set(values.filter(Boolean)));
  unique.sort((left, right) => left.localeCompare(right, "zh-CN"));

  return [
    `<option value="">${escapeHtml(emptyLabel)}</option>`,
    ...unique.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`),
  ].join("");
}

function toOptionListByLabel(options, emptyLabel) {
  const normalized = options
    .filter((item) => item && item.value)
    .sort((left, right) => String(left.label).localeCompare(String(right.label), "zh-CN"));

  return [
    `<option value="">${escapeHtml(emptyLabel)}</option>`,
    ...normalized.map(
      (item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`,
    ),
  ].join("");
}

function toNamedOptions(classes, codeKey, nameKey, fallbackLabel) {
  const map = new Map();

  for (const item of classes) {
    const code = String(item[codeKey] ?? "").trim();
    if (!code) {
      continue;
    }

    const name = String(item[nameKey] ?? "").trim();
    if (!map.has(code)) {
      map.set(code, new Set());
    }

    if (name) {
      map.get(code).add(name);
    }
  }

  return Array.from(map.entries()).map(([code, names]) => {
    const preferredName = Array.from(names)[0] || "";
    return {
      value: code,
      label: preferredName || `${fallbackLabel}（编码 ${code}）`,
    };
  });
}

function normalizeLinkedSelections(dataset) {
  if (!dataset) {
    return;
  }

  const classes = dataset.classes;
  const keyword = state.classFilterKeyword.trim().toLowerCase();
  const byKeyword = keyword
    ? classes.filter((item) => `${item.id} ${item.name}`.toLowerCase().includes(keyword))
    : classes;

  const gradeOptions = Array.from(new Set(byKeyword.map((item) => item.grade).filter(Boolean)));
  if (state.selectedGrade && !gradeOptions.includes(state.selectedGrade)) {
    state.selectedGrade = "";
  }

  const byGrade = state.selectedGrade
    ? byKeyword.filter((item) => item.grade === state.selectedGrade)
    : byKeyword;
  const collegeOptions = Array.from(new Set(byGrade.map((item) => item.collegeCode).filter(Boolean)));
  const collegeNamedOptions = toNamedOptions(byGrade, "collegeCode", "collegeName", "未命名学院");
  if (state.selectedCollege && !collegeOptions.includes(state.selectedCollege)) {
    state.selectedCollege = "";
  }

  const byCollege = state.selectedCollege
    ? byGrade.filter((item) => item.collegeCode === state.selectedCollege)
    : byGrade;
  const majorOptions = Array.from(new Set(byCollege.map((item) => item.majorCode).filter(Boolean)));
  const majorNamedOptions = toNamedOptions(byCollege, "majorCode", "majorName", "未命名专业");
  if (state.selectedMajor && !majorOptions.includes(state.selectedMajor)) {
    state.selectedMajor = "";
  }

  gradeSelect.innerHTML = toOptionList(gradeOptions, "全部年级");
  gradeSelect.value = state.selectedGrade;
  gradeSelect.disabled = gradeOptions.length <= 1;

  collegeSelect.innerHTML = toOptionListByLabel(collegeNamedOptions, "全部学院");
  collegeSelect.value = state.selectedCollege;
  collegeSelect.disabled = collegeOptions.length <= 1;

  majorSelect.innerHTML = toOptionListByLabel(majorNamedOptions, "全部专业");
  majorSelect.value = state.selectedMajor;
  majorSelect.disabled = majorOptions.length <= 1;
}

function currentClass() {
  if (!state.dataset) {
    return null;
  }

  const filteredClasses = getFilteredClasses(state.dataset);
  if (!filteredClasses.length) {
    return null;
  }

  return (
    filteredClasses.find((item) => item.id === state.currentClassId)
    || filteredClasses[0]
  );
}

function getVisibleMergedRows(classItem, keyword, weekFilter) {
  if (!classItem) {
    return [];
  }

  const slotMap = buildSlotMap(classItem.slots, keyword, weekFilter);
  const rows = [];

  for (const period of DEFAULT_PERIODS) {
    for (const day of DAYS) {
      const key = `${period.id}|${day}`;
      const slots = slotMap.get(key) || [];
      if (!slots.length) {
        continue;
      }
      const merged = mergeSlotsForDisplay(slots);
      for (const item of merged) {
        rows.push(item);
      }
    }
  }

  return rows;
}

function renderGridTable(classItem, periods, keyword, weekFilter) {
  const slotMap = buildSlotMap(classItem.slots, keyword, weekFilter);
  const groups = groupPeriods(periods);
  const cardRegistry = new Map();
  let cardCounter = 0;

  const headerCells = DAYS.map((day) => `<th>${escapeHtml(day)}</th>`).join("");
  const rows = [];

  for (const group of groups) {
    group.periods.forEach((period, index) => {
      const sessionCell =
        index === 0
          ? `<td class="session-cell" rowspan="${group.periods.length}">${escapeHtml(group.session)}</td>`
          : "";

      const periodCell = `<td class="period-cell">${escapeHtml(period.label)}</td>`;

      const dayCells = DAYS.map((day) => {
        const key = `${period.id}|${day}`;
        const slots = slotMap.get(key) || [];

        if (!slots.length) {
          return '<td class="course-cell"><div class="empty-cell"></div></td>';
        }

        const mergedSlots = mergeSlotsForDisplay(slots);
        if (!mergedSlots.length) {
          return '<td class="course-cell"><div class="empty-cell"></div></td>';
        }

        const registryKey = `cell-${cardCounter++}`;
        cardRegistry.set(registryKey, {
          day,
          period: period.id,
          items: mergedSlots,
        });

        const visibleItems = mergedSlots.slice(0, 2);
        const hiddenCount = Math.max(0, mergedSlots.length - visibleItems.length);
        const cardsHtml = visibleItems
          .map((item) => renderCourseCard(item, registryKey))
          .join("");
        const moreButton = hiddenCount
          ? `<button type="button" class="more-courses-btn" data-open-slot="${escapeHtml(registryKey)}">+${hiddenCount} 门课</button>`
          : "";

        return `<td class="course-cell"><div class="course-stack">${cardsHtml}${moreButton}</div></td>`;
      }).join("");

      rows.push(`<tr>${sessionCell}${periodCell}${dayCells}</tr>`);
    });
  }

  return {
    html: `
      <table class="schedule-table ${state.compactMode ? "is-compact" : ""}">
        <thead>
          <tr>
            <th>时段</th>
            <th>节</th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>
          ${rows.join("")}
        </tbody>
      </table>
    `,
    cardRegistry,
  };
}

function renderLegacyTable(data, keyword = "") {
  const rows = Array.isArray(data.rows) ? data.rows : [];
  if (!rows.length) {
    tableContainer.innerHTML = '<div class="empty">没有可展示的课表数据</div>';
    return;
  }

  const headers = Array.isArray(data.headers) && data.headers.length
    ? data.headers
    : Object.keys(rows[0]);

  const lowered = keyword.trim().toLowerCase();
  const filteredRows = lowered
    ? rows.filter((row) =>
      Object.values(row)
        .join(" ")
        .toLowerCase()
        .includes(lowered))
    : rows;

  if (!filteredRows.length) {
    tableContainer.innerHTML = '<div class="empty">没有匹配的数据</div>';
    return;
  }

  const thead = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const tbody = filteredRows
    .map((row) => {
      const columns = headers
        .map((header) => `<td>${escapeHtml(row[header] ?? "")}</td>`)
        .join("");
      return `<tr>${columns}</tr>`;
    })
    .join("");

  tableContainer.innerHTML = `
    <table class="legacy-table">
      <thead><tr>${thead}</tr></thead>
      <tbody>${tbody}</tbody>
    </table>
  `;
}

function renderClassOptions(dataset) {
  normalizeLinkedSelections(dataset);

  const filteredClasses = getFilteredClasses(dataset);

  if (!filteredClasses.length) {
    classSelect.innerHTML = '<option value="">无匹配班级</option>';
    classSelect.value = "";
    classSelect.disabled = true;
    state.currentClassId = "";
    return;
  }

  classSelect.innerHTML = filteredClasses
    .map(
      (item) =>
        `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`,
    )
    .join("");

  const hasSelected = filteredClasses.some((item) => item.id === state.currentClassId);
  if (!hasSelected) {
    state.currentClassId = filteredClasses[0].id;
  }
  classSelect.value = state.currentClassId;
  classSelect.disabled = filteredClasses.length <= 1;
}

function maxWeekInDataset(dataset) {
  if (!dataset || !Array.isArray(dataset.classes)) {
    return 20;
  }

  let maxWeek = 0;
  for (const classItem of dataset.classes) {
    for (const slot of classItem.slots || []) {
      const set = resolveSlotWeekSet(slot);
      if (!set || !set.size) {
        continue;
      }
      const localMax = Math.max(...set);
      if (localMax > maxWeek) {
        maxWeek = localMax;
      }
    }
  }

  return Math.max(maxWeek, 20);
}

function renderWeekNumberOptions(dataset) {
  const maxWeek = maxWeekInDataset(dataset);
  const options = ['<option value="">全部周</option>'];
  for (let index = 1; index <= maxWeek; index += 1) {
    options.push(`<option value="${index}">第${index}周</option>`);
  }
  weekNumberSelect.innerHTML = options.join("");
  weekNumberSelect.value = state.selectedWeekNumber;
}

function refreshIcsAvailability(dataset) {
  if (!termStartInput.value && dataset?.term_start_date) {
    termStartInput.value = dataset.term_start_date;
    state.termStartDate = termStartInput.value;
  }

  const enabled = state.enableIcs && Boolean(state.termStartDate);
  exportIcsBtn.disabled = !enabled;
}

function renderGridView() {
  const dataset = state.dataset;
  const classItem = currentClass();
  if (!dataset || !classItem) {
    const emptyText = state.classFilterKeyword
      ? "没有匹配班级，请修改班级检索关键字"
      : "没有可展示的课表数据";
    tableContainer.innerHTML = `<div class="empty">${escapeHtml(emptyText)}</div>`;
    state.cardRegistry = new Map();
    state.lastRenderedRows = [];
    return;
  }

  const baseWeekFilter = parseWeekFilter(weekFilterInput.value, weekModeSelect.value);
  const weekFilter = applySelectedWeekNumber(baseWeekFilter, state.selectedWeekNumber);

  viewTitleNode.textContent = `${classItem.name}${classItem.term ? ` ${classItem.term}` : ""} 课表`;
  const rendered = renderGridTable(
    classItem,
    dataset.periods,
    searchInput.value,
    weekFilter,
  );
  
  // Render Today's Schedule
  renderTodaySchedule(classItem, dataset, weekFilter);

  tableContainer.innerHTML = rendered.html;
  state.cardRegistry = rendered.cardRegistry;
  state.lastRenderedRows = getVisibleMergedRows(classItem, searchInput.value, weekFilter);

  const updateText = formatDate(dataset.generated_at);
  const filteredClasses = getFilteredClasses(dataset);
  const filterText = weekFilter.enabled ? `｜周次筛选：${weekFilter.label}` : "";
  setStatus(
    `更新时间：${updateText}｜班级：${filteredClasses.length}/${dataset.classes.length}｜当前：${classItem.name}${filterText}｜版本：${state.metaVersion || "-"}`,
  );

  document.body.classList.toggle("compact-mode", state.compactMode);
  refreshIcsAvailability(dataset);
}

function toCsvField(value) {
  const text = String(value ?? "");
  const escaped = text.replaceAll('"', '""');
  return `"${escaped}"`;
}

function downloadFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function exportCurrentCsv() {
  const classItem = currentClass();
  if (!classItem) {
    setStatus("导出失败：无可用班级", true);
    return;
  }

  const rows = state.lastRenderedRows;
  if (!rows.length) {
    setStatus("导出失败：当前筛选结果为空", true);
    return;
  }

  const headers = [
    "班级",
    "星期",
    "节次",
    "课程编码",
    "课序号",
    "课程名",
    "教师",
    "地点",
    "周次",
    "单双周",
    "备注",
  ];

  const lines = [headers.map(toCsvField).join(",")];
  for (const item of rows) {
    const row = [
      classItem.name,
      item.day,
      item.period,
      item.courseCode,
      item.courseSeq,
      item.courseName,
      item.teacher,
      item.location,
      item.weeks,
      item.parityLabel,
      item.note,
    ];
    lines.push(row.map(toCsvField).join(","));
  }

  const fileName = `${classItem.name.replaceAll(/\s+/g, "_")}_课表.csv`;
  downloadFile(`\uFEFF${lines.join("\n")}`, fileName, "text/csv;charset=utf-8");
  setStatus(`已导出 CSV：${rows.length} 条`, false);
  showToast(`已导出 CSV：${rows.length} 条`, "success");
}

function formatIcsDateTime(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  const second = `${date.getSeconds()}`.padStart(2, "0");
  return `${year}${month}${day}T${hour}${minute}${second}`;
}

function addDays(baseDate, dayCount) {
  const next = new Date(baseDate);
  next.setDate(baseDate.getDate() + dayCount);
  return next;
}

function parseClockToDate(baseDate, clock) {
  const [hourRaw, minuteRaw] = clock.split(":");
  const date = new Date(baseDate);
  date.setHours(Number.parseInt(hourRaw, 10), Number.parseInt(minuteRaw, 10), 0, 0);
  return date;
}

function escapeIcsText(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\n", "\\n");
}

function exportCurrentIcs() {
  const classItem = currentClass();
  if (!classItem) {
    setStatus("导出失败：无可用班级", true);
    return;
  }

  if (!state.enableIcs) {
    setStatus("请先启用 ICS", true);
    return;
  }

  if (!state.termStartDate) {
    setStatus("导出 ICS 需要填写开学周一", true);
    return;
  }

  const startMonday = new Date(`${state.termStartDate}T00:00:00`);
  if (Number.isNaN(startMonday.getTime())) {
    setStatus("开学周一日期无效", true);
    return;
  }

  const rows = state.lastRenderedRows;
  if (!rows.length) {
    setStatus("导出失败：当前筛选结果为空", true);
    return;
  }

  const nowStamp = formatIcsDateTime(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//school-timetable-static//CN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  let eventCount = 0;
  rows.forEach((row, rowIndex) => {
    const dayOffset = DAY_INDEX[row.day];
    const timeRange = PERIOD_TIME_RANGE[row.period];
    const weeksSet = row.weeksSet || parseWeeksFromText(row.weeks);
    if (dayOffset === undefined || !timeRange || !weeksSet || !weeksSet.size) {
      return;
    }

    const sortedWeeks = Array.from(weeksSet).sort((left, right) => left - right);
    sortedWeeks.forEach((weekNo, weekIndex) => {
      const classDay = addDays(startMonday, (weekNo - 1) * 7 + dayOffset);
      const dtStart = parseClockToDate(classDay, timeRange.start);
      const dtEnd = parseClockToDate(classDay, timeRange.end);
      const uid = `${classItem.id}-${rowIndex}-${weekIndex}-${weekNo}@school-timetable`;

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${escapeIcsText(uid)}`);
      lines.push(`DTSTAMP:${nowStamp}`);
      lines.push(`DTSTART:${formatIcsDateTime(dtStart)}`);
      lines.push(`DTEND:${formatIcsDateTime(dtEnd)}`);
      lines.push(`SUMMARY:${escapeIcsText(row.courseName)}`);
      lines.push(`LOCATION:${escapeIcsText(row.location || "")}`);
      lines.push(`DESCRIPTION:${escapeIcsText(`班级:${classItem.name}\\n教师:${row.teacher}\\n周次:${row.weeks}`)}`);
      lines.push("END:VEVENT");
      eventCount += 1;
    });
  });

  lines.push("END:VCALENDAR");

  if (!eventCount) {
    setStatus("导出 ICS 失败：没有可转换的周次数据", true);
    return;
  }

  const fileName = `${classItem.name.replaceAll(/\s+/g, "_")}_课表.ics`;
  downloadFile(lines.join("\r\n"), fileName, "text/calendar;charset=utf-8");
  setStatus(`已导出 ICS：${eventCount} 个日程`, false);
  showToast(`已导出 ICS：${eventCount} 个日程`, "success");
}

function renderDetailItems(items) {
  if (!Array.isArray(items) || !items.length) {
    return '<div class="empty">没有课程详情</div>';
  }

  return items
    .map((item) => `
      <article class="detail-card">
        <div><strong>课程：</strong>${escapeHtml(item.courseName || "-")}</div>
        <div><strong>编码：</strong>${escapeHtml(item.courseCode || "-")}</div>
        <div><strong>课序号：</strong>${escapeHtml(item.courseSeq || "-")}</div>
        <div><strong>教师：</strong>${escapeHtml(item.teacher || "-")}</div>
        <div><strong>地点：</strong>${escapeHtml(item.location || "-")}</div>
        <div><strong>周次：</strong>${escapeHtml(item.weeks || "-")} ${escapeHtml(item.parityLabel || "")}</div>
        <div><strong>备注：</strong>${escapeHtml(item.note || "-")}</div>
      </article>
    `)
    .join("");
}

function openDetailModal(payload) {
  if (!payload || !Array.isArray(payload.items)) {
    return;
  }
  detailModalTitle.textContent = `${payload.day} ${payload.period} 节次详情`;
  detailModalBody.innerHTML = renderDetailItems(payload.items);
  detailModal.classList.remove("hidden");
  detailModal.setAttribute("aria-hidden", "false");
}

function closeDetailModal() {
  detailModal.classList.add("hidden");
  detailModal.setAttribute("aria-hidden", "true");
}

async function fetchMeta() {
  const response = await fetch(`./meta.json?ts=${Date.now()}`, {
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`./meta.json 请求失败: ${response.status}`);
  }

  const payload = await response.json();
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const version = String(payload.version ?? "").trim();
  if (!version) {
    return null;
  }

  return {
    ...payload,
    version,
  };
}

async function fetchOptionalJson(path, version = "") {
  const query = version ? `v=${encodeURIComponent(version)}` : `ts=${Date.now()}`;
  const response = await fetch(`${path}?${query}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${path} 请求失败: ${response.status}`);
  }

  return response.json();
}

async function loadTimetable() {
  showLoading();
  setStatus("正在加载课表...");

  try {
    let version = "";
    try {
      const meta = await fetchMeta();
      version = meta ? meta.version : "";
      if (meta?.term_start_date && !state.termStartDate) {
        state.termStartDate = String(meta.term_start_date);
      }
    } catch (error) {
      console.warn("load meta.json failed", error);
    }
    state.metaVersion = version;

    // Try to load from cache
    const CACHE_KEY_DATA = "timetable_data";
    const CACHE_KEY_VERSION = "timetable_version";
    
    if (version) {
      const cachedVersion = localStorage.getItem(CACHE_KEY_VERSION);
      const cachedDataStr = localStorage.getItem(CACHE_KEY_DATA);
      
      if (cachedVersion === version && cachedDataStr) {
        try {
          const cachedRaw = JSON.parse(cachedDataStr);
          const normalized = normalizeDataset(cachedRaw);
          if (normalized) {
            state.dataset = normalized;
            state.legacyData = null;
            if (!state.termStartDate && normalized.term_start_date) {
              state.termStartDate = normalized.term_start_date;
            }
            renderClassOptions(normalized);
            renderWeekNumberOptions(normalized);
            renderGridView();
            scheduleHashSync();
            setStatus(`已加载本地缓存 (v${version})`);
            hideLoading();
            return;
          }
        } catch (e) {
          console.warn("Cache parse failed", e);
        }
      }
    }

    const multi = await fetchOptionalJson("./timetables.json", version);
    const normalizedMulti = normalizeDataset(multi);

    if (normalizedMulti) {
      state.dataset = normalizedMulti;
      state.legacyData = null;
      if (!state.termStartDate && normalizedMulti.term_start_date) {
        state.termStartDate = normalizedMulti.term_start_date;
      }
      
      // Save to cache
      if (version) {
        try {
          localStorage.setItem(CACHE_KEY_VERSION, version);
          localStorage.setItem(CACHE_KEY_DATA, JSON.stringify(multi));
        } catch (e) {
          console.warn("Cache save failed (quota exceeded?)", e);
        }
      }

      renderClassOptions(normalizedMulti);
      renderWeekNumberOptions(normalizedMulti);
      renderGridView();
      scheduleHashSync();
      hideLoading();
      return;
    }

    const single = await fetchOptionalJson("./timetable.json", version);
    const normalizedSingle = normalizeDataset(single);

    if (normalizedSingle) {
      state.dataset = normalizedSingle;
      state.legacyData = null;
      if (!state.termStartDate && normalizedSingle.term_start_date) {
        state.termStartDate = normalizedSingle.term_start_date;
      }

      // Save to cache
      if (version) {
        try {
          localStorage.setItem(CACHE_KEY_VERSION, version);
          localStorage.setItem(CACHE_KEY_DATA, JSON.stringify(single));
        } catch (e) {
          console.warn("Cache save failed", e);
        }
      }

      renderClassOptions(normalizedSingle);
      renderWeekNumberOptions(normalizedSingle);
      renderGridView();
      scheduleHashSync();
      hideLoading();
      return;
    }

    if (single && Array.isArray(single.rows)) {
      state.dataset = null;
      state.legacyData = single;
      classSelect.innerHTML = '<option value="legacy">单班视图</option>';
      classSelect.disabled = true;
      viewTitleNode.textContent = "学校课表";
      renderLegacyTable(single, searchInput.value);

      const updateText = formatDate(single.generated_at);
      const count = Array.isArray(single.rows) ? single.rows.length : 0;
      setStatus(`更新时间：${updateText}，共 ${count} 条记录｜版本：${state.metaVersion || "-"}`);
      hideLoading();
      return;
    }

    throw new Error("未找到可用课表文件（timetables.json 或 timetable.json）");
  } catch (error) {
    setStatus(`加载失败：${error.message}`, true);
    tableContainer.innerHTML = '<div class="empty">无法加载课表数据</div>';
    hideLoading();
  }
}

tableContainer.addEventListener("click", (event) => {
  const target = event.target.closest("[data-open-slot]");
  if (!target) {
    return;
  }

  const key = target.getAttribute("data-open-slot");
  if (!key) {
    return;
  }
  const payload = state.cardRegistry.get(key);
  if (!payload) {
    return;
  }
  openDetailModal(payload);
});

detailModalBackdrop.addEventListener("click", closeDetailModal);
detailModalClose.addEventListener("click", closeDetailModal);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !detailModal.classList.contains("hidden")) {
    closeDetailModal();
  }
});

searchInput.addEventListener("input", () => {
  if (state.dataset) {
    renderGridView();
    scheduleHashSync();
    return;
  }

  if (state.legacyData) {
    renderLegacyTable(state.legacyData, searchInput.value);
  }
  scheduleHashSync();
});

classFilterInput.addEventListener("input", () => {
  state.classFilterKeyword = classFilterInput.value;
  if (state.classFilterDebounceTimer) {
    clearTimeout(state.classFilterDebounceTimer);
  }

  state.classFilterDebounceTimer = window.setTimeout(() => {
    state.classFilterDebounceTimer = null;
    if (state.dataset) {
      renderClassOptions(state.dataset);
      renderGridView();
    }
    scheduleHashSync();
  }, 180);
});

weekFilterInput.addEventListener("input", () => {
  if (state.dataset) {
    renderGridView();
  } else if (state.legacyData) {
    renderLegacyTable(state.legacyData, searchInput.value);
  }
  scheduleHashSync();
});

weekNumberSelect.addEventListener("change", () => {
  state.selectedWeekNumber = weekNumberSelect.value;
  if (state.dataset) {
    renderGridView();
  }
  scheduleHashSync();
});

classSelect.addEventListener("change", () => {
  state.currentClassId = classSelect.value;
  if (state.dataset) {
    renderGridView();
  }
  scheduleHashSync();
});

gradeSelect.addEventListener("change", () => {
  state.selectedGrade = gradeSelect.value;
  state.selectedCollege = "";
  state.selectedMajor = "";
  if (state.dataset) {
    renderClassOptions(state.dataset);
    renderGridView();
  }
  scheduleHashSync();
});

collegeSelect.addEventListener("change", () => {
  state.selectedCollege = collegeSelect.value;
  state.selectedMajor = "";
  if (state.dataset) {
    renderClassOptions(state.dataset);
    renderGridView();
  }
  scheduleHashSync();
});

majorSelect.addEventListener("change", () => {
  state.selectedMajor = majorSelect.value;
  if (state.dataset) {
    renderClassOptions(state.dataset);
    renderGridView();
  }
  scheduleHashSync();
});

weekModeSelect.addEventListener("change", () => {
  if (state.dataset) {
    renderGridView();
  }
  scheduleHashSync();
});

compactToggle.addEventListener("change", () => {
  state.compactMode = compactToggle.checked;
  if (state.dataset) {
    renderGridView();
  }
  scheduleHashSync();
});

enableIcsToggle.addEventListener("change", () => {
  state.enableIcs = enableIcsToggle.checked;
  refreshIcsAvailability(state.dataset);
  scheduleHashSync();
});

termStartInput.addEventListener("change", () => {
  state.termStartDate = termStartInput.value;
  refreshIcsAvailability(state.dataset);
  scheduleHashSync();
});

exportCsvBtn.addEventListener("click", exportCurrentCsv);
exportIcsBtn.addEventListener("click", exportCurrentIcs);

reloadButton.addEventListener("click", () => {
  loadTimetable();
});

window.addEventListener("hashchange", () => {
  applyHashStateToControls();
  if (state.dataset) {
    renderClassOptions(state.dataset);
    renderWeekNumberOptions(state.dataset);
    renderGridView();
  }
});

applyHashStateToControls();
loadTimetable();
