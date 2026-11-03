import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { SessionCard } from "@/components/SessionCard";
import {
  ActionButton,
  FilterChip,
  IconButton,
} from "@/components/ui/ActionButton";
import { Button } from "@/components/ui/button";
import { useSessions } from "@/hooks/useSessions";
import { useRoutine } from "@/hooks/useRoutine";
import { useRecorderContext } from "@/context/SessionRecorderContext";
import { MODALITIES } from "@/data/modalities";
import { todayISO } from "@/utils/cycle";
import colors from "@/theme/palette.json";
import type { Modality, SessionSummary } from "@/types";

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export default function FeedScreen() {
  const { width } = useWindowDimensions();
  const { sessions, refresh } = useSessions();
  const routine = useRoutine();
  const { refreshAll } = routine;
  const { state: recorder } = useRecorderContext();
  const [filter, setFilter] = useState<Modality | null>(null);
  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshAll();
    }, [refresh, refreshAll]),
  );

  const visible = filter
    ? sessions.filter((session) => session.modality === filter)
    : sessions;
  const available = MODALITIES.filter((modality) =>
    sessions.some((session) => session.modality === modality.key),
  );
  const schedule = routine.scheduleForDate(todayISO());
  const planned =
    schedule.override === "rest"
      ? []
      : schedule.planned.filter(
          (entry) => entry.status === "workout" && entry.unit,
        );
  const today = planned[0];
  const recording = recorder.isRecording;
  const start = () => router.push("/session/new");

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text
            accessibilityRole="header"
            className="font-display"
            style={[styles.title, width < 360 && { fontSize: 28 }]}
          >
            Histórico
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
            <IconButton
              label="Configurações"
              icon="cog-outline"
              onPress={() => router.push("/settings")}
            />
            <ActionButton
              label={recording ? "Continuar" : "Registrar"}
              icon={recording ? "play-outline" : "plus"}
              onPress={start}
            />
          </View>
        </View>

        <FlatList<SessionSummary>
          data={visible}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
          ListHeaderComponent={
            <>
              {(recording || today) && (
                <Button
                  accessibilityLabel={
                    recording
                      ? "Continuar treino em andamento"
                      : `Iniciar treino de hoje: ${today.unit!.label}`
                  }
                  onPress={
                    recording
                      ? start
                      : () =>
                          router.push({
                            pathname: "/session/new",
                            params: { splitId: String(today.split.id) },
                          })
                  }
                  className="justify-start"
                  style={styles.today}
                >
                  <MaterialCommunityIcons
                    name={recording ? "timer-outline" : "dumbbell"}
                    size={22}
                    color={colors.primary}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      className="font-sans"
                      style={styles.todayTitle}
                      numberOfLines={1}
                    >
                      {recording
                        ? "Treino em andamento"
                        : `Hoje · ${today.unit!.label}`}
                    </Text>
                    <Text
                      className="font-sans"
                      style={styles.caption}
                      numberOfLines={1}
                    >
                      {recording
                        ? `${recorder.selectedExercises.length} exercícios`
                        : `${(routine.exercisesByUnit[today.unit!.id] ?? []).length} exercícios · ${today.split.name}${planned.length > 1 ? ` · +${planned.length - 1} treinos hoje` : ""}`}
                    </Text>
                  </View>
                  <Text className="font-sans" style={styles.todayAction}>
                    {recording ? "Continuar" : "Iniciar"}
                  </Text>
                  <MaterialCommunityIcons
                    name="arrow-right"
                    size={18}
                    color={colors.primary}
                  />
                </Button>
              )}
              {sessions.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filters}
                >
                  <FilterChip
                    label="Todos"
                    active={filter === null}
                    onPress={() => setFilter(null)}
                  />
                  {available.map((modality) => (
                    <FilterChip
                      key={modality.key}
                      label={modality.label}
                      active={filter === modality.key}
                      onPress={() => setFilter(modality.key)}
                    />
                  ))}
                </ScrollView>
              )}
            </>
          }
          renderItem={({ item, index }) => {
            const month = item.date.slice(0, 7);
            const newMonth =
              index === 0 || visible[index - 1].date.slice(0, 7) !== month;
            const unit =
              item.split_id == null
                ? undefined
                : routine.unitsBySplit[item.split_id]?.find(
                    (entry) => entry.id === item.unit_id,
                  );
            return (
              <>
                {newMonth && (
                  <View style={styles.monthHeader}>
                    <Text className="font-sans" style={styles.month}>
                      {MONTHS[Number(item.date.slice(5, 7)) - 1].toUpperCase()}{" "}
                      {item.date.slice(0, 4)}
                    </Text>
                    <Text className="font-sans" style={styles.caption}>
                      {
                        visible.filter((session) =>
                          session.date.startsWith(month),
                        ).length
                      }{" "}
                      sessões
                    </Text>
                  </View>
                )}
                <SessionCard
                  session={item}
                  title={unit?.label}
                  onPress={() => router.push(`/session/${item.id}`)}
                />
              </>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons
                name="notebook-outline"
                size={32}
                color={colors.muted}
              />
              <Text
                className="font-display"
                style={{ color: colors.ink, fontSize: 24, marginTop: 16 }}
              >
                Nenhum treino registrado
              </Text>
              <Text
                className="font-sans"
                style={[styles.caption, { marginTop: 8, marginBottom: 20 }]}
              >
                Seu histórico aparece aqui depois do primeiro treino.
              </Text>
              <ActionButton
                label="Registrar treino"
                icon="plus"
                onPress={start}
              />
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: {
    flex: 1,
    width: "100%",
    maxWidth: 920,
    alignSelf: "center",
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingTop: 14,
    paddingBottom: 20,
  },
  title: { fontSize: 32, letterSpacing: -1, color: colors.ink },
  today: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.sidebar,
    borderRadius: 8,
    marginBottom: 20,
  },
  todayTitle: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 3,
  },
  todayAction: { color: colors.primary, fontSize: 12, fontWeight: "600" },
  caption: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  filters: { gap: 8, paddingBottom: 20 },
  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 12,
  },
  month: {
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: "700",
    color: colors.muted,
  },
  empty: { alignItems: "center", paddingTop: 70, paddingHorizontal: 12 },
});
