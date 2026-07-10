import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { WorkoutSet } from "@/types";

interface Props {
  set: WorkoutSet;
  onChange: (patch: Partial<Pick<WorkoutSet, "reps" | "weight_kg" | "rpe" | "rir">>) => void;
  onDelete: () => void;
}

// Keeps exactly what the user typed (including a trailing "." or partial decimal)
// instead of the parsed number, which would otherwise clobber the decimal point
// on every keystroke of a controlled TextInput.
function sanitizeDecimalInput(raw: string, maxDecimals: number | null): string {
  let v = raw.replace(",", ".").replace(/[^0-9.]/g, "");
  const firstDot = v.indexOf(".");
  if (firstDot !== -1) {
    v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
  }
  if (maxDecimals === 0) {
    v = v.split(".")[0];
  } else if (maxDecimals != null && firstDot !== -1) {
    const [intPart, decPart] = v.split(".");
    v = `${intPart}.${decPart.slice(0, maxDecimals)}`;
  }
  return v;
}

export function SetRow({ set, onChange, onDelete }: Props) {
  const [weightText, setWeightText] = useState(set.weight_kg > 0 ? String(set.weight_kg) : "");
  const [repsText, setRepsText] = useState(set.reps > 0 ? String(set.reps) : "");
  const [rpeText, setRpeText] = useState(set.rpe != null ? String(set.rpe) : "");

  const handleWeightChange = (raw: string) => {
    const cleaned = sanitizeDecimalInput(raw, null);
    setWeightText(cleaned);
    const n = parseFloat(cleaned);
    onChange({ weight_kg: isNaN(n) ? 0 : n });
  };

  const handleRepsChange = (raw: string) => {
    const cleaned = sanitizeDecimalInput(raw, 1);
    setRepsText(cleaned);
    const n = parseFloat(cleaned);
    onChange({ reps: isNaN(n) ? 0 : n });
  };

  const handleRpeChange = (raw: string) => {
    if (raw === "") {
      setRpeText("");
      onChange({ rpe: null });
      return;
    }
    const cleaned = sanitizeDecimalInput(raw, 1);
    setRpeText(cleaned);
    const n = parseFloat(cleaned);
    if (!isNaN(n)) onChange({ rpe: n });
  };

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

        <View
          className="flex-1 flex-row items-center justify-center bg-surface-elevated rounded-lg"
          style={{ paddingVertical: 11, gap: 5 }}
        >
          <TextInput
            className="text-ink text-sm"
            style={{ textAlign: 'right', minWidth: 26, padding: 0 }}
            value={weightText}
            placeholder="0"
            placeholderTextColor="#bdb8aa"
            keyboardType="decimal-pad"
            onChangeText={handleWeightChange}
          />
          <Text className="text-ink-mute text-xs">kg</Text>
        </View>

        <Text className="text-ink-faint text-sm">×</Text>

        <View
          className="flex-1 flex-row items-center justify-center bg-surface-elevated rounded-lg"
          style={{ paddingVertical: 11, gap: 5 }}
        >
          <TextInput
            className="text-ink text-sm"
            style={{ textAlign: 'right', minWidth: 22, padding: 0 }}
            value={repsText}
            placeholder="0"
            placeholderTextColor="#bdb8aa"
            keyboardType="decimal-pad"
            onChangeText={handleRepsChange}
          />
          <Text className="text-ink-mute text-xs">reps</Text>
        </View>

        <TouchableOpacity onPress={onDelete} hitSlop={8} style={{ padding: 6 }}>
          <MaterialCommunityIcons name="trash-can-outline" size={16} color="#928d80" />
        </TouchableOpacity>
      </View>

      {/* Secondary row: RPE + RIR */}
      <View className="flex-row items-center mt-2.5" style={{ gap: 16, paddingLeft: 28 }}>
        {/* RPE */}
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Text style={{ color: '#928d80', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }}>
            RPE
          </Text>
          <TextInput
            style={{
              color: '#26241f',
              fontSize: 13,
              width: 44,
              textAlign: 'center',
              backgroundColor: '#ebe7df',
              borderRadius: 8,
              paddingVertical: 8,
            }}
            value={rpeText}
            placeholder="—"
            placeholderTextColor="#bdb8aa"
            keyboardType="decimal-pad"
            onChangeText={handleRpeChange}
          />
        </View>

        {/* RIR */}
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Text style={{ color: '#928d80', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }}>
            RIR
          </Text>
          <TextInput
            style={{
              color: '#26241f',
              fontSize: 13,
              width: 44,
              textAlign: 'center',
              backgroundColor: '#ebe7df',
              borderRadius: 8,
              paddingVertical: 8,
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
