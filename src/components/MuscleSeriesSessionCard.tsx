import { useEffect, useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { FadeInRow } from "@/components/FadeInRow";
import { TickBar } from "@/components/TickBar";
import { formatMuscleSeriesValue, formatSeriesNumber, muscleGroupLabel } from "@/data/muscleGroups";
import type { MuscleSeriesRow } from "@/types";

const MONO = "JetBrains Mono, Menlo, Courier New, monospace";
const INK = "#26241f";
const FAINT = "#928d80";
const HAIRLINE = "rgba(38, 36, 31, 0.07)";

/** Widest pip pitch we'll use — beyond this the pips start reading as a sparse
 *  dotted line instead of as counted objects. */
const MAX_PITCH = 13;
/** Below this the pips crowd into a smear, so the row switches to a bar. */
const MIN_PITCH = 7;

const LABEL_WIDTH = 88;

interface Props {
  data: MuscleSeriesRow[];
}

/** Series-per-muscle-group card shared by the live recording screen and the
 *  finished-session detail view — both scope to a single session, so `data`
 *  is always unaveraged (see AnalyticsMuscleBreakdown for the windowed variant).
 *
 *  One line per group: séries are counted out as pips rather than measured as
 *  bar length. Within a single session the numbers live in ones and halves, and
 *  a handful of dots is read (not estimated) at a glance — which also means the
 *  card carries a single texture instead of one striped bar per group. The
 *  section heading lives inside the card so the block is one object on screen.
 */
export function MuscleSeriesSessionCard({ data }: Props) {
  const [lane, setLane] = useState(0);

  if (data.length === 0) return null;

  const maxSeries = Math.max(...data.map((d) => d.value));
  // Pips are whole objects, so the lane is divided into whole slots.
  const slots = Math.max(1, Math.ceil(maxSeries - 1e-9));
  const total = data.reduce((sum, row) => sum + row.value, 0);

  const rawPitch = lane > 0 ? lane / slots : 0;
  const pitch = Math.min(MAX_PITCH, rawPitch);
  // A group trained past ~25 séries in one session can't be counted in dots at
  // this width — the whole card falls back to bars so the rows stay comparable.
  const asPips = lane === 0 || pitch >= MIN_PITCH;
  const pipSize = Math.max(4, Math.min(8, Math.round(pitch - 4)));

  return (
    <View
      className="bg-surface-card mb-3"
      style={{
        borderRadius: 20,
        borderWidth: 1,
        borderColor: HAIRLINE,
        overflow: "hidden",
        shadowColor: INK,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.05,
        shadowRadius: 14,
        elevation: 2,
      }}
    >
      <View
        className="flex-row items-center"
        style={{
          paddingHorizontal: 14,
          paddingTop: 12,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: HAIRLINE,
          gap: 8,
        }}
      >
        <View style={{ width: 2, height: 12, backgroundColor: INK, borderRadius: 1 }} />
        <Text style={{ color: FAINT, fontSize: 10, fontWeight: "700", letterSpacing: 1.4, flex: 1 }}>
          SÉRIES POR GRUPO
        </Text>
        <Text style={{ color: INK, fontSize: 12, fontFamily: MONO }}>
          {formatSeriesNumber(total, false)}
        </Text>
        <Text style={{ color: FAINT, fontSize: 9, fontWeight: "700", letterSpacing: 1 }}>
          SÉRIES
        </Text>
      </View>

      <View style={{ paddingVertical: 4 }}>
        {data.map((item, index) => {
          const label = muscleGroupLabel(item.muscle_group);

          return (
            <FadeInRow
              key={item.muscle_group}
              index={index}
              step={45}
              accessibilityLabel={`${label}: ${formatMuscleSeriesValue(item)} séries`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 14,
                paddingVertical: 7,
                gap: 10,
              }}
            >
              <Text
                style={{
                  color: INK,
                  fontSize: 11,
                  fontWeight: "700",
                  letterSpacing: 0.7,
                  width: LABEL_WIDTH,
                }}
                numberOfLines={1}
              >
                {label.toUpperCase()}
              </Text>

              <View
                style={{ flex: 1, justifyContent: "center" }}
                onLayout={index === 0 ? (e: LayoutChangeEvent) => setLane(e.nativeEvent.layout.width) : undefined}
              >
                {lane === 0 ? null : asPips ? (
                  <SeriesPips value={item.value} pitch={pitch} size={pipSize} delay={index * 45} />
                ) : (
                  <TickBar value={item.value} capacity={slots} slots={null} height={6} delay={index * 45} />
                )}
              </View>

              <Text
                style={{
                  color: INK,
                  fontSize: 14,
                  fontFamily: MONO,
                  minWidth: 26,
                  textAlign: "right",
                }}
              >
                {formatMuscleSeriesValue(item)}
              </Text>
            </FadeInRow>
          );
        })}
      </View>
    </View>
  );
}

/** Séries as beads on a wire: whole pips filled, a half-counting série left as a
 *  ring. Pitch comes from the widest row so every lane shares one grid and the
 *  rows can be compared by length without any of them being a bar. */
function SeriesPips({
  value,
  pitch,
  size,
  delay,
}: {
  value: number;
  pitch: number;
  size: number;
  delay: number;
}) {
  const whole = Math.floor(value + 1e-9);
  const hasHalf = value - whole >= 0.25;
  const count = whole + (hasHalf ? 1 : 0);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", height: size + 2 }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ width: pitch }}>
          <Pip size={size} partial={hasHalf && i === count - 1} delay={delay + i * 38} />
        </View>
      ))}
    </View>
  );
}

function Pip({ size, partial, delay }: { size: number; partial: boolean; delay: number }) {
  const pop = useSharedValue(0);

  useEffect(() => {
    pop.value = 0;
    // Overshoot on the way in: each pip lands like a bead dropped onto the wire.
    pop.value = withDelay(delay, withTiming(1, { duration: 260, easing: Easing.out(Easing.back(2)) }));
  }, [delay, partial, pop]);

  const style = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [{ scale: 0.3 + pop.value * 0.7 }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: partial ? "transparent" : INK,
          borderWidth: partial ? 1.5 : 0,
          borderColor: INK,
        },
        style,
      ]}
    />
  );
}
