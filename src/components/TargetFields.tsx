import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { continuousDurationSec, formatClock, formatPaceSec, parseClock } from "@/data/modalities";

export function NumField({
  value,
  onChange,
  suffix,
  integer,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  suffix?: string;
  integer?: boolean;
}) {
  // Local text buffer so in-progress input like "5." isn't reformatted away.
  const [text, setText] = useState(value != null && value > 0 ? String(value) : "");
  return (
    <View className="flex-row items-center bg-surface-elevated rounded-lg px-2 py-1" style={{ gap: 2 }}>
      <TextInput
        value={text}
        onChangeText={(v) => {
          setText(v);
          if (v.trim() === "") return onChange(null);
          const n = integer ? parseInt(v, 10) : parseFloat(v.replace(",", "."));
          if (!Number.isNaN(n)) onChange(n);
        }}
        placeholder="—"
        placeholderTextColor="#bdb8aa"
        keyboardType={integer ? "number-pad" : "decimal-pad"}
        className="text-ink text-sm text-center"
        style={{ width: 34, flexShrink: 1, minWidth: 0 }}
      />
      {suffix ? <Text className="text-ink-mute text-xs">{suffix}</Text> : null}
    </View>
  );
}

// Clock input ("m:ss"); stores/returns total seconds.
export function TimeField({
  value,
  onChange,
  suffix,
  placeholder = "m:ss",
}: {
  value: number | null;
  onChange: (sec: number | null) => void;
  suffix?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(value != null && value > 0 ? formatClock(value) : "");
  return (
    <View className="flex-row items-center bg-surface-elevated rounded-lg px-2 py-1" style={{ gap: 2 }}>
      <TextInput
        value={text}
        onChangeText={(v) => {
          setText(v);
          onChange(parseClock(v));
        }}
        placeholder={placeholder}
        placeholderTextColor="#bdb8aa"
        className="text-ink text-sm text-center"
        style={{ width: 44, flexShrink: 1, minWidth: 0 }}
      />
      {suffix ? <Text className="text-ink-mute text-xs">{suffix}</Text> : null}
    </View>
  );
}

export interface RunTargetValue {
  run_type: "continuous" | "interval" | null;
  target_distance_km: number | null;
  target_pace_sec: number | null;
  interval_reps: number | null;
  interval_work_sec: number | null;
  interval_work_km: number | null;
  interval_rest_sec: number | null;
}

function intervalSummary(v: RunTargetValue): string | null {
  if (!v.interval_reps) return null;
  const effort = v.interval_work_km
    ? `${v.interval_work_km}km`
    : v.interval_work_sec
      ? formatClock(v.interval_work_sec)
      : null;
  if (!effort) return null;
  const pace = formatPaceSec(v.target_pace_sec);
  const rest = v.interval_rest_sec ? formatClock(v.interval_rest_sec) : null;
  return `${v.interval_reps}× ${effort}${pace ? ` @${pace}` : ""}${rest ? ` / ${rest}` : ""}`;
}

export function RunTargetFields({
  value,
  onChange,
}: {
  value: RunTargetValue;
  onChange: (patch: Partial<RunTargetValue>) => void;
}) {
  const isInterval = value.run_type === "interval";
  const totalSec = continuousDurationSec(value.target_distance_km, value.target_pace_sec);

  return (
    <View>
      {/* Run type toggle */}
      <View
        className="flex-row mb-2 rounded-lg overflow-hidden self-start"
        style={{ borderWidth: 1, borderColor: "#ddd8ce" }}
      >
        <TouchableOpacity
          className="px-3 py-1"
          style={{ backgroundColor: isInterval ? "transparent" : "#26241f" }}
          onPress={() => onChange({ run_type: "continuous" })}
        >
          <Text style={{ color: isInterval ? "#928d80" : "#ffffff", fontSize: 12, fontWeight: "600" }}>
            Contínuo
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="px-3 py-1"
          style={{ backgroundColor: isInterval ? "#26241f" : "transparent" }}
          onPress={() => onChange({ run_type: "interval" })}
        >
          <Text style={{ color: isInterval ? "#ffffff" : "#928d80", fontSize: 12, fontWeight: "600" }}>
            Intervalado
          </Text>
        </TouchableOpacity>
      </View>

      {isInterval ? (
        <View style={{ gap: 6, flexShrink: 1 }}>
          <View className="flex-row items-center flex-wrap" style={{ gap: 8, rowGap: 6 }}>
            <NumField
              value={value.interval_reps}
              onChange={(n) => onChange({ interval_reps: n })}
              suffix="×"
              integer
            />
            <NumField
              value={value.interval_work_km}
              onChange={(n) => onChange({ interval_work_km: n })}
              suffix="km"
            />
            <Text className="text-ink-faint text-xs">ou</Text>
            <TimeField
              value={value.interval_work_sec}
              onChange={(s) => onChange({ interval_work_sec: s })}
              suffix="esf."
            />
          </View>
          <View className="flex-row items-center flex-wrap" style={{ gap: 8, rowGap: 6 }}>
            <TimeField
              value={value.target_pace_sec}
              onChange={(s) => onChange({ target_pace_sec: s })}
              suffix="/km"
            />
            <TimeField
              value={value.interval_rest_sec}
              onChange={(s) => onChange({ interval_rest_sec: s })}
              suffix="rec."
            />
          </View>
          {intervalSummary(value) && (
            <Text className="text-ink-mute text-xs" style={{ flexWrap: "wrap" }}>
              {intervalSummary(value)}
            </Text>
          )}
        </View>
      ) : (
        <View style={{ gap: 6, flexShrink: 1 }}>
          <View className="flex-row items-center flex-wrap" style={{ gap: 8, rowGap: 6 }}>
            <NumField
              value={value.target_distance_km}
              onChange={(n) => onChange({ target_distance_km: n })}
              suffix="km"
            />
            <TimeField
              value={value.target_pace_sec}
              onChange={(s) => onChange({ target_pace_sec: s })}
              suffix="/km"
            />
          </View>
          {totalSec != null && <Text className="text-ink-mute text-xs">≈ {formatClock(totalSec)} total</Text>}
        </View>
      )}
    </View>
  );
}
