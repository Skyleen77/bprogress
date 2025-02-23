import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.tsx'],
  sourcemap: true,
  clean: true,
  dts: true,
  format: ['esm'],
  external: [
    'react',
    'react-dom',
    'next/router',
    'next/navigation',
    '@bprogress/core',
  ],
});
