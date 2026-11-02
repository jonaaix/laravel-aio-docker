import breaks from '@comark/nuxt/plugins/breaks';
import highlight from '@comark/nuxt/plugins/shiki';
import { visit } from '@comark/nuxt/utils';
import blade from 'shiki/dist/langs/blade.mjs';
import css from 'shiki/dist/langs/css.mjs';
import diff from 'shiki/dist/langs/diff.mjs';
import dockerfile from 'shiki/dist/langs/dockerfile.mjs';
import html from 'shiki/dist/langs/html.mjs';
import ini from 'shiki/dist/langs/ini.mjs';
import markdown from 'shiki/dist/langs/markdown.mjs';
import nginx from 'shiki/dist/langs/nginx.mjs';
import php from 'shiki/dist/langs/php.mjs';
import python from 'shiki/dist/langs/python.mjs';
import sql from 'shiki/dist/langs/sql.mjs';
import xml from 'shiki/dist/langs/xml.mjs';
import githubLight from 'shiki/dist/themes/github-light.mjs';
import materialPalenight from 'shiki/dist/themes/material-theme-palenight.mjs';

export const codeThemes = { light: githubLight, dark: materialPalenight };

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

const MENTION_CLASS = 'rounded-md bg-inverted/10 px-1 py-px font-semibold text-highlighted';
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

export const markdownPlugins = [
    breaks(),
    externalLinksInNewTab,
    highlight({
        preStyles: false,
        registerDefaultThemes: false,
        themes: codeThemes,
        languages: [blade, css, diff, dockerfile, html, ini, markdown, nginx, php, python, sql, xml],
    }),
];
