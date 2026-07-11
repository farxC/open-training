import * as DocumentPicker from "expo-document-picker";

/** Returns the picked file's contents, or null if the user canceled. */
export async function pickImportFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: "application/json" });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  if (asset.file) return asset.file.text();
  const response = await fetch(asset.uri);
  return response.text();
}
