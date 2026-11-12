import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { prerenderRoutes } from "./scripts/prerender-routes.js";

export default defineConfig({
  plugins: [react(), prerenderRoutes()],
  optimizeDeps: {
    exclude: ["@wasm-zoo/ghostscript"],
  },
});
