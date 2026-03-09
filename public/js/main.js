import {
  tableContainer, searchInput, classSelect, quickClassSelect,
  gradeSelect, collegeSelect, majorSelect, classFilterInput,
  weekFilterInput, weekNumberSelect, weekModeSelect,
  compactToggle, enableIcsToggle, themeSelect, termStartInput,
  exportCsvBtn, exportIcsBtn, exportPngBtn, reloadButton,
  jumpCurrentWeekBtn, favoriteClassBtn, copyShareLinkBtn,
  detailModal, detailModalBackdrop, detailModalClose,
  viewTitleNode,
} from "./dom.js";
import { formatDate } from "./utils.js";
import {
  state, scheduleHashSync, applyHashStateToControls, autoSelectCurrentWeek,
  hydrateClassMemoryState, initThemePreference, applyThemePreference,
  getHashState, getStoredTermStartDate,
} from "./state.js";
import { normalizeDataset } from "./data.js";
import {
  setStatus, showLoading, hideLoading,
  renderClassOptions, renderWeekNumberOptions, renderGridView,
  renderLegacyTable, openDetailModal, closeDetailModal,
  refreshIcsAvailability, activateClassById,
  toggleFavoriteCurrentClass, jumpToCurrentWeek,
} from "./render.js";
import { exportCurrentCsv, exportCurrentIcs, exportCurrentPng, copyCurrentShareLink } from "./export.js";

// ===== Data Loading =====

const CACHE_KEY_DATA = "timetable_data";
const CACHE_KEY_VERSION = "timetable_version";

async function fetchMeta() {
  const response = await fetch(`./meta.json?ts=${Date.now()}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`./meta.json 请求失败: ${response.status}`);

  const payload = await response.json();
  if (!payload || typeof payload !== "object") return null;

  const version = String(payload.version ?? "").trim();
  if (!version) return null;
  return { ...payload, version };
}

async function fetchOptionalJson(path, version = "") {
  const query = version ? `v=${encodeURIComponent(version)}` : `ts=${Date.now()}`;
  const response = await fetch(`${path}?${query}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${path} 请求失败: ${response.status}`);
  return response.json();
}

function applyDataset(normalized, rawData, version) {
  state.dataset = normalized;
  state.legacyData = null;

  if (!state.termStartDate && normalized.term_start_date) {
    state.termStartDate = normalized.term_start_date;
    termStartInput.value = state.termStartDate;
  }

  if (version && rawData) {
    try {
      localStorage.setItem(CACHE_KEY_VERSION, version);
      localStorage.setItem(CACHE_KEY_DATA, JSON.stringify(rawData));
    } catch { /* quota exceeded */ }
  }

  renderClassOptions(normalized);
  renderWeekNumberOptions(normalized);
  autoSelectCurrentWeek();
  renderGridView();
  scheduleHashSync();
}

async function loadTimetable() {
  showLoading();
  setStatus("正在加载课表...");

  const storedStart = getStoredTermStartDate();
  if (storedStart) {
    state.termStartDate = storedStart;
    termStartInput.value = storedStart;
  }

  try {
    let version = "";
    try {
      const meta = await fetchMeta();
      version = meta ? meta.version : "";
      if (meta?.term_start_date && !state.termStartDate) {
        state.termStartDate = String(meta.term_start_date);
        termStartInput.value = state.termStartDate;
      }
    } catch { /* meta.json not available */ }
    state.metaVersion = version;

    // 尝试从 localStorage 缓存加载
    if (version) {
      const cachedVersion = localStorage.getItem(CACHE_KEY_VERSION);
      const cachedDataStr = localStorage.getItem(CACHE_KEY_DATA);

      if (cachedVersion === version && cachedDataStr) {
        try {
          const normalized = normalizeDataset(JSON.parse(cachedDataStr));
          if (normalized) {
            applyDataset(normalized, null, "");
            setStatus(`已加载本地缓存 (v${version})`);
            hideLoading();
            return;
          }
        } catch { /* cache parse failed */ }
      }
    }

    // 尝试加载 timetables.json（多班级）
    const multi = await fetchOptionalJson("./timetables.json", version);
    const normalizedMulti = normalizeDataset(multi);
    if (normalizedMulti) {
      applyDataset(normalizedMulti, multi, version);
      hideLoading();
      return;
    }

    // 尝试加载 timetable.json（单班级或旧格式）
    const single = await fetchOptionalJson("./timetable.json", version);
    const normalizedSingle = normalizeDataset(single);
    if (normalizedSingle) {
      applyDataset(normalizedSingle, single, version);
      hideLoading();
      return;
    }

    // 旧版表格格式
    if (single && Array.isArray(single.rows)) {
      state.dataset = null;
      state.legacyData = single;
      classSelect.innerHTML = '<option value="legacy">单班视图</option>';
      classSelect.disabled = true;
      viewTitleNode.textContent = "学校课表";
      renderLegacyTable(single, searchInput.value);

      const updateText = formatDate(single.generated_at);
      const count = single.rows.length;
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

// ===== Event Listeners =====

tableContainer.addEventListener("click", (event) => {
  const target = event.target.closest("[data-open-slot]");
  if (!target) return;
  const key = target.getAttribute("data-open-slot");
  if (!key) return;
  const payload = state.cardRegistry.get(key);
  if (!payload) return;
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
  if (state.classFilterDebounceTimer) clearTimeout(state.classFilterDebounceTimer);

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
  if (state.dataset) renderGridView();
  scheduleHashSync();
});

classSelect.addEventListener("change", () => {
  state.currentClassId = classSelect.value;
  if (state.dataset) renderGridView();
  scheduleHashSync();
});

quickClassSelect.addEventListener("change", () => {
  const classId = quickClassSelect.value;
  quickClassSelect.value = "";
  if (!classId) return;
  if (!activateClassById(classId)) {
    setStatus("快捷班级跳转失败：未找到对应班级", true);
  }
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
  if (state.dataset) renderGridView();
  scheduleHashSync();
});

compactToggle.addEventListener("change", () => {
  state.compactMode = compactToggle.checked;
  if (state.dataset) renderGridView();
  scheduleHashSync();
});

enableIcsToggle.addEventListener("change", () => {
  state.enableIcs = enableIcsToggle.checked;
  refreshIcsAvailability(state.dataset);
  scheduleHashSync();
});

themeSelect.addEventListener("change", () => {
  applyThemePreference(themeSelect.value, true);
});

termStartInput.addEventListener("change", () => {
  state.termStartDate = termStartInput.value;
  if (!getHashState().wn) {
    autoSelectCurrentWeek();
    if (state.dataset) renderGridView();
  }
  refreshIcsAvailability(state.dataset);
  scheduleHashSync();
});

exportCsvBtn.addEventListener("click", exportCurrentCsv);
exportIcsBtn.addEventListener("click", exportCurrentIcs);
exportPngBtn.addEventListener("click", () => { void exportCurrentPng(); });
reloadButton.addEventListener("click", () => { loadTimetable(); });
jumpCurrentWeekBtn.addEventListener("click", jumpToCurrentWeek);
favoriteClassBtn.addEventListener("click", toggleFavoriteCurrentClass);
copyShareLinkBtn.addEventListener("click", () => { void copyCurrentShareLink(); });

window.addEventListener("hashchange", () => {
  applyHashStateToControls();
  if (state.dataset) {
    renderClassOptions(state.dataset);
    renderWeekNumberOptions(state.dataset);
    renderGridView();
  }
});

// ===== Initialization =====

hydrateClassMemoryState();
initThemePreference();
applyHashStateToControls();
loadTimetable();
