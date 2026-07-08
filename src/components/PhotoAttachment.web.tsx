import { useRef } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";

interface Props {
  uri: string | null;
  onPick: (uri: string) => void;
  onRemove: () => void;
}

export function PhotoAttachment({ uri, onPick, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    onPick(objectUrl);
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
      onPress={() => inputRef.current?.click()}
    >
      <Text className="text-ink-mute text-sm">📷 Add photo</Text>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleChange}
      />
    </TouchableOpacity>
  );
}
