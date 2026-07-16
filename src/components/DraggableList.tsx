import { useEffect, useRef, useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
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
 * Third-party drag-reorder libs (react-native-draggable-flatlist,
 * react-native-draglist) don't drag on web in this stack — confirmed via
 * manual spike. This is a from-scratch replacement built on the same
 * gesture-handler + reanimated combination already used elsewhere in the app
 * (PeriodTabs, ModalityToggle), which does receive pointer drags on web.
 *
 * Rows have no fixed height — every real use of this list (exercise cards
 * with wrapping target fields, live set-logging cards that grow as sets are
 * added) has variable content height. Each row measures itself via onLayout;
 * positions are the running sum of measured heights in the current order.
 */
export function DraggableList<T>({ data, keyExtractor, onReorder, renderItem }: Props<T>) {
  const order = useSharedValue<string[]>(data.map(keyExtractor));
  const heights = useSharedValue<Record<string, number>>({});
  const activeKey = useSharedValue<string | null>(null);
  const itemsByKey = useRef(new Map<string, T>());
  const [containerHeight, setContainerHeight] = useState(0);

  itemsByKey.current = new Map(data.map((item) => [keyExtractor(item), item]));

  useEffect(() => {
    const keys = data.map(keyExtractor);
    const sameSet = keys.length === order.value.length && keys.every((k) => order.value.includes(k));
    if (!sameSet && activeKey.value === null) {
      order.value = keys;
    }
  }, [data, keyExtractor, order, activeKey]);

  function handleReorder(finalOrder: string[]) {
    const reordered = finalOrder
      .map((key) => itemsByKey.current.get(key))
      .filter((item): item is T => item !== undefined);
    onReorder(reordered);
  }

  function handleMeasure(key: string, height: number) {
    if (heights.value[key] === height) return;
    heights.value = { ...heights.value, [key]: height };
    setContainerHeight(Object.values(heights.value).reduce((a, b) => a + b, 0));
  }

  return (
    <View style={{ height: containerHeight }}>
      {data.map((item, index) => {
        const key = keyExtractor(item);
        return (
          <Row
            key={key}
            itemKey={key}
            item={item}
            index={index}
            order={order}
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
  heights: ReturnType<typeof useSharedValue<Record<string, number>>>;
  activeKey: ReturnType<typeof useSharedValue<string | null>>;
  onMeasure: (key: string, height: number) => void;
  onReorder: (finalOrder: string[]) => void;
  renderItem: (info: DraggableListRenderInfo<T>) => React.ReactNode;
}) {
  const startTop = useSharedValue(0);
  const dragY = useSharedValue(0);
  const [isActiveState, setIsActiveState] = useState(false);
  const lastMeasuredHeight = useRef(0);

  const offsetForKey = (key: string): number => {
    "worklet";
    const ord = order.value;
    const hs = heights.value;
    let sum = 0;
    for (let i = 0; i < ord.length; i++) {
      if (ord[i] === key) break;
      sum += hs[ord[i]] ?? 0;
    }
    return sum;
  };

  const pan = Gesture.Pan()
    .onStart(() => {
      activeKey.value = itemKey;
      startTop.value = offsetForKey(itemKey);
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
      dragY.value = withTiming(0);
      activeKey.value = null;
      runOnJS(setIsActiveState)(false);
      runOnJS(onReorder)(order.value);
    });

  const style = useAnimatedStyle(() => {
    const active = activeKey.value === itemKey;
    const top = active ? startTop.value + dragY.value : withTiming(offsetForKey(itemKey));
    return {
      position: "absolute",
      left: 0,
      right: 0,
      top,
      zIndex: active ? 10 : 0,
      elevation: active ? 4 : 0,
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
