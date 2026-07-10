import { useState } from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { UnitCard } from "./UnitCard";
import { ExercisePickerModal } from "./ExercisePickerModal";
import type { DayScheduleEntry, TargetPatch } from "@/hooks/useRoutine";
import type { Exercise, Modality, OverrideStatus, RoutineUnitExercise } from "@/types";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
function fmt(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

interface Props {
  dateISO: string | null;
  schedule: { planned: DayScheduleEntry[]; override: OverrideStatus | null } | null;
  exercisesByUnit: Record<number, RoutineUnitExercise[]>;
  onClose: () => void;
  onRenameUnit: (unitId: number, label: string) => void;
  onAddExercise: (unitId: number, exercise: Exercise) => void;
  onRemoveExercise: (id: number) => void;
  onUpdateTargets: (exerciseId: number, patch: TargetPatch) => void;
  onSetOverride: (date: string, status: OverrideStatus) => void;
  onClearOverride: (date: string) => void;
}

function OverrideButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="px-3 py-2 rounded-xl"
      style={{
        borderWidth: 1,
        borderColor: active ? "#26241f" : "#ddd8ce",
        backgroundColor: active ? "#26241f" : "transparent",
      }}
    >
      <Text style={{ color: active ? "#ffffff" : "#928d80", fontSize: 13, fontWeight: "600" }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function DayDetailModal({
  dateISO,
  schedule,
  exercisesByUnit,
  onClose,
  onRenameUnit,
  onAddExercise,
  onRemoveExercise,
  onUpdateTargets,
  onSetOverride,
  onClearOverride,
}: Props) {
  const [pickerUnitId, setPickerUnitId] = useState<number | null>(null);
  const [pickerModality, setPickerModality] = useState<Modality | undefined>(undefined);
  const [expandedUnitId, setExpandedUnitId] = useState<number | null>(null);
  const open = dateISO != null && schedule != null;
  const override = schedule?.override ?? null;

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-surface">
        <View className="flex-row items-center px-4 py-3">
          <Text className="text-ink font-display font-semibold text-2xl flex-1" style={{ letterSpacing: -0.4 }}>
            {dateISO ? fmt(dateISO) : ""}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text className="text-ink-soft text-base">Fechar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {/* Execution override */}
          <View className="bg-surface-card rounded-2xl p-4 mb-4" style={{ borderWidth: 1, borderColor: "#ddd8ce" }}>
            <Text className="text-ink-mute text-xs" style={{ letterSpacing: 1, fontWeight: "700" }}>
              O QUE ACONTECEU
            </Text>
            <View className="flex-row mt-3" style={{ gap: 8 }}>
              <OverrideButton
                label="Treinei"
                active={override === "trained"}
                onPress={() => dateISO && onSetOverride(dateISO, "trained")}
              />
              <OverrideButton
                label="Descansei"
                active={override === "rest"}
                onPress={() => dateISO && onSetOverride(dateISO, "rest")}
              />
              {override && (
                <OverrideButton label="Limpar" active={false} onPress={() => dateISO && onClearOverride(dateISO)} />
              )}
            </View>
          </View>

          {/* Planned */}
          <Text className="text-ink-mute text-xs mb-2" style={{ letterSpacing: 1, fontWeight: "700" }}>
            PLANEJADO
          </Text>
          {schedule?.planned.map((entry) => {
            if (entry.status === "workout" && entry.unit) {
              const unitId = entry.unit.id;
              return (
                <UnitCard
                  key={entry.split.id}
                  unit={entry.unit}
                  exercises={exercisesByUnit[unitId] ?? []}
                  modality={entry.split.modality}
                  expanded={expandedUnitId === unitId}
                  onToggleExpand={() => setExpandedUnitId(expandedUnitId === unitId ? null : unitId)}
                  onRename={(label) => onRenameUnit(unitId, label)}
                  onAddExercise={() => {
                    setPickerModality("musculacao");
                    setPickerUnitId(unitId);
                  }}
                  onRemoveExercise={onRemoveExercise}
                  onUpdateTargets={onUpdateTargets}
                  badge={entry.split.name}
                />
              );
            }
            return (
              <View
                key={entry.split.id}
                className="bg-surface-card rounded-2xl mb-3 p-4 flex-row items-center justify-between"
                style={{ borderWidth: 1, borderColor: "#ddd8ce" }}
              >
                <Text className="text-ink text-sm font-medium">{entry.split.name}</Text>
                <Text className="text-ink-mute text-sm">Descanso</Text>
              </View>
            );
          })}
          {schedule && schedule.planned.length === 0 && (
            <Text className="text-ink-mute text-sm">Nenhum split configurado.</Text>
          )}
        </ScrollView>

        <ExercisePickerModal
          visible={pickerUnitId != null}
          modality={pickerModality}
          onConfirm={(exs) => {
            if (pickerUnitId != null) exs.forEach((ex) => onAddExercise(pickerUnitId, ex));
          }}
          onClose={() => {
            setPickerUnitId(null);
            setPickerModality(undefined);
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}
