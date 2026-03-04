from __future__ import annotations

import argparse
import json
import re
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DAY_MAP = {
    1: "星期一",
    2: "星期二",
    3: "星期三",
    4: "星期四",
    5: "星期五",
    6: "星期六",
    7: "星期日",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="将 timetable 分片聚合为前端课表数据")
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=Path("timetable"),
        help="分片 JSON 目录（默认 timetable）",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("public/timetables.json"),
        help="输出文件路径（默认 public/timetables.json）",
    )
    return parser.parse_args()


def _read_json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"顶层必须是对象: {path}")
    return payload


def _to_day_label(value: Any) -> str:
    if isinstance(value, int):
        return DAY_MAP.get(value, "")

    raw = str(value or "").strip()
    if not raw:
        return ""

    if raw.isdigit():
        return DAY_MAP.get(int(raw), raw)

    mapping = {
        "周一": "星期一",
        "周二": "星期二",
        "周三": "星期三",
        "周四": "星期四",
        "周五": "星期五",
        "周六": "星期六",
        "周日": "星期日",
        "星期天": "星期日",
    }
    return mapping.get(raw, raw)


def _normalize_period(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""

    numbers = [int(item) for item in re.findall(r"\d+", raw)]
    if not numbers:
        return raw
    if len(numbers) == 1:
        return f"{numbers[0]}-{numbers[0]}"

    start = numbers[0]
    end = numbers[-1]
    if start > end:
        start, end = end, start
    return f"{start}-{end}"


def _period_sort_key(period: str) -> tuple[int, int, str]:
    numbers = [int(item) for item in re.findall(r"\d+", period)]
    if not numbers:
        return (999, 999, period)
    if len(numbers) == 1:
        return (numbers[0], numbers[0], period)
    return (numbers[0], numbers[-1], period)


def _period_session(period: str) -> str:
    numbers = [int(item) for item in re.findall(r"\d+", period)]
    start = numbers[0] if numbers else 99
    if start <= 4:
        return "上午"
    if start <= 8:
        return "下午"
    return "晚上"


def _slot_from_row(row: dict[str, Any]) -> dict[str, str] | None:
    course_name = str(row.get("Kcm") or "").strip()
    if not course_name:
        return None

    day = _to_day_label(row.get("Skxq"))
    period = _normalize_period(row.get("Jc"))
    if not day or not period:
        return None

    return {
        "day": day,
        "period": period,
        "courseCode": str(row.get("Kch") or "").strip(),
        "courseName": course_name,
        "teacher": str(row.get("Jsms") or "").strip(),
        "location": str(row.get("Dd") or "").strip(),
        "weekBitmap": str(row.get("Skzc") or "").strip(),
        "weeks": str(row.get("Zcsm") or "").strip(),
        "note": str(row.get("Kxh") or "").strip(),
    }


def _iter_batch_files(input_dir: Path) -> list[Path]:
    candidates = list(input_dir.glob("timetables-*.json"))
    if not candidates:
        raise FileNotFoundError(f"未找到分片文件: {input_dir}/timetables-*.json")

    return sorted(candidates, key=lambda path: path.name)


def build_dataset(input_dir: Path) -> dict[str, Any]:
    files = _iter_batch_files(input_dir)
    classes: OrderedDict[str, dict[str, Any]] = OrderedDict()
    periods: set[str] = set()
    generated_at_candidates: list[str] = []
    semester = ""

    for file_path in files:
        payload = _read_json(file_path)
        generated_at = str(payload.get("generatedAt") or "").strip()
        if generated_at:
            generated_at_candidates.append(generated_at)

        semester_value = str(payload.get("semester") or "").strip()
        if semester_value:
            semester = semester_value

        batch_items = payload.get("batch")
        if not isinstance(batch_items, list):
            continue

        for batch_item in batch_items:
            if not isinstance(batch_item, dict):
                continue

            meta = batch_item.get("meta")
            if not isinstance(meta, dict):
                meta = {}

            class_id = str(meta.get("id") or meta.get("bjh") or batch_item.get("bjh") or "").strip()
            class_name = str(meta.get("bm") or class_id).strip()
            if not class_id or not class_name:
                continue

            class_item = classes.get(class_id)
            if class_item is None:
                class_item = {
                    "id": class_id,
                    "name": class_name,
                    "term": semester,
                    "grade": str(meta.get("njdm") or "").strip(),
                    "collegeCode": str(meta.get("xsh") or "").strip(),
                    "majorCode": str(meta.get("zyh") or "").strip(),
                    "directionCode": str(meta.get("zyfxh") or "").strip(),
                    "collegeName": "",
                    "majorName": "",
                    "slots": [],
                    "_seen": set(),
                }
                classes[class_id] = class_item
            elif not class_item.get("term") and semester:
                class_item["term"] = semester

            row_container = batch_item.get("data")
            rows = row_container.get("rows") if isinstance(row_container, dict) else None
            if not isinstance(rows, list):
                continue

            for row in rows:
                if not isinstance(row, dict):
                    continue

                slot = _slot_from_row(row)
                if not slot:
                    continue

                if not class_item.get("collegeName"):
                    class_item["collegeName"] = str(row.get("Xsm") or row.get("Xsjc") or "").strip()
                if not class_item.get("majorName"):
                    class_item["majorName"] = str(row.get("Zym") or "").strip()

                if not class_item.get("grade"):
                    class_item["grade"] = str(row.get("Njdm") or row.get("njdm") or "").strip()
                if not class_item.get("collegeCode"):
                    class_item["collegeCode"] = str(row.get("Xsh") or row.get("xsh") or "").strip()
                if not class_item.get("majorCode"):
                    class_item["majorCode"] = str(row.get("Zyh") or row.get("zyh") or "").strip()
                if not class_item.get("directionCode"):
                    class_item["directionCode"] = str(row.get("zyfxh") or row.get("Zyfxh") or "").strip()

                periods.add(slot["period"])
                unique_key = (
                    slot["day"],
                    slot["period"],
                    slot["courseCode"],
                    slot["courseName"],
                    slot["teacher"],
                    slot["location"],
                    slot["weekBitmap"],
                    slot["weeks"],
                )
                seen = class_item["_seen"]
                if unique_key in seen:
                    continue
                seen.add(unique_key)
                class_item["slots"].append(slot)

    class_list: list[dict[str, Any]] = []
    for item in classes.values():
        item.pop("_seen", None)
        slots = item.get("slots")
        if not isinstance(slots, list) or len(slots) == 0:
            continue
        class_list.append(item)

    if not class_list:
        raise RuntimeError("未构建出任何班级课表，请检查分片 JSON 格式")

    period_items = [
        {
            "id": period,
            "label": period,
            "session": _period_session(period),
        }
        for period in sorted(periods, key=_period_sort_key)
    ]

    if not period_items:
        period_items = [
            {"id": "1-2", "label": "1-2", "session": "上午"},
            {"id": "3-4", "label": "3-4", "session": "上午"},
            {"id": "5-6", "label": "5-6", "session": "下午"},
            {"id": "7-8", "label": "7-8", "session": "下午"},
            {"id": "9-11", "label": "9-11", "session": "晚上"},
        ]

    generated_at = max(generated_at_candidates) if generated_at_candidates else datetime.now(timezone.utc).isoformat()

    return {
        "generated_at": generated_at,
        "source": "timetable/timetables-*.json",
        "periods": period_items,
        "classes": class_list,
    }


def main() -> None:
    args = parse_args()
    dataset = build_dataset(args.input_dir)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(dataset, ensure_ascii=False, indent=2), encoding="utf-8")

    class_count = len(dataset["classes"])
    slot_count = sum(len(class_item.get("slots", [])) for class_item in dataset["classes"])
    print(f"[build] 已生成 {args.output}")
    print(f"[build] 班级数={class_count} 课程条目={slot_count} 节次数={len(dataset['periods'])}")


if __name__ == "__main__":
    main()
