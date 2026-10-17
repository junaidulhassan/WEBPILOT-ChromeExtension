const DEFAULT_TIMEOUT_MS = 3000;

export function bindConfirmClick(button, onConfirm, { armedLabel, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    const labelElement = button.querySelector('.confirm-label');
    const idleLabel = labelElement?.textContent ?? '';
    let timer = null;

    function disarm() {
        clearTimeout(timer);
        timer = null;
        button.classList.remove('is-armed');
        if (labelElement) labelElement.textContent = idleLabel;
    }

    function arm() {
        button.classList.add('is-armed');
        if (labelElement && armedLabel) labelElement.textContent = armedLabel;
        timer = setTimeout(disarm, timeoutMs);
    }

    button.addEventListener('click', (event) => {
        event.stopPropagation();
        if (!button.classList.contains('is-armed')) {
            arm();
            return;
        }
        disarm();
        onConfirm();
    });

    button.addEventListener('blur', disarm);
}
