import { h, t, add } from '../dom.js';
import { pageHead, scopeBar, filterBar, tile, trendChart, hbars, statusChip } from '../components.js';
import { view, metrics, reportingDate, records, openTasks, label, money, absent } from '../view-state.js';
import { formatDate } from '../../core/dates.js';
import { tr, tl, getLocale } from '../../i18n/i18n.js';

export function renderOverview() {
  const m = metrics();
  const rd = reportingDate();
  const root = h('div', {}, pageHead(tl('Overview')), scopeBar(), filterBar());
  const tiles = h('div', { class: 'tiles overview-tiles' });
  const cmp = m.comparison;
  const deltaText = cmp.growth === null
    ? tr('vs {0}–{1}: unavailable (no prior sales)', formatDate(cmp.start), formatDate(cmp.end))
    : tr('{0}{1}% vs {2}–{3} ({4})', cmp.growth >= 0 ? '+' : '', (cmp.growth * 100).toFixed(1), formatDate(cmp.start), formatDate(cmp.end), money(cmp.prior_order_value));
  add(tiles, tile({ label: tr('Order value in period'), value: money(m.period_order_value), hero: true, delta: { text: deltaText, dir: cmp.growth === null ? '' : cmp.growth >= 0 ? 'up' : 'down' }, foot: tr('{0} orders{1} · booked value, not profit', m.period_order_count, m.average_order_value !== null ? tr(' · average {0}', money(m.average_order_value)) : '') }));
  if (!absent('Payments')) {
    add(tiles, tile({ label: tr('Cash collected in period'), value: money(m.period_cash_collected), foot: tr('{0} receipts by payment date', m.period_receipt_count) }));
    add(tiles, tile({ label: tr('Outstanding balance'), value: money(m.outstanding_balance), foot: tr('as of {0}', formatDate(rd)) }));
    add(tiles, tile({ label: tr('Overdue balance'), value: money(m.overdue_balance), foot: tr('{0} sale(s) past due date', m.overdue_payment_count), cls: m.overdue_balance > 0 ? 'alert' : '' }));
  }
  add(tiles, tile({ label: tr('Pending completion'), value: String(m.pending_completion_count), foot: tr('{0} overdue · {1} due today', m.overdue_completion_ids.length, m.due_today_completion_ids.length) }));
  if (!absent('Stock')) add(tiles, tile({ label: tr('Low-stock items'), value: String(m.low_stock_ids.length), foot: tr('{0} with no available units · snapshot {1}', m.out_of_stock_ids.length, m.stock_snapshot_date ? formatDate(m.stock_snapshot_date) : '—') }));
  if ((records().customers || []).some(c => c.next_follow_up_date)) add(tiles, tile({ label: tr('Follow-ups'), value: String(m.overdue_follow_up_ids.length), foot: tr('recorded actions overdue · {0} due today · {1} unassigned prospects', m.follow_up_today_ids.length, m.unassigned_prospect_ids.length) }));
  if (m.negative_balance_count) add(tiles, tile({ label: tr('Data check'), value: String(m.negative_balance_count), foot: tr('sale(s) with receipts exceeding the amount — check the source'), cls: 'alert' }));
  add(root, tiles);

  const grid = h('div', { class: 'grid cols-2' });
  add(grid, h('div', { class: 'card' }, t('h2', tr('Monthly order value')), t('div', tr('Eligible sales by sale date; the current month is partial.'), 'scope'), trendChart(m.trend, rd)));
  const channels = Object.entries(m.by_channel).sort((a, b) => b[1] - a[1]);
  if (channels.length > 1) add(grid, h('div', { class: 'card' }, t('h2', tr('Order value by {0}', label('channel', tr('channel')).toLowerCase())), t('div', tr('Selected period.'), 'scope'), hbars(channels.map(([k, v]) => ({ label: k, value: v })))));
  const next = openTasks().sort((a, b) => (a.action_date || '9999').localeCompare(b.action_date || '9999') || a.title.localeCompare(b.title)).slice(0, 6);
  add(grid, h('div', { class: 'card' }, t('h2', tr('Next actions')), t('div', tr('Open task suggestions by action date.'), 'scope'),
    next.length ? h('ul', { class: 'list' }, ...next.map(x => h('li', {}, h('a', { href: '#tasks' }, x.title), h('div', { class: 'small muted' }, `${x.action_date ? formatDate(x.action_date) : ''}${x.owner ? ' · ' + x.owner : ''} · `, statusChip(x.status))))) : t('p', tr('No open tasks.'), 'muted')));
  add(grid, h('div', { class: 'card' }, t('h2', tr('AI analysis')),
    t('p', tr('Ask Gemini what these numbers mean and what to do first, with your own free key. Its answer is checked against your data.'), 'small ink2'),
    h('a', { href: '#brief' }, tl('Open AI analysis'))));
  add(root, grid);
  return root;
}
