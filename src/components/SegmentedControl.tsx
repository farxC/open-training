import type { ComponentProps } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

type MciName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export interface SegmentedOption<T extends string> {
  key: T;
  label: string;
  icon?: string;
}

interface Props<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (key: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View
      className="flex-row rounded-lg overflow-hidden"
      style={{ borderWidth: 1, borderColor: "#ddd8ce" }}
    >
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <TouchableOpacity
            key={opt.key}
            className="flex-1 flex-row items-center justify-center px-2 py-1.5"
            style={{ backgroundColor: active ? "#26241f" : "transparent", gap: 4 }}
            onPress={() => onChange(opt.key)}
          >
            {opt.icon ? (
              <MaterialCommunityIcons
                name={opt.icon as MciName}
                size={15}
                color={active ? "#ffffff" : "#928d80"}
              />
            ) : null}
            <Text
              className="text-xs font-semibold"
              style={{ color: active ? "#ffffff" : "#928d80" }}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
