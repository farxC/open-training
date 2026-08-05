import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { FadeInRow } from "@/components/FadeInRow";
import { FrequencyPips } from "@/components/FrequencyPips";
import { MuscleExerciseList } from "@/components/MuscleExerciseList";
import { SectionHeader } from "@/components/SectionHeader";
import { TickBar } from "@/components/TickBar";
import {
  formatFrequencyNumber,
  formatSeriesNumber,
  muscleGroupLabel,
  seriesUnit,
} from "@/data/muscleGroups";
import { useInteractionState } from "@/hooks/useInteractionState";
import type { MuscleExerciseRow, MuscleFrequencyRow, MuscleSeriesRow } from "@/types";
import {
  mergeMuscleLoad,
  pipSlots,
  sortMuscleLoad,
  summarizeMuscleLoad,
  tickSlots,
  type LoadSortKey,
  type MuscleLoadRow,
  type MuscleLoadSummary,
} from "@/utils/muscleLoad";
import { monogramFor } from "@/utils/recordsGamification";

const MONO = "JetBrains Mono, Menlo, Courier New, monospace";
const INK = "#26241f";
const CREAM = "#f4f2ee";
const HAIRLINE = "rgba(38, 36, 31, 0.07)";

/** Fixed width for the frequency cluster, so the bar track is exactly as wide
 *  in every row — the ranking only reads if the bars start and end together. */
const FREQ_COL = 92;

/** Per-row stagger. Slow enough to read as dealing out a hand, fast enough that
 *  ten groups are all on screen inside half a second. */
const STEP = 55;

interface Props {
  /** Series per muscle group — raw weekly totals or a per-week average, per the
   *  window the hook resolved. */
  series: MuscleSeriesRow[];
  /** Sessions per muscle group over the same window. */
  frequency: MuscleFrequencyRow[];
  /** Window caption shared by both readings, e.g. "últimas 4 semanas · 06/07 – 02/08". */
  caption: string;
  /** Which exercises produced a group's series over the same window — the
   *  drill-down a row opens. A pure lookup, so it's safe to call on render. */
  breakdown: (muscleGroup: string) => MuscleExerciseRow[];
}

/** One panel for both muscle-group readings. They used to be two stacked lists
 *  of identical grey bars, which meant scrolling past the same shape twice and
 *  encoding a 2×/week count as a bar length nobody can read. Here each group is
 *  one row: volume as a racked plate bar, frequency as countable pips, and the
 *  ranking swappable between the two so neither reading loses its order. */
export function AnalyticsMuscleBreakdown({ series, frequency, caption, breakdown }: Props) {
  const [sort, setSort] = useState<LoadSortKey>("series");
  // One group open at a time: the panel runs to ten rows, and the ranking is
  // only readable while it stays short.
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const merged = useMemo(() => mergeMuscleLoad(series, frequency), [series, frequency]);
  const rows = useMemo(() => sortMuscleLoad(merged, sort), [merged, sort]);
  const summary = useMemo(() => summarizeMuscleLoad(merged), [merged]);

  if (rows.length === 0) {
    return (
      <View>
        <SectionHeader title="Carga por grupo muscular" />
        <EmptyPanel />
      </View>
    );
  }

  const isAverage = rows[0].isAverage;
  const maxSeries = Math.max(...rows.map((r) => r.series), 0);
  const slots = tickSlots(maxSeries);
  // Ticks are whole séries, so the track holds exactly its slot count. Only the
  // uncut fallback scales to the raw max.
  const capacity = slots ?? maxSeries;
  const pips = pipSlots(Math.max(...rows.map((r) => r.frequency), 0));

  return (
    <View>
      <SectionHeader title="Carga por grupo muscular" />
      <Text className="text-ink-mute text-xs mb-3">{caption}</Text>

      <LoadStrip summary={summary} isAverage={isAverage} />

      {rows.length > 1 ? (
        <SortChips
          value={sort}
          onChange={(key) => {
            // Re-sorting re-deals every row; leaving a drawer open would park it
            // under whatever group happened to land in that slot.
            setOpenGroup(null);
            setSort(key);
          }}
        />
      ) : null}

      <View
        className="bg-surface-card"
        style={{
          borderRadius: 18,
          borderWidth: 1,
          borderColor: HAIRLINE,
          overflow: "hidden",
          shadowColor: INK,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.05,
          shadowRadius: 14,
          elevation: 2,
        }}
      >
        <ColumnHeader isAverage={isAverage} />

        {rows.map((row, index) => (
          <LoadRow
            key={row.muscle_group}
            row={row}
            rank={index + 1}
            index={index}
            capacity={capacity}
            slots={slots}
            pips={pips}
            emphasis={sort}
            cycle={sort}
            open={openGroup === row.muscle_group}
            onToggle={() =>
              setOpenGroup((current) =>
                current === row.muscle_group ? null : row.muscle_group
              )
            }
            exercises={breakdown(row.muscle_group)}
          />
        ))}

        <Legend slots={slots} pips={pips} isAverage={isAverage} />
      </View>
    </View>
  );
}

