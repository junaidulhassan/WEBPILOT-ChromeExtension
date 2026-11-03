export const state = {
    tab: null,
    conversation: null,
    pageReady: false,
    isLoading: false,
    isGenerating: false,
    loadToken: 0,
    loadAbort: null,
    chatAbort: null,
    settingsReady: Promise.resolve()
};
