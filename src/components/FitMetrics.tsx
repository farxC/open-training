import { Text, View } from "react-native";
import { getFitImport } from "@/db/fit";
import { SessionMetricCard } from "./SessionMetricCard";

export function FitMetrics({ sessionId }: { sessionId: number }) {
  const link = getFitImport(sessionId);
  if (!link) return null;
  const a = link.activity, w = a.workout;
  return <View style={{ marginTop: 20, gap: 12 }}>
    <View style={{ paddingHorizontal: 2, gap: 4 }}>
      <Text className="font-sans text-ink-mute text-xs">Métricas do arquivo FIT</Text>
      <Text className="font-sans text-ink-mute text-xs">{a.deviceName || a.fileName} · {new Date(w.start).toLocaleString("pt-BR")}</Text>
    </View>
    <SessionMetricCard kind="heart-rate" source="FIT" records={w.heartRate} average={w.heartRateAverage}
      reportedMaximum={a.heartRateMaximum} start={Date.parse(w.start)} end={Date.parse(w.end)} />
    <SessionMetricCard kind="cadence" source="FIT" records={w.cadence} average={w.cadenceAverage}
      reportedMaximum={a.cadenceMaximum} start={Date.parse(w.start)} end={Date.parse(w.end)} />
  </View>;
}
