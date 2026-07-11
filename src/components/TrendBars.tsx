import { Text, View } from "react-native";

interface Props {
  bars: { label: string; value: number }[];
  caption?: string;
  formatValue?: (v: number) => string;
}

const PLOT_HEIGHT = 128;

export function TrendBars({ bars, caption, formatValue }: Props) {
  const max = Math.max(...bars.map((b) => b.value), 0);
  const hasData = max > 0;
  const lastIndex = bars.length - 1;

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
            const isCurrent = index === lastIndex;
            const pct = Math.max((bar.value / max) * 100, bar.value > 0 ? 4 : 0);
            return (
              <View key={`${bar.label}-${index}`} className="flex-1 items-center justify-end" style={{ height: "100%" }}>
                {isCurrent && formatValue ? (
                  <Text
                    style={{ color: "#5c594f", fontSize: 9, fontWeight: "600", marginBottom: 2 }}
                    numberOfLines={1}
                  >
                    {formatValue(bar.value)}
                  </Text>
                ) : null}
                <View
                  style={{
                    width: "100%",
                    height: `${pct}%`,
                    backgroundColor: isCurrent ? "#26241f" : "#ddd8ce",
                    borderTopLeftRadius: 3,
                    borderTopRightRadius: 3,
                  }}
                />
                <Text
                  style={{ color: "#928d80", fontSize: 9, marginTop: 4 }}
                  numberOfLines={1}
                >
                  {bar.label}
                </Text>
              </View>
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
