const statusNode = document.getElementById("status");
const viewTitleNode = document.getElementById("viewTitle");
const tableContainer = document.getElementById("tableContainer");
const searchInput = document.getElementById("searchInput");
const classSelect = document.getElementById("classSelect");
const classFilterInput = document.getElementById("classFilterInput");
const weekFilterInput = document.getElementById("weekFilterInput");
const reloadButton = document.getElementById("reloadBtn");

const DAYS = [
  "星期一",
  "星期二",
  "星期三",
  "星期四",
  "星期五",
  "星期六",
  "星期日",
];

const DEFAULT_PERIODS = [
  { id: "1-2", label: "1-2", session: "上午" },
  { id: "3-4", label: "3-4", session: "上午" },
  { id: "5-6", label: "5-6", session: "下午" },
  { id: "7-8", label: "7-8", session: "下午" },
  { id: "9-11", label: "9-11", session: "晚上" },
];

const state = {
  dataset: null,
  legacyData: null,
  currentClassId: "",
  metaVersion: "",
  classFilterKeyword: "",
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
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

function normalizePeriods(periods) {
  if (!Array.isArray(periods) || !periods.length) {
    return DEFAULT_PERIODS;
  }

  const normalized = periods
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const id = String(item.id ?? item.label ?? item.period ?? "").trim();
      if (!id) {
        return null;
      }

      return {
        id,
        label: String(item.label ?? id),
        session: String(item.session ?? "未分组"),
      };
    })
    .filter(Boolean);

  return normalized.length ? normalized : DEFAULT_PERIODS;
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
      const period = String(slot.period ?? slot.section ?? slot.time ?? "").trim();
      const courseName = String(slot.courseName ?? slot.course ?? "").trim();

      if (!day || !period || !courseName) {
        return null;
      }

      return {
        day,
        period,
        courseCode: String(slot.courseCode ?? slot.code ?? "").trim(),
        courseName,
        teacher: String(slot.teacher ?? "").trim(),
        location: String(slot.location ?? slot.room ?? "").trim(),
        weeks: String(slot.weeks ?? slot.week ?? "").trim(),
        note: String(slot.note ?? "").trim(),
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

function renderCourseCard(slot) {
  const codeText = slot.courseCode
    ? `[${escapeHtml(slot.courseCode)}]`
    : "[未设置编码]";
  const detailLine = [slot.teacher, slot.weeks, slot.note].filter(Boolean).join(" ");

  return `
    <article class="course-card">
      <div class="course-code">${codeText}</div>
      <div class="course-name">${escapeHtml(slot.courseName)}</div>
      <div class="course-meta">${escapeHtml(slot.location || "地点待补充")}</div>
      <div class="course-meta-sub">${escapeHtml(detailLine || "信息待补充")}</div>
    </article>
  `;
}

function parseWeekFilter(text) {
  const raw = String(text ?? "").trim();
  if (!raw) {
    return {
      weeks: null,
      parity: null,
      enabled: false,
      label: "",
    };
  }

  const compact = raw.replaceAll(" ", "").replaceAll("，", ",").replaceAll("至", "-");
  const parity = compact.includes("单") && !compact.includes("双")
    ? "odd"
    : compact.includes("双") && !compact.includes("单")
      ? "even"
      : null;

  const numberMatches = compact.match(/\d+\s*-\s*\d+|\d+/g) || [];
  const weeksSet = new Set();

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
          weeksSet.add(week);
        }
      }
      continue;
    }

    const week = Number.parseInt(token, 10);
    if (Number.isFinite(week) && week >= 1 && week <= 30) {
      weeksSet.add(week);
    }
  }

  return {
    weeks: weeksSet.size ? weeksSet : null,
    parity,
    enabled: Boolean(parity || weeksSet.size),
    label: raw,
  };
}

function parseSlotWeeks(text) {
  const raw = String(text ?? "").trim();
  if (!raw) {
    return { weeks: null, parity: null };
  }

  const compact = raw.replaceAll(" ", "").replaceAll("，", ",").replaceAll("至", "-");
  const parity = compact.includes("单") && !compact.includes("双")
    ? "odd"
    : compact.includes("双") && !compact.includes("单")
      ? "even"
      : null;

  const numberMatches = compact.match(/\d+\s*-\s*\d+|\d+/g) || [];
  const weeksSet = new Set();

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
          weeksSet.add(week);
        }
      }
      continue;
    }

    const week = Number.parseInt(token, 10);
    if (Number.isFinite(week) && week >= 1 && week <= 30) {
      weeksSet.add(week);
    }
  }

  return {
    weeks: weeksSet.size ? weeksSet : null,
    parity,
  };
}

