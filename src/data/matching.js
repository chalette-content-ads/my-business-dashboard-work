// "Match your columns": lets the dashboard read a workbook that uses its own sheet names,
// column names and status words. The viewer confirms which sheet holds what, which column is
// which and what their words mean; the page pre-fills its guesses (guessMatching). The
// workbook is then rewritten in memory into the practice-workbook layout — standard sheet
// names, column names and values (applyMatching) — and read by exactly the same code as a
// practice workbook, so every figure and rule stays the same.
//
// A matching is remembered for workbooks with the same sheets and columns (the signature):
// reading an updated file again asks nothing, unless it has status words not seen before.
// Only the orders sheet must exist; customers, payments and stock may be missing.

import { LAYOUTS } from './layouts.generated.js';
import { ENTITIES } from '../core/model.js';

const LAYOUT = LAYOUTS['betterspace-b2b'];
export const ROLES = ['Sales', 'Customers', 'Payments', 'Stock']; // Sales first: the one sheet that must exist
export const OPTIONAL_ROLES = new Set(['Customers', 'Payments', 'Stock']);
export const MATCHING_VERSION = 1;

// The fields a role can have, in the practice layout's order: { canonical, header, required, type, options }.
// options: the standard words for fields whose values are chosen from a list.
export function roleFields(role) {
  const table = LAYOUT.tables.find(t => t.sheet_name === role);
  const entity = ENTITIES[table.entity];
  return table.fields.map(f => {
    const spec = entity.fields[f.canonical] || {};
    const options = spec.type === 'status' ? ['Completed', 'In Progress', 'Confirmed', 'Cancelled']
      : spec.type === 'enum' ? Object.values(f.values || {}).map(v => v[0]) : null;
    return { canonical: f.canonical, header: f.header, required: !!spec.required, type: spec.type, options };
  });
}
export const valueFields = () => ROLES.flatMap(role => roleFields(role).filter(f => f.options).map(f => ({ role, ...f, key: `${role}.${f.canonical}` })));

