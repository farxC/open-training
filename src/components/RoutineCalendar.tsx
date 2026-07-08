import { Text, TouchableOpacity, View } from "react-native";
import type { DayScheduleEntry } from "@/hooks/useRoutine";
import type { OverrideStatus } from "@/types";

interface Props {
  monthDate: Date; // any date within the displayed month
  scheduleForDate: (iso: string) => { planned: DayScheduleEntry[]; override: OverrideStatus | null };
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (iso: string) => void;
}

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function RoutineCalendar({ monthDate, scheduleForDate, onPrevMonth, onNextMonth, onSelectDate }: Props) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const leading = (firstOfMonth.getDay() + 6) % 7; // Monday-based offset
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayISO = iso(new Date());

  const cells: (number | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View className="mx-4">
      <View className="flex-row items-center justify-between mb-3">
        <TouchableOpacity onPress={onPrevMonth} className="px-2 py-1">
          <Text className="text-ink-mute text-lg">‹</Text>
        </TouchableOpacity>
        <Text className="text-ink font-display font-semibold text-lg">
          {MONTHS[month]} {year}
        </Text>
        <TouchableOpacity onPress={onNextMonth} className="px-2 py-1">
          <Text className="text-ink-mute text-lg">›</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row mb-1">
        {WEEKDAYS.map((w) => (
          <View key={w} className="flex-1 items-center">
            <Text className="text-ink-faint text-xs">{w}</Text>
          </View>
        ))}
      </View>

      <View className="flex-row flex-wrap">
        {cells.map((day, i) => {
          if (day == null) {
            return <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 0.78 }} />;
          }
          const cellISO = iso(new Date(year, month, day));
          const { planned, override } = scheduleForDate(cellISO);
          const workouts = planned.filter((p) => p.status === "workout");
          const isToday = cellISO === todayISO;
          const hasPlan = workouts.length > 0;
          return (
            <TouchableOpacity
              key={i}
              style={{ width: `${100 / 7}%`, aspectRatio: 0.78, padding: 2 }}
              onPress={() => onSelectDate(cellISO)}
            >
              <View
                style={{
                  flex: 1,
                  borderRadius: 10,
                  paddingTop: 4,
                  alignItems: "center",
                  backgroundColor: hasPlan ? "#ffffff" : "transparent",
                  borderWidth: isToday ? 1.5 : hasPlan ? 1 : 0,
                  borderColor: isToday ? "#26241f" : "#ddd8ce",
                }}
              >
                <View className="flex-row items-center" style={{ gap: 3 }}>
                  <Text style={{ color: "#26241f", fontSize: 12, fontWeight: isToday ? "700" : "500" }}>
                    {day}
                  </Text>
                  {override && (
                    <View
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: override === "trained" ? "#2f9e6e" : "#bf3b30",
                      }}
                    />
                  )}
                </View>
                {workouts.slice(0, 2).map((p) => (
                  <Text
                    key={p.split.id}
                    numberOfLines={1}
                    style={{ color: "#928d80", fontSize: 8, fontWeight: "600", marginTop: 1, maxWidth: "100%" }}
                  >
                    {p.unit?.label || p.split.name}
                  </Text>
                ))}
                {workouts.length > 2 && (
                  <Text style={{ color: "#bdb8aa", fontSize: 8 }}>+{workouts.length - 2}</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
