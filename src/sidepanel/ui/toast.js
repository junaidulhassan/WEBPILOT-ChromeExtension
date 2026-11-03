import { LIMITS } from '../../core/constants.js';
import { h, icon } from '../../utils/dom.js';
import { refs } from './refs.js';

const TOAST_ICONS = Object.freeze({
    info: 'fa-solid fa-circle-info',
    success: 'fa-solid fa-circle-check',
    warning: 'fa-solid fa-triangle-exclamation',
    error: 'fa-solid fa-circle-xmark'
});

const DEFAULT_DURATION_MS = Object.freeze({ info: 3500, success: 3000, warning: 5500, error: 6500 });
const LEAVE_FALLBACK_MS = 400;

function dismiss(toast) {
    if (toast.classList.contains('is-leaving')) return;
    toast.classList.add('is-leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), LEAVE_FALLBACK_MS);
}

export function showToast(message, { type = 'info', duration } = {}) {
    const visible = refs.toastRegion.querySelectorAll('.toast:not(.is-leaving)');
    if (visible.length >= LIMITS.visibleToasts) dismiss(visible[0]);

    const toast = h(
        'div',
        { class: `toast toast-${type}`, role: type === 'error' ? 'alert' : 'status' },
        icon(`toast-icon ${TOAST_ICONS[type] ?? TOAST_ICONS.info}`),
        h('span', { class: 'toast-message' }, message),
        h('button', { class: 'toast-close', type: 'button', 'aria-label': 'Dismiss', onClick: () => dismiss(toast) }, icon('fa-solid fa-xmark'))
    );

    refs.toastRegion.append(toast);
    setTimeout(() => dismiss(toast), duration ?? DEFAULT_DURATION_MS[type] ?? DEFAULT_DURATION_MS.info);
    return toast;
}
