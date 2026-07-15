import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Image, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useSession } from "@/hooks/useSessions";
import {
  addSessionPhoto,
  deleteSession,
  deleteSetsByExercise,
  moveSessionPhoto,
  removeSessionPhoto,
  updateSession,
} from "@/db/queries";
import { confirmAction } from "@/components/AppModal";
import { ScreenHeader } from "@/components/ScreenHeader";
import { MonthCalendar } from "@/components/MonthCalendar";
import { PhotoAttachment } from "@/components/PhotoAttachment";
import { ExercisePickerModal } from "@/components/ExercisePickerModal";
import { SetLogger } from "@/components/SetLogger";
import { RunLogger } from "@/components/RunLogger";
import { modalityLabel, formatClock, formatPaceSec, parseClock } from "@/data/modalities";
import { dateToISO } from "@/utils/cycle";
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

function intensityColor(rpe: number | null, rir: number | null, failure: 0 | 1): string {
  if (failure || (rpe != null && rpe >= 9)) return "#bf3b30";
  if ((rir != null && rir <= 1) || (rpe != null && rpe >= 8)) return "#b9791f";
  return "#928d80";
}

const MODALITY_DOT: Record<string, string> = {
  musculacao: "#26241f",
  corrida: "#2f9e6e",
};

interface ExerciseGroup {
  id: number;
  name: string;
}

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, refresh } = useSession(Number(id));

  const [editing, setEditing] = useState(false);
  const [exerciseGroups, setExerciseGroups] = useState<ExerciseGroup[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [dateModalMonth, setDateModalMonth] = useState(() => new Date());
  const [nameText, setNameText] = useState("");
  const [notesText, setNotesText] = useState("");
  const [durationText, setDurationText] = useState("");

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

  const enterEdit = () => {
    setNameText(session.name ?? "");
    setNotesText(session.notes ?? "");
    setDurationText(formatClock(session.duration_seconds));
    const seen = new Set<number>();
    const groups: ExerciseGroup[] = [];
    for (const s of session.sets) {
      if (!seen.has(s.exercise_id)) {
        seen.add(s.exercise_id);
        groups.push({ id: s.exercise_id, name: s.exercise_name });
      }
    }
    setExerciseGroups(groups);
    setEditing(true);
  };

  const exitEdit = () => {
    setEditing(false);
    refresh();
  };

  const confirmDate = (newDate: string) => {
    updateSession(session.id, { date: newDate });
    setDateModalVisible(false);
    refresh();
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
          <View className="flex-row items-center" style={{ gap: 14 }}>
            <TouchableOpacity onPress={editing ? exitEdit : enterEdit} className="p-1">
              <Text className="text-ink-soft text-sm font-medium">{editing ? "Concluir" : "Editar"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} className="p-1">
              <MaterialCommunityIcons name="trash-can-outline" size={20} color="#bf3b30" />
            </TouchableOpacity>
          </View>
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {editing ? (
          <View className="px-5 pt-5">
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

            <View style={{ marginTop: 16 }}>
              <Text
                className="text-ink-mute text-center"
                style={{ fontSize: 10, fontWeight: "700", letterSpacing: 1.2, marginBottom: 5 }}
              >
                NOME DA SESSÃO
              </Text>
              <TextInput
                value={nameText}
                onChangeText={setNameText}
                onBlur={() => updateSession(session.id, { name: nameText.trim() || null })}
                placeholder="Ex.: Treino de pernas pesado"
                placeholderTextColor="#bdb8aa"
                className="font-display text-ink text-center"
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  paddingVertical: 5,
                  borderBottomWidth: 1.5,
                  borderBottomColor: "#ddd8ce",
                }}
              />
            </View>

            <View
              className="flex-row items-center justify-center"
              style={{ gap: 20, marginTop: 16 }}
            >
              <TouchableOpacity onPress={() => setDateModalVisible(true)}>
                <Text
                  className="text-ink-soft"
                  style={{ fontSize: 13, textDecorationLine: "underline" }}
                >
                  {formatDate(session.date)}
                </Text>
              </TouchableOpacity>
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <Text className="text-ink-mute" style={{ fontSize: 11 }}>Duração</Text>
                <TextInput
                  value={durationText}
                  onChangeText={setDurationText}
                  onBlur={() =>
                    updateSession(session.id, { duration_seconds: parseClock(durationText) ?? 0 })
                  }
                  placeholder="m:ss"
                  placeholderTextColor="#bdb8aa"
                  style={{
                    fontSize: 13,
                    minWidth: 44,
                    textAlign: "center",
                    borderBottomWidth: 1,
                    borderBottomColor: "#ddd8ce",
                  }}
                />
              </View>
            </View>

            <TextInput
              value={notesText}
              onChangeText={setNotesText}
              onBlur={() => updateSession(session.id, { notes: notesText.trim() || null })}
              placeholder="Observações (opcional)"
              placeholderTextColor="#bdb8aa"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              className="bg-surface-elevated text-ink rounded-xl px-4 py-3"
              style={{ borderWidth: 1, borderColor: "#ddd8ce", marginTop: 20 }}
            />

            <View style={{ marginTop: 20 }}>
              {exerciseGroups.map((group) =>
                isCorrida ? (
                  <RunLogger
                    key={group.id}
                    exerciseId={group.id}
                    exerciseName={group.name}
                    sessionId={session.id}
                    onRemoveExercise={() => {
                      deleteSetsByExercise(session.id, group.id);
                      setExerciseGroups((prev) => prev.filter((g) => g.id !== group.id));
                    }}
                  />
                ) : (
                  <SetLogger
                    key={group.id}
                    exerciseId={group.id}
                    exerciseName={group.name}
                    sessionId={session.id}
                    onRemoveExercise={() => {
                      deleteSetsByExercise(session.id, group.id);
                      setExerciseGroups((prev) => prev.filter((g) => g.id !== group.id));
                    }}
                  />
                )
              )}

              <TouchableOpacity
                className="py-3 rounded-xl items-center mb-6"
                style={{ borderWidth: 1, borderColor: "#c9c3b6", borderStyle: "dashed" }}
                onPress={() => setPickerVisible(true)}
              >
                <Text className="text-ink text-sm font-medium">+ Adicionar exercícios</Text>
              </TouchableOpacity>
            </View>

            <View style={{ marginBottom: 12 }}>
              <PhotoAttachment
                photos={session.photos.map((p) => ({ id: p.id, uri: p.uri }))}
                onAdd={(uri) => {
                  addSessionPhoto(session.id, uri);
                  refresh();
                }}
                onRemove={(photoId) => {
                  removeSessionPhoto(photoId);
                  refresh();
                }}
                onMove={(photoId, direction) => {
                  moveSessionPhoto(session.id, photoId, direction);
                  refresh();
                }}
              />
            </View>
          </View>
        ) : (
          <>
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
                          const hasIntensity = s.rpe != null || s.rir != null || !!s.failure;
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
                                      backgroundColor: intensityColor(s.rpe, s.rir, s.failure),
                                    }}
                                  />
                                  <Text className="text-ink-soft" style={{ fontSize: 11 }}>
                                    {s.rpe != null ? `RPE ${s.rpe}` : ""}
                                    {s.rpe != null && s.rir != null ? " · " : ""}
                                    {s.rir != null ? `RIR ${s.rir}` : ""}
                                    {s.failure ? `${s.rpe != null || s.rir != null ? " · " : ""}Falha` : ""}
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
          </>
        )}
      </ScrollView>

      <ExercisePickerModal
        visible={pickerVisible}
        modality={session.modality}
        onConfirm={(exs) => {
          setExerciseGroups((prev) => [
            ...prev,
            ...exs.filter((e) => !prev.some((p) => p.id === e.id)).map((e) => ({ id: e.id, name: e.name })),
          ]);
          setPickerVisible(false);
        }}
        onClose={() => setPickerVisible(false)}
      />

      <Modal
        visible={dateModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDateModalVisible(false)}
      >
        <SafeAreaView className="flex-1 bg-surface">
          <View className="flex-row items-center px-4 py-3">
            <Text className="text-ink font-display font-semibold text-2xl flex-1" style={{ letterSpacing: -0.4 }}>
              Data da sessão
            </Text>
            <TouchableOpacity onPress={() => setDateModalVisible(false)}>
              <Text className="text-ink-soft text-base">Cancelar</Text>
            </TouchableOpacity>
          </View>
          <View className="px-4">
            <MonthCalendar
              monthDate={dateModalMonth}
              onMonthChange={setDateModalMonth}
              selectedDate={session.date}
              onSelectDate={confirmDate}
            />
            <TouchableOpacity
              className="mt-4 py-3 rounded-xl items-center bg-brand-500"
              onPress={() => confirmDate(dateToISO(new Date()))}
            >
              <Text className="text-white text-sm font-semibold">Usar hoje</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
