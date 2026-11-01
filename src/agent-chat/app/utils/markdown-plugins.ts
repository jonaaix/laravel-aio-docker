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

export const markdownPlugins = [
    externalLinksInNewTab,
    highlight({
        preStyles: false,
        registerDefaultThemes: false,
        themes: codeThemes,
        languages: [blade, css, diff, dockerfile, html, ini, markdown, nginx, php, python, sql, xml],
    }),
];
