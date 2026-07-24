import { useCallback, useEffect, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Modal, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
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
import type { ExerciseConfig, ExerciseConfigOverride, RoutineUnitExercise, SessionExercise, WorkoutSet } from "@/types";

interface Props {
  exerciseId: number;
  exerciseName: string;
  sessionId: number;
  onRemoveExercise: () => void;
  targets?: RoutineUnitExercise;
  dragHandleIcon?: React.ReactNode;
  DragHandle?: React.ComponentType<{ style?: StyleProp<ViewStyle>; children?: React.ReactNode }>;
  index?: number;
  onSetsChanged?: () => void;
}

function targetLabel(targets: RoutineUnitExercise): string | null {
  if (!targets.target_sets || targets.target_sets <= 0) return null;
  const reps = targets.target_reps_max
    ? `${targets.target_reps}–${targets.target_reps_max}`
    : `${targets.target_reps}`;
  const weight = targets.target_weight_kg ? ` @ ${targets.target_weight_kg}kg` : "";
  return `Meta: ${targets.target_sets}×${reps} reps${weight}`;
}

export function SetLogger({ exerciseId, exerciseName, sessionId, onRemoveExercise, targets, dragHandleIcon, DragHandle, index, onSetsChanged }: Props) {
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [sessionExercise, setSessionExercise] = useState<SessionExercise | null>(null);
  const [exerciseDefaultConfig, setExerciseDefaultConfig] = useState<ExerciseConfig | null>(null);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [draftOverride, setDraftOverride] = useState<ExerciseConfigOverride | null>(null);
  const HandleWrapper = DragHandle ?? View;

  const refreshSets = useCallback(() => {
    setSets(
      getSetsBySession(sessionId).filter((s) => s.exercise_id === exerciseId)
    );
  }, [sessionId, exerciseId]);

  const refreshConfig = useCallback(() => {
    setSessionExercise(getSessionExercise(sessionId, exerciseId));
    setExerciseDefaultConfig(getExerciseConfig(exerciseId));
  }, [sessionId, exerciseId]);

  // Adding an exercise implies at least one set is coming, so seed it instead of
  // making the user tap "+ Add Set" for what's always their first one. Runs once
  // per mount, so deleting the only set afterward doesn't bring it back.
  useEffect(() => {
    const existing = getSetsBySession(sessionId).filter((s) => s.exercise_id === exerciseId);
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
    setDraftOverride(sessionExercise.config_override);
    setConfigModalVisible(true);
  };

  const saveConfigOverride = () => {
    if (sessionExercise && draftOverride) {
      updateSessionExerciseConfig(sessionExercise.id, draftOverride);
    }
    setConfigModalVisible(false);
    refreshConfig();
  };

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
    <View className="mb-5">
      {/* Exercise header */}
      <View className="flex-row justify-between items-center mb-2">
        <HandleWrapper style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          {dragHandleIcon}
          {index != null && (
            <Text className="text-ink-mute text-xs" style={{ width: 16 }}>{index + 1}.</Text>
          )}
          <View style={{ width: 2, height: 14, backgroundColor: '#26241f', borderRadius: 1 }} />
          <View>
            <Text className="text-ink font-semibold text-base">{exerciseName}</Text>
            {targets && targetLabel(targets) && (
              <Text className="text-ink-faint text-xs mt-0.5">{targetLabel(targets)}</Text>
            )}
            {sessionExercise && (
              <Text className="text-ink-faint text-xs mt-0.5">
                {exerciseConfigSummary(sessionExercise.config)}
              </Text>
            )}
          </View>
        </HandleWrapper>
        <View className="flex-row items-center" style={{ gap: 14 }}>
          {sessionExercise && (
            <TouchableOpacity onPress={openConfigEditor} hitSlop={10}>
              <MaterialCommunityIcons name="tune-variant" size={18} color="#928d80" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onRemoveExercise}>
            <Text className="text-ink-mute text-sm">Remove</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Column headers */}
      {sets.length > 0 && (
        <View className="flex-row mb-1" style={{ gap: 8, paddingLeft: 0 }}>
          <Text className="text-ink-mute text-xs text-center" style={{ width: 20 }}>#</Text>
          <Text className="text-ink-mute text-xs flex-1 text-center">Weight</Text>
          <Text className="text-ink-mute text-xs" style={{ width: 12 }} />
          <Text className="text-ink-mute text-xs flex-1 text-center">Reps</Text>
          <Text style={{ width: 20 }} />
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

      <TouchableOpacity
        className="mt-2 py-2.5 rounded-lg items-center"
        style={{ borderWidth: 1, borderColor: '#c9c3b6', borderStyle: 'dashed' }}
        onPress={handleAdd}
      >
        <Text className="text-ink text-sm">+ Add Set</Text>
      </TouchableOpacity>

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
              <Text className="text-ink-soft text-base">Cancelar</Text>
            </TouchableOpacity>
          </View>
          <View className="px-4">
            {draftOverride && exerciseDefaultConfig && (
              <ExerciseConfigEditor
                mode="override"
                value={draftOverride}
                defaultConfig={exerciseDefaultConfig}
                onChange={setDraftOverride}
              />
            )}
            <TouchableOpacity
              className="mt-4 py-3 rounded-xl items-center bg-brand-500"
              onPress={saveConfigOverride}
            >
              <Text className="text-white font-semibold text-sm">Salvar apenas para esta sessão</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
