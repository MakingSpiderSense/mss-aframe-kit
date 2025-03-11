import { defineConfig } from 'vite'
import banner from 'vite-plugin-banner'
import pkg from './package.json'

const isMinify = process.env.BUILD_MINIFY === 'true'

export default defineConfig({
	plugins: [
		banner(`/*! ${pkg.name} v${pkg.version} */`)
	],
	build: {
		lib: {
			entry: 'src/index.js',
			name: 'MSSAFrameKit',
			fileName: () => isMinify ? 'mss-aframe-kit.min.js' : 'mss-aframe-kit.js'
		},
		minify: isMinify,
		sourcemap: true,
		emptyOutDir: false, // Prevents Vite from clearing the dist folder so both the minified and non-minified versions are available
	}
})
