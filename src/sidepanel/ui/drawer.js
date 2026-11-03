import { registerDismissable } from './dismissables.js';

const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input, textarea';

export function createDrawer({ drawer, overlay, onOpen, onClose }) {
    let opened = false;
    let returnFocusTo = null;

    function setVisible(visible) {
        drawer.classList.toggle('is-open', visible);
        overlay.classList.toggle('is-open', visible);
        drawer.toggleAttribute('inert', !visible);
        drawer.setAttribute('aria-hidden', String(!visible));
        overlay.setAttribute('aria-hidden', String(!visible));
    }

    function open() {
        if (opened) return;
        opened = true;
        returnFocusTo = document.activeElement;
        onOpen?.();
        setVisible(true);
        requestAnimationFrame(() => drawer.querySelector(FOCUSABLE_SELECTOR)?.focus({ preventScroll: true }));
    }

    function close() {
        if (!opened) return;
        opened = false;
        setVisible(false);
        onClose?.();
        if (returnFocusTo instanceof HTMLElement) returnFocusTo.focus({ preventScroll: true });
        returnFocusTo = null;
    }

    overlay.addEventListener('click', close);
    registerDismissable({ isOpen: () => opened, close });

    return { open, close, isOpen: () => opened };
}
