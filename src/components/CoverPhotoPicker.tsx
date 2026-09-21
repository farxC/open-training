import * as ImagePicker from "expo-image-picker";
import { Image, TouchableOpacity } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

interface Props {
  uri: string | null;
  onChange: (uri: string) => void;
  height?: number;
  editable?: boolean;
}

export function CoverPhotoPicker({ uri, onChange, height = 140, editable = false }: Props) {
  const handlePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [16, 9],
    });
    if (!result.canceled && result.assets[0]) {
      onChange(result.assets[0].uri);
    }
  };

  return (
    <TouchableOpacity
      onPress={editable ? handlePick : undefined}
      activeOpacity={editable ? 0.9 : 1}
      style={{ height, backgroundColor: "#ebe7df", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
      ) : editable ? (
        <MaterialCommunityIcons name="image-plus" size={28} color="#928d80" />
      ) : null}
    </TouchableOpacity>
  );
}
