import { replayAnimation } from '../../utils/dom.js';
import { refs } from './refs.js';

function showFavicon(visible) {
    refs.urlFavicon.classList.toggle('hidden', !visible);
    refs.urlFallbackIcon.classList.toggle('hidden', visible);
}

export function renderUrlBar({ url, favIconUrl }) {
    refs.urlBar.title = url;
    replayAnimation(refs.urlBar, 'is-switching');

    if (favIconUrl) {
        refs.urlFavicon.onerror = () => showFavicon(false);
        refs.urlFavicon.onload = () => showFavicon(true);
        refs.urlFavicon.src = favIconUrl;
    } else {
        showFavicon(false);
    }

    try {
        const parsed = new URL(url);
        refs.urlHost.textContent = parsed.hostname || url;
        const rest = parsed.pathname + parsed.search;
        refs.urlPath.textContent = rest === '/' ? '' : rest;
    } catch {
        refs.urlHost.textContent = url;
        refs.urlPath.textContent = '';
    }
}

export function setUrlLoading(loading) {
    refs.urlBar.classList.toggle('loading', loading);
}

export function setBrandSpinning(spinning) {
    refs.brandAtom.classList.toggle('spinning', spinning);
}
