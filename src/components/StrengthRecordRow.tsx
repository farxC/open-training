import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useEffect } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { Stamp } from "@/components/RecordStamp";
import type { StrengthRecord } from "@/types";
import { daysSinceRecord, formatAgo, medalFor, type StampTone } from "@/utils/recordsGamification";

const MONO = "JetBrains Mono, Menlo, Courier New, monospace";
/** Past this the stagger stops paying for itself and just delays the tail. */
const MAX_STAGGERED = 6;

interface Props {
  record: StrengthRecord;
  /** 0-based position within the muscle group — 0/1/2 take the podium. */
  rank: number;
  /** Momentum stamps this record carries, already resolved from the data. */
  tones: StampTone[];
  /** The stamp whose tooltip is open, or null. Owned by the list so only one
   *  bubble is ever open, however many rows the user brushes past. */
  activeTone: StampTone | null;
  onActivateTone: (tone: StampTone | null) => void;
  todayISO: string;
  onPress: () => void;
}

/** One record on the shelf: podium metal, how long it has stood, and the load.
 *  The rank is the point — records arrive sorted by weight, so the column of
 *  medals tells you at a glance where a lift sits in its muscle group. */
export function StrengthRecordRow({
  record,
  rank,
  tones,
  activeTone,
  onActivateTone,
  todayISO,
  onPress,
}: Props) {
  const reveal = useSharedValue(0);

  useEffect(() => {
    reveal.value = withDelay(
      Math.min(rank, MAX_STAGGERED) * 45,
      withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) })
    );
  }, [rank, reveal]);

  const revealStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * 8 }],
  }));

  const medal = medalFor(rank);
  const isChampion = rank === 0;
  const days = daysSinceRecord(record.achieved_on, todayISO);
  // The bubble only wins the paint order if every container between it and the
  // list is lifted with it — one flat ancestor anywhere and a later sibling of
  // that ancestor covers it.
  const raised = activeTone ? { zIndex: 50, elevation: 10 } : null;

  return (
    // An open bubble overhangs the card, so this row has to outrank the ones
    // painted after it — zIndex for web and iOS, elevation for Android.
    <Animated.View style={[revealStyle, raised]}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        className="rounded-xl mb-2 flex-row"
        style={{ backgroundColor: isChampion ? "#fffdf6" : "#ffffff" }}
      >
        {/* Podium metal bleeds into the card edge — the ranking stays readable
            down the left gutter even when the labels blur past. The card can't
            clip it to the corner radius (that would cut the tooltip too), so the
            bar carries its own. */}
        <View
          style={{
            width: 3,
            backgroundColor: medal?.ring ?? "#ebe7df",
            borderTopLeftRadius: 12,
            borderBottomLeftRadius: 12,
          }}
        />

        <View className="flex-1 flex-row items-center px-3 py-3" style={{ gap: 10 }}>
          <View
            className="items-center justify-center"
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: medal?.bg ?? "#f4f2ee",
              borderWidth: medal ? 1.5 : 1,
              borderColor: medal?.ring ?? "#e7e4dc",
            }}
          >
            <Text
              style={{
                color: medal?.ink ?? "#a8a293",
                fontSize: 11,
                fontWeight: "700",
                fontFamily: MONO,
              }}
            >
              {rank + 1}
            </Text>
          </View>

          {/* Two full-width lines — name over meta, stamp and load pinned right.
              Sharing one line between the name and the load left a 340px phone
              rendering "Supino inclinado" as "Supino …". */}
          <View className="flex-1" style={[{ gap: 3 }, raised]}>
            {/* Raised too: the load sits on the line *after* this one, so with
                equal stacking the "kg" would paint straight over the bubble. */}
            <View className="flex-row items-center" style={[{ gap: 5 }, raised]}>
              <Text
                style={{
                  color: "#26241f",
                  fontSize: 11,
                  fontWeight: "700",
                  letterSpacing: 0.9,
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {record.exercise_name.toUpperCase()}
              </Text>
              {tones.map((tone) => (
                <Stamp
                  key={tone}
                  tone={tone}
                  isActive={activeTone === tone}
                  onActivate={onActivateTone}
                />
              ))}
            </View>

            <View className="flex-row items-baseline" style={{ gap: 4 }}>
              <Text className="text-ink-mute text-xs" numberOfLines={1} style={{ flex: 1 }}>
                {record.reps_at_max} {record.reps_at_max === 1 ? "rep" : "reps"}
                {days != null ? ` · ${formatAgo(days)}` : ""}
              </Text>
              <Text
                style={{
                  color: "#26241f",
                  fontSize: isChampion ? 21 : 18,
                  fontWeight: "700",
                  fontFamily: MONO,
                }}
                numberOfLines={1}
              >
                {record.max_weight_kg}
              </Text>
              <Text className="text-ink-mute" style={{ fontSize: 10 }}>
                kg
              </Text>
            </View>
          </View>

          <MaterialCommunityIcons name="chevron-right" size={18} color="#cfcabf" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

