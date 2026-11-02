import { defineConfig } from 'vite';

export default defineConfig({
  // Vercel serves the site from the domain root; locally it stays under /3D-art-gallery/
  base: process.env.VERCEL ? '/' : '/3D-art-gallery',
});
