# 学生操作指南：建立和扩展你自己的版本 · Student SOP: your own copy

这份指南给课后想自己动手的学生。你会得到一份属于自己的项目，在自己的电脑上运行、修改、测试，最后（如果愿意）发布到自己的账号下。

For students who want to build on the starter after class: get your own copy, run it, change it, test it, and optionally publish it under your own account.

> **先记住三件事 · Three things to remember**
> 1. **浏览器本地保存不是云端备份。** 数据只在那台电脑的那个浏览器里。Local browser saving is not a cloud backup.
> 2. **仪表盘本身没有数据。** 它只显示你打开的 Excel，Excel 不会上传，也不会进入网站。The dashboard has no data of its own: it shows the Excel you open, which is never uploaded or published.
> 3. **这是学习用的起步项目，不适合放机密的真实业务数据。** This is a learning starter, not a system for confidential business data.

---

## 1. 建立你自己的仓库 · Create your own repository

模板在这里：**https://github.com/ivaninm-ai/business-dashboard-starter**

1. 打开上面的模板页面（需要先登录你自己的 GitHub 账号，没有就免费注册一个），按 **Use this template → Create a new repository**。
2. Owner 选你自己的账号，取一个名字（例如 `my-business-dashboard`），按 **Create repository**。
3. 把它下载到电脑：用 **GitHub Desktop**（Code → Open with GitHub Desktop），或在终端运行 `git clone <你的仓库地址>`。

不想用 GitHub？在模板页面按 **Code → Download ZIP**，解压即可（但这样就没有版本记录）。

Template: https://github.com/ivaninm-ai/business-dashboard-starter — sign in to your own GitHub account, press **Use this template → Create a new repository**, then clone it (GitHub Desktop or `git clone`). Or download the ZIP.

## 2. 开发环境 · Development environment

只需要 **Node.js 22 或更新版本**（到 nodejs.org 下载 LTS 版本安装）。装好后在项目文件夹打开终端：

```bash
node --version
```

```bash
npm install
```

```bash
npm run dev
```

打开 **http://localhost:5173**。修改 `src/` 里的文件后，重新载入浏览器就能看到变化。按 Ctrl+C 停止。

| 命令 · Command | 作用 · What it does |
|---|---|
| `npm run dev` | 打包数据，然后在 http://localhost:5173 运行未打包的源代码 · packs data, serves `src/` |
| `npm test` | 核对所有数字、规则、翻译、Gemini 请求和数据边界 · checks figures, rules, translations, the Gemini request, boundaries |
| `npm run build` | 生成 `dist/business-dashboard-demo.html`（可双击打开的单一文件）和 `dist/site/index.html` |
| `npm run check` | 先 build 再 test：分享前运行这个 · build + test; run before sharing |
| `npm run data` | 只重新打包 `data/`（练习数据和 Excel 范例）· repack `data/` only |
| `npm run vendor` | 重新生成 Excel 读取器 `src/vendor/read-excel-file.js`（升级 read-excel-file 之后）· rebuild the vendored Excel reader |

> 用 npm 11 安装时可能看到 esbuild「install-scripts」的提示。这是正常的，打包仍然可以使用。
> npm 11 may warn that esbuild's install script was skipped; the build still works.

为什么开发时要用 `npm run dev`？浏览器不允许从磁盘（file://）直接载入多个 JavaScript 模块。`npm run build` 生成的单一文件没有这个限制，所以它可以双击打开。

## 3. 文件夹和数据流 · Folders and data flow

```
你的 Excel（.xlsx，四个工作表）                     data/*/business.json（列的格式、规则）
            │  src/data/workbook.js 读取                     │  npm run data
            ▼                                                ▼
src/vendor/read-excel-file.js  ──►  src/data/workbook.js  ◄──  src/data/layouts.generated.js
                                    对应列名、检查记录；报告日期 = 文件里最新的日期
            ▼
src/core/metrics.js       数字（订单额、收款、余额、库存……）
src/core/tasks.js         待办建议规则（每条有稳定编号 规则:记录ID）
src/core/scenario-tasks.js  建议 + 你存下的决定
src/core/calendar.js      日历项目
            ▼                                   ▲
src/ui/view-state.js  筛选和算出的数字  ◄──  src/storage/local-state.js
            ▼                                   （Excel、待办决定、备注、AI 分析、语言、Gemini 钥匙，存在 localStorage）
src/ui/pages/*.js     每一页；文字都经过 tr()/tl()（src/i18n/）
src/briefs/           brief-input.js 事实清单；ai-prompt.js 给 Gemini 的请求；gemini.js 联网；brief-facts.js 数字核对
```

测试用的 BetterSpace 练习数据（`data/*/day1|day2/*.csv`）由 `test/support/training.js` 读取，应用本身从不读取。

