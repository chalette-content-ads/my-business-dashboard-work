// The number checker that every Gemini answer passes before it is shown, and the honesty
// of the AI analysis page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allowedFacts, unsupportedTokens } from '../src/briefs/brief-facts.js';
import { baselineBriefInput } from './support/training.js';
import { setLocale } from '../src/i18n/i18n.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the checker really catches unsupported claims', () => {
  setLocale('en');
  const facts = allowedFacts(baselineBriefInput('betterspace-b2b', 'day1'));
  assert.deepEqual(unsupportedTokens('RM 30,515 is overdue across 15 orders since 11 Aug (6.0%).', facts), []);
  assert.deepEqual(unsupportedTokens('RM 30,516 is overdue', facts), ['amount RM 30,516']);
  assert.deepEqual(unsupportedTokens('7.5% growth', facts), ['percentage 7.5%']);
  assert.deepEqual(unsupportedTokens('due on 12 Aug', facts), ['date 12 Aug (2026-08-12)']);
  assert.deepEqual(unsupportedTokens('8月12日到期', facts), ['date 8月12日 (2026-08-12)']);
  assert.deepEqual(unsupportedTokens('BS-999 is late', facts), ['unknown record BS-999']);
  assert.deepEqual(unsupportedTokens('4321 customers', facts), ['number 4321']);
  assert.deepEqual(unsupportedTokens('Demo Cedar Company 008 on Day 2', facts), [], 'names and day labels are not claims');
});

test('the AI analysis page is honest about what it shows', () => {
  const page = readFileSync(path.join(root, 'src/ui/pages/brief.js'), 'utf8');
  assert.doesNotMatch(page, /setTimeout|setInterval|requestAnimationFrame/, 'no fake loading or typing effect');
  // The only AI call is "Analyse with Gemini" (with the viewer's own key); its answer is
  // labelled as live AI and its numbers are checked. Nothing is sent before the button.
  // "Remove AI suggestions" takes the AI's picks out of Tasks and the Calendar.
  assert.deepEqual(page.match(/h\('button'[^\n]*/g).map(l => l.match(/tl\('([^']+)'\)/)?.[1]), ['Save key', 'Analyse with Gemini', 'Delete key', 'Remove AI suggestions']);
  assert.doesNotMatch(page, /Request analysis|tl\('(Generate|Regenerate)/i);
  assert.match(page, /tr\('Live AI'\)/);
  assert.match(page, /answerProblems\(/, 'the answer is number-checked');
  assert.match(page, /Nothing is sent anywhere unless you press "Analyse with Gemini"/);
  assert.doesNotMatch(page, /\bfetch\s*\(/, 'the page itself makes no requests (gemini.js does)');
});