function matchesWeekFilter(slot, filter) {
  if (!filter || !filter.enabled) {
    return true;
  }

  const slotWeeks = parseSlotWeeks(slot.weeks);
  const hasWeekSet = Boolean(slotWeeks.weeks && slotWeeks.weeks.size);
  const hasParity = Boolean(slotWeeks.parity);

  if (!hasWeekSet && !hasParity) {
    return false;
  }

  const activeWeeks = filter.weeks;
  if (activeWeeks && hasWeekSet) {
    let intersects = false;
    for (const week of activeWeeks) {
      if (slotWeeks.weeks.has(week)) {
        intersects = true;
        break;
      }
    }
    if (!intersects) {
      return false;
    }
  }

  if (activeWeeks && !hasWeekSet && hasParity) {
    let parityMatch = false;
    for (const week of activeWeeks) {
      const weekParity = week % 2 === 1 ? "odd" : "even";
      if (weekParity === slotWeeks.parity) {
        parityMatch = true;
        break;
      }
    }
    if (!parityMatch) {
      return false;
    }
  }

  if (filter.parity && hasWeekSet) {
    let parityMatch = false;
    for (const week of slotWeeks.weeks) {
      const weekParity = week % 2 === 1 ? "odd" : "even";
      if (weekParity === filter.parity) {
        parityMatch = true;
        break;
      }
    }
    if (!parityMatch) {
      return false;
    }
  }

  if (filter.parity && !hasWeekSet && hasParity && slotWeeks.parity !== filter.parity) {
    return false;
  }

  return true;
}

function buildSlotMap(slots, keyword, weekFilter) {
  const lowered = keyword.trim().toLowerCase();
  const map = new Map();

  for (const slot of slots) {
    const searchable = [
      slot.courseCode,
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
  if (!keyword) {
    return dataset.classes;
  }

  return dataset.classes.filter((item) => {
    const searchable = `${item.id} ${item.name}`.toLowerCase();
    return searchable.includes(keyword);
  });
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
    filteredClasses.find((item) => item.id === state.currentClassId) ||
    filteredClasses[0]
  );
}

function renderGridTable(classItem, periods, keyword, weekFilter) {
  const slotMap = buildSlotMap(classItem.slots, keyword, weekFilter);
  const groups = groupPeriods(periods);

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

        const cards = slots.map((slot) => renderCourseCard(slot)).join("");
        return `<td class="course-cell"><div class="course-stack">${cards}</div></td>`;
      }).join("");

      rows.push(`<tr>${sessionCell}${periodCell}${dayCells}</tr>`);
    });
  }

  return `
    <table class="schedule-table">
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
  `;
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
          .includes(lowered),
      )
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

function renderGridView() {
  const dataset = state.dataset;
  const classItem = currentClass();
  if (!dataset || !classItem) {
    const emptyText = state.classFilterKeyword
      ? "没有匹配班级，请修改班级检索关键字"
      : "没有可展示的课表数据";
    tableContainer.innerHTML = `<div class="empty">${escapeHtml(emptyText)}</div>`;
    return;
  }

  const weekFilter = parseWeekFilter(weekFilterInput.value);

  viewTitleNode.textContent = `${classItem.name}${classItem.term ? ` ${classItem.term}` : ""} 课表`;
  tableContainer.innerHTML = renderGridTable(
    classItem,
    dataset.periods,
    searchInput.value,
    weekFilter,
  );

  const updateText = formatDate(dataset.generated_at);
  const filteredClasses = getFilteredClasses(dataset);
  const filterText = weekFilter.enabled ? `｜周次筛选：${weekFilter.label}` : "";
  setStatus(
    `更新时间：${updateText}｜班级：${filteredClasses.length}/${dataset.classes.length}｜当前：${classItem.name}${filterText}｜版本：${state.metaVersion || "-"}`,
  );
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
  setStatus("正在加载课表...");

  try {
    let version = "";
    try {
      const meta = await fetchMeta();
      version = meta ? meta.version : "";
    } catch (error) {
      console.warn("load meta.json failed", error);
    }
    state.metaVersion = version;

    const multi = await fetchOptionalJson("./timetables.json", version);
    const normalizedMulti = normalizeDataset(multi);

    if (normalizedMulti) {
      state.dataset = normalizedMulti;
      state.legacyData = null;
      renderClassOptions(normalizedMulti);
      renderGridView();
      return;
    }

    const single = await fetchOptionalJson("./timetable.json", version);
    const normalizedSingle = normalizeDataset(single);

    if (normalizedSingle) {
      state.dataset = normalizedSingle;
      state.legacyData = null;
      renderClassOptions(normalizedSingle);
      renderGridView();
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
      return;
    }

    throw new Error("未找到可用课表文件（timetables.json 或 timetable.json）");
  } catch (error) {
    setStatus(`加载失败：${error.message}`, true);
    tableContainer.innerHTML = '<div class="empty">无法加载课表数据</div>';
  }
}

searchInput.addEventListener("input", () => {
  if (state.dataset) {
    renderGridView();
    return;
  }

  if (state.legacyData) {
    renderLegacyTable(state.legacyData, searchInput.value);
  }
});

classFilterInput.addEventListener("input", () => {
  state.classFilterKeyword = classFilterInput.value;

  if (state.dataset) {
    renderClassOptions(state.dataset);
    renderGridView();
  }
});

weekFilterInput.addEventListener("input", () => {
  if (state.dataset) {
    renderGridView();
    return;
  }

  if (state.legacyData) {
    renderLegacyTable(state.legacyData, searchInput.value);
  }
});

classSelect.addEventListener("change", () => {
  state.currentClassId = classSelect.value;
  if (state.dataset) {
    renderGridView();
  }
});

reloadButton.addEventListener("click", () => {
  loadTimetable();
});

loadTimetable();
