import type { ComponentProps, ReactNode } from "react";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
  BENCH_ANGLE_PRESETS,
  benchAngleLabel,
  exerciseConfigSummary,
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
import { useInteractionState } from "@/hooks/useInteractionState";
import type { ExerciseConfig } from "@/types";

type MciName = ComponentProps<typeof MaterialCommunityIcons>["name"];
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
  const { hovered, handlers } = useInteractionState();

  return (
    <Pressable
      onPress={onPress}
      {...handlers}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className="px-3 py-1.5 rounded-full"
      style={{
        borderWidth: 1,
        borderColor: active ? "#26241f" : "#ddd8ce",
        backgroundColor: active ? "#26241f" : hovered ? "#f4f2ee" : "transparent",
      }}
    >
      <Text style={{ color: active ? "#ffffff" : "#928d80", fontSize: 12, fontWeight: "600" }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** One card per question the config answers. Nine chip groups stacked flat gave
 *  no clue which of them belonged together — grouping them means "polia móvel"
 *  and "peso adicionado" are visibly two answers about the same thing: load. */
function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: ReactNode;
}) {
  return (
    <View
      className="bg-surface-card rounded-2xl mb-2"
      style={{ borderWidth: 1, borderColor: "#e7e4dc", padding: 12 }}
    >
      <View className="flex-row items-center mb-3" style={{ gap: 6 }}>
        <MaterialCommunityIcons name={icon as MciName} size={13} color="#928d80" />
        <Text style={{ color: "#5c594f", fontSize: 10, fontWeight: "700", letterSpacing: 1.2 }}>
          {title.toUpperCase()}
        </Text>
      </View>
      {children}
    </View>
  );
}

