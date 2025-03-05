import { defineConfig } from 'tsup';
import { copyFileSync } from 'fs';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'iife'],
  globalName: 'BProgressJS',
  dts: true,
  outDir: 'dist',
  esbuildPlugins: [
    {
      name: 'copy-css',
      setup(build) {
        build.onEnd(() => {
          copyFileSync('./src/index.css', './dist/index.css');
        });
      },
    },
  ],
});
