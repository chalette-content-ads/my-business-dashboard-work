// Task list for one scenario. Suggestions are rebuilt from the records every time
// (no background importer). On Day 2 the Day 1 suggestions are reconciled first, so
// a suggestion keeps its stable key (`rule:record_id`), a new one is marked as new,
// and one that the new data no longer supports is shown as "resolved by data".
// Decisions are stored separately (by task key) and joined on top.

import { computeMetrics } from './metrics.js';
import { generateSuggestions, reconcileSuggestions, mergeTasks } from './tasks.js';

export function baseMetrics(scenario) {
  // No period or channel filter: suggestions depend on as-of measures only.
  return computeMetrics(scenario.records, scenario.reportingDate, { historyStart: scenario.historyStart });
}

export function suggestionsFor(scenario) {
  const symbol = scenario.profile.business.currency_symbol || scenario.profile.business.currency;
  return generateSuggestions(scenario.records, baseMetrics(scenario), scenario.reportingDate, scenario.profile.policies, symbol);
}

export function suggestionRows(scenario, previous = null) {
  const earlier = previous ? reconcileSuggestions([], suggestionsFor(previous), previous.day) : [];
  return reconcileSuggestions(earlier, suggestionsFor(scenario), scenario.day);
}

// decisions: array of { task_key, status, action_date, owner, note, title, detail, snapshot_at_decision, updated_at }
export function scenarioTasks(scenario, previous, decisions, rows = suggestionRows(scenario, previous)) {
  const keys = new Set(rows.map(r => r.task_key));
  // A decision about a suggestion that only exists on another day stays stored but is not shown here.
  const visible = (decisions || []).filter(d => d.task_key.startsWith('custom:') || keys.has(d.task_key));
  return mergeTasks(rows, visible).map(t => ({ ...t, is_new: !!previous && t.first_snapshot === scenario.day && !t.resolved }));
}

export const isOpen = t => !t.resolved && ['suggested', 'accepted'].includes(t.status);
