import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { StrengthRecordRow } from "@/components/StrengthRecordRow";
import { TrophyCaseStrip } from "@/components/TrophyCaseStrip";
import { muscleGroupLabel } from "@/data/muscleGroups";
import type { DateRange } from "@/types";
import { UNGROUPED_KEY, type MuscleRecordGroup } from "@/utils/analyticsRecords";
import { todayISO } from "@/utils/cycle";
import {
  crownRecord,
  formatKg,
  freshCount,
  monogramFor,
  nextMilestone,
  stampsFor,
  summarizeRecords,
  type StampTone,
} from "@/utils/recordsGamification";

const MONO = "JetBrains Mono, Menlo, Courier New, monospace";
const BRASS = "#d9a441";
const CREAM = "#f4f2ee";
const INK = "#26241f";

interface Props {
  groups: MuscleRecordGroup[];
  /** The active window — badges records achieved within it as "NOVO". */
  currentRange: DateRange;
  /** Exercises whose load has climbed repeatedly of late — the "QUENTE" stamp. */
  hotExercises: ReadonlySet<number>;
  /** Injectable for tests; drives the "há N dias" / staleness read. */
  today?: string;
}

/** Identifies the one open tooltip across every shelf. */
type ActiveStamp = { exerciseId: number; tone: StampTone } | null;

function groupLabel(key: string): string {
  return key === UNGROUPED_KEY ? "Sem grupo" : muscleGroupLabel(key);
}

/** The trophy case: a scoreboard, then one shelf per muscle group, one open at a
 *  time. Collapsed by default — with ~70 exercises a flat list buried everything
 *  below the first five, and the muscle group is how you actually go looking for
 *  a lift. Each shelf front carries its crown lift and the climb to the next round
 *  plate, so a closed accordion still says something worth reading. */
export function RecordsByMuscleGroup({
  groups,
  currentRange,
  hotExercises,
  today = todayISO(),
}: Props) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [activeStamp, setActiveStamp] = useState<ActiveStamp>(null);

  if (groups.length === 0) return <EmptyCase />;

  return (
    <View>
      <TrophyCaseStrip summary={summarizeRecords(groups, currentRange)} />

      {groups.map((group) => (
        <MuscleShelf
          key={group.muscle_group}
          group={group}
          currentRange={currentRange}
          hotExercises={hotExercises}
          today={today}
          isOpen={openGroup === group.muscle_group}
          onToggle={() => {
            setActiveStamp(null);
            setOpenGroup((current) =>
              current === group.muscle_group ? null : group.muscle_group
            );
          }}
          activeStamp={activeStamp}
          onActivateStamp={setActiveStamp}
        />
      ))}
    </View>
  );
}

interface ShelfProps {
  group: MuscleRecordGroup;
  currentRange: DateRange;
  hotExercises: ReadonlySet<number>;
  today: string;
  isOpen: boolean;
  onToggle: () => void;
  activeStamp: ActiveStamp;
  onActivateStamp: (active: ActiveStamp) => void;
}

