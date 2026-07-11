import { lazy, Suspense } from "react";
import { Text, View } from "react-native";
import { ensureSkiaReady } from "@/skia/ensureSkiaReady";

interface Props {
  data: { week: string; volume_kg: number }[];
}

// react-native-skia's Skia.web.ts builds its API against global.CanvasKit the moment
// it's imported — a plain top-level `import { CartesianChart } from "victory-native"`
// here would require (and break) it before ensureSkiaReady() ever runs, since Metro
// evaluates static imports as soon as this module is required, well before any effect
// fires. Deferring the import until after ensureSkiaReady() resolves is what keeps
// Skia.web.ts from ever seeing an undefined global.CanvasKit.
const LazyVolumeChartImpl = lazy(() =>
  ensureSkiaReady()
    .then(() => import("./VolumeChartImpl"))
    .then((mod) => ({ default: mod.VolumeChartImpl }))
);

export function VolumeChart(props: Props) {
  return (
    <Suspense
      fallback={
        <View className="h-48 items-center justify-center bg-surface-card rounded-2xl">
          <Text className="text-ink-mute text-sm">Loading chart…</Text>
        </View>
      }
    >
      <LazyVolumeChartImpl {...props} />
    </Suspense>
  );
}
