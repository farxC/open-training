import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/ActionButton";
import colors from "@/theme/palette.json";
import type { DayScheduleEntry } from "@/hooks/useRoutine";
import type { OverrideStatus, RoutineUnit } from "@/types";

interface Props {
  monthDate: Date;
  selectedDate?: string;
  scheduleForDate: (iso: string) => {
    planned: DayScheduleEntry[];
    override: OverrideStatus | null;
  };
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (iso: string) => void;
}
const WEEKDAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
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
const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
function shortLabel(unit: RoutineUnit) {
  return (
    unit.label.match(/^([A-Z])(?:\b|\s*[·:–-])/i)?.[1].toUpperCase() ??
    String(unit.ordinal + 1)
  );
}

export function RoutineCalendar({
  monthDate,
  selectedDate,
  scheduleForDate,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
}: Props) {
  const { width } = useWindowDimensions();
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const leading = (new Date(year, month, 1).getDay() + 6) % 7;
  const length = new Date(year, month + 1, 0).getDate();
  const today = iso(new Date());
  const cells = Array.from(
    { length: Math.ceil((leading + length) / 7) * 7 },
    (_, index) =>
      index < leading || index >= leading + length ? null : index - leading + 1,
  );
  const legend = new Map<number, RoutineUnit>();
  const days = new Map<number, ReturnType<Props["scheduleForDate"]>>();
  for (let day = 1; day <= length; day++) {
    const schedule = scheduleForDate(iso(new Date(year, month, day)));
    days.set(day, schedule);
    schedule.planned.forEach((entry) => {
      if (entry.unit) legend.set(entry.unit.id, entry.unit);
    });
  }
  return (
    <View style={styles.panel}>
      <View style={styles.heading}>
        <Text
          className="font-display"
          style={[styles.month, width < 360 && { fontSize: 20 }]}
        >
          {MONTHS[month]}{" "}
          <Text className="font-sans" style={{ color: colors.muted }}>
            {year}
          </Text>
        </Text>
        <View style={{ flexDirection: "row" }}>
          <IconButton
            label="Mês anterior"
            icon="chevron-left"
            onPress={onPrevMonth}
          />
          <IconButton
            label="Próximo mês"
            icon="chevron-right"
            onPress={onNextMonth}
          />
        </View>
      </View>
      <View style={styles.grid}>
        {WEEKDAYS.map((day) => (
          <View key={day} style={styles.slot}>
            <Text className="font-sans" style={styles.weekday}>
              {day}
            </Text>
          </View>
        ))}
        {cells.map((day, index) => {
          if (day == null)
            return <View key={`empty${index}`} style={styles.slot} />;
          const date = iso(new Date(year, month, day));
          const schedule = days.get(day)!;
          const workouts = schedule.planned.filter(
            (entry) => entry.status === "workout" && entry.unit,
          );
          const selected = selectedDate === date;
          const isToday = today === date;
          const foreground = selected ? colors.white : colors.ink;
          const labels =
            workouts.map((entry) => entry.unit!.label).join(", ") || "Descanso";
          return (
            <View key={date} style={styles.slot}>
              <Button
                accessibilityLabel={`${day} de ${MONTHS[month]}: ${labels}${schedule.override === "trained" ? ", treino realizado" : ""}`}
                accessibilityState={{ selected }}
                onPress={() => onSelectDate(date)}
                className="flex-col"
                style={[
                  styles.day,
                  {
                    backgroundColor: selected ? colors.primary : colors.paper,
                    borderColor:
                      isToday && !selected ? colors.primary : "transparent",
                  },
                ]}
              >
                <Text
                  className="font-sans"
                  style={{
                    color: foreground,
                    fontSize: 14,
                    fontWeight: isToday ? "700" : "500",
                  }}
                >
                  {day}
                </Text>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
                >
                  <Text
                    className="font-sans"
                    style={{
                      fontSize: 11,
                      fontWeight: "600",
                      color: selected ? colors.white : colors.muted,
                    }}
                  >
                    {workouts
                      .slice(0, 2)
                      .map((entry) => shortLabel(entry.unit!))
                      .join("·") || "—"}
                    {workouts.length > 2 ? "+" : ""}
                  </Text>
                  {schedule.override === "trained" && (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={10}
                      color={selected ? colors.white : colors.success}
                    />
                  )}
                  {schedule.override === "rest" && (
                    <View
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: selected
                          ? colors.white
                          : colors.secondary,
                      }}
                    />
                  )}
                </View>
              </Button>
            </View>
          );
        })}
      </View>
      {legend.size > 0 && (
        <View style={styles.legend}>
          {Array.from(legend.values()).map((unit) => (
            <Text className="font-sans" key={unit.id} style={styles.legendText}>
              {unit.label.startsWith(shortLabel(unit))
                ? unit.label
                : `${shortLabel(unit)} · ${unit.label}`}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  month: { fontSize: 24, color: colors.ink, letterSpacing: -0.6 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  slot: { width: "14.285714%", padding: 3 },
  weekday: {
    textAlign: "center",
    fontSize: 10,
    color: colors.muted,
    paddingBottom: 12,
  },
  day: { minHeight: 62, borderRadius: 10, borderWidth: 1, gap: 6 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 18 },
  legendText: { color: colors.muted, fontSize: 12, lineHeight: 18 },
});
