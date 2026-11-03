import type { ReactNode } from "react";
import { Text, View } from "react-native";
import colors from "@/theme/palette.json";

export function SectionHeader({
  title,
  right,
}: {
  title: string;
  right?: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginBottom: 14,
      }}
    >
      <Text
        className="font-display"
        style={{
          color: colors.ink,
          fontSize: 22,
          letterSpacing: -0.5,
          flex: 1,
        }}
      >
        {title}
      </Text>
      {right}
    </View>
  );
}
