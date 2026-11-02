import { h, add } from '../dom.js';
import { pageHead, scopeBar, filterBar, tile, dataTable } from '../components.js';
import { view, metrics, reportingDate, records, label, labelTl, money } from '../view-state.js';
import { customerDrawer } from '../drawers.js';
import { formatDate } from '../../core/dates.js';
import { tr } from '../../i18n/i18n.js';

export function renderCustomers() {
  const m = metrics();
  const rd = reportingDate();
  const root = h('div', {}, pageHead(labelTl('customers', 'Customers')), scopeBar(), filterBar({ channel: false }));
  const sales = records().sales || [];
  const salesCount = new Map();
  for (const s of sales) { if (s.status === 'excluded') continue; salesCount.set(s.customer_id, (salesCount.get(s.customer_id) || 0) + 1); }
  const paidBySale = new Map();
  for (const p of records().payments || []) if (p.date <= rd) paidBySale.set(p.sale_id, (paidBySale.get(p.sale_id) || 0) + p.amount);
  const balance = new Map();
  for (const s of sales) {
    if (s.status === 'excluded' || s.date > rd) continue;
    const b = s.amount - (paidBySale.get(s.id) || 0);
    if (b > 0) balance.set(s.customer_id, (balance.get(s.customer_id) || 0) + b);
  }
  let rows = records().customers || [];
  if (view.filters.owner) rows = rows.filter(c => (c.owner || '') === view.filters.owner);
  const hasFollow = rows.some(c => c.next_follow_up_date);
  const hasOwner = rows.some(c => c.owner);
  add(root, h('div', { class: 'tiles' },
    tile({ label: tr('Accounts'), value: String(rows.length) }),
    tile({ label: tr('Repeat customers in period'), value: String(m.repeat_customer_ids.length), foot: tr('2+ sales in the selected period') }),
    hasFollow ? tile({ label: tr('Follow-ups overdue'), value: String(m.overdue_follow_up_ids.length), foot: tr('{0} due today', m.follow_up_today_ids.length) }) : null,
    hasOwner ? tile({ label: tr('Unassigned prospects'), value: String(m.unassigned_prospect_ids.length) }) : null));
  add(root, h('div', { class: 'card' }, dataTable({ rows, onRow: customerDrawer, sortKey: 'name', columns: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: tr('Name') },
    { key: 'type', label: tr('Type'), text: r => tr(r.type) },
    hasOwner ? { key: 'owner', label: label('owner', tr('Owner')), text: r => r.owner || tr('unassigned') } : null,
    { key: 'sales', label: label('sales', tr('Sales')), num: true, text: r => String(salesCount.get(r.id) || 0), sortValue: r => salesCount.get(r.id) || 0 },
    { key: 'balance', label: tr('Balance'), num: true, text: r => balance.get(r.id) ? money(balance.get(r.id)) : '', sortValue: r => balance.get(r.id) || 0 },
    hasFollow ? { key: 'next_follow_up_date', label: tr('Next follow-up'), text: r => r.next_follow_up_date ? `${formatDate(r.next_follow_up_date)}${r.next_follow_up_date < rd ? tr(' (overdue)') : ''}` : '' } : null,
  ].filter(Boolean) })));
  return root;
}
