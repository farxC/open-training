import { Text, View } from "react-native";
import { ResistanceCurveGlyph } from "@/components/ResistanceCurveGlyph";
import { EQUIPMENT_LABELS, TYPE_LABELS } from "@/data/exerciseMeta";
import { exerciseConfigRows, type ConfigSpecRow } from "@/data/exerciseConfig";
import { MUSCLE_LABELS } from "@/data/muscleGroups";
import { isStrengthCategory, modalityLabel } from "@/data/modalities";
import type { Exercise } from "@/types";
import { useTheme } from "@/theme";

const MONO = "JetBrains Mono, Menlo, Courier New, monospace";

interface Props {
  exercise: Exercise;
}

/**
 * The plate riveted to the machine: what this movement *is*, as a spec grid.
 *
 * Two decisions carry it. The grid, because a spec is a set of paired
 * label/value facts and a column of full-width rows made six facts occupy the
 * height of a chart. And the dimming: everything left at its default —
 * bilateral, full range, no bench — recedes, so what stays in ink is exactly
 * what distinguishes this exercise from every other one in the list.
 */
export function ExerciseSpecSheet({ exercise }: Props) {
  const { colors } = useTheme();
  const isStrength = isStrengthCategory(exercise.modality);
  const rows = isStrength ? exerciseConfigRows(exercise.config) : [];

  // Cells are paired explicitly rather than wrapped: the borders have to know
  // which cell ends a row and which one opens one.
  const pairs: ConfigSpecRow[][] = [];
  for (let i = 0; i < rows.length; i += 2) pairs.push(rows.slice(i, i + 2));

  const identity = [
    EQUIPMENT_LABELS[exercise.equipment],
    TYPE_LABELS[exercise.type],
    modalityLabel(exercise.modality),
  ].join(" · ");

  return (
    <View
      className="bg-surface-card rounded-xl overflow-hidden"
      style={{ borderWidth: 1, borderColor: colors["brand-100"] }}
    >
      {pairs.map((pair, rowIndex) => (
        <View key={rowIndex} className="flex-row">
          {pair.map((cell, columnIndex) => (
            <SpecCell
              key={cell.label}
              row={cell}
              curve={cell.label === "Curva" ? exercise.config.resistance_curve : undefined}
              topBorder={rowIndex > 0}
              leftBorder={columnIndex > 0}
            />
          ))}
          {/* An odd number of specs leaves the last cell alone on its line; the
              filler keeps the column rule running straight to the bottom. */}
          {pair.length === 1 ? (
            <View
              style={{
                flex: 1,
                borderTopWidth: rowIndex > 0 ? 1 : 0,
                borderTopColor: colors["surface-tint"],
                borderLeftWidth: 1,
                borderLeftColor: colors["surface-tint"],
              }}
            />
          ) : null}
        </View>
      ))}

      <View
        style={{
          paddingHorizontal: 11,
          paddingVertical: 10,
          borderTopWidth: pairs.length > 0 ? 1 : 0,
          borderTopColor: colors["surface-tint"],
          backgroundColor: colors["surface-raised"],
        }}
      >
        {exercise.muscle_groups.length > 0 ? (
          <View className="flex-row flex-wrap items-center" style={{ gap: 5 }}>
            {exercise.muscle_groups.map((group) => (
              <MuscleTag
                key={group.muscle_group}
                label={MUSCLE_LABELS[group.muscle_group]}
                factor={group.counting_factor}
              />
            ))}
          </View>
        ) : null}
        <Text
          style={{
            color: colors["brand-300"],
            fontSize: 9.5,
            fontWeight: "700",
            letterSpacing: 0.8,
            marginTop: exercise.muscle_groups.length > 0 ? 8 : 0,
          }}
          numberOfLines={1}
        >
          {identity.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

function SpecCell({
  row,
  curve,
  topBorder,
  leftBorder,
}: {
  row: ConfigSpecRow;
  /** Set only on the curve cell, which draws its value as well as naming it. */
  curve?: Exercise["config"]["resistance_curve"];
  topBorder: boolean;
  leftBorder: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        paddingHorizontal: 11,
        paddingVertical: 9,
        borderTopWidth: topBorder ? 1 : 0,
        borderTopColor: colors["surface-tint"],
        borderLeftWidth: leftBorder ? 1 : 0,
        borderLeftColor: colors["surface-tint"],
      }}
    >
      <View className="flex-row items-center" style={{ gap: 6 }}>
        <Text
          style={{ color: colors["brand-300"], fontSize: 8.5, fontWeight: "700", letterSpacing: 0.8, flex: 1 }}
          numberOfLines={1}
        >
          {row.label.toUpperCase()}
        </Text>
        {curve ? (
          <ResistanceCurveGlyph
            variant={curve}
            width={32}
            height={12}
            color={row.isDefault ? colors["ink-faint"] : colors.ink}
          />
        ) : null}
      </View>
      <Text
        style={{
          // Defaults recede; anything deliberate stays in ink.
          color: row.isDefault ? colors["brand-300"] : colors["ink"],
          fontSize: 12,
          fontWeight: row.isDefault ? "500" : "600",
          marginTop: 3,
        }}
        numberOfLines={1}
      >
        {row.value}
      </Text>
    </View>
  );
}

/** A muscle group and how much of a set it earns. The ½ marker is part of the
 *  spec, not decoration — it's why six logged sets can count as three séries. */
function MuscleTag({ label, factor }: { label: string; factor: number }) {
  const { colors } = useTheme();
  const half = factor !== 1;

  return (
    <View
      className="flex-row items-center rounded-full"
      style={{
        paddingLeft: 8,
        paddingRight: half ? 4 : 8,
        paddingVertical: 3,
        gap: 5,
        borderWidth: 1,
        borderColor: colors["brand-100"],
        backgroundColor: colors["surface-card"],
      }}
    >
      <Text style={{ color: colors["ink-soft"], fontSize: 10.5, fontWeight: "600" }}>{label}</Text>
      {half ? (
        <View
          className="rounded-full"
          style={{ paddingHorizontal: 4, paddingVertical: 0.5, backgroundColor: colors["surface-elevated"] }}
        >
          <Text style={{ color: colors["ink-mute"], fontSize: 8.5, fontWeight: "700", fontFamily: MONO }}>
            ½×
          </Text>
        </View>
      ) : null}
    </View>
  );
}
