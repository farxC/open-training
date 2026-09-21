import { useRef } from "react";
import { Image, TouchableOpacity, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTheme } from "@/theme";

interface Props {
  uri: string | null;
  onChange: (uri: string) => void;
  size?: number;
  editable?: boolean;
}

export function AvatarPicker({ uri, onChange, size = 84, editable = false }: Props) {
  const { colors } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onChange(URL.createObjectURL(file));
    e.target.value = "";
  };

  return (
    <TouchableOpacity
      onPress={editable ? () => inputRef.current?.click() : undefined}
      activeOpacity={editable ? 0.8 : 1}
      style={{ width: size, height: size }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 3,
          borderColor: colors["surface"],
          backgroundColor: colors["surface-elevated"],
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {uri ? (
          <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        ) : (
          <MaterialCommunityIcons name="account" size={size * 0.55} color={colors["ink-mute"]} />
        )}
      </View>
      {editable && (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: size * 0.32,
            height: size * 0.32,
            borderRadius: (size * 0.32) / 2,
            backgroundColor: colors["media-scrim"],
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 2,
            borderColor: colors["surface"],
          }}
        >
          <MaterialCommunityIcons name="camera-plus-outline" size={size * 0.16} color={colors["on-media"]} />
        </View>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleChange} />
    </TouchableOpacity>
  );
}
