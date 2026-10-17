import { LIMITS } from '../core/constants.js';
import { hostnameOf } from './source.js';

export function deriveTitle(tabTitle, url) {
    const trimmed = tabTitle?.trim();
    if (trimmed) return trimmed.slice(0, LIMITS.titleLength);
    return hostnameOf(url).slice(0, LIMITS.titleLength);
}

export function truncate(text, length) {
    return text.length > length ? `${text.slice(0, length)}…` : text;
}

export function formatHistoryDate(timestamp, now = new Date()) {
    const date = new Date(timestamp);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (date.toDateString() === now.toDateString()) return `Today, ${time}`;
    if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;

    const options = { month: 'short', day: 'numeric' };
    if (date.getFullYear() !== now.getFullYear()) options.year = 'numeric';
    return `${date.toLocaleDateString([], options)}, ${time}`;
}
