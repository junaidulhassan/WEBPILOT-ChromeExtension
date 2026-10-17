const HTML_ESCAPES = Object.freeze({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' });

const STASH_OPEN = '';
const STASH_CLOSE = '';
const STASH_PATTERN = new RegExp(`${STASH_OPEN}(\\d+)${STASH_CLOSE}`, 'g');
const BLOCK_STASH_LINE = new RegExp(`^${STASH_OPEN}(\\d+)${STASH_CLOSE}$`);

const HEADING_PATTERN = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const RULE_PATTERN = /^\s*([-*_])(\s*\1){2,}\s*$/;
const UNORDERED_ITEM_PATTERN = /^\s*[-*+]\s+(.+)$/;
const ORDERED_ITEM_PATTERN = /^\s*\d+[.)]\s+(.+)$/;

export function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

function createStash() {
    const entries = [];
    return {
        add(html) {
            entries.push(html);
            return `${STASH_OPEN}${entries.length - 1}${STASH_CLOSE}`;
        },
        get(index) {
            return entries[Number(index)];
        },
        restore(html) {
            return html.replace(STASH_PATTERN, (_, index) => entries[Number(index)]);
        }
    };
}

function renderInline(text) {
    return text
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![*\w])/g, '$1<em>$2</em>')
        .replace(
            /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
            '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
        );
}

function stashCode(escaped, stash) {
    return escaped
        .replace(/```[\w+-]*[ \t]*\n?([\s\S]*?)(?:```|$)/g, (_, code) =>
            `\n${stash.add(`<pre><code>${code.replace(/\n$/, '')}</code></pre>`)}\n`
        )
        .replace(/`([^`\n]+)`/g, (_, code) => stash.add(`<code>${code}</code>`));
}

export function renderMarkdown(source) {
    const stash = createStash();
    const lines = stashCode(escapeHtml(source), stash).split('\n');

    const blocks = [];
    let paragraph = [];
    let list = null;

    const flushParagraph = () => {
        if (!paragraph.length) return;
        blocks.push(`<p>${renderInline(paragraph.join('<br>'))}</p>`);
        paragraph = [];
    };

    const flushList = () => {
        if (!list) return;
        const items = list.items.map((item) => `<li>${renderInline(item)}</li>`).join('');
        blocks.push(`<${list.tag}>${items}</${list.tag}>`);
        list = null;
    };

    const flushAll = () => {
        flushParagraph();
        flushList();
    };

    const pushListItem = (tag, item) => {
        flushParagraph();
        if (list && list.tag !== tag) flushList();
        list ??= { tag, items: [] };
        list.items.push(item);
    };

    for (const line of lines) {
        const trimmed = line.trim();
        let match;

        if (!trimmed) {
            flushAll();
        } else if ((match = trimmed.match(BLOCK_STASH_LINE)) && stash.get(match[1]).startsWith('<pre>')) {
            flushAll();
            blocks.push(stash.get(match[1]));
        } else if ((match = trimmed.match(HEADING_PATTERN))) {
            flushAll();
            const level = match[1].length;
            blocks.push(`<h${level}>${renderInline(match[2])}</h${level}>`);
        } else if (RULE_PATTERN.test(trimmed)) {
            flushAll();
            blocks.push('<hr>');
        } else if ((match = line.match(UNORDERED_ITEM_PATTERN))) {
            pushListItem('ul', match[1]);
        } else if ((match = line.match(ORDERED_ITEM_PATTERN))) {
            pushListItem('ol', match[1]);
        } else {
            flushList();
            paragraph.push(trimmed);
        }
    }

    flushAll();
    return stash.restore(blocks.join(''));
}
