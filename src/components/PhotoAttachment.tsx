import * as ImagePicker from "expo-image-picker";
import { Image, Text, TouchableOpacity, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

interface Photo {
  id: number;
  uri: string;
}

interface Props {
  photos: Photo[];
  onAdd: (uri: string) => void;
  onRemove: (id: number) => void;
}

export function PhotoAttachment({ photos, onAdd, onRemove }: Props) {
  const handlePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      onAdd(result.assets[0].uri);
    }
  };

  return (
    <View className="flex-row flex-wrap" style={{ gap: 10 }}>
      {photos.map((photo) => (
        <View key={photo.id} className="relative" style={{ width: 96, height: 96 }}>
          <Image
            source={{ uri: photo.uri }}
            className="w-full h-full rounded-xl"
            resizeMode="cover"
          />
          <TouchableOpacity
            className="absolute top-1 right-1 bg-black/60 rounded-full w-6 h-6 items-center justify-center"
            onPress={() => onRemove(photo.id)}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={13} color="#ffffff" />
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity
        className="border border-dashed border-ink-faint rounded-xl items-center justify-center"
        style={{ width: 96, height: 96 }}
        onPress={handlePick}
      >
        <Text className="text-ink-mute text-xs text-center">📷{"\n"}Adicionar</Text>
      </TouchableOpacity>
    </View>
  );
}
