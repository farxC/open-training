import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

const MONO = "JetBrains Mono, Menlo, Courier New, monospace";

export interface Stat {
  label: string;
  value: string;
  /** Rendered small and baseline-aligned after the value — "kg", "×", "/km". */
  unit?: string;
  /** Draws the value in ink rather than muted graphite. The headline of the band. */
  strong?: boolean;
}

interface Props {
  stats: Stat[];
}

/**
 * The plate riveted to the machine: four numbers that orient you before the
 * ledger below starts making claims. Mono figures on hairline-divided columns,
 * dealt in left to right so the eye reads it as a row of measurements rather
 * than as four unrelated cards.
 */
export function ExerciseStatBand({ stats }: Props) {
  return (
    <View
      className="bg-surface-card rounded-xl flex-row overflow-hidden"
      style={{ borderWidth: 1, borderColor: "#e7e4dc" }}
    >
      {stats.map((stat, index) => (
        <StatCell key={stat.label} stat={stat} index={index} first={index === 0} />
      ))}
    </View>
  );
}

function StatCell({ stat, index, first }: { stat: Stat; index: number; first: boolean }) {
  const enter = useSharedValue(0);

  useEffect(() => {
    enter.value = withDelay(
      index * 70,
      withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) })
    );
  }, [index, enter]);

  const style = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 6 }],
  }));

  return (
    <Animated.View
      style={[
        {
          flex: 1,
          paddingVertical: 11,
          paddingHorizontal: 8,
          borderLeftWidth: first ? 0 : 1,
          borderLeftColor: "#efece5",
        },
        style,
      ]}
    >
      <View className="flex-row items-baseline" style={{ gap: 2 }}>
        <Text
          style={{
            color: stat.strong ? "#26241f" : "#5c594f",
            fontSize: 17,
            fontWeight: "700",
            fontFamily: MONO,
          }}
          numberOfLines={1}
        >
          {stat.value}
        </Text>
        {stat.unit ? (
          <Text style={{ color: "#928d80", fontSize: 9.5 }} numberOfLines={1}>
            {stat.unit}
          </Text>
        ) : null}
      </View>
      <Text
        style={{ color: "#a8a293", fontSize: 8.5, fontWeight: "700", letterSpacing: 0.7, marginTop: 3 }}
        numberOfLines={1}
      >
        {stat.label}
      </Text>
    </Animated.View>
  );
}
