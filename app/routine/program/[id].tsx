import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRoutine } from "@/hooks/useRoutine";
import { NumField } from "@/components/TargetFields";
import { ScreenHeader } from "@/components/ScreenHeader";
import { runSummary } from "@/components/RunPlanTable";
import { strengthSummary } from "@/components/StrengthPlanTable";
import { mergedTarget } from "@/utils/programEntry";
import { addDays, todayISO, weekIndexSince } from "@/utils/cycle";
import { getProgram, getProgramWeeks, getWeekEntries } from "@/db/queries";
import { confirmAction, notify } from "@/utils/confirm";
import type { ProgramEntry, ProgramWeek, RoutineUnitExercise } from "@/types";

const SHORT_MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatShortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

function formatDateRange(startISO: string, endISO: string): string {
  const start = new Date(startISO + "T00:00:00");
  const end = new Date(endISO + "T00:00:00");
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} de ${SHORT_MONTHS[end.getMonth()]}`;
  }
  return `${formatShortDate(startISO)} – ${formatShortDate(endISO)}`;
}

export default function EditProgramScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const programId = Number(id);
  const r = useRoutine();
  const [splitId, setSplitId] = useState<number | null>(null);
  const [weeks, setWeeks] = useState<ProgramWeek[]>([]);
  const nameInputRef = useRef<TextInput>(null);

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
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title="Plano" fallbackHref="/routine" />
        <View className="flex-1 items-center justify-center">
          <Text className="text-ink-mute">Plano não encontrado.</Text>
        </View>
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

  // ── "Where are we in this plan right now" — anchored to when it was activated ──
  const isDistance = split.modality === "corrida";
  const units = r.unitsBySplit[split.id] ?? [];
  const elapsedWeeks = program.is_active && program.started_at
    ? weekIndexSince(program.started_at, todayISO())
    : null;
  const isFinished = elapsedWeeks != null && elapsedWeeks >= program.total_weeks;
  const currentWeekNumber = elapsedWeeks != null && !isFinished && elapsedWeeks >= 0 ? elapsedWeeks + 1 : null;
  const currentWeek = currentWeekNumber != null ? weeks.find((w) => w.week_number === currentWeekNumber) : undefined;

  const dayDigests = currentWeek
    ? (() => {
        const entries = getWeekEntries(currentWeek.id);
        const entryFor = (unitId: number, exerciseId: number) =>
          entries.find((e: ProgramEntry) => e.unit_id === unitId && e.exercise_id === exerciseId);
        return units
          .map((unit) => {
            const exercises = r.exercisesByUnit[unit.id] ?? [];
            if (exercises.length === 0) return null;
            const merged: RoutineUnitExercise[] = exercises.map((ex) => {
              const t = mergedTarget(ex, entryFor(unit.id, ex.exercise_id));
              return { ...ex, ...t, target_sets: t.target_sets ?? ex.target_sets, target_reps: t.target_reps ?? ex.target_reps };
            });
            const summary = isDistance ? runSummary(merged[0]) : strengthSummary(merged);
            return { unitId: unit.id, label: unit.label, summary };
          })
          .filter((d): d is { unitId: number; label: string; summary: string } => d !== null);
      })()
    : [];

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader
        fallbackHref={`/routine/${split.id}`}
        titleNode={
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => nameInputRef.current?.focus()}
            className="flex-row items-center"
            style={{ gap: 6 }}
          >
            <TextInput
              ref={nameInputRef}
              value={program.name}
              onChangeText={(name) => r.renameProgram(program.id, { name })}
              placeholder="Nome do plano"
              placeholderTextColor="#bdb8aa"
              className="text-ink font-display font-semibold text-2xl"
              style={{ width: 210, flexShrink: 1 }}
            />
            <MaterialCommunityIcons name="pencil-outline" size={15} color="#928d80" style={{ flexShrink: 0 }} />
          </TouchableOpacity>
        }
        right={
          <TouchableOpacity onPress={confirmDeleteProgram} className="p-1">
            <MaterialCommunityIcons name="trash-can-outline" size={20} color="#dc2626" />
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        {/* Plan meta card */}
        <View
          className="rounded-2xl p-4 mb-5"
          style={{ borderWidth: 1, borderColor: "#ddd8ce" }}
        >
          <View className="flex-row items-center justify-between mb-1">
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <Text className="text-ink-mute text-sm">Duração</Text>
              <NumField value={program.total_weeks} onChange={setTotalWeeks} integer suffix="semanas" />
            </View>
            {program.is_active ? (
              <View className="flex-row items-center px-2.5 py-1 rounded-full" style={{ backgroundColor: "#e3efe8", gap: 5 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#2f9e6e" }} />
                <Text style={{ color: "#227a54", fontSize: 12, fontWeight: "700" }}>Ativo</Text>
              </View>
            ) : (
              <TouchableOpacity
                className="px-3 py-1.5 rounded-full bg-brand-500"
                onPress={() => r.activateProgram(split.id, program.id)}
              >
                <Text className="text-white text-xs font-semibold">Ativar plano</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text className="text-ink-faint text-xs">
            {program.started_at
              ? `Em andamento desde ${formatShortDate(program.started_at)}`
              : "Ative para começar a acompanhar a semana atual"}
          </Text>
        </View>

        {program.setup_week_number != null && (
          <TouchableOpacity
            className="flex-row items-center justify-between rounded-2xl px-4 py-3 mb-5"
            style={{ backgroundColor: "#faf1de", borderWidth: 1, borderColor: "#e8d6ac" }}
            onPress={resumeSetup}
          >
            <Text className="text-sm flex-1" style={{ color: "#8a6a1f" }}>
              Mapeamento incompleto — continue definindo a Semana {program.setup_week_number}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#8a6a1f" />
          </TouchableOpacity>
        )}

        {/* Current-week spotlight */}
        {program.is_active && isFinished && (
          <View
            className="rounded-2xl p-4 mb-5"
            style={{ backgroundColor: "#ebe7df" }}
          >
            <Text className="text-ink font-semibold text-sm mb-1">Plano concluído</Text>
            <Text className="text-ink-mute text-sm mb-3">
              As {program.total_weeks} semanas deste plano já passaram. Adicione mais semanas para continuar
              acompanhando, ou crie um novo plano.
            </Text>
            <TouchableOpacity
              className="self-start px-3 py-2 rounded-xl bg-brand-500"
              onPress={addWeek}
            >
              <Text className="text-white text-xs font-semibold">+ Adicionar semana</Text>
            </TouchableOpacity>
          </View>
        )}

        {currentWeek && (
          <View className="rounded-3xl p-5 mb-5" style={{ backgroundColor: "#26241f" }}>
            <Text style={{ color: "#a8a293", fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>
              SEMANA ATUAL
            </Text>
            <Text
              className="font-display font-semibold"
              style={{ color: "#ffffff", fontSize: 22, letterSpacing: -0.4, marginTop: 4 }}
            >
              Semana {currentWeek.week_number}{currentWeek.label ? ` · ${currentWeek.label}` : ""}
            </Text>
            <Text style={{ color: "#a8a293", fontSize: 13, marginTop: 2, marginBottom: 14 }}>
              {formatDateRange(
                addDays(program.started_at!, (currentWeekNumber! - 1) * 7),
                addDays(program.started_at!, (currentWeekNumber! - 1) * 7 + 6)
              )}
              {" · "}
              {currentWeekNumber} de {program.total_weeks}
            </Text>

            {dayDigests.length > 0 ? (
              <View style={{ gap: 8, marginBottom: 14 }}>
                {dayDigests.map((d) => (
                  <View key={d.unitId} className="flex-row items-center" style={{ gap: 8 }}>
                    <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "600", width: 56 }} numberOfLines={1}>
                      {d.label}
                    </Text>
                    <Text style={{ color: "#cfcabf", fontSize: 13, flex: 1 }} numberOfLines={1}>
                      {d.summary}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ color: "#a8a293", fontSize: 13, marginBottom: 14 }}>
                Nenhum dia com treino definido ainda.
              </Text>
            )}

            <TouchableOpacity
              className="self-start px-3 py-2 rounded-xl flex-row items-center"
              style={{ backgroundColor: "rgba(255,255,255,0.14)", gap: 4 }}
              onPress={() => router.push(`/routine/program/week/${currentWeek.id}`)}
            >
              <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }}>Editar semana atual</Text>
              <MaterialCommunityIcons name="arrow-right" size={15} color="#ffffff" />
            </TouchableOpacity>
          </View>
        )}

        <Text className="text-ink-mute text-xs mb-2" style={{ letterSpacing: 1, fontWeight: "700" }}>
          SEMANAS
        </Text>
        {weeks.map((week) => {
          const isCurrent = week.week_number === currentWeekNumber;
          return (
            <View
              key={week.id}
              className="flex-row items-center justify-between mb-2 px-4 py-3 rounded-2xl"
              style={{
                borderWidth: isCurrent ? 1.5 : 1,
                borderColor: isCurrent ? "#26241f" : "#ddd8ce",
              }}
            >
              <TouchableOpacity
                className="flex-1 flex-row items-center"
                style={{ gap: 8 }}
                onPress={() => router.push(`/routine/program/week/${week.id}`)}
              >
                <Text className="text-ink text-sm font-medium">
                  Semana {week.week_number}{week.label ? ` · ${week.label}` : ""}
                </Text>
                {isCurrent && (
                  <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: "#e3efe8" }}>
                    <Text style={{ color: "#227a54", fontSize: 10, fontWeight: "700" }}>Atual</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDeleteWeek(week.id)} className="px-2">
                <MaterialCommunityIcons name="trash-can-outline" size={18} color="#dc2626" />
              </TouchableOpacity>
            </View>
          );
        })}
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
