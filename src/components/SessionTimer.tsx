import { useEffect, useState } from "react";
import { AppState, Text, TouchableOpacity, View } from "react-native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";

const KEEP_AWAKE_TAG = "session-timer";

function formatStopwatch(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

interface SessionTimerProps {
  startTime: Date | null;
  onStart: () => void;
}

export function SessionTimer({ startTime, onStart }: SessionTimerProps) {
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!startTime) return;
    const compute = () =>
      setElapsedSec(Math.max(0, Math.floor((Date.now() - startTime.getTime()) / 1000)));
    compute();
    const interval = setInterval(compute, 1000);
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") compute();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [startTime]);

  useEffect(() => {
    if (!startTime) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [startTime]);

  if (!startTime) {
    return (
      <TouchableOpacity
        className="py-3 rounded-xl items-center bg-brand-500"
        onPress={onStart}
        activeOpacity={0.85}
      >
        <Text className="text-white text-sm font-semibold">Iniciar sessão</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View
      className="flex-row items-center justify-center py-3 rounded-xl"
      style={{ gap: 8, borderWidth: 1, borderColor: "#ddd8ce" }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#d94f4f" }} />
      <Text
        className="text-ink font-display font-semibold"
        style={{ fontSize: 18, fontVariant: ["tabular-nums"] }}
      >
        {formatStopwatch(elapsedSec)}
      </Text>
    </View>
  );
}
