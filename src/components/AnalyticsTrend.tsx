import { View } from "react-native";
import { SectionHeader } from "@/components/SectionHeader";
import { TrendBars } from "@/components/TrendBars";
import type { Granularity, Modality } from "@/types";

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

/** SectionHeader (dynamic title from modality+granularity) + TrendBars. */
export function AnalyticsTrend({ modality, granularity, trend }: Props) {
  const isStrength = modality === "musculacao";

  return (
    <View>
      <SectionHeader
        title={`${isStrength ? "Volume" : "Distância"} por ${GRANULARITY_WORD[granularity]}`}
      />
      <TrendBars bars={trend} />
    </View>
  );
}
