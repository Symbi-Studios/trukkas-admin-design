'use client';
import React from 'react';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])', 'select:not([disabled])',
  'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])', '[contenteditable="true"]',
].join(',');

// Open dialogs, innermost last. Only the top one answers Escape and Tab, so a
// modal opened from a drawer closes on its own instead of taking the drawer with it.
const stack = [];
let locks = 0;
let savedOverflow = '';

function focusables(root) {
  return [...root.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
}

function scrollArea() {
  return document.querySelector('.tk-app-scroll') || document.body;
}

/**
 * Dialog behaviour for Modal and SideDrawer while mounted:
 * focus moves inside (an [autofocus]/[data-autofocus] element, else the first field, else the panel),
 * Tab stays inside, Escape closes the top dialog only, the page behind stops scrolling,
 * and focus returns to whatever opened the dialog when it closes.
 */
export function useDialogFocus(ref, { active = true, onClose } = {}) {
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;

  React.useEffect(() => {
    if (!active || !ref.current) return undefined;
    const panel = ref.current;
    const opener = document.activeElement;
    const entry = { panel };
    stack.push(entry);

    if (locks++ === 0) {
      const area = scrollArea();
      savedOverflow = area.style.overflow;
      area.style.overflow = 'hidden';
    }

    if (!panel.contains(document.activeElement)) {
      const preferred = panel.querySelector('[autofocus], [data-autofocus]')
        || focusables(panel).find((el) => el.matches('input, select, textarea, [contenteditable="true"]'));
      if (preferred) preferred.focus({ preventScroll: true });
      else {
        if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
        panel.focus({ preventScroll: true });
      }
    }

    const onKey = (event) => {
      if (stack[stack.length - 1] !== entry) return;
      if (event.key === 'Escape') {
        // An open menu or picker inside the dialog closes first.
        if (panel.querySelector('[aria-expanded="true"]')) return;
        closeRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables(panel);
      if (!items.length) { event.preventDefault(); panel.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(entry), 1);
      if (--locks === 0) scrollArea().style.overflow = savedOverflow;
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [active, ref]);
}
