// Browser-local state and the task/calendar behaviour built on it. These tests drive the
// same functions the pages call (src/ui/view-state.js) with an in-memory storage object and
// the training data opened as the viewer's own workbook, so they cover saving, reloading,
// reading an updated workbook, calendar notes and clearing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { openStorage, memoryStorage, createStateStore, PREFIX } from '../src/storage/local-state.js';
import { view, scenario, allTasks, calendarItems, saveDecision, defaultFilters } from '../src/ui/view-state.js';
import { setWorkbookScenario } from '../src/data/scenarios.js';
import { MY_EXCEL } from '../src/data/workbook.js';
import { trainingWorkbook } from './support/training.js';
import { setLocale } from '../src/i18n/i18n.js';

setLocale('en');
const B2B = 'betterspace-b2b';
// The same file before and after the owner updated it (the Day 1 and Day 2 records).
const FIRST = trainingWorkbook(B2B, 'day1', 'Sales.xlsx');
const UPDATED = trainingWorkbook(B2B, 'day2', 'Sales.xlsx');

// Simulates opening the page with a workbook already open: a fresh store over the
// (possibly already used) storage.
function openPage(storage, workbook = FIRST) {
  view.store = createStateStore(storage);
  view.persistent = true;
  view.businessId = MY_EXCEL;
  view.day = 'day1';
  view.filters = defaultFilters();
  setWorkbookScenario(workbook);
  return view.store;
}
const task = key => allTasks().find(t => t.task_key === key);

test('the dashboard starts empty: no workbook, nothing stored', () => {
  const storage = memoryStorage();
  openPage(storage, null);
  assert.equal(scenario(), null, 'the pages show how to open a file');
  assert.equal(storage.length, 0);
});

test('a first open starts at the baseline: every suggestion open, no notes', () => {
  openPage(memoryStorage());
  assert.equal(FIRST.ok, true);
  const tasks = allTasks();
  assert.equal(tasks.length, 45);
  assert.ok(tasks.every(t => t.status === 'suggested' && !t.resolved && !t.is_new));
  assert.equal(calendarItems().filter(i => i.kind !== 'deadline').length, 0);
});

test('accepting a task and changing its date persists after a reload and shows on the calendar', () => {
  const storage = memoryStorage();
  openPage(storage);
  assert.equal(saveDecision(task('payment_follow_up:BS-001'), { status: 'accepted' }), true);
  assert.equal(task('payment_follow_up:BS-001').action_date, '2026-08-30', 'accepting takes the suggested date');
  assert.equal(task('payment_follow_up:BS-001').owner, 'Mei', 'and the suggested owner');
  saveDecision(task('payment_follow_up:BS-001'), { action_date: '2026-09-02', note: 'Call on Wednesday' });

  openPage(storage); // reload
  const t = task('payment_follow_up:BS-001');
  assert.equal(t.status, 'accepted');
  assert.equal(t.action_date, '2026-09-02');
  assert.equal(t.note, 'Call on Wednesday');
  assert.deepEqual(calendarItems().filter(i => i.kind === 'task').map(i => [i.id, i.date]), [['payment_follow_up:BS-001', '2026-09-02']]);
  const keys = [...Array(storage.length).keys()].map(i => storage.key(i));
  assert.deepEqual(keys, [`${PREFIX}.business.${MY_EXCEL}`]);

  saveDecision(t, { status: 'completed' });
  assert.equal(calendarItems().filter(i => i.kind === 'task').length, 0, 'completed tasks leave the calendar');
});

test('reading an updated workbook keeps decisions by stable task key and updates suggestions', () => {
  const storage = memoryStorage();
  openPage(storage, FIRST);
  saveDecision(task('payment_follow_up:BS-001'), { status: 'accepted', action_date: '2026-08-30' });
  saveDecision(task('payment_follow_up:BS-012'), { status: 'accepted', action_date: '2026-09-01', note: 'Chase Mei' });
  saveDecision(task('follow_up_due:BC-036'), { status: 'dismissed' });
  saveDecision({ task_key: 'custom:x1', custom: true, status: 'accepted', title: 'Order brochures', reason: '' }, { action_date: '2026-09-03' });

  openPage(storage, UPDATED); // "Read the Excel again" after the owner updated it
  assert.equal(UPDATED.ok, true);
  // BS-001 was paid in the updated records: no suggestion any more, so it leaves the list and the calendar.
  assert.equal(task('payment_follow_up:BS-001'), undefined);
  assert.equal(calendarItems().some(i => i.id === 'payment_follow_up:BS-001'), false);
  // BS-012 is still unpaid: same key, same decision.
  const bs012 = task('payment_follow_up:BS-012');
  assert.equal(bs012.status, 'accepted');
  assert.equal(bs012.action_date, '2026-09-01');
  assert.equal(bs012.note, 'Chase Mei');
  assert.ok(calendarItems().some(i => i.id === 'payment_follow_up:BS-012' && i.date === '2026-09-01'));
  // BC-036 got a new follow-up date in the updated records; the dismissal still applies to the same key.
  assert.equal(task('follow_up_due:BC-036').status, 'dismissed');
  assert.equal(task('follow_up_due:BC-036').recorded_deadline, '2026-09-04');
  // New records bring new suggestions; your own tasks stay.
  assert.ok(task('unassigned_prospect:BC-046'));
  assert.equal(task('custom:x1').title, 'Order brochures');
  // Going back to the older file shows the earlier decisions again: they were only hidden.
  openPage(storage, FIRST);
  assert.equal(task('payment_follow_up:BS-001').status, 'accepted');
});

