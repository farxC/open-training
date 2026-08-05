import type { ReactNode } from "react";
import { Text, View } from "react-native";

interface Props {
  title: string;
  /** Right-aligned slot for an action belonging to the section (e.g. "editar"). */
  right?: ReactNode;
}

/** Small tick + all-caps label used to introduce a section within a screen. */
export function SectionHeader({ title, right }: Props) {
  return (
    <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
      <View style={{ width: 2, height: 14, backgroundColor: "#26241f", borderRadius: 1 }} />
      <Text style={{ color: "#928d80", fontSize: 10, fontWeight: "700", letterSpacing: 1.5 }}>
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
