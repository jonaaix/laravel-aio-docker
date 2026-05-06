import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Laravel AIO Docker',
  description:
    'All-in-one production-ready Docker image for Laravel apps. PHP-FPM, RoadRunner, FrankenPHP, OpenSwoole, plus a Claude Code variant for AI-assisted development.',
  base: '/laravel-aio-docker/',
  lang: 'en-US',
  cleanUrls: true,
  lastUpdated: true,

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/laravel-aio-docker/logo.svg' }],
    ['link', { rel: 'icon', type: 'image/png', href: '/laravel-aio-docker/logo.png' }],
  ],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Get Started', link: '/guide/getting-started' },
      { text: 'Variants', link: '/variants/fpm' },
      { text: 'Configuration', link: '/configuration' },
      { text: 'Recipes', link: '/recipes/redis' },
      { text: 'Integrations', link: '/integrations/laravel-boost' },
    ],

    sidebar: [
      {
        text: 'Get Started',
        items: [
          { text: 'Quick start', link: '/guide/getting-started' },
          { text: 'Project ownership', link: '/guide/project-ownership' },
        ],
      },
      {
        text: 'Variants',
        items: [
          { text: 'FPM (default)', link: '/variants/fpm' },
          { text: 'FPM + Claude Code', link: '/variants/fpm-claude' },
          { text: 'FrankenPHP (Octane)', link: '/variants/frankenphp' },
          { text: 'RoadRunner (Octane)', link: '/variants/roadrunner' },
          { text: 'OpenSwoole (Octane)', link: '/variants/openswoole' },
        ],
      },
      { text: 'Configuration', link: '/configuration' },
      {
        text: 'Development',
        items: [{ text: 'Xdebug', link: '/development/xdebug' }],
      },
      {
        text: 'Deployment',
        items: [
          { text: 'Mounted host directory', link: '/deployment/mounted-host-dir' },
          { text: 'Dockerfile strategy', link: '/deployment/dockerfile-strategy' },
          { text: 'Automated deployment / CI', link: '/deployment/automated-deployment' },
        ],
      },
      {
        text: 'Recipes',
        items: [
          { text: 'Adding databases', link: '/recipes/databases' },
          { text: 'Adding Redis', link: '/recipes/redis' },
          { text: 'Adding phpMyAdmin', link: '/recipes/phpmyadmin' },
          { text: 'Adding Chromium PDF', link: '/recipes/chromium-pdf' },
          { text: 'SPA with integrated nginx', link: '/recipes/spa-with-nginx' },
          { text: 'Custom boot scripts', link: '/recipes/custom-scripts' },
          { text: 'Debugging nginx', link: '/recipes/nginx-debugging' },
        ],
      },
      {
        text: 'Integrations',
        items: [{ text: 'Laravel Boost MCP', link: '/integrations/laravel-boost' }],
      },
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/jonaaix/laravel-aio-docker' }],

    search: { provider: 'local' },

    editLink: {
      pattern: 'https://github.com/jonaaix/laravel-aio-docker/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © Laravel AIO Docker contributors',
    },
  },
})
