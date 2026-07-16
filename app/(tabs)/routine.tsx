import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState, type ComponentProps } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { RoutineCalendar } from "@/components/RoutineCalendar";
import { DayDetailModal } from "@/components/DayDetailModal";
import { useRoutine } from "@/hooks/useRoutine";
import { modalityConfig, modalityLabel } from "@/data/modalities";

type MciName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export default function RoutineScreen() {
  const r = useRoutine();
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      r.refreshAll();
    }, [r.refreshAll])
  );

  const summary =
    r.splits.length === 0 ? "Nenhum split" : `${r.splits.length} split${r.splits.length !== 1 ? "s" : ""}`;
  const schedule = selectedDate ? r.scheduleForDate(selectedDate) : null;

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <View className="px-4 pt-3 pb-4 flex-row items-start">
          <View className="flex-1">
            <Text style={{ color: "#928d80", fontSize: 10, fontWeight: "700", letterSpacing: 2, marginBottom: 2 }}>
              TRAINING SPLIT
            </Text>
            <Text className="text-ink font-display font-semibold text-3xl" style={{ letterSpacing: -0.6 }}>
              Minha Rotina
            </Text>
            <Text className="text-ink-mute text-xs mt-0.5">{summary}</Text>
          </View>
          <TouchableOpacity
            className="px-3 py-2 rounded-xl bg-brand-500"
            onPress={() => router.push("/routine/new-split")}
          >
            <Text className="text-white text-sm font-medium">+ Novo split</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 1, backgroundColor: "#ddd8ce", marginHorizontal: 16, marginBottom: 16 }} />

        {r.splits.length === 0 ? (
          <View className="items-center justify-center px-8" style={{ paddingTop: 60 }}>
            <Text className="text-ink-soft text-base font-medium text-center">Monte seus splits</Text>
            <Text className="text-ink-mute text-sm mt-1 text-center">
              Crie splits cíclicos (rodízio) ou semanais (dias fixos) e veja tudo no calendário.
            </Text>
            <TouchableOpacity
              className="mt-4 px-4 py-2.5 rounded-xl bg-brand-500"
              onPress={() => router.push("/routine/new-split")}
            >
              <Text className="text-white text-sm font-medium">+ Criar split</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View className="px-4 mb-4" style={{ gap: 8 }}>
              {r.splits.map((split) => (
                <TouchableOpacity
                  key={split.id}
                  className="flex-row items-center px-4 py-3 rounded-2xl"
                  style={{ borderWidth: 1, borderColor: "#ddd8ce" }}
                  onPress={() => router.push(`/routine/${split.id}`)}
                  activeOpacity={0.7}
                >
                  <View
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 15,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#ebe7df",
                      marginRight: 10,
                    }}
                  >
                    <MaterialCommunityIcons
                      name={modalityConfig(split.modality).icon as MciName}
                      size={15}
                      color="#5c594f"
                    />
                  </View>
                  <Text className="text-ink font-medium text-sm flex-1">{split.name}</Text>
                  <Text className="text-ink-mute text-xs">
                    {modalityLabel(split.modality)} · {split.mode === "cyclic" ? "Cíclico" : "Semanal"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <RoutineCalendar
              monthDate={monthDate}
              scheduleForDate={r.scheduleForDate}
              onPrevMonth={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}
              onNextMonth={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}
              onSelectDate={(iso) => setSelectedDate(iso)}
            />
          </>
        )}
      </ScrollView>

      <DayDetailModal
        dateISO={selectedDate}
        schedule={schedule}
        exercisesByUnit={r.exercisesByUnit}
        onClose={() => setSelectedDate(null)}
        onRenameUnit={r.renameUnit}
        onAddExercise={r.addExercise}
        onRemoveExercise={r.removeExercise}
        onUpdateTargets={r.updateExerciseTargets}
        onReorderExercises={r.reorderExercises}
        onSetOverride={r.markOverride}
        onClearOverride={r.clearOverrideMark}
      />
    </SafeAreaView>
  );
}
