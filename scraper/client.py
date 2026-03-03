from __future__ import annotations

from pathlib import Path
from urllib.parse import urljoin

from bs4 import BeautifulSoup
import requests

from .config import ScraperConfig


class TimetableClient:
    def __init__(self, config: ScraperConfig) -> None:
        self.config = config
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": self.config.user_agent})
        for key, value in self.config.extra_headers.items():
            self.session.headers[str(key)] = str(value)
        for key, value in self.config.session_cookies.items():
            self.session.cookies.set(str(key), str(value))

    def fetch_timetable_html(self) -> str:
        if self.config.source_html_file:
            return self._read_local_html(self.config.source_html_file)

        if self.config.login_url:
            self._login()

        if not self.config.timetable_url:
            raise RuntimeError("未配置 TIMETABLE_URL")

        if self.config.timetable_method == "POST":
            response = self.session.post(
                self.config.timetable_url,
                data=self.config.timetable_form,
                timeout=self.config.request_timeout,
                verify=self.config.verify_tls,
            )
        else:
            response = self.session.get(
                self.config.timetable_url,
                params=self.config.timetable_params,
                timeout=self.config.request_timeout,
                verify=self.config.verify_tls,
            )
        response.raise_for_status()

        if self.config.response_encoding:
            response.encoding = self.config.response_encoding
        return response.text

    def _read_local_html(self, file_path: Path) -> str:
        if not file_path.exists():
            raise FileNotFoundError(f"SOURCE_HTML_FILE 不存在: {file_path}")
        return file_path.read_text(encoding="utf-8")

    def _login(self) -> None:
        if not self.config.login_url:
            return

        login_page = self.session.get(
            self.config.login_url,
            timeout=self.config.request_timeout,
            verify=self.config.verify_tls,
        )
        login_page.raise_for_status()

        soup = BeautifulSoup(login_page.text, "lxml")
        form = soup.select_one(self.config.login_form_selector) or soup.find("form")
        if form is None:
            raise RuntimeError("登录页未找到 form，请检查 LOGIN_FORM_SELECTOR")

        payload: dict[str, str] = {}
        for input_element in form.find_all("input"):
            input_name = input_element.get("name")
            if not input_name:
                continue
            payload[input_name] = input_element.get("value", "")

        payload.update({str(k): str(v) for k, v in self.config.extra_login_form.items()})
        payload[self.config.username_field] = self.config.username or ""
        payload[self.config.password_field] = self.config.password or ""

        form_action = form.get("action") or self.config.login_url
        submit_url = urljoin(login_page.url, form_action)

        login_response = self.session.post(
            submit_url,
            data=payload,
            timeout=self.config.request_timeout,
            allow_redirects=True,
            verify=self.config.verify_tls,
        )
        login_response.raise_for_status()
