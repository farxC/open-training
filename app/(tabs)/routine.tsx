import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { RoutineCalendar } from "@/components/RoutineCalendar";
import { DayDetailModal } from "@/components/DayDetailModal";
import { ActionButton } from "@/components/ui/ActionButton";
import { Button } from "@/components/ui/button";
import { useRoutine } from "@/hooks/useRoutine";
import { modalityLabel } from "@/data/modalities";
import { todayISO } from "@/utils/cycle";
import colors from "@/theme/palette.json";

export default function RoutineScreen() {
  const routine = useRoutine();
  const { refreshAll } = routine;
  const { width } = useWindowDimensions();
  const desktop = width >= 960;
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      refreshAll();
    }, [refreshAll]),
  );
  const schedule = routine.scheduleForDate(selectedDate);
  const workouts = schedule.planned.filter(
    (entry) => entry.status === "workout" && entry.unit,
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.paper }}
      edges={["top"]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        <View style={styles.heading}>
          <Text className="font-display" style={styles.title}>
            Rotina
          </Text>
          <ActionButton
            label="Novo split"
            icon="plus"
            onPress={() => router.push("/routine/new-split")}
          />
        </View>
        <View style={{ flexDirection: desktop ? "row" : "column", gap: 24 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <RoutineCalendar
              monthDate={monthDate}
              selectedDate={selectedDate}
              scheduleForDate={routine.scheduleForDate}
              onPrevMonth={() =>
                setMonthDate(
                  new Date(
                    monthDate.getFullYear(),
                    monthDate.getMonth() - 1,
                    1,
                  ),
                )
              }
              onNextMonth={() =>
                setMonthDate(
                  new Date(
                    monthDate.getFullYear(),
                    monthDate.getMonth() + 1,
                    1,
                  ),
                )
              }
              onSelectDate={setSelectedDate}
            />
          </View>
          <View style={desktop ? { width: 290, gap: 20 } : { gap: 20 }}>
            <View style={styles.selectedDay}>
              <Text className="font-sans" style={styles.label}>
                {selectedDate === todayISO()
                  ? "HOJE"
                  : selectedDate.split("-").reverse().join("/")}
              </Text>
              {workouts.length > 0 ? (
                workouts.map((entry) => (
                  <View key={entry.split.id} style={{ marginTop: 12 }}>
                    <Text
                      className="font-display"
                      style={{ color: colors.ink, fontSize: 24 }}
                    >
                      {entry.unit!.label}
                    </Text>
                    <Text
                      className="font-sans"
                      style={[styles.caption, { marginTop: 6 }]}
                    >
                      {(routine.exercisesByUnit[entry.unit!.id] ?? []).length}{" "}
                      exercícios · {entry.split.name}
                    </Text>
                  </View>
                ))
              ) : (
                <Text
                  className="font-sans"
                  style={{ color: colors.ink, fontSize: 16, marginTop: 12 }}
                >
                  Nenhum treino previsto
                </Text>
              )}
              {schedule.override && (
                <Text
                  className="font-sans"
                  style={[
                    styles.caption,
                    {
                      marginTop: 12,
                      color:
                        schedule.override === "trained"
                          ? colors.success
                          : colors.secondary,
                    },
                  ]}
                >
                  {schedule.override === "trained"
                    ? "Treino realizado"
                    : "Descanso registrado"}
                </Text>
              )}
              <View style={{ marginTop: 18 }}>
                <ActionButton
                  label="Ver e editar dia"
                  variant="secondary"
                  icon="calendar-edit"
                  onPress={() => setEditingDate(selectedDate)}
                />
              </View>
            </View>
            <View style={styles.panel}>
              <Text className="font-sans" style={styles.label}>
                SEUS SPLITS
              </Text>
              {routine.splits.length === 0 ? (
                <View style={{ gap: 12, marginTop: 14 }}>
                  <Text className="font-sans" style={styles.caption}>
                    Crie um split para organizar os treinos no calendário.
                  </Text>
                  <ActionButton
                    label="Criar split"
                    icon="plus"
                    onPress={() => router.push("/routine/new-split")}
                  />
                </View>
              ) : (
                routine.splits.map((split) => (
                  <Button
                    key={split.id}
                    accessibilityLabel={`Editar split ${split.name}`}
                    onPress={() => router.push(`/routine/${split.id}`)}
                    className="flex-col items-start"
                    style={{
                      paddingVertical: 16,
                      alignItems: "flex-start",
                      borderBottomWidth: 1,
                      borderColor: colors.line,
                    }}
                  >
                    <Text
                      className="font-sans"
                      style={{
                        color: colors.ink,
                        fontSize: 14,
                        fontWeight: "600",
                      }}
                    >
                      {split.name}
                    </Text>
                    <Text
                      className="font-sans"
                      style={[styles.caption, { marginTop: 5 }]}
                    >
                      {modalityLabel(split.modality)} ·{" "}
                      {split.mode === "cyclic" ? "Cíclico" : "Semanal"}
                    </Text>
                  </Button>
                ))
              )}
            </View>
          </View>
        </View>
      </ScrollView>
      <DayDetailModal
        dateISO={editingDate}
        schedule={editingDate ? routine.scheduleForDate(editingDate) : null}
        exercisesByUnit={routine.exercisesByUnit}
        onClose={() => setEditingDate(null)}
        onRenameUnit={routine.renameUnit}
        onAddExercise={routine.addExercise}
        onRemoveExercise={routine.removeExercise}
        onUpdateTargets={routine.updateExerciseTargets}
        onReorderExercises={routine.reorderExercises}
        onSetOverride={routine.markOverride}
        onClearOverride={routine.clearOverrideMark}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  heading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },
  title: { fontSize: 32, color: colors.ink, letterSpacing: -1 },
  label: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
  },
  caption: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  selectedDay: {
    backgroundColor: colors.sidebar,
    borderRadius: 12,
    padding: 22,
  },
  panel: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 22,
  },
});
