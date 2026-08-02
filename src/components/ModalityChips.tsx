import type { ComponentProps } from "react";
import { Fragment } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { MODALITY_CATEGORIES, modalitiesOfCategory } from "@/data/modalities";
import type { Modality } from "@/types";

type MciName = ComponentProps<typeof MaterialCommunityIcons>["name"];

interface Props {
  value: Modality;
  onChange: (m: Modality) => void;
}

/**
 * The modality selector. A horizontally scrollable chip row in the same visual
 * language as PeriodChips — unlike the segmented ModalityToggle it replaced,
 * it doesn't divide a fixed track between options, so it stays usable as the
 * registry grows. Options come straight from MODALITIES.
 *
 * Chips are grouped by training category (Força / Endurance), each group
 * introduced by a micro-caption and separated by a hairline rule, so the two
 * kinds of training read as distinct without costing a second row.
 */
export function ModalityChips({ value, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexDirection: "row", alignItems: "center", gap: 6, paddingRight: 4 }}
    >
      {MODALITY_CATEGORIES.map((cat, catIndex) => (
        <Fragment key={cat.key}>
          {catIndex > 0 && (
            <View style={{ width: 1, alignSelf: "stretch", backgroundColor: "#ddd8ce", marginHorizontal: 4 }} />
          )}
          <Text
            className="text-ink-faint"
            style={{ fontSize: 9, fontWeight: "700", letterSpacing: 1, marginRight: 2 }}
          >
            {cat.label.toUpperCase()}
          </Text>
          {modalitiesOfCategory(cat.key).map((m) => {
            const active = m.key === value;
            return (
              <Pressable
                key={m.key}
                onPress={() => onChange(m.key)}
                style={({ hovered }: { hovered?: boolean }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: active ? "#26241f" : "#ddd8ce",
                  backgroundColor: active ? "#26241f" : hovered ? "#f0ede6" : "transparent",
                })}
              >
                {({ hovered }: { hovered?: boolean }) => {
                  const color = active ? "#ffffff" : hovered ? "#5c594f" : "#928d80";
                  return (
                    <>
                      <MaterialCommunityIcons name={m.icon as MciName} size={16} color={color} />
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: 13, fontWeight: active ? "700" : "500", color, letterSpacing: -0.1 }}
                      >
                        {m.label}
                      </Text>
                    </>
                  );
                }}
              </Pressable>
            );
          })}
        </Fragment>
      ))}
    </ScrollView>
  );
}
