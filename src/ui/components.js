// Reusable pieces shared by the pages (from the original template's app.js).

import { h, t, add } from './dom.js';
import { view, scenario, reportingDate, periodRange, records, label, money, defaultFilters, isExcel } from './view-state.js';
import { rerender } from './router.js';
import { formatDate } from '../core/dates.js';
import { sourceCoverage } from '../core/mapping.js';
import { dayNumber } from '../data/scenarios.js';
import { tr, tl } from '../i18n/i18n.js';

// A tl() label "中文（English）" as Chinese plus a quieter English part; the text is unchanged.
export function bilingual(text) {
  const m = /^(.+?)(（.+）)$/.exec(text);
  return m ? [m[1], t('span', m[2], 'en')] : [text];
}

export function pageHead(title, ...extra) {
  return h('div', { class: 'page-head' }, h('h1', {}, ...bilingual(title)), ...extra);
}

// What the figures on this page are "as of" — always visible so nobody mistakes the
// training snapshot for today's business.
export function scopeBar({ period = true } = {}) {
  const rd = reportingDate();
  const { start, end } = periodRange();
  const cov = sourceCoverage(records());
  return h('div', { class: 'card small scope-card' },
    h('div', { class: 'row' },
      h('span', {}, h('b', {}, tr('Reporting date: ')), formatDate(rd), ' ', t('span', isExcel() ? tr('(the latest date in your Excel)') : tr('(fixed for Day {0} of the training data)', dayNumber(scenario().day)), 'muted')),
      h('span', {}, h('b', {}, tr('Records up to: ')), cov.latest_event_date ? formatDate(cov.latest_event_date) : '—'),
      period ? h('span', {}, h('b', {}, tr('Period: ')), `${formatDate(start)} – ${formatDate(end)}`) : null),
    period ? t('div', tr('Period filters apply to order value, order count and cash collected. Balances, deadlines, follow-ups and stock are as-of measures and ignore the period.'), 'muted') : null);
}

export function filterBar({ channel = true, owner = true } = {}) {
  const f = view.filters;
  const presets = [['mtd', tr('Month to date')], ['prev_month', tr('Previous month')], ['last7', tr('Last 7 days')], ['last30', tr('Last 30 days')], ['all', tr('All history')], ['custom', tr('Custom')]];
  const sel = h('select', { onchange: e => { f.preset = e.target.value; rerender(); } }, ...presets.map(([v, l]) => h('option', { value: v, selected: f.preset === v }, l)));
  const bar = h('div', { class: 'filters' }, h('label', {}, tr('Period '), sel));
  if (f.preset === 'custom') {
    add(bar,
      h('label', {}, tr('From '), h('input', { type: 'date', value: f.start, min: scenario().historyStart, max: reportingDate(), onchange: e => { f.start = e.target.value; rerender(); } })),
      h('label', {}, tr('To '), h('input', { type: 'date', value: f.end, min: scenario().historyStart, max: reportingDate(), onchange: e => { f.end = e.target.value; rerender(); } })));
  }
  const channels = [...new Set((records().sales || []).map(s => s.channel).filter(Boolean))].sort();
  if (channel && channels.length > 1) add(bar, h('label', {}, `${label('channel', tr('Channel'))} `, h('select', { onchange: e => { f.channel = e.target.value; rerender(); } }, h('option', { value: '' }, tr('All')), ...channels.map(c => h('option', { value: c, selected: f.channel === c }, c)))));
  const owners = [...new Set((records().customers || []).map(c => c.owner).filter(Boolean))].sort();
  if (owner && owners.length) add(bar, h('label', {}, `${label('owner', tr('Owner'))} `, h('select', { onchange: e => { f.owner = e.target.value; rerender(); } }, h('option', { value: '' }, tr('All')), ...owners.map(c => h('option', { value: c, selected: f.owner === c }, c)))));
  if (f.preset !== 'mtd' || f.channel || f.owner) add(bar, h('button', { class: 'btn ghost small', onclick: () => { view.filters = defaultFilters(); rerender(); } }, tl('Reset filters')));
  return bar;
}

export function tile({ label: lbl, value, delta, foot, hero = false, cls = '' }) {
  return h('div', { class: `tile ${hero ? 'hero' : ''} ${cls}` }, t('div', lbl, 'label'), t('div', value, 'value'), delta ? h('div', { class: `delta ${delta.dir || ''}` }, delta.text) : null, foot ? t('div', foot, 'foot') : null);
}

export function statusChip(status) { return h('span', { class: `status ${status}` }, tr(status)); }

