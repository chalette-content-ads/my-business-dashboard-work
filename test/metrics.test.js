// Reconciliation with the training pack's answer keys (test/expected/*/expected_metrics.json).
// The app never reads those files: figures are calculated from the CSV records, and
// these tests compare the results. Adapted from the original template's fixtures test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadScenario, businessIds, DAYS } from './support/training.js';
import { computeMetrics } from '../src/core/metrics.js';
import { resolveReportingDate } from '../src/core/mapping.js';
import { suggestionsFor } from '../src/core/scenario-tasks.js';
import { setLocale } from '../src/i18n/i18n.js';

setLocale('en');
const here = path.dirname(fileURLToPath(import.meta.url));
const expected = (business, day) => JSON.parse(readFileSync(path.join(here, 'expected', business, day, 'expected_metrics.json'), 'utf8'));
const cents = n => Math.round(n * 100);
const SCENARIOS = [['b2c', 'day1'], ['b2c', 'day2'], ['b2b', 'day1'], ['b2b', 'day2']];

test('the training material has two businesses with two days each (test data, not in the dashboard)', () => {
  assert.deepEqual(businessIds(), ['betterspace-b2c', 'betterspace-b2b']);
  assert.deepEqual(DAYS, ['day1', 'day2']);
});

for (const [business, day] of SCENARIOS) {
  test(`${business} ${day}: calculated figures match expected_metrics.json`, () => {
    const s = loadScenario(`betterspace-${business}`, day);
    const e = expected(business, day);
    assert.equal(s.ok, true, JSON.stringify(s.issues.filter(i => i.level === 'error').slice(0, 3)));
    assert.deepEqual(s.issues, [], 'the supplied records raise no warnings either');
    assert.equal(s.records.customers.length, e.row_counts.Customers);
    assert.equal(s.records.sales.length, e.row_counts.Sales);
    assert.equal(s.records.payments.length, e.row_counts.Payments);
    assert.equal(s.records.stock.length, e.row_counts.Stock);
    // The period the dashboard opens with: month to date.
    const m = computeMetrics(s.records, s.reportingDate, { historyStart: s.historyStart });
    assert.equal(m.period.start, '2026-08-01');
    assert.equal(m.period.end, e.as_of_date);
    assert.equal(m.all_time_order_value, cents(e.all_time_order_value));
    assert.equal(m.all_time_cash_collected, cents(e.all_time_cash_collected));
    assert.equal(m.outstanding_balance, cents(e.outstanding_balance));
    assert.equal(m.overdue_balance, cents(e.overdue_balance));
    assert.equal(m.period_order_value, cents(e.august_order_value));
    assert.equal(m.period_order_count, e.august_order_count);
    assert.equal(m.period_cash_collected, cents(e.august_cash_collected));
    assert.equal(m.comparison.prior_order_value, cents(e.prior_comparable_order_value));
    assert.deepEqual(m.overdue_sale_ids, [...e.overdue_sale_ids].sort());
    assert.deepEqual(m.overdue_completion_ids, [...e.overdue_completion_ids].sort());
    assert.deepEqual(m.low_stock_ids, [...e.low_stock_ids].sort());
    assert.deepEqual(m.overdue_follow_up_ids, [...e.overdue_follow_up_ids].sort());
    assert.deepEqual(m.unassigned_prospect_ids, [...e.unassigned_prospect_ids].sort());
    assert.equal(m.negative_balance_count, 0);
    const story = m.balances.find(b => b.sale_id === 'BS-001');
    assert.equal(story ? story.balance : 0, cents(e.story_sale_balance));
  });

  test(`${business} ${day}: the reporting date is fixed by metadata, not by the clock`, () => {
    const s = loadScenario(`betterspace-${business}`, day);
    assert.equal(s.reportingDate, expected(business, day).as_of_date);
    assert.equal(s.reportingDate, s.metadata.as_of_date);
    assert.equal(s.reportingDate, day === 'day1' ? '2026-08-30' : '2026-08-31');
    // Consistent with the records themselves: the latest dated event is the as-of date.
    assert.equal(resolveReportingDate({ reporting_date: { mode: 'latest_event_date' } }, s.records, '2099-12-31').date, s.reportingDate);
  });
}

test('no code path reads the computer clock for a business date', () => {
  const RealDate = Date;
  class FrozenDate extends RealDate { constructor(...a) { super(...(a.length ? a : ['2031-02-03T04:05:06Z'])); } static now() { return new RealDate('2031-02-03T04:05:06Z').getTime(); } }
  globalThis.Date = FrozenDate;
  try {
    const s = loadScenario('betterspace-b2b', 'day1');
    const m = computeMetrics(s.records, s.reportingDate, { historyStart: s.historyStart });
    assert.equal(m.reporting_date, '2026-08-30');
    assert.equal(m.overdue_balance, 3051500);
    const t = suggestionsFor(s).find(x => x.task_key === 'payment_follow_up:BS-001');
    assert.equal(t.suggested_date, '2026-08-30');
  } finally { globalThis.Date = RealDate; }
});

test('b2b day1: suggestions carry evidence, recorded deadlines and suggested dates that differ', () => {
  const tasks = suggestionsFor(loadScenario('betterspace-b2b', 'day1'));
  const keys = tasks.map(t => t.task_key);
  assert.equal(new Set(keys).size, keys.length, 'task keys are unique');
  const bs001 = tasks.find(t => t.task_key === 'payment_follow_up:BS-001');
  assert.equal(bs001.recorded_deadline, '2026-08-29');
  assert.equal(bs001.suggested_date, '2026-08-30', 'already overdue -> reporting date');
  assert.equal(bs001.suggested_owner, 'Mei');
  assert.equal(bs001.evidence.balance, 450000);
  const notDue = tasks.find(t => t.task_key === 'payment_follow_up:BS-002');
  assert.equal(notDue.recorded_deadline, '2026-09-18');
  assert.equal(notDue.suggested_date, '2026-09-19', 'due date + 1 day');
  assert.ok(tasks.some(t => t.task_key === 'review_replenishment:T001'));
  assert.ok(tasks.some(t => t.task_key === 'review_account:BC-006'));
  assert.ok(tasks.some(t => t.task_key === 'follow_up_due:BC-036'));
  assert.equal(tasks.filter(t => t.rule === 'completion_overdue').length, 0, 'no overdue completions on Day 1');
});
