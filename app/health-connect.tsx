import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ActionButton } from "@/components/ui/ActionButton";
import { notify } from "@/components/AppModal";
import { connectHealth, healthConnectSupported, listHealthRuns, openHealthSettings, readHealthWorkout } from "@/health/client";
import { healthSourceScope, importHealthWorkout, linkedHealthSession, getHealthImport } from "@/db/healthConnect";
import { getSessions } from "@/db/queries";
import { dateToISO } from "@/utils/cycle";
import type { HealthRun } from "@/health/types";
import colors from "@/theme/palette.json";

export default function HealthConnectScreen() {
  const [runs, setRuns] = useState<HealthRun[] | null>(null);
  const [selected, setSelected] = useState<HealthRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState("");
  const report = (err: unknown) => notify("Health Connect", err instanceof Error ? err.message : String(err));
  const search = async () => {
    setBusy(true);
    setSelected(null);
    try {
      await connectHealth();
      const found = await listHealthRuns();
      setScope(healthSourceScope());
      setRuns(found);
    } catch (err) { report(err); }
    finally { setBusy(false); }
  };
  const importRun = async (run: HealthRun, targetId?: number) => {
    setBusy(true);
    try {
      const workout = await readHealthWorkout(run);
      const sessionId = importHealthWorkout(workout, scope, targetId);
      router.replace(`/session/${sessionId}`);
    } catch (err) { report(err); }
    finally { setBusy(false); }
  };
  const candidates = selected ? getSessions().filter((s) => {
    const link = getHealthImport(s.id);
    return s.modality === "corrida" && s.date === dateToISO(new Date(selected.start)) &&
      (link === null || (link.sourceScope !== scope && link.workout.origin === selected.origin));
  }) : [];

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader title="Health Connect" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Text className="font-sans text-ink-soft">
          Sincronize o relógio no Zepp e habilite o compartilhamento com Health Connect.
          Depois, busque suas corridas e escolha qual importar ou vincular a uma sessão existente.
        </Text>
        <Text className="font-sans text-ink-mute text-xs">
          Leitura dos últimos 29 dias, somente quando você solicitar. Os dados ficam no app e nos seus backups.
          Batimentos, cadência e distância dependem das permissões e do que a origem compartilhar.
        </Text>
        {!healthConnectSupported ? (
          <View className="bg-surface-card rounded-2xl p-4" style={{ gap: 10 }}>
            <Text className="font-sans text-ink font-semibold">Conecte pelo aplicativo Android</Text>
            <Text className="font-sans text-ink-soft">
              O navegador e o iOS não acessam o Health Connect do celular. Instale o build Android do open-training e importe suas corridas por ele.
            </Text>
            <Text className="font-sans text-ink-mute text-xs">
              Para consultar essas métricas aqui, exporte um backup no app Android e importe-o nas configurações deste app.
              Os dados do celular e do navegador são armazenados separadamente.
            </Text>
            <ActionButton label="Abrir configurações de backup" variant="secondary" onPress={() => router.push("/settings")} />
            <ActionButton label="Importar corrida de arquivo .fit" variant="secondary" onPress={() => router.push("/import-fit")} />
          </View>
        ) : <>
          <ActionButton label="Conectar e buscar corridas" icon="sync" disabled={busy} onPress={() => { void search(); }} />
          <ActionButton label="Permissões do Health Connect" variant="secondary" disabled={busy}
            onPress={() => { Promise.resolve(openHealthSettings()).catch(report); }} />
        </>}
        {busy && <ActivityIndicator color={colors.primary} accessibilityLabel="Lendo Health Connect" />}
        {runs?.length === 0 && <Text className="font-sans text-ink-mute">
          Nenhuma corrida disponível. Confira no Health Connect se há exercícios com origem Zepp e sincronize o relógio novamente.
        </Text>}
        {selected ? (
          <View className="bg-surface-card rounded-2xl p-4" style={{ gap: 12 }}>
            <Text className="font-sans text-ink font-semibold">{selected.title}</Text>
            <Text className="font-sans text-ink-mute text-xs">{new Date(selected.start).toLocaleString("pt-BR")} · {selected.origin}</Text>
            <Text className="font-sans text-ink-soft">Se você já registrou esta corrida, vincule-a para manter uma única sessão.</Text>
            {candidates.map((s) => <ActionButton key={s.id} variant="secondary" disabled={busy}
              label={`${getHealthImport(s.id) ? "Reconectar sessão restaurada" : "Vincular"}: ${s.name || "Corrida"} · #${s.id}`}
              onPress={() => { void importRun(selected, s.id); }} />)}
            <ActionButton label="Importar como nova corrida" disabled={busy} onPress={() => { void importRun(selected); }} />
            <ActionButton label="Voltar à lista" variant="ghost" disabled={busy} onPress={() => setSelected(null)} />
          </View>
        ) : runs?.map((run) => {
          const linked = linkedHealthSession(run, scope);
          return <View key={`${run.origin}:${run.externalId}`} className="bg-surface-card rounded-2xl p-4" style={{ gap: 8 }}>
            <Text className="font-sans text-ink font-semibold">{run.title}</Text>
            <Text className="font-sans text-ink-mute text-xs">
              {new Date(run.start).toLocaleString("pt-BR")} · {Math.round((Date.parse(run.end) - Date.parse(run.start)) / 60000)} min
            </Text>
            <Text className="font-sans text-ink-mute text-xs">Origem: {run.origin}</Text>
            <ActionButton label={linked === null ? "Selecionar corrida" : "Atualizar métricas da sessão vinculada"}
              disabled={busy} variant="secondary" onPress={() => { if (linked === null) setSelected(run); else void importRun(run, linked); }} />
          </View>;
        })}
      </ScrollView>
    </View>
  );
}
