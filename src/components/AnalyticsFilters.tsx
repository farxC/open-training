import { ScrollView, View } from "react-native";
import { FilterChip } from "@/components/ui/ActionButton";
import { PeriodChips } from "@/components/PeriodChips";
import { MODALITIES } from "@/data/modalities";
import type { Granularity, Modality } from "@/types";

const PERIOD_OPTIONS: { key: Granularity; label: string }[] = [
  { key: "week", label: "Semana" },
  { key: "month", label: "Mês" },
  { key: "semester", label: "Semestre" },
  { key: "year", label: "Ano" },
];
interface Props {
  modality: Modality;
  granularity: Granularity;
  onModalityChange: (value: Modality) => void;
  onGranularityChange: (value: Granularity) => void;
}

export function AnalyticsFilters({
  modality,
  granularity,
  onModalityChange,
  onGranularityChange,
}: Props) {
  return (
    <View style={{ gap: 14, marginBottom: 22 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {MODALITIES.map((item) => (
          <FilterChip
            key={item.key}
            label={item.label}
            active={modality === item.key}
            onPress={() => onModalityChange(item.key)}
          />
        ))}
      </ScrollView>
      <PeriodChips<Granularity>
        options={PERIOD_OPTIONS}
        value={granularity}
        onChange={onGranularityChange}
      />
    </View>
  );
}
