import { h, t, add } from '../dom.js';
import { scopeBar, filterBar, tile, monthBars, hbars, statusChip, bilingual } from '../components.js';
import { metrics, reportingDate, records, openTasks, label, labelTl, money, absent, businessName } from '../view-state.js';
import { icon } from '../icons.js';
import { formatDate } from '../../core/dates.js';
import { tr, tl } from '../../i18n/i18n.js';

// One of the four figures in the welcome banner.
function bannerStat(ic, lbl, value) {
  return h('div', { class: 'w-stat' }, h('div', { class: 'w-head' }, icon(ic), t('span', lbl)), t('div', value, 'w-value'));
}

// A coloured shortcut to another page.
function quickAction(page, ic, tone, text, sub) {
  return h('a', { class: `qa qa-${tone}`, href: `#${page}` }, icon(ic), h('b', {}, ...bilingual(text)), sub ? t('small', sub) : null);
}

export function renderOverview() {
  const m = metrics();
  const rd = reportingDate();
  const cmp = m.comparison;
  const root = h('div', {});

  // Welcome banner: the period's main figures, all calculated from the records.
  const growth = cmp.growth === null ? '—' : `${cmp.growth >= 0 ? '+' : ''}${(cmp.growth * 100).toFixed(1)}%`;
  const deltaText = cmp.growth === null
    ? tr('vs {0}–{1}: unavailable (no prior sales)', formatDate(cmp.start), formatDate(cmp.end))
    : tr('{0}{1}% vs {2}–{3} ({4})', cmp.growth >= 0 ? '+' : '', (cmp.growth * 100).toFixed(1), formatDate(cmp.start), formatDate(cmp.end), money(cmp.prior_order_value));
  add(root, h('section', { class: 'welcome' },
    t('h1', tr('Welcome back, {0}', businessName())),
    t('p', tr('Here is how the business is doing in the period you picked.')),
    h('div', { class: 'welcome-stats' },
      bannerStat('sales', tr('Orders'), String(m.period_order_count)),
      bannerStat('payments', tr('Order value in period'), money(m.period_order_value)),
      bannerStat('entry', tr('Average order'), m.average_order_value !== null ? money(m.average_order_value) : '—'),
      bannerStat('trend', tr('vs prior period'), growth)),
    t('div', tr('{0} orders{1} · booked value, not profit', m.period_order_count, '') + ' · ' + deltaText, 'welcome-note')));
  add(root, scopeBar(), filterBar());

  const tiles = h('div', { class: 'tiles overview-tiles' });
  if (!absent('Payments')) {
    add(tiles, tile({ label: tr('Cash collected in period'), value: money(m.period_cash_collected), icon: 'payments', tone: 'green', foot: tr('{0} receipts by payment date', m.period_receipt_count) }));
    add(tiles, tile({ label: tr('Outstanding balance'), value: money(m.outstanding_balance), icon: 'payment', tone: 'orange', foot: tr('as of {0}', formatDate(rd)) }));
    add(tiles, tile({ label: tr('Overdue balance'), value: money(m.overdue_balance), icon: 'alert', tone: 'red', foot: tr('{0} sale(s) past due date', m.overdue_payment_count), cls: m.overdue_balance > 0 ? 'alert' : '' }));
  }
  add(tiles, tile({ label: tr('Pending completion'), value: String(m.pending_completion_count), icon: 'completion', tone: 'purple', foot: tr('{0} overdue · {1} due today', m.overdue_completion_ids.length, m.due_today_completion_ids.length) }));
  if (!absent('Stock')) add(tiles, tile({ label: tr('Low-stock items'), value: String(m.low_stock_ids.length), icon: 'stock', foot: tr('{0} with no available units · snapshot {1}', m.out_of_stock_ids.length, m.stock_snapshot_date ? formatDate(m.stock_snapshot_date) : '—') }));
  if ((records().customers || []).some(c => c.next_follow_up_date)) add(tiles, tile({ label: tr('Follow-ups'), value: String(m.overdue_follow_up_ids.length), icon: 'followup', foot: tr('recorded actions overdue · {0} due today · {1} unassigned prospects', m.follow_up_today_ids.length, m.unassigned_prospect_ids.length) }));
  if (m.negative_balance_count) add(tiles, tile({ label: tr('Data check'), value: String(m.negative_balance_count), icon: 'alert', tone: 'red', foot: tr('sale(s) with receipts exceeding the amount — check the source'), cls: 'alert' }));
  add(root, tiles);

  // Left column: monthly order value and shortcuts.
  const open = openTasks();
  const left = h('div', { class: 'dash-col' },
    h('div', { class: 'card' }, t('h2', tr('Monthly order value')), t('div', tr('Eligible sales by sale date; the current month is partial.'), 'scope'), monthBars(m.trend, rd)),
    h('div', { class: 'card' }, t('h2', tr('Quick actions')),
      h('div', { class: 'qa-grid' },
        quickAction('tasks', 'tasks', 'blue', tl('Tasks'), tr('{0} open', open.length)),
        quickAction('calendar', 'calendar', 'green', tl('Calendar')),
        quickAction('brief', 'brief', 'purple', tl('AI analysis')),
        quickAction('sales', 'sales', 'orange', labelTl('sales', 'Sales')))));

  // Right column: what to do next, order value by channel, AI analysis.
  const next = open.sort((a, b) => (a.action_date || '9999').localeCompare(b.action_date || '9999') || a.title.localeCompare(b.title)).slice(0, 6);
  const right = h('div', { class: 'dash-col' },
    h('div', { class: 'card' }, t('h2', tr('Next actions')), t('div', tr('Open task suggestions by action date.'), 'scope'),
      next.length ? h('ul', { class: 'list' }, ...next.map(x => h('li', { class: 'act' }, h('span', { class: 'act-ico' }, icon('task')),
        h('div', {}, h('a', { href: '#tasks' }, x.title), h('div', { class: 'small muted' }, `${x.action_date ? formatDate(x.action_date) : ''}${x.owner ? ' · ' + x.owner : ''} · `, statusChip(x.status)))))) : t('p', tr('No open tasks.'), 'muted')));
  const channels = Object.entries(m.by_channel).sort((a, b) => b[1] - a[1]);
  if (channels.length > 1) add(right, h('div', { class: 'card' }, t('h2', tr('Order value by {0}', label('channel', tr('channel')).toLowerCase())), t('div', tr('Selected period.'), 'scope'), hbars(channels.map(([k, v]) => ({ label: k, value: v })))));
  add(right, h('div', { class: 'card' }, t('h2', tr('AI analysis')),
    t('p', tr('Ask Gemini what these numbers mean and what to do first, with your own free key. Its answer is checked against your data.'), 'small ink2'),
    h('a', { href: '#brief' }, tl('Open AI analysis'))));

  add(root, h('div', { class: 'dash-grid' }, left, right));
  return root;
}
