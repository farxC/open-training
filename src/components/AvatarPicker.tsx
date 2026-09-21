import * as ImagePicker from "expo-image-picker";
import { Image, TouchableOpacity, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

interface Props {
  uri: string | null;
  onChange: (uri: string) => void;
  size?: number;
  editable?: boolean;
}

export function AvatarPicker({ uri, onChange, size = 84, editable = false }: Props) {
  const handlePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      onChange(result.assets[0].uri);
    }
  };

  return (
    <TouchableOpacity
      onPress={editable ? handlePick : undefined}
      activeOpacity={editable ? 0.8 : 1}
      style={{ width: size, height: size }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 3,
          borderColor: "#f4f2ee",
          backgroundColor: "#ebe7df",
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {uri ? (
          <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        ) : (
          <MaterialCommunityIcons name="account" size={size * 0.55} color="#928d80" />
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
            backgroundColor: "rgba(38,36,31,0.78)",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 2,
            borderColor: "#f4f2ee",
          }}
        >
          <MaterialCommunityIcons name="camera-plus-outline" size={size * 0.16} color="#ffffff" />
        </View>
      )}
    </TouchableOpacity>
  );
}
