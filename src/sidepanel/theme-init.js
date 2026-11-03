(function applyStoredTheme() {
    try {
        const theme = localStorage.getItem('wp-theme');
        if (theme === 'light' || theme === 'dark') {
            document.documentElement.setAttribute('data-theme', theme);
        }
    } catch {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
})();
