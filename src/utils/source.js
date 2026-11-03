import { SOURCE_TYPES } from '../core/constants.js';

const UNSUPPORTED_URL_PATTERN = /^(chrome:\/\/|chrome-extension:\/\/|brave:\/\/|edge:\/\/|devtools:\/\/|view-source:|about:|data:|file:\/\/(?!.*\.pdf))/i;
const YOUTUBE_URL_PATTERN = /^https?:\/\/(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)\/.+/i;

const SOURCE_ICONS = Object.freeze({
    [SOURCE_TYPES.pdf]: 'fa-solid fa-file-pdf',
    [SOURCE_TYPES.youtube]: 'fa-brands fa-youtube',
    [SOURCE_TYPES.website]: 'fa-solid fa-globe'
});

export function isUnsupportedUrl(url) {
    return !url || UNSUPPORTED_URL_PATTERN.test(url);
}

export function isYouTubeUrl(url) {
    return YOUTUBE_URL_PATTERN.test(url);
}

function hasPdfPath(url) {
    try {
        return new URL(url).pathname.toLowerCase().endsWith('.pdf');
    } catch {
        return url.toLowerCase().endsWith('.pdf');
    }
}

export function detectSourceType(url) {
    if (hasPdfPath(url)) return SOURCE_TYPES.pdf;
    if (isYouTubeUrl(url)) return SOURCE_TYPES.youtube;
    return SOURCE_TYPES.website;
}

export function sourceIcon(sourceType) {
    return SOURCE_ICONS[sourceType] ?? SOURCE_ICONS[SOURCE_TYPES.website];
}

export function hostnameOf(url) {
    try {
        return new URL(url).hostname || url;
    } catch {
        return url;
    }
}
