import { View } from "react-native";
import { SectionHeader } from "@/components/SectionHeader";
import { TrendBars } from "@/components/TrendBars";
import { formatDistanceValue, targetKindOf } from "@/data/modalities";
import type { Granularity, Modality } from "@/types";
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
  trend: { label: string; value: number }[];
}

/** SectionHeader (dynamic title from modality+granularity) + TrendBars. Bar
 *  values are canonical (volume in kg, distance in km); the label on the current
 *  bar is rendered in the modality's own units. */
export function AnalyticsTrend({ modality, granularity, trend }: Props) {
  const isStrength = targetKindOf(modality) === "strength";

  return (
    <View>
      <SectionHeader
        title={`${isStrength ? "Volume" : "Distância"} por ${GRANULARITY_WORD[granularity]}`}
      />
      <TrendBars
        bars={trend}
        formatValue={(v) => (isStrength ? formatVolume(v) : formatDistanceValue(v, modality) ?? "—")}
      />
    </View>
  );
}
