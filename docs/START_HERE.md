# 从这里开始：用课堂文件和练习 Excel · Start here: the classroom file and a practice Excel

> 仪表盘本身没有任何数据：它只显示你打开的 Excel。课堂上用练习工作簿（虚构的 BetterSpace 数据）示范。
> The dashboard has no data of its own: it shows the Excel you open. In class, use a practice workbook (invented BetterSpace data).

## 1. 打开仪表盘 · Open the dashboard

1. 下载 **`business-dashboard-demo.html`**：在 https://github.com/ivaninm-ai/business-dashboard-starter/releases/latest 的 Assets 里点它（或用 `npm run build` 后在 `dist/` 里找到）。
2. **双击**，用 Chrome 或 Edge 打开。页面显示「打开你的 Excel」，最上方的深红色横条写着「你自己的 Excel · 只在这台电脑上读取，不会上传」。

Download `business-dashboard-demo.html` from the release Assets (or `dist/` after `npm run build`) and double-click it. It opens on "Open your Excel".

**已测试 · Tested:** Windows 上的 Microsoft Edge 和 Google Chrome，从磁盘打开（file://）和从网址打开。Firefox 和 Safari 应该可以使用，但还没有测试过。

## 2. 打开练习 Excel · Open a practice workbook

1. 在「打开你的 Excel」页面最下方按 **下载 BetterSpace_B2B.xlsx**（或 B2C）。也可以用你自己准备好发给学生的练习 Excel。
2. 按 **选择 Excel 文件**，选刚下载的文件。数字、待办和日历马上算出来；报告日期是文件里最新的日期（B2B 练习工作簿是 2026 年 8 月 30 日）。
3. 上方的文件栏显示文件名，还有 **重新读取 Excel**、**忘记这个文件**、**清除待办决定和备注**。

The page lists the four sheets and the columns a workbook needs. A file with problems (missing sheet, wrong column name, unknown status) is refused with the sheet, row and column of the first problems.

## 3. 看数字 · Explore the figures

- **概览 Overview**：期间订单额、已收款、未收款、逾期、待完成、低库存；每个数字下面都写着它的范围。
- **订单 / 客户 / 收款 / 库存**：点表格中的一行，就能看到数字背后的那条记录。

Click any row to open the record behind a figure.

## 4. 接受一个待办，看它出现在日历上 · Accept a task and see it on the calendar

1. 打开 **待办 Tasks**。每条建议都写着理由、记录中的截止日期和「依据」。
2. 按 **接受（Accept）**。建议的日期和负责人会变成正式的行动日期。
3. 按 **编辑（Edit）**，把行动日期改成另一天，加一条备注，**保存**。
4. 打开 **日历 Calendar**：这条待办出现在你选的日期上。按 **+ 新增备注** 加一条你自己的备注。

## 5. 更新 Excel，再读一次 · Update the Excel and read it again

这是课堂上的主要示范：数据变了，仪表盘跟着变，而你的决定会保留。用 B2B 练习工作簿：

1. 在 Excel 打开 BetterSpace_B2B.xlsx，到 **Payments** 工作表最下面加一行：

   | payment_id | sale_id | payment_date | amount | payment_method |
   |---|---|---|---|---|
   | BP-UPDATE | BS-001 | 2026-08-31 | 4500 | Bank transfer |

2. 保存，回到仪表盘按 **重新读取 Excel**，选同一个文件。

会看到 · What changes (checked by the automated tests):

| | 加这一行之前 | 之后 |
|---|---:|---:|
| 报告日期 | 2026年8月30日 | 2026年8月31日（文件里最新的日期） |
| 逾期未收款 | RM 30,515 | RM 26,015 |
| 未收款余额 | RM 91,090 | RM 86,590 |
| 期间已收款 | RM 193,765 | RM 198,265 |
| 「跟进 BS-001 的收款」 | 有 | 消失（已付清） |
| 逾期未完成 | 0 | 1（BS-003 原定 8 月 30 日完成） |

其他待办的决定（按同一个编号 `规则:记录ID`）都保留。Decisions on the other tasks are kept, by the same task key.

## 6. 格式不同的 Excel · A workbook in another layout

学生自己的 Excel 多半格式不同（中文工作表名和列名、不同的状态写法、没有库存……）。仪表盘会出现 **对应你的列**：先猜好哪个工作表、哪一列是什么，学生检查后按 **用这个对应打开**；同样格式的文件以后自动套用。

课堂示范可以用仓库里 `test/fixtures/` 的两个虚构例子：

| 文件 | 格式 | 打开后 |
|---|---|---|
| `KopiKita_Cafe_2026.xlsx` | 咖啡馆：会员、销售单、收款记录、存货；中文列名、文字日期、「RM 12.50」金额、状态 已完成 / 制作中 / 已取消 | 全部自动对应好，直接打开 |
| `Cerdik_Tuition_2026.xlsx` | 补习中心：Students、Invoices、Invoice Lines、Receipts、Classes；没有库存 | 库存选「我没有这个」，库存页隐藏；未收款余额 RM 1,800 |

The matching page pre-fills its guesses; the viewer checks them once, and the same layout opens directly next time.

## 7. 请 Gemini 分析（可选）· Ask Gemini (optional)

打开 **AI 分析**，贴上你自己的免费 Gemini 钥匙（aistudio.google.com/apikey），按 **用 Gemini 分析**。答案标着「实时 AI」，下面的数字核对会列出答案里在数据中找不到的数字。AI 选的三件事会排到 **待办** 最上面（标着「AI 建议」），日历上用虚线显示，按 **接受** 才算正式待办。只有这个按钮会联网；按之前什么都不会送出。客户和员工名字默认换成代号。

Open **AI analysis**, paste your own free Gemini key, press **Analyse with Gemini**. Its top three tasks appear at the top of **Tasks** ("AI pick") and dashed on the calendar until you accept them. Only this button goes online.

## 保存说明 · About saving

- Excel、待办决定、备注、AI 分析、语言和 Gemini 钥匙只保存在**这台电脑的这个浏览器**里。这**不是备份**，不会同步，也不会给别人看到。
- 换浏览器、换电脑、清除浏览器数据，都会从头开始。
- 在 Chrome 和 Edge 中，同一台电脑上所有从磁盘打开的仪表盘文件**共用同一份保存状态**。两个学生共用一台电脑时，请先按「忘记这个文件」。
- 想让别人看同样的数字：请他在自己的电脑上打开同一个 Excel。

Saving is per browser on this computer — not a backup, not shared. To show someone the same numbers, they open the same workbook on their own computer.

## 练习数据核对表 · Practice data checks

打开练习工作簿时，这些数字由自动测试与培训包的答案核对过。These figures are checked against the pack's answer keys by the automated tests.

| | BetterSpace_B2C.xlsx | BetterSpace_B2B.xlsx |
|---|---:|---:|
| 8 月订单额 · August order value (RM) | 25,650 | 231,060 |
| 8 月订单数 · August orders | 104 | 32 |
| 8 月已收款 · August cash (RM) | 25,650 | 193,765 |
| 未收款余额 · Outstanding (RM) | 0 | 91,090 |
| 逾期未收款 · Overdue (RM) | 0 | 30,515 |
| 低库存商品 · Low-stock items | 3 | 3 |
| 逾期未完成 · Overdue completions | 8 | 0 |
