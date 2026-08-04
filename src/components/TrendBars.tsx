import { Text, TouchableOpacity, View } from "react-native";

interface Props {
  bars: { label: string; value: number }[];
  caption?: string;
  formatValue?: (v: number) => string;
  /** Which bar reads as "now" — darkened and value-labelled. Defaults to the last
   *  one, which is right for trend buckets but not for a Mon–Sun week, where the
   *  current day sits mid-chart. */
  highlightIndex?: number;
  /** Makes bars with a value tappable. Fires on both press and long-press: a
   *  long-press with a mouse is undiscoverable on web, and nothing else here
   *  competes for the tap. */
  onBarPress?: (index: number) => void;
}

const PLOT_HEIGHT = 128;
// Each column is three fixed bands — value label, bar, axis label — so the
// tallest bar can't push its own labels out of the plot. Sizing the bar as a
// percentage of the whole plot (the earlier approach) overflowed exactly when the
// highlighted bar was also the tallest one.
const VALUE_STRIP = 13;
const DAY_STRIP = 15;
const BAR_AREA = PLOT_HEIGHT - VALUE_STRIP - DAY_STRIP;

export function TrendBars({ bars, caption, formatValue, highlightIndex, onBarPress }: Props) {
  const max = Math.max(...bars.map((b) => b.value), 0);
  const hasData = max > 0;
  const highlight = highlightIndex ?? bars.length - 1;

  return (
    <View className="bg-surface-card rounded-2xl p-3">
      {caption ? (
        <Text
          style={{ color: "#928d80", fontSize: 10, fontWeight: "700", letterSpacing: 1 }}
          className="mb-2"
          numberOfLines={1}
        >
          {caption.toUpperCase()}
        </Text>
      ) : null}

      {hasData ? (
        <View className="flex-row items-end" style={{ height: PLOT_HEIGHT, gap: 6 }}>
          {bars.map((bar, index) => {
            const isCurrent = index === highlight;
            const height = Math.max((bar.value / max) * BAR_AREA, bar.value > 0 ? 5 : 0);
            const pressable = onBarPress != null && bar.value > 0;
            // TouchableOpacity, not Pressable: Pressable's function-style form
            // loses the percentage height here and collapses every bar to zero.
            const Container = pressable ? TouchableOpacity : View;
            const handlePress = () => onBarPress?.(index);

            return (
              <Container
                key={`${bar.label}-${index}`}
                className="flex-1 items-center justify-end"
                style={{ height: "100%" }}
                {...(pressable
                  ? { onPress: handlePress, onLongPress: handlePress, activeOpacity: 0.6 }
                  : {})}
              >
                <View style={{ height: VALUE_STRIP, justifyContent: "flex-end" }}>
                  {isCurrent && formatValue ? (
                    <Text
                      style={{ color: "#5c594f", fontSize: 9, lineHeight: 11, fontWeight: "600" }}
                      numberOfLines={1}
                    >
                      {formatValue(bar.value)}
                    </Text>
                  ) : null}
                </View>
                <View
                  style={{
                    width: "100%",
                    height,
                    backgroundColor: isCurrent ? "#26241f" : "#ddd8ce",
                    borderTopLeftRadius: 3,
                    borderTopRightRadius: 3,
                  }}
                />
                <View style={{ height: DAY_STRIP, justifyContent: "center" }}>
                  <Text
                    style={{ color: "#928d80", fontSize: 9, lineHeight: 11 }}
                    numberOfLines={1}
                  >
                    {bar.label}
                  </Text>
                </View>
              </Container>
            );
          })}
        </View>
      ) : (
        <View style={{ height: PLOT_HEIGHT }} className="items-center justify-center">
          <Text className="text-ink-mute text-xs">Sem dados no período</Text>
        </View>
      )}
    </View>
  );
}
