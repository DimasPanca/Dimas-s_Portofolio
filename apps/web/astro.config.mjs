import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

const site = process.env.PUBLIC_SITE_URL || 'https://dimas-panca.vercel.app';

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  integrations: [
    sitemap({
      filter: (page) => !/\/(thanks|404)\/?$/.test(page),
      i18n: { defaultLocale: 'en', locales: { en: 'en', id: 'id' } },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          // Stable chunk names so the size budgets (PRD §8.2) can target them.
          manualChunks(id) {
            if (id.includes('node_modules/gsap') || id.includes('node_modules/lenis')) return 'motion';
            if (id.includes('node_modules/ogl')) return 'webgl';
            if (id.includes('node_modules/howler')) return 'audio';
          },
        },
      },
    },
  },
});
