import { applyTheme } from './theme';
const fs = require('fs');
const vm = require('vm');

test.each([['dark', 'dark'], ['light', 'light'], [null, 'light'], ['invalid', 'light']])('Early paint uses stored %s as %s', (saved, expected) => {
  const script = fs.readFileSync('public/index.html', 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  const context = { document: { documentElement: { dataset: {} } }, localStorage: { getItem: () => saved } };
  vm.runInNewContext(script, context);
  expect(context.document.documentElement.dataset.theme).toBe(expected);
});

test('Early paint falls back to light when browser storage is blocked', () => {
  const script = fs.readFileSync('public/index.html', 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  const context = { document: { documentElement: { dataset: {} } }, localStorage: { getItem: () => { throw new Error('blocked'); } } };
  vm.runInNewContext(script, context);
  expect(context.document.documentElement.dataset.theme).toBe('light');
});

test('Unavailable browser storage does not prevent switching appearance', () => {
  const storage = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(() => applyTheme('dark')).not.toThrow();
  expect(document.documentElement.dataset.theme).toBe('dark');
  storage.mockRestore();
});
