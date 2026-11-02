// "My Excel": open the viewer's own workbook, remember it in this browser, forget it.
// The file is read with the bundled reader on this computer and never sent anywhere (the
// only network access is the optional "Analyse with Gemini", which sends calculated
// figures, never the file). A workbook in another layout goes through "Match your
// columns" (renderMatchPage, data/matching.js) first.

import { h, t, add, modal, toast } from '../dom.js';
import { pageHead } from '../components.js';
import { view, defaultFilters } from '../view-state.js';
import { navigate, rerender } from '../router.js';
import { readWorkbook, workbookScenario, workbookColumns, MY_EXCEL } from '../../data/workbook.js';
import { ROLE_TEXT, ABSENT_TEXT, FIELD_TEXT, OPTION_TEXT, VALUE_TEXT } from './match-text.js';
import { ROLES, OPTIONAL_ROLES, roleFields, guessMatching, closestMatching, refreshValues, chooseSheet, chooseColumn, chooseValue, openQuestions, applyMatching, workbookSignature } from '../../data/matching.js';
import { setWorkbookScenario, loadScenario } from '../../data/scenarios.js';
import { TEMPLATES } from '../../data/templates.generated.js';
import { tr, tl, sentences } from '../../i18n/i18n.js';

let lastProblem = null; // { fileName, messages } from the latest attempt that could not be used (this visit only)
// A workbook waiting to be matched: { fileName, loadedAt, all, matching, signature, hadWorkbook, problems, remembered, changed }.
// changed: the earlier choices that are gone when the layout changed a little (else null).
let pending = null;
export const pendingMatch = () => pending;

// On start-up: rebuild "My Excel" from the copy remembered in this browser, if any.
export function restoreWorkbook() {
  const saved = view.store.workbook();
  setWorkbookScenario(saved ? workbookScenario(saved) : null);
}

