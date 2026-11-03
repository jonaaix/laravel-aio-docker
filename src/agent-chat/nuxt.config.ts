import { cpSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_LANGUAGE, LANGUAGES } from './shared/utils/languages';

export default defineNuxtConfig({
    modules: ['@nuxt/ui', '@comark/nuxt', '@nuxtjs/i18n'],

    ssr: false,

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
        provider: 'server',
        fallbackToApi: false,
        serverBundle: {
            collections: ['heroicons'],
        },
        clientBundle: {
            scan: true,
        },
    },

    runtimeConfig: {
        chatKey: '',
        workingDir: '',
        dataDir: '',
        claudeModel: '',
        vapidSubject: '',
        vapidPublicKey: '',
        vapidPrivateKey: '',
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
        typescript: {
            tsConfig: {
                compilerOptions: {
                    noUncheckedIndexedAccess: false,
                },
            },
        },
        hooks: {
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
