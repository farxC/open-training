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
}

const PAD = 4;
const SEG_W = 150; // per-segment width when not stretched

/**
 * A tactile segmented toggle: a recessed warm track with a raised white thumb
 * that glides under the active option. Used to switch the analytics modality.
 */
export function ModalityToggle<T extends string>({
  options,
  value,
  onChange,
  stretch = true,
}: Props<T>) {
  const [trackW, setTrackW] = useState(0);
  const progress = useSharedValue(Math.max(0, options.findIndex((o) => o.key === value)));

  const activeIndex = options.findIndex((o) => o.key === value);
  useEffect(() => {
    progress.value = withTiming(Math.max(0, activeIndex), {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeIndex, progress]);

  const seg = trackW > 0 ? (trackW - PAD * 2) / options.length : 0;

  const thumbStyle = useAnimatedStyle(() => ({
    width: seg,
    transform: [{ translateX: PAD + progress.value * seg }],
  }));

  return (
    <View
      onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
      style={{
        flexDirection: "row",
        alignSelf: stretch ? "stretch" : "flex-start",
        backgroundColor: "#ebe7df",
        borderRadius: 14,
        padding: PAD,
        position: "relative",
      }}
    >
      {trackW > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: PAD,
              bottom: PAD,
              left: 0,
              borderRadius: 10,
              backgroundColor: "#ffffff",
              shadowColor: "#26241f",
              shadowOpacity: 0.1,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
            },
            thumbStyle,
          ]}
        />
      )}

      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={({ hovered }: { hovered?: boolean }) => ({
              flex: stretch ? 1 : undefined,
              width: stretch ? undefined : SEG_W,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              paddingVertical: 11,
              opacity: !active && hovered ? 0.85 : 1,
            })}
          >
            {({ hovered }: { hovered?: boolean }) => {
              const color = active ? "#26241f" : hovered ? "#5c594f" : "#928d80";
              return (
                <>
                  {opt.icon ? (
                    <MaterialCommunityIcons name={opt.icon as MciName} size={18} color={color} />
                  ) : null}
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 14,
                      fontWeight: active ? "700" : "600",
                      color,
                      letterSpacing: -0.1,
                    }}
                  >
                    {opt.label}
                  </Text>
                </>
              );
            }}
          </Pressable>
        );
      })}
    </View>
  );
}