- `src/core/` 里的函数不碰网页（DOM），浏览器和测试都用同一份代码。
- 页面每次有变化就整页重画（数据很小，不需要框架）。
- 所有显示给用户的文字都要写成 `tr('English')`（普通文字）或 `tl('English')`（菜单、按钮），并在 `src/i18n/zh.js` 加上中文。`npm test` 会找出漏掉的翻译。

## 4. 动手扩展 · Recipes

每个练习完成后都运行 `npm test`，并在浏览器里看一遍。

### 4.1 新增一个 KPI · Add a KPI tile

例子：想看「本期服务类订单额」（安装、咨询）。用练习工作簿 BetterSpace_B2B.xlsx 核对。

1. **计算**：在 `src/core/metrics.js` 的 `computeMetrics()` 返回值里加一个字段：
   ```js
   service_order_value: inPeriod.filter(s => s.offering_type === 'service').reduce((a, s) => a + s.amount, 0),
   ```
2. **显示**：在 `src/ui/pages/overview.js` 的 tiles 里加：
   ```js
   add(tiles, tile({ label: tr('Service order value'), value: money(m.service_order_value), foot: tr('installation and consultation in the period') }));
   ```
3. **翻译**：在 `src/i18n/zh.js` 加上 `'Service order value': '服务类订单额'` 和第二句的中文。
4. **测试**：在 `test/metrics.test.js` 加一个测试。正确答案要**自己从数据算出来**，不能从应用里抄：练习工作簿 BetterSpace_B2B.xlsx（= B2B 第 1 天）8 月有 5 笔服务订单，合计 **RM 3,400**（可以在「订单」页搜索 installation 和 consultation 核对）。
   ```js
   test('b2b day1: service order value in August', () => {
     const s = loadScenario('betterspace-b2b', 'day1');
     const m = computeMetrics(s.records, s.reportingDate, { historyStart: s.historyStart });
     assert.equal(m.service_order_value, 340000); // cents
   });
   ```

### 4.2 新增一个图表 · Add a chart

`src/ui/components.js` 里有 `trendChart()`（柱状图）和 `hbars()`（横条）。例子：在概览加「按产品的订单额」：

1. 在页面里按 `description` 汇总本期订单额（或像 4.1 一样加到 `computeMetrics()` 的 `by_item`）。
2. `add(grid, h('div', { class: 'card' }, t('h2', tr('Order value by product')), hbars(items)))`，`items` 是 `[{ label, value }]`（value 以「分」为单位）。
3. 颜色只用 `src/style.css` 里的变量（`--accent`、`--series-2`、`--series-3`），它们检查过对比度和色盲可辨识度。

### 4.3 新增一条待办规则 · Add a task rule

例子：B2C「感谢回头客」——本月下单 2 次以上的客户。

1. `src/core/model.js` 的 `TASK_RULES` 加一项：`thank_repeat_customer: { title: 'Thank a repeat customer', needs: ['customers', 'sales'], params: {}, doc: '...' }`。
2. `src/core/tasks.js` 的 `generateSuggestions()` 加一个 `case 'thank_repeat_customer':`，对 `metrics.repeat_customer_ids` 逐一 `push({ rule, record_type: 'customers', record_id: id, title: tr(...), reason: tr(...), evidence: {...}, recorded_deadline: '', suggested_date: reportingDate, suggested_owner: '' })`。
   **编号必须稳定**：`task_key` 自动是 `规则:记录ID`，重新读取更新后的 Excel 时，决定才对得上。不要把日期或序号放进编号。
3. 在 `data/betterspace-b2c/business.json` 和 `data/betterspace-b2b/business.json` 的 `policies.tasks` 加 `{ "rule": "thank_repeat_customer", "enabled": true }`（Excel 按有没有负责人和跟进日期，套用 B2B 或 B2C 的规则），然后 `npm run data`。
4. 翻译规则名称和文字；在 `test/` 加测试（例如第 1 天应产生 22 条，因为有 22 位回头客）。
5. 注意：`test/state.test.js` 里写死了 B2B 练习数据有 45 条建议——加了规则就要更新这个数字。

### 4.4 新增一个页面 · Add a page

1. 复制 `src/ui/pages/stock.js` 为 `src/ui/pages/products.js`，改成 `export function renderProducts() { ... }`，返回一个 DOM 元素。
2. 在 `src/main.js` 加 `import { renderProducts } from './ui/pages/products.js';` 和 `registerPage('products', guarded(renderProducts));`。
3. 在 `src/ui/shell.js` 的 `NAV` 加 `['products', () => tl('Products')]`。
4. 翻译新文字，`npm test`，然后在浏览器打开 `#products`。

## 5. 用你自己的数据 · Your own data

