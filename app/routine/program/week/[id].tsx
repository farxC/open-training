import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useRoutine } from "@/hooks/useRoutine";
import { NumField, RunTargetFields } from "@/components/TargetFields";
import { ScreenHeader } from "@/components/ScreenHeader";
import { getProgram, getProgramWeek, getWeekEntries } from "@/db/queries";
import type { ProgramEntry, ProgramWeek, RoutineUnitExercise, TrainingProgram } from "@/types";

function mergedValue(ex: RoutineUnitExercise, entry: ProgramEntry | undefined) {
  return {
    target_sets: entry ? entry.target_sets : ex.target_sets,
    target_reps: entry ? entry.target_reps : ex.target_reps,
    target_reps_max: entry ? entry.target_reps_max : ex.target_reps_max,
    target_weight_kg: entry ? entry.target_weight_kg : ex.target_weight_kg,
    target_distance_km: entry ? entry.target_distance_km : ex.target_distance_km,
    target_duration_min: entry ? entry.target_duration_min : ex.target_duration_min,
    run_type: entry ? entry.run_type : ex.run_type,
    target_pace_sec: entry ? entry.target_pace_sec : ex.target_pace_sec,
    interval_reps: entry ? entry.interval_reps : ex.interval_reps,
    interval_work_sec: entry ? entry.interval_work_sec : ex.interval_work_sec,
    interval_work_km: entry ? entry.interval_work_km : ex.interval_work_km,
    interval_rest_sec: entry ? entry.interval_rest_sec : ex.interval_rest_sec,
  };
}

