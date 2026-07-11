import { View } from "react-native";
import { SegmentedControl } from "@/components/SegmentedControl";
import { MODALITIES } from "@/data/modalities";
import type { Granularity, Modality } from "@/types";

const MODALITY_OPTIONS = MODALITIES.map((m) => ({ key: m.key, label: m.label, icon: m.icon }));

const PERIOD_OPTIONS: { key: Granularity; label: string }[] = [
  { key: "week", label: "Semana" },
  { key: "month", label: "Mês" },
  { key: "semester", label: "Semestre" },
  { key: "year", label: "Ano" },
];

interface Props {
  modality: Modality;
  granularity: Granularity;
  onModalityChange: (m: Modality) => void;
  onGranularityChange: (g: Granularity) => void;
}

/** The modality + period segmented controls at the top of the analytics screen. */
export function AnalyticsFilters({
  modality,
  granularity,
  onModalityChange,
  onGranularityChange,
}: Props) {
  return (
    <View>
      <SegmentedControl options={MODALITY_OPTIONS} value={modality} onChange={onModalityChange} />
      <View style={{ marginTop: 8 }}>
        <SegmentedControl<Granularity>
          options={PERIOD_OPTIONS}
          value={granularity}
          onChange={onGranularityChange}
        />
      </View>
    </View>
  );
}
