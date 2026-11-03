import uiColors from "@/theme/palette.json";
import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { exportBackup } from "@/db/exportFile";
import { pickImportFile } from "@/db/importFile";
import { validateExportPayload } from "@/db/importExport";
import { applyImport } from "@/db/importExportApply";
import { notify } from "@/components/AppModal";

export default function SettingsScreen() {
  const [busy, setBusy] = useState<"export" | "import" | null>(null);

  const handleExport = async () => {
    setBusy("export");
    try {
      await exportBackup();
    } catch (err) {
      notify("Erro ao exportar", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleImport = async () => {
    setBusy("import");
    try {
      const content = await pickImportFile();
      if (content === null) return;
      const payload = validateExportPayload(JSON.parse(content));
      const summary = applyImport(payload);
      notify(
        "Importação concluída",
        `${summary.exercisesAdded} exercícios novos\n${summary.sessionsAdded} sessões novas\n${summary.splitsAdded} rotinas novas\n${summary.programsAdded} programas novos`
      );
    } catch (err) {
      notify("Erro ao importar", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader title="Configurações" />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text
          className="font-sans text-ink-mute"
          style={{ fontSize: 10, fontWeight: "700", letterSpacing: 1.2, marginBottom: 10 }}
        >
          DADOS
        </Text>

        <TouchableOpacity
          className="bg-surface-card rounded-2xl p-4 mb-3"
          style={{ borderWidth: 1, borderColor: uiColors.line }}
          onPress={handleExport}
          disabled={busy !== null}
        >
          <Text className="font-sans text-ink font-semibold text-base">Exportar dados</Text>
          <Text className="font-sans text-ink-mute text-xs mt-1">
            Gera um arquivo com todo o seu histórico de treinos, exercícios e rotinas.
          </Text>
          {busy === "export" && <ActivityIndicator style={{ marginTop: 8 }} color={uiColors.ink} />}
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-surface-card rounded-2xl p-4"
          style={{ borderWidth: 1, borderColor: uiColors.line }}
          onPress={handleImport}
          disabled={busy !== null}
        >
          <Text className="font-sans text-ink font-semibold text-base">Importar dados</Text>
          <Text className="font-sans text-ink-mute text-xs mt-1">
            Sessões, exercícios e rotinas do arquivo serão adicionados aos seus dados atuais.
          </Text>
          {busy === "import" && <ActivityIndicator style={{ marginTop: 8 }} color={uiColors.ink} />}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
