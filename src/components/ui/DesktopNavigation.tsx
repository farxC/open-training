import { useEffect, useRef, useState, type ComponentProps } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipText } from "./tooltip";

type Item = {
  page: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
};

type Props = {
  items: Item[];
  current: string;
  onSelect: (page: string) => void;
  onCreate: () => void;
  onSettings?: () => void;
  colors: {
    white: string;
    ink: string;
    muted: string;
    line: string;
    primary: string;
    pale: string;
  };
};

export function DesktopNavigation({
  items,
  current,
  onSelect,
  onCreate,
  onSettings,
  colors: c,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduceMotion(value);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: expanded ? 1 : 0,
      duration: reduceMotion ? 0 : 260,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [expanded, progress, reduceMotion]);

  const labelMotion = {
    opacity: progress.interpolate({
      inputRange: [0, 0.4, 1],
      outputRange: [0, 0, 1],
    }),
    transform: [
      {
        translateX: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [-5, 0],
        }),
      },
    ],
  };

  return (
    <Animated.View
      style={[
        styles.gutter,
        {
          width: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [94, 228],
          }),
        },
      ]}
    >
      <View style={[styles.rail, { backgroundColor: c.white }]}>
        <View style={styles.identity}>
          <View style={[styles.logo, { backgroundColor: c.primary }]}>
            <MaterialCommunityIcons
              name="weight-lifter"
              size={22}
              color={c.white}
            />
          </View>
          <Animated.Text
            numberOfLines={1}
            aria-hidden={!expanded}
            style={[styles.brand, { color: c.ink }, labelMotion]}
          >
            Open Training
          </Animated.Text>
        </View>

        <View style={{ height: 30 }} />

        <Tooltip
          placement="right"
          isDisabled={expanded}
          openDelay={220}
          trigger={(props) => (
            <Button
              {...props}
              accessibilityLabel="Registrar treino"
              onPress={(event) => {
                props.onPress?.(event);
                onCreate();
              }}
              className="justify-start"
              style={[
                styles.navButton,
                { backgroundColor: c.primary, marginBottom: 24 },
              ]}
            >
              <View style={styles.iconSlot}>
                <MaterialCommunityIcons name="plus" size={23} color={c.white} />
              </View>
              <Animated.Text
                className="font-sans"
                aria-hidden
                numberOfLines={1}
                style={[styles.label, { color: c.white }, labelMotion]}
              >
                Registrar treino
              </Animated.Text>
            </Button>
          )}
        >
          <TooltipContent style={[styles.tooltip, { backgroundColor: c.ink }]}>
            <TooltipText
              className="font-sans"
              style={[styles.tooltipText, { color: c.white }]}
            >
              Registrar treino
            </TooltipText>
          </TooltipContent>
        </Tooltip>

        <View
          role="navigation"
          accessibilityLabel="Navegação principal"
          style={styles.items}
        >
          {items.map((item) => {
            const active = item.page === current;
            return (
              <Tooltip
                key={item.page}
                placement="right"
                isDisabled={expanded}
                openDelay={220}
                trigger={(props) => (
                  <Button
                    {...props}
                    accessibilityLabel={item.page}
                    accessibilityState={{ selected: active }}
                    onPress={(event) => {
                      props.onPress?.(event);
                      onSelect(item.page);
                    }}
                    className="justify-start"
                    style={[
                      styles.navButton,
                      active && { backgroundColor: c.pale },
                    ]}
                  >
                    <View style={styles.iconSlot}>
                      <MaterialCommunityIcons
                        name={item.icon}
                        size={22}
                        color={active ? c.primary : c.muted}
                      />
                    </View>
                    <Animated.Text
                      className="font-sans"
                      aria-hidden
                      numberOfLines={1}
                      style={[
                        styles.label,
                        { color: active ? c.primary : c.muted },
                        labelMotion,
                      ]}
                    >
                      {item.page}
                    </Animated.Text>
                  </Button>
                )}
              >
                <TooltipContent
                  style={[styles.tooltip, { backgroundColor: c.ink }]}
                >
                  <TooltipText
                    className="font-sans"
                    style={[styles.tooltipText, { color: c.white }]}
                  >
                    {item.page}
                  </TooltipText>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </View>

        <View style={{ flex: 1 }} />
        {onSettings && (
          <Tooltip
            placement="right"
            isDisabled={expanded}
            openDelay={220}
            trigger={(props) => (
              <Button
                {...props}
                accessibilityLabel="Configurações"
                onPress={(event) => {
                  props.onPress?.(event);
                  onSettings();
                }}
                className="justify-start"
                style={styles.navButton}
              >
                <View style={styles.iconSlot}>
                  <MaterialCommunityIcons
                    name="cog-outline"
                    size={21}
                    color={c.muted}
                  />
                </View>
                <Animated.Text
                  className="font-sans"
                  aria-hidden
                  numberOfLines={1}
                  style={[styles.label, { color: c.muted }, labelMotion]}
                >
                  Configurações
                </Animated.Text>
              </Button>
            )}
          >
            <TooltipContent
              style={[styles.tooltip, { backgroundColor: c.ink }]}
            >
              <TooltipText
                className="font-sans"
                style={[styles.tooltipText, { color: c.white }]}
              >
                Configurações
              </TooltipText>
            </TooltipContent>
          </Tooltip>
        )}
        <Tooltip
          placement="right"
          isDisabled={expanded}
          openDelay={220}
          trigger={(props) => (
            <Button
              {...props}
              accessibilityLabel={
                expanded ? "Recolher navegação" : "Expandir navegação"
              }
              accessibilityState={{ expanded }}
              onPress={(event) => {
                props.onPress?.(event);
                setExpanded((value) => !value);
              }}
              className="justify-start data-[hover=true]:opacity-100 web:focus-visible:opacity-100"
              style={styles.toggle}
            >
              <Animated.View
                style={[
                  styles.toggleIcon,
                  {
                    transform: [
                      {
                        rotate: progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0deg", "180deg"],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={19}
                  color={c.muted}
                />
              </Animated.View>
              <Animated.Text
                className="font-sans"
                aria-hidden
                numberOfLines={1}
                style={[
                  styles.label,
                  { color: c.muted, fontWeight: "400" },
                  labelMotion,
                ]}
              >
                Recolher
              </Animated.Text>
            </Button>
          )}
        >
          <TooltipContent style={[styles.tooltip, { backgroundColor: c.ink }]}>
            <TooltipText
              className="font-sans"
              style={[styles.tooltipText, { color: c.white }]}
            >
              Expandir navegação
            </TooltipText>
          </TooltipContent>
        </Tooltip>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  gutter: { padding: 16, paddingRight: 0 },
  rail: {
    flex: 1,
    borderRadius: 32,
    padding: 10,
    paddingVertical: 18,
    shadowColor: "#302b2b",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.035,
    shadowRadius: 22,
    overflow: "hidden",
  },
  identity: { height: 40, justifyContent: "center", paddingLeft: 11 },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    position: "absolute",
    left: 60,
    width: 142,
    fontFamily: "Fraunces",
    fontSize: 18,
    letterSpacing: -0.6,
  },
  items: { gap: 12 },
  navButton: {
    height: 44,
    minWidth: 44,
    paddingHorizontal: 0,
    borderRadius: 24,
    overflow: "hidden",
  },
  iconSlot: {
    width: 58,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    position: "absolute",
    left: 60,
    width: 132,
    fontSize: 13,
    fontWeight: "600",
  },
  toggle: {
    height: 44,
    borderRadius: 24,
    opacity: 0.5,
    overflow: "hidden",
    marginTop: 24,
  },
  toggleIcon: {
    width: 58,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  tooltip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  tooltipText: { fontSize: 12, fontWeight: "500" },
});
