import type { ComponentProps } from "react";
import { Fragment } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ModalityConfig } from "@/data/modalities";
import { MODALITY_CATEGORIES, modalitiesOfCategory } from "@/data/modalities";
import type { Modality } from "@/types";

type MciName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const INK = "#26241f";
const INK_SOFT = "#5c594f";
const INK_MUTE = "#928d80";
const HAIRLINE = "#ddd8ce";
const RULE = "#f0ede6";
/** Cream fill that makes an unselected chip read as a recessed key on a white card. */
const RECESSED = "#f4f2ee";

/** Horizontal room a chip row needs before it stops fitting; below this we wrap. */
export const MODALITY_CHIPS_MIN_ROW_WIDTH = 720;

interface Props {
  value: Modality;
  onChange: (m: Modality) => void;
  /**
   * "scroll" — one horizontally scrollable row, for viewports wide enough to
   * show every chip at once.
   * "wrap" — chips wrap into a grid. On a phone the row is roughly twice the
   * available width, so a scroller hides most options *including the selected
   * one*, leaving the control looking uniformly inert. Wrapping keeps the
   * active chip on screen by construction.
   */
  layout?: "scroll" | "wrap";
}

interface ChipProps {
  modality: ModalityConfig;
  active: boolean;
  onPress: () => void;
  /** Wrapped chips get a taller touch target and a recessed cream fill. */
  block?: boolean;
  /** Share the row evenly with siblings. Off for a lone chip, which sizes to
   *  its label and is centred instead of stretching across the whole card. */
  fill?: boolean;
}

/**
 * One modality chip. Selection is carried by three reinforcing signals — ink
 * fill, inverted label, and a lifted shadow — so it survives a phone screen in
 * daylight, where hover states don't exist and a border-only accent doesn't
 * register.
 */
function Chip({ modality, active, onPress, block = false, fill = false }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        paddingVertical: block ? 11 : 8,
        paddingHorizontal: block && !fill ? 22 : 14,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? INK : hovered ? "#c9c3b7" : HAIRLINE,
        backgroundColor: active
          ? INK
          : pressed
            ? "#e7e3da"
            : hovered
              ? RULE
              : block
                ? RECESSED
                : "transparent",
        ...(fill ? { flexGrow: 1, flexBasis: "42%" } : null),
        ...(active
          ? {
              shadowColor: INK,
              shadowOpacity: 0.22,
              shadowRadius: 9,
              shadowOffset: { width: 0, height: 3 },
              elevation: 3,
            }
          : null),
      })}
    >
      {({ hovered }: { hovered?: boolean }) => {
        const color = active ? "#ffffff" : hovered ? INK_SOFT : block ? INK_SOFT : INK_MUTE;
        return (
          <>
            <MaterialCommunityIcons
              name={modality.icon as MciName}
              size={16}
              color={active ? "#ffffff" : color}
            />
            <Text
              numberOfLines={1}
              style={{
                fontSize: 13,
                fontWeight: active ? "700" : "500",
                color,
                letterSpacing: -0.1,
              }}
            >
              {modality.label}
            </Text>
          </>
        );
      }}
    </Pressable>
  );
}

/** Group caption with a hairline rule running out to the edge. */
function CategoryCaption({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <Text style={{ fontSize: 9, fontWeight: "700", letterSpacing: 1, color: INK_MUTE }}>
        {label.toUpperCase()}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: RULE }} />
    </View>
  );
}

/**
 * The modality selector. Options come straight from MODALITIES, grouped by
 * training category (Força / Endurance) so the two kinds of training read as
 * distinct.
 *
 * Neither layout divides a fixed track between options the way the segmented
 * ModalityToggle it replaced did, so both stay usable as the registry grows —
 * wide viewports get one row, narrow ones a wrapping grid.
 */
export function ModalityChips({ value, onChange, layout = "scroll" }: Props) {
  if (layout === "wrap") {
    return (
      <View style={{ gap: 14 }}>
        {MODALITY_CATEGORIES.map((cat) => {
          const group = modalitiesOfCategory(cat.key);
          // A group of one shouldn't span the card — size it to its label and
          // leave it at the left margin; groups of several split rows evenly.
          const fill = group.length > 1;
          return (
            <View key={cat.key}>
              <CategoryCaption label={cat.label} />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {group.map((m) => (
                  <Chip
                    key={m.key}
                    modality={m}
                    active={m.key === value}
                    onPress={() => onChange(m.key)}
                    block
                    fill={fill}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexDirection: "row", alignItems: "center", gap: 6, paddingRight: 4 }}
    >
      {MODALITY_CATEGORIES.map((cat, catIndex) => (
        <Fragment key={cat.key}>
          {catIndex > 0 && (
            <View
              style={{ width: 1, alignSelf: "stretch", backgroundColor: HAIRLINE, marginHorizontal: 4 }}
            />
          )}
          <Text
            className="text-ink-faint"
            style={{ fontSize: 9, fontWeight: "700", letterSpacing: 1, marginRight: 2 }}
          >
            {cat.label.toUpperCase()}
          </Text>
          {modalitiesOfCategory(cat.key).map((m) => (
            <Chip
              key={m.key}
              modality={m}
              active={m.key === value}
              onPress={() => onChange(m.key)}
            />
          ))}
        </Fragment>
      ))}
    </ScrollView>
  );
}
