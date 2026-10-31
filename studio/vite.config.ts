import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { studioApi } from "./api";

const root = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL("./web", import.meta.url)),
  publicDir: `${root}public`,
  plugins: [react(), studioApi(root)],
  server: { port: 4100, open: true, fs: { allow: [root] }, watch: { ignored: ["**/history/**", "**/out/**", "**/.venv/**"] } },
});
