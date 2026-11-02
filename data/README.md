# 练习数据 · Training data

所有记录都是虚构的 BetterSpace 培训数据，没有真实的客户、地址、电话或平台连接。联系地址都使用 example.com。

**仪表盘本身不含这些记录**：它只显示使用者打开的 Excel。这里的 CSV 是自动测试用的材料；`templates/` 的两个工作簿是给学生下载试用的练习 Excel。

**The dashboard contains none of these records**: it only shows the Excel the viewer opens. The CSV files are test material; the two workbooks in `templates/` are practice workbooks students can download.

All records are invented BetterSpace training data. No real customers, addresses, phone numbers or platform connections.

| 文件夹 · Folder | 内容 · Contents | 来源 · Source (copied unchanged) |
|---|---|---|
| `betterspace-b2c/day1/` | Customers, Sales, Payments, Stock CSV + `metadata.json` (as_of_date 2026-08-30) | `01_B2C_Retail/csv/`, `01_B2C_Retail/metadata.json` |
| `betterspace-b2c/day2/` | same, as_of_date 2026-08-31 | `01_B2C_Retail/refresh_day2/` |
| `betterspace-b2b/day1/` | same, as_of_date 2026-08-30 | `02_B2B_Furniture/csv/`, `02_B2B_Furniture/metadata.json` |
| `betterspace-b2b/day2/` | same, as_of_date 2026-08-31 | `02_B2B_Furniture/refresh_day2/` |
| `*/business.json` | 列名对应、状态含义、待办规则（打包进网页的只有这些格式和规则）· column mapping, status meanings, task rules (only these are packed into the page) | adapted from the template's `config/examples/betterspace-*.setup-package.json` |
| `templates/BetterSpace_B2C.xlsx`, `templates/BetterSpace_B2B.xlsx` | 练习工作簿：Excel 需要的格式，可在页面上下载 · practice workbooks: the layout a workbook needs, downloadable in the app | `01_B2C_Retail/BetterSpace_B2C.xlsx`, `02_B2B_Furniture/BetterSpace_B2B.xlsx` (Day 1) |
| `DATA_DICTIONARY.md`, `METRIC_RULES.md` | 字段定义和计算规则 · field definitions and metric rules | the training pack |

## 规则 · Rules

- **第 2 天取代第 1 天**，不是叠加的新批次。Day 2 replaces Day 1; never add them together.
- **报告日期来自 `metadata.json` 的 `as_of_date`**，不是电脑的今天日期。The reporting date is `metadata.as_of_date`, never the clock.
- **答案（`expected_metrics.json`）只放在 `test/expected/`**，应用从不读取，只用来测试。Answer keys live in `test/expected/` and are only read by tests.
- 修改这里的任何文件后，运行 `npm run data`（`npm run dev`、`npm run build` 会自动运行），再运行 `npm test`。After changing a file here, run `npm run data` and then `npm test`.
- 一旦修改了 CSV 或练习工作簿，`test/expected/` 的答案就不再适用：请用独立的计算更新它们。Once you change the records, the answer keys no longer apply — update them from an independent calculation.