// Names compared without case, spaces or punctuation: "Invoice No." = "invoice_no" = "InvoiceNo".
export const nameKey = s => String(s ?? '').replace(/^﻿/, '').toLowerCase().replace(/[\s_\-.()（）:：/#'"]+/g, '');

const SHEET_NAMES = {
  Customers: ['customers', 'customer', 'clients', 'client', 'members', 'member', 'students', 'student', 'contacts', '客户', '会员', '学生', '顾客', '客户资料', '会员资料'],
  Sales: ['sales', 'sale', 'orders', 'order', 'invoices', 'invoice', 'bills', 'tickets', 'transactions', '销售', '订单', '销售单', '发票', '账单', '单据', '销售记录'],
  Payments: ['payments', 'payment', 'receipts', 'receipt', 'collections', '收款', '收款记录', '付款', '收据', '付款记录'],
  Stock: ['stock', 'inventory', 'items', 'products', 'materials', '库存', '存货', '材料', '商品', '产品', '库存表'],
};

// Column names that usually mean each field (the practice layout's own name is always included).
const COLUMN_NAMES = {
  'Customers.id': ['customer id', 'customer no', 'customer number', 'client id', 'client no', 'member id', 'member no', 'member number', 'student id', 'student no', 'account id', 'id', '客户编号', '客户号', '会员编号', '会员号', '学生编号', '学号', '编号'],
  'Customers.name': ['name', 'customer name', 'client name', 'member name', 'student name', 'full name', '姓名', '名字', '客户名称', '客户名', '会员姓名', '学生姓名', '名称'],
  'Customers.type': ['type', 'customer type', '类型', '客户类型'],
  'Customers.contact': ['contact', 'phone', 'mobile', 'tel', 'email', 'parent phone', '手机', '电话', '联络', '联系方式', '手机号码'],
  'Customers.created_date': ['joined', 'joined on', 'join date', 'date joined', 'since', 'registered', 'created', '加入日期', '注册日期', '入会日期', '开户日期'],
  'Customers.owner': ['owner', 'salesperson', 'sales person', 'staff', 'account manager', '负责人', '业务员', '销售员'],
  'Customers.next_follow_up_date': ['follow up', 'follow-up date', 'next follow up', 'next follow-up', '跟进日期', '下次跟进'],
  'Customers.notes': ['notes', 'note', 'remark', 'remarks', '备注'],
  'Sales.id': ['order id', 'order no', 'order number', 'invoice no', 'invoice id', 'invoice number', 'sale no', 'sale number', 'ticket no', 'bill no', '单号', '订单号', '订单编号', '销售单号', '发票号', '发票编号', '账单号'],
  'Sales.customer_id': ['customer id', 'customer no', 'client id', 'member id', 'member no', 'student id', 'student no', '会员编号', '客户编号', '学生编号', '学号'],
  'Sales.date': ['date', 'order date', 'invoice date', 'sale date', 'sales date', '日期', '订单日期', '销售日期', '发票日期', '开单日期'],
  'Sales.item_id': ['item id', 'sku', 'product id', 'product code', 'item code', '产品编号', '商品编号', '货号'],
  'Sales.description': ['description', 'item', 'product', 'item name', 'product name', 'details', '品项', '产品', '商品', '项目', '说明', '内容'],
  'Sales.offering_type': ['offering type', 'product or service', '产品或服务'],
  'Sales.quantity': ['quantity', 'qty', '数量'],
  'Sales.unit_price': ['unit price', 'price', 'unit fee', '单价'],
  'Sales.amount': ['amount', 'total', 'total amount', 'invoice total', 'grand total', 'order total', '金额', '总额', '总金额', '合计', '总计'],
  'Sales.channel': ['channel', 'sales channel', 'source', 'platform', '渠道', '来源', '平台'],
  'Sales.status': ['status', 'order status', '状态', '订单状态'],
  'Sales.payment_due_date': ['due date', 'payment due', 'payment due date', '付款期限', '到期日', '截止日期'],
  'Sales.promised_completion_date': ['delivery date', 'pickup date', 'pick-up date', 'promised date', 'completion date', '取货日期', '交货日期', '送货日期'],
  'Sales.actual_completion_date': ['completed on', 'delivered on', 'actual completion date', '实际完成日期', '实际交货日期'],
  'Payments.id': ['payment id', 'payment no', 'receipt no', 'receipt id', 'receipt number', '收据号', '收据编号', '收款编号', '付款编号'],
  'Payments.sale_id': ['order id', 'order no', 'invoice no', 'invoice id', 'invoice number', 'sale no', '单号', '订单号', '订单编号', '发票号'],
  'Payments.date': ['date', 'payment date', 'paid on', 'received on', 'received date', '付款日期', '收款日期', '日期'],
  'Payments.amount': ['amount', 'amount paid', 'paid', 'amount received', '金额', '收款金额', '付款金额'],
  'Payments.method': ['method', 'payment method', 'paid by', '付款方式', '支付方式'],
  'Stock.id': ['item id', 'sku', 'code', 'product id', 'item code', 'material id', '材料编号', '产品编号', '商品编号', '货号', '编号'],
  'Stock.name': ['name', 'item name', 'item', 'product', 'product name', '材料名称', '产品名称', '商品名称', '名称'],
  'Stock.snapshot_date': ['date', 'count date', 'stock take date', 'stocktake date', 'as of', '盘点日期', '日期'],
  'Stock.on_hand': ['on hand', 'quantity', 'qty', 'stock', 'in stock', 'balance', '现存量', '库存', '存量', '数量', '库存量'],
  'Stock.reserved': ['reserved', '已预留', '预留'],
  'Stock.reorder_threshold': ['reorder level', 'reorder point', 'minimum', 'min stock', 'safety stock', '安全存量', '最低库存', '补货点'],
};

// Status words → what they mean for an order. The status of an order is whether the work is
// done (delivered, served, class given) — not whether it is paid: payments are counted from
// the payments sheet. So payment words (Paid, Issued, Unpaid) mean "Completed".
const STATUS_WORDS = {
  Completed: ['completed', 'complete', 'done', 'finished', 'delivered', 'closed', 'fulfilled', 'paid', 'issued', 'unpaid', 'partially paid', 'partial', 'overdue', 'invoiced', 'selesai', '已完成', '完成', '已交货', '已送达', '已付', '已付款', '未付', '未付款', '部分付款', '已开单'],
  'In Progress': ['in progress', 'processing', 'preparing', 'open', 'ongoing', 'pending', 'dalam proses', '进行中', '制作中', '处理中', '待处理', '未完成', '准备中'],
  Confirmed: ['confirmed', 'booked', 'scheduled', 'new', 'accepted', '已确认', '已预订', '新单'],
  Cancelled: ['cancelled', 'canceled', 'void', 'voided', 'refunded', 'rejected', 'batal', '已取消', '取消', '作废', '退款', '已退款'],
};
const ENUM_WORDS = {
  'Customers.type': { Customer: ['customer', 'client', 'member', 'student', 'active', '客户', '会员', '学生', '顾客'], Prospect: ['prospect', 'lead', 'enquiry', 'inquiry', '潜在客户', '询问', '潜客'] },
  'Sales.offering_type': { Product: ['product', 'goods', 'item', 'merchandise', '产品', '商品', '货品'], Service: ['service', 'class', 'lesson', 'course', 'session', 'installation', 'consultation', '服务', '课程', '课'] },
};

const headersOf = sheet => (sheet?.rows?.[0] || []).map(v => String(v ?? '').trim());
const sheetByName = (sheets, name) => sheets.find(s => s.name === name);

function guessColumns(role, headers) {
  const used = new Set();
  const columns = {};
  const fields = roleFields(role).sort((a, b) => Number(b.required) - Number(a.required));
  for (const f of fields) {
    const names = new Set([f.header, f.canonical, ...(COLUMN_NAMES[`${role}.${f.canonical}`] || [])].map(nameKey));
    const i = headers.findIndex((h, idx) => h && !used.has(idx) && names.has(nameKey(h)));
    if (i !== -1) { used.add(i); columns[f.canonical] = headers[i]; }
  }
  return columns;
}

// How well a sheet fits a role; 0 when it should not be guessed at all. A sheet is only
// guessed when its name fits the role or it has every column the role requires.
function sheetScore(role, sheet) {
  const cols = guessColumns(role, headersOf(sheet));
  const fields = roleFields(role);
  const required = fields.filter(f => f.required && cols[f.canonical]).length;
  const allRequired = required === fields.filter(f => f.required).length;
  const named = SHEET_NAMES[role].map(nameKey).includes(nameKey(sheet.name));
  if (!named && !allRequired) return 0;
  return (named ? 4 : 0) + required * 2 + Object.keys(cols).length;
}

// The distinct values (as written) in a mapped column, in order of first appearance.
export function distinctValues(sheets, matching, role, canonical, limit = 60) {
  const sheet = sheetByName(sheets, matching.roles[role]);
  const header = matching.columns[role]?.[canonical];
  if (!sheet || !header) return [];
  const idx = headersOf(sheet).indexOf(header);
  if (idx === -1) return [];
  const seen = [];
  for (const row of sheet.rows.slice(1)) {
    const v = String(row?.[idx] ?? '').trim();
    if (v && !seen.includes(v)) { seen.push(v); if (seen.length >= limit) break; }
  }
  return seen;
}

function guessValue(key, value) {
  const k = nameKey(value);
  const table = key === 'Sales.status' ? STATUS_WORDS : ENUM_WORDS[key];
  for (const [option, words] of Object.entries(table || {})) {
    if (nameKey(option) === k || words.some(w => nameKey(w) === k)) return option;
  }
  return '';
}

// Text dates like 03/09/2026: day first unless a value can only be month first.
function guessDateOrder(sheets, matching) {
  let dmy = 0, mdy = 0;
  for (const role of ROLES) for (const f of roleFields(role).filter(x => x.type === 'date')) {
    for (const v of distinctValues(sheets, matching, role, f.canonical, 200)) {
      const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-]\d{4}$/);
      if (m && +m[1] > 12) dmy++;
      if (m && +m[2] > 12) mdy++;
    }
  }
  return mdy > dmy ? 'mdy' : 'dmy';
}

