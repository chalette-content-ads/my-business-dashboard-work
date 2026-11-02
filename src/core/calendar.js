import { isIsoDate } from './dates.js';
import { tr } from '../i18n/i18n.js';

// Shared by the dashboard and AI: suggestions are not appointments until accepted.
// Each item has a kind (deadline / task / entry) and a type for the calendar colours:
// payment, followup and completion are recorded deadlines; task and entry are the viewer's.
// `short` is the label for a small calendar cell (the colour already says the type).
// ai (optional, from the latest Gemini analysis): { top: Map(task_key → { rank, why }),
// watch: Map(item id → why) }. An item the AI picked gets ai_rank / ai_why; a top pick that is
// still only a suggestion is shown on its suggested date with suggested: true (dashed, not
// an appointment until the viewer accepts it).
export function buildCalendarItems({ records, metrics, tasks, entries = [], reportingDate, symbol = '', money = v => String(v / 100), ai = null }) {
  const items = [];
  const customers = new Map((records.customers || []).map(c => [c.id, c]));
  const push = item => { if (isIsoDate(item.date)) items.push({ ...item, overdue: item.date < reportingDate }); };
  for (const sale of records.sales || []) {
    if (sale.status === 'pending') push({ id: `completion:${sale.id}`, date: sale.promised_completion_date, kind: 'deadline', type: 'completion', record_type: 'sales', record_id: sale.id, title: tr('Promised: {0} · {1}', sale.description || sale.id, customers.get(sale.customer_id)?.name || sale.customer_id || ''), short: sale.description || sale.id });
  }
  for (const b of metrics.balances || []) if (b.balance > 0) push({ id: `payment:${b.sale_id}`, date: b.due, kind: 'deadline', type: 'payment', record_type: 'sales', record_id: b.sale_id, amount: b.balance, title: tr('Payment due: {0} {1} {2}', b.sale_id, symbol, money(b.balance)), short: `${b.sale_id} · ${`${symbol} ${money(b.balance)}`.trim().replace(/ /g, '\u00a0')}` });
  for (const c of records.customers || []) push({ id: `followup:${c.id}`, date: c.next_follow_up_date, kind: 'deadline', type: 'followup', record_type: 'customers', record_id: c.id, title: tr('Follow-up: {0}', c.name), short: c.name || c.id });
  for (const task of tasks) {
    if (task.resolved) continue;
    if (task.status === 'accepted') push({ id: task.task_key, date: task.action_date, kind: 'task', type: 'task', title: tr('Task: {0}', task.title), short: task.title, owner: task.owner || '', note: task.note || '' });
    else if (task.status === 'suggested' && ai?.top.has(task.task_key)) push({ id: task.task_key, date: task.action_date || task.suggested_date, kind: 'task', type: 'task', suggested: true, title: tr('Task (not accepted yet): {0}', task.title), short: task.title, owner: task.owner || '', note: '' });
  }
  for (const entry of entries) if (String(entry.deleted) !== 'TRUE' && entry.deleted !== true) push({ id: entry.entry_id, date: entry.date, kind: 'entry', type: 'entry', title: entry.title, short: entry.title, note: entry.detail || '' });
  if (ai) for (const it of items) {
    const pick = ai.top.get(it.id);
    if (pick) { it.ai_rank = pick.rank; it.ai_why = pick.why; } else if (ai.watch.has(it.id)) it.ai_why = ai.watch.get(it.id);
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

// The summary cards above the calendar, for one month ('YYYY-MM'): every figure is a count
// or sum of the items themselves. "Overdue" means a recorded deadline before the reporting date.
// AI suggestions not yet accepted are not appointments, so they are not counted.
export function calendarMonthSummary(items, month, reportingDate) {
  items = items.filter(i => !i.suggested);
  const inMonth = items.filter(i => i.date.slice(0, 7) === month);
  const overdue = inMonth.filter(i => i.kind === 'deadline' && i.overdue);
  const payments = inMonth.filter(i => i.type === 'payment');
  const count = type => overdue.filter(i => i.type === type).length;
  return {
    total: inMonth.length,
    overdue: overdue.length,
    overdueByType: { payment: count('payment'), followup: count('followup'), completion: count('completion') },
    onReportingDate: items.filter(i => i.date === reportingDate).length,
    payments: { count: payments.length, amount: payments.reduce((s, i) => s + (i.amount || 0), 0), overdue: payments.filter(i => i.overdue).length },
  };
}
