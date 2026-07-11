import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";

/** Returns the picked file's contents, or null if the user canceled. */
export async function pickImportFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: "application/json" });
  if (result.canceled || !result.assets[0]) return null;
  return FileSystem.readAsStringAsync(result.assets[0].uri);
}