// Fills in the value meanings for the value columns currently matched, keeping earlier answers.
export function refreshValues(sheets, matching) {
  const values = {};
  for (const f of valueFields()) {
    const found = distinctValues(sheets, matching, f.role, f.canonical);
    if (!found.length) continue;
    values[f.key] = Object.fromEntries(found.map(v => [v, matching.values?.[f.key]?.[v] || guessValue(f.key, v)]));
  }
  return { ...matching, values };
}

// The page's first guess for a workbook: [{ name, rows }] → a matching.
export function guessMatching(sheets) {
  const candidates = [];
  for (const role of ROLES) for (const s of sheets) candidates.push({ role, sheet: s.name, score: sheetScore(role, s) });
  candidates.sort((a, b) => b.score - a.score);
  const roles = Object.fromEntries(ROLES.map(r => [r, null]));
  const used = new Set();
  for (const c of candidates) {
    if (roles[c.role] !== null || used.has(c.sheet) || c.score < 3) continue;
    roles[c.role] = c.sheet; used.add(c.sheet);
  }
  const columns = Object.fromEntries(ROLES.map(r => [r, roles[r] ? guessColumns(r, headersOf(sheetByName(sheets, roles[r]))) : {}]));
  const matching = { version: MATCHING_VERSION, roles, columns, values: {}, dateOrder: 'dmy' };
  matching.dateOrder = guessDateOrder(sheets, matching);
  return refreshValues(sheets, matching);
}

