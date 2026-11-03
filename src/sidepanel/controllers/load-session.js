import { lockComposer } from '../ui/composer.js';
import { setBrandSpinning, setUrlLoading } from '../ui/url-bar.js';
import { state } from '../state.js';

function setLoadingIndicators(loading) {
    state.isLoading = loading;
    setBrandSpinning(loading);
    setUrlLoading(loading);
}

export function cancelLoads() {
    state.loadAbort?.abort();
    state.loadAbort = null;
    state.loadToken += 1;
    state.pageReady = false;
    setLoadingIndicators(false);
}

export function beginLoad(placeholder) {
    cancelLoads();

    const controller = new AbortController();
    const token = state.loadToken;
    state.loadAbort = controller;
    setLoadingIndicators(true);
    lockComposer(placeholder);

    return {
        signal: controller.signal,
        isCurrent: () => token === state.loadToken,
        finish() {
            if (token === state.loadToken) setLoadingIndicators(false);
        }
    };
}
