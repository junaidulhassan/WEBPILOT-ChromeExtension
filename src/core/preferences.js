import { PREFERENCE_DEFAULTS, PREFERENCE_KEYS } from './constants.js';

const LEGACY_VALUES = Object.freeze({
    model: Object.freeze({ 'llama-3.3-70b-versatile': 'gpt-oss-120b' })
});

export function getPreference(name) {
    try {
        const stored = localStorage.getItem(PREFERENCE_KEYS[name]);
        return LEGACY_VALUES[name]?.[stored] ?? (stored || PREFERENCE_DEFAULTS[name]);
    } catch {
        return PREFERENCE_DEFAULTS[name];
    }
}

export function setPreference(name, value) {
    try {
        localStorage.setItem(PREFERENCE_KEYS[name], value);
    } catch {
        return false;
    }
    return true;
}
