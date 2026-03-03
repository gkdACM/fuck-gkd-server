from __future__ import annotations

import argparse
import json
from pathlib import Path

from .client import TimetableClient
from .config import ScraperConfig
from .parser import build_payload, extract_table_rows


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="抓取学校课表并导出为 JSON")
    parser.add_argument("--source-file", type=str, default=None)
    parser.add_argument("--output", type=str, default=None)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = ScraperConfig.from_env()

    if args.source_file:
        config.source_html_file = Path(args.source_file)
    if args.output:
        config.output_json = Path(args.output)

    client = TimetableClient(config)
    html = client.fetch_timetable_html()
    headers, rows = extract_table_rows(html)

    source = config.timetable_url or str(config.source_html_file)
    payload = build_payload(headers, rows, source)

    config.output_json.parent.mkdir(parents=True, exist_ok=True)
    config.output_json.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"已写入课表: {config.output_json}")
    print(f"共提取 {len(rows)} 行")


if __name__ == "__main__":
    main()
