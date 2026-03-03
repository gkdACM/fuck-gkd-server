# 学校课表静态站（先展示，后导入）

这个项目支持两种模式：

- **导入模式（推荐当前使用）**：在 GitHub Actions 手动导入课表 JSON，直接发布网站。
- **抓取模式（开学后使用）**：在可访问学校系统的环境抓取并更新 `public/timetable.json`。

## 1. 先上线展示站点

1) 在仓库 `Settings -> Pages` 里把来源设为 `GitHub Actions`。  
2) 到 `Actions` 页面手动运行 `Deploy Static Site`。  
3) 等待完成后，工作流日志会显示 Pages 地址。

当前示例数据文件是 `public/timetable.json`，页面会直接读取它并展示。

## 2. 导入模式（Actions 手动导入）

新增工作流：`.github/workflows/import-timetable.yml`

使用步骤：

1) 打开 `Actions -> Import Timetable Data -> 运行工作流程`。
2) 在 `payload` 粘贴课表数据（JSON 字符串或 Base64(JSON)）。
3) `input_format` 选 `auto`（默认自动识别）即可。
4) `commit_changes=true` 会把结果写回 `public/timetable.json` 并推送到仓库。
5) `deploy_pages=true` 会在同一个工作流里直接部署 Pages。

## 3. payload 最小格式

```json
{
  "generated_at": "2026-03-03T00:00:00+00:00",
  "source": "manual",
  "headers": ["星期", "节次", "课程", "教师", "地点", "周次"],
  "rows": [
    {
      "星期": "周一",
      "节次": "1-2",
      "课程": "高等数学",
      "教师": "张老师",
      "地点": "A101",
      "周次": "1-16"
    }
  ]
}
```

说明：

- 必须有 `rows`，且 `rows` 是对象数组。
- `headers` 可省略（工作流会自动按第一行生成）。
- `generated_at` / `source` 可省略（工作流会自动补全）。

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

## 5. 抓取模式（后续启用）

工作流：`.github/workflows/update-timetable.yml`

它适合在能访问学校系统（校园网/VPN/内网机器）的环境使用。  
如果使用 GitHub 托管 runner 且学校系统是内网地址，抓取会失败，这是正常现象。

## 6. 关键文件

- `.github/workflows/import-timetable.yml`：手动导入 + 可选部署
- `.github/workflows/deploy-pages.yml`：静态站部署
- `public/timetable.json`：前端读取的数据源
- `public/app.js`：展示逻辑
