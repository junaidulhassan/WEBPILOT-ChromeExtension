import { BACKEND_OPTION_KINDS, setCurrentOption } from '../../api/settings-api.js';
import { ApiError, isAbortError, toUserMessage } from '../../core/errors.js';
import { createLogger } from '../../core/logger.js';
import { getPreference, setPreference } from '../../core/preferences.js';
import { prefersReducedMotion } from '../../utils/dom.js';
import { createDrawer } from '../ui/drawer.js';
import { createDropdown } from '../ui/dropdown.js';
import { refs } from '../ui/refs.js';
import { showToast } from '../ui/toast.js';

const log = createLogger('settings');

const GROUP_SELECTORS = Object.freeze({
    theme: '#theme-group',
    model: '#model-group',
    embedding: '#embedding-group',
    tone: '#tone-grid'
});

const OPTION_LABELS = Object.freeze({ model: 'model', tone: 'response style', embedding: 'embedding model' });

let toneDropdown = null;

function groupElement(kind) {
    return document.querySelector(GROUP_SELECTORS[kind]);
}

function paintSelection(kind, value) {
    const group = groupElement(kind);
    const items = [...group.querySelectorAll('[data-value]')];

    items.forEach((item, index) => {
        const active = item.dataset.value === value;
        item.classList.toggle('active', active);
        item.setAttribute('aria-checked', String(active));
        if (active && group.classList.contains('segmented')) group.style.setProperty('--index', String(index));
    });
}

function setGroupBusy(kind, busy) {
    const group = groupElement(kind);
    group.classList.toggle('is-busy', busy);
    group.querySelectorAll('[data-value]').forEach((item) => {
        item.disabled = busy;
    });
}

function applyTheme(theme, { animate }) {
    const apply = () => document.documentElement.setAttribute('data-theme', theme);

    if (animate && !prefersReducedMotion() && typeof document.startViewTransition === 'function') {
        document.startViewTransition(apply);
    } else {
        apply();
    }
}

function applySelection(kind, value, { animate = false } = {}) {
    setPreference(kind, value);
    paintSelection(kind, value);
    if (kind === 'theme') applyTheme(value, { animate });
}

async function syncOption(kind, value, previous) {
    setGroupBusy(kind, true);
    try {
        await setCurrentOption(kind, value);
    } catch (error) {
        if (isAbortError(error)) return;
        log.warn(`${kind}_sync_failed`, { value, error });

        if (error instanceof ApiError && error.isServerResponse) {
            applySelection(kind, previous);
            showToast(`Couldn't switch ${OPTION_LABELS[kind]}: ${error.message}`, { type: 'error' });
        } else {
            showToast(`${toUserMessage(error)} Your choice will apply once the server is reachable.`, { type: 'warning' });
        }
    } finally {
        setGroupBusy(kind, false);
    }
}

async function selectOption(kind, value) {
    const previous = getPreference(kind);
    if (previous === value) return;

    applySelection(kind, value, { animate: true });
    log.info(`${kind}_switched`, { from: previous, to: value });

    if (kind !== 'theme') await syncOption(kind, value, previous);
}

export async function syncAllSettings() {
    const results = await Promise.allSettled(
        BACKEND_OPTION_KINDS.map((kind) => setCurrentOption(kind, getPreference(kind)))
    );

    results.forEach((result, index) => {
        if (result.status === 'fulfilled') return;
        const kind = BACKEND_OPTION_KINDS[index];
        log.warn(`${kind}_startup_sync_failed`, { error: result.reason });
    });

    const rejected = results.find((result) => result.status === 'rejected' && result.reason?.isServerResponse);
    if (rejected) {
        showToast(`Some settings couldn't be applied: ${rejected.reason.message}`, { type: 'warning' });
    }
}

export function reconcileSettings(active) {
    if (!active) return;

    for (const kind of BACKEND_OPTION_KINDS) {
        const preferred = getPreference(kind);
        if (active[kind] === preferred) continue;

        log.info('settings_reconciling', { kind, preferred, active: active[kind] ?? null });
        setCurrentOption(kind, preferred).catch((error) => log.warn(`${kind}_reconcile_failed`, { error }));
    }
}

export function initSettings() {
    refs.appVersion.textContent = `v${chrome.runtime.getManifest().version}`;

    for (const kind of Object.keys(GROUP_SELECTORS)) {
        paintSelection(kind, getPreference(kind));
        groupElement(kind).addEventListener('click', (event) => {
            const item = event.target.closest('[data-value]');
            if (!item || item.disabled) return;
            selectOption(kind, item.dataset.value);
            if (kind === 'tone') toneDropdown.close();
        });
    }

    const settingsDrawer = createDrawer({ drawer: refs.settingsDrawer, overlay: refs.settingsOverlay });
    refs.settingsBtn.addEventListener('click', settingsDrawer.open);
    refs.settingsCloseBtn.addEventListener('click', settingsDrawer.close);

    toneDropdown = createDropdown({ button: refs.toneBtn, panel: refs.toneDropdown });
}
