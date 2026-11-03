import { resetChatMemory, streamAnswer } from '../../api/chat-api.js';
import { MESSAGE_ROLES } from '../../core/constants.js';
import { isAbortError, toUserMessage } from '../../core/errors.js';
import { createLogger } from '../../core/logger.js';
import { getPreference } from '../../core/preferences.js';
import { saveConversation, setTabConversation } from '../../storage/conversation-store.js';
import { appendMessage, createConversation } from '../../utils/conversation.js';
import { detectSourceType, isUnsupportedUrl } from '../../utils/source.js';
import { appendBotMessage, appendError, appendUserMessage, renderConversation } from '../ui/chat-view.js';
import { clearComposer, getComposerValue, setGenerating } from '../ui/composer.js';
import { addMessageActions, setMarkdown, showThinking } from '../ui/messages.js';
import { scrollToBottom } from '../ui/scroll.js';
import { showToast } from '../ui/toast.js';
import { setBrandSpinning } from '../ui/url-bar.js';
import { state } from '../state.js';

const log = createLogger('chat');

const EMPTY_ANSWER_MESSAGE = "Sorry, I couldn't generate a response. Please try again.";

function createRenderScheduler(messageElement) {
    let frame = null;
    let latest = '';

    const paint = () => {
        frame = null;
        setMarkdown(messageElement, latest);
        scrollToBottom();
    };

    return {
        update(text) {
            latest = text;
            if (frame === null) frame = requestAnimationFrame(paint);
        },
        cancel() {
            if (frame !== null) cancelAnimationFrame(frame);
            frame = null;
        }
    };
}

async function collectStream(question, messageElement, signal) {
    const scheduler = createRenderScheduler(messageElement);
    let answer = '';
    let failure = null;

    try {
        for await (const piece of streamAnswer(question, { signal })) {
            answer += piece;
            scheduler.update(answer);
        }
    } catch (error) {
        failure = error;
    } finally {
        scheduler.cancel();
    }

    return { answer: answer.trim(), failure };
}

async function persist(conversation, tab) {
    try {
        await saveConversation(conversation);
        if (tab) await setTabConversation(tab.id, conversation.id);
    } catch (error) {
        log.error('conversation_persist_failed', { id: conversation.id, error });
        showToast("Couldn't save this conversation. Browser storage may be full.", { type: 'error' });
    }
}

export function stopGeneration() {
    state.chatAbort?.abort();
}

export async function sendMessage() {
    const question = getComposerValue();
    const { conversation, tab } = state;
    if (!question || state.isGenerating) return;

    if (state.isLoading) {
        showToast('Still loading this page. One moment…', { type: 'info' });
        return;
    }

    if (!conversation || !state.pageReady) {
        showToast('Open a website, PDF or YouTube video to start chatting.', { type: 'warning' });
        return;
    }

    const isVisible = () => state.conversation === conversation;
    const controller = new AbortController();
    state.chatAbort = controller;
    state.isGenerating = true;

    appendUserMessage(question);
    appendMessage(conversation, MESSAGE_ROLES.user, question);
    log.info('message_sent', { length: question.length, model: getPreference('model'), tone: getPreference('tone') });

    clearComposer();
    setGenerating(true);
    setBrandSpinning(true);

    const botElement = appendBotMessage();
    showThinking(botElement);

    const startedAt = performance.now();
    const { answer, failure } = await collectStream(question, botElement, controller.signal);

    try {
        if (!failure && answer) {
            setMarkdown(botElement, answer);
            addMessageActions(botElement, answer);
            appendMessage(conversation, MESSAGE_ROLES.assistant, answer);
            log.info('message_response_success', {
                responseLength: answer.length,
                durationMs: Math.round(performance.now() - startedAt)
            });
        } else if (!failure) {
            botElement.remove();
            if (isVisible()) appendError(EMPTY_ANSWER_MESSAGE);
            appendMessage(conversation, MESSAGE_ROLES.error, EMPTY_ANSWER_MESSAGE);
            log.warn('message_response_empty');
        } else if (isAbortError(failure)) {
            log.info('message_generation_stopped', { partialLength: answer.length });
            if (answer) {
                setMarkdown(botElement, answer);
                addMessageActions(botElement, answer);
                appendMessage(conversation, MESSAGE_ROLES.assistant, answer);
            } else {
                botElement.remove();
            }
        } else {
            log.error('message_response_failed', { partialLength: answer.length, error: failure });
            const message = toUserMessage(failure, 'Error retrieving response. Please check your connection.');

            if (answer) {
                setMarkdown(botElement, answer);
                addMessageActions(botElement, answer);
                appendMessage(conversation, MESSAGE_ROLES.assistant, answer);
                showToast(message, { type: 'error' });
            } else {
                botElement.remove();
                if (isVisible()) appendError(message);
                appendMessage(conversation, MESSAGE_ROLES.error, message);
            }
        }
    } finally {
        state.isGenerating = false;
        state.chatAbort = null;
        setGenerating(false);
        if (!state.isLoading) setBrandSpinning(false);
        if (isVisible()) scrollToBottom();
        await persist(conversation, tab);
    }
}

export async function startNewChat({ reloadPage }) {
    const { tab } = state;
    if (!tab || state.isLoading) return;

    if (!state.pageReady || isUnsupportedUrl(tab.url)) {
        await reloadPage(tab);
        return;
    }

    stopGeneration();
    state.conversation = createConversation(tab, detectSourceType(tab.url));
    renderConversation(state.conversation);
    log.info('new_chat_started', { url: tab.url });

    resetChatMemory().catch((error) => log.warn('memory_reset_failed', { error }));
}
