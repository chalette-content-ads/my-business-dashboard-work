// "Match your columns": workbooks in other layouts (test/fixtures/: an invented café with
// Chinese names and text dates, and an invented tuition centre with invoices and no stock)
// are matched, rewritten into the practice layout and read by the same code. Expected
// figures are calculated here straight from the raw sheets, independently of the app.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readWorkbook, workbookScenario } from '../src/data/workbook.js';
import { guessMatching, closestMatching, applyMatching, openQuestions, refreshValues, chooseSheet, chooseColumn, chooseValue, workbookSignature } from '../src/data/matching.js';
import { computeMetrics } from '../src/core/metrics.js';
import { suggestionsFor } from '../src/core/scenario-tasks.js';
import { buildBriefInput } from '../src/briefs/brief-input.js';
import { createStateStore, memoryStorage, PREFIX } from '../src/storage/local-state.js';
import { setLocale } from '../src/i18n/i18n.js';

setLocale('en');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async file => { const b = readFileSync(path.join(root, file)); return readWorkbook(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const cents = n => Math.round(n * 100);
const money = v => Math.round(Number(String(v).replace(/[^0-9.-]/g, '')) * 100);
const open = (all, matching, fileName = 'x.xlsx') => { const { sheets, absent } = applyMatching(all, matching); return workbookScenario({ fileName, loadedAt: '2026-09-25T00:00:00.000Z', sheets, absent, matched: true }); };
const metricsOf = s => computeMetrics(s.records, s.reportingDate, { historyStart: s.historyStart });
const rowsOf = (all, name) => { const [head, ...rows] = all.find(s => s.name === name).rows; return rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i]]))); };

test('café: Chinese sheet and column names, text dates and "RM" amounts are matched without questions', async () => {
  const { all, missing } = await load('test/fixtures/KopiKita_Cafe_2026.xlsx');
  assert.equal(missing.length, 4, 'not the practice layout');
  const m = guessMatching(all);
  assert.deepEqual(m.roles, { Sales: '销售单', Customers: '会员', Payments: '收款记录', Stock: '存货' });
  assert.deepEqual(m.columns.Sales, { id: '单号', date: '日期', amount: '金额', customer_id: '会员编号', description: '品项', quantity: '数量', unit_price: '单价', channel: '渠道', status: '状态', payment_due_date: '付款期限', promised_completion_date: '取货日期' });
  assert.deepEqual(m.columns.Payments, { id: '收据号', sale_id: '单号', date: '付款日期', amount: '金额', method: '付款方式' });
  assert.deepEqual(m.values['Sales.status'], { 已完成: 'Completed', 已取消: 'Cancelled', 制作中: 'In Progress' });
  assert.equal(m.dateOrder, 'dmy');
  assert.deepEqual(openQuestions(all, m), []);

  const s = open(all, m, 'KopiKita_Cafe_2026.xlsx');
  assert.equal(s.ok, true, JSON.stringify(s.issues.filter(i => i.level === 'error').slice(0, 3)));
  assert.equal(s.reportingDate, '2026-09-24');
  const sales = rowsOf(all, '销售单').filter(r => r['状态'] !== '已取消');
  const paid = {};
  for (const p of rowsOf(all, '收款记录')) paid[p['单号']] = (paid[p['单号']] || 0) + money(p['金额']);
  const x = metricsOf(s);
  assert.equal(x.all_time_order_value, sales.reduce((a, r) => a + money(r['金额']), 0));
  assert.equal(x.outstanding_balance, sales.reduce((a, r) => a + Math.max(0, money(r['金额']) - (paid[r['单号']] || 0)), 0));
  assert.deepEqual(x.low_stock_ids, ['I01', 'I03', 'I04', 'I08', 'I10', 'I12'], 'on hand minus reserved at or below the safety stock');
  assert.deepEqual(s.source.absent, []);
  assert.equal(s.source.matched, true);
  assert.deepEqual(s.issues.filter(i => i.level === 'warning'), [], 'the columns the viewer left out are not reported again');
});

