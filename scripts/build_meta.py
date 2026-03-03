from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


DEFAULT_INPUT_FILES = [
    Path("public/timetables.json"),
    Path("public/timetable.json"),
]
DEFAULT_OUTPUT_FILE = Path("public/meta.json")


def _expect_object(value: Any, message: str) -> dict[str, Any]:
    if not isinstance(value, dict):
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


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        while True:
            chunk = file.read(8192)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def _summarize_dataset(data: dict[str, Any]) -> tuple[str, int, int]:
    classes = data.get("classes")
    if isinstance(classes, list):
        class_count = 0
        record_count = 0

        for class_item in classes:
            if not isinstance(class_item, dict):
                continue
            class_count += 1
            slots = class_item.get("slots")
            if isinstance(slots, list):
                record_count += len(slots)

        return "multi", class_count, record_count

    rows = data.get("rows")
    if isinstance(rows, list):
        return "legacy", 1, len(rows)

    return "unknown", 0, 0


def _build_version_seed(items: list[dict[str, Any]]) -> str:
    parts = []
    for item in items:
        parts.append(f"{item['path']}:{item['sha256']}")
    return "|".join(parts)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="生成课表前端元信息（meta.json）")
    parser.add_argument(
        "--file",
        action="append",
        dest="files",
        default=None,
        help="参与生成版本的 JSON 文件路径；可重复传入",
    )
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT_FILE),
        help="输出的 meta.json 路径",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    requested_files = [Path(item) for item in args.files] if args.files else DEFAULT_INPUT_FILES

    existing_files: list[Path] = []
    for path in requested_files:
        if path.exists():
            existing_files.append(path)

    if args.files and len(existing_files) != len(requested_files):
        missing = [str(path) for path in requested_files if not path.exists()]
        raise FileNotFoundError(f"指定输入文件不存在: {', '.join(missing)}")

    if not existing_files:
        candidates = ", ".join(str(path) for path in requested_files)
        raise FileNotFoundError(f"未找到可用输入文件: {candidates}")

    source_items: list[dict[str, Any]] = []
    total_classes = 0
    total_records = 0

    for path in existing_files:
        data = _read_json(path)
        mode, class_count, record_count = _summarize_dataset(data)
        checksum = _sha256_file(path)

        source_items.append(
            {
                "path": path.as_posix(),
                "mode": mode,
                "class_count": class_count,
                "record_count": record_count,
                "sha256": checksum,
                "generated_at": str(data.get("generated_at", "")).strip(),
                "source": str(data.get("source", "")).strip(),
            }
        )

        total_classes += class_count
        total_records += record_count

    version_seed = _build_version_seed(source_items)
    version = hashlib.sha256(version_seed.encode("utf-8")).hexdigest()[:16]

    generated_values = [
        item["generated_at"]
        for item in source_items
        if isinstance(item.get("generated_at"), str) and item["generated_at"]
    ]

    meta: dict[str, Any] = {
        "version": version,
        "summary": {
            "file_count": len(source_items),
            "class_count": total_classes,
            "record_count": total_records,
        },
        "sources": source_items,
    }

    if generated_values:
        meta["latest_generated_at"] = max(generated_values)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(
        f"[meta] wrote {output_path.as_posix()} "
        f"version={version} files={len(source_items)}"
    )


if __name__ == "__main__":
    main()
