import { cpSync } from 'node:fs';
import { join } from 'node:path';

export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@comark/nuxt'],

  ssr: false,

  devtools: {
    enabled: true,
  },

  css: ['~/assets/css/main.css'],

  icon: {
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
