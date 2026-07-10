import { useEffect, useState, type ComponentProps } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRoutine } from "@/hooks/useRoutine";
import { useSessionRecorder } from "@/hooks/useSessionRecorder";
import { MonthCalendar } from "@/components/MonthCalendar";
import { PhotoAttachment } from "@/components/PhotoAttachment";
import { ExercisePickerModal } from "@/components/ExercisePickerModal";
import { MODALITIES, modalityConfig, modalityLabel, formatClock, formatPaceSec } from "@/data/modalities";
import { getExercises } from "@/db/queries";
import { dateToISO, todayISO } from "@/utils/cycle";
import type { Exercise, Modality, RoutineSplit, RoutineUnit, RoutineUnitExercise } from "@/types";

type MciName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const STEP_ICON_CIRCLE = {
  width: 60,
  height: 60,
  borderRadius: 30,
  backgroundColor: "#ebe7df",
  alignItems: "center" as const,
  justifyContent: "center" as const,
  marginBottom: 16,
};

type Step = "modality" | "splitChoice" | "resolvedDay" | "changeUnit" | "details";
const SPLIT_STEPS: Step[] = ["splitChoice", "resolvedDay", "details"];

function formatDatePill(dateISO: string): string {
  if (dateISO === todayISO()) return "Hoje";
  const d = new Date(dateISO + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function describeTarget(t: RoutineUnitExercise): string {
  if (t.target_distance_km) {
    const pace = formatPaceSec(t.target_pace_sec);
    return `${t.target_distance_km}km${pace ? ` · pace ${pace}` : ""}`;
  }
  if (!t.target_sets) return "—";
  const reps = t.target_reps_max ? `${t.target_reps}–${t.target_reps_max}` : `${t.target_reps}`;
  const weight = t.target_weight_kg ? ` @ ${t.target_weight_kg}kg` : "";
  return `${t.target_sets}×${reps} reps${weight}`;
}

export default function NewSessionScreen() {
  const r = useRoutine();
  const recorder = useSessionRecorder();

  const [step, setStep] = useState<Step>("modality");
  const [date, setDate] = useState(() => todayISO());
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [dateModalMonth, setDateModalMonth] = useState(() => new Date());

  const [modality, setModality] = useState<Modality>("musculacao");
  const [splitId, setSplitId] = useState<number | null>(null);
  const [resolvedUnit, setResolvedUnit] = useState<RoutineUnit | null>(null);
  const [resolvedStatus, setResolvedStatus] = useState<"workout" | "rest">("rest");
  const [programWeekId, setProgramWeekId] = useState<number | null>(null);
  const [resolvedExercises, setResolvedExercises] = useState<RoutineUnitExercise[]>([]);

  const [name, setName] = useState("");
  const [nameFocused, setNameFocused] = useState(false);
  const [notes, setNotes] = useState("");
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [pendingExercises, setPendingExercises] = useState<
    { exercise: Exercise; targets?: RoutineUnitExercise }[]
  >([]);
  const [pickerVisible, setPickerVisible] = useState(false);

  const split = splitId != null ? r.splits.find((s) => s.id === splitId) ?? null : null;

  // The wizard's own exercise list starts from whatever the routine resolved for
  // this day, and stays editable from here on — no separate "add exercises" screen.
  useEffect(() => {
    const modalityExercises = getExercises({ modality });
    const exerciseById = new Map<number, Exercise>(modalityExercises.map((e) => [e.id, e]));
    const items = resolvedExercises
      .map((t) => {
        const exercise = exerciseById.get(t.exercise_id);
        return exercise ? { exercise, targets: t } : null;
      })
      .filter((x): x is { exercise: Exercise; targets: RoutineUnitExercise } => x != null);
    setPendingExercises(items);
  }, [resolvedExercises, modality]);

  const removePendingExercise = (exerciseId: number) => {
    setPendingExercises((prev) => prev.filter((p) => p.exercise.id !== exerciseId));
  };

  const applyEntryForSplit = (targetSplit: RoutineSplit, forDate: string) => {
    const entry = r.scheduleForDate(forDate).planned.find((p) => p.split.id === targetSplit.id) ?? null;
    if (entry?.unit) {
      const { exercises, programWeekId: pwId } = r.resolvedTargetsForUnit(entry.unit, targetSplit, forDate);
      setResolvedUnit(entry.unit);
      setResolvedStatus("workout");
      setProgramWeekId(pwId);
      setResolvedExercises(exercises);
    } else {
      setResolvedUnit(null);
      setResolvedStatus("rest");
      setProgramWeekId(null);
      setResolvedExercises([]);
    }
  };

  const chooseModality = (m: Modality) => {
    setModality(m);
    const splitsForModality = r.splits.filter((s) => s.modality === m);
    if (splitsForModality.length === 0) {
      setSplitId(null);
      setResolvedUnit(null);
      setResolvedStatus("rest");
      setProgramWeekId(null);
      setResolvedExercises([]);
      setStep("details");
    } else {
      setStep("splitChoice");
    }
  };

  const chooseSplit = (s: RoutineSplit) => {
    setSplitId(s.id);
    applyEntryForSplit(s, date);
    setStep("resolvedDay");
  };

  const skipSplit = () => {
    setSplitId(null);
    setResolvedUnit(null);
    setResolvedStatus("rest");
    setProgramWeekId(null);
    setResolvedExercises([]);
    setStep("details");
  };

  const chooseUnitManually = (unit: RoutineUnit) => {
    if (!split) return;
    const { exercises, programWeekId: pwId } = r.resolvedTargetsForUnit(unit, split, date);
    setResolvedUnit(unit);
    setResolvedStatus("workout");
    setProgramWeekId(pwId);
    setResolvedExercises(exercises);
    setStep("details");
  };

  const skipUnit = () => {
    setResolvedUnit(null);
    setResolvedStatus("rest");
    setProgramWeekId(null);
    setResolvedExercises([]);
    setStep("details");
  };

  const confirmDate = (newDate: string) => {
    setDate(newDate);
    setDateModalVisible(false);
    if (split) applyEntryForSplit(split, newDate);
    if (step === "changeUnit" || step === "resolvedDay") setStep("resolvedDay");
  };

  const handleStart = () => {
    recorder.startResolvedSession({
      date,
      modality,
      splitId,
      unitId: resolvedUnit?.id ?? null,
      programWeekId,
      name: name.trim() || null,
      notes: notes.trim() || null,
      photoUris,
      exercises: pendingExercises,
    });
    router.replace("/session/record");
  };

  const goBack = () => {
    if (step === "modality") router.back();
    else if (step === "splitChoice") setStep("modality");
    else if (step === "resolvedDay") setStep("splitChoice");
    else if (step === "changeUnit") setStep("resolvedDay");
    else if (step === "details") setStep(splitId != null ? "resolvedDay" : "splitChoice");
  };

  const stepTitle: Record<Step, string> = {
    modality: "Nova sessão",
    splitChoice: "Escolher split",
    resolvedDay: formatDatePill(date),
    changeUnit: "Trocar dia",
    details: "Detalhes",
  };

  const showIndicator = step !== "modality";
  const indicatorPosition = step === "changeUnit" ? "resolvedDay" : step;

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View style={{ flex: 1, width: "100%", maxWidth: 560, alignSelf: "center" }}>
        <View className="flex-row items-center px-4 py-3" style={{ gap: 8 }}>
          <Text className="text-ink font-display font-semibold text-2xl flex-1" style={{ letterSpacing: -0.4 }}>
            {stepTitle[step]}
          </Text>
          {step !== "modality" && step !== "details" && (
            <TouchableOpacity
              className="px-2.5 py-1.5 rounded-full flex-row items-center"
              style={{ backgroundColor: "#ebe7df", gap: 4 }}
              onPress={() => setDateModalVisible(true)}
            >
              <MaterialCommunityIcons name="calendar-blank-outline" size={14} color="#5c594f" />
              <Text className="text-ink-soft text-xs font-medium">{formatDatePill(date)}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={goBack}>
            <Text className="text-ink-soft text-base">{step === "modality" ? "Cancelar" : "Voltar"}</Text>
          </TouchableOpacity>
        </View>

        {showIndicator && (
          <View className="flex-row px-4 mb-1" style={{ gap: 6 }}>
            {SPLIT_STEPS.map((s, i) => (
              <View
                key={s}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: i <= SPLIT_STEPS.indexOf(indicatorPosition) ? "#26241f" : "#ddd8ce",
                }}
              />
            ))}
          </View>
        )}

        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {step === "modality" && (
              <>
                <Text className="text-ink-mute text-xs mb-2" style={{ letterSpacing: 1, fontWeight: "700" }}>
                  MODALIDADE
                </Text>
                <View className="flex-row" style={{ gap: 10 }}>
                  {MODALITIES.map((m) => (
                    <TouchableOpacity
                      key={m.key}
                      className="flex-1 items-center justify-center rounded-2xl"
                      style={{ paddingVertical: 18, gap: 8, borderWidth: 1, borderColor: "#ddd8ce", backgroundColor: "#ffffff" }}
                      onPress={() => chooseModality(m.key)}
                      activeOpacity={0.85}
                    >
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "#f4f2ee",
                        }}
                      >
                        <MaterialCommunityIcons name={m.icon as MciName} size={24} color="#5c594f" />
                      </View>
                      <Text style={{ color: "#5c594f", fontSize: 13, fontWeight: "600" }}>{m.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {step === "splitChoice" && (
              <>
                <Text className="text-ink-mute text-xs mb-2" style={{ letterSpacing: 1, fontWeight: "700" }}>
                  SPLIT
                </Text>
                <View style={{ gap: 10 }}>
                  {r.splits
                    .filter((s) => s.modality === modality)
                    .map((s) => (
                      <SplitOption
                        key={s.id}
                        icon={modalityConfig(s.modality).icon as MciName}
                        label={s.name}
                        description={s.mode === "cyclic" ? "Cíclico" : "Semanal"}
                        onPress={() => chooseSplit(s)}
                      />
                    ))}
                </View>
                <TouchableOpacity
                  className="mt-4 py-3 rounded-xl items-center"
                  style={{ borderWidth: 1, borderColor: "#c9c3b6", borderStyle: "dashed" }}
                  onPress={skipSplit}
                >
                  <Text className="text-ink text-sm font-medium">Sessão livre, sem split</Text>
                </TouchableOpacity>
              </>
            )}

            {step === "resolvedDay" && split && (
              <View style={{ alignItems: "center" }}>
                {resolvedStatus === "workout" && resolvedUnit ? (
                  <>
                    <View
                      className="flex-row items-center self-center px-2.5 py-1 rounded-full mb-4"
                      style={{ backgroundColor: "#e3efe8", gap: 5 }}
                    >
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#2f9e6e" }} />
                      <Text style={{ color: "#227a54", fontSize: 12, fontWeight: "700" }}>
                        {formatDatePill(date) === "Hoje" ? "Hoje" : formatDatePill(date)}
                      </Text>
                    </View>
                    <Text className="text-ink font-display font-semibold text-xl mb-2" style={{ textAlign: "center" }}>
                      {resolvedUnit.label}
                    </Text>
                    {resolvedExercises.length > 0 ? (
                      <View style={{ width: "100%", gap: 8, marginBottom: 20 }}>
                        {resolvedExercises.map((ex) => (
                          <View
                            key={ex.id}
                            className="flex-row items-center justify-between px-4 py-3 rounded-2xl"
                            style={{ borderWidth: 1, borderColor: "#ddd8ce" }}
                          >
                            <Text className="text-ink text-sm font-medium">{ex.exercise_name}</Text>
                            <Text className="text-ink-mute text-xs">{describeTarget(ex)}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text className="text-ink-mute text-sm mb-6" style={{ textAlign: "center", maxWidth: 280 }}>
                        Nenhum exercício definido ainda — adicione ao registrar.
                      </Text>
                    )}
                    <TouchableOpacity
                      className="py-3 rounded-xl items-center bg-brand-500"
                      style={{ width: "100%" }}
                      onPress={() => setStep("details")}
                    >
                      <Text className="text-white text-sm font-semibold">Continuar com este treino</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="mt-4 py-2 items-center" onPress={() => setStep("changeUnit")}>
                      <Text className="text-ink-soft text-sm">Trocar dia</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <View style={STEP_ICON_CIRCLE}>
                      <MaterialCommunityIcons name="weather-night" size={26} color="#26241f" />
                    </View>
                    <Text className="text-ink font-display font-semibold text-xl mb-2" style={{ textAlign: "center" }}>
                      {formatDatePill(date) === "Hoje" ? "Hoje" : formatDatePill(date)} é descanso em {split.name}
                    </Text>
                    <Text className="text-ink-mute text-sm mb-7" style={{ textAlign: "center", maxWidth: 280 }}>
                      {!split.anchor_date
                        ? "Este split ainda não tem uma data de início definida."
                        : "Não há treino previsto neste dia."}
                    </Text>
                    <TouchableOpacity
                      className="py-3 rounded-xl items-center mb-3"
                      style={{ width: "100%", borderWidth: 1, borderColor: "#c9c3b6", borderStyle: "dashed" }}
                      onPress={() => setStep("details")}
                    >
                      <Text className="text-ink text-sm font-medium">Registrar mesmo assim</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="py-2 items-center" onPress={() => setStep("changeUnit")}>
                      <Text className="text-ink-soft text-sm">Trocar dia</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            {step === "changeUnit" && split && (
              <>
                <Text className="text-ink-mute text-xs mb-2" style={{ letterSpacing: 1, fontWeight: "700" }}>
                  DIAS DE {split.name.toUpperCase()}
                </Text>
                <View style={{ gap: 10 }}>
                  {(r.unitsBySplit[split.id] ?? []).map((u) => (
                    <SplitOption
                      key={u.id}
                      icon="calendar-check-outline"
                      label={u.label}
                      description={resolvedUnit?.id === u.id ? "Dia inferido" : "Trocar para este dia"}
                      onPress={() => chooseUnitManually(u)}
                    />
                  ))}
                </View>
                <TouchableOpacity
                  className="mt-4 py-3 rounded-xl items-center"
                  style={{ borderWidth: 1, borderColor: "#c9c3b6", borderStyle: "dashed" }}
                  onPress={skipUnit}
                >
                  <Text className="text-ink text-sm font-medium">Sessão livre, sem unidade específica</Text>
                </TouchableOpacity>
              </>
            )}

            {step === "details" && (
              <View>
                {/* Compact modality context — was the big centered icon+badge, now tucked in the corner */}
                <View className="flex-row items-center mb-6" style={{ gap: 8 }}>
                  <View
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 15,
                      backgroundColor: "#ebe7df",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MaterialCommunityIcons name="notebook-outline" size={15} color="#26241f" />
                  </View>
                  <Text className="text-ink-soft text-xs font-medium">
                    {modalityLabel(modality)}
                    {split ? ` · ${split.name}` : " · livre"}
                    {resolvedUnit ? ` · ${resolvedUnit.label}` : ""}
                    {` · ${formatDatePill(date) === "Hoje" ? "hoje" : formatDatePill(date)}`}
                  </Text>
                </View>

                <View style={{ alignItems: "center" }}>
                  <Text
                    className="text-ink-mute text-center"
                    style={{ fontSize: 10, fontWeight: "700", letterSpacing: 1.2, marginBottom: 5 }}
                  >
                    NOME DA SESSÃO
                  </Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    onFocus={() => setNameFocused(true)}
                    onBlur={() => setNameFocused(false)}
                    placeholder="Ex.: Treino de pernas pesado"
                    placeholderTextColor="#bdb8aa"
                    className="font-display text-ink text-center"
                    style={{
                      width: "100%",
                      fontSize: 16,
                      fontWeight: "600",
                      letterSpacing: -0.1,
                      paddingVertical: 5,
                      marginBottom: 3,
                      borderBottomWidth: 1.5,
                      borderBottomColor: nameFocused ? "#26241f" : "#ddd8ce",
                    }}
                  />
                  <Text
                    className="text-ink-faint text-center italic"
                    style={{ fontSize: 11, marginBottom: 20 }}
                  >
                    opcional
                  </Text>
                </View>

                <View style={{ marginBottom: 16 }}>
                  <PhotoAttachment
                    photos={photoUris.map((uri, i) => ({ id: i, uri }))}
                    onAdd={(uri) => setPhotoUris((prev) => [...prev, uri])}
                    onRemove={(id) => setPhotoUris((prev) => prev.filter((_, i) => i !== id))}
                  />
                </View>

                <Text
                  className="text-ink-mute"
                  style={{ fontSize: 10, fontWeight: "700", letterSpacing: 1.2, marginBottom: 10 }}
                >
                  EXERCÍCIOS{pendingExercises.length > 0 ? ` · ${pendingExercises.length}` : ""}
                </Text>

                {pendingExercises.length > 0 && (
                  <View style={{ gap: 8, marginBottom: 10 }}>
                    {pendingExercises.map((item) => (
                      <View
                        key={item.exercise.id}
                        className="flex-row items-center justify-between px-4 py-3 rounded-2xl bg-surface-card"
                        style={{ borderWidth: 1, borderColor: "#ddd8ce" }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text className="text-ink text-sm font-medium">{item.exercise.name}</Text>
                          {item.targets && (
                            <Text className="text-ink-mute text-xs mt-0.5">{describeTarget(item.targets)}</Text>
                          )}
                        </View>
                        <TouchableOpacity
                          onPress={() => removePendingExercise(item.exercise.id)}
                          hitSlop={8}
                          style={{ padding: 4 }}
                        >
                          <MaterialCommunityIcons name="close" size={16} color="#928d80" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  className="py-3 rounded-xl items-center mb-6"
                  style={{ borderWidth: 1, borderColor: "#c9c3b6", borderStyle: "dashed" }}
                  onPress={() => setPickerVisible(true)}
                >
                  <Text className="text-ink text-sm font-medium">+ Adicionar exercícios</Text>
                </TouchableOpacity>

                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Observações (opcional)"
                  placeholderTextColor="#bdb8aa"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  className="bg-surface-elevated text-ink rounded-xl px-4 py-3 mb-6"
                  style={{ borderWidth: 1, borderColor: "#ddd8ce" }}
                />

                <TouchableOpacity
                  className="py-3 rounded-xl items-center bg-brand-500"
                  onPress={handleStart}
                  activeOpacity={0.55}
                >
                  <Text className="text-white text-sm font-semibold">Concluir</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      <ExercisePickerModal
        visible={pickerVisible}
        modality={modality}
        onConfirm={(exs) => {
          setPendingExercises((prev) => {
            const existingIds = new Set(prev.map((p) => p.exercise.id));
            const fresh = exs.filter((e) => !existingIds.has(e.id)).map((exercise) => ({ exercise }));
            return [...prev, ...fresh];
          });
        }}
        onClose={() => setPickerVisible(false)}
      />

      <Modal visible={dateModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDateModalVisible(false)}>
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
              selectedDate={date}
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

function SplitOption({
  icon,
  label,
  description,
  onPress,
}: {
  icon: MciName;
  label: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      className="flex-row items-center rounded-2xl px-4 py-3.5 bg-surface-card"
      style={{ borderWidth: 1, borderColor: "#ddd8ce", gap: 14 }}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: "#f4f2ee",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialCommunityIcons name={icon} size={20} color="#5c594f" />
      </View>
      <View style={{ flex: 1 }}>
        <Text className="text-ink text-sm font-semibold">{label}</Text>
        <Text className="text-ink-mute text-xs mt-0.5">{description}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color="#bdb8aa" />
    </TouchableOpacity>
  );
}
