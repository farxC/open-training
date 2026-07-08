import { useState, type ComponentProps } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { UnitCard } from "@/components/UnitCard";
import { RunPlanTable } from "@/components/RunPlanTable";
import { StrengthPlanTable } from "@/components/StrengthPlanTable";
import { WeekdayPicker } from "@/components/WeekdayPicker";
import { ExercisePickerModal } from "@/components/ExercisePickerModal";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useRoutine } from "@/hooks/useRoutine";
import { modalityConfig, modalityLabel } from "@/data/modalities";
import { confirmAction } from "@/utils/confirm";
import { getProgramWeeks } from "@/db/queries";
import type { RoutineUnit, TrainingProgram } from "@/types";

type MciName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const WD_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]; // getDay 0..6
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun

export default function EditSplitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const r = useRoutine();
  const [expandedUnitId, setExpandedUnitId] = useState<number | null>(null);
  const [pickerUnitId, setPickerUnitId] = useState<number | null>(null);

  const split = r.splits.find((s) => s.id === Number(id));

  if (!split) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title="Split" fallbackHref="/routine" />
        <View className="flex-1 items-center justify-center">
          <Text className="text-ink-mute">Split not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const units = r.unitsBySplit[split.id] ?? [];
  const programs = r.programsBySplit[split.id] ?? [];

  const toggleRest = (wd: number) => {
    const next = split.rest_weekdays.includes(wd)
      ? split.rest_weekdays.filter((d) => d !== wd)
      : [...split.rest_weekdays, wd];
    r.setRestWeekdays(split.id, next);
  };

  const confirmRemoveUnit = (unitId: number) => {
    confirmAction("Excluir dia?", "Este dia e seus exercícios serão removidos.", "Excluir", () =>
      r.removeUnit(unitId)
    );
  };

  const confirmRemoveSplit = () => {
    confirmAction(
      "Excluir split?",
      "Todos os dias e exercícios deste split serão removidos.",
      "Excluir",
      () => {
        r.removeSplit(split.id);
        router.back();
      }
    );
  };

  const resumeSetup = (program: TrainingProgram) => {
    const weeks = getProgramWeeks(program.id);
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

  const unitCardProps = (unit: RoutineUnit, badge: string) => ({
    unit,
    exercises: r.exercisesByUnit[unit.id] ?? [],
    modality: split.modality,
    expanded: expandedUnitId === unit.id,
    onToggleExpand: () => setExpandedUnitId(expandedUnitId === unit.id ? null : unit.id),
    onRename: (label: string) => r.renameUnit(unit.id, label),
    onAddExercise: () => setPickerUnitId(unit.id),
    onRemoveExercise: r.removeExercise,
    onUpdateTargets: r.updateExerciseTargets,
    badge,
    onDelete: () => confirmRemoveUnit(unit.id),
  });

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader
        fallbackHref="/routine"
        titleNode={
          <TextInput
            value={split.name}
            onChangeText={(v) => r.renameSplit(split.id, v)}
            placeholder="Nome do split"
            placeholderTextColor="#bdb8aa"
            className="text-ink font-display font-semibold text-2xl"
          />
        }
        right={
          <TouchableOpacity onPress={confirmRemoveSplit} className="p-1">
            <MaterialCommunityIcons name="trash-can-outline" size={20} color="#dc2626" />
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <View
          className="flex-row items-center self-start px-2 py-1 rounded-full mb-4"
          style={{ backgroundColor: "#ebe7df", gap: 4 }}
        >
          <MaterialCommunityIcons
            name={modalityConfig(split.modality).icon as MciName}
            size={13}
            color="#5c594f"
          />
          <Text className="text-ink-mute text-xs">
            {modalityLabel(split.modality)} · {split.mode === "cyclic" ? "Cíclico" : "Semanal"}
          </Text>
        </View>

        <Text className="text-ink-mute text-xs mb-2" style={{ letterSpacing: 1, fontWeight: "700" }}>
          PLANOS
        </Text>
        {programs.length === 0 && split.modality === "corrida" && (
          <View
            className="rounded-2xl p-4 mb-3"
            style={{ borderWidth: 1, borderColor: "#c9502b", backgroundColor: "#fbe9e2" }}
          >
            <Text className="text-sm font-medium mb-2" style={{ color: "#8a3319" }}>
              Este split de corrida precisa de um plano.
            </Text>
            <TouchableOpacity
              className="self-start px-3 py-2 rounded-xl"
              style={{ backgroundColor: "#8a3319" }}
              onPress={() => router.push({ pathname: "/routine/program/new", params: { splitId: String(split.id) } })}
            >
              <Text className="text-white text-sm font-medium">Criar plano</Text>
            </TouchableOpacity>
          </View>
        )}
        {programs.map((program) => (
          <View
            key={program.id}
            className="mb-2 px-4 py-3 rounded-2xl"
            style={{ borderWidth: 1, borderColor: "#ddd8ce" }}
          >
            <TouchableOpacity
              className="flex-row items-center justify-between"
              onPress={() => router.push(`/routine/program/${program.id}`)}
            >
              <Text className="text-ink text-sm font-medium flex-1">{program.name}</Text>
              <Text className="text-ink-mute text-xs">
                {program.total_weeks} semanas{program.is_active ? " · Ativo" : ""}
              </Text>
            </TouchableOpacity>
            {program.setup_week_number != null && (
              <TouchableOpacity
                className="mt-2 self-start px-3 py-1.5 rounded-full"
                style={{ backgroundColor: "#ebe7df" }}
                onPress={() => resumeSetup(program)}
              >
                <Text className="text-ink-mute text-xs font-medium">
                  Continuar mapeamento · Semana {program.setup_week_number}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        {programs.length === 0 && split.modality !== "corrida" && (
          <Text className="text-ink-faint text-sm mb-2">Nenhum plano ainda.</Text>
        )}
        <TouchableOpacity
          className="mb-4 py-2.5 rounded-xl items-center"
          style={{ borderWidth: 1, borderColor: "#c9c3b6", borderStyle: "dashed" }}
          onPress={() => router.push({ pathname: "/routine/program/new", params: { splitId: String(split.id) } })}
        >
          <Text className="text-ink text-sm font-medium">+ Novo plano</Text>
        </TouchableOpacity>

        {split.mode === "cyclic" ? (
          <>
            <Text className="text-ink-mute text-xs mb-2" style={{ letterSpacing: 1, fontWeight: "700" }}>
              DIAS FIXOS DE DESCANSO
            </Text>
            <View className="mb-3">
              <WeekdayPicker selected={split.rest_weekdays} onToggle={toggleRest} />
            </View>

            <TouchableOpacity
              className="py-2.5 rounded-xl items-center bg-brand-500 mb-3"
              onPress={() => r.startSplitCycle(split.id)}
            >
              <Text className="text-white font-semibold text-sm">
                {split.anchor_date
                  ? `Reiniciar ciclo (hoje = dia 1) · desde ${split.anchor_date}`
                  : "Iniciar ciclo (hoje = dia 1)"}
              </Text>
            </TouchableOpacity>

            {split.modality === "corrida" ? (
              <RunPlanTable
                units={units}
                exercisesByUnit={r.exercisesByUnit}
                expandedUnitId={expandedUnitId}
                onToggleExpand={(uid) => setExpandedUnitId(expandedUnitId === uid ? null : uid)}
                onRename={(uid, label) => r.renameUnit(uid, label)}
                onUpdateTargets={r.updateExerciseTargets}
                onMoveUp={(uid) => r.reorderUnit(uid, "up")}
                onMoveDown={(uid) => r.reorderUnit(uid, "down")}
                onDelete={confirmRemoveUnit}
              />
            ) : (
              <StrengthPlanTable
                units={units}
                exercisesByUnit={r.exercisesByUnit}
                expandedUnitId={expandedUnitId}
                onToggleExpand={(uid) => setExpandedUnitId(expandedUnitId === uid ? null : uid)}
                onRename={(uid, label) => r.renameUnit(uid, label)}
                onAddExercise={(uid) => setPickerUnitId(uid)}
                onRemoveExercise={r.removeExercise}
                onUpdateTargets={r.updateExerciseTargets}
                onMoveUp={(uid) => r.reorderUnit(uid, "up")}
                onMoveDown={(uid) => r.reorderUnit(uid, "down")}
                onDelete={confirmRemoveUnit}
              />
            )}

            <TouchableOpacity
              className="py-3 rounded-xl items-center"
              style={{ borderWidth: 1, borderColor: "#c9c3b6", borderStyle: "dashed" }}
              onPress={() => r.addUnit(split)}
            >
              <Text className="text-ink text-sm font-medium">+ Adicionar dia ao ciclo</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {WEEK_ORDER.map((wd) => {
              const unit = units.find((u) => u.ordinal === wd);
              if (unit) {
                return <UnitCard key={unit.id} {...unitCardProps(unit, WD_SHORT[wd])} />;
              }
              return (
                <View
                  key={`wd-${wd}`}
                  className="flex-row items-center justify-between mb-3 px-4 py-3 rounded-2xl"
                  style={{ borderWidth: 1, borderColor: "#ddd8ce", borderStyle: "dashed" }}
                >
                  <Text className="text-ink-mute text-sm">{WD_SHORT[wd]} · livre</Text>
                  <TouchableOpacity
                    onPress={() => r.addUnit(split, { ordinal: wd, label: split.name })}
                  >
                    <Text className="text-ink text-sm font-medium">+ Adicionar</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      <ExercisePickerModal
        visible={pickerUnitId != null}
        modality="musculacao"
        onSelect={(ex) => {
          if (pickerUnitId != null) r.addExercise(pickerUnitId, ex);
        }}
        onClose={() => setPickerUnitId(null)}
      />
    </SafeAreaView>
  );
}
