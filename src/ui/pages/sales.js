import { h, add } from '../dom.js';
import { pageHead, scopeBar, filterBar, tile, dataTable } from '../components.js';
import { view, metrics, periodRange, reportingDate, records, label, labelTl, money, customerName, customerOwner } from '../view-state.js';
import { saleDrawer } from '../drawers.js';
import { formatDate } from '../../core/dates.js';
import { tr } from '../../i18n/i18n.js';

export function renderSales() {
  const m = metrics();
  const { start, end } = periodRange();
  const root = h('div', {}, pageHead(labelTl('sales', 'Sales')), scopeBar(), filterBar());
  let scope = 'period';
  const statusSel = h('select', {}, h('option', { value: '' }, tr('All statuses')), h('option', { value: 'pending' }, tr('Pending')), h('option', { value: 'done' }, tr('Completed')), h('option', { value: 'excluded' }, tr('Cancelled/excluded')));
  const scopeSel = h('select', {}, h('option', { value: 'period' }, tr('Selected period')), h('option', { value: 'all' }, tr('All history')));
  const holder = h('div');
  const draw = () => {
    holder.textContent = '';
    let rows = (records().sales || []).filter(s => s.date <= reportingDate());
    if (view.filters.channel) rows = rows.filter(s => (s.channel || '') === view.filters.channel);
    if (view.filters.owner) rows = rows.filter(s => customerOwner(s.customer_id) === view.filters.owner);
    if (scope === 'period') rows = rows.filter(s => s.date >= start && s.date <= end);
    if (statusSel.value) rows = rows.filter(s => s.status === statusSel.value);
    add(holder, dataTable({ sortKey: 'date', rows, onRow: saleDrawer, columns: [
      { key: 'id', label: 'ID' },
      { key: 'date', label: tr('Date'), text: r => formatDate(r.date), sortValue: r => r.date },
      { key: 'customer_id', label: label('customer', tr('Customer')), text: r => customerName(r.customer_id) },
      { key: 'description', label: tr('Description') },
      { key: 'channel', label: label('channel', tr('Channel')) },
      { key: 'amount', label: tr('Amount'), num: true, text: r => money(r.amount) },
      { key: 'status', label: tr('Status'), text: r => r.status_text || r.status },
      { key: 'promised_completion_date', label: tr('Promised'), text: r => r.promised_completion_date ? formatDate(r.promised_completion_date) : '' },
    ] }));
  };
  statusSel.onchange = draw;
  scopeSel.onchange = () => { scope = scopeSel.value; draw(); };
  add(root, h('div', { class: 'tiles' },
    tile({ label: tr('Order value'), value: money(m.period_order_value), foot: tr('selected period') }),
    tile({ label: tr('Orders'), value: String(m.period_order_count) }),
    tile({ label: tr('Average order'), value: m.average_order_value === null ? '—' : money(m.average_order_value) }),
    tile({ label: tr('Overdue completions'), value: String(m.overdue_completion_ids.length), foot: tr('as of reporting date') })));
  add(root, h('div', { class: 'card' }, h('div', { class: 'filters' }, h('label', {}, tr('Rows '), scopeSel), h('label', {}, tr('Status '), statusSel)), holder));
  draw();
  return root;
}
