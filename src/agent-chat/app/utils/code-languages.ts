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

export const codeLanguages = [blade, css, diff, dockerfile, html, ini, markdown, nginx, php, python, sql, xml];
