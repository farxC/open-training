import { useEffect, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

interface Props {
  /** Position in the list — drives the stagger. */
  index: number;
  step?: number;
  /** Changing this replays the entrance, so a re-sorted list arrives as motion
   *  rather than as a silent reshuffle. */
  cycle?: string | number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  accessibilityLabel?: string;
}

/** A list row that deals itself in: rises and fades on mount, one after the
 *  next. The stagger is what makes a list of quantities read as being counted
 *  out rather than as having always been there. */
export function FadeInRow({
  index,
  step = 55,
  cycle,
  style,
  children,
  accessibilityLabel,
}: Props) {
  const enter = useSharedValue(0);

  useEffect(() => {
    enter.value = 0;
    enter.value = withDelay(
      index * step,
      withTiming(1, { duration: 340, easing: Easing.out(Easing.cubic) })
    );
  }, [index, step, cycle, enter]);

  const style_ = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 10 }],
  }));

  return (
    <Animated.View accessibilityLabel={accessibilityLabel} style={[style, style_]}>
      {children}
    </Animated.View>
  );
}
