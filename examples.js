// Vanilla ports of the documented code (index.html), for the examples page only.
(() => {
  'use strict';

  /* ------------ utils/text-overflow.ts ------------ */

  const CLIP = '[data-truncation-clip]';

  function truncationClips(host) {
    if (host.matches(CLIP)) return [host];

    const clips = [...host.querySelectorAll(CLIP)];

    if (clips.length) return clips;

    const labelClips = [...(host.labels ?? [])].flatMap((label) => [...label.querySelectorAll(CLIP)]);

    return labelClips.length ? labelClips : [host];
  }

  function isTextOverflowing(element) {
    return truncationClips(element).some(isClipOverflowing);
  }

  function clippedTextLines(host) {
    return truncationClips(host)
      .flatMap((clip) => {
        const blocks = [...clip.children].filter(isBlockLine);

        return blocks.length ? blocks : [clip];
      })
      .map((line) => renderedText(line).replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  }

  function isBlockLine(element) {
    const { display } = getComputedStyle(element);

    return display !== 'none' && display !== 'contents' && !display.startsWith('inline');
  }

  const renderedText = (element) => (element instanceof HTMLElement ? element.innerText : element.textContent) ?? '';

  function isClipOverflowing(clip) {
    if (!(clip instanceof HTMLElement) || clip.offsetWidth === 0) return false;

    const range = document.createRange();

    range.selectNodeContents(clip);

    const textWidth = range.getBoundingClientRect().width;
    const box = clip.getBoundingClientRect();
    const scale = box.width / clip.offsetWidth;
    const { paddingInlineStart, paddingInlineEnd } = getComputedStyle(clip);
    const contentWidth = box.width - (parseFloat(paddingInlineStart) + parseFloat(paddingInlineEnd)) * scale;

    return textWidth > contentWidth;
  }

  /* ------------ utils/tooltips.ts ------------ */

  // Bounded by the viewport only; long values wrap inside it (see .tippy-box in examples.css).
  const VIEWPORT_MAX_WIDTH = 'calc(100vw - 16px)';

  function assert(message, condition) {
    if (!condition) throw new Error(`Assertion Failed: ${message}`);
  }

  function warn(message, test, { id }) {
    if (!test) console.warn(`WARNING: ${message} [${id}]`);
  }

  const isFocusable = (element) =>
    element.tabIndex >= 0 && !(element.localName === 'a' && !element.hasAttribute('href'));

  const isExpanded = (element) => element.getAttribute('aria-expanded') === 'true';

  const isRevealHost = (instance) => instance.props.plugins.includes(hideWhenExpanded);

  const isFileInput = (element) => element instanceof HTMLInputElement && element.type === 'file';

  // tippy's documented recipe for dismissing on Esc.
  const hideOnEscape = {
    name: 'hideOnEscape',
    defaultValue: true,
    fn({ hide }) {
      const onKeyDown = (event) => {
        if (event.key === 'Escape') hide();
      };

      return {
        onShow() {
          document.addEventListener('keydown', onKeyDown);
        },
        onHide() {
          document.removeEventListener('keydown', onKeyDown);
        },
      };
    },
  };

  const hideWhenExpanded = {
    fn(instance) {
      const observer = new MutationObserver(() => {
        if (isExpanded(instance.reference)) instance.hide();
      });
      const hideAsPickerOpens = (event) => {
        if (!event.defaultPrevented) instance.hide();
      };
      const stopWatching = () => {
        observer.disconnect();
        instance.reference.removeEventListener('click', hideAsPickerOpens);
      };

      return {
        onShow() {
          observer.observe(instance.reference, { attributeFilter: ['aria-expanded'] });

          if (isFileInput(instance.reference)) instance.reference.addEventListener('click', hideAsPickerOpens);
        },
        onHide: stopWatching,
        onDestroy: stopWatching,
      };
    },
  };

  function revealHostContent(host) {
    const content = document.createElement('div');

    for (const line of clippedTextLines(host)) {
      const row = document.createElement('div');

      row.textContent = line;
      content.append(row);
    }

    return content;
  }

  function showAsRevealHost(content, reason, formatReason = (value, why) => `${value}: ${why}`) {
    return (instance) => {
      if (isExpanded(instance.reference)) return false;

      const isClipped = isTextOverflowing(instance.reference);
      const why = reason?.();

      if (!isClipped && !why) return false;

      if (why) {
        const value = clippedTextLines(instance.reference).join(' ');

        instance.setContent(isClipped && value ? formatReason(value, why) : why);
      } else if (typeof content === 'function') {
        instance.setContent(content(instance.reference));
      } else if (content !== undefined) {
        instance.setContent(content);
      }

      return undefined;
    };
  }

  const destroyInstance = (instance) => instance.destroy();

  function applyTooltip(element, opts) {
    const existingTooltip = element._tippy;
    const options = { ...(opts ?? {}) };
    const tooltipInactive = !options.content || options.hideTooltip;

    if (tooltipInactive && !existingTooltip) return undefined;

    if (tooltipInactive && existingTooltip) {
      destroyInstance(existingTooltip);

      return () => {};
    }

    assert(
      `A tooltip needs a trigger a keyboard can reach, but this <${element.localName}> ${
        element.matches(':disabled') ? 'is natively disabled; use aria-disabled instead' : 'is not focusable'
      }.`,
      isFocusable(element) && !element.matches(':disabled'),
    );

    if (existingTooltip && options.content) {
      warn(
        "A plain tooltip and a Reveal Host tooltip were both attached to the same trigger; only the first one's behavior applies.",
        isRevealHost(existingTooltip) === (options.showWhen === 'overflowing'),
        { id: 'my-design-system.tooltip-second-source' },
      );
      existingTooltip.setContent(options.content);

      return () => {
        destroyInstance(existingTooltip);
      };
    }

    if (!opts) return () => {};

    const props = {
      content: opts.content,
      placement: opts.placement || 'top',
      appendTo: opts.appendTo ?? 'parent',
      popperOptions: { ...opts.popperOptions, strategy: opts.popperOptions?.strategy ?? 'fixed' },
      theme: opts.theme,
      interactive: opts.interactive ?? true,
      aria: opts.aria ?? { content: 'describedby', expanded: false },
      hideOnClick: opts.hideOnClick,
      maxWidth: opts.maxWidth ?? VIEWPORT_MAX_WIDTH,
      triggerTarget: opts.triggerTarget,
      getReferenceClientRect: opts.getReferenceClientRect,
      plugins: opts.showWhen === 'overflowing' ? [hideOnEscape, hideWhenExpanded] : [hideOnEscape],
      onShow:
        opts.showWhen === 'overflowing' ? showAsRevealHost(opts.content, opts.reason, opts.formatReason) : undefined,
    };

    // Unset options keep tippy's defaults rather than overriding them with undefined.
    for (const key of Object.keys(props)) {
      if (props[key] === undefined) delete props[key];
    }

    const instance = window.tippy(element, props);

    if (opts.showWhen === 'overflowing') instance.popper.setAttribute('aria-hidden', 'true');

    return () => {
      destroyInstance(instance);
    };
  }

  /* ------------ Modifiers and the component ------------ */

  const attachTooltip = applyTooltip;

  const truncationHost = (element, text) =>
    applyTooltip(element, {
      content: text ?? revealHostContent,
      showWhen: 'overflowing',
      aria: { content: null, expanded: false },
    });

  const ELLIPSIS_DOTS =
    '<svg class="c-truncation__reveal-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
    '<circle cx="3" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="13" cy="8" r="1.5"/></svg>';

  function el(tag, attributes = {}, text) {
    const element = document.createElement(tag);

    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    if (text !== undefined) element.textContent = text;

    return element;
  }

  // <Truncation @text> — `attributes` stands in for `...attributes` on the wrapper.
  function Truncation(text, attributes = {}) {
    const wrapper = el('span', { 'data-test-truncation': '', ...attributes });

    wrapper.classList.add('c-truncation');

    const plain = el('span', { class: 'c-truncation__plain', 'data-test-truncation-plain': '' }, text);
    const overflow = el('span', { class: 'c-truncation__overflow' });
    const copy = el(
      'span',
      { class: 'c-truncation__text', 'aria-hidden': 'true', 'data-truncation-copy': '' },
      text,
    );
    const button = el('button', {
      type: 'button',
      class: 'c-button--reset c-button--icon-only c-truncation__reveal',
      'aria-label': text,
      'data-test-truncation-reveal': '',
    });

    button.innerHTML = ELLIPSIS_DOTS;
    overflow.append(copy, button);
    wrapper.append(plain, overflow);

    return wrapper;
  }

  // Runs once the Truncation is in the document, as the `attachTooltip` modifier would.
  function installTruncation(wrapper) {
    const button = wrapper.querySelector('.c-truncation__reveal');

    attachTooltip(button, { content: button.getAttribute('aria-label'), hideOnClick: false });
  }

  function mountTruncation(target, wrapper, method = 'replaceWith') {
    target[method](wrapper);

    for (const truncation of wrapper.matches('.c-truncation') ? [wrapper] : wrapper.querySelectorAll('.c-truncation')) {
      installTruncation(truncation);
    }
  }

  // Replaces each `<span data-truncation>Value</span>` with a rendered <Truncation>.
  function renderTruncations(root = document) {
    for (const placeholder of root.querySelectorAll('[data-truncation]')) {
      const attributes = {};

      for (const { name, value } of placeholder.attributes) {
        if (name !== 'data-truncation') attributes[name] = value;
      }

      mountTruncation(placeholder, Truncation(placeholder.textContent.trim(), attributes));
    }
  }

  function setupTruncationHosts(root = document) {
    for (const host of root.querySelectorAll('[data-truncation-host]')) {
      truncationHost(host, host.dataset.truncationHost || undefined);
    }
  }

  /* ------------ Demo wiring ------------ */

  function setupWidthControls() {
    for (const demo of document.querySelectorAll('.demo')) {
      const input = demo.querySelector('[data-demo-width]');
      const output = demo.querySelector('[data-demo-width-output]');
      const frame = demo.querySelector('.demo__frame');

      if (!input || !frame) continue;

      const apply = () => {
        frame.style.inlineSize = `${input.value}%`;
        if (output) output.textContent = `${input.value}%`;
      };

      input.addEventListener('input', apply);
      apply();
    }
  }

  function setStatus(scope, message) {
    const status = scope.closest('.demo')?.querySelector('[data-status]');

    if (status) status.textContent = message;
  }

  function setupItemsSummary() {
    for (const button of document.querySelectorAll('[data-items-reveal]')) {
      attachTooltip(button, { content: button.getAttribute('aria-label'), hideOnClick: false });
    }
  }

  function setupIconButton() {
    const button = document.querySelector('[data-demo="icon-button"]');

    button?.addEventListener('click', () => setStatus(button, 'Download started (demo only).'));
  }

  function setupFileUpload() {
    const label = document.querySelector('[data-demo="file-upload"]');

    if (!label) return;

    const input = label.querySelector('input[type="file"]');
    const name = label.querySelector('.c-file-upload__name');
    const showName = () => {
      name.textContent = input.files?.[0]?.name ?? 'No file chosen';
    };

    // Preselect a long file name so the clip is visible before anything is picked.
    try {
      const transfer = new DataTransfer();

      transfer.items.add(new File([''], 'my-long-breakable-file-name-for-the-quarterly-report-final-v2.pdf'));
      input.files = transfer.files;
    } catch {
      // Older browsers can't assign files; the demo starts empty instead.
    }

    showName();
    input.addEventListener('change', showName);

    // Rule 9: mounted beside the label, not inside it, so a click in the tooltip can't reopen the picker.
    applyTooltip(input, {
      content: revealHostContent,
      showWhen: 'overflowing',
      aria: { content: null, expanded: false },
      appendTo: label.parentElement,
      triggerTarget: [input, label],
      getReferenceClientRect: () => label.getBoundingClientRect(),
    });
  }

  // Shared keyboard behavior for the select's listbox and the profile chip's menu.
  function setupPopup(root, { trigger, popup, items, onOpen, onChoose, focusItems }) {
    let active = 0;

    const setActive = (index) => {
      active = (index + items.length) % items.length;
      items.forEach((item, i) => item.classList.toggle('is-active', i === active));

      if (focusItems) items[active].focus();
      else popup.setAttribute('aria-activedescendant', items[active].id);
    };

    const open = (index = onOpen?.() ?? 0) => {
      popup.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      if (!focusItems) popup.focus();
      setActive(index);
    };

    const close = (returnFocus) => {
      if (popup.hidden) return;

      popup.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      if (returnFocus) trigger.focus();
    };

    const choose = (index) => {
      onChoose?.(index);
      close(true);
    };

    trigger.addEventListener('click', () => (popup.hidden ? open() : close(false)));
    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        open(event.key === 'ArrowUp' ? items.length - 1 : undefined);
      }
    });

    popup.addEventListener('keydown', (event) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setActive(active + 1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          setActive(active - 1);
          break;
        case 'Home':
          event.preventDefault();
          setActive(0);
          break;
        case 'End':
          event.preventDefault();
          setActive(items.length - 1);
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          choose(active);
          break;
        case 'Escape':
          event.preventDefault();
          close(true);
          break;
        case 'Tab':
          close(false);
          break;
      }
    });

    items.forEach((item, index) => item.addEventListener('click', () => choose(index)));

    document.addEventListener('pointerdown', (event) => {
      if (!root.contains(event.target)) close(false);
    });
  }

  function setupSelect() {
    const root = document.querySelector('[data-demo="select"]');

    if (!root) return;

    const trigger = root.querySelector('.c-select__trigger');
    const value = trigger.querySelector('[data-truncation-clip]');
    const listbox = root.querySelector('[role="listbox"]');
    const options = [...listbox.querySelectorAll('[role="option"]')];
    let selected = options.findIndex((option) => option.getAttribute('aria-selected') === 'true');

    // As an Ember modifier would: tear down and re-run when its argument changes.
    let teardown = truncationHost(trigger, options[selected].textContent);

    setupPopup(root, {
      trigger,
      popup: listbox,
      items: options,
      onOpen: () => selected,
      onChoose: (index) => {
        selected = index;
        options.forEach((option, i) => option.setAttribute('aria-selected', String(i === index)));
        value.textContent = options[index].textContent;
        teardown?.();
        teardown = truncationHost(trigger, options[index].textContent);
      },
    });
  }

  function setupMenu() {
    const root = document.querySelector('[data-demo="menu"]');

    if (!root) return;

    const trigger = root.querySelector('.c-profile-chip');
    const menu = root.querySelector('[role="menu"]');
    const items = [...menu.querySelectorAll('[role="menuitem"]')];

    truncationHost(trigger);
    setupPopup(root, {
      trigger,
      popup: menu,
      items,
      focusItems: true,
      onChoose: (index) => setStatus(root, `Chose "${items[index].textContent}" (demo only).`),
    });
  }

  function setupLockedHost() {
    const button = document.querySelector('[data-demo="locked"]');
    const toggle = document.querySelector('[data-demo="locked-toggle"]');

    if (!button || !toggle) return;

    const reasonId = 'locked-reason';
    let lockedReason = '';

    const render = () => {
      lockedReason = toggle.checked ? 'Publishing is locked while the document is in review' : '';

      document.getElementById(reasonId)?.remove();

      if (lockedReason) {
        button.setAttribute('aria-disabled', 'true');
        button.setAttribute('aria-describedby', reasonId);
        button.after(el('span', { id: reasonId, class: 'c-visually-hidden' }, lockedReason));
      } else {
        button.removeAttribute('aria-disabled');
        button.removeAttribute('aria-describedby');
      }
    };

    toggle.addEventListener('change', render);
    render();

    attachTooltip(button, {
      content: revealHostContent,
      showWhen: 'overflowing',
      aria: { content: null, expanded: false },
      reason: () => lockedReason,
      formatReason: (value, why) => `${value}: ${why}`,
    });

    button.addEventListener('click', () => {
      // aria-disabled doesn't stop clicks.
      if (lockedReason) return;

      setStatus(button, 'Published (demo only).');
    });
  }

  /* ------------ name-label ------------ */

  // Translated in place of the person's name, so the copy around the name can be split off it.
  const NAME_PLACEHOLDER = '\uE000';

  const TRANSLATIONS = {
    en: { 'shared-by': '{name} shared this file' },
    de: { 'shared-by': 'Diese Datei wurde von {name} geteilt' },
    ja: { 'shared-by': 'このファイルの共有者：{name}' },
  };

  const intl = {
    locale: 'en',
    t(key, { name }) {
      return TRANSLATIONS[this.locale][key].replace('{name}', name);
    },
  };

  function copyAroundName(name, key) {
    if (!name) return undefined;

    const label = intl.t(key, { name: NAME_PLACEHOLDER });
    const at = label.indexOf(NAME_PLACEHOLDER);

    if (at === -1) return undefined;

    return {
      before: label.slice(0, at).trim(),
      after: label.slice(at + NAME_PLACEHOLDER.length).trim(),
    };
  }

  function NameLabel(name, copy, avatar) {
    const label = el('div', { class: 'c-name-label' });

    if (copy.before) label.append(el('span', { class: 'c-name-label__copy', 'data-test-label-before': '' }, copy.before));

    const nameWrapper = el('span', { class: 'c-name-label__name' });

    nameWrapper.append(avatar, Truncation(name, { 'data-test-label-name': '' }));
    label.append(nameWrapper);

    if (copy.after) label.append(el('span', { class: 'c-name-label__copy', 'data-test-label-after': '' }, copy.after));

    return label;
  }

  function setupNameLabel() {
    const mount = document.querySelector('[data-demo="name-label"]');
    const picker = document.querySelector('[data-demo="name-label-locale"]');

    if (!mount || !picker) return;

    const name = 'Maximiliana Konstantinopoulou-Abernathy';

    const render = () => {
      intl.locale = picker.value;

      const copy = copyAroundName(name, 'shared-by');
      const avatar = el('span', { class: 'c-name-label__avatar', 'aria-hidden': 'true' }, 'MK');

      mount.lang = picker.value;
      mount.querySelectorAll('.c-truncation__reveal').forEach((button) => button._tippy?.destroy());
      mountTruncation(mount, copy ? NameLabel(name, copy, avatar) : Truncation(name), 'replaceChildren');
    };

    picker.addEventListener('change', render);
    render();
  }

  function reportScrollTimelineSupport() {
    const target = document.querySelector('[data-demo="support"]');

    if (!target) return;

    const supported = CSS.supports('(animation-timeline: --a) and (timeline-scope: --a)');

    target.textContent = supported
      ? 'This browser supports scroll-driven animations, so the live examples truncate. The copy below forces the fallback styles.'
      : 'This browser does not support scroll-driven animations, so every example on this page is already using the fallback.';
  }

  renderTruncations();
  setupTruncationHosts();
  setupWidthControls();
  setupItemsSummary();
  setupIconButton();
  setupFileUpload();
  setupSelect();
  setupMenu();
  setupLockedHost();
  setupNameLabel();
  reportScrollTimelineSupport();
})();
