// Detail panels for one sale or one customer, opened from tables, tasks and the calendar.

import { h, t, drawer, toast } from './dom.js';
import { records, reportingDate, allTasks, label, money, customerName } from './view-state.js';
import { statusChip } from './components.js';
import { navigate } from './router.js';
import { formatDate } from '../core/dates.js';
import { tr } from '../i18n/i18n.js';

function relatedTasks(type, id) {
  const tasks = allTasks().filter(x => x.record_type === type && x.record_id === id);
  return tasks.length ? h('div', {}, t('h3', tr('Related tasks')), h('ul', { class: 'list' }, ...tasks.map(x => h('li', {}, `${x.title} — `, statusChip(x.status))))) : null;
}

export function saleDrawer(sale) {
  if (!sale) return;
  const payments = (records().payments || []).filter(p => p.sale_id === sale.id).sort((a, b) => a.date.localeCompare(b.date));
  const paid = payments.filter(p => p.date <= reportingDate()).reduce((a, p) => a + p.amount, 0);
  const customer = (records().customers || []).find(x => x.id === sale.customer_id);
  drawer(`${label('sale', tr('Sale'))} ${sale.id}`, h('div', { class: 'stack' },
    h('dl', { class: 'kv' },
      t('dt', label('customer', tr('Customer'))), h('dd', {}, customer ? h('a', { href: '#', onclick: e => { e.preventDefault(); customerDrawer(customer); } }, customerName(sale.customer_id)) : customerName(sale.customer_id)),
      t('dt', tr('Date')), t('dd', formatDate(sale.date)),
      t('dt', tr('Description')), t('dd', `${sale.description || '—'}${sale.quantity ? ` × ${sale.quantity}` : ''}`),
      t('dt', tr('Amount')), t('dd', money(sale.amount)),
      t('dt', tr('Status')), t('dd', `${sale.status_text || sale.status} (${tr(sale.status)})`),
      t('dt', tr('Channel')), t('dd', sale.channel || '—'),
      t('dt', tr('Payment due')), t('dd', sale.payment_due_date ? formatDate(sale.payment_due_date) : '—'),
      t('dt', tr('Promised completion')), t('dd', sale.promised_completion_date ? formatDate(sale.promised_completion_date) : '—'),
      t('dt', tr('Actual completion')), t('dd', sale.actual_completion_date ? formatDate(sale.actual_completion_date) : '—'),
      t('dt', tr('Paid to date')), t('dd', tr('{0} · balance {1}', money(paid), money(sale.amount - paid))),
      t('dt', tr('Source row')), t('dd', sale._source || '—')),
    t('h3', `${label('payments', tr('Payments'))} (${payments.length})`),
    payments.length ? h('ul', { class: 'list' }, ...payments.map(p => h('li', {}, `${formatDate(p.date)} · ${money(p.amount)}${p.method ? ' · ' + p.method : ''} · ${p.id}`))) : t('p', tr('No receipts recorded.'), 'muted'),
    relatedTasks('sales', sale.id)));
}

export function customerDrawer(c) {
  if (!c) return;
  const sales = (records().sales || []).filter(s => s.customer_id === c.id).sort((a, b) => b.date.localeCompare(a.date));
  drawer(`${label('customer', tr('Customer'))} ${c.name}`, h('div', { class: 'stack' },
    h('dl', { class: 'kv' },
      t('dt', 'ID'), t('dd', c.id), t('dt', tr('Type')), t('dd', tr(c.type)), t('dt', tr('Contact')), t('dd', c.contact || '—'),
      t('dt', tr('Added')), t('dd', c.created_date ? formatDate(c.created_date) : '—'), t('dt', label('owner', tr('Owner'))), t('dd', c.owner || tr('unassigned')),
      t('dt', tr('Next follow-up')), t('dd', c.next_follow_up_date ? formatDate(c.next_follow_up_date) : tr('none recorded')), t('dt', tr('Notes')), t('dd', c.notes || '—')),
    t('h3', `${label('sales', tr('Sales'))} (${sales.length})`),
    sales.length ? h('ul', { class: 'list' }, ...sales.map(s => h('li', {}, h('a', { href: '#', onclick: e => { e.preventDefault(); saleDrawer(s); } }, s.id), ` · ${formatDate(s.date)} · ${money(s.amount)} · ${s.status_text || s.status}`))) : t('p', tr('No sales rows for this account.'), 'muted'),
    relatedTasks('customers', c.id)));
}

export function openRecord(type, id) {
  if (type === 'sales') { const s = records().sales?.find(r => r.id === id); if (s) return saleDrawer(s); }
  if (type === 'customers') { const c = records().customers?.find(r => r.id === id); if (c) return customerDrawer(c); }
  if (type === 'stock') return navigate('stock');
  toast(tr('Record not found in this scenario'));
}
