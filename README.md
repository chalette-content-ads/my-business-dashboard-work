# 业务仪表盘起步项目 · Business Dashboard Starter

一个**不需要任何设置**的小企业仪表盘起步项目。它本身没有任何数据：打开你的 Excel（格式和练习工作簿不同的，先用「对应你的列」对应一次），就会看到经营概况、销售、客户、收款、库存、待办和日历，还可以用你自己的免费 Gemini 钥匙请 AI 分析。中文为默认语言，也可以切换成英文。

A **setup-free** small-business dashboard starter. It has no data of its own: open your Excel workbook (another layout is matched once with "Match your columns") to see overview, sales, customers, payments, stock, tasks and calendar, and ask Gemini for an analysis with your own free key. Chinese by default, English available.

> 这是学习用的起步项目，不是正式系统。你的 Excel 只在你的浏览器里读取，不会上传。
> A learning starter, not a production system. Your Excel is read in your browser and never uploaded.

## 马上开始 · Quick start

| 我想… · I want to… | 做法 · How |
|---|---|
| 打开仪表盘 · Open the dashboard | 从 [Releases](https://github.com/ivaninm-ai/business-dashboard-starter/releases/latest) 下载 `business-dashboard-demo.html`，双击打开，再选你的 Excel（或页面上的练习工作簿）· Download it from Releases, double-click, then choose your Excel (or a practice workbook from the page). See [docs/START_HERE.md](docs/START_HERE.md). |
| 在浏览器里阅读学生指南 · Read the student guide | 打开 [docs/student-guide.html](docs/student-guide.html) |
| 建立自己的版本 · Get my own copy | 按本页右上方的 **Use this template → Create a new repository**，然后按学生指南操作 · Press **Use this template**, then follow the student guide |
| 设定店名 · Set my business name | 仓库 **Settings → Secrets and variables → Actions → Variables** 加 `BUSINESS_NAME`，再运行 **Publish site**——不用改文件 · Add the repository variable, then run Publish site. See [docs/STUDENT_SOP.md](docs/STUDENT_SOP.md) §8. |
| 请 AI 分析数字 · Ask an AI about the numbers | 在 Google AI Studio 拿一把免费的 Gemini 钥匙，贴到「AI 分析」页，按 **用 Gemini 分析** · Get a free Gemini key in Google AI Studio, paste it on the AI analysis page, press **Analyse with Gemini** |
| 请 AI 加功能 · Have an AI add a feature | 用电脑上的 Claude Code：它会下载你的项目、改好、检查、打开给你看，再上传回 GitHub。见 [docs/STUDENT_SOP.md](docs/STUDENT_SOP.md) §9 · Use Claude Code on your own computer: it downloads the project, makes and checks the change, shows it to you, then pushes it back |

开发命令（需要 Node.js 22 或更新版本）· Development commands (Node.js 22+):

```bash
npm install
```

```bash
npm run dev
```

然后打开 http://localhost:5173 。其他命令：`npm test`（核对数字与规则）、`npm run build`（生成可双击打开的单一 HTML 文件）、`npm run check`（两者都做）。

Then open http://localhost:5173. Also: `npm test` (checks figures and rules), `npm run build` (makes the single double-clickable HTML file), `npm run check` (both).

## 它做什么，不做什么 · What it does and does not do

**会做 · Does**
- 读取你的 Excel，在这台电脑上计算所有数字；报告日期是文件里最新的日期。
- **对应你的列**：Excel 格式和练习工作簿不一样（工作表名、列名、状态写法不同，或没有库存等工作表）时，页面会先猜好哪个工作表、哪一列是什么，你检查后打开；同样格式的文件以后自动套用。
- 接受、完成、忽略待办，修改行动日期；在日历上加备注；这些操作保存在**这个浏览器**里。
- Excel 更新后按「重新读取 Excel」：数字跟着变，同一笔记录的待办决定按稳定的编号保留。
- **用 Gemini 分析**（可选）：用你自己的免费 Gemini 钥匙，按现在的数字写实时分析，标明是 AI 写的，并自动核对里面的数字。它说最该先做的三件事会排到待办最上面，要留意的日期在日历上标「AI」；接受与否由你决定。钥匙只存在你的浏览器。
- 提供两个练习工作簿（虚构的 BetterSpace 数据）下载，给还没有自己数据的人试用。

**不会做 · Does not**
- 不登录、不需要服务器。除了可选的「用 Gemini 分析」，不联网；页面的安全策略只允许连到 Google 的 Gemini API 这一个地址。
- 网站本身不含任何业务数据；你的 Excel 不会上传，也不会发布到网站上。
- 只懂订单、客户、收款和库存这几种记录；其他记录（例如上课出席、订阅）会被忽略，需要改程序。不做云端备份或多设备同步，没有团队共享。

## 文件夹 · Folders

```
src/            网页本身（未打包，可直接阅读）· the app, unbundled
  core/         计算、待办规则、日历（纯函数，浏览器和测试共用）· figures, task rules, calendar
  data/         读取你的 Excel（workbook.js）、对应你的列（matching.js）；*.generated.js 由 npm run data 生成（只有列的格式和练习工作簿）
  vendor/       打包好的 Excel 读取器（read-excel-file，MIT），由 npm run vendor 生成
  storage/      浏览器本地保存（localStorage）· browser-local state
  briefs/       Gemini 请求（ai-prompt.js、gemini.js）和数字核对 · Gemini request and number check
  i18n/         中文/英文 · translations
  ui/           页面、组件、外框 · pages, components, shell
data/           测试材料：BetterSpace 练习数据（CSV）和 business.json（列的格式、规则）；templates/ 是练习工作簿 · test material and practice workbooks
test/           自动测试；test/expected/ 是答案；test/fixtures/ 是两个格式不同的虚构 Excel（咖啡馆、补习中心）· tests, answer keys, other-layout workbooks
scripts/        pack-data（打包格式和练习工作簿）、serve（开发服务器）、build（单一文件）
docs/           使用说明 · documentation
```

## 来源 · Provenance

- 计算、待办、日历、字段对应和界面翻译，改编自 Business Dashboard 模板 1.2.0（rc.4/rc.5）的代码；Google 登录、Sheets 存储、后台 worker 和设置向导都已移除。视觉风格后来重新设计过，保留了品牌的酒红色。
- 练习数据原样复制自 BetterSpace 虚构培训数据包（`01_B2C_Retail`、`02_B2B_Furniture` 及其 `refresh_day2`），只用于测试和练习工作簿，见 [data/README.md](data/README.md)。
- Figures, task rules, calendar, column mapping and translations are adapted from the Business Dashboard template 1.2.0 (rc.4/rc.5); Google sign-in, Sheets storage, background workers and the setup wizard were removed. The look has since been redesigned, keeping the brand's wine colour. The BetterSpace training data is copied unchanged from the synthetic pack and used only by the tests and as practice workbooks.

## 授权 · Licence

[MIT License](LICENSE) · Copyright (c) 2026 Infinite New Media

- 你可以自由使用、修改、分享，也可以商用或请程序员帮你扩展，只要在你的版本里保留 `LICENSE` 文件（版权声明）。
- 软件按「原样」提供，不附带任何保证；用它做决定时请自己核对数字。
- 打包在网页里的 Excel 读取器（read-excel-file、fflate）由它们的作者以 MIT 授权，声明保留在 `src/vendor/read-excel-file.js` 里。

You may use, change, share and sell it, or have someone build on it for you, as long as you keep the `LICENSE` file (the copyright notice) in your copy. It is provided as is, without warranty. The bundled Excel reader (read-excel-file, fflate) is MIT-licensed by its own authors; its notices are kept in `src/vendor/read-excel-file.js`.
