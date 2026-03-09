import { DAYS, ICONS } from "./constants.js";
import {
  statusNode, viewTitleNode, tableContainer, todaySchedule,
  searchInput, classSelect, quickClassSelect, gradeSelect, collegeSelect,
  majorSelect, classFilterInput, weekFilterInput, weekNumberSelect,
  weekModeSelect, favoriteClassBtn, exportIcsBtn, termStartInput,
  detailModal, detailModalTitle, detailModalBody, toastContainer, loadingOverlay,
} from "./dom.js";
import {
  escapeHtml, formatDate, getCourseColor, getTodayLabel,
  getSessionLabelForPeriod, parseWeekFilter, applySelectedWeekNumber,
  getWeekNumber,
} from "./utils.js";
import {
  state, scheduleHashSync, isFavoriteClassId, rememberRecentClass,
  persistFavoriteClassIds,
} from "./state.js";
import {
  groupPeriods, buildSlotMap, mergeSlotsForDisplay, getFilteredClasses,
  currentClass, getVisibleMergedRows, maxWeekInDataset,
  toOptionList, toOptionListByLabel, toNamedOptions,
} from "./data.js";

// ===== UI Helpers =====

export function setStatus(text, isError = false) {
  statusNode.textContent = text;
  statusNode.style.color = isError ? "#ff8c8c" : "var(--text-secondary)";
  if (isError) showToast(text, "error");
}

export function showToast(message, type = "info") {
  if (!toastContainer) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = "fadeOut 0.3s forwards";
    toast.addEventListener("animationend", () => toast.remove());
  }, 3000);
}

export function showLoading() {
  if (loadingOverlay) loadingOverlay.classList.add("visible");
}

export function hideLoading() {
  if (loadingOverlay) loadingOverlay.classList.remove("visible");
}

// ===== Linked Filter Selectors =====

