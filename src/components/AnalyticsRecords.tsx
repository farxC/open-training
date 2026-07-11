import { router } from "expo-router";
import { Text, View } from "react-native";
import { RecordCard } from "@/components/RecordCard";
import { SectionHeader } from "@/components/SectionHeader";
import { formatClock, formatPaceSec } from "@/data/modalities";
import type { DateRange, Modality, RunningRecords, StrengthRecord } from "@/types";

interface Props {
  modality: Modality;
  strengthRecords: StrengthRecord[];
  runningRecords: RunningRecords;
  /** The active period's date range — badges records achieved within it as "NOVO". */
  currentRange: DateRange;
}

function achievedInRange(dateISO: string | null, range: DateRange): boolean {
  return dateISO != null && dateISO >= range.start && dateISO <= range.end;
}

interface RunningRecordCard {
  key: string;
  icon: string;
  label: string;
  value: string;
  sub?: string;
  isNew: boolean;
}

function buildRunningCards(records: RunningRecords, range: DateRange): RunningRecordCard[] {
  const cards: (RunningRecordCard | false)[] = [
    records.longest_distance_km != null && {
      key: "distance",
      icon: "map-marker-distance",
      label: "Maior distância",
      value: `${records.longest_distance_km.toFixed(1)} km`,
      sub: records.longest_distance_on ?? undefined,
      isNew: achievedInRange(records.longest_distance_on, range),
    },
    records.fastest_pace_sec != null && {
      key: "pace",
      icon: "speedometer",
      label: "Pace mais rápido",
      value: formatPaceSec(records.fastest_pace_sec) ?? "—",
      sub: records.fastest_pace_on ?? undefined,
      isNew: achievedInRange(records.fastest_pace_on, range),
    },
    records.longest_duration_sec != null && {
      key: "duration",
      icon: "timer-outline",
      label: "Maior duração",
      value: formatClock(records.longest_duration_sec),
      sub: records.longest_duration_on ?? undefined,
      isNew: achievedInRange(records.longest_duration_on, range),
    },
  ];

  return cards.filter((c): c is RunningRecordCard => c !== false);
}

/** SectionHeader "Records" + the per-modality RecordCard list, empty state included. */
export function AnalyticsRecords({
  modality,
  strengthRecords,
  runningRecords,
  currentRange,
}: Props) {
  const isStrength = modality === "musculacao";

  return (
    <View>
      <SectionHeader title="Records" />
      {isStrength ? (
        strengthRecords.length > 0 ? (
          strengthRecords.slice(0, 5).map((record) => (
            <RecordCard
              key={record.exercise_id}
              icon="trophy"
              label={record.exercise_name}
              value={`${record.max_weight_kg} kg`}
              sub={`${record.reps_at_max} reps`}
              isNew={achievedInRange(record.achieved_on, currentRange)}
              onPress={() => router.push(`/exercises/${record.exercise_id}`)}
            />
          ))
        ) : (
          <Text className="text-ink-mute text-xs">Nenhum record ainda</Text>
        )
      ) : (
        (() => {
          const cards = buildRunningCards(runningRecords, currentRange);
          return cards.length > 0 ? (
            cards.map((c) => (
              <RecordCard
                key={c.key}
                icon={c.icon}
                label={c.label}
                value={c.value}
                sub={c.sub}
                isNew={c.isNew}
              />
            ))
          ) : (
            <Text className="text-ink-mute text-xs">Nenhum record ainda</Text>
          );
        })()
      )}
    </View>
  );
}
