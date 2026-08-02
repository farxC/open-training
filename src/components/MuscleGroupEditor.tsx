import { Text, TouchableOpacity, View } from "react-native";
import { MUSCLE_LABELS, MUSCLE_OPTIONS } from "@/data/muscleGroups";
import { ModalityToggle } from "@/components/ModalityToggle";
import type { ExerciseMuscleGroup, MuscleGroup } from "@/types";

// How much of a full set each selected muscle earns. Deliberately two values,
// matching the CHECK on exercise_muscle_groups.counting_factor.
const FACTOR_OPTIONS = [
  { key: "1", label: "1×" },
  { key: "0.5", label: "½×" },
] as const;

interface Props {
  /** Selected groups keyed by muscle, valued by counting factor. */
  value: Map<MuscleGroup, number>;
  onChange: (next: Map<MuscleGroup, number>) => void;
  title?: string;
}

/** Picks an exercise's muscle groups and how much a set counts toward each.
 *  Shared by the exercise picker's inline edit and the exercise detail screen. */
export function MuscleGroupEditor({ value, onChange, title = "Grupo muscular" }: Props) {
  const toggle = (mg: MuscleGroup) => {
    const next = new Map(value);
    if (next.has(mg)) next.delete(mg);
    else next.set(mg, 1);
    onChange(next);
  };

  const setFactor = (mg: MuscleGroup, factor: number) => {
    onChange(new Map(value).set(mg, factor));
  };

  return (
    <View>
      <Text className="text-ink-mute text-xs mb-2" style={{ letterSpacing: 1, fontWeight: "700" }}>
        {title.toUpperCase()}
      </Text>
      <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
        {MUSCLE_OPTIONS.map((mg) => {
          const on = value.has(mg);
          return (
            <View key={mg} style={{ alignItems: "flex-start" }}>
              <TouchableOpacity
                className="px-3 py-1.5 rounded-full"
                style={{
                  borderWidth: 1,
                  borderColor: on ? "#26241f" : "#ddd8ce",
                  backgroundColor: on ? "#26241f" : "transparent",
                }}
                onPress={() => toggle(mg)}
              >
                <Text style={{ color: on ? "#ffffff" : "#928d80", fontSize: 12, fontWeight: "600" }}>
                  {MUSCLE_LABELS[mg]}
                </Text>
              </TouchableOpacity>
              {on && (
                <View style={{ marginTop: 4 }}>
                  <ModalityToggle
                    compact
                    stretch={false}
                    options={FACTOR_OPTIONS as unknown as { key: string; label: string }[]}
                    value={String(value.get(mg))}
                    onChange={(k) => setFactor(mg, Number(k))}
                  />
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Map form used by the editor, from the row form used by the database. */
export function toMuscleMap(groups: ExerciseMuscleGroup[]): Map<MuscleGroup, number> {
  return new Map(groups.map((g) => [g.muscle_group, g.counting_factor]));
}

/** Row form used by the database, from the map form used by the editor. */
export function fromMuscleMap(map: Map<MuscleGroup, number>): ExerciseMuscleGroup[] {
  return Array.from(map.entries()).map(([muscle_group, counting_factor]) => ({
    muscle_group,
    counting_factor,
  }));
}