function normalizeLinkedSelections(dataset) {
  if (!dataset) return;
  const classes = dataset.classes;
  const keyword = state.classFilterKeyword.trim().toLowerCase();
  const byKeyword = keyword
    ? classes.filter((item) => `${item.id} ${item.name}`.toLowerCase().includes(keyword))
    : classes;

  const gradeOptions = Array.from(new Set(byKeyword.map((item) => item.grade).filter(Boolean)));
  if (state.selectedGrade && !gradeOptions.includes(state.selectedGrade)) state.selectedGrade = "";

  const byGrade = state.selectedGrade ? byKeyword.filter((item) => item.grade === state.selectedGrade) : byKeyword;
  const collegeOptions = Array.from(new Set(byGrade.map((item) => item.collegeCode).filter(Boolean)));
  const collegeNamedOptions = toNamedOptions(byGrade, "collegeCode", "collegeName", "未命名学院");
  if (state.selectedCollege && !collegeOptions.includes(state.selectedCollege)) state.selectedCollege = "";

  const byCollege = state.selectedCollege ? byGrade.filter((item) => item.collegeCode === state.selectedCollege) : byGrade;
  const majorOptions = Array.from(new Set(byCollege.map((item) => item.majorCode).filter(Boolean)));
  const majorNamedOptions = toNamedOptions(byCollege, "majorCode", "majorName", "未命名专业");
  if (state.selectedMajor && !majorOptions.includes(state.selectedMajor)) state.selectedMajor = "";

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

// ===== Class Options =====

export function renderClassOptions(dataset) {
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
    .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`)
    .join("");

  if (!filteredClasses.some((item) => item.id === state.currentClassId)) {
    state.currentClassId = filteredClasses[0].id;
  }
  classSelect.value = state.currentClassId;
  classSelect.disabled = filteredClasses.length <= 1;
}

export function renderWeekNumberOptions(dataset) {
  const maxWeek = maxWeekInDataset(dataset);
  const options = ['<option value="">全部周</option>'];
  for (let index = 1; index <= maxWeek; index += 1) {
    options.push(`<option value="${index}">第${index}周</option>`);
  }
  weekNumberSelect.innerHTML = options.join("");
  weekNumberSelect.value = state.selectedWeekNumber;
}

export function renderQuickClassOptions(dataset = state.dataset) {
  if (!quickClassSelect) return;
  const classes = Array.isArray(dataset?.classes) ? dataset.classes : [];
  const classMap = new Map(classes.map((item) => [item.id, item]));
  const favoriteItems = state.favoriteClassIds.map((id) => classMap.get(id)).filter(Boolean);
  const favoriteIds = new Set(favoriteItems.map((item) => item.id));
  const recentItems = state.recentClassIds
    .map((id) => classMap.get(id))
    .filter((item) => item && !favoriteIds.has(item.id));

  const options = ['<option value="">收藏 / 最近访问</option>'];
  if (favoriteItems.length) {
    options.push(`<optgroup label="收藏班级">${favoriteItems
      .map((item) => `<option value="${escapeHtml(item.id)}">★ ${escapeHtml(item.name)}</option>`)
      .join("")}</optgroup>`);
  }
  if (recentItems.length) {
    options.push(`<optgroup label="最近访问">${recentItems
      .map((item) => `<option value="${escapeHtml(item.id)}">🕘 ${escapeHtml(item.name)}</option>`)
      .join("")}</optgroup>`);
  }

  quickClassSelect.innerHTML = options.join("");
  quickClassSelect.value = "";
  quickClassSelect.disabled = favoriteItems.length === 0 && recentItems.length === 0;
}

export function renderFavoriteButtonState() {
  if (!favoriteClassBtn) return;
  const classItem = currentClass();
  if (!state.dataset || !classItem) {
    favoriteClassBtn.disabled = true;
    favoriteClassBtn.textContent = "收藏当前班级";
    favoriteClassBtn.classList.remove("is-active");
    return;
  }
  const active = isFavoriteClassId(classItem.id);
  favoriteClassBtn.disabled = false;
  favoriteClassBtn.textContent = active ? "取消收藏当前班级" : "收藏当前班级";
  favoriteClassBtn.classList.toggle("is-active", active);
}

// ===== Course Card =====

function renderCourseCard(slot, registryKey) {
  const codeText = slot.courseCode ? `[${escapeHtml(slot.courseCode)}]` : "";
  const periodText = slot.period ? ` · ${escapeHtml(slot.period)}` : "";
  const weeksText = slot.weeks ? ` · ${escapeHtml(slot.weeks)}` : "";
  const periodSummary = slot.period
    ? [slot.period, getSessionLabelForPeriod(slot.period)].filter(Boolean).join(" · ")
    : "";
  const compactClass = state.compactMode ? "course-card compact" : "course-card";
  const bgColor = getCourseColor(slot.courseName);

  const courseMetaHtml = state.compactMode
    ? `${periodSummary ? `<div class="meta-row meta-row--period" title="节次">${ICONS.period}<span>${escapeHtml(periodSummary)}</span></div>` : ""}
       <div class="meta-row" title="教师">${ICONS.teacher}<span>${escapeHtml(slot.teacher || "待定")}</span></div>
       <div class="meta-row" title="地点">${ICONS.location}<span>${escapeHtml(slot.location || "待定")}</span></div>`
    : `<div class="meta-row" title="地点">${ICONS.location}<span>${escapeHtml(slot.location || "待定")}</span></div>
       <div class="meta-row" title="教师">${ICONS.teacher}<span>${escapeHtml(slot.teacher || "待定")}</span></div>
       <div class="meta-row meta-row--weeks" title="周次">${ICONS.weeks}<span>${escapeHtml(slot.weeks || "")}</span></div>`;

  return `
    <button type="button" class="${compactClass}" data-open-slot="${escapeHtml(registryKey)}" style="border-left: 3px solid ${bgColor};" title="${escapeHtml(slot.courseName)} ${codeText}${periodText}${weeksText}">
      <div class="course-header"><span class="course-name">${escapeHtml(slot.courseName)}</span></div>
      <div class="course-body">${courseMetaHtml}</div>
    </button>`;
}

// ===== Grid Table =====

function renderGridTable(classItem, periods, keyword, weekFilter) {
  const slotMap = buildSlotMap(classItem.slots, keyword, weekFilter);
  const groups = groupPeriods(periods);
  const cardRegistry = new Map();
  let cardCounter = 0;
  const todayLabel = getTodayLabel();

  const headerCells = DAYS
    .map((day) => `<th class="${day === todayLabel ? "is-today-column" : ""}">${escapeHtml(day)}</th>`)
    .join("");
  const rows = [];

  for (const group of groups) {
    group.periods.forEach((period, index) => {
      const sessionCell = index === 0
        ? `<td class="session-cell" rowspan="${group.periods.length}">${escapeHtml(group.session)}</td>`
        : "";
      const periodCell = `<td class="period-cell">${escapeHtml(period.label)}</td>`;

      const dayCells = DAYS.map((day) => {
        const key = `${period.id}|${day}`;
        const slots = slotMap.get(key) || [];
        const todayClass = day === todayLabel ? " is-today-column" : "";

        if (!slots.length) return `<td class="course-cell${todayClass}"><div class="empty-cell"></div></td>`;

        const mergedSlots = mergeSlotsForDisplay(slots);
        if (!mergedSlots.length) return `<td class="course-cell${todayClass}"><div class="empty-cell"></div></td>`;

        const registryKey = `cell-${cardCounter++}`;
        cardRegistry.set(registryKey, { day, period: period.id, items: mergedSlots });

        const visibleItems = mergedSlots.slice(0, 2);
        const hiddenCount = Math.max(0, mergedSlots.length - visibleItems.length);
        const cardsHtml = visibleItems.map((item) => renderCourseCard(item, registryKey)).join("");
        const moreButton = hiddenCount
          ? `<button type="button" class="more-courses-btn" data-open-slot="${escapeHtml(registryKey)}">+${hiddenCount} 门课</button>`
          : "";

        return `<td class="course-cell${todayClass}"><div class="course-stack">${cardsHtml}${moreButton}</div></td>`;
      }).join("");

      rows.push(`<tr>${sessionCell}${periodCell}${dayCells}</tr>`);
    });
  }

  return {
    html: `<table class="schedule-table ${state.compactMode ? "is-compact" : ""}">
      <thead><tr><th>时段</th><th>节</th>${headerCells}</tr></thead>
      <tbody>${rows.join("")}</tbody></table>`,
    cardRegistry,
  };
}

// ===== Today Schedule =====

function renderTodaySchedule(classItem, dataset, weekFilter) {
  if (!classItem || !dataset) {
    todaySchedule.classList.add("hidden");
    return;
  }

  const todayLabel = getTodayLabel();
  const todayItems = getVisibleMergedRows(classItem, "", weekFilter, todayLabel);

  if (!todayItems.length) {
    todaySchedule.innerHTML = `
      <div class="today-empty">
        <div class="today-header">📅 今日日程 (${todayLabel})</div>
        <div class="today-content">今日无课，好好休息！</div>
      </div>`;
    todaySchedule.classList.remove("hidden");
    return;
  }

  const cardsHtml = todayItems.map((item) => {
    const color = getCourseColor(item.courseName);
    return `
      <div class="today-card" style="border-left-color: ${color}">
        <div class="today-time">
          <span class="period-badge">${escapeHtml(item.period || "-")}</span>
          <span class="session-label">${escapeHtml(getSessionLabelForPeriod(item.period))}</span>
        </div>
        <div class="today-info">
          <div class="today-course">${escapeHtml(item.courseName)}</div>
          <div class="today-meta">
            <span class="meta-item">📍 ${escapeHtml(item.location || "未知")}</span>
            <span class="meta-item">👤 ${escapeHtml(item.teacher || "待定")}</span>
            ${item.weeks ? `<span class="meta-item">📅 ${escapeHtml(item.weeks)}</span>` : ""}
          </div>
        </div>
      </div>`;
  }).join("");

  todaySchedule.innerHTML = `
    <div class="today-container">
      <div class="today-header">📅 今日日程 (${todayLabel})</div>
      <div class="today-grid">${cardsHtml}</div>
    </div>`;
  todaySchedule.classList.remove("hidden");
}

// ===== Legacy Table =====

export function renderLegacyTable(data, keyword = "") {
  const rows = Array.isArray(data.rows) ? data.rows : [];
  if (!rows.length) {
    tableContainer.innerHTML = '<div class="empty">没有可展示的课表数据</div>';
    return;
  }

  const headers = Array.isArray(data.headers) && data.headers.length ? data.headers : Object.keys(rows[0]);
  const lowered = keyword.trim().toLowerCase();
  const filteredRows = lowered
    ? rows.filter((row) => Object.values(row).join(" ").toLowerCase().includes(lowered))
    : rows;

  if (!filteredRows.length) {
    tableContainer.innerHTML = '<div class="empty">没有匹配的数据</div>';
    return;
  }

  const thead = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const tbody = filteredRows.map((row) => {
    const columns = headers.map((header) => `<td>${escapeHtml(row[header] ?? "")}</td>`).join("");
    return `<tr>${columns}</tr>`;
  }).join("");

  tableContainer.innerHTML = `<table class="legacy-table"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
}

// ===== Detail Modal =====

function renderDetailItems(items) {
  if (!Array.isArray(items) || !items.length) return '<div class="empty">没有课程详情</div>';
  return items.map((item) => `
    <article class="detail-card">
      <div><strong>课程：</strong>${escapeHtml(item.courseName || "-")}</div>
      <div><strong>节次：</strong>${escapeHtml(item.period || "-")}</div>
      <div><strong>编码：</strong>${escapeHtml(item.courseCode || "-")}</div>
      <div><strong>课序号：</strong>${escapeHtml(item.courseSeq || "-")}</div>
      <div><strong>教师：</strong>${escapeHtml(item.teacher || "-")}</div>
      <div><strong>地点：</strong>${escapeHtml(item.location || "-")}</div>
      <div><strong>周次：</strong>${escapeHtml(item.weeks || "-")} ${escapeHtml(item.parityLabel || "")}</div>
      <div><strong>备注：</strong>${escapeHtml(item.note || "-")}</div>
    </article>`).join("");
}

export function openDetailModal(payload) {
  if (!payload || !Array.isArray(payload.items)) return;
  const actualPeriods = Array.from(new Set(payload.items.map((item) => item.period).filter(Boolean))).join(" / ");
  detailModalTitle.textContent = actualPeriods && actualPeriods !== payload.period
    ? `${payload.day} ${payload.period}（实际 ${actualPeriods}）详情`
    : `${payload.day} ${payload.period} 节次详情`;
  detailModalBody.innerHTML = renderDetailItems(payload.items);
  detailModal.classList.remove("hidden");
  detailModal.setAttribute("aria-hidden", "false");
}

export function closeDetailModal() {
  detailModal.classList.add("hidden");
  detailModal.setAttribute("aria-hidden", "true");
}

// ===== ICS Availability =====

export function refreshIcsAvailability(dataset) {
  if (!termStartInput.value && dataset?.term_start_date) {
    termStartInput.value = dataset.term_start_date;
    state.termStartDate = termStartInput.value;
  }
  exportIcsBtn.disabled = !(state.enableIcs && Boolean(state.termStartDate));
}

// ===== Main Grid View =====

export function renderGridView() {
  const dataset = state.dataset;
  const classItem = currentClass();

  if (!dataset || !classItem) {
    const emptyText = state.classFilterKeyword
      ? "没有匹配班级，请修改班级检索关键字" : "没有可展示的课表数据";
    tableContainer.innerHTML = `<div class="empty">${escapeHtml(emptyText)}</div>`;
    state.cardRegistry = new Map();
    state.lastRenderedRows = [];
    renderQuickClassOptions(dataset);
    renderFavoriteButtonState();
    return;
  }

  if (state.lastVisitedClassId !== classItem.id) {
    state.lastVisitedClassId = classItem.id;
    rememberRecentClass(classItem.id);
  }

  const baseWeekFilter = parseWeekFilter(weekFilterInput.value, weekModeSelect.value);
  const weekFilter = applySelectedWeekNumber(baseWeekFilter, state.selectedWeekNumber);

  viewTitleNode.textContent = `${classItem.name}${classItem.term ? ` ${classItem.term}` : ""} 课表`;
  const rendered = renderGridTable(classItem, dataset.periods, searchInput.value, weekFilter);
  renderTodaySchedule(classItem, dataset, weekFilter);

  tableContainer.innerHTML = rendered.html;
  state.cardRegistry = rendered.cardRegistry;
  state.lastRenderedRows = getVisibleMergedRows(classItem, searchInput.value, weekFilter);

  const updateText = formatDate(dataset.generated_at);
  const filteredClasses = getFilteredClasses(dataset);
  const filterText = weekFilter.enabled ? `｜周次筛选：${weekFilter.label}` : "";
  setStatus(`更新时间：${updateText}｜班级：${filteredClasses.length}/${dataset.classes.length}｜当前：${classItem.name}${filterText}｜版本：${state.metaVersion || "-"}`);

  document.body.classList.toggle("compact-mode", state.compactMode);
  refreshIcsAvailability(dataset);
  renderQuickClassOptions(dataset);
  renderFavoriteButtonState();
}

// ===== Class Actions =====

export function activateClassById(classId) {
  const dataset = state.dataset;
  const classItem = findClassById(dataset, classId);
  if (!dataset || !classItem) return false;

  state.classFilterKeyword = "";
  classFilterInput.value = "";
  state.selectedGrade = classItem.grade || "";
  state.selectedCollege = classItem.collegeCode || "";
  state.selectedMajor = classItem.majorCode || "";
  state.currentClassId = classItem.id;

  renderClassOptions(dataset);
  renderGridView();
  scheduleHashSync();
  return true;
}

export function toggleFavoriteCurrentClass() {
  const classItem = currentClass();
  if (!classItem) {
    setStatus("当前没有可收藏的班级", true);
    return;
  }

  if (isFavoriteClassId(classItem.id)) {
    state.favoriteClassIds = state.favoriteClassIds.filter((item) => item !== classItem.id);
    persistFavoriteClassIds();
    renderQuickClassOptions(state.dataset);
    renderFavoriteButtonState();
    showToast(`已取消收藏：${classItem.name}`, "info");
    return;
  }

  state.favoriteClassIds = [classItem.id, ...state.favoriteClassIds.filter((item) => item !== classItem.id)];
  persistFavoriteClassIds();
  renderQuickClassOptions(state.dataset);
  renderFavoriteButtonState();
  showToast(`已收藏：${classItem.name}`, "success");
}

export function jumpToCurrentWeek() {
  if (!state.termStartDate) {
    setStatus("请先填写开学周一，再跳到本周", true);
    termStartInput.focus();
    return;
  }

  const currentWeek = getWeekNumber(new Date(), state.termStartDate);
  const maxWeek = state.dataset ? maxWeekInDataset(state.dataset) : 30;
  if (!Number.isFinite(currentWeek) || currentWeek < 1 || currentWeek > maxWeek) {
    setStatus(`当前日期不在有效学期周范围内（1-${maxWeek}周）`, true);
    return;
  }

  state.selectedWeekNumber = String(currentWeek);
  weekNumberSelect.value = state.selectedWeekNumber;
  if (state.dataset) renderGridView();
  scheduleHashSync();
  showToast(`已定位到第${currentWeek}周`, "success");
}
