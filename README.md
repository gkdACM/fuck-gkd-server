<<<<<<< HEAD
# fuck-gkd-server
class table
under construction
=======
# 学校课表抓取 + 静态站模板

这个模板用于：

- 用 Python 登录教务系统并抓取课表
- 生成静态文件 `public/timetable.json`
- 用纯静态页面展示课表
- 用 GitHub Actions 定时更新课表并自动部署

## 1. 本地快速开始

1) 安装依赖

```bash
pip install -r requirements.txt
```

2) 复制环境变量模板

```bash
cp .env.example .env
```

3) 配置 `.env`

- 至少设置 `TIMETABLE_URL`
- 如果需要登录，再设置 `LOGIN_URL`、`USERNAME`、`PASSWORD`
- 如果学校系统很复杂（CAS、验证码、强 JS），先用 `SOURCE_HTML_FILE` 调试解析

4) 运行抓取

```bash
python -m scraper.run
```

5) 本地预览静态页面

```bash
python -m http.server 8080 --directory public
```

然后访问 `http://127.0.0.1:8080`

## 2. 关键环境变量

- `LOGIN_URL`：登录页面地址
- `TIMETABLE_URL`：课表页面地址
- `USERNAME` / `PASSWORD`：账号密码
- `USERNAME_FIELD` / `PASSWORD_FIELD`：登录表单字段名
- `LOGIN_FORM_SELECTOR`：登录表单选择器，默认 `form`
- `EXTRA_LOGIN_FORM_JSON`：登录附加字段，如 `{"execution":"e1s1"}`
- `TIMETABLE_METHOD`：`GET` 或 `POST`
- `TIMETABLE_PARAMS_JSON`：GET 查询参数 JSON
- `TIMETABLE_FORM_JSON`：POST 表单 JSON
- `EXTRA_HEADERS_JSON`：额外请求头 JSON
- `SESSION_COOKIES_JSON`：初始 Cookie JSON
- `SOURCE_HTML_FILE`：本地 HTML 文件路径（可跳过登录抓取）
- `OUTPUT_JSON`：输出文件，默认 `public/timetable.json`

## 3. GitHub Actions 自动更新

仓库已包含两个工作流：

- `.github/workflows/update-timetable.yml`
  - 每 6 小时执行一次抓取
  - 若 `public/timetable.json` 变化则自动提交
- `.github/workflows/deploy-pages.yml`
  - `public/**` 变化时自动部署 GitHub Pages

在 GitHub 仓库 `Settings -> Secrets and variables -> Actions` 添加你需要的 secrets：

- `TIMETABLE_URL`
- `LOGIN_URL`（如果需要）
- `USERNAME`、`PASSWORD`（如果需要）
- 其他可选参数（如 `EXTRA_LOGIN_FORM_JSON`）

## 4. 适配你学校系统

不同学校系统差异很大，常见情况：

- 登录成功但课表页需要额外 token
- 表格不是标准 `<table>`，而是脚本渲染
- 页面编码不是 UTF-8（可设置 `RESPONSE_ENCODING`）

你可以优先改这三个文件：

- `scraper/client.py`：登录与请求流程
- `scraper/parser.py`：HTML 到结构化课表的解析逻辑
- `public/app.js`：展示层（筛选、排序、样式）

## 5. 安全与合规

- 不要把账号密码写进前端或仓库代码
- 账号密码仅放在 `.env`（本地）或 GitHub Secrets（线上）
- 注意学校系统使用条款，避免高频抓取
>>>>>>> 6ecbde7 (init: timetable static timetable scraper)
