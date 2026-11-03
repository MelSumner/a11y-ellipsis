// Prototype: an on-page readout for checking tooltip placement on a phone. Shows only with
// `?debug-viewport`; add `&viewport-fix=off` to compare without the visual viewport correction.
(() => {
  'use strict';

  const params = new URLSearchParams(location.search);

  if (!params.has('debug-viewport')) return;

  const fixOff = params.get('viewport-fix') === 'off';
  const panel = document.createElement('div');

  panel.style.cssText =
    'position:fixed;inset-inline:8px;inset-block-end:8px;z-index:10000;padding:6px 8px;border-radius:6px;' +
    'background:#ffd54a;color:#111;font:12px/1.4 ui-monospace,Menlo,monospace;white-space:pre-wrap';
  document.body.append(panel);

  const toggle = new URL(location.href);

  if (fixOff) toggle.searchParams.delete('viewport-fix');
  else toggle.searchParams.set('viewport-fix', 'off');

  let lastTooltip = 'Tap a ⋯ button to measure its tooltip.';

  const render = () => {
    const viewport = window.visualViewport;
    const round = (value) => Math.round(value * 10) / 10;

    panel.textContent = [
      `WebKit: ${CSS.supports('-webkit-backdrop-filter', 'none') ? 'yes' : 'no'}   fix: ${fixOff ? 'OFF' : 'on'}`,
      viewport
        ? `visualViewport offsetTop ${round(viewport.offsetTop)}  offsetLeft ${round(viewport.offsetLeft)}  ` +
          `height ${round(viewport.height)}  scale ${round(viewport.scale)}`
        : 'visualViewport: unsupported',
      `innerHeight ${innerHeight}`,
      lastTooltip,
    ].join('\n');

    const link = document.createElement('a');

    link.href = toggle.href;
    link.textContent = fixOff ? 'Turn the fix on' : 'Turn the fix off';
    link.style.color = '#111';
    panel.append('\n', link);
  };

  // Gap between the trigger and the tooltip box, measured the way the page reports it. Tippy's
  // offset makes it 10 when the tooltip sits where Popper placed it.
  const measure = (popper) => {
    const instance = popper._tippy;
    const box = popper.querySelector('.tippy-box');

    if (!instance || !box) return;

    const reference = instance.reference.getBoundingClientRect();
    const tooltip = box.getBoundingClientRect();
    const placement = box.dataset.placement ?? '?';
    const gap = placement.startsWith('top') ? reference.top - tooltip.bottom : tooltip.top - reference.bottom;

    lastTooltip = `Last tooltip: ${placement}, gap ${Math.round(gap)} (10 expected)`;
    render();
  };

  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof HTMLElement && node.hasAttribute('data-tippy-root')) {
          requestAnimationFrame(() => requestAnimationFrame(() => measure(node)));
        }
      }
    }
  }).observe(document.body, { childList: true, subtree: true });

  window.visualViewport?.addEventListener('resize', render);
  window.visualViewport?.addEventListener('scroll', render);
  render();
})();
