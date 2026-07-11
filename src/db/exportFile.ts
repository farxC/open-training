import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { buildExportPayload } from "./importExportApply";

export async function exportBackup(): Promise<void> {
  const payload = buildExportPayload();
  const json = JSON.stringify(payload, null, 2);
  const fileUri = `${FileSystem.cacheDirectory}open-training-backup-${payload.exportedAt.slice(0, 10)}.json`;
  await FileSystem.writeAsStringAsync(fileUri, json);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, { mimeType: "application/json" });
  }
}
