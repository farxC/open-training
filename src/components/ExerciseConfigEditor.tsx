import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import {
  BENCH_ANGLE_PRESETS,
  benchAngleLabel,
  LATERALITY_LABELS,
  LATERALITY_OPTIONS,
  LOAD_TYPE_LABELS,
  LOAD_TYPE_OPTIONS,
  PULLEY_TYPE_LABELS,
  PULLEY_TYPE_OPTIONS,
  RESISTANCE_CURVE_LABELS,
  RESISTANCE_CURVE_OPTIONS,
  ROM_LABELS,
  ROM_OPTIONS,
} from "@/data/exerciseConfig";
import { ResistanceCurveChart } from "@/components/ResistanceCurveChart";
import type { ExerciseConfig, ExerciseConfigOverride } from "@/types";

type Field = keyof ExerciseConfig;

type Props =
  | {
      mode: "default";
      value: ExerciseConfig;
      onChange: (config: ExerciseConfig) => void;
    }
  | {
      mode: "override";
      value: ExerciseConfigOverride;
      /** The exercise's resolved default — used to show what "Herdar" resolves to and to draw the chart. */
      defaultConfig: ExerciseConfig;
      onChange: (override: ExerciseConfigOverride) => void;
    };

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
  inherited,
  onSelect,
  onInherit,
}: {
  title: string;
  options: T[];
  labels: Record<T, string>;
  active: T;
  inherited?: boolean;
  onSelect: (v: T) => void;
  onInherit?: () => void;
}) {
  return (
    <View className="mb-4">
      <Text className="text-ink-mute text-xs mb-2" style={{ letterSpacing: 1, fontWeight: "700" }}>
        {title.toUpperCase()}
      </Text>
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        {options.map((opt) => (
          <Chip key={opt} label={labels[opt]} active={!inherited && active === opt} onPress={() => onSelect(opt)} />
        ))}
        {onInherit && (
          <Chip label={`Herdar (${labels[active]})`} active={!!inherited} onPress={onInherit} />
        )}
      </View>
    </View>
  );
}

function BenchSection({
  usesBench,
  angle,
  inherited,
  onSetUsesBench,
  onSetAngle,
  onInherit,
}: {
  usesBench: boolean;
  angle: number;
  inherited: boolean;
  onSetUsesBench: (v: 0 | 1) => void;
  onSetAngle: (degrees: number) => void;
  onInherit?: () => void;
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
        <Chip label="Sem banco" active={!inherited && !usesBench} onPress={() => onSetUsesBench(0)} />
        <Chip label="Usa banco" active={!inherited && usesBench} onPress={() => onSetUsesBench(1)} />
        {onInherit && <Chip label="Herdar" active={inherited} onPress={onInherit} />}
      </View>

      {!inherited && usesBench && (
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

      {!inherited && usesBench && customOpen && (
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

export function ExerciseConfigEditor(props: Props) {
  const resolved: ExerciseConfig =
    props.mode === "default"
      ? props.value
      : {
          resistance_curve: props.value.resistance_curve ?? props.defaultConfig.resistance_curve,
          load_type: props.value.load_type ?? props.defaultConfig.load_type,
          pulley_type: props.value.pulley_type ?? props.defaultConfig.pulley_type,
          laterality: props.value.laterality ?? props.defaultConfig.laterality,
          rom: props.value.rom ?? props.defaultConfig.rom,
          uses_bench: props.value.uses_bench ?? props.defaultConfig.uses_bench,
          bench_angle_degrees: props.value.bench_angle_degrees ?? props.defaultConfig.bench_angle_degrees,
        };

  const isInherited = (field: Field): boolean => props.mode === "override" && props.value[field] === null;

  const setField = <K extends Field>(field: K, val: ExerciseConfig[K]) => {
    if (props.mode === "default") {
      const next = { ...props.value, [field]: val };
      if (field === "load_type" && val !== "pulley") next.pulley_type = null;
      props.onChange(next);
      return;
    }
    const next = { ...props.value, [field]: val };
    if (field === "load_type" && val !== "pulley") next.pulley_type = null;
    props.onChange(next);
  };

  const inheritField = (field: Field) => {
    if (props.mode !== "override") return;
    const next = { ...props.value, [field]: null };
    if (field === "load_type") next.pulley_type = null;
    props.onChange(next);
  };

  const setUsesBench = (v: 0 | 1) => {
    const angle = v ? resolved.bench_angle_degrees ?? 0 : null;
    if (props.mode === "default") {
      props.onChange({ ...props.value, uses_bench: v, bench_angle_degrees: angle });
      return;
    }
    props.onChange({ ...props.value, uses_bench: v, bench_angle_degrees: angle });
  };

  const setBenchAngle = (degrees: number) => {
    if (props.mode === "default") {
      props.onChange({ ...props.value, uses_bench: 1, bench_angle_degrees: degrees });
      return;
    }
    props.onChange({ ...props.value, uses_bench: 1, bench_angle_degrees: degrees });
  };

  const inheritBench = () => {
    if (props.mode !== "override") return;
    props.onChange({ ...props.value, uses_bench: null, bench_angle_degrees: null });
  };

  const benchInherited = props.mode === "override" && props.value.uses_bench === null;

  return (
    <View>
      <ResistanceCurveChart variant={resolved.resistance_curve} />

      <View style={{ marginTop: 16 }}>
        <DimensionGroup
          title="Curva de resistência"
          options={RESISTANCE_CURVE_OPTIONS}
          labels={RESISTANCE_CURVE_LABELS}
          active={resolved.resistance_curve}
          inherited={isInherited("resistance_curve")}
          onSelect={(v) => setField("resistance_curve", v)}
          onInherit={props.mode === "override" ? () => inheritField("resistance_curve") : undefined}
        />

        <DimensionGroup
          title="Tipo de carga"
          options={LOAD_TYPE_OPTIONS}
          labels={LOAD_TYPE_LABELS}
          active={resolved.load_type}
          inherited={isInherited("load_type")}
          onSelect={(v) => setField("load_type", v)}
          onInherit={props.mode === "override" ? () => inheritField("load_type") : undefined}
        />

        {resolved.load_type === "pulley" && (
          <DimensionGroup
            title="Tipo de polia"
            options={PULLEY_TYPE_OPTIONS}
            labels={PULLEY_TYPE_LABELS}
            active={resolved.pulley_type ?? "mobile"}
            inherited={isInherited("pulley_type")}
            onSelect={(v) => setField("pulley_type", v)}
            onInherit={props.mode === "override" ? () => inheritField("pulley_type") : undefined}
          />
        )}

        <DimensionGroup
          title="Lateralidade"
          options={LATERALITY_OPTIONS}
          labels={LATERALITY_LABELS}
          active={resolved.laterality}
          inherited={isInherited("laterality")}
          onSelect={(v) => setField("laterality", v)}
          onInherit={props.mode === "override" ? () => inheritField("laterality") : undefined}
        />

        <DimensionGroup
          title="Amplitude"
          options={ROM_OPTIONS}
          labels={ROM_LABELS}
          active={resolved.rom}
          inherited={isInherited("rom")}
          onSelect={(v) => setField("rom", v)}
          onInherit={props.mode === "override" ? () => inheritField("rom") : undefined}
        />

        <BenchSection
          usesBench={!!resolved.uses_bench}
          angle={resolved.bench_angle_degrees ?? 0}
          inherited={benchInherited}
          onSetUsesBench={setUsesBench}
          onSetAngle={setBenchAngle}
          onInherit={props.mode === "override" ? inheritBench : undefined}
        />
      </View>
    </View>
  );
}
