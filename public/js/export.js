import { DAY_INDEX } from "./constants.js";
import { tableContainer, viewTitleNode, searchInput, weekFilterInput, weekModeSelect } from "./dom.js";
import {
  escapeHtml, toCsvField, downloadFile, downloadBlob, copyText,
  getTimeRangeForPeriod, parseWeeksFromText,
} from "./utils.js";
import { state, writeHashStateNow, writePersistedViewStateNow } from "./state.js";
import { currentClass } from "./data.js";
import { setStatus, showToast, showLoading, hideLoading } from "./render.js";

// ===== ICS Helpers =====

function formatIcsDateTime(date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  const h = `${date.getHours()}`.padStart(2, "0");
  const mi = `${date.getMinutes()}`.padStart(2, "0");
  const s = `${date.getSeconds()}`.padStart(2, "0");
  return `${y}${m}${d}T${h}${mi}${s}`;
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

// ===== PNG Export =====

function buildExportSummaryText(classItem) {
  const summary = [classItem?.name || ""];
  if (state.selectedWeekNumber) summary.push(`第${state.selectedWeekNumber}周`);
  if (weekModeSelect.value === "odd") summary.push("仅单周");
  else if (weekModeSelect.value === "even") summary.push("仅双周");
  if (weekFilterInput.value.trim()) summary.push(`周次筛选：${weekFilterInput.value.trim()}`);
  if (searchInput.value.trim()) summary.push(`搜索：${searchInput.value.trim()}`);
  if (state.compactMode) summary.push("紧凑显示");
  return summary.filter(Boolean).join(" ｜ ");
}

function buildPngExportNode(classItem) {
  const wrapper = document.createElement("div");
  wrapper.className = "png-export-root";
  const subtitle = buildExportSummaryText(classItem);
  const generatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  const tableClone = tableContainer.cloneNode(true);
  tableClone.removeAttribute("id");

  wrapper.innerHTML = `
    <div class="png-export-panel">
      <div class="png-export-header">
        <h2>${escapeHtml(viewTitleNode.textContent || "班级课表")}</h2>
        <p>${escapeHtml(subtitle)}</p>
        <p class="png-export-meta">导出时间：${escapeHtml(generatedAt)}</p>
      </div>
    </div>`;
  wrapper.querySelector(".png-export-panel").appendChild(tableClone);
  return wrapper;
}

export async function exportCurrentPng() {
  const classItem = currentClass();
  if (!classItem) { setStatus("导出失败：无可用班级", true); return; }
  if (!tableContainer || !tableContainer.children.length) { setStatus("导出失败：当前没有可导出的课表", true); return; }
  if (typeof window.html2canvas !== "function") { setStatus("导出失败：PNG 依赖未加载", true); return; }

  showLoading();
  const exportNode = buildPngExportNode(classItem);
  document.body.appendChild(exportNode);

  try {
    await new Promise((resolve) => { window.requestAnimationFrame(() => { window.requestAnimationFrame(resolve); }); });

    const width = Math.ceil(exportNode.scrollWidth);
    const height = Math.ceil(exportNode.scrollHeight);
    const backgroundColor = getComputedStyle(document.documentElement).getPropertyValue("--png-export-bg").trim() || null;

    const canvas = await window.html2canvas(exportNode, {
      backgroundColor, scale: Math.min(window.devicePixelRatio || 2, 2),
      useCORS: true, logging: false, width, height, windowWidth: width, windowHeight: height, scrollX: 0, scrollY: 0,
    });

    const blob = await new Promise((resolve) => { canvas.toBlob(resolve, "image/png"); });
    if (!blob) throw new Error("canvas toBlob failed");

    downloadBlob(blob, `${classItem.name.replaceAll(/\s+/g, "_")}_课表.png`);
    setStatus("已导出 PNG", false);
    showToast("已导出 PNG", "success");
  } catch (error) {
    setStatus("导出 PNG 失败，请稍后重试", true);
  } finally {
    exportNode.remove();
    hideLoading();
  }
}

// ===== CSV Export =====

export function exportCurrentCsv() {
  const classItem = currentClass();
  if (!classItem) { setStatus("导出失败：无可用班级", true); return; }

  const rows = state.lastRenderedRows;
  if (!rows.length) { setStatus("导出失败：当前筛选结果为空", true); return; }

  const headers = ["班级", "星期", "节次", "课程编码", "课序号", "课程名", "教师", "地点", "周次", "单双周", "备注"];
  const lines = [headers.map(toCsvField).join(",")];
  for (const item of rows) {
    lines.push([classItem.name, item.day, item.period, item.courseCode, item.courseSeq, item.courseName, item.teacher, item.location, item.weeks, item.parityLabel, item.note].map(toCsvField).join(","));
  }

  downloadFile(`\uFEFF${lines.join("\n")}`, `${classItem.name.replaceAll(/\s+/g, "_")}_课表.csv`, "text/csv;charset=utf-8");
  setStatus(`已导出 CSV：${rows.length} 条`, false);
  showToast(`已导出 CSV：${rows.length} 条`, "success");
}

// ===== ICS Export =====

export function exportCurrentIcs() {
  const classItem = currentClass();
  if (!classItem) { setStatus("导出失败：无可用班级", true); return; }
  if (!state.enableIcs) { setStatus("请先启用 ICS", true); return; }
  if (!state.termStartDate) { setStatus("导出 ICS 需要填写开学周一", true); return; }

  const startMonday = new Date(`${state.termStartDate}T00:00:00`);
  if (Number.isNaN(startMonday.getTime())) { setStatus("开学周一日期无效", true); return; }

  const rows = state.lastRenderedRows;
  if (!rows.length) { setStatus("导出失败：当前筛选结果为空", true); return; }

  const nowStamp = formatIcsDateTime(new Date());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//school-timetable-static//CN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  let eventCount = 0;

  rows.forEach((row, rowIndex) => {
    const dayOffset = DAY_INDEX[row.day];
    const timeRange = getTimeRangeForPeriod(row.period);
    const weeksSet = row.weeksSet || parseWeeksFromText(row.weeks);
    if (dayOffset === undefined || !timeRange || !weeksSet || !weeksSet.size) return;

    Array.from(weeksSet).sort((a, b) => a - b).forEach((weekNo, weekIndex) => {
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
  if (!eventCount) { setStatus("导出 ICS 失败：没有可转换的周次数据", true); return; }

  downloadFile(lines.join("\r\n"), `${classItem.name.replaceAll(/\s+/g, "_")}_课表.ics`, "text/calendar;charset=utf-8");
  setStatus(`已导出 ICS：${eventCount} 个日程`, false);
  showToast(`已导出 ICS：${eventCount} 个日程`, "success");
}

// ===== Share Link =====

export async function copyCurrentShareLink() {
  writeHashStateNow();
  writePersistedViewStateNow();
  try {
    await copyText(window.location.href);
    setStatus("已复制分享链接", false);
    showToast("已复制分享链接", "success");
  } catch {
    setStatus("复制分享链接失败，请手动复制地址栏", true);
  }
}