test('tuition centre: invoices become orders, receipts payments; no stock sheet, so stock is switched off', async () => {
  const { all } = await load('test/fixtures/Cerdik_Tuition_2026.xlsx');
  const m = guessMatching(all);
  assert.deepEqual(m.roles, { Sales: 'Invoices', Customers: 'Students', Payments: 'Receipts', Stock: null }, 'Invoice Lines and Classes are not mistaken for stock');
  assert.deepEqual(m.values['Sales.status'], { Paid: 'Completed', Issued: 'Completed', Void: 'Cancelled', 'Partially Paid': 'Completed' });
  assert.deepEqual(openQuestions(all, m), []);
  const s = open(all, m, 'Cerdik_Tuition_2026.xlsx');
  assert.equal(s.ok, true, JSON.stringify(s.issues.filter(i => i.level === 'error').slice(0, 3)));
  assert.deepEqual(s.source.absent, ['Stock']);
  const invoices = rowsOf(all, 'Invoices'); // Invoice Total and Balance are the workbook's own formulas, computed by Excel
  const x = metricsOf(s);
  assert.equal(x.all_time_order_value, cents(invoices.filter(r => r.Status !== 'Void').reduce((a, r) => a + r['Invoice Total'], 0)));
  assert.equal(x.outstanding_balance, cents(invoices.reduce((a, r) => a + r.Balance, 0)));
  assert.equal(x.outstanding_balance, cents(1800));
  assert.equal(x.low_stock_ids.length, 0);
  const rules = new Set(suggestionsFor(s).map(t => t.rule));
  assert.ok(rules.has('payment_follow_up') && !rules.has('review_replenishment'), [...rules].join(','));
});

test('the practice workbook gives the same figures through the matching as directly', async () => {
  const read = await load('data/templates/BetterSpace_B2B.xlsx');
  const direct = workbookScenario({ fileName: 'b.xlsx', loadedAt: '2026-09-25T00:00:00.000Z', sheets: read.sheets });
  const matched = open(read.all, guessMatching(read.all));
  assert.equal(matched.ok, true);
  assert.deepEqual(metricsOf(matched), metricsOf(direct));
  assert.deepEqual(suggestionsFor(matched).map(t => t.task_key), suggestionsFor(direct).map(t => t.task_key));
});

test('a remembered matching fits the same layout again; new status words are asked, earlier answers kept', async () => {
  const { all } = await load('test/fixtures/KopiKita_Cafe_2026.xlsx');
  const saved = chooseValue(guessMatching(all), 'Sales.status', '制作中', 'Confirmed');
  assert.equal(workbookSignature(all), workbookSignature(structuredClone(all)), 'same sheets and columns, same signature');
  const renamed = all.map(s => (s.name === '销售单' ? { ...s, rows: [s.rows[0].map(h => (h === '渠道' ? '平台' : h)), ...s.rows.slice(1)] } : s));
  assert.notEqual(workbookSignature(renamed), workbookSignature(all), 'a renamed column is a new layout');
  const updated = all.map(s => (s.name === '销售单' ? { ...s, rows: [...s.rows, ['S0925-01', '25/09/2026', '', 'Kopi O', 1, 3.2, 'RM 3.20', '门市', '待付款', '', '']] } : s));
  const again = refreshValues(updated, saved);
  assert.equal(again.values['Sales.status']['制作中'], 'Confirmed', 'earlier answer kept');
  assert.deepEqual(openQuestions(updated, again).filter(q => q.kind === 'value').map(q => q.value), ['待付款']);
});

test('a layout that changed a little starts from the closest earlier matching, not fresh guesses', async () => {
  const { all } = await load('test/fixtures/KopiKita_Cafe_2026.xlsx');
  const onSales = (sheets, f) => sheets.map(s => (s.name === '销售单' ? f(s) : s));
  const rename = (sheets, from, to) => onSales(sheets, s => ({ ...s, rows: [s.rows[0].map(h => (h === from ? to : h)), ...s.rows.slice(1)] }));
  // The owner's own name for the amount, which the dashboard cannot guess, chosen by hand once.
  const first = rename(all, '金额', 'Jumlah RM');
  assert.equal(guessMatching(first).columns.Sales.amount, undefined, 'not guessed');
  const saved = chooseValue(chooseColumn(first, guessMatching(first), 'Sales', 'amount', 'Jumlah RM'), 'Sales.status', '制作中', 'Confirmed');
  assert.deepEqual(openQuestions(first, saved), []);
  // Later: a notes column and a new sheet are added, and 渠道 is renamed 平台.
  const later = onSales(rename(first, '渠道', '平台'), s => ({ ...s, rows: s.rows.map((r, i) => [...r, i ? '' : 'Catatan']) })).concat([{ name: '备注', rows: [['日期', '内容']] }]);
  assert.notEqual(workbookSignature(later), workbookSignature(first), 'a new layout');
  assert.equal(guessMatching(later).columns.Sales.amount, undefined, 'fresh guesses would ask for the amount again');
  const c = closestMatching(later, [guessMatching(all), saved]);
  assert.deepEqual(c.matching.roles, saved.roles);
  assert.equal(c.matching.columns.Sales.amount, 'Jumlah RM', 'the closest earlier matching wins and its choice is kept');
  assert.equal(c.matching.values['Sales.status']['制作中'], 'Confirmed', 'earlier meaning kept');
  assert.deepEqual(c.lost, [{ role: 'Sales', canonical: 'channel', header: '渠道' }], 'what is gone is listed');
  assert.deepEqual(openQuestions(later, c.matching), []);
  assert.equal(metricsOf(open(later, c.matching)).all_time_order_value, metricsOf(open(first, saved)).all_time_order_value);
  assert.equal(closestMatching(later.map(s => (s.name === '销售单' ? { ...s, name: 'Invoices' } : s)), [saved]), null, 'no earlier matching has this orders sheet');
  const store = createStateStore(memoryStorage());
  store.setMatching('old', guessMatching(all));
  store.setMatching('new', saved);
  assert.deepEqual(store.matchings().map(m => m.columns.Sales.amount), ['Jumlah RM', '金额'], 'most recent first');
});

