import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import {
  continuousDurationSec,
  distanceDisplay,
  formatClock,
  formatDistanceValue,
  formatEffort,
  formatEffortInput,
  fromDisplayDistance,
  parseClock,
  parseEffort,
  toDisplayDistance,
} from "@/data/modalities";
import type { Modality } from "@/types";

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

/** Distance input in the modality's own unit, storing canonical km. */
export function DistanceField({
  value,
  modality,
  onChange,
}: {
  value: number | null;
  modality: Modality;
  onChange: (km: number | null) => void;
}) {
  return (
    <NumField
      value={toDisplayDistance(value, modality)}
      onChange={(shown) => onChange(fromDisplayDistance(shown, modality))}
      suffix={distanceDisplay(modality).distanceUnit}
      integer={distanceDisplay(modality).distanceUnit === "m"}
    />
  );
}

/** Pace ("m:ss" per the modality's basis) or speed (km/h), storing canonical
 *  seconds-per-km either way. */
export function EffortField({
  value,
  modality,
  onChange,
}: {
  value: number | null;
  modality: Modality;
  onChange: (paceSecPerKm: number | null) => void;
}) {
  const display = distanceDisplay(modality);
  const [text, setText] = useState(() => formatEffortInput(value, modality));
  return (
    <View className="flex-row items-center bg-surface-elevated rounded-lg px-2 py-1" style={{ gap: 2 }}>
      <TextInput
        value={text}
        onChangeText={(v) => {
          setText(v);
          onChange(parseEffort(v, modality));
        }}
        placeholder={display.effortPlaceholder}
        placeholderTextColor="#bdb8aa"
        keyboardType={display.effortMode === "speed" ? "decimal-pad" : "default"}
        className="text-ink text-sm text-center"
        style={{ width: 44, flexShrink: 1, minWidth: 0 }}
      />
      <Text className="text-ink-mute text-xs">{display.effortSuffix}</Text>
    </View>
  );
}

export interface DistanceTargetValue {
  run_type: "continuous" | "interval" | null;
  target_distance_km: number | null;
  target_pace_sec: number | null;
  interval_reps: number | null;
  interval_work_sec: number | null;
  interval_work_km: number | null;
  interval_rest_sec: number | null;
}

function intervalSummary(v: DistanceTargetValue, modality: Modality): string | null {
  if (!v.interval_reps) return null;
  const effort = v.interval_work_km
    ? formatDistanceValue(v.interval_work_km, modality)
    : v.interval_work_sec
      ? formatClock(v.interval_work_sec)
      : null;
  if (!effort) return null;
  const pace = formatEffort(v.target_pace_sec, modality);
  const rest = v.interval_rest_sec ? formatClock(v.interval_rest_sec) : null;
  return `${v.interval_reps}× ${effort}${pace ? ` @${pace}` : ""}${rest ? ` / ${rest}` : ""}`;
}

export function DistanceTargetFields({
  value,
  modality,
  onChange,
}: {
  value: DistanceTargetValue;
  modality: Modality;
  onChange: (patch: Partial<DistanceTargetValue>) => void;
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
            <DistanceField
              value={value.interval_work_km}
              modality={modality}
              onChange={(km) => onChange({ interval_work_km: km })}
            />
            <Text className="text-ink-faint text-xs">ou</Text>
            <TimeField
              value={value.interval_work_sec}
              onChange={(s) => onChange({ interval_work_sec: s })}
              suffix="esf."
            />
          </View>
          <View className="flex-row items-center flex-wrap" style={{ gap: 8, rowGap: 6 }}>
            <EffortField
              value={value.target_pace_sec}
              modality={modality}
              onChange={(s) => onChange({ target_pace_sec: s })}
            />
            <TimeField
              value={value.interval_rest_sec}
              onChange={(s) => onChange({ interval_rest_sec: s })}
              suffix="rec."
            />
          </View>
          {intervalSummary(value, modality) && (
            <Text className="text-ink-mute text-xs" style={{ flexWrap: "wrap" }}>
              {intervalSummary(value, modality)}
            </Text>
          )}
        </View>
      ) : (
        <View style={{ gap: 6, flexShrink: 1 }}>
          <View className="flex-row items-center flex-wrap" style={{ gap: 8, rowGap: 6 }}>
            <DistanceField
              value={value.target_distance_km}
              modality={modality}
              onChange={(km) => onChange({ target_distance_km: km })}
            />
            <EffortField
              value={value.target_pace_sec}
              modality={modality}
              onChange={(s) => onChange({ target_pace_sec: s })}
            />
          </View>
          {totalSec != null && <Text className="text-ink-mute text-xs">≈ {formatClock(totalSec)} total</Text>}
        </View>
      )}
    </View>
  );
}
