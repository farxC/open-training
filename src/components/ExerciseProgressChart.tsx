import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { formatDistanceValue, isDistanceModality } from "@/data/modalities";
import type { Modality } from "@/types";
import { useInteractionState } from "@/hooks/useInteractionState";
import { formatVolume } from "@/utils/analyticsFormat";
import { formatKg } from "@/utils/recordsGamification";
import { monthlyTotals, type ExerciseHistory } from "@/utils/exerciseHistory";
import { dayStamp, monthStamp } from "@/utils/dateLabels";

const MONO = "JetBrains Mono, Menlo, Courier New, monospace";
const INK = "#26241f";
const AMBER = "#b9791f";

const PLOT_HEIGHT = 92;
/** More columns than this on a phone and the bars stop being bars. */
const MAX_BARS = 16;
/** Roughly four dates along the axis, whatever the column count. */
const AXIS_LABELS = 4;

type Lens = "top" | "accumulated";

interface Bucket {
  key: string;
  value: number;
  /** Short form for the axis. */
  short: string;
  /** Full form for the readout — the whole point of the cursor. */
  full: string;
}

interface Props {
  history: ExerciseHistory;
  modality: Modality;
}

/**
 * The progression, with a cursor.
 *
 * A bar chart whose bars can't be identified is a texture, not a chart: it says
 * "up and to the right" and refuses every follow-up question. So one column is
 * always selected — the most recent by default — and the readout above names it
 * in full: which session, what it lifted, how it moved against the one before.
 * Tapping (or hovering, on web) moves the cursor. The dashed rule marks the
 * scale's ceiling so bar heights mean something absolute, and the record column
 * wears the crown.
 */
