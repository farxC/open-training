import * as ImagePicker from "expo-image-picker";
import { Image, Text, TouchableOpacity, View } from "react-native";

interface Props {
  uri: string | null;
  onPick: (uri: string) => void;
  onRemove: () => void;
}

export function PhotoAttachment({ uri, onPick, onRemove }: Props) {
  const handlePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      onPick(result.assets[0].uri);
    }
  };

  if (uri) {
    return (
      <View className="relative">
        <Image
          source={{ uri }}
          className="w-full h-48 rounded-xl"
          resizeMode="cover"
        />
        <TouchableOpacity
          className="absolute top-2 right-2 bg-black/60 rounded-full w-7 h-7 items-center justify-center"
          onPress={onRemove}
        >
          <Text className="text-white text-sm">×</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity
      className="border border-dashed border-ink-faint rounded-xl h-24 items-center justify-center"
      onPress={handlePick}
    >
      <Text className="text-ink-mute text-sm">📷 Add photo</Text>
    </TouchableOpacity>
  );
}
