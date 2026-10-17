import { PLACEHOLDER_TEXT } from '../core/constants.js';
import { createLogger, flushLogs } from '../core/logger.js';
import { onStorageDegraded } from '../storage/chrome-storage.js';
import { queryActiveTab } from '../tabs/tab-watcher.js';
import { startNewChat, sendMessage, stopGeneration } from './controllers/chat-controller.js';
import { initHistory } from './controllers/history-controller.js';
import { cancelLoads } from './controllers/load-session.js';
import { processTab, showLoadFailure, startTabTracking } from './controllers/page-controller.js';
import { initSettings, syncAllSettings } from './controllers/settings-controller.js';
import { renderConversation, clearMessages } from './ui/chat-view.js';
import { initComposer, lockComposer } from './ui/composer.js';
import { initDismissables } from './ui/dismissables.js';
import { showToast } from './ui/toast.js';
import { refs } from './ui/refs.js';
import { initScroll } from './ui/scroll.js';
import { state } from './state.js';
import { setBrandSpinning, setUrlLoading } from './ui/url-bar.js';

const log = createLogger('sidepanel');

window.addEventListener('error', (event) => {
    log.error('uncaught_error', { message: event.message, source: event.filename, line: event.lineno });
});

window.addEventListener('unhandledrejection', (event) => {
    log.error('unhandled_rejection', { reason: event.reason });
});

window.addEventListener('pagehide', () => {
    flushLogs();
});

function showStartupFailure(error) {
    cancelLoads();
    clearMessages();
    showLoadFailure(error, { onRetry: () => processTab() });
}

async function bootstrap() {
    log.info('sidepanel_opened');

    onStorageDegraded(() =>
        showToast(
            "Browser storage isn't working, so chats won't be saved. Fully quit and reopen the browser to fix it.",
            { type: 'warning', duration: 12000 }
        )
    );

    initDismissables();
    initScroll();
    initComposer({ onSend: sendMessage, onStop: stopGeneration });
    initSettings();
    initHistory();

    refs.closePanelBtn.addEventListener('click', () => {
        log.info('sidepanel_closed_by_user');
        flushLogs();
        window.close();
    });
    refs.clearChatBtn.addEventListener('click', () => startNewChat({ reloadPage: processTab }));

    renderConversation({ messages: [] });
    lockComposer(PLACEHOLDER_TEXT.loadingPage);
    setBrandSpinning(true);
    setUrlLoading(true);

    state.settingsReady = syncAllSettings().catch((error) => log.error('settings_sync_crashed', { error }));

    const tab = await queryActiveTab();
    startTabTracking();
    await processTab(tab);
}

bootstrap().catch((error) => {
    log.error('bootstrap_failed', { error });
    showStartupFailure(error);
});
