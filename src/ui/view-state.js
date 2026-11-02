// What the viewer is looking at, plus the figures derived from it. Pages read from
// here; nothing in this file touches the DOM. Figures are always recalculated from
// the scenario's records — no total is stored or typed in by hand.

import { loadScenario, businessProfile, MY_EXCEL } from '../data/scenarios.js';
import { computeMetrics, formatMoney } from '../core/metrics.js';
import { suggestionRows, scenarioTasks, baseMetrics, isOpen } from '../core/scenario-tasks.js';
import { buildCalendarItems } from '../core/calendar.js';
import { dataBasis } from '../briefs/ai-prompt.js';
import { isIsoDate, addDays, monthStart } from '../core/dates.js';
import { getLocale } from '../i18n/i18n.js';

export const view = {
  store: null,            // storage/local-state.js store
  persistent: true,       // false when the browser does not allow saving
  storageReason: '',
  businessId: MY_EXCEL,   // the one business: the viewer's own Excel
  day: 'day1',
  filters: defaultFilters(),
  page: 'overview',
  calMonth: '',
  calDay: '',             // the day shown in the calendar's side panel
  calView: 'month',       // month / week / list
  taskView: 'open',
};

export function defaultFilters() { return { preset: 'mtd', start: '', end: '', channel: '', owner: '' }; }

// null while no Excel file is open (pages are guarded in main.js).
export const scenario = () => loadScenario();
export const isExcel = () => view.businessId === MY_EXCEL;
// Sheets a matched workbook does not have ('Customers', 'Payments', 'Stock'): pages hidden.
export const absent = role => (loadScenario()?.source?.absent || []).includes(role);
// One snapshot only: there is no earlier day to compare with.
export const previousScenario = () => null;
export const profile = () => businessProfile(view.businessId);
export const records = () => scenario().records;
export const reportingDate = () => scenario().reportingDate;
export const isZh = () => getLocale() === 'zh-CN';

export function periodRange() {
  const rd = reportingDate();
  const f = view.filters;
  if (f.preset === 'custom' && isIsoDate(f.start) && isIsoDate(f.end) && f.start <= f.end) return { start: f.start, end: f.end };
  if (f.preset === 'prev_month') return { start: monthStart(addDays(monthStart(rd), -1)), end: addDays(monthStart(rd), -1) };
  if (f.preset === 'last7') return { start: addDays(rd, -6), end: rd };
  if (f.preset === 'last30') return { start: addDays(rd, -29), end: rd };
  if (f.preset === 'all') return { start: scenario().historyStart || '2000-01-01', end: rd };
  return { start: monthStart(rd), end: rd };
}

// Figures for the selected period and filters.
export function metrics() {
  const { start, end } = periodRange();
  return computeMetrics(records(), reportingDate(), { periodStart: start, periodEnd: end, historyStart: scenario().historyStart, filters: { channel: view.filters.channel || undefined, owner: view.filters.owner || undefined } });
}

// Suggestions depend on the scenario and the language only, so they are cached per
// scenario object (re-reading an Excel file makes a new object).
const rowsCache = new WeakMap();
function rows() {
  const s = scenario();
  if (!rowsCache.has(s)) rowsCache.set(s, new Map());
  const byLocale = rowsCache.get(s);
  if (!byLocale.has(getLocale())) byLocale.set(getLocale(), suggestionRows(s, previousScenario()));
  return byLocale.get(getLocale());
}

export function allTasks() { return scenarioTasks(scenario(), previousScenario(), view.store.decisions(view.businessId), rows()); }
export const openTasks = () => allTasks().filter(isOpen);
export { isOpen };

export const notes = () => view.store.notes(view.businessId);

// The latest saved Gemini analysis (any), and the same only while the open workbook has the
// records it was made from (its picks are shown in Tasks and the Calendar only then).
export const savedAiPlan = () => view.store.aiPlan(view.businessId);
const basisCache = new WeakMap();
// The fingerprint of the records now open ('' when no workbook is open).
export function currentBasis() {
  const s = scenario();
  if (!s) return '';
  if (!basisCache.has(s)) basisCache.set(s, dataBasis(s));
  return basisCache.get(s);
}
export const isCurrentPlan = plan => !!plan && !!currentBasis() && plan.basis === currentBasis();
export function aiPlan() { const p = savedAiPlan(); return isCurrentPlan(p) ? p : null; }
// The current plan's picks: top (task_key → { rank, why, how }) and watch (calendar id → why).
export function aiMarks() {
  const p = aiPlan();
  if (!p) return null;
  return { top: new Map(p.top.map((x, i) => [x.task_key, { rank: i + 1, why: x.why, how: x.how }])), watch: new Map(p.watch.map(w => [w.item_id, w.why])) };
}

// withAi: also the AI's picks (the Calendar page). The request to Gemini uses the plain items.
export function calendarItems({ withAi = false } = {}) {
  return buildCalendarItems({ records: records(), metrics: baseMetrics(scenario()), tasks: allTasks(), entries: notes(), reportingDate: reportingDate(), money, ai: withAi ? aiMarks() : null });
}

export function money(cents) { const b = profile().business; return formatMoney(cents, b.currency_symbol || b.currency); }

// Record-type names chosen by the business ("Orders & jobs", "Accounts"…), in the current language.
export function label(key, fallback) { const p = profile(); return (isZh() ? p.labels_zh?.[key] : p.labels?.[key]) || fallback; }
// Same, for menu items and headings: 中文（English）.
export function labelTl(key, fallbackEn) {
  const p = profile();
  const en = p.labels?.[key] || fallbackEn;
  return isZh() && p.labels_zh?.[key] ? `${p.labels_zh[key]}（${en}）` : en;
}

export function businessName(id = view.businessId) { const b = businessProfile(id).business; return (isZh() && b.name_zh) || b.name; }

export function customerName(id) { return (records().customers || []).find(c => c.id === id)?.name || id || ''; }
export function customerOwner(id) { return (records().customers || []).find(c => c.id === id)?.owner || ''; }

// Record a task decision (accept, complete, dismiss, reopen, edit). Adapted from the
// original saveDecision(): the same row shape, stored in this browser instead of Sheets.
export function saveDecision(task, patch) {
  const existing = view.store.business(view.businessId).decisions[task.task_key] || {};
  const row = {
    task_key: task.task_key,
    status: existing.status || task.status,
    action_date: existing.action_date ?? '',
    owner: existing.owner ?? '',
    note: existing.note || '',
    title: existing.title || (task.custom ? task.title : ''),
    detail: existing.detail || (task.custom ? task.reason : ''),
    ...patch,
    snapshot_at_decision: view.day,
    updated_at: new Date().toISOString(),
  };
  if (row.status === 'accepted' && !row.action_date && !Object.hasOwn(patch, 'action_date')) row.action_date = task.suggested_date || '';
  if (row.status === 'accepted' && !row.owner && !Object.hasOwn(patch, 'owner')) row.owner = task.suggested_owner || '';
  return view.store.saveDecision(view.businessId, row);
}
