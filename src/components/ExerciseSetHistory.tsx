import { useEffect, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { FadeInRow } from "@/components/FadeInRow";
import { formatDistanceValue, formatEffort, isDistanceModality } from "@/data/modalities";
import type { Modality } from "@/types";
import { useInteractionState } from "@/hooks/useInteractionState";
import { compactAgo, dayStamp, monthStamp } from "@/utils/dateLabels";
import { daysBetween } from "@/utils/cycle";
import { formatVolume } from "@/utils/analyticsFormat";
import { formatKg } from "@/utils/recordsGamification";
import {
  monthsCovered,
  sessionsWithinMonths,
  type ExerciseHistory,
  type HistorySession,
  type HistorySet,
} from "@/utils/exerciseHistory";

const MONO = "JetBrains Mono, Menlo, Courier New, monospace";
const HAIRLINE = "rgba(38, 36, 31, 0.07)";
const INK = "#26241f";
const MUTED = "#928d80";

/** Opens on the current block of training — the rest is one tap away. */
const INITIAL_MONTHS = 2;
/** How much further back each "mais meses" tap reaches. */
const MONTHS_STEP = 2;
const MAX_STAGGERED = 10;
const DATE_COL = 50;
/** Indent of the drawer's rows — enough to read as belonging to the line above
 *  without pushing the load column off a narrow phone. */
const DETAIL_INDENT = 25;

interface Props {
  history: ExerciseHistory;
  modality: Modality;
  todayISO: string;
  onOpenSession: (sessionId: number) => void;
}

/**
 * The ledger: one line per session, written the way it gets written by hand —
 * `80×12  85×10  100×6`.
 *
 * The unit is the session because that's the unit training happens in, but a
 * session doesn't need a card of its own to be one — the date in the gutter and a
 * hairline are enough, so long as the whole ledger sits on a single plate.
 * Everything a set carries besides its load (RPE, failure, how heavy it was
 * against the all-time best) lives one tap deeper, in a drawer that opens
 * recessed under its line: it's the kind of thing you look up about one session
 * rather than scan across ten.
 */
export function ExerciseSetHistory({ history, modality, todayISO, onOpenSession }: Props) {
  const [months, setMonths] = useState(INITIAL_MONTHS);
  const [showAll, setShowAll] = useState(false);
  // One at a time: a screen with six drawers open is the pile this replaced.
  const [openSession, setOpenSession] = useState<number | null>(null);
  // Where the last reveal started, so newly arrived lines stagger from the fold
  // rather than from the top of a list that was already sitting there.
  const [foldAt, setFoldAt] = useState(0);

  if (history.sessions.length === 0) {
    return (
      <View
        className="rounded-xl items-center justify-center"
        style={{
          paddingVertical: 26,
          borderWidth: 1,
          borderColor: "#ddd8ce",
          borderStyle: "dashed",
        }}
      >
        <MaterialCommunityIcons name="notebook-outline" size={22} color="#cfcabf" />
        <Text className="text-ink-mute text-xs" style={{ marginTop: 8 }}>
          Nenhum set registrado ainda.
        </Text>
        <Text className="text-ink-faint text-xs" style={{ marginTop: 2 }}>
          Ele aparece aqui na primeira vez que você treinar.
        </Text>
      </View>
    );
  }

  const shown = showAll ? history.sessions : sessionsWithinMonths(history.sessions, months);
  const hiddenSessions = history.sessions.length - shown.length;
  const hiddenMonths = monthsCovered(history.sessions) - monthsCovered(shown);

  const reveal = (nextMonths: number | "all") => {
    setFoldAt(shown.length);
    setOpenSession(null);
    if (nextMonths === "all") setShowAll(true);
    else setMonths(nextMonths);
  };

  const collapse = () => {
    setFoldAt(0);
    setOpenSession(null);
    setShowAll(false);
    setMonths(INITIAL_MONTHS);
  };

  return (
    // One plate for the whole ledger. Loose on the page background the lines read
    // as floating text; on a bounded white surface they read as a list, and the
    // recessed drawer that opens under a line has something to be recessed from.
    <View
      className="bg-surface-card rounded-xl overflow-hidden"
      style={{ borderWidth: 1, borderColor: "#e7e4dc" }}
    >
      {shown.map((session, index) => {
        const month = session.date.slice(0, 7);
        const newMonth = index === 0 || shown[index - 1].date.slice(0, 7) !== month;

        return (
          <View key={session.sessionId}>
            {newMonth ? <MonthRule month={month} first={index === 0} /> : null}
            <SessionLine
              session={session}
              modality={modality}
              todayISO={todayISO}
              first={newMonth}
              expanded={openSession === session.sessionId}
              onToggle={() =>
                setOpenSession((current) =>
                  current === session.sessionId ? null : session.sessionId
                )
              }
              onOpenSession={() => onOpenSession(session.sessionId)}
              stagger={Math.min(index < foldAt ? index : index - foldAt, MAX_STAGGERED)}
            />
          </View>
        );
      })}

      <FoldControl
        hiddenSessions={hiddenSessions}
        hiddenMonths={hiddenMonths}
        totalSessions={history.sessions.length}
        canCollapse={showAll || months > INITIAL_MONTHS}
        onMoreMonths={() => reveal(months + MONTHS_STEP)}
        onAll={() => reveal("all")}
        onCollapse={collapse}
      />
    </View>
  );
}

/** The month, once, above its first session — what makes a long scroll navigable
 *  now that the individual lines no longer carry a full date. A recessed strip
 *  rather than a rule: inside the plate it has to divide the list, not decorate
 *  a line of it. */
function MonthRule({ month, first }: { month: string; first: boolean }) {
  return (
    <View
      style={{
        paddingHorizontal: 11,
        paddingVertical: 5,
        backgroundColor: "#f4f2ee",
        borderTopWidth: first ? 0 : 1,
        borderTopColor: "#e7e4dc",
        borderBottomWidth: 1,
        borderBottomColor: "#e7e4dc",
      }}
    >
      <Text style={{ color: "#928d80", fontSize: 8.5, fontWeight: "700", letterSpacing: 1.3 }}>
        {monthStamp(month)}
      </Text>
    </View>
  );
}

function SessionLine({
  session,
  modality,
  todayISO,
  first,
  expanded,
  stagger,
  onToggle,
  onOpenSession,
}: {
  session: HistorySession;
  modality: Modality;
  todayISO: string;
  /** First line under a month rule goes without its own top hairline. */
  first: boolean;
  expanded: boolean;
  stagger: number;
  onToggle: () => void;
  onOpenSession: () => void;
}) {
  const isDistance = isDistanceModality(modality);
  const { hovered, handlers } = useInteractionState();
  const stamp = dayStamp(session.date).split(" ");

  const notation = session.sets
    .map((item) =>
      isDistance
        ? formatDistanceValue(item.set.distance_km, modality) ?? "—"
        : `${formatKg(item.set.weight_kg)}×${item.set.reps}`
    )
    .join("  ");

  return (
    <FadeInRow index={stagger} step={38} cycle={session.sessionId}>
      <Pressable
        onPress={onToggle}
        {...handlers}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${dayStamp(session.date)}: ${notation}. Abrir detalhes.`}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 9,
          paddingHorizontal: 11,
          borderTopWidth: first ? 0 : 1,
          borderTopColor: HAIRLINE,
          // The open line is the head of its drawer, so it takes the drawer's
          // recess; closed lines keep the plate's white.
          backgroundColor: expanded ? "#f4f2ee" : hovered ? "#faf9f5" : "#ffffff",
        }}
      >
        <View className="flex-row items-baseline" style={{ width: DATE_COL, gap: 4 }}>
          <Text style={{ color: "#bdb8aa", fontSize: 9, fontWeight: "700", letterSpacing: 0.5 }}>
            {stamp[0]}
          </Text>
          <Text style={{ color: expanded ? INK : "#5c594f", fontSize: 11.5, fontFamily: MONO }}>
            {stamp[1]}
          </Text>
        </View>

        {/* The load column, in the notation it was written in. The top set of the
            session is the one worth comparing across weeks, so it's the only one
            in full ink. */}
        <Text style={{ flex: 1, fontSize: 11.5, fontFamily: MONO, lineHeight: 17 }} numberOfLines={2}>
          {session.sets.map((item, index) => (
            <Text
              key={item.set.id}
              style={{
                color: item.isTopSet ? INK : MUTED,
                fontWeight: item.isTopSet ? "700" : "400",
              }}
            >
              {(isDistance
                ? formatDistanceValue(item.set.distance_km, modality) ?? "—"
                : `${formatKg(item.set.weight_kg)}×${item.set.reps}`) +
                (index < session.sets.length - 1 ? "  " : "")}
            </Text>
          ))}
        </Text>

        {session.containsRecord ? (
          <MaterialCommunityIcons name="crown" size={11} color="#b9791f" />
        ) : null}

        <View style={{ width: 38, alignItems: "flex-end" }}>
          {session.deltaKg != null && session.deltaKg !== 0 ? <Delta kg={session.deltaKg} /> : null}
        </View>

        <MaterialCommunityIcons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={13}
          color={expanded ? "#928d80" : "#d6d1c6"}
        />
      </Pressable>

      {expanded ? (
        <SessionDetail
          session={session}
          modality={modality}
          todayISO={todayISO}
          onOpenSession={onOpenSession}
        />
      ) : null}
    </FadeInRow>
  );
}

/** Everything the collapsed line leaves out, for the one session you asked
 *  about: per-set intensity against the all-time best, effort marks, the
 *  session's totals, and the way into the whole session it belonged to. */
function SessionDetail({
  session,
  modality,
  todayISO,
  onOpenSession,
}: {
  session: HistorySession;
  modality: Modality;
  todayISO: string;
  onOpenSession: () => void;
}) {
  const isDistance = isDistanceModality(modality);
  const days = daysBetween(session.date, todayISO);
  const setCount = session.sets.length;

  const totals = [
    `${setCount} ${setCount === 1 ? "série" : "séries"}`,
    isDistance
      ? formatDistanceValue(session.distanceKm, modality)
      : session.volumeKg > 0
        ? formatVolume(session.volumeKg)
        : null,
    isDistance ? formatEffort(session.bestPaceSec, modality) : null,
    compactAgo(days),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={{ backgroundColor: "#f7f5f1", paddingBottom: 8 }}>
      {session.sets.map((item, index) => (
        <SetLine key={item.set.id} item={item} modality={modality} delay={60 + index * 40} />
      ))}

      <View
        className="flex-row items-center"
        style={{
          paddingLeft: DETAIL_INDENT,
          paddingRight: 6,
          paddingTop: 7,
          gap: 8,
          borderTopWidth: 1,
          borderTopColor: HAIRLINE,
        }}
      >
        <Text style={{ color: MUTED, fontSize: 10, flex: 1 }} numberOfLines={1}>
          {totals}
        </Text>
        <SessionLink onPress={onOpenSession} />
      </View>
    </View>
  );
}

function SetLine({
  item,
  modality,
  delay,
}: {
  item: HistorySet;
  modality: Modality;
  delay: number;
}) {
  const { set, intensity, isRecord, isTopSet } = item;
  const isDistance = isDistanceModality(modality);

  return (
    <View
      className="flex-row items-center"
      style={{
        paddingLeft: DETAIL_INDENT,
        paddingRight: 6,
        paddingVertical: 5,
        borderTopWidth: 1,
        borderTopColor: HAIRLINE,
        gap: 8,
      }}
    >
      <Text style={{ color: "#cfcabf", fontSize: 9.5, fontFamily: MONO, width: 9 }}>
        {set.set_number}
      </Text>

      {isDistance ? (
        <View className="flex-row items-baseline" style={{ width: 96, gap: 4 }}>
          <Text style={{ color: INK, fontSize: 12.5, fontWeight: "700", fontFamily: MONO }}>
            {formatDistanceValue(set.distance_km, modality) ?? "—"}
          </Text>
          <Text style={{ color: MUTED, fontSize: 9.5 }} numberOfLines={1}>
            {formatEffort(set.pace_sec, modality) ?? ""}
          </Text>
        </View>
      ) : (
        <View className="flex-row items-baseline" style={{ width: 96 }}>
          <Text
            style={{
              color: INK,
              fontSize: 12.5,
              fontWeight: isTopSet ? "700" : "500",
              fontFamily: MONO,
              width: 42,
              textAlign: "right",
            }}
          >
            {formatKg(set.weight_kg)}
          </Text>
          <Text style={{ color: MUTED, fontSize: 9, marginLeft: 2 }}>kg</Text>
          <Text style={{ color: "#cfcabf", fontSize: 9, marginLeft: 5 }}>×</Text>
          <Text style={{ color: "#5c594f", fontSize: 11.5, fontFamily: MONO, marginLeft: 4 }}>
            {set.reps}
          </Text>
        </View>
      )}

      <View style={{ flex: 1, minWidth: 20 }}>
        <IntensityBar
          intensity={intensity}
          emphasis={isRecord ? "record" : isTopSet ? "top" : "plain"}
          delay={delay}
        />
      </View>

      {set.failure ? <Tag label="FALHA" tone="danger" /> : null}
      {set.rpe != null ? <Tag label={`RPE ${formatKg(set.rpe)}`} tone="plain" /> : null}
      {set.rir != null ? <Tag label={`RIR ${set.rir}`} tone="plain" /> : null}
      {isRecord ? <MaterialCommunityIcons name="crown" size={11} color="#b9791f" /> : null}
    </View>
  );
}

/** How heavy the set was against the best this exercise has ever seen. */
function IntensityBar({
  intensity,
  emphasis,
  delay,
}: {
  intensity: number;
  emphasis: "record" | "top" | "plain";
  delay: number;
}) {
  const fill = useSharedValue(0);
  // A set that carried load always draws something — a 4% bar rendering as two
  // pixels reads as "no data".
  const target = intensity > 0 ? Math.min(1, Math.max(intensity, 0.05)) : 0;

  useEffect(() => {
    fill.value = 0;
    fill.value = withDelay(
      delay,
      withTiming(target, { duration: 480, easing: Easing.out(Easing.cubic) })
    );
  }, [target, delay, fill]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  const color = emphasis === "record" ? "#b9791f" : emphasis === "top" ? INK : "#c4bfb1";

  return (
    <View style={{ height: 3, borderRadius: 2, backgroundColor: "#eeeae2", overflow: "hidden" }}>
      <Animated.View style={[{ height: "100%", borderRadius: 2, backgroundColor: color }, fillStyle]} />
    </View>
  );
}

function Tag({ label, tone }: { label: string; tone: "plain" | "danger" }) {
  const danger = tone === "danger";
  return (
    <View
      className="rounded"
      style={{
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderWidth: 1,
        borderColor: danger ? "#e8c9c5" : "#e7e4dc",
        backgroundColor: danger ? "#fbf0ef" : "#ffffff",
      }}
    >
      <Text
        style={{
          color: danger ? "#bf3b30" : MUTED,
          fontSize: 8.5,
          fontWeight: "700",
          fontFamily: MONO,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/** How the session's top load moved against the session trained before it.
 *  Signed on purpose — a deload is information, not a failure. Bare text rather
 *  than a chip: at one per line, chips were most of what made the list loud. */
function Delta({ kg }: { kg: number }) {
  const up = kg > 0;
  const color = up ? "#227a54" : "#a8382d";

  return (
    <View
      className="flex-row items-center"
      style={{ gap: 1 }}
      accessibilityLabel={`${up ? "Mais" : "Menos"} ${formatKg(
        Math.abs(kg)
      )} quilos que a sessão anterior`}
    >
      <MaterialCommunityIcons name={up ? "arrow-up" : "arrow-down"} size={9} color={color} />
      <Text style={{ color, fontSize: 9.5, fontWeight: "700", fontFamily: MONO }}>
        {formatKg(Math.abs(kg))}
      </Text>
    </View>
  );
}

function SessionLink({ onPress }: { onPress: () => void }) {
  const { hovered, handlers } = useInteractionState();

  return (
    <Pressable
      onPress={onPress}
      {...handlers}
      accessibilityRole="button"
      accessibilityLabel="Abrir a sessão completa"
      className="flex-row items-center rounded"
      style={{ gap: 2, paddingVertical: 2, paddingHorizontal: 3 }}
    >
      <Text
        style={{
          color: hovered ? INK : "#5c594f",
          fontSize: 10,
          fontWeight: "600",
          textDecorationLine: hovered ? "underline" : "none",
        }}
      >
        ver sessão
      </Text>
      <MaterialCommunityIcons name="arrow-right" size={11} color={hovered ? INK : "#928d80"} />
    </Pressable>
  );
}

/**
 * The plate's footer, which reaches back in two sizes.
 *
 * Stepping two months at a time is how you actually read backwards — the block
 * before this one, then the one before that — but a two-year ledger would be
 * eighteen taps away, so the whole thing stays available beside it, priced in
 * sessions so you know what you're asking for.
 */
function FoldControl({
  hiddenSessions,
  hiddenMonths,
  totalSessions,
  canCollapse,
  onMoreMonths,
  onAll,
  onCollapse,
}: {
  hiddenSessions: number;
  hiddenMonths: number;
  totalSessions: number;
  /** The view has been reached past its opening window, so there's something to
   *  put away. False on a ledger short enough to fit the window from the start. */
  canCollapse: boolean;
  onMoreMonths: () => void;
  onAll: () => void;
  onCollapse: () => void;
}) {
  if (hiddenSessions === 0) {
    if (!canCollapse) return null;
    return (
      <FoldRow>
        <FoldAction icon="chevron-up" label="recolher" onPress={onCollapse} />
      </FoldRow>
    );
  }

  // One more step would land on everything anyway; two controls doing the same
  // thing is just a choice to make for nothing.
  const stepWorthOffering = hiddenMonths > MONTHS_STEP;

  return (
    <FoldRow>
      {stepWorthOffering ? (
        <FoldAction
          icon="chevron-down"
          label={`mais ${MONTHS_STEP} meses`}
          onPress={onMoreMonths}
          strong
        />
      ) : null}
      <FoldAction
        icon="unfold-more-horizontal"
        label={`ver todas as ${totalSessions} sessões`}
        onPress={onAll}
        strong={!stepWorthOffering}
      />
      {canCollapse ? (
        <>
          <View style={{ flex: 1 }} />
          <FoldAction icon="chevron-up" label="recolher" onPress={onCollapse} />
        </>
      ) : null}
    </FoldRow>
  );
}

function FoldRow({ children }: { children: ReactNode }) {
  return (
    <View
      className="flex-row items-center"
      style={{
        paddingHorizontal: 8,
        paddingVertical: 6,
        gap: 4,
        borderTopWidth: 1,
        borderTopColor: "#e7e4dc",
        backgroundColor: "#fbfaf7",
      }}
    >
      {children}
    </View>
  );
}

function FoldAction({
  icon,
  label,
  onPress,
  strong,
}: {
  icon: "chevron-down" | "chevron-up" | "unfold-more-horizontal";
  label: string;
  onPress: () => void;
  /** The action most people want here; the other one recedes. */
  strong?: boolean;
}) {
  const { hovered, handlers } = useInteractionState();

  return (
    <Pressable
      onPress={onPress}
      {...handlers}
      accessibilityRole="button"
      className="flex-row items-center rounded-lg"
      style={{
        paddingHorizontal: 8,
        paddingVertical: 5,
        gap: 4,
        backgroundColor: hovered ? "#ebe7df" : "transparent",
      }}
    >
      <MaterialCommunityIcons name={icon} size={13} color={strong ? "#5c594f" : "#a8a293"} />
      <Text
        style={{
          color: hovered ? INK : strong ? "#5c594f" : "#928d80",
          fontSize: 11,
          fontWeight: strong ? "700" : "600",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
