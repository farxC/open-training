import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { FadeInRow } from "@/components/FadeInRow";
import { formatSeriesNumber } from "@/data/muscleGroups";
import type { MuscleExerciseRow } from "@/types";
import { useInteractionState } from "@/hooks/useInteractionState";
import { EXERCISE_HEAD, splitExerciseRows, type ExerciseTail } from "@/utils/muscleLoad";

const MONO = "JetBrains Mono, Menlo, Courier New, monospace";
const INK = "#26241f";
const MUTED = "#5c594f";
const HAIRLINE = "rgba(38, 36, 31, 0.07)";

/** Lines up under the group row's frequency cluster. */
const FREQ_COL = 92;

const STEP = 45;

interface Props {
  rows: MuscleExerciseRow[];
  /** Changing this replays the entrance — the muscle group being shown. */
  cycle: string;
}

/** What a muscle group's load was actually made of: one row per exercise, ranked
 *  by weighted series, each with its share of the group. Reads as a drawer
 *  pulled out of the rack — recessed background, indented rows — because it
 *  belongs to the row above rather than sitting beside it. */
export function MuscleExerciseList({ rows, cycle }: Props) {
  const { head, tail } = useMemo(() => splitExerciseRows(rows), [rows]);
  const [showAll, setShowAll] = useState(false);

  // Reopening another group must not inherit the last one's unfolded tail —
  // `cycle` is the group, so it's also the reset signal.
  useEffect(() => {
    setShowAll(false);
  }, [cycle]);

  if (rows.length === 0) {
    return (
      <View style={{ paddingHorizontal: 14, paddingBottom: 12, backgroundColor: "#fbfaf7" }}>
        <Text className="text-ink-faint" style={{ fontSize: 11 }}>
          Nenhum exercício registrado para este grupo na janela.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: "#fbfaf7", paddingBottom: 6 }}>
      <Text
        style={{
          color: "#bdb8aa",
          fontSize: 9,
          fontWeight: "700",
          letterSpacing: 1.1,
          paddingHorizontal: 24,
          paddingTop: 9,
          paddingBottom: 3,
        }}
      >
        {rows.length === 1 ? "1 EXERCÍCIO" : `${rows.length} EXERCÍCIOS`}
      </Text>

      {(showAll ? rows : head).map((row, index) => (
        <ExerciseRow
          key={row.exercise_id}
          row={row}
          first={index === 0}
          // Rows revealed by unfolding stagger from the fold, not from the top of
          // the list — otherwise the last of twenty-one arrives a second late.
          stagger={index < head.length ? index : index - head.length}
          cycle={cycle}
        />
      ))}

      {tail ? (
        <TailRow
          tail={tail}
          index={showAll ? 0 : head.length}
          isAverage={rows[0].isAverage}
          expanded={showAll}
          onToggle={() => setShowAll((v) => !v)}
          cycle={cycle}
        />
      ) : null}
    </View>
  );
}

function ExerciseRow({
  row,
  first,
  stagger,
  cycle,
}: {
  row: MuscleExerciseRow;
  /** Only the very first row of the drawer goes without a top hairline. */
  first: boolean;
  /** Position for the entrance delay — not the position in the list. */
  stagger: number;
  cycle: string;
}) {
  const seriesNumber = formatSeriesNumber(row.series, row.isAverage);
  const sharePct = Math.round(row.share * 100);

  return (
    <FadeInRow
      index={stagger}
      step={STEP}
      cycle={cycle}
      accessibilityLabel={`${row.exercise_name}: ${seriesNumber} ${
        row.isAverage ? "séries por semana" : "séries"
      }, ${sharePct}% do grupo, em ${sessionsLabel(row.sessionCount)}${
        row.halved ? ", contando meia série por set" : ""
      }`}
      style={{
        paddingLeft: 24,
        paddingRight: 14,
        paddingVertical: 8,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: HAIRLINE,
      }}
    >
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <Text style={{ color: MUTED, fontSize: 12, flex: 1 }} numberOfLines={1}>
          {row.exercise_name}
        </Text>

        {/* Without this, an exercise logged at ½× reads as a miscount: six sets
            on the screen, three séries in the number. */}
        {row.halved ? <HalfBadge /> : null}

        <Text style={{ color: INK, fontSize: 13, fontWeight: "700", fontFamily: MONO }}>
          {seriesNumber}
        </Text>
      </View>

      <View className="flex-row items-center" style={{ marginTop: 6, gap: 10 }}>
        <View className="flex-row items-center" style={{ flex: 1, gap: 7 }}>
          <View style={{ flex: 1 }}>
            <ShareBar share={row.share} delay={120 + stagger * STEP} cycle={cycle} />
          </View>
          <Text
            style={{ color: "#928d80", fontSize: 10, fontFamily: MONO, width: 30, textAlign: "right" }}
          >
            {sharePct}%
          </Text>
        </View>

        {/* Sessions counted, not averaged: a movement trained eight times in
            half a year is "8 sessões", never "0,3×/sem". */}
        <View className="flex-row items-center justify-end" style={{ width: FREQ_COL }}>
          <Text style={{ color: "#928d80", fontSize: 10 }} numberOfLines={1}>
            em <Text style={{ fontFamily: MONO, color: MUTED }}>{row.sessionCount}</Text>{" "}
            {row.sessionCount === 1 ? "sessão" : "sessões"}
          </Text>
        </View>
      </View>
    </FadeInRow>
  );
}