export function dataTable({ columns, rows, onRow, empty = tr('Nothing to show'), sortKey, pageSize = 50 }) {
  let sort = { key: sortKey || columns[0].key, asc: true };
  let query = '';
  let shown = pageSize;
  const wrap = h('div');
  const search = h('input', { type: 'search', placeholder: tr('Search…'), 'aria-label': tr('Search…'), oninput: e => { query = e.target.value.toLowerCase(); shown = pageSize; draw(); } });
  const table = h('table');
  const more = h('button', { class: 'btn small', onclick: () => { shown += pageSize; draw(); } }, tl('Show more'));
  const count = h('span', { class: 'small muted' });
  function draw() {
    table.textContent = '';
    const thead = h('thead', {}, h('tr', {}, ...columns.map(c => h('th', { class: (c.num ? 'num ' : '') + (sort.key === c.key ? 'sorted ' + (sort.asc ? 'asc' : '') : ''), scope: 'col', onclick: () => { if (sort.key === c.key) sort.asc = !sort.asc; else sort = { key: c.key, asc: true }; draw(); } }, c.label))));
    let list = rows;
    if (query) list = list.filter(r => columns.some(c => String(c.text ? c.text(r) : r[c.key] ?? '').toLowerCase().includes(query)));
    const col = columns.find(c => c.key === sort.key);
    list = list.slice().sort((a, b) => {
      const va = col?.sortValue ? col.sortValue(a) : a[sort.key];
      const vb = col?.sortValue ? col.sortValue(b) : b[sort.key];
      const blank = v => v === null || v === undefined || v === '';
      const r = va === vb ? 0 : blank(va) ? 1 : blank(vb) ? -1 : (typeof va === 'number' && typeof vb === 'number') ? va - vb : String(va).localeCompare(String(vb));
      return sort.asc ? r : -r;
    });
    const tbody = h('tbody');
    for (const r of list.slice(0, shown)) {
      add(tbody, h('tr', { class: onRow ? 'clickable' : '', tabindex: onRow ? '0' : null, onclick: onRow ? () => onRow(r) : null, onkeydown: onRow ? e => { if (e.key === 'Enter') onRow(r); } : null },
        ...columns.map(c => h('td', { class: c.num ? 'num' : '' }, c.render ? c.render(r) : (c.text ? c.text(r) : (r[c.key] ?? ''))))));
    }
    if (!list.length) add(tbody, h('tr', {}, h('td', { colspan: columns.length, class: 'empty' }, empty)));
    add(table, thead, tbody);
    more.hidden = list.length <= shown;
    count.textContent = tr('{0} of {1}', Math.min(shown, list.length), list.length);
  }
  add(wrap, h('div', { class: 'row', style: 'margin-bottom:8px' }, search, count), h('div', { class: 'table-wrap' }, table), more);
  draw();
  return wrap;
}

export function compactMoney(cents) { const v = cents / 100; if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'; if (v >= 1e3) return (v / 1e3).toFixed(v >= 1e4 ? 0 : 1) + 'K'; return String(Math.round(v)); }

export function trendChart(trend, rd) {
  const W = 640, H = 220, padL = 56, padR = 12, padT = 16, padB = 34;
  const max = Math.max(1, ...trend.map(x => x.order_value));
  const SVG = 'http://www.w3.org/2000/svg'; // XML namespace name, not a network address
  const ns = (tag, attrs) => { const el = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); return el; };
  const svg = ns('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': tr('Monthly order value bar chart') });
  const pat = ns('pattern', { id: 'hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
  add(pat, ns('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: 'var(--accent)', 'stroke-width': 2 }));
  add(svg, add(ns('defs', {}), pat));
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const step = innerW / Math.max(1, trend.length);
  const barW = Math.min(48, step * 0.6);
  for (let i = 0; i <= 4; i++) {
    const y = padT + innerH - (innerH * i) / 4;
    add(svg, ns('line', { x1: padL, x2: W - padR, y1: y, y2: y, class: i === 0 ? 'axis' : 'grid' }));
    const lab = ns('text', { x: padL - 6, y: y + 4, 'text-anchor': 'end' }); lab.textContent = compactMoney((max * i) / 4); add(svg, lab);
  }
  const wrap = h('div', { class: 'chart-wrap' });
  const tip = h('div', { class: 'chart-tip', hidden: true });
  trend.forEach((pt, i) => {
    const x = padL + step * i + (step - barW) / 2;
    const hgt = (innerH * pt.order_value) / max;
    const y = padT + innerH - hgt;
    const r = ns('rect', { x, y, width: barW, height: Math.max(0, hgt), rx: 4, class: 'bar' + (pt.partial ? ' partial' : '') });
    const title = ns('title', {}); title.textContent = `${pt.month}: ${money(pt.order_value)}`; add(r, title);
    const show = () => { tip.hidden = false; tip.textContent = `${pt.month}${pt.partial ? tr(' (to ') + formatDate(pt.end) + ')' : ''}: ${money(pt.order_value)}`; tip.style.left = `${((x + barW / 2) / W) * 100}%`; tip.style.top = `${(y / H) * 100}%`; };
    r.addEventListener('mouseenter', show); r.addEventListener('mousemove', show); r.addEventListener('mouseleave', () => { tip.hidden = true; });
    add(svg, r);
    const lab = ns('text', { x: x + barW / 2, y: H - padB + 16, 'text-anchor': 'middle' }); lab.textContent = pt.month.slice(5) + '/' + pt.month.slice(2, 4) + (pt.partial ? '*' : ''); add(svg, lab);
  });
  add(wrap, svg, tip, t('div', tr('* partial month, up to {0}', formatDate(rd)), 'hint'));
  return wrap;
}

export function hbars(items) {
  const max = Math.max(1, ...items.map(i => i.value));
  return h('div', {}, ...items.map(i => h('div', { class: 'hbar' }, h('span', { class: 'nowrap', title: i.label }, i.label), h('div', { class: 'track' }, h('div', { class: 'fill', style: `width:${(i.value / max) * 100}%` })), h('span', { class: 'num right' }, money(i.value)))));
}
