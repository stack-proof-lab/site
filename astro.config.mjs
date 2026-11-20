// @ts-check
import { defineConfig } from 'astro/config';

// Static output only: the site ships as static files.
export default defineConfig({
  output: 'static',
  trailingSlash: 'ignore',
});
