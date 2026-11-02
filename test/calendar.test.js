// The calendar's colour types and the summary cards above it. The expected August figures for
// the B2B practice data (Day 1, reporting date 30 Aug 2026) were read off the 0.5 calendar
// page item by item: 14 dates, 10 of them recorded deadlines before the reporting date.
import test from 'node:test';
import assert from 'node:assert/strict';
import { baselineBriefInput } from './support/training.js';
import { calendarMonthSummary } from '../src/core/calendar.js';
import { setLocale } from '../src/i18n/i18n.js';

setLocale('en');
const { calendar, scenario } = baselineBriefInput('betterspace-b2b', 'day1', 'en');

test('every calendar item has a type that matches where it came from', () => {
  const prefix = { payment: 'payment:', followup: 'followup:', completion: 'completion:' };
  for (const it of calendar) {
    assert.ok(prefix[it.type], `unexpected type ${it.type}`);
    assert.ok(it.id.startsWith(prefix[it.type]), it.id);
    assert.equal(it.kind, 'deadline');
    assert.ok(it.short && it.short.length < it.title.length, it.title);
  }
  const pay = calendar.find(i => i.id === 'payment:BS-031');
  assert.equal(pay.amount, 336000);
  assert.equal(pay.short, 'BS-031 · RM\u00a03,360', 'the amount stays on one line');
});

test('August summary for the B2B practice data', () => {
  assert.equal(scenario.reportingDate, '2026-08-30');
  const s = calendarMonthSummary(calendar, '2026-08', scenario.reportingDate);
  assert.equal(s.total, 14);
  assert.equal(s.overdue, 10);
  assert.deepEqual(s.overdueByType, { payment: 5, followup: 5, completion: 0 });
  assert.equal(s.onReportingDate, 3);
  assert.deepEqual(s.payments, { count: 5, amount: 1428000, overdue: 5 });
});

test('only recorded deadlines count as past deadlines; tasks and notes never do', () => {
  const items = [
    { id: 'payment:A', date: '2026-03-02', kind: 'deadline', type: 'payment', amount: 500, overdue: true },
    { id: 't1', date: '2026-03-03', kind: 'task', type: 'task', overdue: true },
    { id: 'n1', date: '2026-03-04', kind: 'entry', type: 'entry', overdue: true },
    { id: 'payment:B', date: '2026-03-20', kind: 'deadline', type: 'payment', amount: 700, overdue: false },
    { id: 'payment:C', date: '2026-04-01', kind: 'deadline', type: 'payment', amount: 900, overdue: false },
  ];
  const s = calendarMonthSummary(items, '2026-03', '2026-03-10');
  assert.equal(s.total, 4);
  assert.equal(s.overdue, 1);
  assert.equal(s.onReportingDate, 0);
  assert.deepEqual(s.payments, { count: 2, amount: 1200, overdue: 1 });
});
