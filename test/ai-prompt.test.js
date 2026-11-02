// "Copy for AI": the request the viewer pastes into an AI service they choose. It must
// carry exactly the calculated facts, add no numbers of its own, follow the viewer's
// language, and hide customer and staff names when asked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAiPrompt, hideNames, FACTS_MARKER } from '../src/briefs/ai-prompt.js';
import { baselineBriefInput } from './support/training.js';
import { scenarioTasks } from '../src/core/scenario-tasks.js';
import { readWorkbook, workbookScenario } from '../src/data/workbook.js';
import { setLocale } from '../src/i18n/i18n.js';

setLocale('en');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const B2B = 'betterspace-b2b';
const request = (base, locale, hide = false) => buildAiPrompt({ scenario: base.scenario, previous: base.previous, tasks: base.tasks, calendar: base.calendar, locale, hideNames: hide });
const split = (text, locale) => { const i = text.indexOf(FACTS_MARKER[locale]); assert.ok(i > 0, 'has the data marker'); return [text.slice(0, i), text.slice(i + FACTS_MARKER[locale].length + 1)]; };

test('the request is fixed instructions plus exactly the calculated facts', () => {
  for (const [day, locale] of [['day1', 'zh-CN'], ['day2', 'en']]) {
    const base = baselineBriefInput(B2B, day, locale);
    const [instructions, facts] = split(request(base, locale), locale);
    assert.equal(facts, `${base.text}\n`, `${day} ${locale}: the facts are copied unchanged`);
    assert.doesNotMatch(instructions, /\d/, 'the instructions contain no numbers of their own');
    assert.match(instructions, locale === 'en' ? /Answer in English/ : /请用中文回答/);
    assert.match(instructions, locale === 'en' ? /Use only numbers, dates and keys that appear in the Data/ : /只用「数据」里出现的数字、日期和编号/);
  }
});

test('the request reflects the viewer\'s own decisions', () => {
  const base = baselineBriefInput(B2B, 'day1', 'en');
  const first = base.tasks.find(t => t.status === 'suggested');
  const tasks = scenarioTasks(base.scenario, null, [{ task_key: first.task_key, status: 'accepted', action_date: first.action_date }]);
  const text = buildAiPrompt({ scenario: base.scenario, tasks, calendar: base.calendar, locale: 'en' });
  assert.match(text, new RegExp(`- ${first.task_key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\| accepted \\|`));
});

test('names can be replaced by codes, and nothing else changes', () => {
  const base = baselineBriefInput(B2B, 'day1', 'en');
  const plain = request(base, 'en');
  const hidden = request(base, 'en', true);
  const customers = base.scenario.records.customers.filter(c => c.name && c.name !== c.id);
  const shown = customers.filter(c => plain.includes(c.name));
  assert.ok(shown.length > 0, 'customer names appear when not hidden');
  for (const c of customers) assert.ok(!hidden.includes(c.name), `${c.name} is hidden`);
  for (const c of shown) assert.ok(hidden.includes(c.id), `${c.id} is used instead`);
  for (const person of base.scenario.profile.business.team) assert.doesNotMatch(hidden, new RegExp(`\\b${person}\\b`), `${person} is hidden`);
  assert.match(hidden, /Team: Owner \d, Owner \d, Owner \d\./);
  assert.match(hidden, /names have been replaced by codes/);
  const figures = s => (s.match(/RM [\d,.]+/g) || []).join(' ');
  assert.equal(figures(hidden), figures(plain), 'every amount is unchanged');
  assert.equal(hideNames('Mei Ling Trading paid Mei', [{ records: { customers: [{ id: 'C-9', name: 'Mei Ling Trading' }] }, profile: { business: { team: ['Mei'] } } }]), 'C-9 paid Owner 1', 'longest names first, whole words only');
});

test('your own Excel works the same way', async () => {
  const b = readFileSync(path.join(root, 'data/templates/BetterSpace_B2B.xlsx'));
  const { sheets, missing } = await readWorkbook(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const scenario = workbookScenario({ fileName: 'BetterSpace_B2B.xlsx', loadedAt: '2026-09-25T00:00:00.000Z', sheets, missing });
  const tasks = scenarioTasks(scenario, null, []);
  const text = buildAiPrompt({ scenario, tasks, calendar: [], locale: 'zh-CN', hideNames: true });
  assert.match(text, /Source: the owner's own Excel workbook BetterSpace_B2B\.xlsx/);
  assert.match(text, /Order value in period: RM 231,060/);
  for (const c of scenario.records.customers) if (c.name && c.name !== c.id) assert.ok(!text.includes(c.name), `${c.name} is hidden`);
});
