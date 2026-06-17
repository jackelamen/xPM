import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// PWA is hand-rolled (public/manifest.webmanifest + public/sw.js, registered in
// main.jsx) so the build pulls in no workbox-build/@babel pipeline — that chain
// fails on Vercel due to @tailwindcss/node's module-resolution hook.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
})
