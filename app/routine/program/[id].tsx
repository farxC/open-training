import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useRoutine } from "@/hooks/useRoutine";
import { NumField } from "@/components/TargetFields";
import { getProgram, getProgramWeeks } from "@/db/queries";
import { confirmAction, notify } from "@/utils/confirm";
import type { ProgramWeek } from "@/types";

export default function EditProgramScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const programId = Number(id);
  const r = useRoutine();
  const [splitId, setSplitId] = useState<number | null>(null);
  const [weeks, setWeeks] = useState<ProgramWeek[]>([]);

  const refreshWeeks = useCallback(() => setWeeks(getProgramWeeks(programId)), [programId]);

  useEffect(() => {
    const p = getProgram(programId);
    setSplitId(p?.split_id ?? null);
  }, [programId]);

  useFocusEffect(
    useCallback(() => {
      refreshWeeks();
    }, [refreshWeeks])
  );

  const split = splitId != null ? r.splits.find((s) => s.id === splitId) : undefined;
  const program = splitId != null ? (r.programsBySplit[splitId] ?? []).find((p) => p.id === programId) : undefined;

  if (!program || !split) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center">
        <Text className="text-ink-mute">Plano não encontrado.</Text>
      </SafeAreaView>
    );
  }

  const confirmDeleteProgram = () => {
    confirmAction(
      "Excluir plano?",
      "As semanas e alvos deste plano serão perdidos.",
      "Excluir",
      () => {
        try {
          r.removeProgram(program.id);
          router.back();
        } catch {
          notify("Não é possível excluir", "Este split de corrida precisa de pelo menos um plano.");
        }
      }
    );
  };

  const confirmDeleteWeek = (weekId: number) => {
    confirmAction(
      "Excluir semana?",
      "Os alvos definidos para essa semana serão perdidos.",
      "Excluir",
      () => { r.removeWeek(weekId); refreshWeeks(); }
    );
  };

  const addWeek = () => {
    r.addWeek(program.id, weeks.length + 1);
    refreshWeeks();
  };

  const setTotalWeeks = (n: number | null) => {
    const totalWeeks = n ?? program.total_weeks;
    r.renameProgram(program.id, { total_weeks: totalWeeks });
    for (let wn = weeks.length + 1; wn <= totalWeeks; wn++) r.addWeek(program.id, wn);
    refreshWeeks();
  };

  const resumeSetup = () => {
    const startIndex = Math.max(0, weeks.findIndex((w) => w.week_number === program.setup_week_number));
    const weekIds = weeks.map((w) => w.id);
    router.push({
      pathname: "/routine/program/week/[id]",
      params: {
        id: String(weekIds[startIndex]),
        wizardWeekIds: weekIds.join(","),
        wizardIndex: String(startIndex),
        wizardSplitId: String(split.id),
      },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
          <TextInput
            value={program.name}
            onChangeText={(name) => r.renameProgram(program.id, { name })}
            placeholder="Nome do plano"
            placeholderTextColor="#bdb8aa"
            className="flex-1 text-ink font-display font-semibold text-2xl"
          />
          <TouchableOpacity onPress={confirmDeleteProgram} className="px-1">
            <Text className="text-red-600 text-base">✕</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row items-center mb-4" style={{ gap: 10 }}>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <Text className="text-ink-mute text-sm">Semanas totais</Text>
            <NumField value={program.total_weeks} onChange={setTotalWeeks} integer />
          </View>
          {program.is_active ? (
            <View className="px-2 py-1 rounded-full" style={{ backgroundColor: "#ebe7df" }}>
              <Text className="text-ink-mute text-xs font-medium">Ativo</Text>
            </View>
          ) : (
            <TouchableOpacity
              className="px-3 py-1 rounded-full bg-brand-500"
              onPress={() => r.activateProgram(split.id, program.id)}
            >
              <Text className="text-white text-xs font-medium">Ativar</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text className="text-ink-mute text-xs mb-2" style={{ letterSpacing: 1, fontWeight: "700" }}>
          SEMANAS
        </Text>
        {weeks.map((week) => (
          <View
            key={week.id}
            className="flex-row items-center justify-between mb-2 px-4 py-3 rounded-2xl"
            style={{ borderWidth: 1, borderColor: "#ddd8ce" }}
          >
            <TouchableOpacity
              className="flex-1"
              onPress={() => router.push(`/routine/program/week/${week.id}`)}
            >
              <Text className="text-ink text-sm font-medium">
                Semana {week.week_number}{week.label ? ` · ${week.label}` : ""}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => confirmDeleteWeek(week.id)} className="px-2">
              <Text className="text-red-600 text-base">✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        {weeks.length === 0 && (
          <Text className="text-ink-faint text-sm mb-3">Nenhuma semana definida ainda.</Text>
        )}

        <TouchableOpacity
          className="mt-2 py-3 rounded-xl items-center"
          style={{ borderWidth: 1, borderColor: "#c9c3b6", borderStyle: "dashed" }}
          onPress={addWeek}
        >
          <Text className="text-ink text-sm font-medium">+ Adicionar semana</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
