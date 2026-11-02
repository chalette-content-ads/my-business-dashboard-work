// The AI analysis in Tasks and the Calendar. Gemini answers in a fixed shape; only open task
// keys and calendar ids that are in the data are kept; the picks are saved in this browser,
// shown only while the same records are open, and never accept anything for the viewer.
// No request is made here: the answers are written by hand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readAiPlan, planText, dataBasis, answerProblems, buildAiPrompt, AI_PLAN_SCHEMA } from '../src/briefs/ai-prompt.js';
import { memoryStorage, createStateStore, PREFIX } from '../src/storage/local-state.js';
import { view, allTasks, calendarItems, aiPlan, aiMarks, savedAiPlan, saveDecision, defaultFilters } from '../src/ui/view-state.js';
import { calendarMonthSummary } from '../src/core/calendar.js';
import { setWorkbookScenario } from '../src/data/scenarios.js';
import { MY_EXCEL } from '../src/data/workbook.js';
import { trainingWorkbook } from './support/training.js';
import { setLocale } from '../src/i18n/i18n.js';

setLocale('en');
const B2B = 'betterspace-b2b';
const FIRST = trainingWorkbook(B2B, 'day1', 'Sales.xlsx');
const UPDATED = trainingWorkbook(B2B, 'day2', 'Sales.xlsx');

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
const inputs = () => ({ scenario: FIRST, previous: null, tasks: allTasks(), calendar: calendarItems() });
const soonId = () => calendarItems().find(i => i.date >= FIRST.reportingDate).id;
const answer = ({ top, watch = [] }) => JSON.stringify({
  situation: 'Order value in period is RM 231,060.',
  top_three: top.map(k => ({ task_key: k, why: 'Biggest overdue balance.', how: 'Call today.' })),
  watch: watch.map(id => ({ item_id: id, why: 'Due soon.' })),
  unanswered: ['Profit per order'],
});
const save = (store, plan) => store.saveAiPlan(MY_EXCEL, { ...plan, at: '2026-09-25T08:00:00.000Z', model: 'gemini-test', where: 'Sales.xlsx', basis: dataBasis(FIRST), problems: [] });

test('the request asks for the fixed shape and names calendar items by id', () => {
  openPage(memoryStorage());
  const text = buildAiPrompt({ scenario: FIRST, tasks: allTasks(), calendar: calendarItems(), locale: 'zh-CN' });
  for (const field of ['situation', 'top_three', 'task_key', 'watch', 'item_id', 'unanswered']) assert.match(text, new RegExp(`${field}[：:]?`));
  assert.match(text, new RegExp(`\\n- ${soonId()} \\| ${FIRST.reportingDate.slice(0, 4)}`), 'each calendar line starts with its id');
  assert.deepEqual(AI_PLAN_SCHEMA.required, ['situation', 'top_three', 'watch', 'unanswered']);
});

test('only open task keys and calendar ids that are in the data are kept', () => {
  openPage(memoryStorage());
  saveDecision(task('follow_up_due:BC-036'), { status: 'dismissed' }); // no longer open
  const soon = soonId();
  const fourth = allTasks().find(t => t.status === 'suggested' && !/BS-0(01|12|22)$/.test(t.task_key)).task_key;
  const plan = readAiPlan(answer({
    top: ['payment_follow_up:BS-012', 'payment_follow_up:BS-999', 'follow_up_due:BC-036', 'payment_follow_up:BS-012', 'payment_follow_up:BS-001', 'payment_follow_up:BS-022', fourth],
    watch: [soon, 'payment:BS-999'],
  }), inputs());
  assert.deepEqual(plan.top.map(x => x.task_key), ['payment_follow_up:BS-012', 'payment_follow_up:BS-001', 'payment_follow_up:BS-022'], 'three at most, in order, no repeats');
  assert.deepEqual(plan.watch.map(x => x.item_id), [soon]);
  assert.equal(plan.dropped, 3, 'an unknown key, a dismissed task and an unknown calendar id');
  assert.deepEqual(plan.unanswered, ['Profit per order']);
  assert.deepEqual(answerProblems(planText(plan), inputs()), [], 'the plan passes the number check');
  assert.deepEqual(answerProblems(`${planText(plan)} Expect RM 12,345 next month.`, inputs()), ['amount RM 12,345']);
  assert.ok(readAiPlan('```json\n' + answer({ top: ['payment_follow_up:BS-012'] }) + '\n```', inputs()), 'a fenced answer is read');
  assert.equal(readAiPlan('一、现在的情况：……', inputs()), null, 'plain text is not a plan');
  assert.equal(readAiPlan('{"top_three": []}', inputs()), null, 'a plan needs the situation');
});

