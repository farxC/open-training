import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ActionButton } from "@/components/ui/ActionButton";
import { pickFitFile } from "@/fit/pickFile";
import type { FitActivity } from "@/fit/types";
import { getFitImport, importFitActivity, linkedFitSession } from "@/db/fit";
import { getSessions } from "@/db/queries";
import { samplesOf } from "@/health/model";
import { dateToISO } from "@/utils/cycle";
import colors from "@/theme/palette.json";

const shown = (n: number | null, unit: string) => n === null ? "Não informado" : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${unit}`;

export default function ImportFitScreen() {
  const [activity, setActivity] = useState<FitActivity | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const select = async () => {
    setError(null); setBusy(true);
    try {
      const file = await pickFitFile();
      if (!file) return;
      setActivity(null);
      const { parseFitFile } = await import("@/fit/parse");
      setActivity(parseFitFile(file.bytes, file.name));
    } catch (err) {
      setActivity(null);
      setError(err instanceof Error ? err.message : String(err));
    }
    finally { setBusy(false); }
  };
  const save = (targetId?: number) => {
    if (!activity) return;
    setError(null); setBusy(true);
    try { router.replace(`/session/${importFitActivity(activity, targetId)}`); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };
  const linked = activity ? linkedFitSession(activity) : null;
  const candidates = activity && linked === null ? getSessions().filter((s) => s.modality === "corrida" &&
    s.date === dateToISO(new Date(activity.workout.start)) && getFitImport(s.id) === null) : [];
  const w = activity?.workout;
  return <View className="flex-1 bg-surface">
    <ScreenHeader title="Importar arquivo FIT" />
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text className="font-sans text-ink-soft">Selecione uma corrida exportada pelo Zepp ou outro relógio em formato .fit. A leitura acontece neste dispositivo.</Text>
      <ActionButton label="Selecionar arquivo .fit" icon="file-upload-outline" onPress={() => { void select(); }} disabled={busy} />
      <Text className="font-sans text-ink-mute text-xs">Até 20 MB. Corridas com uma única sessão; arquivos de rota, planejamento e multiesporte ainda não são suportados.</Text>
      {busy && <ActivityIndicator color={colors.primary} accessibilityLabel="Importando arquivo FIT" />}
      {error && <Text className="font-sans" accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>}
      {activity && w && <View className="bg-surface-card rounded-2xl p-4" style={{ gap: 10 }}>
        <Text className="font-sans text-ink font-semibold">{activity.fileName}</Text>
        {activity.deviceName && <Text className="font-sans text-ink-mute">{activity.deviceName}</Text>}
        <Text className="font-sans text-ink">{new Date(w.start).toLocaleString("pt-BR")}</Text>
        <Text className="font-sans text-ink-soft">Distância: {shown(w.distanceKm, "km")}</Text>
        <Text className="font-sans text-ink-soft">Tempo ativo: {shown(activity.timerSeconds === null ? null : activity.timerSeconds / 60, "min")} · Decorrido: {shown(activity.elapsedSeconds / 60, "min")}</Text>
        <Text className="font-sans text-ink-soft">FC média: {shown(w.heartRateAverage, "bpm")} · Máxima: {shown(activity.heartRateMaximum, "bpm")}</Text>
        <Text className="font-sans text-ink-soft">Cadência média: {shown(w.cadenceAverage, "passos/min")} · Máxima: {shown(activity.cadenceMaximum, "passos/min")}</Text>
        <Text className="font-sans text-ink-mute text-xs">{samplesOf(w.heartRate).length} amostras cardíacas · {samplesOf(w.cadence).length} de cadência · {activity.laps.length} voltas</Text>
        {linked !== null ? <>
          <Text className="font-sans text-ink-soft">Este treino já foi importado. Atualizar as métricas mantém os trechos e as anotações existentes.</Text>
          <ActionButton label="Atualizar métricas da sessão vinculada" disabled={busy} onPress={() => save(linked)} />
        </> : <>
          <Text className="font-sans text-ink-soft">Se você já registrou esta corrida, vincule o arquivo à sessão para evitar duplicação. Os trechos e dados manuais serão preservados.</Text>
          {candidates.map((s) => <ActionButton key={s.id} variant="secondary" disabled={busy}
            label={`Vincular: ${s.name || "Corrida"} · #${s.id}`} onPress={() => save(s.id)} />)}
          <ActionButton label="Importar como nova corrida" disabled={busy} onPress={() => save()} />
        </>}
      </View>}
    </ScrollView>
  </View>;
}