test('calendar notes can be added, edited and deleted', () => {
  const storage = memoryStorage();
  const store = openPage(storage);
  store.saveNote(MY_EXCEL, { entry_id: 'n1', date: '2026-08-31', title: 'Stock count', detail: 'Warehouse' });
  openPage(storage);
  assert.deepEqual(calendarItems().filter(i => i.kind === 'entry').map(i => [i.id, i.date, i.title]), [['n1', '2026-08-31', 'Stock count']]);
  view.store.saveNote(MY_EXCEL, { entry_id: 'n1', date: '2026-09-01', title: 'Stock count (moved)' });
  assert.equal(calendarItems().find(i => i.id === 'n1').date, '2026-09-01');
  view.store.deleteNote(MY_EXCEL, 'n1');
  assert.equal(calendarItems().filter(i => i.kind === 'entry').length, 0);
  assert.equal(view.store.saveNote(MY_EXCEL, { entry_id: 'bad', date: 'not a date', title: 'x' }), false, 'invalid dates are refused');
});

test('clearing decisions and notes keeps the file, the language and the Gemini key', () => {
  const storage = memoryStorage();
  const store = openPage(storage);
  store.setPrefs({ locale: 'en' });
  store.setGeminiKey('test-key-not-real-0000000000');
  assert.equal(store.saveWorkbook({ fileName: 'Sales.xlsx', loadedAt: '2026-09-25T00:00:00.000Z', sheets: { Customers: [['customer_id']] } }), 'saved');
  saveDecision(task('payment_follow_up:BS-022'), { status: 'completed' });
  store.saveNote(MY_EXCEL, { entry_id: 'n1', date: '2026-08-30', title: 'x' });

  assert.equal(view.store.resetBusiness(MY_EXCEL), true);
  openPage(storage);
  assert.ok(allTasks().every(t => t.status === 'suggested'));
  assert.equal(view.store.notes(MY_EXCEL).length, 0);
  assert.equal(view.store.prefs().locale, 'en', 'language is kept');
  assert.equal(view.store.geminiKey(), 'test-key-not-real-0000000000', 'the key is kept');
  assert.equal(view.store.workbook().fileName, 'Sales.xlsx', 'the file is kept');
});

test('clearing leaves other pages\' keys in the same browser alone', () => {
  const storage = memoryStorage();
  storage.setItem('someone-else', 'keep me');
  const store = createStateStore(storage);
  store.saveNote(MY_EXCEL, { entry_id: 'n1', date: '2026-08-30', title: 'x' });
  store.resetAll();
  assert.equal(storage.getItem('someone-else'), 'keep me');
  assert.equal(store.notes(MY_EXCEL).length, 0);
});

test('stored data is treated as untrusted: malformed entries are dropped', () => {
  const storage = memoryStorage();
  storage.setItem(`${PREFIX}.business.${MY_EXCEL}`, JSON.stringify({ version: 1, day: 'day9', decisions: { 'payment_follow_up:BS-001': { status: 'hacked', owner: 42, action_date: '<img>' }, '': { status: 'accepted' } }, notes: { n: { date: 'x', title: 'bad' } } }));
  const store = createStateStore(storage);
  const s = store.business(MY_EXCEL);
  assert.equal(s.day, 'day1');
  assert.deepEqual(Object.keys(s.decisions), ['payment_follow_up:BS-001']);
  assert.equal(s.decisions['payment_follow_up:BS-001'].status, 'suggested');
  assert.equal(s.decisions['payment_follow_up:BS-001'].owner, '');
  assert.equal(s.decisions['payment_follow_up:BS-001'].action_date, '');
  assert.deepEqual(s.notes, {});
  storage.setItem(`${PREFIX}.business.${MY_EXCEL}`, '{not json');
  assert.deepEqual(store.business(MY_EXCEL).decisions, {});
});

test('when the browser blocks storage the app keeps working in memory and says so', () => {
  const blocked = openStorage(() => { throw Object.assign(new Error('denied'), { name: 'SecurityError' }); });
  assert.equal(blocked.persistent, false);
  assert.equal(blocked.reason, 'SecurityError');
  const store = createStateStore(blocked.storage);
  assert.equal(store.saveNote(MY_EXCEL, { entry_id: 'n1', date: '2026-08-30', title: 'x' }), true);
  assert.equal(store.notes(MY_EXCEL).length, 1, 'works for this visit');
  assert.equal(openStorage(() => undefined).persistent, false);
  const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => {}, key: () => null, length: 0 };
  assert.equal(createStateStore(full).saveNote(MY_EXCEL, { entry_id: 'n1', date: '2026-08-30', title: 'x' }), false, 'a failed write is reported, not hidden');
  assert.equal(openStorage(() => memoryStorage()).persistent, true);
});
