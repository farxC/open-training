import { useMemo, useState } from "react";

/**
 * Pressed/hovered state for a Pressable, tracked in React state.
 *
 * Do NOT go back to Pressable's `style={({ pressed, hovered }) => …}` callback.
 * NativeWind's JSX transform swaps every Pressable for its css-interop wrapper,
 * and on native that wrapper collects the inline `style` prop as a style rule,
 * spreads it (`{ ...fn }` → `{}`) and overwrites the prop with the result. A
 * function style is therefore silently discarded on device — padding, border,
 * background and flex sizing all vanish — while it keeps working on web, whose
 * interop path never touches `style`. Object styles survive both.
 *
 * onHoverIn/onHoverOut only fire on react-native-web; they're inert on native.
 */
export function useInteractionState() {
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handlers = useMemo(
    () => ({
      onPressIn: () => setPressed(true),
      onPressOut: () => setPressed(false),
      onHoverIn: () => setHovered(true),
      onHoverOut: () => setHovered(false),
    }),
    [],
  );

  return { pressed, hovered, handlers };
}
