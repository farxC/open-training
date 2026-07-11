import { Image, Text, TouchableOpacity, View } from "react-native";
import type { SessionSummary } from "@/types";
import { modalityLabel } from "@/data/modalities";

interface Props {
  session: SessionSummary;
  onPress: () => void;
}

const WEEKDAY_ABBREVS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTH_ABBREVS = [
  "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ",
];

function parseDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return {
    weekday: WEEKDAY_ABBREVS[d.getDay()],
    month: MONTH_ABBREVS[d.getMonth()],
    day: d.getDate(),
  };
}

/** Inserts "." every 3 digits from the right — pt-BR thousands separator. Avoids toLocaleString (Hermes support is spotty). */
function formatThousands(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "-" : "";
  const digits = String(Math.abs(rounded));
  const withDots = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return sign + withDots;
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null;
  const m = Math.round(seconds / 60);
  return `${m}min`;
}

function exerciseLine(names: string[]): string | null {
  if (names.length === 0) return null;
  if (names.length <= 4) return names.join(" · ");
  return `${names.slice(0, 4).join(" · ")} +${names.length - 4}`;
}

const MODALITY_DOT: Record<SessionSummary["modality"], string> = {
  musculacao: "#26241f",
  corrida: "#2f9e6e",
};

export function SessionCard({ session, onPress }: Props) {
  const { weekday, month, day } = parseDate(session.date);
  const duration = formatDuration(session.duration_seconds);
  const exercises = exerciseLine(session.exercise_names);
  const exerciseCount = session.exercise_names.length;

  const metaParts: string[] = [];
  if (exerciseCount > 0) {
    metaParts.push(exerciseCount === 1 ? "1 exercício" : `${exerciseCount} exercícios`);
  }
  if (duration) metaParts.push(duration);

  const showDistance =
    session.modality === "corrida" &&
    session.total_distance_km != null &&
    session.total_distance_km > 0;
  const showVolume = !showDistance && session.total_volume != null && session.total_volume > 0;

  return (
    <TouchableOpacity
      style={{ borderWidth: 1, borderColor: "#ddd8ce" }}
      className="bg-surface-card mx-4 mb-3 rounded-2xl overflow-hidden"
      onPress={onPress}
      activeOpacity={0.75}
    >
      {session.cover_photo_uri && (
        <Image
          source={{ uri: session.cover_photo_uri }}
          className="w-full h-36"
          resizeMode="cover"
        />
      )}

      <View className="p-4 flex-row">
        {/* Date rail */}
        <View style={{ width: 52 }}>
          <Text style={{ color: "#928d80", fontSize: 10, fontWeight: "700", letterSpacing: 1.5 }}>
            {weekday}
          </Text>
          <Text
            className="font-display"
            style={{ color: "#26241f", fontSize: 30, lineHeight: 34, fontWeight: "500" }}
          >
            {day}
          </Text>
          <Text style={{ color: "#928d80", fontSize: 10, fontWeight: "700", letterSpacing: 1.5 }}>
            {month}
          </Text>
        </View>

        {/* Content */}
        <View className="flex-1 pl-3">
          <View className="flex-row justify-between items-start">
            <Text
              className="font-display flex-1 pr-2"
              style={{ color: "#26241f", fontSize: 19, fontWeight: "500", letterSpacing: -0.3 }}
              numberOfLines={1}
            >
              {session.name || modalityLabel(session.modality)}
            </Text>
            <View className="flex-row items-center" style={{ gap: 5 }}>
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: MODALITY_DOT[session.modality],
                }}
              />
              <Text
                className="text-ink-soft"
                style={{ fontSize: 10, fontWeight: "700", letterSpacing: 1 }}
              >
                {modalityLabel(session.modality).toUpperCase()}
              </Text>
            </View>
          </View>

          {metaParts.length > 0 && (
            <Text className="text-ink-mute" style={{ fontSize: 12, marginTop: 2 }}>
              {metaParts.join(" · ")}
            </Text>
          )}

          <View style={{ height: 1, backgroundColor: "#ddd8ce", marginVertical: 10 }} />

          {(showDistance || showVolume) && (
            <View style={{ marginBottom: exercises || session.notes ? 8 : 0 }}>
              {showDistance ? (
                <>
                  <Text
                    style={{
                      color: "#26241f",
                      fontSize: 24,
                      fontWeight: "700",
                      fontFamily: "JetBrains Mono, Menlo, Courier New, monospace",
                    }}
                  >
                    {session.total_distance_km!.toFixed(1)}
                  </Text>
                  <Text style={{ color: "#928d80", fontSize: 10, fontWeight: "700", letterSpacing: 1 }}>
                    KM
                  </Text>
                </>
              ) : (
                <>
                  <Text
                    style={{
                      color: "#26241f",
                      fontSize: 24,
                      fontWeight: "700",
                      fontFamily: "JetBrains Mono, Menlo, Courier New, monospace",
                    }}
                  >
                    {formatThousands(session.total_volume!)}
                  </Text>
                  <Text style={{ color: "#928d80", fontSize: 10, fontWeight: "700", letterSpacing: 1 }}>
                    KG · VOLUME TOTAL
                  </Text>
                </>
              )}
            </View>
          )}

          {exercises && (
            <Text
              className="text-ink-mute"
              style={{ fontSize: 12 }}
              numberOfLines={1}
            >
              {exercises}
            </Text>
          )}

          {session.notes && (
            <Text
              className="text-ink-mute italic"
              style={{ fontSize: 12, marginTop: 4 }}
              numberOfLines={1}
            >
              {session.notes}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
