import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: {
    include: [
      '@convai/web-sdk',
      '@met4citizen/talkinghead/modules/lipsync-fi.mjs',
      '@met4citizen/talkinghead/modules/lipsync-en.mjs',
      '@met4citizen/talkinghead/modules/lipsync-lt.mjs',
    ],
  },
})
