import { registerDismissable } from './dismissables.js';

export function createDropdown({ button, panel }) {
    let opened = false;

    function setOpen(next) {
        opened = next;
        panel.classList.toggle('is-open', next);
        panel.toggleAttribute('inert', !next);
        panel.setAttribute('aria-hidden', String(!next));
        button.setAttribute('aria-expanded', String(next));
    }

    function open() {
        setOpen(true);
    }

    function close() {
        if (opened) setOpen(false);
    }

    button.addEventListener('click', () => setOpen(!opened));
    document.addEventListener('click', (event) => {
        if (opened && !panel.contains(event.target) && !button.contains(event.target)) close();
    });
    registerDismissable({ isOpen: () => opened, close });

    return { open, close, isOpen: () => opened };
}