function sessionsLabel(count: number): string {
  return `${count} ${count === 1 ? "sessão" : "sessões"}`;
}

/** The folded tail, and the control that unfolds it. It carries its série total
 *  so the drawer adds up to the group row even while folded — a truncated list
 *  that silently drops 3,5 séries/semana would make the panel look wrong.
 *
 *  Folded it reads as a row (share and series, in the same columns as the
 *  exercises above); unfolded it becomes a plain "recolher" control, since the
 *  numbers it was summarising are now listed individually right above it. */
function TailRow({
  tail,
  index,
  isAverage,
  expanded,
  onToggle,
  cycle,
}: {
  tail: ExerciseTail;
  index: number;
  isAverage: boolean;
  expanded: boolean;
  onToggle: () => void;
  cycle: string;
}) {
  const seriesNumber = formatSeriesNumber(tail.series, isAverage);
  const sharePct = Math.round(tail.share * 100);
  const { hovered, handlers } = useInteractionState();

  return (
    <FadeInRow
      index={index}
      step={STEP}
      cycle={cycle}
      style={{ borderTopWidth: 1, borderTopColor: HAIRLINE }}
    >
      <Pressable
        onPress={onToggle}
        {...handlers}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={
          expanded
            ? `Recolher a lista completa, mostrando só os ${EXERCISE_HEAD} maiores`
            : `Ver os outros ${tail.count} exercícios, juntos ${seriesNumber} ${
                isAverage ? "séries por semana" : "séries"
              }, ${sharePct}% do grupo`
        }
        style={{
          paddingLeft: 24,
          paddingRight: 14,
          paddingVertical: 9,
          backgroundColor: hovered ? "#f4f2ee" : "transparent",
        }}
      >
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <MaterialCommunityIcons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={14}
            color="#928d80"
          />
          <Text style={{ color: "#928d80", fontSize: 11, flex: 1 }} numberOfLines={1}>
            {expanded ? "recolher lista" : `+ outros ${tail.count} exercícios`}
          </Text>

          {expanded ? null : (
            <>
              <Text style={{ color: "#928d80", fontSize: 10, fontFamily: MONO, marginRight: 2 }}>
                {sharePct}%
              </Text>
              <Text style={{ color: MUTED, fontSize: 12, fontWeight: "700", fontFamily: MONO }}>
                {seriesNumber}
              </Text>
            </>
          )}
        </View>
      </Pressable>
    </FadeInRow>
  );
}

/** How concentrated the group is. Deliberately a plain bar, not the group row's
 *  ticked rack: it measures a proportion of one group, not a count of séries,
 *  and painting it the same way would invite comparing the two. */
function ShareBar({
  share,
  delay,
  cycle,
}: {
  share: number;
  delay: number;
  cycle: string;
}) {
  const fill = useSharedValue(0);
  const target = share > 0 ? Math.min(1, Math.max(share, 0.02)) : 0;

  useEffect(() => {
    fill.value = 0;
    fill.value = withDelay(
      delay,
      withTiming(target, { duration: 620, easing: Easing.out(Easing.cubic) })
    );
  }, [target, delay, cycle, fill]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  return (
    <View
      style={{
        height: 5,
        borderRadius: 3,
        backgroundColor: "#e9e5dc",
        overflow: "hidden",
      }}
    >
      <Animated.View
        style={[{ height: "100%", borderRadius: 3, backgroundColor: "#8a8577" }, fillStyle]}
      />
    </View>
  );
}

function HalfBadge() {
  return (
    <View
      className="rounded-full"
      style={{
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderWidth: 1,
        borderColor: "#ddd8ce",
        backgroundColor: "#f4f2ee",
      }}
    >
      <Text style={{ color: "#928d80", fontSize: 9, fontWeight: "700", fontFamily: MONO }}>
        ½×
      </Text>
    </View>
  );
}
