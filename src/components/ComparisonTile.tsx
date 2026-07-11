import { Text, View } from "react-native";

interface Props {
  label: string;
  value: string;
  deltaText?: string | null;
  better?: boolean | null;
}

function deltaColor(better: boolean | null | undefined): string {
  if (better === true) return "#2f9e6e";
  if (better === false) return "#bf3b30";
  return "#928d80";
}

export function ComparisonTile({ label, value, deltaText, better }: Props) {
  return (
    <View className="flex-1 bg-surface-card rounded-2xl p-3">
      <Text
        style={{ color: "#928d80", fontSize: 10, fontWeight: "700", letterSpacing: 1 }}
        numberOfLines={1}
      >
        {label.toUpperCase()}
      </Text>
      <Text
        style={{
          color: "#26241f",
          fontSize: 22,
          fontWeight: "700",
          fontFamily: "JetBrains Mono, Menlo, Courier New, monospace",
          marginTop: 4,
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text
        style={{ color: deltaColor(better), fontSize: 11, fontWeight: "600", marginTop: 4 }}
        numberOfLines={1}
      >
        {deltaText ?? " "}
      </Text>
    </View>
  );
}
