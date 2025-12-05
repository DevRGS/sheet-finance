import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { copyFileSync } from "fs";

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
    react(), 
    mode === "development" && componentTagger(),
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
