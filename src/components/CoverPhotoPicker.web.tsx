import { useRef } from "react";
import { Image, TouchableOpacity } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

interface Props {
  uri: string | null;
  onChange: (uri: string) => void;
  height?: number;
  editable?: boolean;
}

export function CoverPhotoPicker({ uri, onChange, height = 140, editable = false }: Props) {
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
      activeOpacity={editable ? 0.9 : 1}
      style={{ height, backgroundColor: "#ebe7df", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
      ) : editable ? (
        <MaterialCommunityIcons name="image-plus" size={28} color="#928d80" />
      ) : null}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleChange} />
    </TouchableOpacity>
  );
}
