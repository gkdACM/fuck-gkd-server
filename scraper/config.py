from __future__ import annotations

from dataclasses import dataclass
import json
import os
from pathlib import Path
from typing import Any


def _get_env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _get_env_json(name: str) -> dict[str, Any]:
    raw = os.getenv(name, "").strip()
    if not raw:
        return {}
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise ValueError(f"环境变量 {name} 必须是 JSON 对象")
    return parsed


@dataclass
class ScraperConfig:
    login_url: str | None
    timetable_url: str | None
    username: str | None
    password: str | None
    username_field: str
    password_field: str
    login_form_selector: str
    extra_login_form: dict[str, Any]
    timetable_method: str
    timetable_params: dict[str, Any]
    timetable_form: dict[str, Any]
    extra_headers: dict[str, Any]
    session_cookies: dict[str, Any]
    request_timeout: int
    user_agent: str
    verify_tls: bool
    response_encoding: str | None
    source_html_file: Path | None
    output_json: Path

    @classmethod
    def from_env(cls) -> "ScraperConfig":
        login_url = os.getenv("LOGIN_URL") or None
        timetable_url = os.getenv("TIMETABLE_URL") or None
        username = os.getenv("USERNAME") or None
        password = os.getenv("PASSWORD") or None
        source_html_file = os.getenv("SOURCE_HTML_FILE") or None

        if source_html_file:
            source_path: Path | None = Path(source_html_file)
        else:
            source_path = None

        if source_path is None and not timetable_url:
            raise ValueError("未设置 TIMETABLE_URL，且未设置 SOURCE_HTML_FILE")

        if login_url and (not username or not password):
            raise ValueError("配置了 LOGIN_URL 时，必须提供 USERNAME 和 PASSWORD")

        timetable_method = (os.getenv("TIMETABLE_METHOD") or "GET").upper()
        if timetable_method not in {"GET", "POST"}:
            raise ValueError("TIMETABLE_METHOD 仅支持 GET 或 POST")

        return cls(
            login_url=login_url,
            timetable_url=timetable_url,
            username=username,
            password=password,
            username_field=os.getenv("USERNAME_FIELD") or "username",
            password_field=os.getenv("PASSWORD_FIELD") or "password",
            login_form_selector=os.getenv("LOGIN_FORM_SELECTOR") or "form",
            extra_login_form=_get_env_json("EXTRA_LOGIN_FORM_JSON"),
            timetable_method=timetable_method,
            timetable_params=_get_env_json("TIMETABLE_PARAMS_JSON"),
            timetable_form=_get_env_json("TIMETABLE_FORM_JSON"),
            extra_headers=_get_env_json("EXTRA_HEADERS_JSON"),
            session_cookies=_get_env_json("SESSION_COOKIES_JSON"),
            request_timeout=int(os.getenv("REQUEST_TIMEOUT") or "20"),
            user_agent=os.getenv("USER_AGENT")
            or "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            verify_tls=_get_env_bool("VERIFY_TLS", True),
            response_encoding=os.getenv("RESPONSE_ENCODING") or None,
            source_html_file=source_path,
            output_json=Path(os.getenv("OUTPUT_JSON") or "public/timetable.json"),
        )
