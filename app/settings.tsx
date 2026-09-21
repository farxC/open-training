import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ThemePicker } from "@/components/ThemePicker";
import { exportBackup } from "@/db/exportFile";
import { pickImportFile } from "@/db/importFile";
import { validateExportPayload } from "@/db/importExport";
import { applyImport } from "@/db/importExportApply";
import { notify } from "@/components/AppModal";
import { useTheme } from "@/theme";

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      className="text-ink-mute"
      style={{ fontSize: 10, fontWeight: "700", letterSpacing: 1.2, marginBottom: 10 }}
    >
      {children}
    </Text>
  );
}

export default function SettingsScreen() {
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const { colors, scheme, preference } = useTheme();

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

  const card = "bg-surface-card rounded-2xl p-4 border border-surface-border";

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader title="Configurações" />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <SectionLabel>APARÊNCIA</SectionLabel>
        <View className={card} style={{ marginBottom: 24 }}>
          <Text className="text-ink font-semibold text-base">Tema</Text>
          <Text className="text-ink-mute text-xs mt-1 mb-3">
            {/* Only "Sistema" needs the resolved scheme spelled out — under a
                fixed choice the chip already says which one is on. */}
            {preference === "system"
              ? `Seguindo o aparelho — agora em ${scheme === "dark" ? "escuro" : "claro"}.`
              : "Escolha fixa, independente do tema do aparelho."}
          </Text>
          <ThemePicker />
        </View>

        <SectionLabel>DADOS</SectionLabel>

        <TouchableOpacity
          className={card}
          style={{ marginBottom: 12 }}
          onPress={handleExport}
          disabled={busy !== null}
        >
          <Text className="text-ink font-semibold text-base">Exportar dados</Text>
          <Text className="text-ink-mute text-xs mt-1">
            Gera um arquivo com todo o seu histórico de treinos, exercícios e rotinas.
          </Text>
          {busy === "export" && <ActivityIndicator style={{ marginTop: 8 }} color={colors.ink} />}
        </TouchableOpacity>

        <TouchableOpacity className={card} onPress={handleImport} disabled={busy !== null}>
          <Text className="text-ink font-semibold text-base">Importar dados</Text>
          <Text className="text-ink-mute text-xs mt-1">
            Sessões, exercícios e rotinas do arquivo serão adicionados aos seus dados atuais.
          </Text>
          {busy === "import" && <ActivityIndicator style={{ marginTop: 8 }} color={colors.ink} />}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
