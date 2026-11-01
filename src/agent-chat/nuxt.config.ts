import { cpSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@comark/nuxt'],

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
      { name: 'Geist', provider: 'google', weights: [400, 500, 600, 700] },
    ],
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
    workingDir: '',
    dataDir: '',
    claudeModel: '',
  },

  compatibilityDate: '2026-06-30',

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
