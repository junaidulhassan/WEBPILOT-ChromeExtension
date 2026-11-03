import { SOURCE_TYPES } from '../core/constants.js';
import { PageExtractionError } from '../core/errors.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('extractor');

const PLACEHOLDER_TEXT = Object.freeze({
    [SOURCE_TYPES.pdf]: 'PDF file',
    [SOURCE_TYPES.youtube]: 'YouTube video'
});

function readBodyText() {
    return document.body?.innerText ?? '';
}

export async function extractPageText(tabId, sourceType) {
    const placeholder = PLACEHOLDER_TEXT[sourceType];
    if (placeholder) return placeholder;

    let text = '';
    try {
        const [result] = await chrome.scripting.executeScript({ target: { tabId }, func: readBodyText });
        text = result?.result ?? '';
    } catch (error) {
        log.error('extraction_failed', { tabId, sourceType, error });
        throw new PageExtractionError(
            "Couldn't read this page's content. Try reloading the tab, or check the extension's site access in chrome://extensions.",
            { cause: error }
        );
    }

    if (!text.trim()) {
        log.warn('extraction_empty', { tabId });
        throw new PageExtractionError('This page has no readable text to chat about.');
    }

    return text;
}
