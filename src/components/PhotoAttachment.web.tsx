import { useRef } from "react";
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

const TILE_SIZE = 92;

export function PhotoAttachment({ photos, onAdd, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    onAdd(objectUrl);
    e.target.value = "";
  };

  return (
    <View>
      <Text
        className="text-ink-mute text-center"
        style={{ fontSize: 10, fontWeight: "700", letterSpacing: 1.2, marginBottom: 10 }}
      >
        FOTOS{photos.length > 0 ? ` · ${photos.length}` : ""}
      </Text>
      <View className="flex-row flex-wrap justify-center" style={{ gap: 10 }}>
        {photos.map((photo) => (
          <View
            key={photo.id}
            className="relative overflow-hidden"
            style={{ width: TILE_SIZE, height: TILE_SIZE, borderRadius: 18, borderWidth: 1, borderColor: "#ddd8ce" }}
          >
            <Image
              source={{ uri: photo.uri }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
            <TouchableOpacity
              className="absolute items-center justify-center"
              style={{
                top: 6,
                right: 6,
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: "rgba(38,36,31,0.72)",
              }}
              onPress={() => onRemove(photo.id)}
              hitSlop={6}
            >
              <MaterialCommunityIcons name="close" size={13} color="#ffffff" />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          className="items-center justify-center"
          style={{
            width: TILE_SIZE,
            height: TILE_SIZE,
            borderRadius: 18,
            borderWidth: 1.5,
            borderColor: "#c9c3b6",
            borderStyle: "dashed",
            backgroundColor: "#f4f2ee",
          }}
          onPress={() => inputRef.current?.click()}
          activeOpacity={0.7}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: "#ebe7df",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 6,
            }}
          >
            <MaterialCommunityIcons name="camera-plus-outline" size={17} color="#5c594f" />
          </View>
          <Text className="text-ink-soft" style={{ fontSize: 11, fontWeight: "600" }}>
            Adicionar
          </Text>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleChange}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