interface RowProps {
  row: MuscleLoadRow;
  rank: number;
  index: number;
  capacity: number;
  slots: number | null;
  pips: number | null;
  emphasis: LoadSortKey;
  cycle: string;
  /** Whether this row's exercise drawer is out. */
  open: boolean;
  onToggle: () => void;
  exercises: MuscleExerciseRow[];
}

function LoadRow({
  row,
  rank,
  index,
  capacity,
  slots,
  pips,
  emphasis,
  cycle,
  open,
  onToggle,
  exercises,
}: RowProps) {
  const label = muscleGroupLabel(row.muscle_group);
  const leading = rank === 1;
  const seriesLed = emphasis === "series";
  const { hovered, handlers } = useInteractionState();

  const seriesNumber = formatSeriesNumber(row.series, row.isAverage);
  const freqNumber = formatFrequencyNumber(row.frequency, row.isAverage);

  const openness = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    openness.value = withTiming(open ? 1 : 0, {
      duration: 200,
      easing: Easing.out(Easing.cubic),
    });
  }, [open, openness]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${openness.value * 180}deg` }],
  }));

  return (
    <FadeInRow
      index={index}
      step={STEP}
      cycle={cycle}
      style={{
        borderTopWidth: index === 0 ? 0 : 1,
        borderTopColor: HAIRLINE,
      }}
    >
      <Pressable
        onPress={onToggle}
        {...handlers}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${label}: ${seriesNumber} ${seriesUnit(row.series, row.isAverage)}, ${freqNumber} sessões${row.isAverage ? " por semana" : ""}. Toque para ver os exercícios.`}
        style={{
          paddingHorizontal: 14,
          paddingVertical: 11,
          backgroundColor: open ? "#fbfaf7" : hovered ? "#fbfaf7" : "transparent",
        }}
      >
        <View className="flex-row items-center" style={{ gap: 9 }}>
          <Text
            style={{
              width: 11,
              color: leading ? INK : "#bdb8aa",
              fontSize: 9,
              fontWeight: "700",
              fontFamily: MONO,
            }}
          >
            {rank}
          </Text>

          {/* The leading group inverts to ink — the top of the rack is legible
              from across the screen, before any number is read. */}
          <View
            className="items-center justify-center"
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              backgroundColor: leading ? INK : CREAM,
              borderWidth: 1,
              borderColor: leading ? INK : "#e7e4dc",
            }}
          >
            <Text
              style={{
                color: leading ? CREAM : "#6f6b5f",
                fontSize: 10,
                fontWeight: "700",
                fontFamily: MONO,
                letterSpacing: 0.4,
              }}
            >
              {monogramFor(row.muscle_group, label)}
            </Text>
          </View>

          <Text
            style={{ color: INK, fontSize: 12, fontWeight: "700", letterSpacing: 0.8, flex: 1 }}
            numberOfLines={1}
          >
            {label.toUpperCase()}
          </Text>

          {/* Bare number: the unit is stated once in the column header, not nine
              times down the panel. */}
          <Text
            style={{
              color: seriesLed ? INK : "#5c594f",
              fontSize: 17,
              fontWeight: "700",
              fontFamily: MONO,
            }}
          >
            {seriesNumber}
          </Text>

          <Animated.View style={chevronStyle}>
            <MaterialCommunityIcons
              name="chevron-down"
              size={16}
              color={open ? "#6f6b5f" : "#c9c4b6"}
            />
          </Animated.View>
        </View>

        <View className="flex-row items-center" style={{ marginTop: 9, gap: 10 }}>
          <View style={{ flex: 1 }}>
            <TickBar
              value={row.series}
              capacity={capacity}
              slots={slots}
              // The drawer's paper shows through the grooves once it's open —
              // the plates have to stay cut against whatever is behind them.
              grooveColor={open ? "#fbfaf7" : "#ffffff"}
              delay={180 + index * STEP}
              cycle={cycle}
            />
          </View>

          <View
            className="flex-row items-center justify-end"
            style={{ width: FREQ_COL, gap: 6 }}
          >
            <FrequencyPips
              value={row.frequency}
              slots={pips}
              delay={330 + index * STEP}
              cycle={cycle}
            />
            <Text
              style={{
                color: seriesLed ? "#5c594f" : INK,
                fontSize: 11,
                fontWeight: seriesLed ? "500" : "700",
                fontFamily: MONO,
              }}
            >
              {freqNumber}×
            </Text>
          </View>
        </View>
      </Pressable>

      {open ? (
        <MuscleExerciseList rows={exercises} cycle={row.muscle_group} />
      ) : null}
    </FadeInRow>
  );
}

