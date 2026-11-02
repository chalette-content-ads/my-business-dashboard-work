// The one business the dashboard shows: the viewer's own Excel workbook ("My Excel",
// workbook.js). There is no built-in data: until a workbook is opened, every data page
// shows the page for opening one. (The BetterSpace files in data/ are test material and
// downloadable practice workbooks, not part of the dashboard.)
//
// One snapshot: the workbook as last read. When an updated workbook is read again, task
// decisions carry over by their stable keys (rule:record_id).

import { MY_EXCEL, emptyWorkbookProfile } from './workbook.js';

export { MY_EXCEL };
export const DAYS = ['day1'];
export const dayNumber = () => 1;

export function allBusinessIds() { return [MY_EXCEL]; }
export function hasBusiness(id) { return id === MY_EXCEL; }

let workbook = null;
export function setWorkbookScenario(scenario) { workbook = scenario; }
export function workbookLoaded() { return !!workbook; }

export function businessProfile() { return workbook?.profile || emptyWorkbookProfile(); }
export function dayMetadata() { return workbook?.metadata || { as_of_date: null }; }

// The open workbook as a scenario, or null while none is open.
export function loadScenario() { return workbook; }
