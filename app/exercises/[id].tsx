import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionHeader } from "@/components/SectionHeader";
import { ExerciseEditSheet } from "@/components/ExerciseEditSheet";
import { ExerciseProgressChart } from "@/components/ExerciseProgressChart";
import { ExerciseSetHistory } from "@/components/ExerciseSetHistory";
import { ExerciseSpecSheet } from "@/components/ExerciseSpecSheet";
import { ExerciseStatBand, type Stat } from "@/components/ExerciseStatBand";
import { useExercises } from "@/hooks/useExercises";
import { getExerciseSets } from "@/db/queries";
import { MUSCLE_LABELS } from "@/data/muscleGroups";
import { formatDistanceValue, formatEffort, isDistanceModality } from "@/data/modalities";
import { useInteractionState } from "@/hooks/useInteractionState";
import { compactAgo } from "@/utils/dateLabels";
import { daysBetween, todayISO } from "@/utils/cycle";
import { formatVolume } from "@/utils/analyticsFormat";
import { formatKg } from "@/utils/recordsGamification";
import { buildExerciseHistory } from "@/utils/exerciseHistory";

/**
 * One exercise, read as a logbook page.
 *
 * The order is the argument: the sets come first because they're the only thing
 * here that was actually *done* — everything below them (the progression, the
 * spec sheet) exists to explain them. The screen used to open with metadata and
 * a chart and dump the sets at the bottom as undated rows.
 */
export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const exerciseId = Number(id);
  const { exercises, updateConfig, updateMuscleGroups, updateIdentity, archive } = useExercises({
    include_archived: true,
  });

  const [editVisible, setEditVisible] = useState(false);

  const exercise = exercises.find((e) => e.id === exerciseId);
  const parentExercise =
    exercise?.parent_exercise_id != null
      ? exercises.find((e) => e.id === exercise.parent_exercise_id)
      : undefined;
  const sets = getExerciseSets(exerciseId);
  const today = todayISO();

  // Not memoised: the query above is synchronous and re-runs every render anyway,
  // so a memo keyed on the set list would never hit — and one keyed on a proxy
  // (row count) would go stale the moment a set is edited rather than added.
  const history = buildExerciseHistory(sets, exercise?.modality ?? "musculacao");

  if (!exercise) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title="Exercício" fallbackHref="/" />
        <View className="flex-1 items-center justify-center">
          <Text className="text-ink-mute">Exercício não encontrado.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isDistance = isDistanceModality(exercise.modality);
  const daysSinceLast = history.lastDate ? daysBetween(history.lastDate, today) : null;

  const stats: Stat[] = isDistance
    ? [
        {
          label: "MAIOR",
          value: formatDistanceValue(history.bestDistanceKm, exercise.modality) ?? "—",
          strong: true,
        },
        {
          label: "TOTAL",
          value: formatDistanceValue(history.totalDistanceKm, exercise.modality) ?? "—",
        },
        { label: "MELHOR RITMO", value: formatEffort(history.bestPaceSec, exercise.modality) ?? "—" },
        { label: "ÚLTIMO", value: daysSinceLast != null ? compactAgo(daysSinceLast) : "—" },
      ]
    : [
        {
          label: "RECORDE",
          value: history.bestWeightKg != null ? formatKg(history.bestWeightKg) : "—",
          unit: history.bestWeightKg != null ? "kg" : undefined,
          strong: true,
        },
        { label: "SÉRIES", value: String(history.setCount) },
        { label: "VOLUME", value: formatVolume(history.totalVolumeKg) },
        { label: "ÚLTIMO", value: daysSinceLast != null ? compactAgo(daysSinceLast) : "—" },
      ];

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader
        title={exercise.name}
        fallbackHref="/"
        right={<EditButton onPress={() => setEditVisible(true)} />}
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 44 }}>
        {/* The identity line, as marks rather than as a sentence: which muscles
            this pays into is the one thing worth knowing before the numbers. */}
        <View className="flex-row flex-wrap items-center" style={{ gap: 5, marginBottom: 12 }}>
          {exercise.muscle_groups.map((group) => (
            <View
              key={group.muscle_group}
              className="rounded-full"
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderWidth: 1,
                borderColor: "#e7e4dc",
                backgroundColor: "#ffffff",
              }}
            >
              <Text style={{ color: "#5c594f", fontSize: 10.5, fontWeight: "600" }}>
                {MUSCLE_LABELS[group.muscle_group]}
                {group.counting_factor !== 1 ? " ½×" : ""}
              </Text>
            </View>
          ))}
          {exercise.is_archived ? (
            <View
              className="flex-row items-center rounded-full"
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                gap: 4,
                backgroundColor: "#efece5",
                borderWidth: 1,
                borderColor: "#ddd8ce",
              }}
            >
              <MaterialCommunityIcons name="archive-outline" size={10} color="#928d80" />
              <Text style={{ color: "#928d80", fontSize: 10, fontWeight: "700", letterSpacing: 0.6 }}>
                ARQUIVADO
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ marginBottom: 16, alignItems: "flex-start" }}>
          {exercise.parent_exercise_id === null ? (
            <VariationLink
              label="Variações"
              onPress={() => router.push(`/exercises/${exercise.id}/variations`)}
            />
          ) : parentExercise ? (
            <VariationLink
              label={`Variação de: ${parentExercise.name}`}
              onPress={() => router.push(`/exercises/${parentExercise.id}`)}
            />
          ) : null}
        </View>

        <View style={{ marginBottom: 20 }}>
          <ExerciseStatBand stats={stats} />
        </View>

        <SectionHeader title={`Histórico de sets · ${history.setCount}`} />
        <ExerciseSetHistory
          history={history}
          modality={exercise.modality}
          todayISO={today}
          onOpenSession={(sessionId) => router.push(`/session/${sessionId}`)}
        />

        {history.sessions.length > 1 ? (
          <View style={{ marginTop: 22 }}>
            <SectionHeader title="Evolução" />
            <ExerciseProgressChart history={history} modality={exercise.modality} />
          </View>
        ) : null}

        <View style={{ marginTop: 22 }}>
          <SectionHeader
            title="Ficha técnica"
            right={<GhostButton label="editar" onPress={() => setEditVisible(true)} />}
          />
          <ExerciseSpecSheet exercise={exercise} />
        </View>
      </ScrollView>

      <ExerciseEditSheet
        visible={editVisible}
        exercise={exercise}
        setCount={history.setCount}
        actions={{ updateIdentity, updateMuscleGroups, updateConfig, archive }}
        onClose={() => setEditVisible(false)}
        onArchived={() => router.back()}
      />
    </SafeAreaView>
  );
}

