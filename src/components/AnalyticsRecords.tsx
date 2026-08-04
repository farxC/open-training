import { Text, View } from "react-native";
import { RecordCard } from "@/components/RecordCard";
import { RecordsByMuscleGroup } from "@/components/RecordsByMuscleGroup";
import { SectionHeader } from "@/components/SectionHeader";
import {
  distanceDisplay,
  formatClock,
  formatDistanceValue,
  formatEffort,
  targetKindOf,
} from "@/data/modalities";
import type { DateRange, DistanceRecords, Modality } from "@/types";
import type { MuscleRecordGroup } from "@/utils/analyticsRecords";
import { achievedInRange } from "@/utils/recordsGamification";

interface Props {
  modality: Modality;
  /** Strength records already grouped by the exercise's current muscle groups. */
  recordsByGroup: MuscleRecordGroup[];
  distanceRecords: DistanceRecords;
  /** The active window — badges records achieved within it as "NOVO". */
  currentRange: DateRange;
  /** Exercises whose load has climbed repeatedly of late — the "QUENTE" stamp. */
  hotExercises: ReadonlySet<number>;
}

function formatBrazilianDateFormat (date: string | null): string{
  if (date == null) return ''
  const dateFormat = new Date(date + "T00:00:00")
  return new Intl.DateTimeFormat("pt-BR").format(dateFormat)
}

interface DistanceRecordCard {
  key: string;
  icon: string;
  label: string;
  value: string;
  sub?: string;
  isNew: boolean;
}

function buildDistanceCards(
  records: DistanceRecords,
  modality: Modality,
  range: DateRange
): DistanceRecordCard[] {
  const cards: (DistanceRecordCard | false)[] = [
    records.longest_distance_km != null && {
      key: "distance",
      icon: "map-marker-distance",
      label: "Maior distância",
      value: formatDistanceValue(records.longest_distance_km, modality) ?? "—",
      sub: formatBrazilianDateFormat(records.longest_distance_on) ?? undefined,
      isNew: achievedInRange(records.longest_distance_on, range),
    },
    records.fastest_pace_sec != null && {
      key: "pace",
      icon: "speedometer",
      label: distanceDisplay(modality).effortRecordLabel,
      value: formatEffort(records.fastest_pace_sec, modality) ?? "—",
      sub: formatBrazilianDateFormat(records.fastest_pace_on) ?? undefined,
      isNew: achievedInRange(records.fastest_pace_on, range),
    },
    records.longest_duration_sec != null && {
      key: "duration",
      icon: "timer-outline",
      label: "Maior duração",
      value: formatClock(records.longest_duration_sec),
      sub: formatBrazilianDateFormat(records.longest_duration_on) ?? undefined,
      isNew: achievedInRange(records.longest_duration_on, range),
    },
  ];

  return cards.filter((c): c is DistanceRecordCard => c !== false);
}

/** SectionHeader "Records" + the per-modality body: a muscle-group accordion for
 *  strength, a flat card list for distance. */
export function AnalyticsRecords({
  modality,
  recordsByGroup,
  distanceRecords,
  currentRange,
  hotExercises,
}: Props) {
  const isStrength = targetKindOf(modality) === "strength";

  return (
    <View>
      <SectionHeader title="Records" />
      {isStrength ? (
        <RecordsByMuscleGroup
          groups={recordsByGroup}
          currentRange={currentRange}
          hotExercises={hotExercises}
        />
      ) : (
        (() => {
          const cards = buildDistanceCards(distanceRecords, modality, currentRange);
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