function DimensionGroup<T extends string>({
  title,
  hint,
  options,
  labels,
  active,
  onSelect,
  /** Label for an extra chip meaning "this dimension doesn't apply" (⇒ null). */
  noneLabel,
  onSelectNone,
  last,
}: {
  title: string;
  /** What the dimension actually means, in one line. Every chip row here names a
   *  property of the movement that isn't self-evident from its own label. */
  hint?: string;
  options: T[];
  labels: Record<T, string>;
  active: T | null;
  onSelect: (v: T) => void;
  noneLabel?: string;
  onSelectNone?: () => void;
  last?: boolean;
}) {
  return (
    <View style={{ marginBottom: last ? 0 : 14 }}>
      <Text style={{ color: "#26241f", fontSize: 11.5, fontWeight: "600" }}>{title}</Text>
      {hint ? (
        <Text style={{ color: "#a8a293", fontSize: 10, marginTop: 1 }}>{hint}</Text>
      ) : null}
      <View className="flex-row flex-wrap" style={{ gap: 8, marginTop: 7 }}>
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

/** A binary dimension whose "on" state unfolds further choices. */
function ToggleGroup({
  title,
  hint,
  offLabel,
  onLabel,
  on,
  onSet,
  children,
  last,
}: {
  title: string;
  hint?: string;
  offLabel: string;
  onLabel: string;
  on: boolean;
  onSet: (v: 0 | 1) => void;
  children?: ReactNode;
  last?: boolean;
}) {
  return (
    <View style={{ marginBottom: last ? 0 : 14 }}>
      <Text style={{ color: "#26241f", fontSize: 11.5, fontWeight: "600" }}>{title}</Text>
      {hint ? <Text style={{ color: "#a8a293", fontSize: 10, marginTop: 1 }}>{hint}</Text> : null}
      <View className="flex-row flex-wrap" style={{ gap: 8, marginTop: 7 }}>
        <Chip label={offLabel} active={!on} onPress={() => onSet(0)} />
        <Chip label={onLabel} active={on} onPress={() => onSet(1)} />
      </View>
      {on ? children : null}
    </View>
  );
}

function BenchAngles({
  angle,
  onSetAngle,
}: {
  angle: number;
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
    <View>
      <View className="flex-row flex-wrap" style={{ gap: 8, marginTop: 8 }}>
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

      {customOpen && (
        <View className="flex-row items-center" style={{ gap: 8, marginTop: 8 }}>
          <TextInput
            className="text-ink rounded-xl px-3 py-2"
            style={{ width: 100, backgroundColor: "#f4f2ee", borderWidth: 1, borderColor: "#e7e4dc" }}
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
 *  session's snapshot offer a "restore the exercise default" action instead.
 *
 *  Laid out as grouped questions with a live summary on top, because the answers
 *  are only meaningful together: the summary is exactly the line that shows up on
 *  the exercise screen, so you can see what you're writing while you write it. */
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
      {/* The result of every choice below, in the same words the exercise screen
          will use. */}
      <View
        className="rounded-2xl mb-2"
        style={{ backgroundColor: "#efece5", padding: 11 }}
      >
        <Text style={{ color: "#a8a293", fontSize: 8.5, fontWeight: "700", letterSpacing: 0.8 }}>
          RESUMO
        </Text>
        <Text style={{ color: "#26241f", fontSize: 12, marginTop: 4, lineHeight: 17 }}>
          {exerciseConfigSummary(value)}
        </Text>
      </View>

      <ResistanceCurveChart variant={value.resistance_curve} />

      <View style={{ marginTop: 8 }}>
        <Section title="Execução" icon="chart-bell-curve-cumulative">
          <DimensionGroup
            title="Curva de resistência"
            hint="Onde o movimento fica mais difícil — o gráfico acima."
            options={RESISTANCE_CURVE_OPTIONS}
            labels={RESISTANCE_CURVE_LABELS}
            active={value.resistance_curve}
            onSelect={(v) => setField("resistance_curve", v)}
          />

          <DimensionGroup
            title="Lateralidade"
            hint="Um lado por vez, ou os dois ao mesmo tempo."
            options={LATERALITY_OPTIONS}
            labels={LATERALITY_LABELS}
            active={value.laterality}
            onSelect={(v) => setField("laterality", v)}
          />

          <DimensionGroup
            title="Amplitude"
            hint="Se o movimento percorre toda a articulação ou só um trecho."
            options={ROM_OPTIONS}
            labels={ROM_LABELS}
            active={value.rom}
            onSelect={(v) => setField("rom", v)}
            last
          />
        </Section>

        <Section title="Carga" icon="weight">
          <DimensionGroup
            title="Tipo de carga"
            hint="Como a resistência é aplicada."
            options={LOAD_TYPE_OPTIONS}
            labels={LOAD_TYPE_LABELS}
            active={value.load_type}
            onSelect={(v) => setField("load_type", v)}
          />

          {value.load_type === "pulley" && (
            <DimensionGroup
              title="Tipo de polia"
              hint="Móvel multiplica o deslocamento; fixa transmite a carga direto."
              options={PULLEY_TYPE_OPTIONS}
              labels={PULLEY_TYPE_LABELS}
              active={value.pulley_type ?? "mobile"}
              onSelect={(v) => setField("pulley_type", v)}
            />
          )}

          <ToggleGroup
            title="Peso corporal"
            hint="Se o próprio corpo faz parte da carga."
            offLabel="Não usa"
            onLabel="Usa"
            on={!!value.uses_bodyweight}
            onSet={setUsesBodyweight}
            last
          >
            <View className="flex-row flex-wrap" style={{ gap: 8, marginTop: 8 }}>
              {LOAD_MODE_OPTIONS.map((opt) => (
                <Chip
                  key={opt}
                  label={LOAD_MODE_LABELS[opt]}
                  active={value.load_mode === opt}
                  onPress={() => setField("load_mode", opt)}
                />
              ))}
            </View>
            <Text style={{ color: "#a8a293", fontSize: 10, marginTop: 7, lineHeight: 14 }}>
              Como ler a carga registrada: o peso total movido, o peso extra somado ao corpo, ou a
              assistência subtraída dele.
            </Text>
          </ToggleGroup>
        </Section>

        <Section title="Pegada" icon="hand-back-right-outline">
          <DimensionGroup
            title="Tipo"
            options={GRIP_TYPE_OPTIONS}
            labels={GRIP_TYPE_LABELS}
            active={value.grip_type}
            onSelect={(v) => setField("grip_type", v)}
            onSelectNone={() => setField("grip_type", null)}
          />

          <DimensionGroup
            title="Largura"
            options={GRIP_WIDTH_OPTIONS}
            labels={GRIP_WIDTH_LABELS}
            active={value.grip_width}
            onSelect={(v) => setField("grip_width", v)}
            onSelectNone={() => setField("grip_width", null)}
            last
          />
        </Section>

        <Section title="Banco" icon="page-layout-header">
          <ToggleGroup
            title="Apoio"
            hint="O ângulo muda qual parte do músculo puxa o movimento."
            offLabel="Sem banco"
            onLabel="Usa banco"
            on={!!value.uses_bench}
            onSet={setUsesBench}
            last
          >
            <BenchAngles
              angle={value.bench_angle_degrees ?? 0}
              onSetAngle={(degrees) => emit({ ...value, uses_bench: 1, bench_angle_degrees: degrees })}
            />
          </ToggleGroup>
        </Section>
      </View>
    </View>
  );
}