/** Section-level action: reads as a control without competing with the section's
 *  own label for attention. */
function GhostButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { hovered, handlers } = useInteractionState();

  return (
    <Pressable
      onPress={onPress}
      {...handlers}
      hitSlop={6}
      accessibilityRole="button"
      className="flex-row items-center rounded-full"
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        gap: 4,
        borderWidth: 1,
        borderColor: hovered ? "#cfcabf" : "#e7e4dc",
        backgroundColor: hovered ? "#ebe7df" : "#ffffff",
      }}
    >
      <MaterialCommunityIcons name="pencil-outline" size={11} color="#5c594f" />
      <Text style={{ color: "#5c594f", fontSize: 10, fontWeight: "700", letterSpacing: 0.4 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Links a root exercise to its "Gerenciar variações" screen, or a variation
 *  back to its parent — same ghost-pill visual language as the section-level
 *  "editar" affordance, but standalone rather than inside a SectionHeader. */
function VariationLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { hovered, handlers } = useInteractionState();

  return (
    <Pressable
      onPress={onPress}
      {...handlers}
      hitSlop={6}
      accessibilityRole="button"
      className="flex-row items-center rounded-full"
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        gap: 4,
        borderWidth: 1,
        borderColor: hovered ? "#cfcabf" : "#e7e4dc",
        backgroundColor: hovered ? "#ebe7df" : "#ffffff",
      }}
    >
      <MaterialCommunityIcons name="source-branch" size={11} color="#5c594f" />
      <Text style={{ color: "#5c594f", fontSize: 10, fontWeight: "700", letterSpacing: 0.4 }}>{label}</Text>
    </Pressable>
  );
}

/** The edit affordance, in the header where a screen-level action belongs — it
 *  used to be a bare "Editar" floating next to the metadata line. */
function EditButton({ onPress }: { onPress: () => void }) {
  const { hovered, handlers } = useInteractionState();

  return (
    <Pressable
      onPress={onPress}
      {...handlers}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Editar exercício"
      className="items-center justify-center rounded-full"
      style={{
        width: 34,
        height: 34,
        borderWidth: 1,
        borderColor: hovered ? "#cfcabf" : "#e7e4dc",
        backgroundColor: hovered ? "#ebe7df" : "#ffffff",
      }}
    >
      <MaterialCommunityIcons name="pencil-outline" size={16} color="#5c594f" />
    </Pressable>
  );
}