**不用改代码：打开你的 Excel。** 仪表盘本身没有数据。按「选择 Excel 文件」，打开一个和练习工作簿（`data/templates/`）格式相同的 `.xlsx`：四个工作表 Customers、Sales、Payments、Stock，第一行是列名。它只在浏览器里读取和计算（`src/data/workbook.js`），记在这个浏览器里，不会进入仓库，也不会发布到网站上。

**格式不同的 Excel 也不用改代码：对应你的列。** 打开格式不一样的 Excel 时，页面会出现「对应你的列」（`src/ui/pages/excel.js` 的 `renderMatchPage`，逻辑在 `src/data/matching.js`）：

1. 先猜：按工作表名（例如 销售单、Invoices）和列名（例如 单号、Invoice No、金额），猜出哪个工作表是订单、客户、收款、库存，哪一列是什么，以及状态写法的意思（例如 已完成、Paid → Completed；作废、Void → Cancelled）。中英文常见写法在 `COLUMN_NAMES`、`STATUS_WORDS` 里，可以再加。
2. 学生检查、改正，按「用这个对应打开」。`applyMatching()` 把工作簿在记忆体里改写成练习工作簿的格式（标准的工作表名、列名和值），再用同一套代码读取，所以所有数字和规则都一样。
3. 只有订单工作表一定要有。没有客户、收款或库存工作表时，那几页会隐藏，需要它们的待办规则会关掉；没有客户工作表但订单有客户编号时，客户名单从订单整理出来。
4. 对应会记在浏览器里（最近五种格式，按工作表名和列名辨认）；读取同样格式的文件不再问，除非出现新的状态写法。格式稍有改变（加了列、改了列名、多了工作表）时，页面从最接近的旧对应开始（`closestMatching()`），列出不见了的列，只要检查改变的地方。
5. `test/fixtures/` 有两个格式不同的虚构 Excel：咖啡馆（中文工作表名和列名、文字日期、「RM 12.50」这样的金额）和补习中心（发票加明细、没有库存、多一个上课记录工作表）。`test/matching.test.js` 用它们检查猜测和数字。

**真正不同的业务模式**才需要改程序：目前只支持**客户、销售（一行一个订单）、收款（对应到订单）、库存快照**。例如只有发票明细、没有每张发票的总额（要先加总），或上课出席、订阅这类新记录，就要改 `src/core/model.js` 和计算规则，并加测试。

## 6. 实时 AI（Gemini）· Live AI with Gemini

「AI 分析」页的 **用 Gemini 分析** 用学生**自己的**免费 Gemini API 钥匙（Google AI Studio → Get API key）写实时分析：

1. 钥匙由学生贴在页面上，只存在那个浏览器（`bd-starter.v1.gemini`），放在请求标头 `x-goog-api-key`，只送到 Google。它**绝不**出现在代码、仓库、仓库变量或打包文件里；`scripts/site-config.js` 会拒绝像钥匙的变量值。
2. 请求 = `src/briefs/ai-prompt.js` 的固定指示（不含任何数字）+ `buildBriefInput()` 的事实（包括这个浏览器里的待办决定和备注）。客户和员工名字默认换成代号。
3. `src/briefs/gemini.js` 是唯一会联网的模块：`https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent`，先用 `gemini-flash-latest`，忙或额度用完时改用 `gemini-flash-lite-latest`。CSP 的 `connect-src` 只允许这个网址（`src/index.html`、`scripts/build.js`），`test/boundaries.test.js` 检查只有这个模块会发请求。
4. 回答标明「实时 AI」、模型和时间；显示前用 `answerProblems()`（`unsupportedTokens()`）核对，找不到的数字会列出来。没有假的「打字」效果。
5. 回答照固定格式（`AI_PLAN_SCHEMA`，在 `generationConfig.responseSchema`）：现在的情况、最该先做的三件事（待办编号）、两周内要留意的日历项目（日历编号）、数据回答不了的问题。`readAiPlan()` 只留下数据里真的有的编号；结果存在 `bd-starter.v1.ai.<businessId>`，待办最上面标「AI 建议」，日历上标「AI」（还没接受的用虚线）。AI 不会替学生接受或改任何待办；Excel 的记录变了，旧的标记就不显示（`dataBasis()`）。
5. 隐私：Google 免费方案会用送出的内容改进产品，并请用户不要送出个人或机密资料。真实企业数据先确认企业规定和隐私法（例如马来西亚 PDPA）。

Google 的文件建议正式产品不要在网页里用钥匙，而是经过自己的服务器。这个起步项目让每个学生只用自己的钥匙、只在自己的浏览器里；要做给别人用的正式产品，请把呼叫移到你控制的服务器（例如 Cloudflare Workers），钥匙存成那里的 secret。

