// Copyright (c) Marek Szanyi. See LICENSE.md.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        privacyPolicy: fileURLToPath(new URL('./privacy-policy/index.html', import.meta.url)),
      },
    },
  },
})
