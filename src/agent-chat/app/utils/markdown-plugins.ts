import breaks from '@comark/nuxt/plugins/breaks';
import { visit } from '@comark/nuxt/utils';
import { markTone } from './mark-tones';

const EXTERNAL_LINK = /^https?:\/\//i;

const externalLinksInNewTab = {
    name: 'external-links-in-new-tab',
    post(state: { tree: Parameters<typeof visit>[0] }) {
        visit(state.tree, node => Array.isArray(node) && node[0] === 'a', (node) => {
            const attributes = (node as [string, Record<string, unknown>])[1];
            if (typeof attributes.href === 'string' && EXTERNAL_LINK.test(attributes.href)) {
                attributes.target = '_blank';
                attributes.rel = 'noopener noreferrer';
            }
        });
    },
};

type MarkdownDocument = Parameters<typeof visit>[0];
type MarkdownNode = MarkdownDocument['nodes'][number];

const MENTION_CLASS = 'rounded-md bg-info/10 px-1 py-px font-medium text-(--ui-color-info-800) dark:text-info';
const UNMARKED_TAGS = new Set(['a', 'code', 'pre']);

function escapeName(name: string): string {
    return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitMentions(text: string, pattern: RegExp): MarkdownNode[] {
    const pieces: MarkdownNode[] = [];
    let last = 0;
    for (const match of text.matchAll(pattern)) {
        if (match.index > last) {
            pieces.push(text.slice(last, match.index));
        }
        pieces.push(['span', { class: MENTION_CLASS }, match[0]]);
        last = match.index + match[0].length;
    }
    if (last < text.length) {
        pieces.push(text.slice(last));
    }
    return pieces;
}

function markMentions(children: MarkdownNode[], start: number, pattern: RegExp): void {
    for (let index = start; index < children.length; index++) {
        const child = children[index]!;
        if (typeof child === 'string') {
            const pieces = splitMentions(child, pattern);
            children.splice(index, 1, ...pieces);
            index += pieces.length - 1;
        }
        else if (typeof child[0] === 'string' && !UNMARKED_TAGS.has(child[0])) {
            markMentions(child as unknown as MarkdownNode[], 2, pattern);
        }
    }
}

export function mentionHighlight(names: () => string[]) {
    return {
        name: 'mention-highlight',
        post(state: { tree: MarkdownDocument }) {
            const alternatives = [...new Set(names().filter(Boolean))].sort((a, b) => b.length - a.length).map(escapeName);
            if (alternatives.length > 0) {
                markMentions(state.tree.nodes, 0, new RegExp(`@(?:${alternatives.join('|')})(?![\\p{L}\\p{N}_-])`, 'giu'));
            }
        },
    };
}

function isHighlightable(node: unknown): boolean {
    if (!Array.isArray(node)) {
        return false;
    }
    const attributes = (node[1] ?? {}) as Record<string, unknown>;
    return node[0] === 'pre' || (node[0] === 'code' && Boolean(attributes.lang ?? attributes.language));
}

function hasHighlightableCode(tree: MarkdownDocument): boolean {
    let found = false;
    visit(tree, isHighlightable, () => {
        found = true;
    });
    return found;
}

function codeBlockAttributes(tree: MarkdownDocument): Record<string, unknown>[] {
    const blocks: Record<string, unknown>[] = [];
    visit(tree, node => Array.isArray(node) && node[0] === 'pre', (node) => {
        blocks.push(((node as unknown[])[1] ?? {}) as Record<string, unknown>);
    });
    return blocks;
}

const lazyHighlight = {
    name: 'shiki',
    async post(state: { tree: MarkdownDocument }) {
        if (!hasHighlightableCode(state.tree)) {
            return;
        }
        const [{ getHighlighter, highlightCodeBlocks }, { codeLanguages, codeThemes }, { BASIC_LANGUAGE, grammarsFor, resolveLanguage }] = await Promise.all([
            import('@comark/nuxt/plugins/shiki'),
            import('./code-languages'),
            import('./code-highlight'),
        ]);
        const blocks = codeBlockAttributes(state.tree);
        for (const attributes of blocks) {
            attributes.language = (typeof attributes.language === 'string' ? resolveLanguage(attributes.language) : null) ?? BASIC_LANGUAGE;
        }
        const options = {
            preStyles: false,
            registerDefaultThemes: false,
            themes: codeThemes,
            languages: [...codeLanguages, ...await grammarsFor(blocks.map(attributes => attributes.language as string))],
        };
        // A highlighter still being created is handed out without this call's languages; the second request loads them.
        await getHighlighter(options);
        state.tree = await highlightCodeBlocks(state.tree, options);
    },
};

const TONED_BLOCK = 'my-3 rounded-lg px-4 py-3';

function paragraphTone(node: unknown): string | null {
    const first = Array.isArray(node) && node[0] === 'p' ? node[2] : undefined;
    return typeof first === 'string' ? markTone(first) : null;
}

const tonedParagraphs = {
    name: 'toned-paragraphs',
    post(state: { tree: MarkdownDocument }) {
        visit(state.tree, node => paragraphTone(node) !== null, (node) => {
            const toned = `${TONED_BLOCK} ${paragraphTone(node)}`;
            const attributes = ((node as unknown[])[1] ?? {}) as Record<string, unknown>;
            attributes.class = typeof attributes.class === 'string' ? `${attributes.class} ${toned}` : toned;
            (node as unknown[])[1] = attributes;
        });
    },
};

export const markdownPlugins = [
    breaks(),
    externalLinksInNewTab,
    tonedParagraphs,
    lazyHighlight,
];
