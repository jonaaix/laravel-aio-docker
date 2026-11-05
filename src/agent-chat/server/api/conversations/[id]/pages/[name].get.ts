import { readFileSync } from 'node:fs';

const SCROLLBAR_STYLE = '<style>html{scrollbar-width:thin;scrollbar-color:rgb(128 128 128 / 0.45) transparent}</style>';
const HEAD_OPEN = /<head\b[^>]*>/i;
const DOCTYPE = /^\s*<!doctype[^>]*>/i;

function withScrollbarStyle(html: string): string {
    const anchor = HEAD_OPEN.exec(html) ?? DOCTYPE.exec(html);
    if (!anchor) {
        return SCROLLBAR_STYLE + html;
    }
    const end = anchor.index + anchor[0].length;
    return html.slice(0, end) + SCROLLBAR_STYLE + html.slice(end);
}

export default defineEventHandler((event) => {
    const name = getRouterParam(event, 'name')!;
    const path = /\.html?$/.test(name) ? conversationFilePath(getRouterParam(event, 'id')!, name) : null;
    if (!path) {
        throw createError({ statusCode: 404, statusMessage: 'Page not found' });
    }
    setHeader(event, 'content-type', 'text/html; charset=utf-8');
    setHeader(event, 'cache-control', 'private, max-age=31536000, immutable');
    setHeader(event, 'content-security-policy', 'sandbox allow-scripts');
    setHeader(event, 'x-content-type-options', 'nosniff');
    return withScrollbarStyle(readFileSync(path, 'utf8'));
});
