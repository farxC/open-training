import { router, useLocalSearchParams } from "expo-router";
import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useSession } from "@/hooks/useSessions";
import { deleteSession } from "@/db/queries";
import { confirmAction } from "@/components/AppModal";
import { ScreenHeader } from "@/components/ScreenHeader";
import { modalityLabel, formatClock, formatPaceSec } from "@/data/modalities";
import type { WorkoutSet } from "@/types";

const WEEKDAY_ABBREVS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTH_ABBREVS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${WEEKDAY_ABBREVS[d.getDay()]}, ${d.getDate()} ${MONTH_ABBREVS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Inserts "." every 3 digits from the right — pt-BR thousands separator. Avoids toLocaleString (Hermes support is spotty). */
function formatThousands(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "-" : "";
  const digits = String(Math.abs(rounded));
  const withDots = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return sign + withDots;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function groupByExercise(
  sets: (WorkoutSet & { exercise_name: string })[]
): Record<string, (WorkoutSet & { exercise_name: string })[]> {
  const groups: Record<string, (WorkoutSet & { exercise_name: string })[]> = {};
  for (const set of sets) {
    if (!groups[set.exercise_name]) groups[set.exercise_name] = [];
    groups[set.exercise_name].push(set);
  }
  return groups;
}

function intensityColor(rpe: number | null, rir: number | null): string {
  if (rir === 0 || (rpe != null && rpe >= 9)) return "#bf3b30";
  if ((rir != null && rir <= 1) || (rpe != null && rpe >= 8)) return "#b9791f";
  return "#928d80";
}

const MODALITY_DOT: Record<string, string> = {
  musculacao: "#26241f",
  corrida: "#2f9e6e",
};

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, refresh } = useSession(Number(id));

  if (!session) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title="Sessão" fallbackHref="/" />
        <View className="flex-1 items-center justify-center">
          <Text className="text-ink-mute">Sessão não encontrada.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleDelete = () => {
    confirmAction("Excluir sessão?", "Esta ação não pode ser desfeita.", "Excluir", () => {
      deleteSession(session.id);
      router.back();
    });
  };

  const grouped = groupByExercise(session.sets);
  const totalVolume = session.sets.reduce((sum, s) => sum + s.reps * s.weight_kg, 0);
  const totalDistance = session.sets.reduce((sum, s) => sum + (s.distance_km ?? 0), 0);
  const exerciseCount = Object.keys(grouped).length;
  const isCorrida = session.modality === "corrida";

  const contextParts: string[] = [];
  if (session.split_name) contextParts.push(session.split_name);
  if (session.unit_label) contextParts.push(session.unit_label);

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader
        title={session.name || formatDate(session.date)}
        fallbackHref="/"
        right={
          <TouchableOpacity onPress={handleDelete} className="p-1">
            <MaterialCommunityIcons name="trash-can-outline" size={20} color="#bf3b30" />
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {session.photos.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 4, paddingHorizontal: 4 }}
          >
            {session.photos.map((photo) => (
              <Image
                key={photo.id}
                source={{ uri: photo.uri }}
                style={{ width: 320, height: 224, borderRadius: 16 }}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
        )}

        <View className="px-5 pt-5">
          {/* Masthead */}
          <View className="flex-row items-center" style={{ gap: 6 }}>
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
              style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.2 }}
            >
              {modalityLabel(session.modality).toUpperCase()}
              {contextParts.length > 0 ? ` · ${contextParts.join(" · ").toUpperCase()}` : ""}
            </Text>
          </View>

          <Text className="text-ink-mute" style={{ fontSize: 13, marginTop: 4 }}>
            {formatDate(session.date)}
          </Text>

          {/* Stat strip */}
          <View
            className="flex-row"
            style={{
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: "#ddd8ce",
              paddingVertical: 12,
              marginTop: 16,
            }}
          >
            <View className="flex-1">
              <Text
                style={{
                  color: "#26241f",
                  fontSize: 18,
                  fontFamily: "JetBrains Mono, Menlo, Courier New, monospace",
                }}
              >
                {isCorrida ? totalDistance.toFixed(1) : formatThousands(totalVolume)}
              </Text>
              <Text style={{ color: "#928d80", fontSize: 10, fontWeight: "700", letterSpacing: 1, marginTop: 2 }}>
                {isCorrida ? "KM" : "KG · VOLUME"}
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: "#ddd8ce" }} />
            <View className="flex-1 items-center">
              <Text
                style={{
                  color: "#26241f",
                  fontSize: 18,
                  fontFamily: "JetBrains Mono, Menlo, Courier New, monospace",
                }}
              >
                {formatDuration(session.duration_seconds)}
              </Text>
              <Text style={{ color: "#928d80", fontSize: 10, fontWeight: "700", letterSpacing: 1, marginTop: 2 }}>
                DURAÇÃO
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: "#ddd8ce" }} />
            <View className="flex-1 items-end">
              <Text
                style={{
                  color: "#26241f",
                  fontSize: 18,
                  fontFamily: "JetBrains Mono, Menlo, Courier New, monospace",
                }}
              >
                {exerciseCount}
              </Text>
              <Text style={{ color: "#928d80", fontSize: 10, fontWeight: "700", letterSpacing: 1, marginTop: 2 }}>
                EXERCÍCIOS
              </Text>
            </View>
          </View>

          {session.notes && (
            <View
              style={{ borderLeftWidth: 2, borderLeftColor: "#bdb8aa", marginTop: 16 }}
              className="pl-3"
            >
              <Text className="text-ink-soft italic" style={{ fontSize: 14, lineHeight: 20 }}>
                {session.notes}
              </Text>
            </View>
          )}

          <View style={{ marginTop: 20 }}>
            {Object.entries(grouped).map(([exerciseName, sets]) => {
              const vol = sets.reduce((s, x) => s + x.reps * x.weight_kg, 0);
              const isRunGroup = sets.some((s) => s.distance_km != null);
              const dist = sets.reduce((s, x) => s + (x.distance_km ?? 0), 0);
              const setLabel = sets.length === 1 ? "1 série" : `${sets.length} séries`;
              return (
                <View
                  key={exerciseName}
                  className="bg-surface-card mb-3"
                  style={{
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: "#ddd8ce",
                    overflow: "hidden",
                  }}
                >
                  {/* Card header */}
                  <View
                    className="flex-row justify-between items-baseline"
                    style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 11 }}
                  >
                    <Text
                      className="font-display flex-1 pr-3"
                      style={{ color: "#26241f", fontSize: 16, fontWeight: "600" }}
                      numberOfLines={1}
                    >
                      {exerciseName}
                    </Text>
                    <Text
                      className="text-ink-soft"
                      style={{
                        fontSize: 12,
                        fontFamily: "JetBrains Mono, Menlo, Courier New, monospace",
                      }}
                    >
                      {isRunGroup
                        ? dist > 0
                          ? `${dist.toFixed(1)} km`
                          : setLabel
                        : vol > 0
                          ? `${formatThousands(vol)} kg`
                          : setLabel}
                    </Text>
                  </View>

                  <View style={{ height: 1, backgroundColor: "#ddd8ce" }} />

                  {/* Sets */}
                  <View style={{ paddingHorizontal: 14 }}>
                    {sets.map((s, i) => {
                      const hasIntensity = s.rpe != null || s.rir != null;
                      return (
                        <View
                          key={s.id}
                          className="flex-row items-center"
                          style={{
                            paddingVertical: 10,
                            borderTopWidth: i === 0 ? 0 : 1,
                            borderTopColor: "#efeae1",
                          }}
                        >
                          <View
                            className="items-center justify-center bg-surface-elevated"
                            style={{ width: 24, height: 24, borderRadius: 12, marginRight: 10 }}
                          >
                            <Text
                              className="text-ink-soft"
                              style={{ fontSize: 11, fontFamily: "JetBrains Mono, Menlo, Courier New, monospace" }}
                            >
                              {s.set_number}
                            </Text>
                          </View>

                          {s.distance_km != null ? (
                            <Text className="text-ink flex-1" style={{ fontSize: 14 }}>
                              {s.distance_km} km em {formatClock(s.duration_sec)}
                              {formatPaceSec(s.pace_sec) ? ` · pace ${formatPaceSec(s.pace_sec)}` : ""}
                            </Text>
                          ) : (
                            <Text className="text-ink flex-1" style={{ fontSize: 14 }}>
                              <Text style={{ fontFamily: "JetBrains Mono, Menlo, Courier New, monospace" }}>
                                {s.weight_kg}
                              </Text>
                              <Text className="text-ink-mute"> kg × </Text>
                              <Text style={{ fontFamily: "JetBrains Mono, Menlo, Courier New, monospace" }}>
                                {s.reps}
                              </Text>
                              <Text className="text-ink-mute"> reps</Text>
                            </Text>
                          )}

                          {hasIntensity && (
                            <View className="flex-row items-center" style={{ gap: 5 }}>
                              <View
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: 3,
                                  backgroundColor: intensityColor(s.rpe, s.rir),
                                }}
                              />
                              <Text className="text-ink-soft" style={{ fontSize: 11 }}>
                                {s.rpe != null ? `RPE ${s.rpe}` : ""}
                                {s.rpe != null && s.rir != null ? " · " : ""}
                                {s.rir != null ? `RIR ${s.rir}${s.rir === 0 ? " (falha)" : ""}` : ""}
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            {session.sets.length === 0 && (
              <Text className="text-ink-mute text-center mt-8">
                Nenhum set registrado.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
