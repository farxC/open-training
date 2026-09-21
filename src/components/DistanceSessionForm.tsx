import { useCallback, useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import {
  addSet,
  getSetsBySession,
  updateSet,
} from "@/db/queries";
import {
  continuousDurationSec,
  distanceDisplay,
  formatClock,
  formatDistanceValue,
  formatEffort,
  formatEffortInput,
  fromDisplayDistance,
  modalityLabel,
  parseEffort,
  toDisplayDistance,
} from "@/data/modalities";
import type { Modality, RoutineUnitExercise, WorkoutSet } from "@/types";
import { useTheme } from "@/theme";

interface Props {
  sessionId: number;
  exerciseId: number;
  /** Drives the displayed units (km vs m, pace vs speed). */
  modality: Modality;
  targets?: RoutineUnitExercise;
  onSetsChanged?: () => void;
}

function targetLabel(targets: RoutineUnitExercise, modality: Modality): string | null {
  if (!targets.target_distance_km) return null;
  const distance = formatDistanceValue(targets.target_distance_km, modality);
  const effort = formatEffort(targets.target_pace_sec, modality);
  return `Meta: ${distance}${effort ? ` · ${effort}` : ""}`;
}

interface FieldsProps {
  set: WorkoutSet;
  modality: Modality;
  /** Only set when the session carries more than one leg, to keep them apart. */
  legNumber: number | null;
  onChange: (patch: Partial<Pick<WorkoutSet, "distance_km" | "duration_sec" | "pace_sec">>) => void;
}

/**
 * Distance + effort for one logged leg. Stored values are always canonical
 * (km, seconds-per-km); these fields convert to and from whatever units the
 * modality declares — metres and /100m for natação, km/h for ciclismo.
 */
function DistanceFields({ set, modality, legNumber, onChange }: FieldsProps) {
  const { colors } = useTheme();
  const display = distanceDisplay(modality);
  const [effortText, setEffortText] = useState(() => formatEffortInput(set.pace_sec, modality));

  const handleDistanceChange = (v: string) => {
    const shown = parseFloat(v.replace(",", ".")) || 0;
    const distance = fromDisplayDistance(shown, modality) ?? 0;
    const duration_sec = set.pace_sec != null ? continuousDurationSec(distance, set.pace_sec) : set.duration_sec;
    onChange({ distance_km: distance, duration_sec });
  };

  const handleEffortChange = (v: string) => {
    setEffortText(v);
    const pace = parseEffort(v, modality);
    onChange({ pace_sec: pace, duration_sec: continuousDurationSec(set.distance_km, pace) });
  };

  // Round-trip through the modality's unit can leave float dust (0.05 km ->
  // 50.000000000000004 m); trim it without turning "1500" into "1500.000".
  const shownDistance = toDisplayDistance(set.distance_km, modality);
  const duration = formatClock(set.duration_sec);

  return (
    <View style={{ marginBottom: legNumber != null ? 18 : 0 }}>
      {legNumber != null && (
        <Text className="text-ink-faint text-xs" style={{ marginBottom: 8 }}>
          Trecho {legNumber}
        </Text>
      )}

      <View className="flex-row items-center" style={{ gap: 12, marginBottom: 10 }}>
        <Text className="text-ink-soft text-sm" style={{ width: 84 }}>Distância</Text>
        <View className="flex-row items-center bg-surface-elevated rounded-lg px-3 py-2" style={{ width: 128 }}>
          <TextInput
            className="text-ink flex-1 text-sm"
            value={shownDistance ? String(Number(shownDistance.toFixed(3))) : ""}
            placeholder="0"
            placeholderTextColor={colors["ink-faint"]}
            keyboardType="decimal-pad"
            onChangeText={handleDistanceChange}
          />
          <Text className="text-ink-mute text-xs">{display.distanceUnit}</Text>
        </View>
      </View>

      <View className="flex-row items-center" style={{ gap: 12, marginBottom: 10 }}>
        <Text className="text-ink-soft text-sm" style={{ width: 84 }}>
          {display.effortMode === "speed" ? "Velocidade" : "Pace"}
        </Text>
        <View className="flex-row items-center bg-surface-elevated rounded-lg px-3 py-2" style={{ width: 128 }}>
          <TextInput
            className="text-ink flex-1 text-sm"
            value={effortText}
            placeholder={display.effortPlaceholder}
            placeholderTextColor={colors["ink-faint"]}
            keyboardType={display.effortMode === "speed" ? "decimal-pad" : "default"}
            onChangeText={handleEffortChange}
          />
          <Text className="text-ink-mute text-xs">{display.effortSuffix}</Text>
        </View>
      </View>

      <View className="flex-row items-center" style={{ gap: 12 }}>
        <Text className="text-ink-soft text-sm" style={{ width: 84 }}>Duração</Text>
        <Text className="text-ink text-sm font-medium">{duration || "—"}</Text>
      </View>
    </View>
  );
}

/**
 * The whole body of a distance session. Unlike SetLogger, there is no exercise
 * name, no drag handle and no remove button: the auto-provisioned exercise
 * ("Correr", "Pedalar", …) *is* the session, so letting it be removed or
 * reordered would only ever leave the session with nothing to log.
 */
export function DistanceSessionForm({ sessionId, exerciseId, modality, targets, onSetsChanged }: Props) {
  const { colors } = useTheme();
  const [sets, setSets] = useState<WorkoutSet[]>([]);

  const refreshSets = useCallback(() => {
    setSets(
      getSetsBySession(sessionId).filter((s) => s.exercise_id === exerciseId)
    );
  }, [sessionId, exerciseId]);

  // A distance session always has exactly one thing to log, so seed the entry
  // instead of making the user ask for it. Runs once per mount.
  useEffect(() => {
    const existing = getSetsBySession(sessionId).filter((s) => s.exercise_id === exerciseId);
    if (existing.length === 0) {
      addSet({
        session_id: sessionId,
        exercise_id: exerciseId,
        set_number: 1,
        reps: 0,
        weight_kg: 0,
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
    onSetsChanged?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (id: number, patch: Partial<WorkoutSet>) => {
    updateSet(id, patch);
    setSets((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    onSetsChanged?.();
  };

  // Imported or interval sessions can carry several legs. Nothing here creates
  // or deletes them, but they must not be hidden either.
  const multiLeg = sets.length > 1;
  const totalDistance = sets.reduce((acc, s) => acc + (s.distance_km ?? 0), 0);
  const totalDuration = sets.reduce((acc, s) => acc + (s.duration_sec ?? 0), 0);
  const avgPace = totalDistance > 0 && totalDuration > 0 ? totalDuration / totalDistance : null;

  const label = targets ? targetLabel(targets, modality) : null;

  return (
    <View className="mb-6">
      <Text
        className="text-ink-mute"
        style={{ fontSize: 10, fontWeight: "700", letterSpacing: 1.2, marginBottom: label ? 4 : 12 }}
      >
        {modalityLabel(modality).toUpperCase()}
      </Text>
      {label && (
        <Text className="text-ink-faint text-xs" style={{ marginBottom: 12 }}>{label}</Text>
      )}

      {sets.map((set, i) => (
        <DistanceFields
          key={set.id}
          set={set}
          modality={modality}
          legNumber={multiLeg ? i + 1 : null}
          onChange={(patch) => handleChange(set.id, patch)}
        />
      ))}

      {multiLeg && (
        <View
          className="flex-row items-center"
          style={{ gap: 12, marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors["surface-border"] }}
        >
          <Text className="text-ink-mute text-xs" style={{ width: 84, fontWeight: "700", letterSpacing: 1.2 }}>
            TOTAL
          </Text>
          <Text className="text-ink text-sm font-medium">
            {formatDistanceValue(totalDistance, modality)}
            {totalDuration > 0 ? ` · ${formatClock(totalDuration)}` : ""}
            {formatEffort(avgPace, modality) ? ` · ${formatEffort(avgPace, modality)}` : ""}
          </Text>
        </View>
      )}
    </View>
  );
}
