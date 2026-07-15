import { useRef, useState, type ComponentProps } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { UnitCard } from "@/components/UnitCard";
import { RunPlanTable } from "@/components/RunPlanTable";
import { StrengthPlanTable } from "@/components/StrengthPlanTable";
import { WeekdayPicker } from "@/components/WeekdayPicker";
import { ExercisePickerModal } from "@/components/ExercisePickerModal";
import { DatePickerModal } from "@/components/DatePickerModal";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useRoutine } from "@/hooks/useRoutine";
import { modalityConfig, modalityLabel } from "@/data/modalities";
import { confirmAction } from "@/components/AppModal";
import { getProgramWeeks } from "@/db/queries";
import { todayISO, weekIndexSince } from "@/utils/cycle";
import type { RoutineUnit, TrainingProgram } from "@/types";

type MciName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const WD_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]; // getDay 0..6
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun
const MONTHS_LONG = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function formatLongDate(dateISO: string): string {
  const d = new Date(dateISO + "T00:00:00");
  return `${d.getDate()} de ${MONTHS_LONG[d.getMonth()]} de ${d.getFullYear()}`;
}

export default function EditSplitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const r = useRoutine();
  const [expandedUnitId, setExpandedUnitId] = useState<number | null>(null);
  const [pickerUnitId, setPickerUnitId] = useState<number | null>(null);
  const [anchorPickerOpen, setAnchorPickerOpen] = useState(false);
  const [plansExpanded, setPlansExpanded] = useState(false);
  const nameInputRef = useRef<TextInput>(null);

  const split = r.splits.find((s) => s.id === Number(id));

  if (!split) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title="Split" fallbackHref="/routine" />
        <View className="flex-1 items-center justify-center">
          <Text className="text-ink-mute">Split not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const units = r.unitsBySplit[split.id] ?? [];
  const programs = r.programsBySplit[split.id] ?? [];
  const activeProgram = programs.find((p) => p.is_active);
  // Progression plans are a secondary, opt-in concept for cyclic non-corrida splits
  // (corrida always requires one) — tucked behind a disclosure so they don't compete
  // with the day-to-day structure above for attention.
  const plansAreOptionalHere = split.mode === "cyclic" && split.modality !== "corrida";

  const toggleRest = (wd: number) => {
    const next = split.rest_weekdays.includes(wd)
      ? split.rest_weekdays.filter((d) => d !== wd)
      : [...split.rest_weekdays, wd];
    r.setRestWeekdays(split.id, next);
  };

  const confirmRemoveUnit = (unitId: number) => {
    confirmAction("Excluir dia?", "Este dia e seus exercícios serão removidos.", "Excluir", () =>
      r.removeUnit(unitId)
    );
  };

  const confirmRemoveSplit = () => {
    confirmAction(
      "Excluir split?",
      "Todos os dias e exercícios deste split serão removidos.",
      "Excluir",
      () => {
        r.removeSplit(split.id);
        router.back();
      }
    );
  };

  const programWeekLabel = (program: TrainingProgram) => {
    if (program.is_active && program.started_at) {
      const elapsed = weekIndexSince(program.started_at, todayISO());
      if (elapsed >= 0 && elapsed < program.total_weeks) {
        return `Semana ${elapsed + 1} de ${program.total_weeks}`;
      }
    }
    return `${program.total_weeks} semanas`;
  };

  const resumeSetup = (program: TrainingProgram) => {
    const weeks = getProgramWeeks(program.id);
    const startIndex = Math.max(0, weeks.findIndex((w) => w.week_number === program.setup_week_number));
    const weekIds = weeks.map((w) => w.id);
    router.push({
      pathname: "/routine/program/week/[id]",
      params: {
        id: String(weekIds[startIndex]),
        wizardWeekIds: weekIds.join(","),
        wizardIndex: String(startIndex),
        wizardSplitId: String(split.id),
      },
    });
  };

  const unitCardProps = (unit: RoutineUnit, badge: string) => ({
    unit,
    exercises: r.exercisesByUnit[unit.id] ?? [],
    modality: split.modality,
    expanded: expandedUnitId === unit.id,
    onToggleExpand: () => setExpandedUnitId(expandedUnitId === unit.id ? null : unit.id),
    onRename: (label: string) => r.renameUnit(unit.id, label),
    onAddExercise: () => setPickerUnitId(unit.id),
    onRemoveExercise: r.removeExercise,
    onUpdateTargets: r.updateExerciseTargets,
    badge,
    onDelete: () => confirmRemoveUnit(unit.id),
  });

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader
        fallbackHref="/routine"
        titleNode={
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => nameInputRef.current?.focus()}
            className="flex-row items-center"
            style={{ gap: 6 }}
          >
            <TextInput
              ref={nameInputRef}
              value={split.name}
              onChangeText={(v) => r.renameSplit(split.id, v)}
              placeholder="Nome do split"
              placeholderTextColor="#bdb8aa"
              className="text-ink font-display font-semibold text-2xl"
              style={{ width: 210, flexShrink: 1 }}
            />
            <MaterialCommunityIcons name="pencil-outline" size={15} color="#928d80" style={{ flexShrink: 0 }} />
          </TouchableOpacity>
        }
        right={
          <TouchableOpacity onPress={confirmRemoveSplit} className="p-1">
            <MaterialCommunityIcons name="trash-can-outline" size={20} color="#dc2626" />
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <View
          className="flex-row items-center self-start px-2 py-1 rounded-full mb-5"
          style={{ backgroundColor: "#ebe7df", gap: 4 }}
        >
          <MaterialCommunityIcons
            name={modalityConfig(split.modality).icon as MciName}
            size={13}
            color="#5c594f"
          />
          <Text className="text-ink-mute text-xs">
            {modalityLabel(split.modality)} · {split.mode === "cyclic" ? "Cíclico" : "Semanal"}
          </Text>
        </View>

        {/* ── ESTRUTURA: the fixed shape of training days — what you actually do ── */}
        <Text className="text-ink-mute text-xs mb-1" style={{ letterSpacing: 1, fontWeight: "700" }}>
          ESTRUTURA
        </Text>
        <Text className="text-ink-faint text-xs mb-3">
          Os exercícios fixos de cada dia. Os planos, mais abaixo, ajustam esses alvos semana a semana.
        </Text>

        {split.mode === "cyclic" ? (
          <>
            <Text className="text-ink-soft text-xs font-semibold mb-2">Dias do ciclo</Text>
            {split.modality === "corrida" ? (
              <RunPlanTable
                units={units}
                exercisesByUnit={r.exercisesByUnit}
                expandedUnitId={expandedUnitId}
                onToggleExpand={(uid) => setExpandedUnitId(expandedUnitId === uid ? null : uid)}
                onRename={(uid, label) => r.renameUnit(uid, label)}
                onUpdateTargets={r.updateExerciseTargets}
                onMoveUp={(uid) => r.reorderUnit(uid, "up")}
                onMoveDown={(uid) => r.reorderUnit(uid, "down")}
                onDelete={confirmRemoveUnit}
              />
            ) : (
              <StrengthPlanTable
                units={units}
                exercisesByUnit={r.exercisesByUnit}
                expandedUnitId={expandedUnitId}
                onToggleExpand={(uid) => setExpandedUnitId(expandedUnitId === uid ? null : uid)}
                onRename={(uid, label) => r.renameUnit(uid, label)}
                onAddExercise={(uid) => setPickerUnitId(uid)}
                onRemoveExercise={r.removeExercise}
                onUpdateTargets={r.updateExerciseTargets}
                onMoveUp={(uid) => r.reorderUnit(uid, "up")}
                onMoveDown={(uid) => r.reorderUnit(uid, "down")}
                onDelete={confirmRemoveUnit}
              />
            )}

            <TouchableOpacity
              className="py-3 rounded-xl items-center mb-6"
              style={{ borderWidth: 1, borderColor: "#c9c3b6", borderStyle: "dashed" }}
              onPress={() => r.addUnit(split)}
            >
              <Text className="text-ink text-sm font-medium">+ Adicionar dia ao ciclo</Text>
            </TouchableOpacity>

            <Text className="text-ink-soft text-xs font-semibold mb-1">Agenda do ciclo</Text>
            <Text className="text-ink-faint text-xs mb-2">
              Quando o ciclo roda no calendário — dias fixos de descanso e a data em que o dia 1 cai.
            </Text>
            <View className="mb-3">
              <WeekdayPicker selected={split.rest_weekdays} onToggle={toggleRest} />
            </View>

            <View className="flex-row items-center mb-6" style={{ gap: 6 }}>
              <MaterialCommunityIcons name="information-outline" size={14} color="#928d80" />
              <Text className="text-ink-mute text-xs flex-1">
                {split.anchor_date
                  ? `Dia 1 do ciclo: ${formatLongDate(split.anchor_date)}`
                  : "Dia 1 do ciclo ainda não definido"}
              </Text>
              <TouchableOpacity onPress={() => setAnchorPickerOpen(true)}>
                <Text className="text-ink-soft text-xs font-semibold" style={{ textDecorationLine: "underline" }}>
                  {split.anchor_date ? "Alterar" : "Definir"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View className="mb-6">
            {WEEK_ORDER.map((wd) => {
              const unit = units.find((u) => u.ordinal === wd);
              if (unit) {
                return <UnitCard key={unit.id} {...unitCardProps(unit, WD_SHORT[wd])} />;
              }
              return (
                <View
                  key={`wd-${wd}`}
                  className="flex-row items-center justify-between mb-3 px-4 py-3 rounded-2xl"
                  style={{ borderWidth: 1, borderColor: "#ddd8ce", borderStyle: "dashed" }}
                >
                  <Text className="text-ink-mute text-sm">{WD_SHORT[wd]} · livre</Text>
                  <TouchableOpacity
                    onPress={() => r.addUnit(split, { ordinal: wd, label: split.name })}
                  >
                    <Text className="text-ink text-sm font-medium">+ Adicionar</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 1, backgroundColor: "#ddd8ce", marginBottom: plansAreOptionalHere ? 12 : 20 }} />

        {/* ── PLANOS: optional week-by-week progression layered on top of the structure above ── */}
        {plansAreOptionalHere ? (
          <TouchableOpacity
            className="flex-row items-center justify-between py-2 mb-1"
            onPress={() => setPlansExpanded((v) => !v)}
            activeOpacity={0.7}
          >
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <MaterialCommunityIcons
                name={plansExpanded ? "chevron-down" : "chevron-right"}
                size={16}
                color="#928d80"
              />
              <Text className="text-ink-mute text-xs font-semibold">Planos de progressão</Text>
            </View>
            <Text className="text-ink-faint text-xs">
              {activeProgram
                ? `Ativo · ${programWeekLabel(activeProgram)}`
                : programs.length > 0
                  ? `${programs.length}`
                  : "Opcional"}
            </Text>
          </TouchableOpacity>
        ) : (
          <>
            <Text className="text-ink-mute text-xs mb-1" style={{ letterSpacing: 1, fontWeight: "700" }}>
              PLANOS DE PROGRESSÃO
            </Text>
            <Text className="text-ink-faint text-xs mb-3">
              Blocos com duração definida que ajustam os alvos de cada dia ao longo das semanas.
            </Text>
          </>
        )}

        {(!plansAreOptionalHere || plansExpanded) && (
          <>
            {plansAreOptionalHere && (
              <Text className="text-ink-faint text-xs mb-3">
                Blocos com duração definida que ajustam os alvos de cada dia ao longo das semanas.
              </Text>
            )}
            {programs.length === 0 && split.modality === "corrida" && (
              <View
                className="rounded-2xl p-4 mb-3"
                style={{ borderWidth: 1, borderColor: "#c9502b", backgroundColor: "#fbe9e2" }}
              >
                <Text className="text-sm font-medium mb-2" style={{ color: "#8a3319" }}>
                  Este split de corrida precisa de um plano.
                </Text>
                <TouchableOpacity
                  className="self-start px-3 py-2 rounded-xl"
                  style={{ backgroundColor: "#8a3319" }}
                  onPress={() => router.push({ pathname: "/routine/program/new", params: { splitId: String(split.id) } })}
                >
                  <Text className="text-white text-sm font-medium">Criar plano</Text>
                </TouchableOpacity>
              </View>
            )}
            {programs.map((program) => (
              <View
                key={program.id}
                className="mb-2 px-4 py-3 rounded-2xl"
                style={{
                  borderWidth: program.is_active ? 1.5 : 1,
                  borderColor: program.is_active ? "#26241f" : "#ddd8ce",
                }}
              >
                <TouchableOpacity
                  className="flex-row items-center justify-between"
                  onPress={() => router.push(`/routine/program/${program.id}`)}
                  activeOpacity={0.7}
                >
                  <View className="flex-1" style={{ gap: 3 }}>
                    <View className="flex-row items-center" style={{ gap: 6 }}>
                      <Text className="text-ink text-sm font-medium">{program.name}</Text>
                      {program.is_active && (
                        <View className="flex-row items-center px-2 py-0.5 rounded-full" style={{ backgroundColor: "#e3efe8", gap: 4 }}>
                          <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#2f9e6e" }} />
                          <Text style={{ color: "#227a54", fontSize: 10, fontWeight: "700" }}>Ativo</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-ink-mute text-xs">{programWeekLabel(program)}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#bdb8aa" />
                </TouchableOpacity>
                {program.setup_week_number != null && (
                  <TouchableOpacity
                    className="mt-2 self-start px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: "#ebe7df" }}
                    onPress={() => resumeSetup(program)}
                  >
                    <Text className="text-ink-mute text-xs font-medium">
                      Continuar mapeamento · Semana {program.setup_week_number}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {programs.length === 0 && split.modality !== "corrida" && (
              <Text className="text-ink-faint text-sm mb-2">Nenhum plano ainda.</Text>
            )}
            <TouchableOpacity
              className="mb-2 py-2.5 rounded-xl items-center"
              style={{ borderWidth: 1, borderColor: "#c9c3b6", borderStyle: "dashed" }}
              onPress={() => router.push({ pathname: "/routine/program/new", params: { splitId: String(split.id) } })}
            >
              <Text className="text-ink text-sm font-medium">+ Novo plano</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <ExercisePickerModal
        visible={pickerUnitId != null}
        modality="musculacao"
        onConfirm={(exs) => {
          if (pickerUnitId != null) exs.forEach((ex) => r.addExercise(pickerUnitId, ex));
        }}
        onClose={() => setPickerUnitId(null)}
      />

      <DatePickerModal
        visible={anchorPickerOpen}
        title="Dia 1 do ciclo"
        selectedDate={split.anchor_date}
        onSelect={(dateISO) => {
          r.setSplitAnchorDate(split.id, dateISO);
          setAnchorPickerOpen(false);
        }}
        onClose={() => setAnchorPickerOpen(false)}
      />
    </SafeAreaView>
  );
}
