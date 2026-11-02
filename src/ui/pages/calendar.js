import { h, t, add, modal, toast } from '../dom.js';
import { pageHead, scopeBar, tile } from '../components.js';
import { icon } from '../icons.js';
import { view, reportingDate, calendarItems, notes, records, money } from '../view-state.js';
import { saleDrawer, customerDrawer } from '../drawers.js';
import { navigate, rerender } from '../router.js';
import { savedMessage } from './tasks.js';
import { calendarMonthSummary } from '../../core/calendar.js';
import { addDays, monthStart, daysInMonth, isIsoDate, formatDate } from '../../core/dates.js';
import { tr, tl, intlLocale } from '../../i18n/i18n.js';

// Calendar: a month grid, a week of columns or a list, plus a panel for the chosen day.
// Dates only — the records hold no times, so there is no hourly grid.
const TYPE_LABEL = { payment: () => tr('Payment due'), followup: () => tr('Follow-up'), completion: () => tr('Promised completion'), task: () => tr('Accepted task'), entry: () => tr('Your note') };
const TYPE_SOURCE = { payment: () => tr('From the sales records'), followup: () => tr('From the customer records'), completion: () => tr('From the sales records'), task: () => tr('Your accepted task'), entry: () => tr('Your note') };
const MAX_IN_CELL = 3;

const isOverdue = it => it.kind === 'deadline' && it.overdue;
const dayLabel = d => new Date(d + 'T00:00:00Z').toLocaleDateString(intlLocale(), { month: 'long', day: 'numeric', weekday: 'short', timeZone: 'UTC' });

export function renderCalendar() {
  const rd = reportingDate();
  view.calMonth ||= monthStart(rd);
  view.calView ||= 'month';
  const month = view.calMonth;
  if (!view.calDay || view.calDay.slice(0, 7) !== month.slice(0, 7)) view.calDay = rd.slice(0, 7) === month.slice(0, 7) ? rd : month;
  const items = calendarItems({ withAi: true }).map(item => ({ ...item, onclick: () => openItem(item) }));
  const byDate = new Map();
  for (const it of items) { if (!byDate.has(it.date)) byDate.set(it.date, []); byDate.get(it.date).push(it); }
  const go = m => { view.calMonth = m; view.calDay = ''; rerender(); };
  const pick = d => { view.calDay = d; rerender(); };
  const setView = v => { view.calView = v; rerender(); };

  const root = h('div', { class: 'cal-page' }, pageHead(tl('Calendar'), h('button', { class: 'btn primary small', onclick: () => editNote(null) }, tl('+ Add note'))), scopeBar({ period: false }));

  // Summary cards: counts and sums of the items in the month shown.
  const sum = calendarMonthSummary(items, month.slice(0, 7), rd);
  add(root, h('div', { class: 'tiles cal-kpis' },
    tile({ label: tr('Items this month'), value: String(sum.total), foot: tr('From the records, your accepted tasks and your notes') }),
    tile({ label: tr('Past deadlines'), value: String(sum.overdue), foot: tr('Recorded deadlines before the reporting date'), cls: sum.overdue ? 'warn-tile' : '' }),
    tile({ label: tr('On the reporting date'), value: String(sum.onReportingDate), foot: formatDate(rd) }),
    tile({ label: tr('Payments due this month'), value: money(sum.payments.amount), foot: tr('{0} sale(s) · {1} past the deadline', sum.payments.count, sum.payments.overdue) })));

  const head = h('div', { class: 'cal-toolbar' },
    h('button', { class: 'icon-round', 'aria-label': tr('Previous month'), onclick: () => go(monthStart(addDays(month, -1))) }, icon('left')),
    t('h2', new Date(month + 'T00:00:00Z').toLocaleDateString(intlLocale(), { month: 'long', year: 'numeric', timeZone: 'UTC' })),
    h('button', { class: 'icon-round', 'aria-label': tr('Next month'), onclick: () => go(addDays(month, daysInMonth(month))) }, icon('right')),
    h('button', { class: 'btn ghost small', onclick: () => go(monthStart(rd)) }, tl('Reporting month')),
    h('div', { class: 'cal-views', role: 'group', 'aria-label': tr('Calendar views') },
      ...[['month', tl('Month')], ['week', tl('Week')], ['list', tl('List')]].map(([v, l]) => h('button', { type: 'button', class: view.calView === v ? 'active' : '', 'aria-pressed': String(view.calView === v), onclick: () => setView(v) }, l))));

  const hasAi = items.some(i => i.ai_why !== undefined);
  const legend = h('div', { class: 'legend' },
    ...['payment', 'followup', 'completion', 'task', 'entry'].map(type => h('span', { class: `t-${type}` }, TYPE_LABEL[type]())),
    h('span', { class: 'overdue' }, tr('Red outline = past deadline')),
    hasAi ? h('span', { class: 'ai-key' }, aiTag(), tr('picked by the AI analysis')) : null,
    items.some(i => i.suggested) ? h('span', { class: 'suggested-key' }, tr('Dashed = AI suggestion, not accepted yet')) : null);

  const body = view.calView === 'week' ? weekView(byDate, rd, pick) : view.calView === 'list' ? listView(items, month, rd, pick) : monthView(byDate, month, rd, pick);
  add(root, h('div', { class: 'cal-layout' },
    h('div', { class: 'card cal-card' }, head, legend, body),
    agenda(items, byDate, month, rd, sum, setView)));
  add(root, t('p', tr('Dates are calendar days; the records contain no appointment times, so none are shown. Accepted tasks appear here; the top picks of the AI analysis are shown dashed until you accept them. Nothing is sent to an external calendar.'), 'hint'));
  return root;
}

