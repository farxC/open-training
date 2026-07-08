import { router, useLocalSearchParams } from "expo-router";
import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "@/hooks/useSessions";
import { deleteSession } from "@/db/queries";
import { confirmAction } from "@/utils/confirm";
import type { WorkoutSet } from "@/types";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function groupByExercise(
  sets: (WorkoutSet & { exercise_name: string })[]
): Record<string, (WorkoutSet & { exercise_name: string })[]> {
  const groups: Record<string, (WorkoutSet & { exercise_name: string })[]> = {};
  for (const set of sets) {
    if (!groups[set.exercise_name]) groups[set.exercise_name] = [];
    groups[set.exercise_name].push(set);
  }
  return groups;
}

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, refresh } = useSession(Number(id));

  if (!session) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center">
        <Text className="text-ink-mute">Session not found.</Text>
      </SafeAreaView>
    );
  }

  const handleDelete = () => {
    confirmAction("Delete session?", "This cannot be undone.", "Delete", () => {
      deleteSession(session.id);
      router.back();
    });
  };

  const grouped = groupByExercise(session.sets);
  const totalVolume = session.sets.reduce(
    (sum, s) => sum + s.reps * s.weight_kg,
    0
  );

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {session.photo_uri && (
          <Image
            source={{ uri: session.photo_uri }}
            className="w-full h-56"
            resizeMode="cover"
          />
        )}

        <View className="px-4 pt-4">
          <View className="flex-row justify-between items-start mb-4">
            <View>
              <Text className="text-ink font-display font-semibold text-2xl" style={{ letterSpacing: -0.4 }}>
                {formatDate(session.date)}
              </Text>
              <Text className="text-ink-mute text-sm">
                Duration: {formatDuration(session.duration_seconds)}
              </Text>
              {totalVolume > 0 && (
                <Text className="text-ink text-sm mt-0.5">
                  {totalVolume.toFixed(0)} kg total volume
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={handleDelete}>
              <Text className="text-red-600 text-sm">Delete</Text>
            </TouchableOpacity>
          </View>

          {session.notes && (
            <Text className="text-ink-mute italic mb-4">{session.notes}</Text>
          )}

          {Object.entries(grouped).map(([exerciseName, sets]) => (
            <View key={exerciseName} className="mb-5">
              <Text className="text-ink font-semibold text-base mb-2">
                {exerciseName}
              </Text>
              {sets.map((s) => (
                <View
                  key={s.id}
                  className="py-2"
                  style={{ borderBottomWidth: 1, borderBottomColor: '#ddd8ce' }}
                >
                  <View className="flex-row items-center">
                    <Text className="text-ink-mute text-sm" style={{ width: 24 }}>{s.set_number}</Text>
                    <Text className="text-ink flex-1 text-sm">
                      {s.weight_kg} kg × {s.reps} reps
                    </Text>
                  </View>
                  {(s.rpe != null || s.rir != null) && (
                    <View className="flex-row mt-0.5" style={{ gap: 12, paddingLeft: 24 }}>
                      {s.rpe != null && (
                        <Text style={{ color: '#5c594f', fontSize: 11 }}>RPE {s.rpe}</Text>
                      )}
                      {s.rir != null && (
                        <Text style={{ color: '#5c594f', fontSize: 11 }}>
                          RIR {s.rir}{s.rir === 0 ? " (failure)" : ""}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              ))}
            </View>
          ))}

          {session.sets.length === 0 && (
            <Text className="text-ink-mute text-center mt-8">
              No sets recorded.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
