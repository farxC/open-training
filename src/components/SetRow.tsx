import uiColors from "@/theme/palette.json";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Button } from "@/components/ui/button";
import type { WorkoutSet } from "@/types";

interface Props {
  set: WorkoutSet;
  onChange: (
    patch: Partial<
      Pick<WorkoutSet, "reps" | "weight_kg" | "rpe" | "rir" | "failure">
    >,
  ) => void;
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
  const [weightText, setWeightText] = useState(
    set.weight_kg > 0 ? String(set.weight_kg) : "",
  );
  const [repsText, setRepsText] = useState(
    set.reps > 0 ? String(set.reps) : "",
  );
  const [rpeText, setRpeText] = useState(
    set.rpe != null ? String(set.rpe) : "",
  );

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

  const [showEffort, setShowEffort] = useState(
    set.rpe != null || set.rir != null || Boolean(set.failure),
  );
  return (
    <View
      style={{
        borderBottomWidth: 1,
        borderBottomColor: uiColors.line,
        paddingVertical: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text
          className="font-sans"
          style={{
            width: 34,
            textAlign: "center",
            color: uiColors.muted,
            fontSize: 14,
          }}
        >
          {String(set.set_number).padStart(2, "0")}
        </Text>
        <TextInput
          className="font-sans"
          accessibilityLabel={`Peso da série ${set.set_number}`}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 48,
            padding: 10,
            textAlign: "center",
            backgroundColor: uiColors.paper,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: uiColors.line,
            fontSize: 20,
            color: uiColors.ink,
          }}
          value={weightText}
          placeholder="0"
          placeholderTextColor={uiColors.faint}
          keyboardType="decimal-pad"
          onChangeText={handleWeightChange}
        />
        <TextInput
          className="font-sans"
          accessibilityLabel={`Repetições da série ${set.set_number}`}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 48,
            padding: 10,
            textAlign: "center",
            backgroundColor: uiColors.paper,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: uiColors.line,
            fontSize: 20,
            color: uiColors.ink,
          }}
          value={repsText}
          placeholder="0"
          placeholderTextColor={uiColors.faint}
          keyboardType="decimal-pad"
          onChangeText={handleRepsChange}
        />
        <Button
          accessibilityLabel={`Excluir série ${set.set_number}`}
          onPress={onDelete}
          style={{ width: 36, height: 44, borderRadius: 18 }}
        >
          <MaterialCommunityIcons
            name="trash-can-outline"
            size={18}
            color={uiColors.muted}
          />
        </Button>
      </View>
      <Button
        accessibilityLabel={`Esforço da série ${set.set_number}`}
        accessibilityState={{ expanded: showEffort }}
        onPress={() => setShowEffort((value) => !value)}
        className="justify-start"
        style={{ marginLeft: 44, minHeight: 36, gap: 5 }}
      >
        <Text
          className="font-sans"
          style={{ color: uiColors.muted, fontSize: 12 }}
        >
          Esforço{set.rpe != null ? ` · RPE ${set.rpe}` : ""}
          {set.rir != null ? ` · RIR ${set.rir}` : ""}
          {set.failure ? " · Falha" : ""}
        </Text>
        <MaterialCommunityIcons
          name={showEffort ? "chevron-up" : "chevron-down"}
          size={16}
          color={uiColors.muted}
        />
      </Button>
      {showEffort && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            marginLeft: 44,
            paddingBottom: 4,
          }}
        >
          <Text
            className="font-sans"
            style={{ fontSize: 12, color: uiColors.muted }}
          >
            RPE
          </Text>
          <TextInput
            className="font-sans"
            accessibilityLabel={`RPE da série ${set.set_number}`}
            style={{
              color: uiColors.ink,
              fontSize: 14,
              width: 44,
              minHeight: 44,
              textAlign: "center",
              backgroundColor: uiColors.paper,
              borderRadius: 8,
            }}
            value={rpeText}
            placeholder="—"
            placeholderTextColor={uiColors.faint}
            keyboardType="decimal-pad"
            onChangeText={handleRpeChange}
          />
          <Text
            className="font-sans"
            style={{ fontSize: 12, color: uiColors.muted }}
          >
            RIR
          </Text>
          <TextInput
            className="font-sans"
            accessibilityLabel={`RIR da série ${set.set_number}`}
            style={{
              color: uiColors.ink,
              fontSize: 14,
              width: 44,
              minHeight: 44,
              textAlign: "center",
              backgroundColor: uiColors.paper,
              borderRadius: 8,
            }}
            value={set.rir != null ? String(set.rir) : ""}
            placeholder="—"
            placeholderTextColor={uiColors.faint}
            keyboardType="number-pad"
            onChangeText={(value) => {
              if (value === "") {
                onChange({ rir: null });
                return;
              }
              const number = parseInt(value, 10);
              if (!isNaN(number)) onChange({ rir: Math.max(0, number) });
            }}
          />
          <Button
            accessibilityLabel={`Falha na série ${set.set_number}`}
            accessibilityState={{ checked: Boolean(set.failure) }}
            onPress={() => onChange({ failure: set.failure ? 0 : 1 })}
            style={{
              minHeight: 44,
              paddingHorizontal: 10,
              borderRadius: 8,
              backgroundColor: set.failure
                ? uiColors.dangerSoft
                : uiColors.paper,
            }}
          >
            <Text
              className="font-sans"
              style={{
                color: set.failure ? uiColors.danger : uiColors.muted,
                fontSize: 12,
                fontWeight: "600",
              }}
            >
              Falha
            </Text>
          </Button>
        </View>
      )}
    </View>
  );
}
