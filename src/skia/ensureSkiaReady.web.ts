import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";

// canvaskit.wasm is committed directly into public/ (same as public/sql-wasm.wasm)
// so Metro's web static server can find it at the site root — no build step needed.
export async function ensureSkiaReady(): Promise<void> {
  await LoadSkiaWeb({ locateFile: (file) => `/${file}` });
}
