import { defineNuxtConfig } from "nuxt/config";

const buildRevision = process.env.CF_PAGES_COMMIT_SHA
  ?? process.env.VERCEL_GIT_COMMIT_SHA
  ?? new Date().toISOString();

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ["@vite-pwa/nuxt"],
  css: ["~/assets/css/main.css"],
  app: {
    head: {
      htmlAttrs: { lang: "en" },
      meta: [
        { name: "theme-color", content: "#111b17" },
        { name: "description", content: "Track your mileage and know when your car needs service." },
      ],
      link: [{ rel: "apple-touch-icon", href: "/apple-touch-icon.png" }],
    },
  },
  pwa: {
    registerType: "prompt",
    includeAssets: ["apple-touch-icon.png"],
    manifest: {
      name: "Car Service Tracker",
      short_name: "Car Service",
      description: "Local-first mileage and service tracking.",
      theme_color: "#111b17",
      background_color: "#f4f2eb",
      display: "standalone",
      start_url: "/",
      icons: [
        { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
        { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
        { src: "/pwa-512x512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    workbox: {
      additionalManifestEntries: [{ url: "/", revision: buildRevision }],
      clientsClaim: true,
      navigateFallback: "/",
      globPatterns: ["**/*.{js,css,html,svg,png,woff2,wasm,gz}"],
      maximumFileSizeToCacheInBytes: 50 * 1024 * 1024,
    },
    devOptions: { enabled: false },
  },
});