export default function EditProgramWeekScreen() {
  const { id, wizardWeekIds, wizardIndex, wizardSplitId } = useLocalSearchParams<{
    id: string;
    wizardWeekIds?: string;
    wizardIndex?: string;
    wizardSplitId?: string;
  }>();
  const weekId = Number(id);
  const r = useRoutine();

  const wizardIds = wizardWeekIds ? wizardWeekIds.split(",").map(Number) : null;
  const wizardStep = wizardIndex != null ? Number(wizardIndex) : null;
  const isWizard = wizardIds != null && wizardStep != null;
  const isLastWizardWeek = isWizard && wizardStep >= wizardIds!.length - 1;

  const [week, setWeek] = useState<ProgramWeek | null>(null);
  const [program, setProgram] = useState<TrainingProgram | null>(null);
  const [entries, setEntries] = useState<ProgramEntry[]>([]);

  const refresh = useCallback(() => {
    const w = getProgramWeek(weekId);
    setWeek(w);
    setProgram(w ? getProgram(w.program_id) : null);
    setEntries(getWeekEntries(weekId));
  }, [weekId]);

  useEffect(() => { refresh(); }, [refresh]);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  // Persist wizard progress as soon as this week loads, so leaving mid-flow resumes here.
  useEffect(() => {
    if (isWizard && program && week) r.setProgramSetupProgress(program.id, week.week_number);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWizard, program?.id, week?.week_number]);

  const split = program ? r.splits.find((s) => s.id === program.split_id) : undefined;
  const units = split ? r.unitsBySplit[split.id] ?? [] : [];

  // This screen is reached via router.replace() chains during the wizard, which can leave
  // no native "back" entry — so it renders its own close control instead of relying on one.
  const close = () => {
    if (split) router.replace(`/routine/${split.id}`);
    else if (router.canGoBack()) router.back();
  };

  if (!week || !program || !split) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title="Semana não encontrada" onBack={close} />
      </SafeAreaView>
    );
  }

  const goToNextWizardWeek = () => {
    if (!isWizard) return;
    if (isLastWizardWeek) {
      r.setProgramSetupProgress(program.id, null);
      router.replace(`/routine/${wizardSplitId}`);
      return;
    }
    const nextIndex = wizardStep! + 1;
    router.replace({
      pathname: "/routine/program/week/[id]",
      params: { id: String(wizardIds![nextIndex]), wizardWeekIds, wizardIndex: String(nextIndex), wizardSplitId: wizardSplitId! },
    });
  };

  const isDistance = split.modality === "corrida";

  const entryFor = (unitId: number, exerciseId: number) =>
    entries.find((e) => e.unit_id === unitId && e.exercise_id === exerciseId);

  const handleChange = (unitId: number, ex: RoutineUnitExercise, patch: Partial<ProgramEntry>) => {
    const entry = entryFor(unitId, ex.exercise_id);
    r.upsertEntry({
      week_id: weekId,
      unit_id: unitId,
      exercise_id: ex.exercise_id,
      ...mergedValue(ex, entry),
      ...patch,
    });
    refresh();
  };

  const resetToDefault = (entry: ProgramEntry) => {
    r.removeEntry(entry.id);
    refresh();
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader
        title={`Semana ${week.week_number}`}
        showBack={!isWizard}
        onBack={close}
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        {isWizard && (
          <Text className="text-ink-mute text-xs mb-3">
            Semana {wizardStep! + 1} de {wizardIds!.length} · defina o treino de cada dia
          </Text>
        )}
        <TextInput
          value={week.label ?? ""}
          onChangeText={(label) => { r.renameWeek(week.id, label.trim() === "" ? null : label); refresh(); }}
          placeholder="Rótulo (ex.: Semana de recuperação)"
          placeholderTextColor="#bdb8aa"
          className="bg-surface-elevated text-ink rounded-xl px-4 py-3 mb-4"
        />

        {units.map((unit) => {
          const exercises = r.exercisesByUnit[unit.id] ?? [];
          return (
            <View
              key={unit.id}
              className="bg-surface-card rounded-2xl mb-3 p-4"
              style={{ borderWidth: 1, borderColor: "#ddd8ce" }}
            >
              <Text className="text-ink font-semibold text-sm mb-3">{unit.label}</Text>
              {exercises.map((ex) => {
                const entry = entryFor(unit.id, ex.exercise_id);
                const value = mergedValue(ex, entry);
                return (
                  <View key={ex.id} className="mb-3">
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-ink-mute text-xs font-medium flex-1">{ex.exercise_name}</Text>
                      {entry && (
                        <TouchableOpacity onPress={() => resetToDefault(entry)}>
                          <Text className="text-ink-mute text-xs underline">Usar padrão</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {isDistance ? (
                      <RunTargetFields value={value} onChange={(patch) => handleChange(unit.id, ex, patch)} />
                    ) : (
                      <View className="flex-row items-center flex-wrap" style={{ gap: 8 }}>
                        <NumField
                          value={value.target_sets}
                          onChange={(n) => handleChange(unit.id, ex, { target_sets: n })}
                          suffix="séries"
                          integer
                        />
                        <Text className="text-ink-faint text-sm">×</Text>
                        <NumField
                          value={value.target_reps}
                          onChange={(n) => handleChange(unit.id, ex, { target_reps: n })}
                          integer
                        />
                        <Text className="text-ink-faint text-xs">–</Text>
                        <NumField
                          value={value.target_reps_max}
                          onChange={(n) => handleChange(unit.id, ex, { target_reps_max: n })}
                          suffix="reps"
                          integer
                        />
                        <NumField
                          value={value.target_weight_kg}
                          onChange={(n) => handleChange(unit.id, ex, { target_weight_kg: n })}
                          suffix="kg"
                        />
                      </View>
                    )}
                  </View>
                );
              })}
              {exercises.length === 0 && (
                <Text className="text-ink-faint text-xs">Sem exercícios definidos neste dia.</Text>
              )}
            </View>
          );
        })}

        {isWizard && (
          <>
            <TouchableOpacity
              className="mt-2 py-2.5 rounded-xl items-center bg-brand-500"
              onPress={goToNextWizardWeek}
            >
              <Text className="text-white text-sm font-medium">
                {isLastWizardWeek ? "Concluir e ver split" : "Próxima semana →"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity className="mt-4 py-1 items-center" onPress={close}>
              <Text className="text-ink-mute text-sm" style={{ textDecorationLine: "underline" }}>
                Continuar depois
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
