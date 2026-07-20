import { useReducer, useState, type ComponentProps } from "react";
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
import { SetLogger } from "@/components/SetLogger";
import { RunLogger } from "@/components/RunLogger";
import { DraggableList } from "@/components/DraggableList";
import { SessionTimer } from "@/components/SessionTimer";
import { SessionFinishModal } from "@/components/SessionFinishModal";
import { SectionHeader } from "@/components/SectionHeader";
import { MuscleSeriesSessionCard } from "@/components/MuscleSeriesSessionCard";
import { MODALITIES, modalityConfig, modalityLabel, formatClock, formatPaceSec } from "@/data/modalities";
import {
  getExercises,
  getSessionById,
  updateSession,
  getSessionPhotos,
  addSessionPhoto,
  removeSessionPhoto,
  getMuscleSeriesForSession,
} from "@/db/queries";
import { confirmAction, notify } from "@/components/AppModal";
import { dateToISO, todayISO } from "@/utils/cycle";
import { toMuscleSeriesRows } from "@/utils/analyticsAgg";
import type { Exercise, Modality, RoutineSplit, RoutineUnit, RoutineUnitExercise, SessionPhoto } from "@/types";

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

  // A leftover session from a previous "New session" attempt that got dismissed
  // without hitting Cancelar/Descartar (e.g. modal swipe-down) stays alive in
  // SessionRecorderContext. Resume it directly instead of showing the modality
  // picker again and silently reusing its (possibly different) modality/data.
  const resumedSession = recorder.sessionId != null ? getSessionById(recorder.sessionId) : null;

  const [step, setStep] = useState<Step>(() => (recorder.sessionId != null ? "details" : "modality"));
  const [date, setDate] = useState(() => resumedSession?.date ?? todayISO());
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [dateModalMonth, setDateModalMonth] = useState(() => new Date());

  const [modality, setModality] = useState<Modality>(() => recorder.modality ?? "musculacao");
  const [splitId, setSplitId] = useState<number | null>(() => recorder.splitId ?? null);
  const [resolvedUnit, setResolvedUnit] = useState<RoutineUnit | null>(null);
  const [resolvedStatus, setResolvedStatus] = useState<"workout" | "rest">("rest");
  const [programWeekId, setProgramWeekId] = useState<number | null>(() => recorder.programWeekId ?? null);
  const [resolvedExercises, setResolvedExercises] = useState<RoutineUnitExercise[]>([]);

  const [name, setName] = useState(() => resumedSession?.name ?? "");
  const [nameFocused, setNameFocused] = useState(false);
  const [notes, setNotes] = useState(() => resumedSession?.notes ?? "");
  const [photos, setPhotos] = useState<SessionPhoto[]>(() =>
    recorder.sessionId != null ? getSessionPhotos(recorder.sessionId) : []
  );
  const [pickerVisible, setPickerVisible] = useState(false);
  const [finishModalVisible, setFinishModalVisible] = useState(false);
  const [finishInitialDuration, setFinishInitialDuration] = useState(0);

  // Sets are persisted straight to SQLite by SetLogger/RunLogger (not the
  // recorder reducer), so this tick just forces a re-render to pick up the
  // latest getMuscleSeriesForSession() read after each mutation.
  const [, bumpSetsTick] = useReducer((c: number) => c + 1, 0);
  const muscleSeries =
    recorder.sessionId != null ? toMuscleSeriesRows(getMuscleSeriesForSession(recorder.sessionId)) : [];

  const split = splitId != null ? r.splits.find((s) => s.id === splitId) ?? null : null;

  // The details step *is* the recording screen now — there's no separate page to hop
  // to just to add exercises. Reaching it lazily creates the live session (once) so
  // SetLogger/RunLogger below can log real sets immediately, exactly like /session/record used to.
  const goToDetails = (params: {
    modality: Modality;
    splitId: number | null;
    unitId: number | null;
    programWeekId: number | null;
    exercises: RoutineUnitExercise[];
  }) => {
    if (recorder.sessionId == null) {
      const modalityExercises = getExercises({ modality: params.modality });
      const exerciseById = new Map<number, Exercise>(modalityExercises.map((e) => [e.id, e]));
      const items: { exercise: Exercise; targets?: RoutineUnitExercise }[] = params.exercises
        .map((t) => {
          const exercise = exerciseById.get(t.exercise_id);
          return exercise ? { exercise, targets: t } : null;
        })
        .filter((x): x is { exercise: Exercise; targets: RoutineUnitExercise } => x != null);

      // Corrida has no exercise picker — a run session just *is* the run, so seed
      // it with the default running exercise when the day didn't already resolve one.
      if (params.modality === "corrida" && items.length === 0 && modalityExercises.length > 0) {
        items.push({ exercise: modalityExercises[0] });
      }

      recorder.startResolvedSession({
        date,
        modality: params.modality,
        splitId: params.splitId,
        unitId: params.unitId,
        programWeekId: params.programWeekId,
        name: null,
        notes: null,
        photoUris: [],
        exercises: items,
      });
    }
    setStep("details");
  };

  const handleNameChange = (v: string) => {
    setName(v);
    if (recorder.sessionId != null) updateSession(recorder.sessionId, { name: v.trim() || null });
  };

  const handleAddPhoto = (uri: string) => {
    if (recorder.sessionId == null) return;
    addSessionPhoto(recorder.sessionId, uri);
    setPhotos(getSessionPhotos(recorder.sessionId));
  };

  const handleRemovePhoto = (id: number) => {
    removeSessionPhoto(id);
    if (recorder.sessionId != null) setPhotos(getSessionPhotos(recorder.sessionId));
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
      goToDetails({ modality: m, splitId: null, unitId: null, programWeekId: null, exercises: [] });
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
    goToDetails({ modality, splitId: null, unitId: null, programWeekId: null, exercises: [] });
  };

  const chooseUnitManually = (unit: RoutineUnit) => {
    if (!split) return;
    const { exercises, programWeekId: pwId } = r.resolvedTargetsForUnit(unit, split, date);
    setResolvedUnit(unit);
    setResolvedStatus("workout");
    setProgramWeekId(pwId);
    setResolvedExercises(exercises);
    goToDetails({ modality, splitId, unitId: unit.id, programWeekId: pwId, exercises });
  };

  const skipUnit = () => {
    setResolvedUnit(null);
    setResolvedStatus("rest");
    setProgramWeekId(null);
    setResolvedExercises([]);
    goToDetails({ modality, splitId, unitId: null, programWeekId: null, exercises: [] });
  };

  const confirmDate = (newDate: string) => {
    setDate(newDate);
    setDateModalVisible(false);
    if (split) applyEntryForSplit(split, newDate);
    if (step === "changeUnit" || step === "resolvedDay") setStep("resolvedDay");
  };

  const handleFinish = () => {
    if (recorder.selectedExercises.length === 0) {
      notify("Nenhum exercício", "Adicione ao menos um exercício antes de concluir.");
      return;
    }
    const elapsed = recorder.startTime
      ? Math.max(0, Math.round((Date.now() - recorder.startTime.getTime()) / 1000))
      : 0;
    setFinishInitialDuration(elapsed);
    setFinishModalVisible(true);
  };

  const handleConfirmFinish = (durationSeconds: number) => {
    recorder.finishSession(durationSeconds, notes);
    setFinishModalVisible(false);
    router.replace("/");
  };

  const handleDiscard = () => {
    const hasData =
      recorder.selectedExercises.length > 0 ||
      notes.trim().length > 0 ||
      photos.length > 0 ||
      name.trim().length > 0;
    if (!hasData) {
      if (recorder.sessionId != null) recorder.discardSession();
      router.replace("/");
      return;
    }
    confirmAction("Descartar sessão?", "Os dados serão perdidos.", "Descartar", () => {
      recorder.discardSession();
      router.replace("/");
    });
  };

  const goBack = () => {
    if (step === "modality") router.back();
    else if (step === "splitChoice") setStep("modality");
    else if (step === "resolvedDay") setStep("splitChoice");
    else if (step === "changeUnit") setStep("resolvedDay");
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
          <TouchableOpacity onPress={step === "details" ? handleDiscard : goBack}>
            <Text className="text-ink-soft text-base">
              {step === "modality" ? "Cancelar" : step === "details" ? "Descartar" : "Voltar"}
            </Text>
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
                      onPress={() =>
                        goToDetails({
                          modality,
                          splitId,
                          unitId: resolvedUnit?.id ?? null,
                          programWeekId,
                          exercises: resolvedExercises,
                        })
                      }
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
                      onPress={() =>
                        goToDetails({
                          modality,
                          splitId,
                          unitId: resolvedUnit?.id ?? null,
                          programWeekId,
                          exercises: resolvedExercises,
                        })
                      }
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
                <View style={{ marginBottom: 16 }}>
                  <SessionTimer startTime={recorder.startTime} onStart={recorder.startTimer} />
                </View>

                {muscleSeries.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <SectionHeader title="Séries por grupo muscular" />
                    <MuscleSeriesSessionCard data={muscleSeries} />
                  </View>
                )}

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
                    onChangeText={handleNameChange}
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
                    photos={photos.map((p) => ({ id: p.id, uri: p.uri }))}
                    onAdd={handleAddPhoto}
                    onRemove={handleRemovePhoto}
                  />
                </View>

                {modality !== "corrida" && (
                  <Text
                    className="text-ink-mute"
                    style={{ fontSize: 10, fontWeight: "700", letterSpacing: 1.2, marginBottom: 10 }}
                  >
                    EXERCÍCIOS{recorder.selectedExercises.length > 0 ? ` · ${recorder.selectedExercises.length}` : ""}
                  </Text>
                )}

                <DraggableList
                  data={recorder.selectedExercises}
                  keyExtractor={(exercise) => String(exercise.id)}
                  onReorder={(reordered) => recorder.reorderExercisesInSession(reordered.map((e) => e.id))}
                  renderItem={({ item: exercise, index, dragHandle }) =>
                    exercise.modality === "corrida" ? (
                      <RunLogger
                        exerciseId={exercise.id}
                        exerciseName={exercise.name}
                        sessionId={recorder.sessionId!}
                        targets={recorder.targetsByExerciseId[exercise.id]}
                        onRemoveExercise={() => recorder.removeExerciseFromSession(exercise.id)}
                        dragHandle={dragHandle}
                        index={index}
                        onSetsChanged={bumpSetsTick}
                      />
                    ) : (
                      <SetLogger
                        exerciseId={exercise.id}
                        exerciseName={exercise.name}
                        sessionId={recorder.sessionId!}
                        targets={recorder.targetsByExerciseId[exercise.id]}
                        onRemoveExercise={() => recorder.removeExerciseFromSession(exercise.id)}
                        dragHandle={dragHandle}
                        index={index}
                        onSetsChanged={bumpSetsTick}
                      />
                    )
                  }
                />

                {modality !== "corrida" && (
                  <TouchableOpacity
                    className="py-3 rounded-xl items-center mb-6"
                    style={{ borderWidth: 1, borderColor: "#c9c3b6", borderStyle: "dashed" }}
                    onPress={() => setPickerVisible(true)}
                  >
                    <Text className="text-ink text-sm font-medium">+ Adicionar exercícios</Text>
                  </TouchableOpacity>
                )}

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
                  onPress={handleFinish}
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
        onConfirm={(exs) => recorder.addExercisesToSession(exs)}
        onClose={() => setPickerVisible(false)}
      />

      <SessionFinishModal
        visible={finishModalVisible}
        initialDurationSec={finishInitialDuration}
        onCancel={() => setFinishModalVisible(false)}
        onConfirm={handleConfirmFinish}
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
