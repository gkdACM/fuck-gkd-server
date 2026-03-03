const statusNode = document.getElementById("status");
const tableContainer = document.getElementById("tableContainer");
const searchInput = document.getElementById("searchInput");
const reloadButton = document.getElementById("reloadBtn");

let currentData = null;

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
  statusNode.style.color = isError ? "#b91c1c" : "#4b5563";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderTable(data, keyword = "") {
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

  tableContainer.innerHTML = `<table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
}

async function loadTimetable() {
  setStatus("正在加载课表...");

  try {
    const response = await fetch(`./timetable.json?ts=${Date.now()}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`请求失败: ${response.status}`);
    }

    currentData = await response.json();
    renderTable(currentData, searchInput.value);
    const updatedText = formatDate(currentData.generated_at);
    const count = Array.isArray(currentData.rows) ? currentData.rows.length : 0;
    setStatus(`更新时间：${updatedText}，共 ${count} 条记录`);
  } catch (error) {
    setStatus(`加载失败：${error.message}`, true);
    tableContainer.innerHTML = '<div class="empty">无法加载课表数据</div>';
  }
}

searchInput.addEventListener("input", () => {
  if (!currentData) {
    return;
  }
  renderTable(currentData, searchInput.value);
});

reloadButton.addEventListener("click", () => {
  loadTimetable();
});

loadTimetable();
