import { h, add } from '../dom.js';
import { pageHead, scopeBar, tile, dataTable } from '../components.js';
import { metrics, labelTl } from '../view-state.js';
import { formatDate } from '../../core/dates.js';
import { tr } from '../../i18n/i18n.js';

export function renderStock() {
  const m = metrics();
  const root = h('div', {}, pageHead(labelTl('stock', 'Stock')), scopeBar({ period: false }));
  add(root, h('div', { class: 'banner info' }, tr('Stock is one shared snapshot dated {0}; it ignores period and channel filters. Available = on hand − reserved. Reservations are product totals, not allocations to orders.', m.stock_snapshot_date ? formatDate(m.stock_snapshot_date) : tr('unknown'))));
  add(root, h('div', { class: 'tiles' },
    tile({ label: tr('Products'), value: String(m.stock.length) }),
    tile({ label: tr('Low stock'), value: String(m.low_stock_ids.length), foot: tr('available ≤ threshold (equality counts)') }),
    tile({ label: tr('No available units'), value: String(m.out_of_stock_ids.length), foot: tr('subset of low stock') })));
  add(root, h('div', { class: 'card' }, dataTable({ rows: m.stock, sortKey: 'available', columns: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: tr('Product') },
    { key: 'on_hand', label: tr('On hand'), num: true },
    { key: 'reserved', label: tr('Reserved'), num: true },
    { key: 'available', label: tr('Available'), num: true },
    { key: 'reorder_threshold', label: tr('Threshold'), num: true },
    { key: 'open_units', label: tr('Open units'), num: true },
    { key: 'unreserved_pending', label: tr('Unreserved pending'), num: true },
    { key: 'low', label: tr('Status'), render: r => r.out ? h('span', { class: 'badge critical' }, tr('⚠ no available units')) : r.low ? h('span', { class: 'badge warning' }, tr('▲ low')) : h('span', { class: 'badge good' }, tr('✓ ok')) },
  ] })));
  return root;
}
