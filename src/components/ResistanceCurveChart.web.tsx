import { lazy, Suspense } from "react";
import { Text, View } from "react-native";
import { ensureSkiaReady } from "@/skia/ensureSkiaReady";
import type { ResistanceCurve } from "@/types";

interface Props {
  variant: ResistanceCurve;
}

// Same reasoning as VolumeChart.web.tsx: react-native-skia's web build binds to
// global.CanvasKit at import time, so victory-native (which pulls it in) must
// not be imported until ensureSkiaReady() has resolved.
const LazyResistanceCurveChartImpl = lazy(() =>
  ensureSkiaReady()
    .then(() => import("./ResistanceCurveChartImpl"))
    .then((mod) => ({ default: mod.ResistanceCurveChartImpl }))
);

export function ResistanceCurveChart(props: Props) {
  return (
    <Suspense
      fallback={
        <View className="h-40 items-center justify-center bg-surface-card rounded-2xl">
          <Text className="text-ink-mute text-sm">Carregando gráfico…</Text>
        </View>
      }
    >
      <LazyResistanceCurveChartImpl {...props} />
    </Suspense>
  );
}
