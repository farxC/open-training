import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { VolumeChart } from "@/components/VolumeChart";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ResistanceCurveChart } from "@/components/ResistanceCurveChart";
import { ExerciseConfigEditor } from "@/components/ExerciseConfigEditor";
import { getExerciseSets, getExercises, updateExerciseConfig } from "@/db/queries";
import { muscleGroupLabel } from "@/data/muscleGroups";
import { exerciseConfigSummary } from "@/data/exerciseConfig";
import type { ExerciseConfig } from "@/types";

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exerciseId = Number(id);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [draftConfig, setDraftConfig] = useState<ExerciseConfig | null>(null);

  const exercises = getExercises();
  const exercise = exercises.find((e) => e.id === exerciseId);
  const sets = getExerciseSets(exerciseId);

  const prSet = sets.reduce<(typeof sets)[0] | null>((best, s) => {
    if (!best || s.weight_kg > best.weight_kg) return s;
    return best;
  }, null);

  const volumeByWeek = sets.reduce<Record<string, number>>((acc, s) => {
    const week = s.date.slice(0, 7);
    acc[week] = (acc[week] ?? 0) + s.reps * s.weight_kg;
    return acc;
  }, {});

  const chartData = Object.entries(volumeByWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, volume_kg]) => ({ week, volume_kg }));

  if (!exercise) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title="Exercise" fallbackHref="/" />
        <View className="flex-1 items-center justify-center">
          <Text className="text-ink-mute">Exercise not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader title={exercise.name} fallbackHref="/" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View className="mb-4">
          <Text className="text-ink-mute text-sm capitalize mt-0.5">
            {exercise.muscle_groups.map((g) => muscleGroupLabel(g.muscle_group)).join(", ")} · {exercise.equipment} · {exercise.type}
          </Text>
        </View>

        {prSet && (
          <View className="bg-surface-card rounded-2xl p-4 flex-row items-center mb-4">
            <View className="bg-brand-600 rounded-lg px-2 py-1 mr-3">
              <Text className="text-white text-xs font-bold">PR</Text>
            </View>
            <Text className="text-ink text-sm">
              {prSet.weight_kg} kg × {prSet.reps} reps
            </Text>
          </View>
        )}

        {exercise.modality === "musculacao" && (
          <TouchableOpacity
            className="bg-surface-card rounded-2xl p-4 mb-4"
            onPress={() => {
              setDraftConfig(exercise.config);
              setConfigModalVisible(true);
            }}
          >
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-ink-mute text-xs uppercase tracking-wider">Configuração</Text>
              <Text className="text-ink-soft text-xs">Editar</Text>
            </View>
            <ResistanceCurveChart variant={exercise.config.resistance_curve} />
            <Text className="text-ink-mute text-xs mt-2">{exerciseConfigSummary(exercise.config)}</Text>
          </TouchableOpacity>
        )}

        <Text className="text-ink-mute text-xs uppercase tracking-wider mb-3">
          Volume history
        </Text>
        <VolumeChart data={chartData} />

        <Text className="text-ink-mute text-xs uppercase tracking-wider mt-6 mb-3">
          All sets ({sets.length})
        </Text>

        {sets.length === 0 ? (
          <Text className="text-ink-mute text-center py-8">
            No sets logged for this exercise.
          </Text>
        ) : (
          sets.map((s) => (
            <View
              key={s.id}
              className="flex-row items-center py-2 border-b border-surface-border"
            >
              <Text className="text-ink-mute text-xs w-24">{s.date}</Text>
              <Text className="text-ink text-sm flex-1">
                {s.weight_kg} kg × {s.reps}
              </Text>
              {s.rpe != null && (
                <Text className="text-ink-mute text-xs">RPE {s.rpe}</Text>
              )}
            </View>
          ))
        )}
      </ScrollView>

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
              Configuração
            </Text>
            <TouchableOpacity onPress={() => setConfigModalVisible(false)}>
              <Text className="text-ink-soft text-base">Cancelar</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {draftConfig && (
              <ExerciseConfigEditor mode="default" value={draftConfig} onChange={setDraftConfig} />
            )}
            <TouchableOpacity
              className="mt-4 py-3 rounded-xl items-center bg-brand-500"
              onPress={() => {
                if (draftConfig) updateExerciseConfig(exerciseId, draftConfig);
                setConfigModalVisible(false);
              }}
            >
              <Text className="text-white font-semibold text-sm">Salvar</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
