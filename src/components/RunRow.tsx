import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { continuousDurationSec, formatClock, parseClock } from "@/data/modalities";
import type { WorkoutSet } from "@/types";

interface Props {
  set: WorkoutSet;
  onChange: (patch: Partial<Pick<WorkoutSet, "distance_km" | "duration_sec" | "pace_sec">>) => void;
  onDelete: () => void;
}

export function RunRow({ set, onChange, onDelete }: Props) {
  const [paceText, setPaceText] = useState(formatClock(set.pace_sec));

  const handleDistanceChange = (v: string) => {
    const distance = parseFloat(v.replace(",", ".")) || 0;
    onChange({ distance_km: distance, duration_sec: continuousDurationSec(distance, set.pace_sec) });
  };

  const handlePaceChange = (v: string) => {
    setPaceText(v);
    const pace = parseClock(v);
    onChange({ pace_sec: pace, duration_sec: continuousDurationSec(set.distance_km, pace) });
  };

  const duration = formatClock(set.duration_sec);

  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: '#ddd8ce', paddingVertical: 10 }}>
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <Text className="text-ink-mute text-sm text-center" style={{ width: 20 }}>
          {set.set_number}
        </Text>

        <View className="flex-1 flex-row items-center bg-surface-elevated rounded-lg px-2.5 py-1.5">
          <TextInput
            className="text-ink flex-1 text-center text-sm"
            value={set.distance_km ? String(set.distance_km) : ""}
            placeholder="0"
            placeholderTextColor="#bdb8aa"
            keyboardType="decimal-pad"
            onChangeText={handleDistanceChange}
          />
          <Text className="text-ink-mute text-xs">km</Text>
        </View>

        <Text className="text-ink-faint text-sm">a</Text>

        <View className="flex-1 flex-row items-center bg-surface-elevated rounded-lg px-2.5 py-1.5">
          <TextInput
            className="text-ink flex-1 text-center text-sm"
            value={paceText}
            placeholder="mm:ss"
            placeholderTextColor="#bdb8aa"
            onChangeText={handlePaceChange}
          />
          <Text className="text-ink-mute text-xs">/km</Text>
        </View>

        <TouchableOpacity onPress={onDelete} style={{ padding: 4 }}>
          <MaterialCommunityIcons name="trash-can-outline" size={16} color="#928d80" />
        </TouchableOpacity>
      </View>

      {duration && (
        <Text className="text-ink-mute text-xs mt-1.5" style={{ paddingLeft: 28 }}>
          Duração: {duration}
        </Text>
      )}
    </View>
  );
}
