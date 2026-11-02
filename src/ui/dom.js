// Small DOM helpers (from the original template). Everything is rendered with
// textContent / createTextNode, never innerHTML, so record text can never run as code.

import { tl } from '../i18n/i18n.js';

export const $ = sel => document.querySelector(sel);

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  return add(el, ...children);
}

export const t = (tag, text, cls) => h(tag, { class: cls, text });

// Append that ignores null/false children (native append would render the text "null").
export function add(parent, ...children) {
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    parent.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return parent;
}

export function toast(message, { error = false, ms = 3500 } = {}) {
  const el = $('#toast');
  el.textContent = message; el.className = 'toast' + (error ? ' error' : ''); el.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { el.hidden = true; }, ms);
}

// actions: [{ label, primary, danger, onclick }] — return true from onclick to keep the dialog open.
export function modal(title, body, { actions = [], closeLabel = tl('Close') } = {}) {
  const root = $('#modal-root'); root.textContent = '';
  const close = () => { root.textContent = ''; document.removeEventListener('keydown', esc); };
  function esc(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', esc);
  const buttons = actions.map(a => h('button', { class: `btn ${a.primary ? 'primary' : ''} ${a.danger ? 'danger' : ''}`, onclick: async () => { const keep = await a.onclick?.(); if (!keep) close(); } }, a.label));
  const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, t('h2', title), body,
    h('div', { class: 'foot' }, ...buttons, h('button', { class: 'btn ghost', onclick: close }, closeLabel)));
  add(root, h('div', { class: 'modal-back', onclick: e => { if (e.target === e.currentTarget) close(); } }, box));
  (box.querySelector('input, textarea, select') || buttons[0])?.focus();
  return close;
}

export function drawer(title, body) {
  const root = $('#modal-root'); root.textContent = '';
  const close = () => { root.textContent = ''; document.removeEventListener('keydown', esc); };
  function esc(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', esc);
  const closeBtn = h('button', { class: 'btn ghost small close', onclick: close }, tl('Close ×'));
  add(root, h('div', { class: 'drawer', role: 'dialog', 'aria-label': title }, closeBtn, t('h2', title), body));
  closeBtn.focus();
  return close;
}
