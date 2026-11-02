// Chinese is the default interface language and English stays selectable. These tests
// keep every interface string translated (a missing key would silently show English)
// and check that generated task text follows the chosen language.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ZH from '../src/i18n/zh.js';
import { tr, tl, setLocale, normaliseLocale, sentences } from '../src/i18n/i18n.js';
import { TASK_RULES } from '../src/core/model.js';
import { loadScenario } from './support/training.js';
import { suggestionsFor } from '../src/core/scenario-tasks.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const placeholders = s => [...s.matchAll(/\{(\d+)\}/g)].map(m => m[1]).sort().join(',');

export function sourceFiles(dir = path.join(root, 'src')) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) { if (name !== 'i18n') out.push(...sourceFiles(full)); }
    else if (name.endsWith('.js') && !name.endsWith('.generated.js')) out.push(full);
  }
  return out;
}

export function interfaceKeys() {
  const keys = [];
  for (const file of sourceFiles()) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\bt[rl]\(\s*'((?:[^'\\]|\\.)*)'/g)) keys.push({ file: path.relative(root, file), key: m[1].replace(/\\(.)/g, (_, c) => (c === 'n' ? '\n' : c)).trim() });
  }
  return keys;
}

test('every tr()/tl() text has a Chinese translation with the same placeholders', () => {
  const keys = interfaceKeys();
  assert.ok(keys.length > 300, `expected the interface text to be wrapped (found ${keys.length})`);
  const missing = keys.filter(k => !(k.key in ZH)).map(k => `${k.file}: ${k.key}`);
  const mismatched = keys.filter(k => k.key in ZH && placeholders(k.key) !== placeholders(ZH[k.key])).map(k => `${k.file}: ${k.key}`);
  assert.deepEqual(missing, [], 'untranslated interface text');
  assert.deepEqual(mismatched, [], 'placeholders differ between English and Chinese');
});

test('task-rule names, statuses and record types shown on screen are translated', () => {
  const needed = [...Object.values(TASK_RULES).map(r => r.title), 'suggested', 'accepted', 'completed', 'dismissed', 'pending', 'done', 'excluded', 'customer', 'prospect', 'overdue', 'due today', 'not due'];
  assert.deepEqual(needed.filter(k => !(k in ZH)), []);
});

test('language setting: Chinese by default, English on request', () => {
  assert.equal(normaliseLocale(''), 'zh-CN');
  assert.equal(normaliseLocale('zh-CN'), 'zh-CN');
  assert.equal(normaliseLocale('en'), 'en');
  setLocale('zh-CN');
  assert.equal(tl('+ Add task'), '+ 新增待办（Add task）');
  assert.equal(tl('Advance to Day {0}', 2), '前进到第 2 天（Advance to Day 2）');
  assert.equal(tr('No such interface text'), 'No such interface text', 'unknown text falls back to English');
  assert.equal(sentences('第一句。', '', '第二句。'), '第一句。第二句。');
  setLocale('en');
  assert.equal(tl('Advance to Day {0}', 2), 'Advance to Day 2');
  assert.equal(sentences('One.', '', 'Two.'), 'One. Two.');
});

test('task suggestions follow the language; keys and dates do not change', () => {
  const s = loadScenario('betterspace-b2b', 'day1');
  setLocale('zh-CN');
  const zh = suggestionsFor(s);
  setLocale('en');
  const en = suggestionsFor(s);
  assert.deepEqual(zh.map(x => x.task_key), en.map(x => x.task_key));
  assert.deepEqual(zh.map(x => x.suggested_date), en.map(x => x.suggested_date));
  assert.match(zh.find(x => x.task_key === 'payment_follow_up:BS-012').title, /^跟进 BS-012 的收款/);
  assert.ok(zh.every(x => /[一-鿿]/.test(x.title) && /[一-鿿]/.test(x.reason)), 'every generated task is in Chinese');
  assert.match(en.find(x => x.task_key === 'payment_follow_up:BS-012').title, /^Follow up payment for BS-012/);
});

test('the "Match your columns" labels looked up by name are all translated', async () => {
  const text = await import('../src/ui/pages/match-text.js');
  const strings = Object.values(text).flatMap(d => Object.values(d)).flat().filter(Boolean);
  assert.ok(strings.length > 40);
  assert.deepEqual(strings.filter(s => !Object.hasOwn(ZH, s)), [], 'missing Chinese');
});
