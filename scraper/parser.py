from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bs4 import BeautifulSoup


def _clean_text(value: str) -> str:
    compact = value.replace("\xa0", " ").strip()
    return " ".join(compact.split())


def _score_table(table: Any) -> int:
    rows = table.find_all("tr")
    if len(rows) < 2:
        return 0
    cell_count = sum(len(row.find_all(["th", "td"])) for row in rows)
    return cell_count


def extract_table_rows(html: str) -> tuple[list[str], list[dict[str, str]]]:
    soup = BeautifulSoup(html, "lxml")
    tables = soup.find_all("table")
    if not tables:
        raise RuntimeError("页面中未找到 table，无法解析课表")

    best_table = max(tables, key=_score_table)
    parsed_rows: list[list[str]] = []
    for row in best_table.find_all("tr"):
        cells = row.find_all(["th", "td"])
        cell_text = [_clean_text(cell.get_text(" ", strip=True)) for cell in cells]
        if any(cell_text):
            parsed_rows.append(cell_text)

    if len(parsed_rows) < 2:
        raise RuntimeError("课表 table 行数不足，无法提取数据")

    raw_headers = parsed_rows[0]
    headers: list[str] = []
    for index, value in enumerate(raw_headers, start=1):
        header = value or f"列{index}"
        headers.append(header)

    rows: list[dict[str, str]] = []
    width = len(headers)
    for row_values in parsed_rows[1:]:
        normalized_values = list(row_values)
        if len(normalized_values) < width:
            normalized_values.extend([""] * (width - len(normalized_values)))
        if len(normalized_values) > width:
            normalized_values = normalized_values[:width]
        row = {headers[index]: normalized_values[index] for index in range(width)}
        if any(value for value in row.values()):
            rows.append(row)

    if not rows:
        raise RuntimeError("未提取到有效课表内容")
    return headers, rows


def _pick_key(keys: list[str], keywords: list[str]) -> str | None:
    for key in keys:
        lowered = key.lower()
        if any(keyword in lowered for keyword in keywords):
            return key
    return None


def normalize_entries(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    if not rows:
        return []

    keys = list(rows[0].keys())
    day_key = _pick_key(keys, ["星期", "周", "day", "weekday"])
    time_key = _pick_key(keys, ["节", "时间", "time", "period"])
    course_key = _pick_key(keys, ["课程", "课名", "course", "subject"])
    teacher_key = _pick_key(keys, ["教师", "老师", "teacher"])
    room_key = _pick_key(keys, ["地点", "教室", "room", "location"])
    week_key = _pick_key(keys, ["周次", "week"])

    entries: list[dict[str, str]] = []
    for row in rows:
        course_name = row.get(course_key, "") if course_key else ""
        day_value = row.get(day_key, "") if day_key else ""
        time_value = row.get(time_key, "") if time_key else ""

        if not any([course_name, day_value, time_value]):
            continue

        entries.append(
            {
                "course": course_name,
                "day": day_value,
                "time": time_value,
                "teacher": row.get(teacher_key, "") if teacher_key else "",
                "location": row.get(room_key, "") if room_key else "",
                "week": row.get(week_key, "") if week_key else "",
            }
        )

    return entries


def build_payload(
    headers: list[str],
    rows: list[dict[str, str]],
    source: str,
) -> dict[str, Any]:
    generated_at = datetime.now(timezone.utc).isoformat()
    return {
        "generated_at": generated_at,
        "source": source,
        "headers": headers,
        "rows": rows,
        "entries": normalize_entries(rows),
    }