// A workbook whose layout changed a little since it was matched (a column added or renamed,
// a sheet added) starts from the closest remembered matching instead of fresh guesses: every
// earlier choice whose sheet and column are still there is kept, the rest is guessed as usual,
// and earlier meanings of status words are carried over. remembered: matchings, most recent
// first. Returns { matching, lost } — lost lists the earlier choices that are gone
// ([{ role, sheet }] or [{ role, canonical, header }]) — or null when no remembered matching
// uses an orders sheet this workbook still has.
export function closestMatching(sheets, remembered) {
  let best = null;
  for (const saved of remembered) {
    const r = adaptMatching(sheets, saved);
    if (r && (!best || r.kept > best.kept)) best = r;
  }
  return best && { matching: best.matching, lost: best.lost };
}

function adaptMatching(sheets, saved) {
  const has = name => !!name && !!sheetByName(sheets, name);
  if (!has(saved?.roles?.Sales)) return null;
  const guess = guessMatching(sheets);
  const keptSheets = new Set(ROLES.map(r => saved.roles[r]).filter(has));
  const roles = {}, columns = {}, lost = [];
  let kept = 0;
  for (const role of ROLES) {
    const name = saved.roles[role];
    if (has(name)) {
      roles[role] = name; kept++;
      const headers = headersOf(sheetByName(sheets, name));
      const keep = {};
      for (const [canonical, header] of Object.entries(saved.columns?.[role] || {})) {
        if (headers.includes(header)) { keep[canonical] = header; kept++; } else lost.push({ role, canonical, header });
      }
      const used = new Set(Object.values(keep));
      const fresh = Object.entries(guessColumns(role, headers)).filter(([c, h]) => !(c in keep) && !used.has(h));
      columns[role] = { ...keep, ...Object.fromEntries(fresh) };
    } else {
      if (name) lost.push({ role, sheet: name });
      roles[role] = guess.roles[role] && !keptSheets.has(guess.roles[role]) ? guess.roles[role] : null;
      columns[role] = roles[role] ? guess.columns[role] : {};
    }
  }
  const matching = { version: MATCHING_VERSION, roles, columns, values: saved.values || {}, dateOrder: saved.dateOrder === 'mdy' ? 'mdy' : 'dmy' };
  return { matching: refreshValues(sheets, matching), lost, kept };
}