The **Analyse with Gemini** button uses the viewer's own free Gemini API key, kept only in their browser and sent only to Google in a request header. `src/briefs/gemini.js` is the only module that makes requests, and the CSP allows only the Gemini API. Answers are labelled as live AI and number-checked. They come in a fixed shape, so the three tasks to do first are marked at the top of Tasks and the dates to watch are marked on the calendar (only keys and ids that are in the data; nothing is accepted for the viewer). For a product other people use, move the call to a server you control.

## 7. 以后接入真正的存储 · Adding real storage later

所有保存都经过 `src/storage/local-state.js` 的 `createStateStore()`：`prefs / setPrefs / business / day / setDay / decisions / saveDecision / notes / saveNote / deleteNote / resetBusiness / resetAll`。要改成云端（例如 Supabase、Firebase 或自己的 API）：

- 用同样的函数名实现一个新的 store；网络请求是异步的，页面里调用的地方要改成 `await`，并处理失败。
- 需要登录、权限（谁能看、谁能改）、备份、两个人同时修改的冲突处理。
- 真实数据要遵守隐私法。这些都超出这个起步项目的范围。

## 8. 发布你自己的版本（可选）· Publish your own copy (optional)

网站本身不含任何业务数据：每个访客在自己的浏览器里打开自己的 Excel。

- **GitHub Pages**（你自己的仓库）：Settings → Pages → Build and deployment → Source 选 **GitHub Actions**。然后 Actions → **Publish site** → **Run workflow**。完成后网址是 `https://<你的用户名>.github.io/<仓库名>/`。
- **其他静态网站服务**：运行 `npm run build`，把 `dist/site/index.html` 上传到你自己账号下的静态网站服务（例如 Netlify Drop、Cloudflare Pages）。

网站上的保存状态和双击打开的文件是分开的（不同的来源）。

### 网站设定（仓库变量）· Site setting (repository variable)

不用改文件。在你的仓库 **Settings → Secrets and variables → Actions → Variables** 按 **New repository variable**，再运行 **Publish site**：

| Name | Value | 作用 · Effect |
|---|---|---|
| `BUSINESS_NAME` | 你的店名（最多 40 个字）· your business name (max 40 characters) | 左上角和浏览器分页显示这个名字；没设的话显示 Excel 的文件名 · shown at the top and in the browser tab; without it, the Excel file name |

可以不设。值写错时（太长、像钥匙），发布会在 `npm run check` 停下，红字说明哪里错，网站保持上一个版本。变量会写进公开的网页：不要放密码或钥匙。本机试用：`BUSINESS_NAME=小明家具店 npm run dev`（Windows PowerShell：先 `$env:BUSINESS_NAME='小明家具店'`）。代码在 `scripts/site-config.js`（检查）和 `src/site-config.js`（默认值）。

Optional. A wrong value stops the publish at `npm run check` with a message saying what to fix, and the site keeps its previous version. The value is built into the public page: never put a password or key in it.

## 9. 让 AI 帮忙 · Working with AI

### 9.1 请 AI 分析数字 · Ask an AI about the numbers (no code)

用「AI 分析」页的 **用 Gemini 分析**：见上面第 6 节。学生版指南第 6 步教学生拿钥匙、贴钥匙、按按钮。

Use **Analyse with Gemini** on the AI analysis page (section 6). Step 6 of the student guide shows how to get and paste a key.

### 9.2 请 AI 改代码 · Have an AI coding agent change the app

学生版指南（`docs/student-guide.html` 第 7 步）用学生电脑上已经装好的 **Claude Code**（Claude 桌面版的 Code）。第一次：请它检查并安装 Git 和 Node.js（22 版以上），把自己的仓库 `git clone` 下来，运行 `npm ci` 和 `npm run check`。之后每次用一句话提出修改；Claude 改好后运行 `npm run check`，再用 `npm run dev` 在 http://localhost:5173 打开给学生看。学生满意后请它 commit 并 push 到 main（第一次 push 会跳出 GitHub 登录窗口），然后运行 Publish site。push 到 main 会自动跑 **Tests**；Publish site 发布前也会跑 `npm run check`，所以检查没过的修改不会上线。

Claude Code 每次开始都会自动读取项目规则（`CLAUDE.md`，它指向 `AGENTS.md`）。里面写着哪些东西不能改坏：数字规则、报告日期、不内置数据、只连 Gemini、翻译、AI 的诚实标示。可以这样说：

> 在概览加一个「本期服务类订单额」KPI，加上中文翻译和测试。改完运行 npm run check，再用 npm run dev 打开给我看。

完成后自己在浏览器里看一遍，确认 `npm run check` 全部通过，再请它 push，然后运行 Publish site。