// options.rematch: open the matching page even when a remembered matching fits.
export function pickExcel(options = {}) {
  if (options instanceof Event) options = {};
  document.querySelectorAll('input.excel-picker').forEach(el => el.remove());
  const input = h('input', { type: 'file', class: 'excel-picker', accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', hidden: true });
  input.addEventListener('change', () => { const file = input.files?.[0]; input.remove(); if (file) openExcel(file, options); });
  document.body.append(input);
  input.click();
}

function showProblems(fileName, messages, keptPrevious) {
  lastProblem = { fileName, messages };
  const body = h('div', {},
    t('p', keptPrevious ? tr('{0} could not be used, so the dashboard still shows the file you opened before.', fileName) : tr('{0} could not be used. Nothing was saved.', fileName)),
    h('ul', { class: 'small' }, ...messages.slice(0, 15).map(m => t('li', m))),
    messages.length > 15 ? t('p', tr('…and {0} more.', messages.length - 15), 'small muted') : null,
    t('p', tr('Fix the workbook in Excel (compare it with the template), save it, and choose it again.'), 'small muted'));
  modal(tr('This Excel file cannot be used yet'), body, { actions: [{ label: tl('Choose another file…'), primary: true, onclick: () => { pickExcel(); return false; } }] });
  rerender();
}

const errorsOf = scenario => scenario.issues.filter(i => i.level === 'error').map(i => i.message);

export async function openExcel(file, { rematch = false } = {}) {
  const hadWorkbook = !!loadScenario();
  if (!/\.xlsx$/i.test(file.name)) return showProblems(file.name, [tr('Choose an .xlsx file. Older .xls files and CSV files must first be saved in Excel as "Excel Workbook (*.xlsx)".')], hadWorkbook);
  toast(tr('Reading {0} on this computer…', file.name), { ms: 8000 });
  let read;
  try { read = await readWorkbook(await file.arrayBuffer()); }
  catch (e) { return showProblems(file.name, [e.message], hadWorkbook); }
  const loadedAt = new Date().toISOString();
  // The practice-workbook layout opens straight away. Wrong values in it are reported as before.
  if (!rematch && !read.missing.length) {
    const scenario = workbookScenario({ fileName: file.name, loadedAt, sheets: read.sheets });
    if (scenario.ok) return useWorkbook({ fileName: file.name, loadedAt, sheets: read.sheets }, scenario);
    if (!scenario.issues.some(i => ['missing_header', 'unknown_status', 'unknown_value'].includes(i.code))) return showProblems(file.name, errorsOf(scenario), hadWorkbook);
  }
  // Another layout: "Match your columns", reusing the matching remembered for the same sheets and columns,
  // or, when the sheets or columns changed a little, the closest earlier matching (shown for checking).
  const signature = workbookSignature(read.all);
  const saved = view.store.matching(signature);
  const remembered = !!saved;
  const similar = remembered ? null : closestMatching(read.all, view.store.matchings());
  const matching = remembered ? refreshValues(read.all, saved) : similar ? similar.matching : guessMatching(read.all);
  pending = { fileName: file.name, loadedAt, all: read.all, matching, signature, hadWorkbook, problems: [], remembered, changed: similar ? similar.lost : null };
  if (remembered && !rematch && !openQuestions(read.all, matching).length && finishMatching()) return;
  lastProblem = null;
  navigate('overview');
}

// Reads the pending workbook with its matching; on problems, the matching page lists them.
function finishMatching() {
  const p = pending;
  const { sheets, absent } = applyMatching(p.all, p.matching);
  const scenario = workbookScenario({ fileName: p.fileName, loadedAt: p.loadedAt, sheets, absent, matched: true });
  if (!scenario.ok) { p.problems = errorsOf(scenario); navigate('overview'); return false; }
  view.store.setMatching(p.signature, p.matching);
  pending = null;
  useWorkbook({ fileName: p.fileName, loadedAt: p.loadedAt, sheets, absent, matched: true }, scenario);
  return true;
}

function useWorkbook(stored, scenario) {
  const fileName = stored.fileName;
  lastProblem = null;
  setWorkbookScenario(scenario);
  const saved = view.store.saveWorkbook(stored);
  view.businessId = MY_EXCEL;
  view.day = 'day1';
  view.filters = defaultFilters();
  view.calMonth = '';
  const c = scenario.source.counts;
  const summary = tr('Opened {0}: {1} customers, {2} orders, {3} receipts, {4} products.', fileName, c.Customers, c.Sales, c.Payments, c.Stock);
  const kept = !view.persistent ? tr('It is not remembered: this browser does not allow saving.')
    : saved === 'saved' ? tr('It is remembered in this browser until you choose Forget this file.')
    : saved === 'too_large' ? tr('It is too large to remember; after a reload, choose it again.')
    : tr('It could not be remembered in this browser; after a reload, choose it again.');
  toast(sentences(summary, kept), { ms: 8000, error: saved !== 'saved' && view.persistent });
  navigate('overview');
}

export function forgetExcel() {
  modal(tr('Forget this file?'), h('div', {},
    t('p', tr('The dashboard stops showing your Excel and removes its copy from this browser, together with the task decisions, calendar notes and AI analysis you made for it. Your Excel file itself is not changed.'))),
  { actions: [{ label: tl('Forget this file'), danger: true, onclick: () => {
    view.store.forgetWorkbook(MY_EXCEL);
    setWorkbookScenario(null);
    lastProblem = null;
    pending = null;
    toast(tr('Forgotten. Your Excel file itself was not changed.'));
    rerender();
    return false;
  } }] });
}

function downloadTemplate(tpl) {
  const bin = atob(tpl.base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = h('a', { href: url, download: tpl.file, hidden: true });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Shown on every data page while "My Excel" has no file open.
export function renderExcelStart() {
  const root = h('div', {}, pageHead(tl('Open your Excel')));
  if (lastProblem) {
    add(root, h('div', { class: 'banner critical' }, t('p', tr('{0} could not be used:', lastProblem.fileName)),
      h('ul', { class: 'small' }, ...lastProblem.messages.slice(0, 15).map(m => t('li', m)))));
  }
  add(root, h('div', { class: 'card excel-open' },
    t('h2', tr('See your own business in this dashboard')),
    t('p', tr('Choose your Excel workbook (.xlsx). It is read here, on this computer, and the file is never uploaded. If it is laid out differently from the practice workbook, you match its columns once on the next screen.')),
    h('button', { class: 'btn primary', onclick: pickExcel }, tl('Choose an Excel file…')),
    h('ul', { class: 'small ink2' },
      t('li', tr('The dashboard remembers the file in this browser, so it is still here after a reload. It is not a backup and is not shared. Choose Forget this file to remove it.')),
      t('li', tr('When you change the workbook, save it in Excel and choose Read the Excel again.')),
      t('li', tr('Do not open confidential business data on a shared or public computer.')))));

  const cols = workbookColumns();
  const names = { Customers: tr('Customers'), Sales: tr('Sales'), Payments: tr('Payments'), Stock: tr('Stock') };
  add(root, h('div', { class: 'card' },
    t('h2', tr('What it can read')),
    t('p', tr('Orders are required (one order or invoice per row); customers, payments and stock are optional. A workbook laid out like the practice workbook below opens straight away; other sheet and column names are matched on the next screen. Columns you do not have leave the figures that use them blank or zero.'), 'small ink2'),
    h('div', { class: 'table-wrap' }, h('table', {},
      h('thead', {}, h('tr', {}, t('th', tr('Sheet in the practice workbook')), t('th', tr('Required columns')), t('th', tr('Other columns')))),
      h('tbody', {}, ...cols.map(c => h('tr', {}, h('td', {}, h('b', {}, c.sheet), h('div', { class: 'small muted' }, names[c.sheet])), t('td', c.required.join(', '), 'mono'), t('td', c.optional.join(', '), 'mono small')))))),
    h('ul', { class: 'small ink2' },
      t('li', tr('status says whether an order is done, not whether it is paid: Confirmed, In Progress, Completed or Cancelled. Your own words (for example 已付 or Void) are matched to these. customer_type: Customer or Prospect. offering_type: Product or Service.')),
      t('li', tr('Dates as Excel dates, or written 2026-08-30 or 30/08/2026. Amounts as numbers, or written like RM 12.50.')),
      t('li', tr('The reporting date is the latest date in the file (sales, receipts, completions and stock counts). Everything is calculated as of that day.')))));

  add(root, h('div', { class: 'card' },
    t('h2', tr('Start from a practice workbook')),
    t('p', tr('No file yet? Download a practice workbook (invented BetterSpace data) and open it to try the dashboard.'), 'small ink2'),
    h('div', { class: 'row' }, ...TEMPLATES.map(tpl => h('button', { class: 'btn', onclick: () => downloadTemplate(tpl) }, tr('Download {0}', tpl.file)))),
    t('p', tr('The B2B workbook has account owners and follow-up dates; the B2C workbook does not. Either layout works.'), 'hint')));
  return root;
}

export function excelProblemMessage() { return lastProblem; }

// ---------------------------------------------------------------- Match your columns

const fieldLabel = (role, canonical) => tr(FIELD_TEXT[`${role}.${canonical}`] || canonical);
function questionText(q) {
  if (q.kind === 'sheet') return tr('which sheet has the orders');
  if (q.kind === 'column') return tr('the column for "{0}"', fieldLabel(q.role, q.canonical));
  return tr('what "{0}" means', q.value);
}

function select(value, options, onchange, label) {
  return h('select', { 'aria-label': label, onchange: e => onchange(e.target.value) },
    ...options.map(([v, text]) => h('option', { value: v, selected: v === value }, text)));
}

// Every change re-draws the page where it was.
function change(update) {
  const y = window.scrollY;
  pending.matching = update(pending.matching);
  pending.problems = [];
  rerender();
  window.scrollTo(0, y);
}

function example(p, role, header) {
  const sheet = p.all.find(x => x.name === p.matching.roles[role]);
  const idx = (sheet?.rows[0] || []).map(v => String(v ?? '').trim()).indexOf(header);
  if (idx === -1) return '';
  const row = sheet.rows.slice(1).find(r => String(r?.[idx] ?? '').trim() !== '');
  return row ? String(row[idx]) : '';
}

function roleCard(p, role) {
  const [title, help] = ROLE_TEXT[role];
  const m = p.matching;
  const none = role === 'Sales' ? tr('— choose a sheet —') : tr('I do not have this');
  const card = h('div', { class: 'card match-role' }, t('h2', tr(title)), t('p', tr(help), 'small ink2'),
    h('label', { class: 'row small' }, t('span', tr('Sheet:')),
      select(m.roles[role] || '', [['', none], ...p.all.map(x => [x.name, x.name])], v => change(mm => chooseSheet(p.all, mm, role, v || null)), tr(title))));
  if (!m.roles[role]) { add(card, t('p', tr(ABSENT_TEXT[role] || ''), 'small muted')); return card; }
  const sheet = p.all.find(x => x.name === m.roles[role]);
  const headers = (sheet?.rows[0] || []).map(v => String(v ?? '').trim()).filter(Boolean);
  const rows = roleFields(role).map(f => {
    const chosen = m.columns[role]?.[f.canonical] || '';
    return h('tr', { class: f.required && !chosen ? 'missing' : '' },
      h('td', {}, fieldLabel(role, f.canonical), f.required ? h('span', { class: 'badge warning' }, tr('required')) : null),
      h('td', {}, select(chosen, [['', f.required ? tr('— choose a column —') : tr('(not in my file)')], ...headers.map(x => [x, x])], v => change(mm => chooseColumn(p.all, mm, role, f.canonical, v)), fieldLabel(role, f.canonical))),
      t('td', chosen ? example(p, role, chosen) : '', 'small muted'));
  });
  add(card, h('div', { class: 'table-wrap' }, h('table', {},
    h('thead', {}, h('tr', {}, t('th', tr('The dashboard needs')), t('th', tr('Your column')), t('th', tr('First value')))),
    h('tbody', {}, ...rows))));
  return card;
}

function valuesCard(p) {
  const m = p.matching;
  const keys = Object.keys(m.values || {});
  if (!keys.length) return null;
  const card = h('div', { class: 'card match-values' });
  for (const key of keys) {
    const [role, canonical] = key.split('.');
    const field = roleFields(role).find(f => f.canonical === canonical);
    const [title, help] = VALUE_TEXT[key] || [fieldLabel(role, canonical), ''];
    add(card, t('h2', tr(title)), help ? t('p', tr(help), 'small ink2') : null,
      h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, t('th', tr('Your word')), t('th', tr('Means')))),
        h('tbody', {}, ...Object.entries(m.values[key]).map(([word, meaning]) => h('tr', { class: meaning ? '' : 'missing' },
          t('td', word),
          h('td', {}, select(meaning, [['', tr('— choose —')], ...field.options.map(o => [o, tr(OPTION_TEXT[o] || o)])], v => change(mm => chooseValue(mm, key, word, v)), word))))))));
  }
  return card;
}

