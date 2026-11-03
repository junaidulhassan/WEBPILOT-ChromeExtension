export function h(tag, props, ...children) {
    const element = document.createElement(tag);

    for (const [key, value] of Object.entries(props ?? {})) {
        if (value === null || value === undefined || value === false) continue;

        if (key === 'class') {
            element.className = value;
        } else if (key === 'dataset') {
            Object.assign(element.dataset, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
            element.addEventListener(key.slice(2).toLowerCase(), value);
        } else {
            element.setAttribute(key, value === true ? '' : value);
        }
    }

    element.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
    return element;
}

export function icon(classes) {
    return h('i', { class: classes, 'aria-hidden': 'true' });
}

export function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function replayAnimation(element, className) {
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
}

export function animateElement(element, keyframes, options) {
    if (prefersReducedMotion() || typeof element.animate !== 'function') return Promise.resolve();
    return element.animate(keyframes, options).finished.catch(() => {});
}