/** Scoreboard above the panel — the totals the per-group ranking can't show,
 *  including the most-trained group, which the series ranking buries. */
function LoadStrip({
  summary,
  isAverage,
}: {
  summary: MuscleLoadSummary;
  isAverage: boolean;
}) {
  const { totalSeries, groupCount, topFrequency } = summary;

  return (
    <View
      className="bg-surface-card rounded-2xl flex-row items-stretch mb-3"
      style={{ paddingVertical: 12 }}
    >
      <Cell label="CARGA TOTAL" flex={1.2}>
        <View className="flex-row items-baseline" style={{ gap: 2 }}>
          <Text style={{ color: INK, fontSize: 20, fontWeight: "700", fontFamily: MONO }}>
            {formatSeriesNumber(totalSeries, isAverage)}
          </Text>
          <Text className="text-ink-mute" style={{ fontSize: 9 }}>
            {isAverage ? "sér/sem" : "sér"}
          </Text>
        </View>
      </Cell>

      <Divider />

      <Cell label="GRUPOS" flex={0.8}>
        <Text style={{ color: INK, fontSize: 20, fontWeight: "700", fontFamily: MONO }}>
          {groupCount}
        </Text>
      </Cell>

      <Divider />

      <Cell label="MAIS FREQUENTE" flex={1.4}>
        {topFrequency ? (
          <>
            <View className="flex-row items-baseline" style={{ gap: 2 }}>
              <MaterialCommunityIcons
                name="repeat-variant"
                size={13}
                color="#928d80"
                style={{ marginRight: 3 }}
              />
              <Text style={{ color: INK, fontSize: 20, fontWeight: "700", fontFamily: MONO }}>
                {formatFrequencyNumber(topFrequency.frequency, isAverage)}
              </Text>
              <Text className="text-ink-mute" style={{ fontSize: 9 }}>
                {isAverage ? "×/sem" : "×"}
              </Text>
            </View>
            <Text className="text-ink-faint" style={{ fontSize: 9, marginTop: 1 }} numberOfLines={1}>
              {muscleGroupLabel(topFrequency.muscle_group)}
            </Text>
          </>
        ) : (
          <Text style={{ color: "#bdb8aa", fontSize: 20, fontWeight: "700", fontFamily: MONO }}>
            —
          </Text>
        )}
      </Cell>
    </View>
  );
}

