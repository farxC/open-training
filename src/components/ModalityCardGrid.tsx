import type { ComponentProps } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { MODALITY_CATEGORIES, modalitiesOfCategory } from "@/data/modalities";
import type { Modality } from "@/types";

type MciName = ComponentProps<typeof MaterialCommunityIcons>["name"];

interface Props {
  /** Highlighted modality. Omit where the tap navigates away immediately and
   *  there's no selected state to show. */
  value?: Modality;
  onSelect: (m: Modality) => void;
}

/**
 * Icon+label cards for picking a modality, grouped by training category
 * (Força / Endurance) so the two kinds of training read as distinct.
 *
 * Shared by the session wizard and the split wizard, which rendered the same
 * grid twice. Cards wrap rather than dividing one row: the registry grows, the
 * row doesn't.
 */
export function ModalityCardGrid({ value, onSelect }: Props) {
  return (
    <>
      {MODALITY_CATEGORIES.map((cat) => (
        <View key={cat.key} className="mb-4">
          <Text
            className="text-ink-faint mb-2"
            style={{ fontSize: 10, letterSpacing: 1, fontWeight: "700" }}
          >
            {cat.label.toUpperCase()}
          </Text>
          <View className="flex-row" style={{ gap: 10, flexWrap: "wrap" }}>
            {modalitiesOfCategory(cat.key).map((m) => {
              const on = value === m.key;
              return (
                <TouchableOpacity
                  key={m.key}
                  className="items-center justify-center rounded-2xl"
                  style={{
                    flexBasis: "31%",
                    paddingVertical: 18,
                    gap: 8,
                    borderWidth: 1,
                    borderColor: on ? "#26241f" : "#ddd8ce",
                    backgroundColor: on ? "#26241f" : "#ffffff",
                  }}
                  onPress={() => onSelect(m.key)}
                  activeOpacity={0.85}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: on ? "rgba(255,255,255,0.14)" : "#f4f2ee",
                    }}
                  >
                    <MaterialCommunityIcons
                      name={m.icon as MciName}
                      size={24}
                      color={on ? "#ffffff" : "#5c594f"}
                    />
                  </View>
                  <Text style={{ color: on ? "#ffffff" : "#5c594f", fontSize: 13, fontWeight: "600" }}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}
    </>
  );
}
