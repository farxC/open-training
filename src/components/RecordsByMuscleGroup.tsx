import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { RecordCard } from "@/components/RecordCard";
import { muscleGroupLabel } from "@/data/muscleGroups";
import type { DateRange } from "@/types";
import { UNGROUPED_KEY, type MuscleRecordGroup } from "@/utils/analyticsRecords";

interface Props {
  groups: MuscleRecordGroup[];
  /** The active window — badges records achieved within it as "NOVO". */
  currentRange: DateRange;
}

function achievedInRange(dateISO: string | null, range: DateRange): boolean {
  return dateISO != null && dateISO >= range.start && dateISO <= range.end;
}

function groupLabel(key: string): string {
  return key === UNGROUPED_KEY ? "Sem grupo" : muscleGroupLabel(key);
}

/** Records filed by muscle group, one group expanded at a time. Collapsed by
 *  default: with ~70 exercises the flat list buried everything below the first
 *  five, and the muscle group is how you actually go looking for a lift. */
export function RecordsByMuscleGroup({ groups, currentRange }: Props) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  if (groups.length === 0) {
    return <Text className="text-ink-mute text-xs">Nenhum record ainda</Text>;
  }

  return (
    <View>
      {groups.map((group) => {
        const isOpen = openGroup === group.muscle_group;

        return (
          <View key={group.muscle_group} style={{ marginBottom: 8 }}>
            <TouchableOpacity
              onPress={() => setOpenGroup(isOpen ? null : group.muscle_group)}
              activeOpacity={0.7}
              className="bg-surface-card rounded-xl px-4 py-3 flex-row items-center"
              style={{ gap: 10 }}
            >
              <Text className="text-ink text-sm flex-1" numberOfLines={1}>
                {groupLabel(group.muscle_group)}
              </Text>
              <Text className="text-ink-mute text-xs">
                {group.records.length} {group.records.length === 1 ? "exercício" : "exercícios"}
              </Text>
              <MaterialCommunityIcons
                name={isOpen ? "chevron-up" : "chevron-down"}
                size={20}
                color="#bdb8aa"
              />
            </TouchableOpacity>

            {isOpen ? (
              <View style={{ marginTop: 8, paddingLeft: 12 }}>
                {group.records.map((record) => (
                  <RecordCard
                    key={record.exercise_id}
                    icon="trophy"
                    label={record.exercise_name}
                    value={`${record.max_weight_kg} kg`}
                    sub={`${record.reps_at_max} reps`}
                    isNew={achievedInRange(record.achieved_on, currentRange)}
                    onPress={() => router.push(`/exercises/${record.exercise_id}`)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
