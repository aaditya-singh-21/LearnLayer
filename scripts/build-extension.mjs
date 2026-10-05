import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
await build({ entryPoints: ['src/content/index.tsx'], outfile: 'dist/content.js', bundle: true, format: 'iife', target: 'chrome120', minify: true, define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'inline-css', setup(builder) { builder.onLoad({ filter: /\.css$/ }, async args => ({ contents: await readFile(args.path, 'utf8'), loader: 'text' })); } }] });
await build({ entryPoints: ['src/background/index.ts'], outfile: 'dist/background.js', bundle: true, format: 'iife', target: 'chrome120', minify: true });
