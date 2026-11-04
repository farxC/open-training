import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { MAX_FIT_BYTES } from "./types";

export async function pickFitFile(): Promise<{ name: string; bytes: Uint8Array } | null> {
  // FIT exports often have application/octet-stream or no MIME type on Android.
  const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
  if (result.canceled || !result.assets[0]) return null;
  const file = result.assets[0];
  if (!/\.fit$/i.test(file.name)) throw new Error("Selecione um arquivo com extensão .fit.");
  if ((file.size ?? 0) > MAX_FIT_BYTES) throw new Error("O arquivo FIT excede o limite de 20 MB.");
  try {
    const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    if (bytes.length > MAX_FIT_BYTES) throw new Error("O arquivo FIT excede o limite de 20 MB.");
    return { name: file.name, bytes };
  } finally {
    // Only the picker-created cache copy, never the user's original export.
    if (FileSystem.cacheDirectory && file.uri.startsWith(FileSystem.cacheDirectory)) {
      await FileSystem.deleteAsync(file.uri, { idempotent: true }).catch(() => undefined);
    }
  }
}