test('the picks show in Tasks and the Calendar, and nothing is accepted for the viewer', () => {
  const storage = memoryStorage();
  const store = openPage(storage);
  const soon = soonId();
  assert.equal(save(store, readAiPlan(answer({ top: ['payment_follow_up:BS-012', 'payment_follow_up:BS-001'], watch: [soon] }), inputs())), true);

  openPage(storage); // reload
  assert.deepEqual(aiPlan().top.map(x => x.task_key), ['payment_follow_up:BS-012', 'payment_follow_up:BS-001']);
  assert.equal(aiMarks().top.get('payment_follow_up:BS-012').rank, 1);
  assert.ok(allTasks().every(t => t.status === 'suggested'), 'no task was accepted');
  assert.equal(calendarItems().filter(i => i.kind === 'task').length, 0, 'the items sent to Gemini have no AI picks');

  const withAi = calendarItems({ withAi: true });
  const pick = withAi.find(i => i.id === 'payment_follow_up:BS-012');
  assert.equal(pick.suggested, true, 'a pick that is only a suggestion is shown dashed');
  assert.equal(pick.ai_rank, 1);
  assert.equal(pick.date, task('payment_follow_up:BS-012').suggested_date);
  assert.equal(withAi.find(i => i.id === soon).ai_why, 'Due soon.');
  const month = FIRST.reportingDate.slice(0, 7);
  assert.deepEqual(calendarMonthSummary(withAi, month, FIRST.reportingDate), calendarMonthSummary(calendarItems(), month, FIRST.reportingDate), 'suggestions are not counted as appointments');

  saveDecision(task('payment_follow_up:BS-012'), { status: 'accepted', action_date: '2026-09-02' });
  const accepted = calendarItems({ withAi: true }).find(i => i.id === 'payment_follow_up:BS-012');
  assert.equal(accepted.suggested, undefined, 'accepted: an ordinary calendar task');
  assert.equal(accepted.date, '2026-09-02');
  assert.equal(accepted.ai_rank, 1, 'that keeps its AI mark');
  saveDecision(task('payment_follow_up:BS-012'), { status: 'completed' });
  assert.equal(calendarItems({ withAi: true }).some(i => i.id === 'payment_follow_up:BS-012'), false, 'completed tasks leave the calendar');
});

test('an updated workbook hides the old picks; the same file read again keeps them', () => {
  const storage = memoryStorage();
  save(openPage(storage), readAiPlan(answer({ top: ['payment_follow_up:BS-012'] }), inputs()));
  openPage(storage, UPDATED);
  assert.ok(savedAiPlan(), 'the analysis is still saved');
  assert.equal(aiPlan(), null, 'but it was made from other records');
  assert.equal(aiMarks(), null);
  assert.equal(calendarItems({ withAi: true }).some(i => i.ai_why !== undefined || i.suggested), false);
  openPage(storage, trainingWorkbook(B2B, 'day1', 'Sales.xlsx'));
  assert.ok(aiPlan(), 'reading the same records again shows the picks');
  assert.notEqual(dataBasis(FIRST), dataBasis(UPDATED));
});

test('Reset, Forget this file and Remove AI suggestions clear the analysis; the key is kept', () => {
  const storage = memoryStorage();
  const store = openPage(storage);
  store.setGeminiKey('test-key-not-real-0000000000');
  const plan = readAiPlan(answer({ top: ['payment_follow_up:BS-012'] }), inputs());
  for (const clear of [() => store.resetBusiness(MY_EXCEL), () => store.forgetWorkbook(MY_EXCEL), () => store.forgetAiPlan(MY_EXCEL), () => store.resetAll()]) {
    assert.equal(save(store, plan), true);
    assert.ok(store.aiPlan(MY_EXCEL));
    assert.equal(clear(), true);
    assert.equal(store.aiPlan(MY_EXCEL), null);
  }
  assert.equal(store.geminiKey(), 'test-key-not-real-0000000000');
});

test('a stored analysis is treated as untrusted', () => {
  const storage = memoryStorage();
  const store = createStateStore(storage);
  const key = `${PREFIX}.ai.${MY_EXCEL}`;
  storage.setItem(key, JSON.stringify({ version: 1, basis: 'b', situation: 7, top: [{ task_key: 5 }, { task_key: 'a', why: {} }, { task_key: 'b' }, { task_key: 'c' }, { task_key: 'd' }], watch: 'no', unanswered: [1, 'q'], dropped: -4 }));
  const p = store.aiPlan(MY_EXCEL);
  assert.deepEqual(p.top, [{ task_key: 'a', why: '', how: '' }, { task_key: 'b', why: '', how: '' }, { task_key: 'c', why: '', how: '' }]);
  assert.deepEqual([p.situation, p.watch, p.unanswered, p.dropped], ['', [], ['q'], 0]);
  storage.setItem(key, JSON.stringify({ version: 2, basis: 'b' }));
  assert.equal(store.aiPlan(MY_EXCEL), null);
  storage.setItem(key, '{not json');
  assert.equal(store.aiPlan(MY_EXCEL), null);
});
