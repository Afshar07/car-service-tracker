import { defineNuxtConfig } from "nuxt/config";

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
    },
  },
  pwa: {
    registerType: "autoUpdate",
    manifest: {
      name: "Car Service Tracker",
      short_name: "Car Service",
      description: "Local-first mileage and service tracking.",
      theme_color: "#111b17",
      background_color: "#f4f2eb",
      display: "standalone",
      start_url: "/",
      icons: [
        { src: "/pwa-192x192.svg", sizes: "192x192", type: "image/svg+xml" },
        { src: "/pwa-512x512.svg", sizes: "512x512", type: "image/svg+xml" },
      ],
    },
    workbox: {
      navigateFallback: "/",
      globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/cdn\.jsdelivr\.net\//,
          handler: "CacheFirst",
          options: { cacheName: "ocr-assets", expiration: { maxEntries: 12, maxAgeSeconds: 31536000 } },
        },
      ],
    },
    devOptions: { enabled: false },
  },
});
