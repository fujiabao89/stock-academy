import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://backend:8000",
      "/docs": "http://backend:8000",
      "/redoc": "http://backend:8000",
      "/openapi.json": "http://backend:8000",
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          echarts: ["echarts"],
        },
      },
    },
  },
});
