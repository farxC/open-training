import { Text, View } from "react-native";
import { ComparisonTile } from "@/components/ComparisonTile";
import { SectionHeader } from "@/components/SectionHeader";
import { distanceDisplay, formatDistanceValue, formatEffort, modalityConfig } from "@/data/modalities";
import type { DistanceSummary, Modality, StrengthSummary } from "@/types";
import { delta } from "@/utils/analyticsAgg";
import { formatCount, formatDeltaText, formatVolume } from "@/utils/analyticsFormat";

type Props = { comparisonLabel: string } & (
  | { kind: "strength"; modality: Modality; current: StrengthSummary; previous: StrengthSummary }
  | { kind: "distance"; modality: Modality; current: DistanceSummary; previous: DistanceSummary }
);

/** The comparison hero: ComparisonTiles for the active modality, plus a caption
 *  naming the two windows being compared — "últimas 4 semanas vs 4 anteriores"
 *  says more than a generic "vs período anterior" once the window is rolling. */
export function AnalyticsSummary(props: Props) {
  return (
    <View>
      <SectionHeader title="Resumo" />
      <View className="flex-row" style={{ gap: 8 }}>
        {props.kind === "strength" ? (
          <StrengthTiles modality={props.modality} current={props.current} previous={props.previous} />
        ) : (
          <DistanceTiles modality={props.modality} current={props.current} previous={props.previous} />
        )}
      </View>
      <Text className="text-ink-mute" style={{ fontSize: 10, marginTop: 6 }}>
        {props.comparisonLabel}
      </Text>
    </View>
  );
}

function StrengthTiles({
  modality,
  current,
  previous,
}: {
  modality: Modality;
  current: StrengthSummary;
  previous: StrengthSummary;
}) {
  const volumeDelta = delta(current.volume, previous.volume, true);
  const sessionDelta = delta(current.sessionCount, previous.sessionCount, true);

  return (
    <>
      <ComparisonTile
        label="Volume"
        value={formatVolume(current.volume)}
        deltaText={formatDeltaText(volumeDelta, "percent")}
        better={volumeDelta.better}
      />
      <ComparisonTile
        label={modalityConfig(modality).sessionNoun}
        value={formatCount(current.sessionCount)}
        deltaText={formatDeltaText(sessionDelta, "count")}
        better={sessionDelta.better}
      />
    </>
  );
}

function DistanceTiles({
  modality,
  current,
  previous,
}: {
  modality: Modality;
  current: DistanceSummary;
  previous: DistanceSummary;
}) {
  const display = distanceDisplay(modality);
  const distanceDelta = delta(current.distance, previous.distance, true);
  const countDelta = delta(current.runCount, previous.runCount, true);

  // Both summaries store canonical seconds-per-km, where lower is better. A
  // pace modality can show that difference directly; a speed modality can't —
  // a constant seconds-per-km change isn't a constant km/h change — so it
  // compares the km/h values themselves, as a percentage.
  const isSpeed = display.effortMode === "speed";
  const hasEffort = current.avgPaceSec != null;
  const effortDelta = !hasEffort
    ? null
    : isSpeed
      ? delta(3600 / (current.avgPaceSec as number), previous.avgPaceSec ? 3600 / previous.avgPaceSec : 0, true)
      : delta(current.avgPaceSec as number, previous.avgPaceSec ?? 0, false);

  return (
    <>
      <ComparisonTile
        label="Distância"
        value={formatDistanceValue(current.distance, modality) ?? "—"}
        deltaText={formatDeltaText(distanceDelta, "percent")}
        better={distanceDelta.better}
      />
      <ComparisonTile
        label={display.effortTileLabel}
        value={formatEffort(current.avgPaceSec, modality) ?? "—"}
        deltaText={
          effortDelta ? formatDeltaText(effortDelta, isSpeed ? "percent" : "pace", modality) : null
        }
        better={effortDelta?.better ?? null}
      />
      <ComparisonTile
        label={modalityConfig(modality).sessionNoun}
        value={formatCount(current.runCount)}
        deltaText={formatDeltaText(countDelta, "count")}
        better={countDelta.better}
      />
    </>
  );
}
