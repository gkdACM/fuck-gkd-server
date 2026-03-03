from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


DEFAULT_FILES = [
    Path("public/timetables.json"),
    Path("public/timetable.json"),
]


def _expect_object(value: Any, message: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(message)
    return value


def _expect_list(value: Any, message: str) -> list[Any]:
    if not isinstance(value, list):
        raise ValueError(message)
    return value


def _read_json(path: Path) -> dict[str, Any]:
    try:
        content = path.read_text(encoding="utf-8")
        parsed = json.loads(content)
    except FileNotFoundError as error:
        raise FileNotFoundError(f"文件不存在: {path}") from error
    except json.JSONDecodeError as error:
        raise ValueError(f"JSON 格式错误: {path}: {error}") from error

    return _expect_object(parsed, f"顶层必须是 JSON 对象: {path}")


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def _stringify(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _validate_multi(data: dict[str, Any], path: Path) -> dict[str, Any]:
    classes = _expect_list(data.get("classes"), f"{path}: classes 必须是数组")
    _require(len(classes) > 0, f"{path}: classes 不能为空")

    periods_value = data.get("periods")
    if periods_value is not None:
        periods = _expect_list(periods_value, f"{path}: periods 必须是数组")
        for index, period_item in enumerate(periods, start=1):
            period = _expect_object(period_item, f"{path}: periods[{index}] 必须是对象")
            _require(
                _stringify(period.get("id")) != "" or _stringify(period.get("label")) != "",
                f"{path}: periods[{index}] 必须包含 id 或 label",
            )

    class_count = 0
    slot_count = 0

    for class_index, class_item_value in enumerate(classes, start=1):
        class_item = _expect_object(
            class_item_value,
            f"{path}: classes[{class_index}] 必须是对象",
        )

        class_id = _stringify(class_item.get("id"))
        class_name = _stringify(class_item.get("name"))
        _require(class_id != "", f"{path}: classes[{class_index}] 缺少 id")
        _require(class_name != "", f"{path}: classes[{class_index}] 缺少 name")

        slots = _expect_list(
            class_item.get("slots"),
            f"{path}: classes[{class_index}] 的 slots 必须是数组",
        )

        class_count += 1

        for slot_index, slot_value in enumerate(slots, start=1):
            slot = _expect_object(
                slot_value,
                f"{path}: classes[{class_index}].slots[{slot_index}] 必须是对象",
            )

            day_value = _stringify(slot.get("day") or slot.get("weekday") or slot.get("dayLabel"))
            period_value = _stringify(slot.get("period") or slot.get("section") or slot.get("time"))
            course_value = _stringify(slot.get("courseName") or slot.get("course"))

            _require(
                day_value != "",
                f"{path}: classes[{class_index}].slots[{slot_index}] 缺少 day",
            )
            _require(
                period_value != "",
                f"{path}: classes[{class_index}].slots[{slot_index}] 缺少 period",
            )
            _require(
                course_value != "",
                f"{path}: classes[{class_index}].slots[{slot_index}] 缺少 courseName",
            )

            slot_count += 1

    return {
        "mode": "multi",
        "class_count": class_count,
        "record_count": slot_count,
    }


def _validate_legacy(data: dict[str, Any], path: Path) -> dict[str, Any]:
    rows = _expect_list(data.get("rows"), f"{path}: rows 必须是数组")

    headers_value = data.get("headers")
    if headers_value is not None:
        headers = _expect_list(headers_value, f"{path}: headers 必须是数组")
        for index, header in enumerate(headers, start=1):
            _require(isinstance(header, str), f"{path}: headers[{index}] 必须是字符串")

    for index, row_value in enumerate(rows, start=1):
        _expect_object(row_value, f"{path}: rows[{index}] 必须是对象")

    return {
        "mode": "legacy",
        "class_count": 1,
        "record_count": len(rows),
    }


def validate_document(data: dict[str, Any], path: Path) -> dict[str, Any]:
    if isinstance(data.get("classes"), list):
        return _validate_multi(data, path)

    if isinstance(data.get("rows"), list):
        return _validate_legacy(data, path)

    raise ValueError(f"{path}: 既不是 classes 多班级格式，也不是 rows 兼容格式")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="校验课表 JSON 数据结构")
    parser.add_argument(
        "--file",
        action="append",
        dest="files",
        default=None,
        help="要校验的 JSON 文件路径；可重复传入",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    requested_files = [Path(item) for item in args.files] if args.files else DEFAULT_FILES

    existing_files: list[Path] = []
    for path in requested_files:
        if path.exists():
            existing_files.append(path)

    if args.files and len(existing_files) != len(requested_files):
        missing = [str(path) for path in requested_files if not path.exists()]
        raise FileNotFoundError(f"指定校验文件不存在: {', '.join(missing)}")

    if not existing_files:
        candidates = ", ".join(str(path) for path in requested_files)
        raise FileNotFoundError(f"未找到可校验文件: {candidates}")

    all_records = 0
    all_classes = 0

    for path in existing_files:
        data = _read_json(path)
        summary = validate_document(data, path)
        all_records += int(summary["record_count"])
        all_classes += int(summary["class_count"])
        print(
            f"[validate] {path} mode={summary['mode']} "
            f"class_count={summary['class_count']} record_count={summary['record_count']}"
        )

    print(
        f"[validate] OK files={len(existing_files)} "
        f"total_classes={all_classes} total_records={all_records}"
    )


if __name__ == "__main__":
    main()
