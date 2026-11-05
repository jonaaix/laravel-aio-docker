const HIGHLIGHT_NAME = 'speech-current';
const BLOCKS = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, td';
const PROBE_LENGTH = 24;
const WORD_CHARACTER = /[\p{L}\p{N}]/u;

interface TextMap {
    text: string;
    points: { node: Text; offset: number }[];
}

function normalize(text: string): string {
    return [...text.toLowerCase()].filter(char => WORD_CHARACTER.test(char)).join('');
}

function textMap(root: Element): TextMap {
    const map: TextMap = { text: '', points: [] };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
        const value = node.data;
        for (let offset = 0; offset < value.length; offset++) {
            for (const char of value[offset]!.toLowerCase()) {
                if (WORD_CHARACTER.test(char)) {
                    map.text += char;
                    map.points.push({ node, offset });
                }
            }
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

function blockOf(node: Node): Element | null {
    return (node instanceof Element ? node : node.parentElement)?.closest(BLOCKS) ?? null;
}

function wholeBlocks(range: Range): Range {
    const first = blockOf(range.startContainer);
    const last = blockOf(range.endContainer);
    const widened = range.cloneRange();
    if (first) {
        widened.setStartBefore(first);
    }
    if (last) {
        widened.setEndAfter(last);
    }
    return widened;
}

function messageRoot(messageId: string): Element | null {
    return document.querySelector(`[data-read-along="${CSS.escape(messageId)}"]`);
}

let revealPending = false;

function readingTarget(messageId: string, passage: string | undefined): Element | null {
    const root = messageRoot(messageId);
    if (!root) {
        return null;
    }
    const range = passage ? rangeFor(textMap(root), passage) : null;
    return (range ? blockOf(range.startContainer) : null) ?? root.closest('article');
}

export function useReadAlong() {
    const { speakingId, paused, chunkTexts, currentChunk, jumpTo } = useSpeechPlayer();
    const playingId = computed(() => paused.value ? null : speakingId.value);
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
            CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(wholeBlocks(range)));
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
        if (playingId.value !== messageId || !getSelection()?.isCollapsed) {
            return;
        }
        const target = event.target as Element;
        const block = target.closest(BLOCKS);
        if (!block || target.closest('a, button, pre')) {
            return;
        }
        const root = messageRoot(messageId);
        if (!root) {
            return;
        }
        const map = textMap(root);
        const blockStart = map.points.findIndex(point => block.contains(point.node));
        if (blockStart < 0) {
            return;
        }
        let searchFrom = 0;
        let jumpIndex = -1;
        chunkTexts.value.forEach((chunk, index) => {
            const start = map.text.indexOf(normalize(chunk).slice(0, PROBE_LENGTH), searchFrom);
            if (start < 0) {
                return;
            }
            searchFrom = start + 1;
            if (start <= blockStart) {
                jumpIndex = index;
            }
        });
        if (jumpIndex >= 0) {
            jumpTo(jumpIndex);
        }
    }

    function reveal(): boolean {
        const target = speakingId.value ? readingTarget(speakingId.value, chunkTexts.value[currentChunk.value]) : null;
        target?.scrollIntoView({ block: 'center', behavior: 'instant' });
        return target !== null;
    }

    function requestReveal(): void {
        revealPending = true;
    }

    function revealIfRequested(beforeScroll: () => void): void {
        if (!revealPending) {
            return;
        }
        revealPending = false;
        beforeScroll();
        reveal();
    }

    return { follow, mark, jumpToClicked, playingId, reveal, requestReveal, revealIfRequested };
}
