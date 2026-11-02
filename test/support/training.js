// Test material: the synthetic BetterSpace training data in data/ — two businesses × two
// days, with answer keys in test/expected/. The dashboard contains none of it (it only
// shows the viewer's own Excel); the tests use it to check every figure and rule, read
// both straight from the CSV files and the way the dashboard reads an Excel workbook.

import { collectDatasets } from '../../scripts/pack-data.js';
import { parseCsv } from '../../src/core/csv.js';
import { applyTableMapping, relationalChecks, hasErrors } from '../../src/core/mapping.js';
import { baseMetrics, scenarioTasks } from '../../src/core/scenario-tasks.js';
import { buildCalendarItems } from '../../src/core/calendar.js';
import { formatMoney } from '../../src/core/metrics.js';
import { buildBriefInput } from '../../src/briefs/brief-input.js';
import { workbookScenario } from '../../src/data/workbook.js';

export const DATASETS = collectDatasets();
export const DAYS = ['day1', 'day2'];
export const businessIds = () => Object.keys(DATASETS);
export const previousDay = day => DAYS[DAYS.indexOf(day) - 1] || null;

const cache = new Map();

// A training day read from its CSV files, with the reporting date from its metadata.json.
export function loadScenario(id, day) {
  const key = `${id}/${day}`;
  if (cache.has(key)) return cache.get(key);
  const { profile, days } = DATASETS[id];
  const { metadata, files } = days[day];
  const records = {};
  const issues = [];
  for (const table of profile.tables) {
    const result = applyTableMapping(table, parseCsv(files[table.file]), profile);
    records[table.entity] = result.records;
    issues.push(...result.issues);
  }
  issues.push(...relationalChecks(records));
  const scenario = Object.freeze({
    key, businessId: id, day, profile, metadata,
    reportingDate: metadata.as_of_date,
    historyStart: metadata.history_start || profile.period?.history_start,
    records, issues, ok: !hasErrors(issues),
  });
  cache.set(key, scenario);
  return scenario;
}

// A training day as the viewer's own workbook: each CSV file becomes a sheet (first row =
// column names), read by the same code as an opened .xlsx file. Day 2 is then "the owner
// updated their Excel".
export function trainingWorkbook(id, day, fileName = `${id}-${day}.xlsx`) {
  const { profile, days } = DATASETS[id];
  const sheets = {};
  for (const table of profile.tables) sheets[table.sheet_name] = parseCsv(days[day].files[table.file]);
  return workbookScenario({ fileName, loadedAt: '2026-09-25T00:00:00.000Z', sheets, missing: [] });
}

// The facts an analysis of this training day may use, with no task decisions or notes.
export function baselineBriefInput(id, day, language = 'en') {
  const scenario = loadScenario(id, day);
  const prevDay = previousDay(day);
  const previous = prevDay ? loadScenario(id, prevDay) : null;
  const metrics = baseMetrics(scenario);
  const previousMetrics = previous ? baseMetrics(previous) : null;
  const tasks = scenarioTasks(scenario, previous, []);
  const symbol = scenario.profile.business.currency_symbol;
  const calendar = buildCalendarItems({ records: scenario.records, metrics, tasks, entries: [], reportingDate: scenario.reportingDate, money: v => formatMoney(v, symbol) });
  const text = buildBriefInput({ scenario, metrics, tasks, calendar, language, previous, previousMetrics });
  return { scenario, previous, metrics, previousMetrics, tasks, calendar, text };
}
