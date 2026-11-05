const HIGHLIGHT_NAME = 'speech-current';
const BLOCKS = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, td';
const PROBE_LENGTH = 32;

interface TextMap {
    text: string;
    points: { node: Text; offset: number }[];
}

function normalize(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

function textMap(root: Element): TextMap {
    const map: TextMap = { text: '', points: [] };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
        const value = node.data;
        for (let offset = 0; offset < value.length; offset++) {
            const char = value[offset]!;
            const space = /\s/.test(char);
            if (space && (map.text === '' || map.text.endsWith(' '))) {
                continue;
            }
            map.text += space ? ' ' : char;
            map.points.push({ node, offset });
        }
    }
    return map;
}

function rangeFor(map: TextMap, passage: string): Range | null {
    const target = normalize(passage);
    const start = map.text.indexOf(target.slice(0, PROBE_LENGTH));
    if (start < 0) {
        return null;
    }
    const tail = target.slice(-PROBE_LENGTH);
    const tailAt = map.text.indexOf(tail, start);
    const end = Math.min(map.points.length, tailAt < 0 ? start + target.length : tailAt + tail.length);
    const first = map.points[start]!;
    const last = map.points[end - 1]!;
    const range = document.createRange();
    range.setStart(first.node, first.offset);
    range.setEnd(last.node, last.offset + 1);
    return range;
}

function messageRoot(messageId: string): Element | null {
    return document.querySelector(`[data-read-along="${CSS.escape(messageId)}"]`);
}

export function useReadAlong() {
    const { speakingId, chunkTexts, currentChunk, jumpTo } = useSpeechPlayer();
    const supported = import.meta.client && 'highlights' in CSS;

    function clear(): void {
        if (supported) {
            CSS.highlights.delete(HIGHLIGHT_NAME);
        }
    }

    function mark(): void {
        const root = speakingId.value ? messageRoot(speakingId.value) : null;
        const passage = chunkTexts.value[currentChunk.value];
        if (!supported || !root || !passage) {
            clear();
            return;
        }
        const range = rangeFor(textMap(root), passage);
        if (range) {
            CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(range));
        }
        else {
            clear();
        }
    }

    function follow(): void {
        watch([speakingId, currentChunk, chunkTexts], mark, { flush: 'post', immediate: true });
        onBeforeUnmount(clear);
    }

    function jumpToClicked(event: MouseEvent, messageId: string): void {
        if (speakingId.value !== messageId || !getSelection()?.isCollapsed) {
            return;
        }
        const target = event.target as Element;
        const block = target.closest(BLOCKS);
        if (!block || target.closest('a, button, pre')) {
            return;
        }
        const probe = normalize(block.textContent ?? '').slice(0, PROBE_LENGTH);
        const index = chunkTexts.value.findIndex(chunk => normalize(chunk).includes(probe));
        if (probe && index >= 0) {
            jumpTo(index);
        }
    }

    return { follow, mark, jumpToClicked, readingId: speakingId };
}
