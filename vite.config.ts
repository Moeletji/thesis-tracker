import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isGithubPages = env.GITHUB_ACTIONS === "true";
  const base = env.VITE_BASE_PATH ?? (isGithubPages ? "./" : "/");

  return {
    base,
    plugins: [react()],
  };
});
