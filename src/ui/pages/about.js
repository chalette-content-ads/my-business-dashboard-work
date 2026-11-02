import { h, t, add } from '../dom.js';
import { pageHead } from '../components.js';
import { view } from '../view-state.js';
import { openResetDialog } from '../shell.js';
import { pickExcel } from './excel.js';
import { tr, tl } from '../../i18n/i18n.js';
import { APP_VERSION } from '../../version.js';

export function renderAbout() {
  const root = h('div', {}, pageHead(tl('About this dashboard')));
  add(root, h('div', { class: 'card' }, t('h2', tr('What this is')),
    t('p', tr('A small-business dashboard for your own Excel workbook. It has no data of its own: open your workbook, and the figures, tasks and calendar are calculated from your records on this computer. A workbook in another layout is matched once with "Match your columns".')),
    t('p', tr('It needs no account, no sign-in and no internet connection. Your Excel file is never uploaded. Only the optional "Analyse with Gemini" goes online, with your own key.'), 'small ink2')));

  add(root, h('div', { class: 'card' }, t('h2', tr('How to use it')),
    h('ol', { class: 'steps' },
      t('li', tr('Choose your Excel file. No file yet? The "Open your Excel" page has practice workbooks to download.')),
      t('li', tr('Read the Overview, then open Sales, Customers, Payments and Stock. Click a row to see the record behind a figure.')),
      t('li', tr('In Tasks, accept a suggestion and change its action date. It then appears on the Calendar. Add a calendar note too.')),
      t('li', tr('When your records change, save the workbook in Excel and choose "Read the Excel again". Your decisions about the same records are kept.')),
      t('li', tr('Open AI analysis to ask Gemini about the numbers, with your own free key.'))),
    h('button', { class: 'btn', onclick: pickExcel }, tl('Choose an Excel file…'))));

  const saving = view.persistent
    ? tr('Your Excel, task decisions, notes, AI analysis, language and Gemini key are saved in this browser on this device. They are not a backup, not shared with anyone and not synchronised to other devices. Clearing browser data, a private window, or a different browser or computer starts from the beginning.')
    : tr('This browser does not allow the page to save anything ({0}). The dashboard still works, but your changes are lost when you close or reload the page.', view.storageReason || tr('blocked'));
  add(root, h('div', { class: 'card' }, t('h2', tr('Saving')),
    h('p', {}, h('span', { class: `badge ${view.persistent ? 'good' : 'warning'}` }, view.persistent ? tr('Saving in this browser') : tr('Not saving')), ' ', saving),
    t('p', tr('Each suggestion keeps the same identifier (rule and record), so your decisions survive reading an updated workbook.'), 'small ink2'),
    h('button', { class: 'btn', onclick: openResetDialog }, tl('Clear decisions and notes…'))));

  add(root, h('div', { class: 'card' }, t('h2', tr('Limits')),
    h('ul', { class: 'small ink2' },
      t('li', tr('This is a learning starter, not a production system. Do not open confidential business data on a shared computer.')),
      t('li', tr('A workbook in another layout is matched once with "Match your columns"; only the orders sheet is required.')),
      t('li', tr('Saving is per browser. There is no sign-in, no sharing and no cloud backup: to show your numbers to someone else, they open the same workbook on their own computer.')),
      t('li', tr('AI analysis is written by Gemini. It can be wrong; the number check shows figures that are not in your data.'))),
    t('p', tr('Version {0}', APP_VERSION), 'hint')));
  return root;
}