function hasTextDates(p) {
  for (const role of ROLES) for (const f of roleFields(role).filter(x => x.type === 'date')) {
    const header = p.matching.columns[role]?.[f.canonical];
    if (header && /^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}$/.test(example(p, role, header).trim())) return true;
  }
  return false;
}

export function cancelMatching() { pending = null; rerender(); }

// Shown instead of the data pages while a workbook waits to be matched.
export function renderMatchPage() {
  const p = pending;
  const questions = openQuestions(p.all, p.matching);
  const root = h('div', {}, pageHead(tl('Match your columns')));
  add(root, h('div', { class: 'banner info' },
    t('p', tr('{0} is laid out differently from the practice workbook. Tell the dashboard which sheet and which column holds what. The guesses are already filled in: check them.', p.fileName)),
    t('p', p.remembered ? tr('Your earlier matching for this layout is filled in.') : p.changed ? tr('The sheets or columns changed since you last matched this file. Your earlier choices are filled in, so only what changed needs checking.') : tr('You do this once: the next time you read a file with the same sheets and columns, this matching is used again.'), 'small'),
    p.changed?.length ? h('div', { class: 'small' }, t('b', tr('No longer in the file:')), h('ul', {}, ...p.changed.map(x => t('li', x.sheet ? tr('{0}: the sheet "{1}"', tr(ROLE_TEXT[x.role][0]), x.sheet) : tr('{0}: the column "{1}" — check the column chosen below', fieldLabel(x.role, x.canonical), x.header))))) : null));
  if (p.problems.length) {
    add(root, h('div', { class: 'banner critical' }, t('p', tr('With this matching the file still has problems:')),
      h('ul', { class: 'small' }, ...p.problems.slice(0, 12).map(x => t('li', x))),
      t('p', tr('Check the columns chosen below, or fix the rows in Excel and read the file again.'), 'small')));
  }
  for (const role of ROLES) add(root, roleCard(p, role));
  add(root, valuesCard(p));
  if (hasTextDates(p)) {
    add(root, h('div', { class: 'card' }, t('h2', tr('Dates written as text')),
      h('label', { class: 'row small' }, t('span', tr('A date like 03/09/2026 is:')),
        select(p.matching.dateOrder, [['dmy', tr('day/month/year (3 September)')], ['mdy', tr('month/day/year (9 March)')]], v => change(mm => ({ ...mm, dateOrder: v })), tr('Dates written as text')))));
  }
  add(root, h('div', { class: 'card match-actions' },
    t('p', questions.length ? tr('Still to answer: {0}.', questions.slice(0, 6).map(questionText).join(' · ')) : tr('Everything is matched.'), questions.length ? 'small' : 'small good-text'),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn primary', disabled: questions.length > 0, onclick: finishMatching }, tl('Open with this matching')),
      h('button', { type: 'button', class: 'btn ghost', onclick: cancelMatching }, tl('Cancel')))));
  return root;
}