test('changing the sheet re-guesses its columns; a required column left out is asked', async () => {
  const { all } = await load('test/fixtures/Cerdik_Tuition_2026.xlsx');
  let m = guessMatching(all);
  m = chooseColumn(all, m, 'Sales', 'amount', '');
  assert.deepEqual(openQuestions(all, m), [{ kind: 'column', role: 'Sales', canonical: 'amount' }]);
  m = chooseSheet(all, m, 'Stock', 'Invoice Lines');
  assert.ok(openQuestions(all, m).some(q => q.role === 'Stock' && q.canonical === 'id'), 'the wrong sheet shows what is missing');
  m = chooseSheet(all, m, 'Stock', null);
  m = chooseSheet(all, m, 'Sales', null);
  assert.ok(openQuestions(all, m).some(q => q.kind === 'sheet'));
});

test('month-first text dates, and a workbook with only orders', () => {
  const all = [{ name: 'Orders', rows: [['Order No', 'Order Date', 'Customer ID', 'Total'], ['A1', '09/13/2026', 'C1', 100], ['A2', '09/14/2026', 'C2', 'RM 50'], ['A3', '09/14/2026', 'C1', 20]] }];
  const m = guessMatching(all);
  assert.equal(m.dateOrder, 'mdy');
  assert.deepEqual(m.roles, { Sales: 'Orders', Customers: null, Payments: null, Stock: null });
  const s = open(all, m);
  assert.equal(s.ok, true, JSON.stringify(s.issues));
  assert.deepEqual(s.records.sales.map(r => r.date), ['2026-09-13', '2026-09-14', '2026-09-14']);
  assert.deepEqual(s.records.customers.map(c => c.id), ['C1', 'C2'], 'customers listed from the orders');
  assert.deepEqual(s.source.absent, ['Payments', 'Stock']);
  assert.deepEqual(suggestionsFor(s).filter(t => ['payment_follow_up', 'review_replenishment'].includes(t.rule)), [], 'no reminders about sheets that do not exist');
  const facts = buildBriefInput({ scenario: s, metrics: metricsOf(s), tasks: [], calendar: [] });
  assert.match(facts, /no payments sheet, so cash collected and balances are unknown/);
});

test('the matching and the matched workbook are kept in this browser; stored data is checked', async () => {
  const { all } = await load('test/fixtures/Cerdik_Tuition_2026.xlsx');
  const storage = memoryStorage();
  const store = createStateStore(storage);
  const m = guessMatching(all);
  store.setMatching('abc12345', m);
  assert.deepEqual(store.matching('abc12345'), m);
  assert.equal(store.matching('other'), null);
  for (const sig of ['s1', 's2', 's3', 's4', 's5']) store.setMatching(sig, m);
  assert.equal(store.matching('abc12345'), null, 'the last five layouts are kept');
  assert.deepEqual(store.matching('s1'), m);
  store.setMatching('abc12345', m);
  const { sheets, absent } = applyMatching(all, m);
  assert.equal(store.saveWorkbook({ fileName: 'c.xlsx', loadedAt: '2026-09-25T00:00:00.000Z', sheets, absent, matched: true }), 'saved');
  const back = store.workbook();
  assert.deepEqual([back.absent, back.matched], [['Stock'], true]);
  assert.equal(workbookScenario(back).ok, true, 'a reload rebuilds the same dashboard');
  storage.setItem(`${PREFIX}.matching`, JSON.stringify({ version: 1, list: [{ signature: 'x', matching: { roles: { Sales: 5 }, columns: { Sales: { 'bad key!': 'x', id: 'No' } }, values: { 'Sales.status': { Paid: 42 } } } }, 'junk'] }));
  assert.deepEqual(store.matching('x').roles.Sales, null);
  assert.deepEqual(store.matching('x').columns.Sales, { id: 'No' });
  assert.deepEqual(store.matching('x').values['Sales.status'], {});
  store.forgetWorkbook('my-excel');
  assert.equal(store.matching('x'), null, 'Forget this file forgets the matchings too');
});
