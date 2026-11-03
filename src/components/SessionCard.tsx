import { Image, StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Button } from "@/components/ui/button";
import colors from "@/theme/palette.json";
import type { SessionSummary } from "@/types";
import {
  distanceDisplay,
  isDistanceModality,
  modalityLabel,
  toDisplayDistance,
} from "@/data/modalities";

interface Props {
  session: SessionSummary;
  title?: string;
  onPress: () => void;
}
const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTHS = [
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
];

export function SessionCard({ session, title, onPress }: Props) {
  const date = new Date(session.date + "T00:00:00");
  const name = session.name || title || modalityLabel(session.modality);
  const duration = session.duration_seconds
    ? `${Math.round(session.duration_seconds / 60)} min`
    : null;
  const count = session.exercise_names.length;
  const distance =
    isDistanceModality(session.modality) &&
    (session.total_distance_km ?? 0) > 0;
  const shownDistance =
    toDisplayDistance(session.total_distance_km, session.modality) ?? 0;
  const unit = distanceDisplay(session.modality).distanceUnit;
  const number = distance
    ? unit === "m"
      ? String(Math.round(shownDistance))
      : shownDistance.toFixed(1).replace(".", ",")
    : session.total_volume
      ? String(Math.round(session.total_volume)).replace(
          /\B(?=(\d{3})+(?!\d))/g,
          ".",
        )
      : null;
  const meta = [
    count
      ? `${count} exercício${count === 1 ? "" : "s"}`
      : modalityLabel(session.modality),
    duration,
  ]
    .filter(Boolean)
    .join(" · ");
  const movements =
    session.exercise_names.slice(0, 4).join(" · ") +
    (count > 4 ? ` +${count - 4}` : "");

  return (
    <Button
      accessibilityLabel={`${name}, ${date.getDate()} de ${MONTHS[date.getMonth()]}, ${meta}`}
      onPress={onPress}
      style={styles.card}
      className="flex-col items-stretch justify-start"
    >
      {session.cover_photo_uri && (
        <Image
          source={{ uri: session.cover_photo_uri }}
          style={{ width: "100%", height: 144 }}
          resizeMode="cover"
        />
      )}
      <View style={styles.inner}>
        <View style={styles.date}>
          <Text className="font-sans" style={styles.dateLabel}>
            {WEEKDAYS[date.getDay()]}
          </Text>
          <Text className="font-display" style={styles.day}>
            {date.getDate()}
          </Text>
          <Text className="font-sans" style={styles.caption}>
            {MONTHS[date.getMonth()]}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text className="font-sans" style={styles.name} numberOfLines={2}>
              {name}
            </Text>
            <MaterialCommunityIcons
              name="arrow-top-right"
              size={18}
              color={colors.muted}
            />
          </View>
          <Text
            className="font-sans"
            style={[styles.caption, { marginTop: 5 }]}
          >
            {meta}
          </Text>
          {number && (
            <View style={styles.metric}>
              <Text className="font-sans" style={styles.number}>
                {number}
              </Text>
              <Text className="font-sans" style={styles.caption}>
                {distance ? `${unit} percorridos` : "kg de volume"}
              </Text>
            </View>
          )}
          {movements ? (
            <Text
              className="font-sans"
              style={[styles.caption, { marginTop: 12 }]}
              numberOfLines={1}
            >
              {movements}
            </Text>
          ) : null}
          {session.notes ? (
            <Text
              className="font-sans"
              style={[styles.caption, { marginTop: 6, fontStyle: "italic" }]}
              numberOfLines={1}
            >
              {session.notes}
            </Text>
          ) : null}
        </View>
      </View>
    </Button>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
  },
  inner: { flexDirection: "row", padding: 20, gap: 20 },
  date: {
    width: 40,
    alignItems: "center",
    borderRightWidth: 1,
    borderColor: colors.line,
    paddingRight: 14,
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: colors.muted,
  },
  day: { fontSize: 32, color: colors.ink, marginVertical: 2 },
  caption: { fontSize: 12, lineHeight: 18, color: colors.muted },
  name: { flex: 1, fontSize: 16, fontWeight: "600", color: colors.ink },
  metric: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 14,
    flexWrap: "wrap",
  },
  number: {
    fontSize: 23,
    fontWeight: "600",
    color: colors.ink,
    letterSpacing: -0.7,
    fontVariant: ["tabular-nums"],
  },
});
