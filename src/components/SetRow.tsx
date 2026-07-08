import { Text, TextInput, TouchableOpacity, View } from "react-native";
import type { WorkoutSet } from "@/types";

interface Props {
  set: WorkoutSet;
  onChange: (patch: Partial<Pick<WorkoutSet, "reps" | "weight_kg" | "rpe" | "rir">>) => void;
  onDelete: () => void;
}

export function SetRow({ set, onChange, onDelete }: Props) {
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: '#ddd8ce', paddingVertical: 10 }}>
      {/* Primary row: set# | weight | × | reps | delete */}
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <Text
          className="text-ink-mute text-sm text-center"
          style={{ width: 20 }}
        >
          {set.set_number}
        </Text>

        <View className="flex-1 flex-row items-center bg-surface-elevated rounded-lg px-2.5 py-1.5">
          <TextInput
            className="text-ink flex-1 text-center text-sm"
            value={set.weight_kg > 0 ? String(set.weight_kg) : ""}
            placeholder="0"
            placeholderTextColor="#bdb8aa"
            keyboardType="decimal-pad"
            onChangeText={(v) => onChange({ weight_kg: parseFloat(v) || 0 })}
          />
          <Text className="text-ink-mute text-xs">kg</Text>
        </View>

        <Text className="text-ink-faint text-sm">×</Text>

        <View className="flex-1 flex-row items-center bg-surface-elevated rounded-lg px-2.5 py-1.5">
          <TextInput
            className="text-ink flex-1 text-center text-sm"
            value={set.reps > 0 ? String(set.reps) : ""}
            placeholder="0"
            placeholderTextColor="#bdb8aa"
            keyboardType="number-pad"
            onChangeText={(v) => onChange({ reps: parseInt(v, 10) || 0 })}
          />
          <Text className="text-ink-mute text-xs">reps</Text>
        </View>

        <TouchableOpacity onPress={onDelete} style={{ padding: 4 }}>
          <Text style={{ color: '#928d80', fontSize: 18, lineHeight: 20 }}>×</Text>
        </TouchableOpacity>
      </View>

      {/* Secondary row: RPE + RIR */}
      <View className="flex-row items-center mt-2" style={{ gap: 20, paddingLeft: 28 }}>
        {/* RPE */}
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <Text style={{ color: '#928d80', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }}>
            RPE
          </Text>
          <TextInput
            style={{
              color: '#26241f',
              fontSize: 12,
              width: 38,
              textAlign: 'center',
              backgroundColor: '#ebe7df',
              borderRadius: 6,
              paddingVertical: 3,
            }}
            value={set.rpe != null ? String(set.rpe) : ""}
            placeholder="—"
            placeholderTextColor="#bdb8aa"
            keyboardType="decimal-pad"
            onChangeText={(v) => {
              if (v === "") { onChange({ rpe: null }); return; }
              const n = parseFloat(v);
              if (!isNaN(n)) onChange({ rpe: n });
            }}
          />
        </View>

        {/* RIR */}
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <Text style={{ color: '#928d80', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }}>
            RIR
          </Text>
          <TextInput
            style={{
              color: '#26241f',
              fontSize: 12,
              width: 38,
              textAlign: 'center',
              backgroundColor: '#ebe7df',
              borderRadius: 6,
              paddingVertical: 3,
            }}
            value={set.rir != null ? String(set.rir) : ""}
            placeholder="—"
            placeholderTextColor="#bdb8aa"
            keyboardType="number-pad"
            onChangeText={(v) => {
              if (v === "") { onChange({ rir: null }); return; }
              const n = parseInt(v, 10);
              if (!isNaN(n)) onChange({ rir: Math.max(0, n) });
            }}
          />
        </View>
      </View>
    </View>
  );
}
