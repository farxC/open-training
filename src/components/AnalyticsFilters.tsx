import { Text, useWindowDimensions, View } from "react-native";
import { ModalityToggle } from "@/components/ModalityToggle";
import { PeriodChips } from "@/components/PeriodChips";
import { PeriodTabs } from "@/components/PeriodTabs";
import { MODALITIES } from "@/data/modalities";
import type { Granularity, Modality } from "@/types";

const MODALITY_OPTIONS = MODALITIES.map((m) => ({ key: m.key, label: m.label, icon: m.icon }));

const PERIOD_OPTIONS: { key: Granularity; label: string }[] = [
  { key: "week", label: "Semana" },
  { key: "month", label: "Mês" },
  { key: "semester", label: "Semestre" },
  { key: "year", label: "Ano" },
];

/** Wide viewports (desktop browser) get the side-by-side toolbar layout. */
const DESKTOP_MIN_WIDTH = 840;

interface Props {
  modality: Modality;
  granularity: Granularity;
  onModalityChange: (m: Modality) => void;
  onGranularityChange: (g: Granularity) => void;
}

function FilterLabel({ children }: { children: string }) {
  return (
    <Text
      style={{ color: "#928d80", fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginBottom: 8 }}
    >
      {children}
    </Text>
  );
}

/** The modality + period controls at the top of the analytics screen. */
export function AnalyticsFilters({
  modality,
  granularity,
  onModalityChange,
  onGranularityChange,
}: Props) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_MIN_WIDTH;

  if (isDesktop) {
    // Desktop: one toolbar row — compact modality toggle left, period chips right.
    return (
      <View
        className="bg-surface-card rounded-2xl"
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          paddingVertical: 16,
          paddingHorizontal: 20,
        }}
      >
        <View>
          <FilterLabel>MODALIDADE</FilterLabel>
          <ModalityToggle
            options={MODALITY_OPTIONS}
            value={modality}
            onChange={onModalityChange}
            stretch={false}
          />
        </View>

        <View style={{ alignItems: "flex-end" }}>
          <FilterLabel>PERÍODO</FilterLabel>
          <PeriodChips<Granularity>
            options={PERIOD_OPTIONS}
            value={granularity}
            onChange={onGranularityChange}
          />
        </View>
      </View>
    );
  }

  // Mobile / narrow: stacked, full-width touch controls.
  return (
    <View className="bg-surface-card rounded-2xl p-4">
      <FilterLabel>MODALIDADE</FilterLabel>
      <ModalityToggle options={MODALITY_OPTIONS} value={modality} onChange={onModalityChange} />

      <View style={{ height: 1, backgroundColor: "#f0ede6", marginVertical: 16 }} />

      <FilterLabel>PERÍODO</FilterLabel>
      <PeriodTabs<Granularity>
        options={PERIOD_OPTIONS}
        value={granularity}
        onChange={onGranularityChange}
      />
    </View>
  );
}