function MuscleShelf({
  group,
  currentRange,
  hotExercises,
  today,
  isOpen,
  onToggle,
  activeStamp,
  onActivateStamp,
}: ShelfProps) {
  const crown = crownRecord(group);
  const milestone = crown ? nextMilestone(crown.max_weight_kg) : null;
  const fresh = freshCount(group, currentRange);

  const openness = useSharedValue(isOpen ? 1 : 0);
  const fill = useSharedValue(0);

  useEffect(() => {
    openness.value = withTiming(isOpen ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [isOpen, openness]);

  useEffect(() => {
    // The bar filling on first paint is the whole point of showing it — a static
    // bar reads as decoration, a growing one reads as progress. Plates are round,
    // so a crown lift often sits exactly on a mark and the climb starts at zero;
    // a minimum nub keeps that reading as "just banked" rather than as a bug.
    const target = milestone == null ? 0 : Math.max(milestone.progress, 0.035);
    fill.value = withDelay(
      120,
      withTiming(target, { duration: 800, easing: Easing.out(Easing.cubic) })
    );
  }, [milestone, fill]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${openness.value * 180}deg` }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.min(1, Math.max(0, fill.value)) * 100}%`,
  }));

  // Open shelves invert to ink — the case swings open and the group you are
  // reading is unmistakable against the paper around it.
  const titleColor = isOpen ? CREAM : INK;
  const mutedColor = isOpen ? "#a8a293" : "#928d80";

  return (
    // A bubble opened on the last row hangs past this shelf and into the next
    // one, which paints later — the whole shelf has to rise with it.
    <View style={{ marginBottom: 8, ...(isOpen && activeStamp ? { zIndex: 50, elevation: 10 } : null) }}>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        accessibilityLabel={`${groupLabel(group.muscle_group)}, ${group.records.length} records`}
        className="rounded-2xl px-3.5 py-3"
        style={{ backgroundColor: isOpen ? INK : "#ffffff" }}
      >
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <View
            className="items-center justify-center"
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              backgroundColor: isOpen ? "rgba(255,255,255,0.08)" : CREAM,
              borderWidth: 1,
              borderColor: isOpen ? "rgba(255,255,255,0.18)" : "#e7e4dc",
            }}
          >
            <Text
              style={{
                color: isOpen ? CREAM : "#6f6b5f",
                fontSize: 11,
                fontWeight: "700",
                fontFamily: MONO,
                letterSpacing: 0.5,
              }}
            >
              {monogramFor(group.muscle_group, groupLabel(group.muscle_group))}
            </Text>
          </View>

          <Text
            style={{ color: titleColor, fontSize: 13, fontWeight: "700", letterSpacing: 0.8, flex: 1 }}
            numberOfLines={1}
          >
            {groupLabel(group.muscle_group).toUpperCase()}
          </Text>

          {fresh > 0 ? (
            <View
              className="flex-row items-center rounded-full"
              style={{
                backgroundColor: isOpen ? "rgba(217,164,65,0.22)" : "#f6e8c8",
                paddingHorizontal: 7,
                paddingVertical: 2,
                gap: 3,
              }}
            >
              <MaterialCommunityIcons
                name="star-four-points"
                size={9}
                color={isOpen ? "#f0cf8e" : "#8a5a12"}
              />
              <Text
                style={{
                  color: isOpen ? "#f0cf8e" : "#8a5a12",
                  fontSize: 10,
                  fontWeight: "700",
                }}
              >
                {fresh} {fresh === 1 ? "novo" : "novos"}
              </Text>
            </View>
          ) : null}

          <View
            className="rounded-full"
            style={{
              backgroundColor: isOpen ? "rgba(255,255,255,0.08)" : CREAM,
              paddingHorizontal: 7,
              paddingVertical: 2,
            }}
          >
            <Text style={{ color: mutedColor, fontSize: 10, fontWeight: "600" }}>
              {group.records.length} {group.records.length === 1 ? "record" : "records"}
            </Text>
          </View>

          <Animated.View style={chevronStyle}>
            <MaterialCommunityIcons
              name="chevron-down"
              size={18}
              color={isOpen ? "#a8a293" : "#bdb8aa"}
            />
          </Animated.View>
        </View>

        {crown && milestone ? (
          <>
            {/* The shelf front: what's crowning this group right now. */}
            <View className="flex-row items-baseline mt-3" style={{ gap: 7 }}>
              <MaterialCommunityIcons name="trophy-variant" size={12} color={BRASS} />
              <Text style={{ color: mutedColor, fontSize: 12, flex: 1 }} numberOfLines={1}>
                {crown.exercise_name}
              </Text>
              <Text
                style={{ color: titleColor, fontSize: 17, fontWeight: "700", fontFamily: MONO }}
              >
                {crown.max_weight_kg}
              </Text>
              <Text style={{ color: mutedColor, fontSize: 10 }}>kg</Text>
            </View>

            {/* Climb to the next round plate. */}
            <View
              className="overflow-hidden"
              style={{
                height: 5,
                borderRadius: 99,
                marginTop: 9,
                backgroundColor: isOpen ? "rgba(255,255,255,0.12)" : "#ebe7df",
              }}
            >
              <Animated.View
                style={[{ height: "100%", borderRadius: 99, backgroundColor: BRASS }, fillStyle]}
              />
            </View>

            <View className="flex-row items-center justify-between" style={{ marginTop: 5 }}>
              <View className="flex-row items-center" style={{ gap: 4 }}>
                {milestone.justHit ? (
                  <MaterialCommunityIcons name="star-four-points" size={9} color={BRASS} />
                ) : null}
                <Text style={{ color: mutedColor, fontSize: 9, fontWeight: "700", letterSpacing: 1 }}>
                  {milestone.justHit
                    ? `${formatKg(milestone.previous)} KG BATIDOS · PRÓXIMA ${formatKg(milestone.next)}`
                    : `PRÓXIMA MARCA ${formatKg(milestone.next)} KG`}
                </Text>
              </View>
              <Text style={{ color: mutedColor, fontSize: 10 }}>
                faltam {formatKg(milestone.next - crown.max_weight_kg)} kg
              </Text>
            </View>
          </>
        ) : null}
      </TouchableOpacity>

      {isOpen ? (
        <View
          style={{
            marginTop: 8,
            marginLeft: 15,
            paddingLeft: 11,
            borderLeftWidth: 1.5,
            borderLeftColor: "#e7e4dc",
          }}
        >
          {group.records.map((record, index) => (
            <StrengthRecordRow
              key={record.exercise_id}
              record={record}
              rank={index}
              tones={stampsFor(record, currentRange, today, hotExercises)}
              activeTone={
                activeStamp?.exerciseId === record.exercise_id ? activeStamp.tone : null
              }
              onActivateTone={(tone) =>
                onActivateStamp(tone == null ? null : { exerciseId: record.exercise_id, tone })
              }
              todayISO={today}
              onPress={() => router.push(`/exercises/${record.exercise_id}`)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** An empty case still has to say what would fill it. */
function EmptyCase() {
  return (
    <View className="bg-surface-card rounded-2xl items-center" style={{ paddingVertical: 26, paddingHorizontal: 20 }}>
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
        <MaterialCommunityIcons name="trophy-outline" size={20} color="#bdb8aa" />
      </View>
      <Text style={{ color: INK, fontSize: 13, fontWeight: "700", letterSpacing: 0.5 }}>
        Vitrine vazia
      </Text>
      <Text className="text-ink-mute text-xs text-center" style={{ marginTop: 4, lineHeight: 17 }}>
        Registre uma série com carga e o primeiro record aparece aqui.
      </Text>
    </View>
  );
}
