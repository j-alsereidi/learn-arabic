import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

jest.mock('./auth', () => ({ currentSession: async () => ({ guest: true, user: null }), startGuest: jest.fn() }));
jest.mock('./AccountView', () => ({ SignInButton: () => <button>Sign in</button>, AccountMenu: () => null, SignInDialog: () => null }));
jest.mock('./LibraryView', () => () => <p>Library screen</p>);
jest.mock('./AtlasView', () => () => <p>Atlas screen</p>);
jest.mock('./FlashcardsView', () => () => <p>Flashcards screen</p>);
jest.mock('./CalibrateView', () => ({ initialEntry, onClose }) => <div>Calibration screen: {String(initialEntry)}<button onClick={onClose}>Return</button></div>);
jest.mock('./TutorView', () => {
  const React = require('react');
  return function TutorFixture() {
    const [draft, setDraft] = React.useState('');
    return <input aria-label="Tutor fixture draft" value={draft} onChange={e => setDraft(e.target.value)} />;
  };
});

let root, host;
const response = value => Promise.resolve({ ok: true, json: async () => value });
const click = async label => {
  const button = [...host.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === label || b.textContent === label);
  expect(button).toBeDefined();
  await act(async () => button.click());
};
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  document.documentElement.dataset.theme = 'light'; localStorage.clear();
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); jest.restoreAllMocks(); });

test.each([
  ['sample', [], 0, 'Calibration screen: true'],
  ['done', [1], 0, 'Library screen'],
  ['sample', [1], 20, 'Library screen'],
  ['sample', [], 20, 'Library screen'],
])('Initial entry uses server state (%s, %j, %i)', async (mode, steps, known, expected) => {
  global.fetch = jest.fn(path => response(path.endsWith('known-count') ? { known } : { mode, steps }));
  await act(async () => root.render(<App />));
  expect(host.textContent).toContain(expected);
  if (steps.length && mode !== 'done') expect(host.textContent).toContain('Continue calibration');
});

test('A late setup response cannot redirect explicit navigation', async () => {
  const statusRequests = [];
  global.fetch = jest.fn(path => path.endsWith('known-count') ? response({ known: 0 }) : new Promise(resolve => { statusRequests.push(resolve); }));
  await act(async () => root.render(<App />));
  await click('Atlas');
  await act(async () => statusRequests.forEach(resolve => resolve({ ok: true, json: async () => ({ mode: 'sample', steps: [] }) })));
  expect(host.textContent).toContain('Atlas screen');
  expect(host.textContent).not.toContain('Calibration screen');
});

test('Failed status keeps navigation usable and does not claim completion', async () => {
  global.fetch = jest.fn(() => Promise.reject(new Error('offline')));
  await act(async () => root.render(<App />));
  expect(host.textContent).toContain('Library screen');
  await click('Atlas'); expect(host.textContent).toContain('Atlas screen');
  expect(host.textContent).not.toContain('Start here');
});

test('Manual calibration returns to the prior view', async () => {
  global.fetch = jest.fn(path => response(path.endsWith('known-count') ? { known: 20 } : { mode: 'sample', steps: [1] }));
  await act(async () => root.render(<App />));
  await click('Atlas'); await click('Calibrate');
  expect(host.textContent).toContain('Calibration screen: false');
  await click('Return'); expect(host.textContent).toContain('Atlas screen');
});

test('Theme changes preserve the mounted Tutor and make no data requests', async () => {
  global.fetch = jest.fn(path => response(path.endsWith('known-count') ? { known: 20 } : { mode: 'done', steps: [1] }));
  await act(async () => root.render(<App />)); await click('Tutor');
  const input = host.querySelector('input');
  const calls = fetch.mock.calls.length;
  await click('Dark');
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(localStorage.getItem('atlas.ui.theme')).toBe('dark');
  expect(host.querySelector('input')).toBe(input);
  expect(fetch).toHaveBeenCalledTimes(calls);
  const pageShortcut = jest.fn();
  window.addEventListener('keydown', pageShortcut);
  const appearanceButton = host.querySelector('.appearance-control button');
  appearanceButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(pageShortcut).not.toHaveBeenCalled();
  window.removeEventListener('keydown', pageShortcut);
  await click('Library'); await click('Tutor');
  expect(host.querySelector('input')).toBe(input);
});
