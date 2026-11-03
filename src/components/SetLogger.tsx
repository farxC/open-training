import uiColors from "@/theme/palette.json";
import { useCallback, useEffect, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { ActionButton, IconButton } from "@/components/ui/ActionButton";
import { SetRow } from "./SetRow";
import { ExerciseConfigEditor } from "./ExerciseConfigEditor";
import {
  addSet,
  deleteSet,
  getExerciseConfig,
  getSessionExercise,
  getSetsBySession,
  updateSessionExerciseConfig,
  updateSet,
} from "@/db/queries";
import { exerciseConfigSummary } from "@/data/exerciseConfig";
import type {
  ExerciseConfig,
  RoutineUnitExercise,
  SessionExercise,
  WorkoutSet,
} from "@/types";

interface Props {
  exerciseId: number;
  exerciseName: string;
  sessionId: number;
  onRemoveExercise: () => void;
  targets?: RoutineUnitExercise;
  dragHandleIcon?: React.ReactNode;
  DragHandle?: React.ComponentType<{
    style?: StyleProp<ViewStyle>;
    children?: React.ReactNode;
  }>;
  index?: number;
  onSetsChanged?: () => void;
}

function targetLabel(targets: RoutineUnitExercise): string | null {
  if (!targets.target_sets || targets.target_sets <= 0) return null;
  const reps = targets.target_reps_max
    ? `${targets.target_reps}–${targets.target_reps_max}`
    : `${targets.target_reps}`;
  const weight = targets.target_weight_kg
    ? ` @ ${targets.target_weight_kg}kg`
    : "";
  return `Meta: ${targets.target_sets}×${reps} reps${weight}`;
}

export function SetLogger({
  exerciseId,
  exerciseName,
  sessionId,
  onRemoveExercise,
  targets,
  dragHandleIcon,
  DragHandle,
  index,
  onSetsChanged,
}: Props) {
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [sessionExercise, setSessionExercise] =
    useState<SessionExercise | null>(null);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [draftConfig, setDraftConfig] = useState<ExerciseConfig | null>(null);
  const HandleWrapper = DragHandle ?? View;

  const refreshSets = useCallback(() => {
    setSets(
      getSetsBySession(sessionId).filter((s) => s.exercise_id === exerciseId),
    );
  }, [sessionId, exerciseId]);

  const refreshConfig = useCallback(() => {
    setSessionExercise(getSessionExercise(sessionId, exerciseId));
  }, [sessionId, exerciseId]);

  // Adding an exercise implies at least one set is coming, so seed it instead of
  // making the user tap "+ Add Set" for what's always their first one. Runs once
  // per mount, so deleting the only set afterward doesn't bring it back.
  useEffect(() => {
    const existing = getSetsBySession(sessionId).filter(
      (s) => s.exercise_id === exerciseId,
    );
    if (existing.length === 0) {
      addSet({
        session_id: sessionId,
        exercise_id: exerciseId,
        set_number: 1,
        reps: targets?.target_reps ?? 8,
        weight_kg: targets?.target_weight_kg ?? 0,
        rpe: null,
        rir: null,
        notes: null,
        distance_km: null,
        duration_sec: null,
        pace_sec: null,
        failure: 0,
      });
    }
    refreshSets();
    refreshConfig();
    onSetsChanged?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openConfigEditor = () => {
    if (!sessionExercise) return;
    setDraftConfig(sessionExercise.config);
    setConfigModalVisible(true);
  };

  const saveConfig = () => {
    if (sessionExercise && draftConfig) {
      updateSessionExerciseConfig(sessionExercise.id, draftConfig);
    }
    setConfigModalVisible(false);
    refreshConfig();
  };

  // The snapshot is a copy, so "restore" means re-reading the exercise's current
  // default into the draft — it only reaches the database on save.
  const restoreExerciseDefault = () =>
    setDraftConfig(getExerciseConfig(exerciseId));

  const handleAdd = () => {
    const last = sets[sets.length - 1];
    addSet({
      session_id: sessionId,
      exercise_id: exerciseId,
      set_number: sets.length + 1,
      reps: last?.reps ?? targets?.target_reps ?? 8,
      weight_kg: last?.weight_kg ?? targets?.target_weight_kg ?? 0,
      rpe: null,
      rir: null,
      notes: null,
      distance_km: null,
      duration_sec: null,
      pace_sec: null,
      failure: 0,
    });
    refreshSets();
    onSetsChanged?.();
  };

  const handleChange = (id: number, patch: Partial<WorkoutSet>) => {
    updateSet(id, patch);
    setSets((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    onSetsChanged?.();
  };

  const handleDelete = (id: number) => {
    deleteSet(id);
    refreshSets();
    onSetsChanged?.();
  };

  return (
    <View
      className="mb-5"
      style={{
        backgroundColor: uiColors.white,
        borderWidth: 1,
        borderColor: uiColors.line,
        borderRadius: 12,
        padding: 18,
      }}
    >
      {/* Exercise header */}
      <View className="flex-row justify-between items-center mb-2">
        <HandleWrapper
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            flex: 1,
          }}
        >
          {dragHandleIcon}
          {index != null && (
            <Text
              className="font-sans text-ink-mute text-xs"
              style={{ width: 16 }}
            >
              {index + 1}.
            </Text>
          )}

          <View style={{ flex: 1 }}>
            <Text className="font-sans text-ink font-semibold text-base">
              {exerciseName}
            </Text>
            {targets && targetLabel(targets) && (
              <Text className="font-sans text-ink-mute text-xs mt-0.5">
                {targetLabel(targets)}
              </Text>
            )}
            {sessionExercise && (
              <Text className="font-sans text-ink-mute text-xs mt-0.5">
                {exerciseConfigSummary(sessionExercise.config)}
              </Text>
            )}
          </View>
        </HandleWrapper>
        <View className="flex-row items-center" style={{ gap: 14 }}>
          {sessionExercise && (
            <TouchableOpacity onPress={openConfigEditor} hitSlop={10}>
              <MaterialCommunityIcons
                name="tune-variant"
                size={18}
                color={uiColors.muted}
              />
            </TouchableOpacity>
          )}
          <IconButton
            label={`Remover ${exerciseName}`}
            icon="close"
            onPress={onRemoveExercise}
          />
        </View>
      </View>

      {sets.length > 0 && (
        <View
          style={{
            flexDirection: "row",
            gap: 10,
            marginTop: 14,
            marginBottom: 2,
          }}
        >
          <Text
            className="font-sans"
            style={{ width: 34, fontSize: 10, color: uiColors.muted }}
          >
            SÉRIE
          </Text>
          <Text
            className="font-sans"
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 10,
              color: uiColors.muted,
              letterSpacing: 1,
            }}
          >
            PESO · KG
          </Text>
          <Text
            className="font-sans"
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 10,
              color: uiColors.muted,
              letterSpacing: 1,
            }}
          >
            REPS
          </Text>
          <View style={{ width: 36 }} />
        </View>
      )}

      {sets.map((set) => (
        <SetRow
          key={set.id}
          set={set}
          onChange={(patch) => handleChange(set.id, patch)}
          onDelete={() => handleDelete(set.id)}
        />
      ))}

      <View style={{ marginTop: 8 }}>
        <ActionButton
          label="Adicionar série"
          icon="plus"
          variant="ghost"
          onPress={handleAdd}
        />
      </View>

      <Modal
        visible={configModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setConfigModalVisible(false)}
      >
        <SafeAreaView className="flex-1 bg-surface">
          <View className="flex-row items-center px-4 py-3">
            <Text
              className="text-ink font-display font-semibold text-2xl flex-1"
              style={{ letterSpacing: -0.4 }}
            >
              {exerciseName}
            </Text>
            <TouchableOpacity onPress={() => setConfigModalVisible(false)}>
              <Text className="font-sans text-ink-soft text-base">
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
          {/* Scrollable: the config editor is taller than a phone screen, and in a
              plain View its last sections (and the save button under them) were
              simply cut off. */}
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          >
            {draftConfig && (
              <ExerciseConfigEditor
                value={draftConfig}
                onChange={setDraftConfig}
              />
            )}
            <TouchableOpacity
              className="mt-4 py-3 rounded-xl items-center bg-brand-500"
              onPress={saveConfig}
            >
              <Text className="font-sans text-white font-semibold text-sm">
                Salvar para esta sessão
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="mt-2 py-3 items-center"
              onPress={restoreExerciseDefault}
            >
              <Text className="font-sans text-ink-soft text-sm">
                Restaurar padrão do exercício
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
