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
const TRACK = "#e9e5dc";

interface Props {
  value: number;
  /** Track capacity, in the same unit as `value` — shared by every bar in a
   *  list so the widths are comparable rather than each self-scaled. */
  capacity: number;
  /** Grooves cutting the fill into unit ticks (1 tick = 1 unit of `value`).
   *  Null draws one uncut bar — see tickSlots(). */
  slots: number | null;
  height?: number;
  /** Whatever the bar sits on: the grooves are painted in it, so the fill reads
   *  as separate plates racked up rather than as one smear. */
  grooveColor?: string;
  delay?: number;
  /** Changing this replays the fill from empty — used to re-deal the list. */
  cycle?: string | number;
}

/** A loaded plate rack: one ink fill, cut into unit ticks by grooves the colour
 *  of the surface beneath. The fill grows on mount because the growth *is* the
 *  message — a bar that is simply there reads as decoration, a bar that fills
 *  reads as a quantity being counted out. */
export function TickBar({
  value,
  capacity,
  slots,
  height = 10,
  grooveColor = "#ffffff",
  delay = 0,
  cycle,
}: Props) {
  const fill = useSharedValue(0);

  const raw = capacity > 0 ? value / capacity : 0;
  // A group with a single half-série still has to be visibly on the rack —
  // clamping to a sliver keeps that reading as "barely started", not as absent.
  const target = value > 0 ? Math.min(1, Math.max(raw, 0.014)) : 0;

  useEffect(() => {
    fill.value = 0;
    fill.value = withDelay(
      delay,
      withTiming(target, { duration: 760, easing: Easing.out(Easing.cubic) })
    );
  }, [target, delay, cycle, fill]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  const grooveWidth = slots != null && slots > 18 ? 1 : 2;
  const radius = Math.min(3, height / 2);

  return (
    <View
      style={{
        height,
        borderRadius: radius,
        backgroundColor: TRACK,
        overflow: "hidden",
      }}
    >
      <Animated.View
        style={[
          { height: "100%", backgroundColor: INK, borderRadius: radius },
          fillStyle,
        ]}
      >
        {/* Lit top edge — enough to make the ink read as a solid object under
            light rather than as a flat rectangle. */}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: "rgba(255,255,255,0.16)",
          }}
        />
      </Animated.View>

      {slots != null ? (
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, flexDirection: "row" }}
        >
          {Array.from({ length: slots }, (_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                borderRightWidth: i === slots - 1 ? 0 : grooveWidth,
                borderRightColor: grooveColor,
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
