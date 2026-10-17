import { processPage } from '../../api/pages-api.js';
import { PLACEHOLDER_TEXT, SOURCE_TYPES } from '../../core/constants.js';
import { isAbortError, toUserMessage } from '../../core/errors.js';
import { createLogger } from '../../core/logger.js';
import {
    clearAllConversations,
    deleteConversation,
    getAllConversations,
    getConversation,
    setTabConversation
} from '../../storage/conversation-store.js';
import { extractPageText } from '../../tabs/page-extractor.js';
import { findOpenTabByUrl } from '../../tabs/tab-watcher.js';
import { toBackendHistory } from '../../utils/conversation.js';
import { hostnameOf } from '../../utils/source.js';
import { renderConversation } from '../ui/chat-view.js';
import { bindConfirmClick } from '../ui/confirm.js';
import { lockComposer } from '../ui/composer.js';
import { createDrawer } from '../ui/drawer.js';
import { renderHistoryList } from '../ui/history-list.js';
import { refs } from '../ui/refs.js';
import { showToast } from '../ui/toast.js';
import { renderUrlBar } from '../ui/url-bar.js';
import { state } from '../state.js';
import { stopGeneration } from './chat-controller.js';
import { beginLoad } from './load-session.js';
import { handleProcessed } from './page-controller.js';

const log = createLogger('history');

let drawer = null;

async function refreshList() {
    renderHistoryList(await getAllConversations(), {
        onOpen: openConversation,
        onDelete: removeConversation
    });
}

async function removeConversation(id) {
    await deleteConversation(id);
    log.info('conversation_deleted', { id });
}

async function resolveSourceText(conversation) {
    if (conversation.sourceType !== SOURCE_TYPES.website) {
        return extractPageText(null, conversation.sourceType);
    }

    const openTab = await findOpenTabByUrl(conversation.url);
    return openTab ? extractPageText(openTab.id, conversation.sourceType) : null;
}

async function openConversation(id) {
    const conversation = await getConversation(id);
    if (!conversation) {
        showToast('That conversation no longer exists.', { type: 'warning' });
        await refreshList();
        return;
    }

    log.info('conversation_opened', { id, sourceType: conversation.sourceType });
    drawer.close();
    stopGeneration();

    state.conversation = conversation;
    renderUrlBar(conversation);
    renderConversation(conversation);

    if (state.tab) await setTabConversation(state.tab.id, conversation.id);

    const load = beginLoad(PLACEHOLDER_TEXT.reloading);
    try {
        const text = await resolveSourceText(conversation);
        if (!load.isCurrent()) return;

        if (text === null) {
            lockComposer(`Open ${hostnameOf(conversation.url)} in a tab to continue this conversation`);
            return;
        }

        const result = await processPage(
            { url: conversation.url, text, history: toBackendHistory(conversation.messages) },
            { signal: load.signal }
        );
        if (!load.isCurrent()) return;

        handleProcessed(result, { url: conversation.url, sourceType: conversation.sourceType, resuming: true });
    } catch (error) {
        if (!load.isCurrent() || isAbortError(error)) return;
        log.error('history_reload_failed', { id, error });
        showToast(toUserMessage(error), { type: 'error' });
        lockComposer("Could not reload this conversation's content.");
    } finally {
        load.finish();
    }
}

export function initHistory() {
    drawer = createDrawer({
        drawer: refs.historyDrawer,
        overlay: refs.historyOverlay,
        onOpen: () => {
            refreshList().catch((error) => {
                log.error('history_render_failed', { error });
                showToast("Couldn't load your saved conversations.", { type: 'error' });
            });
        }
    });

    refs.historyBtn.addEventListener('click', drawer.open);
    refs.historyCloseBtn.addEventListener('click', drawer.close);

    bindConfirmClick(
        refs.historyClearAllBtn,
        async () => {
            await clearAllConversations();
            log.info('history_cleared_all');
            await refreshList();
            showToast('All conversations cleared.', { type: 'success' });
        },
        { armedLabel: 'Click again to confirm' }
    );
}

