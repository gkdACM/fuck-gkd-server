# 学校课表静态站（先展示，后导入）

这个项目支持两种模式：

- **导入模式（推荐当前使用）**：在 GitHub Actions 手动导入课表 JSON，支持多班级切换并直接发布网站。
- **抓取模式（开学后使用）**：在可访问学校系统的环境抓取并更新 `public/timetable.json`。

## 1. 先上线展示站点

1) 在仓库 `Settings -> Pages` 里把来源设为 `GitHub Actions`。  
2) 到 `Actions` 页面手动运行 `Deploy Static Site`。  
3) 等待完成后，工作流日志会显示 Pages 地址。

当前示例数据文件是 `public/timetables.json`，页面会优先读取并展示“周课表网格 + 班级切换”。

## 2. 导入模式（Actions 手动导入）

新增工作流：`.github/workflows/import-timetable.yml`

使用步骤：

1) 打开 `Actions -> Import Timetable Data -> 运行工作流程`。
2) 在 `payload` 粘贴课表数据（JSON 字符串或 Base64(JSON)）。
3) `input_format` 选 `auto`（默认自动识别）即可。
4) `commit_changes=true` 会把结果写回 `public/timetables.json`（或兼容写回 `public/timetable.json`）并推送到仓库。
5) `deploy_pages=true` 会在同一个工作流里直接部署 Pages。

该工作流在写入后会自动执行：

- `python scripts/validate_timetable.py`（结构校验）
- `python scripts/build_meta.py`（生成 `public/meta.json`）

## 3. payload 最小格式

```json
{
  "generated_at": "2026-03-03T00:00:00+00:00",
  "source": "manual",
  "periods": [
    { "id": "1-2", "label": "1-2", "session": "上午" },
    { "id": "3-4", "label": "3-4", "session": "上午" },
    { "id": "5-6", "label": "5-6", "session": "下午" },
    { "id": "7-8", "label": "7-8", "session": "下午" },
    { "id": "9-11", "label": "9-11", "session": "晚上" }
  ],
  "classes": [
    {
      "id": "jy2302b",
      "name": "计应2*0**班",
      "term": "20**-20**学年春",
      "slots": [
        {
          "day": "星期一",
          "period": "1-2",
          "courseCode": "09101344-02",
          "courseName": "软件测试技术",
          "location": "文华*号教学楼***",
          "teacher": "奚老师",
          "weeks": "1-18周",
          "note": "(1-2)"
        }
      ]
    }
  ]
}
```

说明：

- 推荐使用 `classes` 多班级格式，这样前端可以切换班级。
- 每个班级都要有 `slots` 数组；每个 `slot` 至少包含 `day`、`period`、`courseName`。
- `periods` 可省略（工作流会自动补默认节次）。
- `generated_at` / `source` 可省略（工作流会自动补全）。

兼容说明：

- 仍支持旧格式 `rows`，旧格式会写入 `public/timetable.json`，前端会以旧表格模式渲染。

## 4. JSON 太长时用 Base64

### PowerShell

```powershell
$json = Get-Content .\public\timetable.json -Raw
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))
```

### Bash

```bash
base64 -w 0 public/timetable.json
```

把输出结果粘贴到 `payload`，并把 `input_format` 设为 `base64`（或 `auto`）。

## 5. 多班级切换说明

- 页面会优先读取 `public/timetables.json`。
- 下拉框可切换班级，搜索框会按当前班级过滤课程。
- 你后续导入更多班级，只需要在 `classes` 数组追加即可。
- 页面会先读取 `public/meta.json`，再带上 `meta.version` 请求数据文件，降低静态缓存导致的旧数据展示问题。

## 6. 抓取模式（后续启用）

工作流：`.github/workflows/update-timetable.yml`

它适合在能访问学校系统（校园网/VPN/内网机器）的环境使用。  
如果使用 GitHub 托管 runner 且学校系统是内网地址，抓取会失败，这是正常现象。

该工作流在抓取后会执行：

- `python scripts/validate_timetable.py`
- `python scripts/build_meta.py`

若 `TIMETABLE_URL` 与 `SOURCE_HTML_FILE` 都为空，工作流会直接跳过抓取步骤并结束，不报错。

## 7. 关键文件

- `.github/workflows/import-timetable.yml`：手动导入 + 可选部署
- `.github/workflows/deploy-pages.yml`：静态站部署
- `public/timetables.json`：多班级周课表数据源（推荐）
- `public/timetable.json`：旧格式兼容数据源
- `public/meta.json`：前端缓存版本与数据摘要
- `public/app.js`：展示逻辑（网格视图 + 班级切换）
- `scripts/validate_timetable.py`：课表 JSON 校验脚本
- `scripts/build_meta.py`：生成 `meta.json` 脚本
