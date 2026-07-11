import { Text, View } from "react-native";
import { ComparisonTile } from "@/components/ComparisonTile";
import { SectionHeader } from "@/components/SectionHeader";
import { formatPaceSec } from "@/data/modalities";
import type { RunningSummary, StrengthSummary } from "@/types";
import { delta } from "@/utils/analyticsAgg";
import { formatCount, formatDeltaText, formatDistance, formatVolume } from "@/utils/analyticsFormat";

type Props =
  | { modality: "musculacao"; current: StrengthSummary; previous: StrengthSummary }
  | { modality: "corrida"; current: RunningSummary; previous: RunningSummary };

/** The "vs período anterior" hero: 3 ComparisonTiles for the active modality. */
export function AnalyticsSummary(props: Props) {
  return (
    <View>
      <SectionHeader title="Resumo" />
      <View className="flex-row" style={{ gap: 8 }}>
        {props.modality === "musculacao" ? (
          <StrengthTiles current={props.current} previous={props.previous} />
        ) : (
          <RunningTiles current={props.current} previous={props.previous} />
        )}
      </View>
      <Text className="text-ink-mute" style={{ fontSize: 10, marginTop: 6 }}>
        vs período anterior
      </Text>
    </View>
  );
}

function StrengthTiles({
  current,
  previous,
}: {
  current: StrengthSummary;
  previous: StrengthSummary;
}) {
  const volumeDelta = delta(current.volume, previous.volume, true);
  const sessionDelta = delta(current.sessionCount, previous.sessionCount, true);
  const maxWeightDelta = delta(current.maxWeight, previous.maxWeight, true);

  return (
    <>
      <ComparisonTile
        label="Volume"
        value={formatVolume(current.volume)}
        deltaText={formatDeltaText(volumeDelta, "percent")}
        better={volumeDelta.better}
      />
      <ComparisonTile
        label="Treinos"
        value={formatCount(current.sessionCount)}
        deltaText={formatDeltaText(sessionDelta, "count")}
        better={sessionDelta.better}
      />
      <ComparisonTile
        label="Carga máx"
        value={`${current.maxWeight} kg`}
        deltaText={formatDeltaText(maxWeightDelta, "percent")}
        better={maxWeightDelta.better}
      />
    </>
  );
}

function RunningTiles({
  current,
  previous,
}: {
  current: RunningSummary;
  previous: RunningSummary;
}) {
  const distanceDelta = delta(current.distance, previous.distance, true);
  const runCountDelta = delta(current.runCount, previous.runCount, true);
  const hasPace = current.avgPaceSec != null;
  const paceDelta = hasPace
    ? delta(current.avgPaceSec as number, previous.avgPaceSec ?? 0, false)
    : null;

  return (
    <>
      <ComparisonTile
        label="Distância"
        value={formatDistance(current.distance)}
        deltaText={formatDeltaText(distanceDelta, "percent")}
        better={distanceDelta.better}
      />
      <ComparisonTile
        label="Pace médio"
        value={formatPaceSec(current.avgPaceSec) ?? "—"}
        deltaText={paceDelta ? formatDeltaText(paceDelta, "pace") : null}
        better={paceDelta?.better ?? null}
      />
      <ComparisonTile
        label="Corridas"
        value={formatCount(current.runCount)}
        deltaText={formatDeltaText(runCountDelta, "count")}
        better={runCountDelta.better}
      />
    </>
  );
}
