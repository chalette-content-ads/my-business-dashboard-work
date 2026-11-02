import { h, t, add } from '../dom.js';
import { pageHead, scopeBar, filterBar, tile, dataTable } from '../components.js';
import { view, metrics, periodRange, records, label, labelTl, money, customerName } from '../view-state.js';
import { saleDrawer } from '../drawers.js';
import { formatDate } from '../../core/dates.js';
import { tr } from '../../i18n/i18n.js';

export function renderPayments() {
  const m = metrics();
  const { start, end } = periodRange();
  const root = h('div', {}, pageHead(labelTl('payments', 'Payments')), scopeBar(), filterBar());
  add(root, h('div', { class: 'tiles' },
    tile({ label: tr('Cash collected'), value: money(m.period_cash_collected), foot: tr('selected period, by payment date') }),
    tile({ label: tr('Outstanding'), value: money(m.outstanding_balance), foot: tr('all eligible sales') }),
    tile({ label: tr('Overdue'), value: money(m.overdue_balance), foot: tr('{0} sale(s)', m.overdue_payment_count) }),
    tile({ label: tr('Due today'), value: money(m.due_today_balance) })));
  const salesById = new Map((records().sales || []).map(s => [s.id, s]));
  add(root, h('div', { class: 'card' }, t('h2', tr('Unpaid balances')), t('div', tr('As of the reporting date. Overdue = recorded due date before the reporting date.'), 'scope'),
    dataTable({ rows: m.balances.slice(), sortKey: 'due', onRow: r => saleDrawer(salesById.get(r.sale_id)), empty: tr('No unpaid balances'), columns: [
      { key: 'sale_id', label: label('sale', tr('Sale')) },
      { key: 'customer_id', label: label('customer', tr('Customer')), text: r => customerName(r.customer_id) },
      { key: 'amount', label: tr('Amount'), num: true, text: r => money(r.amount) },
      { key: 'paid', label: tr('Paid'), num: true, text: r => money(r.paid) },
      { key: 'balance', label: tr('Balance'), num: true, text: r => money(r.balance) },
      { key: 'due', label: tr('Due'), text: r => r.due ? formatDate(r.due) : '—' },
      { key: 'state', label: tr('State'), render: r => h('span', { class: `badge ${r.state === 'overdue' ? 'critical' : r.state === 'due_today' ? 'warning' : 'muted-badge'}` }, tr(r.state.replace('_', ' '))) },
    ] })));
  let rows = (records().payments || []).filter(p => p.date >= start && p.date <= end);
  if (view.filters.channel) rows = rows.filter(p => (salesById.get(p.sale_id)?.channel || '') === view.filters.channel);
  add(root, h('div', { class: 'card' }, t('h2', tr('Receipts in period')), dataTable({ rows, sortKey: 'date', onRow: r => saleDrawer(salesById.get(r.sale_id)), columns: [
    { key: 'id', label: 'ID' },
    { key: 'date', label: tr('Date'), text: r => formatDate(r.date), sortValue: r => r.date },
    { key: 'sale_id', label: label('sale', tr('Sale')) },
    { key: 'customer', label: label('customer', tr('Customer')), text: r => customerName(salesById.get(r.sale_id)?.customer_id) },
    { key: 'amount', label: tr('Amount'), num: true, text: r => money(r.amount) },
    { key: 'method', label: tr('Method') },
  ] })));
  return root;
}
