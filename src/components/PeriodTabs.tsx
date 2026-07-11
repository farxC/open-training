import { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";

export interface PeriodOption<T extends string> {
  key: T;
  label: string;
}

interface Props<T extends string> {
  options: PeriodOption<T>[];
  value: T;
  onChange: (key: T) => void;
}

/**
 * An underline tab bar for the analytics time period. A 2px ink indicator
 * slides along a hairline baseline — reads as time navigation, secondary to
 * the modality toggle above it.
 */
export function PeriodTabs<T extends string>({ options, value, onChange }: Props<T>) {
  const [rowW, setRowW] = useState(0);
  const activeIndex = Math.max(0, options.findIndex((o) => o.key === value));
  const progress = useSharedValue(activeIndex);

  useEffect(() => {
    progress.value = withTiming(activeIndex, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeIndex, progress]);

  const seg = rowW > 0 ? rowW / options.length : 0;

  const indicatorStyle = useAnimatedStyle(() => ({
    width: seg,
    transform: [{ translateX: progress.value * seg }],
  }));

  return (
    <View onLayout={(e) => setRowW(e.nativeEvent.layout.width)}>
      <View style={{ flexDirection: "row" }}>
        {options.map((opt) => {
          const active = opt.key === value;
          return (
            <TouchableOpacity
              key={opt.key}
              activeOpacity={0.7}
              onPress={() => onChange(opt.key)}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 9,
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 13,
                  fontWeight: active ? "700" : "500",
                  color: active ? "#26241f" : "#928d80",
                  letterSpacing: -0.1,
                }}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Hairline baseline + sliding ink indicator */}
      <View style={{ height: 2, backgroundColor: "#ebe7df", borderRadius: 1, position: "relative" }}>
        {rowW > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                backgroundColor: "#26241f",
                borderRadius: 1,
              },
              indicatorStyle,
            ]}
          />
        )}
      </View>
    </View>
  );
}
