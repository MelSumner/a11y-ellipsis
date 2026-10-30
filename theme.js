// Loaded in <head> without defer so a saved theme applies before first paint.
(() => {
  'use strict';

  const KEY = 'theme';
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

  const readSaved = () => {
    try {
      const value = localStorage.getItem(KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch {
      return null;
    }
  };

  const saved = readSaved();

  if (saved) root.dataset.theme = saved;

  const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : prefersDark.matches);

  document.addEventListener('DOMContentLoaded', () => {
    const button = document.querySelector('[data-theme-toggle]');

    if (!button) return;

    const sync = () => button.setAttribute('aria-pressed', String(isDark()));

    button.addEventListener('click', () => {
      const next = isDark() ? 'light' : 'dark';

      root.dataset.theme = next;

      try {
        localStorage.setItem(KEY, next);
      } catch {
        // Storage can be unavailable (private mode, file:// in some browsers); the choice still applies to this page.
      }

      sync();
    });

    // Until someone chooses, the button follows the OS setting.
    prefersDark.addEventListener('change', () => {
      if (!root.dataset.theme) sync();
    });

    sync();
  });
})();
