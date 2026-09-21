import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { useTheme } from "@/theme";

interface Props {
  title: string;
  /** Right-aligned slot for an action belonging to the section (e.g. "editar"). */
  right?: ReactNode;
}

/** Small tick + all-caps label used to introduce a section within a screen. */
export function SectionHeader({ title, right }: Props) {
  const { colors } = useTheme();

  return (
    <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
      <View style={{ width: 2, height: 14, backgroundColor: colors.ink, borderRadius: 1 }} />
      <Text style={{ color: colors["ink-mute"], fontSize: 10, fontWeight: "700", letterSpacing: 1.5 }}>
        {title.toUpperCase()}
      </Text>
      {right ? (
        <>
          <View style={{ flex: 1 }} />
          {right}
        </>
      ) : null}
    </View>
  );
}
