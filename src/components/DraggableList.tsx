import { useEffect, useRef, useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

export interface DraggableListRenderInfo<T> {
  item: T;
  index: number;
  isActive: boolean;
  dragHandle: React.ReactNode;
}

interface Props<T> {
  data: T[];
  keyExtractor: (item: T) => string;
  onReorder: (newData: T[]) => void;
  renderItem: (info: DraggableListRenderInfo<T>) => React.ReactNode;
}

/**
 * Position (make-way slide) and lift (shadow/scale) share this exact spring
 * so they always settle in step. A duration-based `withTiming` looked abrupt
 * here because every order change during a drag interrupts and restarts the
 * animation — with a fixed-duration curve that restart has zero carried-over
 * velocity, so re-targeting mid-flight reads as a sudden direction snap. A
 * spring carries velocity across interruptions, so repeated re-targeting
 * during a fast drag flows continuously instead of snapping.
 */
const SPRING = { damping: 26, stiffness: 400, mass: 0.4 };

/**
 * Third-party drag-reorder libs (react-native-draggable-flatlist,
 * react-native-draglist) don't drag on web in this stack — confirmed via
 * manual spike. This is a from-scratch replacement built on the same
 * gesture-handler + reanimated combination already used elsewhere in the app
 * (PeriodTabs, ModalityToggle), which does receive pointer drags on web.
 *
 * Rows have no fixed height — every real use of this list (exercise cards
 * with wrapping target fields, live set-logging cards that grow as sets are
 * added) has variable content height. Each row measures itself via onLayout.
 *
 * Rows render in **normal flow**, in `data` order — the container needs no
 * measured height and every row always sits inside its parent's bounds, so
 * touches (drag handle, nested TextInputs) never get clipped. An earlier
 * version positioned rows with `position: 'absolute'` driven by a separately
 * measured container height; that worked on web (single-threaded, tolerant
 * CSS overflow) but broke on Android, where the two height sources could
 * drift out of sync and rows would overlap and stop receiving touches.
 *
 * During a drag, rows don't actually move in `data`/DOM order — only
 * `order` (the live preview order) changes. Each row is offset by
 * `translateY` = its position in the preview order minus its natural
 * (data-order) position, so unaffected rows glide to make room without any
 * real re-layout. The real reorder (via `onReorder`) only happens once, on
 * release.
 *
 * The pan gesture uses `activateAfterLongPress` so a quick touch or vertical
 * swipe on the handle doesn't fight the parent ScrollView for the gesture —
 * only a held touch starts a drag.
 *
 * The active row lifts (scale + shadow, via `lift`) the instant the drag
 * starts, so the dragged card is visibly distinct from the rest mid-drag —
 * elevation alone is Android-only and invisible on web/iOS.
 */
export function DraggableList<T>({ data, keyExtractor, onReorder, renderItem }: Props<T>) {
  const order = useSharedValue<string[]>(data.map(keyExtractor));
  const naturalOrder = useSharedValue<string[]>(data.map(keyExtractor));
  const heights = useSharedValue<Record<string, number>>({});
  const activeKey = useSharedValue<string | null>(null);
  const itemsByKey = useRef(new Map<string, T>());

  itemsByKey.current = new Map(data.map((item) => [keyExtractor(item), item]));

  useEffect(() => {
    const keys = data.map(keyExtractor);
    naturalOrder.value = keys;
    const sameSet = keys.length === order.value.length && keys.every((k) => order.value.includes(k));
    if (!sameSet && activeKey.value === null) {
      order.value = keys;
    }
  }, [data, keyExtractor, order, naturalOrder, activeKey]);

  function handleReorder(finalOrder: string[]) {
    const reordered = finalOrder
      .map((key) => itemsByKey.current.get(key))
      .filter((item): item is T => item !== undefined);
    onReorder(reordered);
  }

  function handleMeasure(key: string, height: number) {
    if (heights.value[key] === height) return;
    heights.value = { ...heights.value, [key]: height };
  }

  return (
    <View>
      {data.map((item, index) => {
        const key = keyExtractor(item);
        return (
          <Row
            key={key}
            itemKey={key}
            item={item}
            index={index}
            order={order}
            naturalOrder={naturalOrder}
            heights={heights}
            activeKey={activeKey}
            onMeasure={handleMeasure}
            onReorder={handleReorder}
            renderItem={renderItem}
          />
        );
      })}
    </View>
  );
}

function Row<T>({
  itemKey,
  item,
  index,
  order,
  naturalOrder,
  heights,
  activeKey,
  onMeasure,
  onReorder,
  renderItem,
}: {
  itemKey: string;
  item: T;
  index: number;
  order: ReturnType<typeof useSharedValue<string[]>>;
  naturalOrder: ReturnType<typeof useSharedValue<string[]>>;
  heights: ReturnType<typeof useSharedValue<Record<string, number>>>;
  activeKey: ReturnType<typeof useSharedValue<string | null>>;
  onMeasure: (key: string, height: number) => void;
  onReorder: (finalOrder: string[]) => void;
  renderItem: (info: DraggableListRenderInfo<T>) => React.ReactNode;
}) {
  const startTop = useSharedValue(0);
  const dragY = useSharedValue(0);
  const lift = useSharedValue(0);
  const [isActiveState, setIsActiveState] = useState(false);
  const lastMeasuredHeight = useRef(0);

  const offsetIn = (keys: string[], key: string): number => {
    "worklet";
    const hs = heights.value;
    let sum = 0;
    for (let i = 0; i < keys.length; i++) {
      if (keys[i] === key) break;
      sum += hs[keys[i]] ?? 0;
    }
    return sum;
  };

  const pan = Gesture.Pan()
    .activateAfterLongPress(200)
    .onStart(() => {
      activeKey.value = itemKey;
      startTop.value = offsetIn(order.value, itemKey);
      lift.value = withSpring(1, SPRING);
      runOnJS(setIsActiveState)(true);
    })
    .onUpdate((e) => {
      dragY.value = e.translationY;
      const myHeight = heights.value[itemKey] ?? 0;
      const center = startTop.value + e.translationY + myHeight / 2;

      const rest = order.value.filter((k) => k !== itemKey);
      let cumulative = 0;
      let targetIndex = rest.length;
      for (let i = 0; i < rest.length; i++) {
        const h = heights.value[rest[i]] ?? 0;
        if (center < cumulative + h / 2) {
          targetIndex = i;
          break;
        }
        cumulative += h;
      }
      const next = [...rest];
      next.splice(targetIndex, 0, itemKey);
      if (next.join("|") !== order.value.join("|")) {
        order.value = next;
      }
    })
    .onEnd(() => {
      dragY.value = 0;
      lift.value = withSpring(0, SPRING);
      activeKey.value = null;
      runOnJS(setIsActiveState)(false);
      runOnJS(onReorder)(order.value);
    });

  const style = useAnimatedStyle(() => {
    const active = activeKey.value === itemKey;
    const natural = offsetIn(naturalOrder.value, itemKey);
    const translateY = active
      ? startTop.value - natural + dragY.value
      : withSpring(offsetIn(order.value, itemKey) - natural, SPRING);
    const scale = 1 + lift.value * 0.035;
    return {
      transform: [{ translateY }, { scale }],
      zIndex: active ? 10 : 0,
      elevation: active ? 6 : 0,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 * lift.value },
      shadowOpacity: 0.2 * lift.value,
      shadowRadius: 8 * lift.value,
    };
  });

  const dragHandle = (
    <GestureDetector gesture={pan}>
      <View style={{ padding: 8 }}>
        <MaterialCommunityIcons name="drag-horizontal-variant" size={20} color="#928d80" />
      </View>
    </GestureDetector>
  );

  return (
    <Animated.View
      style={style}
      onLayout={(e: LayoutChangeEvent) => {
        const h = e.nativeEvent.layout.height;
        if (h !== lastMeasuredHeight.current) {
          lastMeasuredHeight.current = h;
          onMeasure(itemKey, h);
        }
      }}
    >
      {renderItem({ item, index, isActive: isActiveState, dragHandle })}
    </Animated.View>
  );
}
