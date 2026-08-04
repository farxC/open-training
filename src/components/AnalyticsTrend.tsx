import { useState } from "react";
import { View } from "react-native";
import { DayBreakdownModal } from "@/components/DayBreakdownModal";
import { SectionHeader } from "@/components/SectionHeader";
import { TrendBars } from "@/components/TrendBars";
import { formatDistanceValue, isStrengthCategory, targetKindOf } from "@/data/modalities";
import type { DayBar, DayExerciseBreakdown, Granularity, Modality } from "@/types";
import { formatVolume } from "@/utils/analyticsFormat";

const GRANULARITY_WORD: Record<Granularity, string> = {
  week: "semana",
  month: "mês",
  semester: "semestre",
  year: "ano",
};

interface Props {
  modality: Modality;
  granularity: Granularity;
  /** Bucketed totals — only rendered for endurance modalities in the long views. */
  trend: { label: string; value: number }[];
  /** Seven Mon–Sun bars; populated at week granularity only. */
  dayBars: DayBar[];
  dayBreakdown: (dateISO: string) => DayExerciseBreakdown[];
  /** Today's ISO date — highlighted bar, and the only day worth labelling. */
  todayISO: string;
}

/**
 * The chart slot, which asks a different question per granularity.
 *
 * At week granularity it's one bar per day of the current Mon–Sun week; pressing
 * a day opens its per-exercise breakdown. In the long views only endurance keeps
 * a chart (distance per bucket) — for strength, series per muscle group per week
 * says more than a tonnage-per-month bar, so this renders nothing and the muscle
 * sections below carry the period.
 */
export function AnalyticsTrend({
  modality,
  granularity,
  trend,
  dayBars,
  dayBreakdown,
  todayISO,
}: Props) {
  const [openDay, setOpenDay] = useState<string | null>(null);
  const isStrength = targetKindOf(modality) === "strength";
  const formatValue = (v: number) =>
    isStrength ? formatVolume(v) : formatDistanceValue(v, modality) ?? "—";

  if (granularity === "week") {
    const todayIndex = dayBars.findIndex((b) => b.dateISO === todayISO);

    return (
      <View>
        <SectionHeader title={`${isStrength ? "Volume" : "Distância"} por dia`} />
        <TrendBars
          bars={dayBars}
          formatValue={formatValue}
          highlightIndex={todayIndex >= 0 ? todayIndex : undefined}
          onBarPress={(index) => setOpenDay(dayBars[index].dateISO)}
        />
        <DayBreakdownModal
          dateISO={openDay}
          modality={modality}
          rows={openDay ? dayBreakdown(openDay) : []}
          onClose={() => setOpenDay(null)}
        />
      </View>
    );
  }

  // Gated on the CATEGORY, not the metric: the chart steps aside only where the
  // muscle-group sections take over the long view.
  if (isStrengthCategory(modality)) return null;

  return (
    <View>
      <SectionHeader
        title={`${isStrength ? "Volume" : "Distância"} por ${GRANULARITY_WORD[granularity]}`}
      />
      <TrendBars bars={trend} formatValue={formatValue} />
    </View>
  );
}
