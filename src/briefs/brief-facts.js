// Checks that an AI answer only uses numbers that are really in its input — the rule the
// request gives Gemini ("use only numbers, dates and keys that appear in the Data").
// ai-prompt.js answerProblems() runs it over every Gemini answer before it is shown.

export function allowedFacts(input) {
  const money = new Set(), counts = new Set(), dates = new Set(), percents = new Set(), ids = new Set(), names = new Set();
  const addMetrics = m => {
    if (!m) return;
    for (const k of ['period_order_value', 'average_order_value', 'period_cash_collected', 'all_time_order_value', 'all_time_cash_collected', 'outstanding_balance', 'overdue_balance', 'due_today_balance']) if (m[k] !== null) money.add(m[k]);
    money.add(m.comparison.prior_order_value);
    for (const v of Object.values(m.by_channel || {})) money.add(v);
    for (const b of m.balances) { money.add(b.amount); money.add(b.paid); money.add(b.balance); }
    for (const k of ['period_order_count', 'period_receipt_count', 'overdue_payment_count', 'pending_completion_count']) counts.add(m[k]);
    for (const k of ['overdue_completion_ids', 'due_today_completion_ids', 'low_stock_ids', 'out_of_stock_ids', 'overdue_follow_up_ids', 'follow_up_today_ids', 'unassigned_prospect_ids', 'repeat_customer_ids']) counts.add(m[k].length);
    for (const s of m.stock) for (const k of ['on_hand', 'reserved', 'available', 'reorder_threshold', 'open_units', 'unreserved_pending']) counts.add(s[k] || 0);
    for (const d of [m.reporting_date, m.period.start, m.period.end, m.comparison.start, m.comparison.end, m.stock_snapshot_date]) if (d) dates.add(d);
    if (m.comparison.growth !== null) percents.add(Math.abs(m.comparison.growth * 100).toFixed(1));
  };
  addMetrics(input.metrics);
  addMetrics(input.previousMetrics);
  const open = input.tasks.filter(t => !t.resolved);
  counts.add(open.length);
  counts.add(input.tasks.filter(t => t.resolved).length);
  for (const t of input.tasks) {
    for (const d of [t.action_date, t.recorded_deadline, t.suggested_date]) if (d) dates.add(d);
    for (const k of ['balance', 'amount', 'paid']) if (typeof t.evidence?.[k] === 'number') money.add(t.evidence[k]);
  }
  for (const e of input.calendar) dates.add(e.date);
  for (const sc of [input.scenario, input.previous].filter(Boolean)) {
    dates.add(sc.reportingDate);
    for (const list of Object.values(sc.records)) for (const r of list) {
      ids.add(r.id);
      if (r.name) names.add(r.name);
      if (r.description) names.add(r.description);
    }
    const b = sc.profile.business;
    for (const n of [b.name, b.name_zh]) if (n) names.add(n);
  }
  return { money, counts, dates, percents, ids, names };
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Returns the tokens in `text` that are not supported by `facts` (empty = all good).
export function unsupportedTokens(text, facts, { year = 2026 } = {}) {
  const problems = [];
  let s = String(text);
  // Names such as "Demo Shopper 001" contain digits that are not claims.
  for (const n of [...facts.names].sort((a, b) => b.length - a.length)) s = s.split(n).join(' ');
  s = s.replace(/\bDay [12]\b|第 ?[12] ?天/g, ' ');
  s = s.replace(/\b(?:[A-Z]{1,3}-\d{2,4}|[A-Z]\d{3})\b/g, id => { if (!facts.ids.has(id)) problems.push(`unknown record ${id}`); return ' '; });
  s = s.replace(/RM\s?(\d[\d,]*(?:\.\d{1,2})?)/g, (m, v) => { const c = Math.round(Number(v.replace(/,/g, '')) * 100); if (!facts.money.has(c)) problems.push(`amount ${m}`); return ' '; });
  s = s.replace(/(\d+(?:\.\d+)?)\s?%/g, (m, v) => { if (!facts.percents.has(Number(v).toFixed(1))) problems.push(`percentage ${m}`); return ' '; });
  const checkDate = (m, d) => { if (!facts.dates.has(d)) problems.push(`date ${m} (${d})`); return ' '; };
  s = s.replace(/\b\d{4}-\d{2}-\d{2}\b/g, m => checkDate(m, m));
  s = s.replace(/(\d{1,2})\s?[–-]\s?(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*/g, (m, a, b, mon) => { checkDate(m, iso(year, MONTHS[mon.toLowerCase()], a)); return checkDate(m, iso(year, MONTHS[mon.toLowerCase()], b)); });
  s = s.replace(/(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*/g, (m, d, mon) => checkDate(m, iso(year, MONTHS[mon.toLowerCase()], d)));
  s = s.replace(/(\d{1,2})月(\d{1,2})\s?[–-]\s?(\d{1,2})日/g, (m, mon, a, b) => { checkDate(m, iso(year, mon, a)); return checkDate(m, iso(year, mon, b)); });
  s = s.replace(/(\d{1,2})月(\d{1,2})日/g, (m, mon, d) => checkDate(m, iso(year, mon, d)));
  s = s.replace(/(\d{1,2})\s?月(?!\s?\d)/g, (m, mon) => { if (![...facts.dates].some(d => Number(d.slice(5, 7)) === Number(mon))) problems.push(`month ${m}`); return ' '; });
  s.replace(/\d+(?:\.\d+)?/g, m => { if (!facts.counts.has(Number(m))) problems.push(`number ${m}`); return m; });
  return problems;
}

// Every text field of a brief, for checking.
