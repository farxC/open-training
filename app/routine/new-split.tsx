import { useRef, useState, type ComponentProps } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRoutine } from "@/hooks/useRoutine";
import { NumField } from "@/components/TargetFields";
import { WeekdayPicker } from "@/components/WeekdayPicker";
import { MonthCalendar } from "@/components/MonthCalendar";
import { MODALITIES, modalityLabel } from "@/data/modalities";
import { getProgramWeeks } from "@/db/queries";
import type { Modality, RoutineSplit, SplitMode } from "@/types";

type MciName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const WD_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]; // getDay 0..6

const STEP_ICON_CIRCLE = {
  width: 60,
  height: 60,
  borderRadius: 30,
  backgroundColor: "#ebe7df",
  alignItems: "center" as const,
  justifyContent: "center" as const,
  marginBottom: 16,
};

type Step = "basics" | "days" | "plan" | "cyclicRest" | "cyclicStart" | "cyclicDays";
const CYCLIC_STEPS: Step[] = ["cyclicRest", "cyclicStart", "cyclicDays"];

export default function NewSplitScreen() {
  const r = useRoutine();
  const [step, setStep] = useState<Step>("basics");
  const [name, setName] = useState("");
  const [modality, setModality] = useState<Modality>("musculacao");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [planName, setPlanName] = useState("");
  const [totalWeeks, setTotalWeeks] = useState<number | null>(8);

  // Cyclic-split wizard: rest days → optional start date → the days that repeat.
  // Kept as local state (not persisted) until the wizard finishes, same as the
  // corrida weekly wizard above — abandoning it midway leaves nothing behind.
  const [cyclicRestDays, setCyclicRestDays] = useState<number[]>([]);
  const [cyclicAnchorDate, setCyclicAnchorDate] = useState<string | null>(null);
  const [cyclicMonth, setCyclicMonth] = useState(() => new Date());
  const [cyclicDayKeys, setCyclicDayKeys] = useState<number[]>([]);
  const nextCyclicDayKey = useRef(0);

  const chooseMode = (mode: SplitMode) => {
    // Fall back to the modality label so the button always creates a split
    // (the name is editable inline afterwards). Avoids a silent no-op on blank input.
    const finalName = name.trim() || modalityLabel(modality);
    setName(finalName);

    if (modality === "corrida" && mode === "weekly") {
      // Weekly corrida needs its training days chosen before the plan can be built.
      setStep("days");
      return;
    }

    if (mode === "cyclic") {
      setCyclicRestDays([]);
      setCyclicAnchorDate(null);
      setCyclicMonth(new Date());
      setCyclicDayKeys([]);
      setStep("cyclicRest");
      return;
    }

    // musculação/other + weekly: nothing else required up front.
    const splitId = r.addSplit(finalName, mode, modality);
    router.replace(`/routine/${splitId}`);
  };

  const toggleDay = (wd: number) => {
    setSelectedDays((prev) => (prev.includes(wd) ? prev.filter((d) => d !== wd) : [...prev, wd]));
  };

  const toggleCyclicRestDay = (wd: number) => {
    setCyclicRestDays((prev) => (prev.includes(wd) ? prev.filter((d) => d !== wd) : [...prev, wd]));
  };

  const createCyclicSplit = () => {
    const splitId = r.addSplit(name, "cyclic", modality);
    if (cyclicRestDays.length > 0) r.setRestWeekdays(splitId, cyclicRestDays);
    if (cyclicAnchorDate) r.setSplitAnchorDate(splitId, cyclicAnchorDate);
    // r.splits hasn't re-rendered with the new split yet — addUnit only needs these fields
    // (uuid is never read here; the real one lives in the row just inserted).
    const split: RoutineSplit = {
      id: splitId,
      name,
      mode: "cyclic",
      modality,
      anchor_date: cyclicAnchorDate,
      rest_weekdays: cyclicRestDays,
      order: 0,
      uuid: "",
    };
    for (let i = 0; i < cyclicDayKeys.length; i++) r.addUnit(split);

    if (modality === "corrida") {
      // Corrida still requires a plan — force its creation before continuing.
      router.replace({ pathname: "/routine/program/new", params: { splitId: String(splitId) } });
    } else {
      router.replace(`/routine/${splitId}`);
    }
  };

  const createWeeklyCorridaSplit = () => {
    const splitId = r.addSplit(name, "weekly", "corrida");
    // r.splits hasn't re-rendered with the new split yet — addUnit only needs these fields
    // (uuid is never read here; the real one lives in the row just inserted).
    const split: RoutineSplit = {
      id: splitId,
      name,
      mode: "weekly",
      modality: "corrida",
      anchor_date: null,
      rest_weekdays: [],
      order: 0,
      uuid: "",
    };
    for (const wd of selectedDays) {
      r.addUnit(split, { ordinal: wd, label: WD_SHORT[wd] });
    }
    const finalPlanName = planName.trim() || "Plano de Corrida";
    const weeks = totalWeeks && totalWeeks > 0 ? totalWeeks : 8;
    const programId = r.addProgram(splitId, finalPlanName, weeks);
    r.activateProgram(splitId, programId);

    // Walk the user through mapping each week's workouts before landing on the split screen.
    const weekIds = getProgramWeeks(programId).map((w) => w.id);
    router.replace({
      pathname: "/routine/program/week/[id]",
      params: {
        id: String(weekIds[0]),
        wizardWeekIds: weekIds.join(","),
        wizardIndex: "0",
        wizardSplitId: String(splitId),
      },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View style={{ flex: 1, width: "100%", maxWidth: 560, alignSelf: "center" }}>
        <View className="flex-row items-center px-4 py-3">
          <Text className="text-ink font-display font-semibold text-2xl flex-1" style={{ letterSpacing: -0.4 }}>
            {step === "basics" && "Novo Split"}
            {step === "days" && "Dias da semana"}
            {step === "plan" && "Novo Plano"}
            {step === "cyclicRest" && "Dias de descanso"}
            {step === "cyclicStart" && "Início do ciclo"}
            {step === "cyclicDays" && "Dias do ciclo"}
          </Text>
          <TouchableOpacity
            onPress={() => {
              if (step === "basics") router.back();
              else if (step === "days") setStep("basics");
              else if (step === "plan") setStep("days");
              else if (step === "cyclicRest") setStep("basics");
              else if (step === "cyclicStart") setStep("cyclicRest");
              else if (step === "cyclicDays") setStep("cyclicStart");
            }}
          >
            <Text className="text-ink-soft text-base">{step === "basics" ? "Cancelar" : "Voltar"}</Text>
          </TouchableOpacity>
        </View>

        {(step === "days" || step === "plan") && (
          <View className="flex-row px-4 mb-1" style={{ gap: 6 }}>
            <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: "#26241f" }} />
            <View
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                backgroundColor: step === "plan" ? "#26241f" : "#ddd8ce",
              }}
            />
          </View>
        )}

        {CYCLIC_STEPS.includes(step) && (
          <View className="flex-row px-4 mb-1" style={{ gap: 6 }}>
            {CYCLIC_STEPS.map((s, i) => (
              <View
                key={s}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: i <= CYCLIC_STEPS.indexOf(step) ? "#26241f" : "#ddd8ce",
                }}
              />
            ))}
          </View>
        )}

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          {step === "basics" && (
            <>
              <Text className="text-ink-mute text-xs mb-2" style={{ letterSpacing: 1, fontWeight: "700" }}>
                NOME
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="ex.: Musculação, Corrida"
                placeholderTextColor="#bdb8aa"
                className="bg-surface-elevated text-ink rounded-xl px-4 py-3 mb-6"
              />

              <Text className="text-ink-mute text-xs mb-2" style={{ letterSpacing: 1, fontWeight: "700" }}>
                MODALIDADE
              </Text>
              <View className="flex-row mb-6" style={{ gap: 10 }}>
                {MODALITIES.map((m) => {
                  const on = modality === m.key;
                  return (
                    <TouchableOpacity
                      key={m.key}
                      className="flex-1 items-center justify-center rounded-2xl"
                      style={{
                        paddingVertical: 18,
                        gap: 8,
                        borderWidth: 1,
                        borderColor: on ? "#26241f" : "#ddd8ce",
                        backgroundColor: on ? "#26241f" : "#ffffff",
                      }}
                      onPress={() => setModality(m.key)}
                      activeOpacity={0.85}
                    >
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: on ? "rgba(255,255,255,0.14)" : "#f4f2ee",
                        }}
                      >
                        <MaterialCommunityIcons
                          name={m.icon as MciName}
                          size={24}
                          color={on ? "#ffffff" : "#5c594f"}
                        />
                      </View>
                      <Text style={{ color: on ? "#ffffff" : "#5c594f", fontSize: 13, fontWeight: "600" }}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text className="text-ink-mute text-xs mb-2" style={{ letterSpacing: 1, fontWeight: "700" }}>
                FORMATO
              </Text>
              <View style={{ gap: 10 }}>
                <FormatOption
                  icon="autorenew"
                  label="Cíclico"
                  description="Repete em sequência, sem depender do dia da semana"
                  onPress={() => chooseMode("cyclic")}
                />
                <FormatOption
                  icon="calendar-week"
                  label="Semanal"
                  description="Um plano fixo para cada dia da semana"
                  onPress={() => chooseMode("weekly")}
                />
              </View>
            </>
          )}

          {step === "days" && (
            <View style={{ alignItems: "center" }}>
              <View style={STEP_ICON_CIRCLE}>
                <MaterialCommunityIcons name="calendar-week" size={26} color="#26241f" />
              </View>
              <Text className="text-ink font-display font-semibold text-xl mb-2" style={{ textAlign: "center" }}>
                Quando você corre?
              </Text>
              <Text
                className="text-ink-mute text-sm mb-7"
                style={{ textAlign: "center", maxWidth: 280 }}
              >
                Escolha os dias da semana. Você pode ajustar isso depois na tela do split.
              </Text>
              <WeekdayPicker selected={selectedDays} onToggle={toggleDay} size="large" />
              <Text className="text-ink-faint text-xs mt-5">
                {selectedDays.length === 0
                  ? "Nenhum dia selecionado"
                  : `${selectedDays.length} dia${selectedDays.length > 1 ? "s" : ""} por semana`}
              </Text>
              <TouchableOpacity
                className="mt-8 py-3 rounded-xl items-center bg-brand-500"
                style={{ opacity: selectedDays.length === 0 ? 0.4 : 1, width: "100%" }}
                disabled={selectedDays.length === 0}
                onPress={() => setStep("plan")}
              >
                <Text className="text-white text-sm font-semibold">Continuar</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === "plan" && (
            <View style={{ alignItems: "center" }}>
              <View style={STEP_ICON_CIRCLE}>
                <MaterialCommunityIcons name="notebook-outline" size={26} color="#26241f" />
              </View>
              <Text className="text-ink font-display font-semibold text-xl mb-2" style={{ textAlign: "center" }}>
                Monte o plano
              </Text>
              <Text
                className="text-ink-mute text-sm mb-7"
                style={{ textAlign: "center", maxWidth: 280 }}
              >
                Um split de corrida precisa de um plano com pelo menos uma semana definida.
              </Text>
              <TextInput
                value={planName}
                onChangeText={setPlanName}
                placeholder="Nome (ex.: Plano de Corrida)"
                placeholderTextColor="#bdb8aa"
                className="bg-surface-elevated text-ink rounded-xl px-4 py-3 mb-4"
                style={{ width: "100%" }}
              />
              <View className="flex-row items-center justify-center mb-7" style={{ gap: 10 }}>
                <Text className="text-ink-mute text-sm">Duração</Text>
                <NumField value={totalWeeks} onChange={setTotalWeeks} integer suffix="semanas" />
              </View>
              <TouchableOpacity
                className="py-3 rounded-xl items-center bg-brand-500"
                style={{ width: "100%" }}
                onPress={createWeeklyCorridaSplit}
              >
                <Text className="text-white text-sm font-semibold">Criar plano</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === "cyclicRest" && (
            <View style={{ alignItems: "center" }}>
              <View style={STEP_ICON_CIRCLE}>
                <MaterialCommunityIcons name="weather-night" size={26} color="#26241f" />
              </View>
              <Text className="text-ink font-display font-semibold text-xl mb-2" style={{ textAlign: "center" }}>
                Dias de descanso
              </Text>
              <Text className="text-ink-mute text-sm mb-7" style={{ textAlign: "center", maxWidth: 280 }}>
                Esses dias da semana não contam como treino no ciclo. Pode deixar em branco e ajustar depois.
              </Text>
              <WeekdayPicker selected={cyclicRestDays} onToggle={toggleCyclicRestDay} size="large" />
              <TouchableOpacity
                className="mt-8 py-3 rounded-xl items-center bg-brand-500"
                style={{ width: "100%" }}
                onPress={() => setStep("cyclicStart")}
              >
                <Text className="text-white text-sm font-semibold">Continuar</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === "cyclicStart" && (
            <View style={{ alignItems: "center" }}>
              <View style={STEP_ICON_CIRCLE}>
                <MaterialCommunityIcons name="calendar-blank-outline" size={26} color="#26241f" />
              </View>
              <Text className="text-ink font-display font-semibold text-xl mb-2" style={{ textAlign: "center" }}>
                Início do ciclo
              </Text>
              <Text className="text-ink-mute text-sm mb-6" style={{ textAlign: "center", maxWidth: 280 }}>
                Opcional. Se você já sabe quando o dia 1 do ciclo cai, escolha a data — dá pra definir isso depois também.
              </Text>
              <View style={{ width: "100%" }}>
                <MonthCalendar
                  monthDate={cyclicMonth}
                  onMonthChange={setCyclicMonth}
                  selectedDate={cyclicAnchorDate}
                  onSelectDate={setCyclicAnchorDate}
                />
              </View>
              <TouchableOpacity
                className="mt-6 py-3 rounded-xl items-center bg-brand-500"
                style={{ width: "100%" }}
                onPress={() => setStep("cyclicDays")}
              >
                <Text className="text-white text-sm font-semibold">
                  {cyclicAnchorDate ? "Continuar" : "Continuar sem definir"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {step === "cyclicDays" && (
            <View style={{ alignItems: "center" }}>
              <View style={STEP_ICON_CIRCLE}>
                <MaterialCommunityIcons name="repeat" size={26} color="#26241f" />
              </View>
              <Text className="text-ink font-display font-semibold text-xl mb-2" style={{ textAlign: "center" }}>
                Dias do ciclo
              </Text>
              <Text className="text-ink-mute text-sm mb-6" style={{ textAlign: "center", maxWidth: 280 }}>
                A sequência de treinos que se repete. Pode pular e adicionar (com os exercícios) depois, na tela do split.
              </Text>

              {cyclicDayKeys.length > 0 && (
                <View style={{ width: "100%", gap: 8, marginBottom: 12 }}>
                  {cyclicDayKeys.map((key, i) => (
                    <View
                      key={key}
                      className="flex-row items-center justify-between px-4 py-3 rounded-2xl"
                      style={{ borderWidth: 1, borderColor: "#ddd8ce" }}
                    >
                      <Text className="text-ink text-sm font-medium">Dia {i + 1}</Text>
                      <TouchableOpacity onPress={() => setCyclicDayKeys((prev) => prev.filter((k) => k !== key))}>
                        <MaterialCommunityIcons name="trash-can-outline" size={18} color="#dc2626" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                className="py-3 rounded-xl items-center mb-6"
                style={{ width: "100%", borderWidth: 1, borderColor: "#c9c3b6", borderStyle: "dashed" }}
                onPress={() => setCyclicDayKeys((prev) => [...prev, nextCyclicDayKey.current++])}
              >
                <Text className="text-ink text-sm font-medium">+ Adicionar dia</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="py-3 rounded-xl items-center bg-brand-500"
                style={{ width: "100%" }}
                onPress={createCyclicSplit}
              >
                <Text className="text-white text-sm font-semibold">
                  {cyclicDayKeys.length > 0 ? "Concluir" : "Concluir sem dias"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function FormatOption({
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
