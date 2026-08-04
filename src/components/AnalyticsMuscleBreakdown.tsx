import { View } from "react-native";
import { MuscleBarList } from "@/components/MuscleBarList";
import { SectionHeader } from "@/components/SectionHeader";
import { formatFrequencyLabel, formatSeriesLabel } from "@/data/muscleGroups";
import type { MuscleFrequencyRow, MuscleSeriesRow } from "@/types";

interface Props {
  /** Series per muscle group — raw weekly totals or a per-week average, per the
   *  window the hook resolved. */
  series: MuscleSeriesRow[];
  /** Sessions per muscle group over the same window. */
  frequency: MuscleFrequencyRow[];
  /** Window caption shared by both lists, e.g. "últimas 4 semanas · 06/07 – 02/08". */
  caption: string;
}

/** The two muscle-group readings, stacked: how much work each group got (series)
 *  and how often it was trained (frequency). Both are scoped to the same window,
 *  which is why they share one caption and one component. */
export function AnalyticsMuscleBreakdown({ series, frequency, caption }: Props) {
  const seriesIsAverage = series[0]?.isAverage ?? false;
  const frequencyIsAverage = frequency[0]?.isAverage ?? false;

  return (
    <>
      <View>
        <SectionHeader title="Séries por grupo muscular" />
        <MuscleBarList
          rows={series}
          caption={caption}
          formatValue={(v) => formatSeriesLabel(v, seriesIsAverage)}
        />
      </View>

      <View style={{ marginTop: 28 }}>
        <SectionHeader title="Frequência por grupo muscular" />
        <MuscleBarList
          rows={frequency}
          caption={caption}
          formatValue={(v) => formatFrequencyLabel(v, frequencyIsAverage)}
        />
      </View>
    </>
  );
}