// "AI" on an item the latest Gemini analysis picked (its reason is in the day panel).
const aiTag = () => h('span', { class: 'ai-tag', title: tr('Picked by the latest AI analysis') }, 'AI');

function chip(it, { full = false } = {}) {
  const od = isOverdue(it);
  const title = [it.title, od ? tr('Past deadline') : '', it.ai_why ? tr('AI: {0}', it.ai_why) : ''].filter(Boolean).join(' · ');
  return h('button', { type: 'button', class: `cal-item t-${it.type}${od ? ' overdue' : ''}${it.suggested ? ' suggested' : ''}${full ? ' full' : ''}`, title, onclick: e => { e.stopPropagation(); it.onclick(); } },
    od ? h('span', { class: 'mark', 'aria-label': tr('Past deadline') }, '!') : h('span', { class: 'dot', 'aria-hidden': 'true' }),
    it.ai_why !== undefined ? aiTag() : null,
    t('span', it.short || it.title, 'txt'));
}

function monthView(byDate, month, rd, pick) {
  const grid = h('div', { class: 'cal-grid' });
  for (const d of [tr('Mon'), tr('Tue'), tr('Wed'), tr('Thu'), tr('Fri'), tr('Sat'), tr('Sun')]) add(grid, t('div', d, 'cal-dow'));
  const offset = (new Date(month + 'T00:00:00Z').getUTCDay() + 6) % 7;
  const start = addDays(month, -offset);
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i);
    const other = d.slice(0, 7) !== month.slice(0, 7);
    const list = byDate.get(d) || [];
    const cls = ['cal-day', other && 'other', i % 7 >= 5 && 'weekend', d === rd && 'today', d === view.calDay && 'selected', !list.length && 'empty'].filter(Boolean).join(' ');
    const cell = h('div', { class: cls, onclick: () => pick(d) },
      h('button', { type: 'button', class: 'd', 'aria-label': dayLabel(d), onclick: e => { e.stopPropagation(); pick(d); } }, String(Number(d.slice(8)))),
      d === rd ? t('span', tr('Reporting date'), 'rd-tag') : null);
    for (const it of list.slice(0, MAX_IN_CELL)) add(cell, chip(it));
    if (list.length > MAX_IN_CELL) add(cell, h('button', { type: 'button', class: 'cal-more', onclick: e => { e.stopPropagation(); pick(d); } }, tr('+{0} more', list.length - MAX_IN_CELL)));
    add(grid, cell);
  }
  return grid;
}

function weekView(byDate, rd, pick) {
  const day = view.calDay;
  const start = addDays(day, -((new Date(day + 'T00:00:00Z').getUTCDay() + 6) % 7));
  const wrap = h('div', { class: 'cal-week' });
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const list = byDate.get(d) || [];
    add(wrap, h('div', { class: `cal-wday${d === rd ? ' today' : ''}${d === day ? ' selected' : ''}`, onclick: () => pick(d) },
      h('div', { class: 'wd-head' }, t('span', dayLabel(d)), d === rd ? t('span', tr('Reporting date'), 'rd-tag') : null),
      list.length ? h('div', { class: 'stack' }, ...list.map(it => chip(it, { full: true }))) : t('div', '—', 'muted small')));
  }
  return wrap;
}

function listView(items, month, rd, pick) {
  const inMonth = items.filter(i => i.date.slice(0, 7) === month.slice(0, 7));
  if (!inMonth.length) return t('p', tr('No items in this month.'), 'empty');
  const wrap = h('div', { class: 'cal-list' });
  let last = '';
  for (const it of inMonth) {
    if (it.date !== last) { last = it.date; add(wrap, h('button', { type: 'button', class: `list-date${it.date === rd ? ' today' : ''}`, onclick: () => pick(it.date) }, dayLabel(it.date), it.date === rd ? t('span', tr('Reporting date'), 'rd-tag') : null)); }
    add(wrap, agendaItem(it));
  }
  return wrap;
}

