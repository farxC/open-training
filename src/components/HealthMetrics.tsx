import { Text, View } from "react-native";
import { getHealthImport } from "@/db/healthConnect";
import { SessionMetricCard } from "./SessionMetricCard";

export function HealthMetrics({ sessionId }: { sessionId: number }) {
  const link = getHealthImport(sessionId);
  if (!link) return null;
  const w = link.workout;
  return <View style={{ marginTop: 20, gap: 12 }}>
    <View style={{ paddingHorizontal: 2, gap: 4 }}>
      <Text className="font-sans text-ink-mute text-xs">Métricas do Health Connect</Text>
      <Text className="font-sans text-ink-mute text-xs">{w.origin} · {new Date(w.start).toLocaleString("pt-BR")}</Text>
    </View>
    <SessionMetricCard kind="heart-rate" source="Health Connect" records={w.heartRate} average={w.heartRateAverage}
      start={Date.parse(w.start)} end={Date.parse(w.end)} />
    <SessionMetricCard kind="cadence" source="Health Connect" records={w.cadence} average={w.cadenceAverage}
      start={Date.parse(w.start)} end={Date.parse(w.end)} />
  </View>;
}
