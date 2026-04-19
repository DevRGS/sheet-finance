import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import crypto from "node:crypto";
import type { Plugin } from "vite";
import { componentTagger } from "lovable-tagger";
import { copyFileSync, readFileSync, existsSync } from "fs";
import { VitePWA } from "vite-plugin-pwa";

const faviconPublic = path.resolve(__dirname, "public/favicon.png");
const faviconSrcMirror = path.resolve(__dirname, "src/img/favicon.png");

/** Fonte de verdade: public/favicon.png — espelha para src/img para não haver duas versões diferentes. */
function mirrorFaviconPublicToSrc() {
  if (!existsSync(faviconPublic)) return;
  try {
    copyFileSync(faviconPublic, faviconSrcMirror);
  } catch {
    /* ignore */
  }
}

/**
 * O browser e o PWA cacheiam agressivamente o favicon. O href inclui hash MD5 do ficheiro
 * para forçar novo pedido sempre que public/favicon.png mudar.
 */
function injectFaviconHref(): Plugin {
  let viteBase = "/";
  return {
    name: "inject-favicon-href",
    configResolved(config) {
      viteBase = config.base;
    },
    buildStart() {
      mirrorFaviconPublicToSrc();
    },
    configureServer(server) {
      mirrorFaviconPublicToSrc();
      server.watcher.add(faviconPublic);
      server.watcher.on("change", (file) => {
        if (path.normalize(file) === path.normalize(faviconPublic)) {
          mirrorFaviconPublicToSrc();
        }
      });
    },
    transformIndexHtml(html) {
      let hash = "0";
      try {
        const buf = readFileSync(faviconPublic);
        hash = crypto.createHash("md5").update(buf).digest("hex").slice(0, 12);
      } catch {
        /* sem ficheiro */
      }
      // Sempre path absoluto (/...); evita URLs relativas (ex.: em /configuracoes) e colapsa // acidental.
      const base = viteBase.replace(/\/$/, "") || "";
      const pathPart = base === "" || base === "/" ? "" : base;
      const href = `${pathPart}/favicon.png?v=${hash}`.replace(/\/+/g, "/");
      return html.replaceAll("__FAVICON_HREF__", href);
    },
  };
}

/** CSP em meta tag apenas no build de produção (dev/HMR precisa de regras mais permissivas). */
function cspProductionMeta(): Plugin {
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "script-src 'self' https://apis.google.com https://accounts.google.com https://www.gstatic.com",
    "connect-src 'self' https://www.googleapis.com https://content.googleapis.com https://oauth2.googleapis.com https://accounts.google.com",
    "frame-src https://accounts.google.com",
    "img-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
  ].join("; ");

  return {
    name: "csp-production-meta",
    transformIndexHtml(html, ctx) {
      if (ctx.server) return html;
      if (html.includes("Content-Security-Policy")) return html;
      return html.replace(
        "<head>",
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
      );
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Base path para GitHub Pages
  // Em desenvolvimento, usa '/' para funcionar localmente
  // Em produção (build), será substituído pelo BASE_URL do workflow
  base: process.env.BASE_URL || (mode === 'production' ? '/sheet-finance/' : '/'),
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    injectFaviconHref(),
    react(),
    mode === "production" && cspProductionMeta(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png'],
      manifest: {
        name: 'FluxioFinance',
        short_name: 'FluxioFinance',
        description: 'Controle financeiro pessoal',
        theme_color: '#7c3aed',
        background_color: '#09090b',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'favicon.png', sizes: '192x192', type: 'image/png' },
          { src: 'favicon.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
    // Plugin para copiar 404.html para dist durante o build
    {
      name: 'copy-404',
      closeBundle() {
        if (mode === 'production') {
          try {
            copyFileSync('public/404.html', 'dist/404.html');
          } catch (err) {
            console.warn('Could not copy 404.html:', err);
          }
        }
      }
    }
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Garantir que os assets sejam gerados com o base path correto
        assetFileNames: 'assets/[name].[hash][extname]',
        chunkFileNames: 'assets/[name].[hash].js',
        entryFileNames: 'assets/[name].[hash].js',
      },
    },
  },
}));
