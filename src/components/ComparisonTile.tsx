import { Text, View } from "react-native";
import colors from "@/theme/palette.json";

interface Props {
  label: string;
  value: string;
  deltaText?: string | null;
  better?: boolean | null;
}
export function ComparisonTile({ label, value, deltaText, better }: Props) {
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
      <Text
        className="font-sans"
        style={{
          color: colors.ink,
          fontSize: 30,
          fontWeight: "600",
          letterSpacing: -1,
          fontVariant: ["tabular-nums"],
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </Text>
      <Text className="font-sans" style={{ color: colors.muted, fontSize: 13 }}>
        {label}
      </Text>
      {deltaText && (
        <Text
          className="font-sans"
          style={{
            color:
              better === true
                ? colors.success
                : better === false
                  ? colors.danger
                  : colors.muted,
            fontSize: 12,
            fontWeight: "600",
          }}
        >
          {deltaText}
        </Text>
      )}
    </View>
  );
}
