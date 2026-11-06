import { cpSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_LANGUAGE, LANGUAGES } from './shared/utils/languages';

const hub = process.env.NUXT_PUBLIC_HUB === 'true';

export default defineNuxtConfig({
    modules: ['@nuxt/ui', '@comark/nuxt', '@nuxtjs/i18n'],

    ssr: false,

    // The hub is built next to a running dev server, so it gets its own build and output folders.
    buildDir: hub ? '.nuxt-hub' : '.nuxt',
    // The hub is a static app that talks to chat servers; it carries none of their server code.
    serverDir: hub ? 'hub-server' : 'server',

    router: {
        options: {
            hashMode: hub,
        },
    },

    alias: {
        '#claude-threads': fileURLToPath(new URL('../claude-threads/src', import.meta.url)),
    },

    devtools: {
        enabled: false,
    },

    css: ['~/assets/css/main.css'],

    fonts: {
        families: [
            { name: 'Geist', provider: 'google', weights: [400, 500, 600, 700], global: true },
            { name: 'Inter', provider: 'google', weights: [400, 500, 600, 700], global: true },
            { name: 'Source Sans 3', provider: 'google', weights: [400, 500, 600, 700], global: true },
            { name: 'IBM Plex Sans', provider: 'google', weights: [400, 500, 600, 700], global: true },
            { name: 'JetBrains Mono', provider: 'google', weights: [400, 500, 600, 700], global: true },
        ],
    },

    i18n: {
        strategy: 'no_prefix',
        defaultLocale: DEFAULT_LANGUAGE,
        locales: LANGUAGES.map(language => ({ code: language.code, name: language.name, file: `${language.code}.json` })),
        detectBrowserLanguage: {
            useCookie: true,
            cookieKey: 'chat-language',
            fallbackLocale: DEFAULT_LANGUAGE,
        },
    },

    icon: {
        provider: hub ? 'none' : 'server',
        fallbackToApi: false,
        serverBundle: {
            collections: ['heroicons'],
        },
        clientBundle: {
            scan: true,
        },
    },

    routeRules: {
        '/**': { headers: { 'cache-control': 'private, no-cache' } },
        '/_nuxt/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
    },

    runtimeConfig: {
        chatKey: '',
        workingDir: '',
        dataDir: '',
        claudeModel: '',
        public: {
            hub,
            hubUrl: 'https://jonaaix.github.io/orbit/',
        },
    },

    compatibilityDate: '2026-06-30',

    vite: {
        optimizeDeps: {
            // Comark loads shiki unbundled; a pre-bundled second copy breaks highlighters shared across both.
            exclude: ['shiki'],
        },
    },

    typescript: {
        tsConfig: {
            compilerOptions: {
                // The vendored claude-threads core is written against the looser core tsconfig and reached via typed routes.
                noUncheckedIndexedAccess: false,
            },
        },
    },

    nitro: {
        output: hub ? { dir: '.output-hub' } : undefined,
        compressPublicAssets: true,
        typescript: {
            tsConfig: {
                compilerOptions: {
                    noUncheckedIndexedAccess: false,
                },
            },
        },
        hooks: hub ? {} : {
            compiled(nitro) {
                cpSync(
                    join(nitro.options.rootDir, 'server/database/migrations'),
                    join(nitro.options.output.serverDir, 'migrations'),
                    { recursive: true },
                );
            },
        },
    },
});
