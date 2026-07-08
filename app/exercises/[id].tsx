import { useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { VolumeChart } from "@/components/VolumeChart";
import { ScreenHeader } from "@/components/ScreenHeader";
import { getExerciseSets } from "@/db/queries";
import { getExercises } from "@/db/queries";

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exerciseId = Number(id);

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
            {exercise.muscle_group} · {exercise.equipment} · {exercise.type}
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
    </SafeAreaView>
  );
}
