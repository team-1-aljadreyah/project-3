import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Vite builds the site into dist/: plain files (HTML, JS, CSS) that any static host can serve.
export default defineConfig({
  plugins: [
    react(), // JSX and fast refresh (a saved file updates the page without losing its state)
    tailwindcss(), // Tailwind CSS 4, no extra config file needed
  ],
  resolve: {
    // "@/shared/ui" means "src/shared/ui", from any folder.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // The dev server is always on 3000 (strictPort: fail instead of moving to another port).
  server: { port: 3000, strictPort: true },
  // `npm run preview` serves the built dist/ folder; the browser tests use it on 3100.
  preview: { port: 3100, strictPort: true },
});
