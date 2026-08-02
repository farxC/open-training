import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
  continuousDurationSec,
  distanceDisplay,
  formatClock,
  formatEffortInput,
  fromDisplayDistance,
  parseEffort,
  toDisplayDistance,
} from "@/data/modalities";
import type { Modality, WorkoutSet } from "@/types";

interface Props {
  set: WorkoutSet;
  modality: Modality;
  onChange: (patch: Partial<Pick<WorkoutSet, "distance_km" | "duration_sec" | "pace_sec">>) => void;
  onDelete: () => void;
}

/**
 * One logged effort of a distance modality. Stored values are always canonical
 * (km, seconds-per-km); this row converts to and from whatever units the
 * modality declares — metres and /100m for natação, km/h for ciclismo.
 */
export function DistanceRow({ set, modality, onChange, onDelete }: Props) {
  const display = distanceDisplay(modality);
  const [effortText, setEffortText] = useState(() => formatEffortInput(set.pace_sec, modality));

  const handleDistanceChange = (v: string) => {
    const shown = parseFloat(v.replace(",", ".")) || 0;
    const distance = fromDisplayDistance(shown, modality) ?? 0;
    const duration_sec = set.pace_sec != null ? continuousDurationSec(distance, set.pace_sec) : set.duration_sec;
    onChange({ distance_km: distance, duration_sec });
  };

  const handleEffortChange = (v: string) => {
    setEffortText(v);
    const pace = parseEffort(v, modality);
    onChange({ pace_sec: pace, duration_sec: continuousDurationSec(set.distance_km, pace) });
  };

  // Round-trip through the modality's unit can leave float dust (0.05 km ->
  // 50.000000000000004 m); trim it without turning "1500" into "1500.000".
  const shownDistance = toDisplayDistance(set.distance_km, modality);
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
            value={shownDistance ? String(Number(shownDistance.toFixed(3))) : ""}
            placeholder="0"
            placeholderTextColor="#bdb8aa"
            keyboardType="decimal-pad"
            onChangeText={handleDistanceChange}
          />
          <Text className="text-ink-mute text-xs">{display.distanceUnit}</Text>
        </View>

        <Text className="text-ink-faint text-sm">a</Text>

        <View className="flex-1 flex-row items-center bg-surface-elevated rounded-lg px-2.5 py-1.5">
          <TextInput
            className="text-ink flex-1 text-center text-sm"
            value={effortText}
            placeholder={display.effortPlaceholder}
            placeholderTextColor="#bdb8aa"
            keyboardType={display.effortMode === "speed" ? "decimal-pad" : "default"}
            onChangeText={handleEffortChange}
          />
          <Text className="text-ink-mute text-xs">{display.effortSuffix}</Text>
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
