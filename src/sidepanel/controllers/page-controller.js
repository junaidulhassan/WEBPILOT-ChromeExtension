import { processPage } from '../../api/pages-api.js';
import { PLACEHOLDER_TEXT } from '../../core/constants.js';
import { isAbortError, toUserMessage } from '../../core/errors.js';
import { createLogger } from '../../core/logger.js';
import { getAllConversations, getTabMap } from '../../storage/conversation-store.js';
import { extractPageText } from '../../tabs/page-extractor.js';
import { queryActiveTab, watchActiveTab } from '../../tabs/tab-watcher.js';
import { createConversation, toBackendHistory } from '../../utils/conversation.js';
import { detectSourceType, isUnsupportedUrl } from '../../utils/source.js';
import { appendError, clearMessages, renderConversation } from '../ui/chat-view.js';
import { lockComposer, unlockComposer } from '../ui/composer.js';
import { showToast } from '../ui/toast.js';
import { renderUrlBar } from '../ui/url-bar.js';
import { state } from '../state.js';
import { stopGeneration } from './chat-controller.js';
import { beginLoad, cancelLoads } from './load-session.js';
import { reconcileSettings } from './settings-controller.js';

const log = createLogger('page');

const UNSUPPORTED_PAGE_MESSAGE = "This tab can't be analysed. Please open a website, PDF, or YouTube video.";

export function showLoadFailure(error, { onRetry } = {}) {
    const message = toUserMessage(error);
    appendError(message, { onRetry });
    lockComposer(PLACEHOLDER_TEXT.unavailable);
    return message;
}

function showUnsupportedPage(url) {
    log.warn('page_unsupported', { url });
    state.conversation = null;
    clearMessages();
    appendError(UNSUPPORTED_PAGE_MESSAGE);
    lockComposer(PLACEHOLDER_TEXT.unavailable);
}

export function handleProcessed(result, { url, sourceType, resuming }) {
    state.pageReady = true;
    log.info('page_process_success', { url, sourceType, resuming, chunks: result.chunk_count });

    if (result.warning) showToast(result.warning, { type: 'warning' });
    reconcileSettings(result.active);
    unlockComposer({ focus: true });
}

function showNoActiveTab() {
    log.warn('page_no_active_tab');
    state.conversation = null;
    clearMessages();
    appendError("Couldn't find the active tab. Click on a web page and try again.", { onRetry: () => processTab() });
    lockComposer(PLACEHOLDER_TEXT.unavailable);
}

function restoreOrCreateConversation(target, sourceType, existing) {
    const resuming = Boolean(existing) && existing.url === target.url;
    state.conversation = resuming ? existing : createConversation(target, sourceType);

    try {
        renderConversation(state.conversation);
        return resuming;
    } catch (error) {
        log.error('conversation_render_failed', { id: state.conversation.id, error });
        state.conversation = createConversation(target, sourceType);
        renderConversation(state.conversation);
        showToast("A saved conversation for this page couldn't be displayed, so a new chat was started.", { type: 'warning' });
        return false;
    }
}

async function runProcessTab(tab) {
    const target = tab ?? (await queryActiveTab());
    if (!target) {
        cancelLoads();
        showNoActiveTab();
        return;
    }

    stopGeneration();
    cancelLoads();
    state.tab = target;
    renderUrlBar(target);

    if (isUnsupportedUrl(target.url)) {
        showUnsupportedPage(target.url);
        return;
    }

    const { url } = target;
    const sourceType = detectSourceType(url);
    log.info('page_process_start', { url, sourceType });

    const [tabMap, conversations] = await Promise.all([getTabMap(), getAllConversations()]);
    const resuming = restoreOrCreateConversation(target, sourceType, conversations[tabMap[target.id]]);

    const load = beginLoad(PLACEHOLDER_TEXT.loadingPage);
    try {
        const text = await extractPageText(target.id, sourceType);
        if (!load.isCurrent()) return;

        await state.settingsReady;
        if (!load.isCurrent()) return;

        const history = resuming ? toBackendHistory(state.conversation.messages) : [];
        const result = await processPage({ url, text, history }, { signal: load.signal });
        if (!load.isCurrent()) return;

        handleProcessed(result, { url, sourceType, resuming });
    } catch (error) {
        if (!load.isCurrent() || isAbortError(error)) return;
        log.error('page_process_failed', { url, sourceType, error });
        showLoadFailure(error, { onRetry: () => processTab(state.tab) });
    } finally {
        load.finish();
    }
}

export async function processTab(tab) {
    try {
        await runProcessTab(tab);
    } catch (error) {
        log.error('process_tab_crashed', { error });
        cancelLoads();
        clearMessages();
        showLoadFailure(error, { onRetry: () => processTab() });
    }
}

export async function handleTabChange(tab) {
    if (!tab?.url) return;
    if (state.tab?.id === tab.id && state.tab.url === tab.url) return;
    await processTab(tab);
}

export function startTabTracking() {
    watchActiveTab(handleTabChange);
}
