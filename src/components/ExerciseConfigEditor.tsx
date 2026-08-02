import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import {
  BENCH_ANGLE_PRESETS,
  benchAngleLabel,
  GRIP_TYPE_LABELS,
  GRIP_TYPE_OPTIONS,
  GRIP_WIDTH_LABELS,
  GRIP_WIDTH_OPTIONS,
  LATERALITY_LABELS,
  LATERALITY_OPTIONS,
  LOAD_MODE_LABELS,
  LOAD_MODE_OPTIONS,
  LOAD_TYPE_LABELS,
  LOAD_TYPE_OPTIONS,
  normalizeExerciseConfig,
  PULLEY_TYPE_LABELS,
  PULLEY_TYPE_OPTIONS,
  RESISTANCE_CURVE_LABELS,
  RESISTANCE_CURVE_OPTIONS,
  ROM_LABELS,
  ROM_OPTIONS,
} from "@/data/exerciseConfig";
import { ResistanceCurveChart } from "@/components/ResistanceCurveChart";
import type { ExerciseConfig } from "@/types";

type Field = keyof ExerciseConfig;

interface Props {
  value: ExerciseConfig;
  onChange: (config: ExerciseConfig) => void;
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      className="px-3 py-1.5 rounded-full"
      style={{
        borderWidth: 1,
        borderColor: active ? "#26241f" : "#ddd8ce",
        backgroundColor: active ? "#26241f" : "transparent",
      }}
      onPress={onPress}
    >
      <Text style={{ color: active ? "#ffffff" : "#928d80", fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </TouchableOpacity>
  );
}

function DimensionGroup<T extends string>({
  title,
  options,
  labels,
  active,
  onSelect,
  /** Label for an extra chip meaning "this dimension doesn't apply" (⇒ null). */
  noneLabel,
  onSelectNone,
}: {
  title: string;
  options: T[];
  labels: Record<T, string>;
  active: T | null;
  onSelect: (v: T) => void;
  noneLabel?: string;
  onSelectNone?: () => void;
}) {
  return (
    <View className="mb-4">
      <Text className="text-ink-mute text-xs mb-2" style={{ letterSpacing: 1, fontWeight: "700" }}>
        {title.toUpperCase()}
      </Text>
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        {onSelectNone && (
          <Chip label={noneLabel ?? "Não se aplica"} active={active === null} onPress={onSelectNone} />
        )}
        {options.map((opt) => (
          <Chip key={opt} label={labels[opt]} active={active === opt} onPress={() => onSelect(opt)} />
        ))}
      </View>
    </View>
  );
}

function BenchSection({
  usesBench,
  angle,
  onSetUsesBench,
  onSetAngle,
}: {
  usesBench: boolean;
  angle: number;
  onSetUsesBench: (v: 0 | 1) => void;
  onSetAngle: (degrees: number) => void;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState("");
  const isPreset = BENCH_ANGLE_PRESETS.includes(angle);

  const commitCustom = () => {
    const parsed = Number(customText.replace(",", "."));
    if (!Number.isNaN(parsed) && parsed >= -90 && parsed <= 90) {
      onSetAngle(parsed);
    }
    setCustomOpen(false);
    setCustomText("");
  };

  return (
    <View className="mb-4">
      <Text className="text-ink-mute text-xs mb-2" style={{ letterSpacing: 1, fontWeight: "700" }}>
        BANCO
      </Text>
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        <Chip label="Sem banco" active={!usesBench} onPress={() => onSetUsesBench(0)} />
        <Chip label="Usa banco" active={usesBench} onPress={() => onSetUsesBench(1)} />
      </View>

      {usesBench && (
        <View className="flex-row flex-wrap mt-2" style={{ gap: 8 }}>
          {BENCH_ANGLE_PRESETS.map((preset) => (
            <Chip
              key={preset}
              label={benchAngleLabel(preset)}
              active={angle === preset}
              onPress={() => onSetAngle(preset)}
            />
          ))}
          {!isPreset && <Chip label={benchAngleLabel(angle)} active onPress={() => setCustomOpen(true)} />}
          <Chip label="Outro…" active={customOpen} onPress={() => setCustomOpen((v) => !v)} />
        </View>
      )}

      {usesBench && customOpen && (
        <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
          <TextInput
            className="bg-surface-card text-ink rounded-xl px-3 py-2"
            style={{ width: 100 }}
            placeholder="Graus"
            placeholderTextColor="#bdb8aa"
            keyboardType="numbers-and-punctuation"
            value={customText}
            onChangeText={setCustomText}
            onBlur={commitCustom}
            onSubmitEditing={commitCustom}
            autoFocus
          />
          <Text className="text-ink-faint text-xs">graus (negativo = declinado)</Text>
        </View>
      )}
    </View>
  );
}

/** Editor for one exercise config. Single-mode by design: since v18 a session
 *  carries a full snapshot rather than a sparse override, so every field always
 *  holds a concrete value and there is nothing to inherit. Callers editing a
 *  session's snapshot offer a "restore the exercise default" action instead. */
export function ExerciseConfigEditor({ value, onChange }: Props) {
  // Normalising on the way out keeps the dependent fields (pulley type, bench
  // angle, load mode) from lingering after their toggle is switched off.
  const emit = (next: ExerciseConfig) => onChange(normalizeExerciseConfig(next));

  const setField = <K extends Field>(field: K, val: ExerciseConfig[K]) => {
    emit({ ...value, [field]: val });
  };

  const setUsesBench = (v: 0 | 1) => {
    emit({ ...value, uses_bench: v, bench_angle_degrees: v ? value.bench_angle_degrees ?? 0 : null });
  };

  const setUsesBodyweight = (v: 0 | 1) => {
    emit({ ...value, uses_bodyweight: v, load_mode: v ? value.load_mode ?? "total" : null });
  };

  return (
    <View>
      <ResistanceCurveChart variant={value.resistance_curve} />

      <View style={{ marginTop: 16 }}>
        <DimensionGroup
          title="Curva de resistência"
          options={RESISTANCE_CURVE_OPTIONS}
          labels={RESISTANCE_CURVE_LABELS}
          active={value.resistance_curve}
          onSelect={(v) => setField("resistance_curve", v)}
        />

        <DimensionGroup
          title="Tipo de carga"
          options={LOAD_TYPE_OPTIONS}
          labels={LOAD_TYPE_LABELS}
          active={value.load_type}
          onSelect={(v) => setField("load_type", v)}
        />

        {value.load_type === "pulley" && (
          <DimensionGroup
            title="Tipo de polia"
            options={PULLEY_TYPE_OPTIONS}
            labels={PULLEY_TYPE_LABELS}
            active={value.pulley_type ?? "mobile"}
            onSelect={(v) => setField("pulley_type", v)}
          />
        )}

        <DimensionGroup
          title="Lateralidade"
          options={LATERALITY_OPTIONS}
          labels={LATERALITY_LABELS}
          active={value.laterality}
          onSelect={(v) => setField("laterality", v)}
        />

        <DimensionGroup
          title="Amplitude"
          options={ROM_OPTIONS}
          labels={ROM_LABELS}
          active={value.rom}
          onSelect={(v) => setField("rom", v)}
        />

        <DimensionGroup
          title="Pegada"
          options={GRIP_TYPE_OPTIONS}
          labels={GRIP_TYPE_LABELS}
          active={value.grip_type}
          onSelect={(v) => setField("grip_type", v)}
          onSelectNone={() => setField("grip_type", null)}
        />

        <DimensionGroup
          title="Largura da pegada"
          options={GRIP_WIDTH_OPTIONS}
          labels={GRIP_WIDTH_LABELS}
          active={value.grip_width}
          onSelect={(v) => setField("grip_width", v)}
          onSelectNone={() => setField("grip_width", null)}
        />

        <BenchSection
          usesBench={!!value.uses_bench}
          angle={value.bench_angle_degrees ?? 0}
          onSetUsesBench={setUsesBench}
          onSetAngle={(degrees) => emit({ ...value, uses_bench: 1, bench_angle_degrees: degrees })}
        />

        <View className="mb-4">
          <Text className="text-ink-mute text-xs mb-2" style={{ letterSpacing: 1, fontWeight: "700" }}>
            PESO CORPORAL
          </Text>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            <Chip label="Não usa" active={!value.uses_bodyweight} onPress={() => setUsesBodyweight(0)} />
            <Chip label="Usa" active={!!value.uses_bodyweight} onPress={() => setUsesBodyweight(1)} />
          </View>
          {!!value.uses_bodyweight && (
            <>
              <View className="flex-row flex-wrap mt-2" style={{ gap: 8 }}>
                {LOAD_MODE_OPTIONS.map((opt) => (
                  <Chip
                    key={opt}
                    label={LOAD_MODE_LABELS[opt]}
                    active={value.load_mode === opt}
                    onPress={() => setField("load_mode", opt)}
                  />
                ))}
              </View>
              <Text className="text-ink-faint text-xs mt-2">
                Como ler a carga registrada: o peso total movido, o peso extra somado ao corpo, ou a
                assistência subtraída dele.
              </Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
}
