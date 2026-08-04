import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { formatClock, formatDistanceValue, targetKindOf } from "@/data/modalities";
import type { DayExerciseBreakdown, Modality } from "@/types";
import { formatVolume } from "@/utils/analyticsFormat";

const WEEKDAYS_PT = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

interface Props {
  /** Null closes the modal — it's also the day being shown, so one prop does both. */
  dateISO: string | null;
  modality: Modality;
  rows: DayExerciseBreakdown[];
  onClose: () => void;
}

function dayTitle(dateISO: string): string {
  const d = new Date(dateISO + "T00:00:00");
  const dayMonth = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `${WEEKDAYS_PT[d.getDay()]}, ${dayMonth}`;
}

/** Centered dialog listing what a single day of training was made of. Values
 *  arrive canonical (kg, km, seconds) and are formatted here for the modality. */
export function DayBreakdownModal({ dateISO, modality, rows, onClose }: Props) {
  const isStrength = targetKindOf(modality) === "strength";

  const describe = (row: DayExerciseBreakdown): string => {
    const sets = `${row.setCount} ${row.setCount === 1 ? "série" : "séries"}`;
    if (isStrength) return `${sets} · ${formatVolume(row.volume)}`;

    const parts = [sets];
    const distance = row.distanceKm != null ? formatDistanceValue(row.distanceKm, modality) : null;
    if (distance) parts.push(distance);
    if (row.durationSec != null && row.durationSec > 0) parts.push(formatClock(row.durationSec));
    return parts.join(" · ");
  };

  const total = isStrength
    ? formatVolume(rows.reduce((sum, r) => sum + r.volume, 0))
    : formatDistanceValue(
        rows.reduce((sum, r) => sum + (r.distanceKm ?? 0), 0),
        modality
      ) ?? "—";

  return (
    <Modal visible={dateISO != null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        {/* Swallows presses so tapping the card itself doesn't close the dialog. */}
        <Pressable
          onPress={() => {}}
          style={{
            width: "100%",
            maxWidth: 380,
            maxHeight: "80%",
            backgroundColor: "#ffffff",
            borderRadius: 24,
            paddingVertical: 20,
          }}
        >
          <View className="px-5 pb-3">
            <Text
              style={{ color: "#928d80", fontSize: 10, fontWeight: "700", letterSpacing: 1.5 }}
            >
              DETALHE DO DIA
            </Text>
            <Text
              className="font-display font-semibold text-ink"
              style={{ fontSize: 20, letterSpacing: -0.3, marginTop: 2 }}
            >
              {dateISO ? dayTitle(dateISO) : ""}
            </Text>
          </View>

          <ScrollView style={{ flexGrow: 0 }}>
            {rows.map((row, index) => (
              <View
                key={row.exercise_id}
                className="px-5 py-3"
                style={{ borderTopWidth: index > 0 ? 1 : 0, borderTopColor: "#f0ede6" }}
              >
                <Text className="text-ink text-sm" numberOfLines={2}>
                  {row.exercise_name}
                </Text>
                <Text className="text-ink-mute text-xs mt-0.5">{describe(row)}</Text>
              </View>
            ))}
          </ScrollView>

          <View
            className="px-5 pt-3 flex-row items-center justify-between"
            style={{ borderTopWidth: 1, borderTopColor: "#ddd8ce" }}
          >
            <Text
              style={{ color: "#928d80", fontSize: 10, fontWeight: "700", letterSpacing: 1.5 }}
            >
              TOTAL
            </Text>
            <Text
              style={{
                color: "#26241f",
                fontSize: 16,
                fontWeight: "700",
                fontFamily: "JetBrains Mono, Menlo, Courier New, monospace",
              }}
            >
              {total}
            </Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
