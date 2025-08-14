import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2022",
  dts: true,
  clean: true,
  shims: true,
  banner: {
    js: "#!/usr/bin/env node"
  }
});