import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { formatClock, formatPaceSec, parseClock } from "@/data/modalities";
import type { WorkoutSet } from "@/types";

interface Props {
  set: WorkoutSet;
  onChange: (patch: Partial<Pick<WorkoutSet, "distance_km" | "duration_sec" | "pace_sec">>) => void;
  onDelete: () => void;
}

function computePace(distanceKm: number | null, durationSec: number | null): number | null {
  if (!distanceKm || !durationSec || distanceKm <= 0 || durationSec <= 0) return null;
  return durationSec / distanceKm;
}

export function RunRow({ set, onChange, onDelete }: Props) {
  const [durationText, setDurationText] = useState(formatClock(set.duration_sec));

  const handleDistanceChange = (v: string) => {
    const distance = parseFloat(v.replace(",", ".")) || 0;
    onChange({ distance_km: distance, pace_sec: computePace(distance, set.duration_sec) });
  };

  const handleDurationChange = (v: string) => {
    setDurationText(v);
    const duration = parseClock(v);
    onChange({ duration_sec: duration, pace_sec: computePace(set.distance_km, duration) });
  };

  const pace = formatPaceSec(set.pace_sec);

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

        <Text className="text-ink-faint text-sm">em</Text>

        <View className="flex-1 flex-row items-center bg-surface-elevated rounded-lg px-2.5 py-1.5">
          <TextInput
            className="text-ink flex-1 text-center text-sm"
            value={durationText}
            placeholder="mm:ss"
            placeholderTextColor="#bdb8aa"
            onChangeText={handleDurationChange}
          />
        </View>

        <TouchableOpacity onPress={onDelete} style={{ padding: 4 }}>
          <MaterialCommunityIcons name="trash-can-outline" size={16} color="#928d80" />
        </TouchableOpacity>
      </View>

      {pace && (
        <Text className="text-ink-mute text-xs mt-1.5" style={{ paddingLeft: 28 }}>
          Pace: {pace}
        </Text>
      )}
    </View>
  );
}
