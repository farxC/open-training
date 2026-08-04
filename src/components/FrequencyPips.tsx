import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

const INK = "#26241f";
const EMPTY = "#d6d0c3";

interface Props {
  value: number;
  /** One pip per session of the most-trained group; null renders nothing, the
   *  caller falls back to the number alone — see pipSlots(). */
  slots: number | null;
  size?: number;
  delay?: number;
  /** Changing this replays the pop-in — used to re-deal the list. */
  cycle?: string | number;
}

/** Sessions as countable pips rather than as bar length. Frequency lives in
 *  ones and halves — a bar for "2×" says nothing you can read, four dots say it
 *  before you reach the number. */
export function FrequencyPips({ value, slots, size = 7, delay = 0, cycle }: Props) {
  if (slots == null) return null;

  const whole = Math.floor(value + 1e-9);
  const fraction = value - whole;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      {Array.from({ length: slots }, (_, i) => (
        <Pip
          key={i}
          size={size}
          state={i < whole ? "full" : i === whole && fraction >= 0.2 ? "partial" : "empty"}
          delay={delay + i * 55}
          cycle={cycle}
        />
      ))}
    </View>
  );
}

type PipState = "full" | "partial" | "empty";

function Pip({
  size,
  state,
  delay,
  cycle,
}: {
  size: number;
  state: PipState;
  delay: number;
  cycle?: string | number;
}) {
  const pop = useSharedValue(0);

  useEffect(() => {
    pop.value = 0;
    pop.value = withDelay(
      delay,
      // Overshoot on the way in: the pips land like beads dropped onto a wire.
      withTiming(1, { duration: 280, easing: Easing.out(Easing.back(2)) })
    );
  }, [delay, cycle, pop]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.25 + pop.value * 0.75,
    transform: [{ scale: 0.35 + pop.value * 0.65 }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: state === "full" ? INK : state === "empty" ? EMPTY : "transparent",
          borderWidth: state === "partial" ? 1.5 : 0,
          borderColor: INK,
        },
        style,
      ]}
    />
  );
}
