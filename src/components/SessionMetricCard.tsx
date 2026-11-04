import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";
import { samplesOf } from "@/health/model";
import type { HealthSeries } from "@/health/types";
import colors from "@/theme/palette.json";

interface Props {
  kind: "heart-rate" | "cadence";
  source: "FIT" | "Health Connect";
  records: HealthSeries[] | null;
  average: number | null;
  reportedMaximum?: number | null;
  start: number;
  end: number;
}

const format = (value: number | null) => value === null ? "—" : Math.round(value).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const formatMinutes = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

function MetricStat({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
    <Text className="font-sans" style={{ color: colors.muted, fontSize: 11 }}>{label}</Text>
    <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: 6 }}>
      <Text style={{ fontFamily: "JetBrains Mono", fontSize: 27, color: colors.ink, letterSpacing: -1 }}>{format(value)}</Text>
      <Text className="font-sans" style={{ fontSize: 10, color: colors.muted }}>{unit}</Text>
    </View>
  </View>;
}

export function SessionMetricCard({ kind, source, records, average, reportedMaximum, start, end }: Props) {
  const [width, setWidth] = useState(320);
  const samples = useMemo(() => samplesOf(records), [records]);
  const heartRate = kind === "heart-rate";
  const title = heartRate ? "Frequência cardíaca" : "Cadência";
  const unit = heartRate ? "bpm" : "passos/min";
  const accent = heartRate ? colors.primary : colors.secondary;
  const maximum = samples.reduce<number | null>((max, s) => max === null ? s.value : Math.max(max, s.value), null);
  const minimum = samples.reduce((min, s) => Math.min(min, s.value), maximum ?? 0);
  const padding = maximum === null ? 1 : Math.max((maximum - minimum) * 0.15, 1);
  const low = Math.max(0, Math.floor(minimum - padding)), high = Math.ceil((maximum ?? 0) + padding);
  const left = 34, right = Math.max(left + 1, width - 8), top = 12, bottom = 114;
  const y = (value: number) => bottom - (value - low) / (high - low) * (bottom - top);
  const x = (time: number) => left + (time - start) / Math.max(end - start, 1) * (right - left);
  const paths: string[] = [];
  const dots: { x: number; y: number }[] = [];
  let lastTime = -Infinity, lastPixel = -1, hasGaps = false;
  for (const sample of samples) {
    const atX = x(sample.time), atY = y(sample.value);
    if (sample.time - lastTime > 60000) {
      hasGaps ||= lastTime !== -Infinity;
      paths.push(`M${atX.toFixed(1)},${atY.toFixed(1)}`);
      dots.push({ x: atX, y: atY });
    } else if (Math.floor(atX) !== lastPixel || sample === samples[samples.length - 1]) {
      paths[paths.length - 1] += ` L${atX.toFixed(1)},${atY.toFixed(1)}`;
    }
    lastPixel = Math.floor(atX);
    lastTime = sample.time;
  }
  const ticks = [high, Math.round((high + low) / 2), low];
  const minutes = (end - start) / 60000;
  const reported = reportedMaximum !== undefined;

  return <View testID={`${source === "FIT" ? "fit" : "health-connect"}-${kind}-metric`}
    className="bg-surface-card" style={{ borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 18 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 }}>
      <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: heartRate ? colors.pale : colors.secondarySoft,
        alignItems: "center", justifyContent: "center" }}>
        <MaterialCommunityIcons name={heartRate ? "heart-pulse" : "run"} size={19} color={accent} />
      </View>
      <Text className="font-display text-ink font-semibold" style={{ flex: 1, fontSize: 18 }}>{title}</Text>
      <Text className="font-sans" style={{ fontSize: 10, color: colors.muted }}>{source}</Text>
    </View>

    <View style={{ flexDirection: "row", gap: 18, marginBottom: 16 }}>
      <MetricStat label="Média" value={average} unit={unit} />
      <View style={{ width: 1, backgroundColor: colors.line }} />
      <MetricStat label={reported ? "Máxima reportada" : "Máxima das amostras"}
        value={reported ? reportedMaximum : maximum} unit={unit} />
    </View>
    <Text className="font-sans" style={{ fontSize: 10, color: colors.faint, marginBottom: 14 }}>
      {source === "FIT" ? "Resumo informado pelo arquivo FIT" : "Média agregada pelo Health Connect · cobertura disponível"}
      {reported && maximum !== null ? ` · Máxima nas amostras: ${format(maximum)} ${unit}` : ""}
    </Text>

    {samples.length > 0 ? <>
      <View onLayout={(event) => setWidth(Math.max(100, Math.round(event.nativeEvent.layout.width)))}
        accessibilityLabel={`${title}: ${samples.length} amostras, mínima ${format(minimum)}, máxima ${format(maximum)} ${unit}`}
        style={{ height: 138 }}>
        <Svg width="100%" height={138} viewBox={`0 0 ${width} 138`}>
          {ticks.map((tick, index) => <Path key={`grid-${index}`} d={`M${left},${y(tick)} H${right}`}
            stroke={colors.line} strokeWidth={1} strokeDasharray="3 5" />)}
          {ticks.map((tick, index) => <SvgText key={`axis-${index}`} x={left - 8} y={y(tick) + 3}
            textAnchor="end" fontSize={9} fill={colors.faint}>{format(tick)}</SvgText>)}
          {paths.map((d, index) => <Path key={index} d={d} fill="none" stroke={accent} strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round" />)}
          {dots.map((dot, index) => <Circle key={index} cx={dot.x} cy={dot.y} r={2.5} fill={accent} />)}
          {[0, minutes / 2, minutes].map((minute, index) => <SvgText key={`time-${index}`}
            x={left + index * (right - left) / 2} y={134} textAnchor={index === 0 ? "start" : index === 2 ? "end" : "middle"}
            fontSize={9} fill={colors.faint}>{formatMinutes(minute)} min</SvgText>)}
        </Svg>
      </View>
      <Text className="font-sans" style={{ marginTop: 8, fontSize: 10, color: colors.faint }}>
        {samples.length.toLocaleString("pt-BR")} amostras{hasGaps ? " · Intervalos sem medição aparecem abertos" : ""}
      </Text>
    </> : <View style={{ borderRadius: 12, backgroundColor: colors.paper, padding: 16 }}>
      <Text className="font-sans" style={{ fontSize: 12, lineHeight: 18, color: colors.muted }}>
        {records === null ? "Leitura não autorizada ou ainda não importada." : "Sem amostras para desenhar o gráfico desta métrica."}
      </Text>
    </View>}
  </View>;
}