function agendaItem(it, meta) {
  const od = isOverdue(it);
  const source = it.suggested ? tr('AI suggestion · accept it in Tasks') : TYPE_SOURCE[it.type]();
  return h('button', { type: 'button', class: `agenda-item t-${it.type}${od ? ' overdue' : ''}${it.suggested ? ' suggested' : ''}`, onclick: it.onclick },
    h('span', { class: 'ai-icon' }, icon(it.type)),
    h('span', { class: 'ai-text' }, t('b', it.title), h('span', {}, meta || source, od ? h('span', { class: 'od-word' }, ' · ', tr('Past deadline')) : null),
      it.ai_why !== undefined ? h('span', { class: 'ai-why' }, aiTag(), it.ai_rank ? tr('Pick {0}', it.ai_rank) : tr('Watch this'), it.ai_why ? ` · ${it.ai_why}` : '') : null),
    icon('right', 'chev'));
}

function agenda(items, byDate, month, rd, sum, setView) {
  const day = view.calDay;
  const list = byDate.get(day) || [];
  const box = h('aside', { class: 'card cal-agenda', 'aria-label': dayLabel(day) },
    h('div', { class: 'ag-head' }, t('h3', dayLabel(day)), day === rd ? t('span', tr('Reporting date'), 'rd-pill') : null),
    t('div', list.length ? tr('{0} item(s) · click one to open its record', list.length) : tr('Nothing on this day.'), 'small muted ag-sub'));
  for (const it of list) add(box, agendaItem(it));
  const next = items.filter(i => i.date > day && i.date.slice(0, 7) === month.slice(0, 7)).slice(0, 3);
  if (next.length) add(box, t('div', tr('Coming next'), 'ag-section'), ...next.map(it => agendaItem(it, `${dayLabel(it.date)} · ${it.suggested ? tr('AI suggestion') : TYPE_LABEL[it.type]()}`)));
  if (sum.overdue) add(box, t('div', tr('Past deadlines this month'), 'ag-section'),
    h('button', { type: 'button', class: 'ag-over', onclick: () => setView('list') },
      h('span', {}, h('b', {}, String(sum.overdue)), ' · ', tr('{0} payment(s) · {1} follow-up(s) · {2} promised', sum.overdueByType.payment, sum.overdueByType.followup, sum.overdueByType.completion)),
      h('span', { class: 'ag-link' }, tl('Show the list'), ' ›')));
  return box;
}

function openItem(item) {
  if (item.kind === 'entry') return editNote(notes().find(e => e.entry_id === item.id));
  if (item.kind === 'task') return navigate('tasks');
  if (item.record_type === 'sales') return saleDrawer(records().sales.find(s => s.id === item.record_id));
  return customerDrawer(records().customers.find(c => c.id === item.record_id));
}

export function editNote(e) {
  const title = h('input', { type: 'text', value: e?.title || '', maxlength: 200 });
  const date = h('input', { type: 'date', value: e?.date || view.calDay || reportingDate() });
  const detail = h('textarea', { maxlength: 1000 }); detail.value = e?.detail || '';
  const body = h('div', {}, h('label', { class: 'field' }, t('span', tr('Title')), title), h('label', { class: 'field' }, t('span', tr('Date')), date), h('label', { class: 'field' }, t('span', tr('Detail')), detail));
  const done = (ok, msg) => { if (ok) { toast(msg); view.calMonth = monthStart(date.value || reportingDate()); view.calDay = date.value || ''; rerender(); } else toast(tr('Could not save in this browser. The change was not kept.'), { error: true, ms: 7000 }); };
  const actions = [{ label: tl('Save'), primary: true, onclick: () => {
    if (!title.value.trim() || !isIsoDate(date.value)) { toast(tr('Title and a valid date are required'), { error: true }); return true; }
    const now = new Date().toISOString();
    done(view.store.saveNote(view.businessId, { entry_id: e?.entry_id || `note_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, date: date.value, title: title.value.trim(), detail: detail.value.trim(), created_at: e?.created_at || now, updated_at: now }), savedMessage());
    return false;
  } }];
  if (e) actions.push({ label: tl('Delete'), danger: true, onclick: () => { done(view.store.deleteNote(view.businessId, e.entry_id), tr('Deleted')); return false; } });
  modal(e ? tr('Edit note') : tr('Add note'), body, { actions });
}
