import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Pressable, Text, View } from "react-native";
import {
  HOT_MIN_GAINS,
  HOT_WINDOW_DAYS,
  STALE_AFTER_DAYS,
  type StampTone,
} from "@/utils/recordsGamification";

/** Three stamps reading one lift's momentum: it just landed, it keeps climbing,
 *  or it has gone untouched long enough to be worth attacking. `meaning` sits in
 *  the same object as the colours so a stamp can never drift from its own
 *  explanation, and the thresholds are interpolated so the copy follows the rule
 *  if the rule ever moves. Kept to one short sentence — the bubble hangs off a
 *  chip barely 50px wide, and a paragraph there reads as a panel, not a hint. */
const STAMPS = {
  new: {
    bg: "#2f9e6e",
    ink: "#ffffff",
    icon: "star-four-points",
    text: "NOVO",
    meaning: "Batido no período selecionado.",
  },
  hot: {
    bg: "#fbe8cf",
    ink: "#a25c12",
    icon: "fire",
    text: "QUENTE",
    meaning: `Carga subiu ${HOT_MIN_GAINS}+ vezes em ${HOT_WINDOW_DAYS} dias.`,
  },
  cold: {
    bg: "#e9edf0",
    ink: "#6f7b85",
    icon: "snowflake",
    text: "FRIO",
    meaning: `Sem record novo há ${STALE_AFTER_DAYS}+ dias.`,
  },
} as const satisfies Record<StampTone, unknown>;

interface StampProps {
  tone: StampTone;
  isActive: boolean;
  /** Fires on tap and on mouse-enter; `null` on mouse-leave or a second tap. */
  onActivate: (tone: StampTone | null) => void;
}

/** A stamp is its own legend: pressing it (or hovering, on web) opens a bubble
 *  anchored to the chip itself. Nested inside the row's touchable, it swallows
 *  the press so asking what a stamp means never navigates away from the answer. */
export function Stamp({ tone, isActive, onActivate }: StampProps) {
  const { bg, ink, icon, text, meaning } = STAMPS[tone];

  return (
    <View>
      <Pressable
        onPress={() => onActivate(isActive ? null : tone)}
        onHoverIn={() => onActivate(tone)}
        onHoverOut={() => onActivate(null)}
        // No accessibilityRole="button": the row around it is already one, and on
        // web that nests a <button> inside a <button>, which is invalid DOM. The
        // label carries the whole meaning anyway, so assistive tech gets the
        // explanation read out without having to land a hover or a tap.
        accessibilityLabel={`${text}. ${meaning}`}
        className="flex-row items-center rounded-full"
        style={{
          backgroundColor: bg,
          paddingHorizontal: 6,
          paddingVertical: 2,
          gap: 2,
          opacity: isActive ? 0.75 : 1,
        }}
      >
        <MaterialCommunityIcons name={icon} size={8} color={ink} />
        <Text style={{ color: ink, fontSize: 9, fontWeight: "700", letterSpacing: 0.5 }}>
          {text}
        </Text>
      </Pressable>

      {isActive ? <StampTooltip tone={tone} /> : null}
    </View>
  );
}

/** Hangs off the bottom-right of its own chip, sized to its sentence. Right-
 *  aligned so it grows leftward into the card instead of off the screen edge. */
function StampTooltip({ tone }: { tone: StampTone }) {
  return (
    <View
      style={{
        position: "absolute",
        top: "100%",
        marginTop: 5,
        right: 0,
        // Explicit, not maxWidth: an absolute child sizes against its containing
        // block, and this one's is a ~50px chip — shrink-to-fit would break the
        // sentence into a three-word column. Wide enough to hold each meaning in
        // a line or two, and still inside the card on a 340px phone.
        width: 236,
        backgroundColor: "#26241f",
        borderRadius: 9,
        paddingVertical: 8,
        paddingHorizontal: 11,
        // Top of the chain the row and the shelf also raise — every ancestor
        // between here and the accordion has to outrank its own siblings, or one
        // of them paints over the bubble.
        zIndex: 60,
        elevation: 12,
        pointerEvents: "none",
      }}
    >
      {/* Rotated square as the caret, pointing back up at the chip. */}
      <View
        style={{
          position: "absolute",
          top: -3,
          right: 12,
          width: 7,
          height: 7,
          backgroundColor: "#26241f",
          transform: [{ rotate: "45deg" }],
        }}
      />
      <Text style={{ color: "#e7e4dc", fontSize: 11, lineHeight: 15 }}>
        {STAMPS[tone].meaning}
      </Text>
    </View>
  );
}