// Changing a role's sheet re-guesses that sheet's columns.
export function chooseSheet(sheets, matching, role, sheetName) {
  const roles = { ...matching.roles, [role]: sheetName || null };
  const columns = { ...matching.columns, [role]: sheetName ? guessColumns(role, headersOf(sheetByName(sheets, sheetName))) : {} };
  return refreshValues(sheets, { ...matching, roles, columns });
}

export function chooseColumn(sheets, matching, role, canonical, header) {
  const cols = { ...matching.columns[role] };
  if (header) cols[canonical] = header; else delete cols[canonical];
  return refreshValues(sheets, { ...matching, columns: { ...matching.columns, [role]: cols } });
}

export function chooseValue(matching, key, value, meaning) {
  return { ...matching, values: { ...matching.values, [key]: { ...matching.values[key], [value]: meaning } } };
}

// Sheets and column names identify a workbook's layout (not its rows).
export function workbookSignature(sheets) {
  const text = sheets.map(s => `${s.name}\u0001${headersOf(s).join('\u0002')}`).sort().join('\u0003');
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// What the viewer still has to answer (in the page's words), or [] when the matching is complete.
export function openQuestions(sheets, matching) {
  const out = [];
  if (!matching.roles.Sales) out.push({ kind: 'sheet', role: 'Sales' });
  for (const role of ROLES) {
    if (!matching.roles[role]) continue;
    for (const f of roleFields(role)) if (f.required && !matching.columns[role]?.[f.canonical]) out.push({ kind: 'column', role, canonical: f.canonical });
  }
  for (const [key, map] of Object.entries(matching.values || {})) for (const [value, meaning] of Object.entries(map)) if (!meaning) out.push({ kind: 'value', key, value });
  return out;
}

const DATE_TEXT = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;
const pad = n => String(n).padStart(2, '0');

// Rewrites the workbook into the practice layout. Returns { sheets, absent } — sheets keyed
// Customers/Sales/Payments/Stock with the standard column names and values; absent lists the
// roles the workbook does not have (they become empty sheets). Call when openQuestions is [].
export function applyMatching(sheets, matching) {
  const out = {};
  const absent = [];
  for (const role of ROLES) {
    const fields = roleFields(role);
    const source = matching.roles[role] ? sheetByName(sheets, matching.roles[role]) : null;
    if (!source) {
      out[role] = [fields.filter(f => f.required).map(f => f.header)];
      absent.push(role);
      continue;
    }
    const headers = headersOf(source);
    const picked = fields.filter(f => matching.columns[role]?.[f.canonical]).map(f => ({ ...f, index: headers.indexOf(matching.columns[role][f.canonical]) })).filter(f => f.index !== -1);
    const rows = [picked.map(f => f.header)];
    for (const row of source.rows.slice(1)) {
      rows.push(picked.map(f => {
        let v = row?.[f.index] ?? '';
        if (f.options) {
          const meaning = matching.values?.[`${role}.${f.canonical}`]?.[String(v).trim()];
          if (meaning) v = meaning;
        } else if (f.type === 'date' && typeof v === 'string') {
          const m = v.trim().match(DATE_TEXT);
          if (m) v = matching.dateOrder === 'mdy' ? `${m[3]}-${pad(m[1])}-${pad(m[2])}` : `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
        }
        return v;
      }));
    }
    out[role] = rows;
  }
  // No customers sheet, but the orders name a customer: list those customers (named by their code).
  if (absent.includes('Customers') && matching.columns.Sales?.customer_id) {
    const idx = out.Sales[0].indexOf(roleFields('Sales').find(f => f.canonical === 'customer_id').header);
    const ids = [...new Set(out.Sales.slice(1).map(r => String(r[idx] ?? '').trim()).filter(Boolean))];
    const [idHeader, nameHeader] = ['id', 'name'].map(c => roleFields('Customers').find(f => f.canonical === c).header);
    out.Customers = [[idHeader, nameHeader], ...ids.map(id => [id, id])];
    absent.splice(absent.indexOf('Customers'), 1);
  }
  return { sheets: out, absent };
}
