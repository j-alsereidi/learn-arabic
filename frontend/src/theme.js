export const THEME_KEY = 'atlas.ui.theme';
export const THEME_EVENT = 'atlas:themechange';

// The matching early initializer in public/index.html runs before the first paint.
export const currentTheme = () => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

export function applyTheme(theme) {
  const next = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  try { window.localStorage.setItem(THEME_KEY, next); } catch (_) { /* Storage may be unavailable. */ }
  window.dispatchEvent(new Event(THEME_EVENT));
}
