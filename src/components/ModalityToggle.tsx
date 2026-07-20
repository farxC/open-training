import type { ComponentProps } from "react";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

type MciName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export interface ToggleOption<T extends string> {
  key: T;
  label: string;
  icon?: string;
}

interface Props<T extends string> {
  options: ToggleOption<T>[];
  value: T;
  onChange: (key: T) => void;
  /** When false, the track hugs its content and is left-aligned (desktop). */
  stretch?: boolean;
  /** Shrinks track/segment sizing for use as a small inline control (e.g. next to a chip). */
  compact?: boolean;
}

const PAD = 4;
const SEG_W = 150; // per-segment width when not stretched
const COMPACT_PAD = 2;
const COMPACT_SEG_W = 44;
// Segments sit flush against each other (no gap), so the thumb's Android elevation
// shadow bleeds into the neighboring option unless it's inset a bit narrower than
// the segment itself.
const THUMB_INSET = 3;
const COMPACT_THUMB_INSET = 2;

/**
 * A tactile segmented toggle: a recessed warm track with a raised white thumb
 * that glides under the active option. Used to switch the analytics modality.
 */
export function ModalityToggle<T extends string>({
  options,
  value,
  onChange,
  stretch = true,
  compact = false,
}: Props<T>) {
  const pad = compact ? COMPACT_PAD : PAD;
  const segW = compact ? COMPACT_SEG_W : SEG_W;
  const thumbInset = compact ? COMPACT_THUMB_INSET : THUMB_INSET;

  const [trackW, setTrackW] = useState(0);
  const progress = useSharedValue(Math.max(0, options.findIndex((o) => o.key === value)));

  const activeIndex = options.findIndex((o) => o.key === value);
  useEffect(() => {
    progress.value = withTiming(Math.max(0, activeIndex), {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeIndex, progress]);

  const seg = trackW > 0 ? (trackW - pad * 2) / options.length : 0;

  const thumbStyle = useAnimatedStyle(() => ({
    width: Math.max(seg - thumbInset * 2, 0),
    transform: [{ translateX: pad + progress.value * seg + thumbInset }],
  }));

  return (
    <View
      onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
      style={{
        flexDirection: "row",
        alignSelf: stretch ? "stretch" : "flex-start",
        backgroundColor: "#ebe7df",
        borderRadius: compact ? 10 : 14,
        padding: pad,
        position: "relative",
      }}
    >
      {trackW > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: pad,
              bottom: pad,
              left: 0,
              borderRadius: compact ? 7 : 10,
              backgroundColor: "#ffffff",
              shadowColor: "#26241f",
              shadowOpacity: 0.1,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 1,
            },
            thumbStyle,
          ]}
        />
      )}

      {options.map((opt) => {
        const active = opt.key === value;
        const color = active ? "#26241f" : "#928d80";
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={{
              flex: stretch ? 1 : undefined,
              width: stretch ? undefined : segW,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: compact ? 4 : 11,
            }}
          >
            {opt.icon ? (
              <MaterialCommunityIcons
                name={opt.icon as MciName}
                size={18}
                color={color}
                style={{ marginRight: 7 }}
              />
            ) : null}
            <Text
              numberOfLines={1}
              style={{
                fontSize: compact ? 11 : 14,
                fontWeight: active ? "700" : "600",
                color,
                letterSpacing: -0.1,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