function Cell({ label, flex, children }: { label: string; flex: number; children: ReactNode }) {
  return (
    <View style={{ flex }} className="items-center px-2">
      <Text
        style={{ color: "#928d80", fontSize: 9, fontWeight: "700", letterSpacing: 1.2, marginBottom: 3 }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

function Divider() {
  return <View style={{ width: 1, backgroundColor: "#ede9e1", marginVertical: 2 }} />;
}

const SORT_OPTIONS: { key: LoadSortKey; label: string }[] = [
  { key: "series", label: "Séries" },
  { key: "frequency", label: "Frequência" },
];

/** Which reading orders the rack. Switching re-deals the whole panel, so the
 *  new ranking arrives as motion instead of as a silent reshuffle. */
function SortChips({
  value,
  onChange,
}: {
  value: LoadSortKey;
  onChange: (key: LoadSortKey) => void;
}) {
  return (
    <View className="flex-row items-center mb-2.5" style={{ gap: 6 }}>
      <Text style={{ color: "#bdb8aa", fontSize: 9, fontWeight: "700", letterSpacing: 1.1 }}>
        ORDENAR
      </Text>
      {SORT_OPTIONS.map((opt) => (
        <SortChip
          key={opt.key}
          label={opt.label}
          active={opt.key === value}
          onPress={() => onChange(opt.key)}
        />
      ))}
    </View>
  );
}

/** One ORDENAR chip. Interaction state comes from a hook rather than Pressable's
 *  style callback — see useInteractionState for why. */
function SortChip({
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
      style={{
        paddingVertical: 4,
        paddingHorizontal: 11,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? INK : "#ddd8ce",
        backgroundColor: active ? INK : hovered ? "#f0ede6" : "transparent",
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: active ? "700" : "500",
          color: active ? "#ffffff" : hovered ? "#5c594f" : "#928d80",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** The panel is a table, so it gets a table's header: the unit, once, over the
 *  column it belongs to. */
function ColumnHeader({ isAverage }: { isAverage: boolean }) {
  return (
    <View
      className="flex-row items-center justify-between"
      style={{
        paddingHorizontal: 14,
        paddingTop: 7,
        paddingBottom: 6,
        borderBottomWidth: 1,
        borderBottomColor: HAIRLINE,
        backgroundColor: "#fdfcfa",
      }}
    >
      <Text style={{ color: "#bdb8aa", fontSize: 9, fontWeight: "700", letterSpacing: 1.1 }}>
        GRUPO
      </Text>
      <Text style={{ color: "#bdb8aa", fontSize: 9, fontWeight: "700", letterSpacing: 1.1 }}>
        {isAverage ? "SÉRIES/SEM" : "SÉRIES"}
      </Text>
    </View>
  );
}

/** The two encodings only work if the units are stated once. */
function Legend({
  slots,
  pips,
  isAverage,
}: {
  slots: number | null;
  pips: number | null;
  isAverage: boolean;
}) {
  if (slots == null && pips == null) return null;

  return (
    <View
      className="flex-row items-center"
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: HAIRLINE,
        backgroundColor: "#fdfcfa",
        gap: 5,
      }}
    >
      {slots != null ? (
        <>
          <View style={{ width: 6, height: 9, borderRadius: 1.5, backgroundColor: INK }} />
          <Text className="text-ink-faint" style={{ fontSize: 9, letterSpacing: 0.3 }}>
            1 série
          </Text>
        </>
      ) : null}

      {slots != null && pips != null ? (
        <Text className="text-ink-faint" style={{ fontSize: 9 }}>
          ·
        </Text>
      ) : null}

      {pips != null ? (
        <>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: INK }} />
          <Text className="text-ink-faint" style={{ fontSize: 9, letterSpacing: 0.3 }}>
            {isAverage ? "1 sessão/semana" : "1 sessão"}
          </Text>
        </>
      ) : null}
    </View>
  );
}

/** An empty panel still has to say what would fill it. */
function EmptyPanel() {
  return (
    <View
      className="bg-surface-card rounded-2xl items-center"
      style={{ paddingVertical: 26, paddingHorizontal: 20 }}
    >
      <View
        className="items-center justify-center"
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          borderWidth: 1.5,
          borderColor: "#e7e4dc",
          backgroundColor: CREAM,
          marginBottom: 10,
        }}
      >
        <MaterialCommunityIcons name="chart-timeline-variant" size={20} color="#bdb8aa" />
      </View>
      <Text style={{ color: INK, fontSize: 13, fontWeight: "700", letterSpacing: 0.5 }}>
        Nada no período
      </Text>
      <Text className="text-ink-mute text-xs text-center" style={{ marginTop: 4, lineHeight: 17 }}>
        Registre uma sessão de musculação e a carga por grupo aparece aqui.
      </Text>
    </View>
  );
}
