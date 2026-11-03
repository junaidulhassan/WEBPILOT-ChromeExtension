const dismissables = new Set();

export function registerDismissable(entry) {
    dismissables.add(entry);
}

export function closeTopDismissable() {
    const open = [...dismissables].filter((entry) => entry.isOpen());
    const top = open.at(-1);
    if (!top) return false;
    top.close();
    return true;
}

export function initDismissables() {
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && closeTopDismissable()) {
            event.preventDefault();
        }
    });
}
