import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [svelte(), viteSingleFile({ removeViteModuleLoader: true })],
	build: {
		target: 'es2022',
		outDir: 'dist',
		emptyOutDir: true,
	},
	server: {
		port: 5173,
		strictPort: true,
		// `composer serve` runs the PHP API on port 8000.
		proxy: { '/api': 'http://localhost:8000' },
	},
	test: {
		include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
		environment: 'node',
	},
});