export function ExerciseProgressChart({ history, modality }: Props) {
  const [lens, setLens] = useState<Lens>("top");
  const [cursor, setCursor] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const isDistance = isDistanceModality(modality);

  const series = useMemo<Bucket[]>(() => {
    if (lens === "top") {
      return history.topSetTrend.slice(-MAX_BARS).map((point) => ({
        key: point.date,
        value: point.value,
        short: `${point.date.slice(8, 10)}/${point.date.slice(5, 7)}`,
        full: dayStamp(point.date),
      }));
    }
    return monthlyTotals(history.sessions, isDistance ? "distance" : "volume")
      .slice(-MAX_BARS)
      .map((point) => ({
        key: point.month,
        value: point.value,
        short: monthStamp(point.month),
        full: monthStamp(point.month),
      }));
  }, [lens, history, isDistance]);

  // Switching lens changes what a column even is, so the cursor goes back to the
  // most recent one rather than holding an index that now means something else.
  useEffect(() => {
    setCursor(null);
  }, [lens]);

  const format = (value: number) => {
    if (isDistance) return formatDistanceValue(value, modality) ?? "—";
    return lens === "top" ? `${formatKg(value)} kg` : formatVolume(value);
  };

  const max = series.reduce((m, p) => Math.max(m, p.value), 0);
  const bestIndex = series.findIndex((p) => p.value === max);
  const activeIndex = cursor ?? series.length - 1;
  const active = series[activeIndex];
  const previous = activeIndex > 0 ? series[activeIndex - 1] : null;
  const change = active && previous ? active.value - previous.value : null;

  const labelEvery = Math.max(1, Math.ceil(series.length / AXIS_LABELS));

  return (
    <View
      className="bg-surface-card rounded-xl"
      style={{ borderWidth: 1, borderColor: "#e7e4dc", padding: 12 }}
    >
      <View className="flex-row items-center" style={{ gap: 6 }}>
        <LensChip
          label={isDistance ? "Distância" : "Carga máxima"}
          active={lens === "top"}
          onPress={() => setLens("top")}
        />
        <LensChip
          label={isDistance ? "Acumulado" : "Volume"}
          active={lens === "accumulated"}
          onPress={() => setLens("accumulated")}
        />
      </View>

      {series.length === 0 || !active ? (
        <View style={{ height: PLOT_HEIGHT }} className="items-center justify-center">
          <Text className="text-ink-mute text-xs">Sem dados para desenhar ainda.</Text>
        </View>
      ) : (
        <>
          {/* The readout: whatever the cursor is on, spelled out. */}
          <View style={{ marginTop: 12, marginBottom: 9 }}>
            <View className="flex-row items-center" style={{ gap: 5 }}>
              <Text
                style={{ color: "#a8a293", fontSize: 9, fontWeight: "700", letterSpacing: 1 }}
                numberOfLines={1}
              >
                {active.full.toUpperCase()}
              </Text>
              {activeIndex === bestIndex ? (
                <MaterialCommunityIcons name="crown" size={11} color={AMBER} />
              ) : null}
            </View>
            <View className="flex-row items-baseline" style={{ gap: 7, marginTop: 2 }}>
              <Text style={{ color: INK, fontSize: 19, fontWeight: "700", fontFamily: MONO }}>
                {format(active.value)}
              </Text>
              {change != null && change !== 0 ? (
                <View className="flex-row items-center" style={{ gap: 1 }}>
                  <MaterialCommunityIcons
                    name={change > 0 ? "arrow-up" : "arrow-down"}
                    size={10}
                    color={change > 0 ? "#227a54" : "#a8382d"}
                  />
                  <Text
                    style={{
                      color: change > 0 ? "#227a54" : "#a8382d",
                      fontSize: 10.5,
                      fontWeight: "700",
                      fontFamily: MONO,
                    }}
                  >
                    {format(Math.abs(change))}
                  </Text>
                  <Text style={{ color: "#bdb8aa", fontSize: 9.5, marginLeft: 3 }}>
                    {lens === "top" ? "vs. sessão anterior" : "vs. mês anterior"}
                  </Text>
                </View>
              ) : (
                <Text style={{ color: "#bdb8aa", fontSize: 9.5 }}>
                  {previous == null ? "primeiro registro" : "sem mudança"}
                </Text>
              )}
            </View>
          </View>

          <View style={{ position: "relative" }}>
            {/* The ceiling of the scale, so a tall bar means a number and not
                just "the tallest one here". */}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                borderTopWidth: 1,
                borderTopColor: "#ddd8ce",
                borderStyle: "dashed",
              }}
            />
            <View pointerEvents="none" style={{ position: "absolute", right: 0, top: -11 }}>
              <Text style={{ color: "#bdb8aa", fontSize: 8.5, fontFamily: MONO }}>
                {format(max)}
              </Text>
            </View>

            <View className="flex-row items-end" style={{ height: PLOT_HEIGHT, gap: 3 }}>
              {series.map((point, index) => (
                <Column
                  key={point.key}
                  ratio={max > 0 ? point.value / max : 0}
                  selected={index === activeIndex}
                  best={index === bestIndex}
                  delay={index * 36}
                  label={`${point.full}: ${format(point.value)}`}
                  onSelect={() => {
                    setCursor(index);
                    setTouched(true);
                  }}
                />
              ))}
            </View>
          </View>

          {/* Cursor feet: which column the readout is describing. */}
          <View className="flex-row" style={{ gap: 3, marginTop: 3 }}>
            {series.map((point, index) => (
              <View
                key={point.key}
                style={{
                  flex: 1,
                  height: 2,
                  borderRadius: 1,
                  backgroundColor: index === activeIndex ? INK : "transparent",
                }}
              />
            ))}
          </View>

          <View className="flex-row" style={{ gap: 3, marginTop: 4 }}>
            {series.map((point, index) => {
              // Always label the last column; the rest thin out evenly, counting
              // back from it so the labelled ones stay the same as bars arrive.
              const fromEnd = series.length - 1 - index;
              const show = fromEnd % labelEvery === 0;
              return (
                <View key={point.key} style={{ flex: 1, alignItems: "center" }}>
                  {show ? (
                    <Text
                      style={{
                        color: index === activeIndex ? "#5c594f" : "#c4bfb1",
                        fontSize: 8,
                        fontFamily: MONO,
                      }}
                      numberOfLines={1}
                    >
                      {point.short}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>

          {!touched ? (
            <Text style={{ color: "#c4bfb1", fontSize: 9, marginTop: 7 }}>
              toque numa barra para ler a sessão
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}

function Column({
  ratio,
  selected,
  best,
  delay,
  label,
  onSelect,
}: {
  ratio: number;
  selected: boolean;
  best: boolean;
  delay: number;
  label: string;
  onSelect: () => void;
}) {
  const grow = useSharedValue(0);
  const { hovered, handlers } = useInteractionState();

  useEffect(() => {
    grow.value = 0;
    grow.value = withDelay(
      delay,
      withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) })
    );
  }, [delay, ratio, grow]);

  const barStyle = useAnimatedStyle(() => ({
    height: Math.max(grow.value * ratio * PLOT_HEIGHT, ratio > 0 ? 3 : 0),
  }));

  const color = best ? AMBER : selected ? INK : hovered ? "#b8b3a5" : "#ddd8ce";

  return (
    <Pressable
      onPress={onSelect}
      // Hover is how a cursor should behave on a desktop browser; the tap is for
      // everywhere else.
      onHoverIn={() => {
        handlers.onHoverIn();
        onSelect();
      }}
      onHoverOut={handlers.onHoverOut}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={{ flex: 1, height: "100%", justifyContent: "flex-end" }}
    >
      <Animated.View
        style={[
          {
            width: "100%",
            borderTopLeftRadius: 2,
            borderTopRightRadius: 2,
            backgroundColor: color,
            // The selected column reads as selected even when it's also the
            // record, which owns the amber.
            opacity: selected || best ? 1 : 0.9,
          },
          barStyle,
        ]}
      />
    </Pressable>
  );
}

function LensChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { hovered, handlers } = useInteractionState();

  return (
    <Pressable
      onPress={onPress}
      {...handlers}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className="rounded-full"
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: active ? INK : "#e7e4dc",
        backgroundColor: active ? INK : hovered ? "#f4f2ee" : "transparent",
      }}
    >
      <Text style={{ color: active ? "#ffffff" : "#928d80", fontSize: 10.5, fontWeight: "700" }}>
        {label}
      </Text>
    </Pressable>
  );
}
