import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import type { TrophyCase } from "@/utils/recordsGamification";

const MONO = "JetBrains Mono, Menlo, Courier New, monospace";
const BRASS = "#8a5a12";

interface Props {
  summary: TrophyCase;
}

/** Scoreboard above the shelves: how much is in the case, how much of it is new,
 *  and the single heaviest thing in it. Answers "how am I doing" before the user
 *  has opened a single group. */
export function TrophyCaseStrip({ summary }: Props) {
  const { total, fresh, best } = summary;

  return (
    <View
      className="bg-surface-card rounded-2xl flex-row items-stretch mb-3 overflow-hidden"
      style={{ paddingVertical: 12 }}
    >
      <Cell label="RECORDS" flex={1}>
        <Text style={{ color: "#26241f", fontSize: 20, fontWeight: "700", fontFamily: MONO }}>
          {total}
        </Text>
      </Cell>

      <Divider />

      <Cell label="NOVOS" flex={1}>
        <View className="flex-row items-center" style={{ gap: 3 }}>
          {fresh > 0 ? (
            <MaterialCommunityIcons name="star-four-points" size={11} color="#2f9e6e" />
          ) : null}
          <Text
            style={{
              color: fresh > 0 ? "#2f9e6e" : "#bdb8aa",
              fontSize: 20,
              fontWeight: "700",
              fontFamily: MONO,
            }}
          >
            {fresh}
          </Text>
        </View>
      </Cell>

      <Divider />

      <Cell label="MAIOR CARGA" flex={1.4}>
        {best ? (
          <>
            <View className="flex-row items-baseline" style={{ gap: 2 }}>
              <MaterialCommunityIcons
                name="trophy-variant"
                size={12}
                color={BRASS}
                style={{ marginRight: 3 }}
              />
              <Text style={{ color: "#26241f", fontSize: 20, fontWeight: "700", fontFamily: MONO }}>
                {best.max_weight_kg}
              </Text>
              <Text className="text-ink-mute" style={{ fontSize: 10 }}>
                kg
              </Text>
            </View>
            <Text className="text-ink-faint" style={{ fontSize: 9, marginTop: 1 }} numberOfLines={1}>
              {best.exercise_name}
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
