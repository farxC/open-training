import { useCallback, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
import Sortable, { useItemContext } from "react-native-sortables";
import type { SortableGridDragEndParams, SortableGridRenderItem } from "react-native-sortables";
import { runOnJS, useAnimatedReaction } from "react-native-reanimated";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

export interface SortableExerciseListRenderInfo<T> {
  item: T;
  index: number;
  isActive: boolean;
  /** Grip icon, unwrapped — place it inside <DragHandle> alongside whatever else should be draggable. */
  dragHandleIcon: React.ReactNode;
  /** Wraps the region that should activate dragging. Bigger than just the icon on purpose — wrap the
   * whole row header (icon + index + name) up to (not including) any Remove/delete control. */
  DragHandle: React.ComponentType<{ style?: StyleProp<ViewStyle>; children?: React.ReactNode }>;
}

interface Props<T> {
  data: T[];
  keyExtractor: (item: T) => string;
  onReorder: (newData: T[]) => void;
  renderItem: (info: SortableExerciseListRenderInfo<T>) => React.ReactNode;
}

/**
 * Same public contract as DraggableList (data/keyExtractor/onReorder/renderItem),
 * built on react-native-sortables instead of the hand-rolled gesture-handler +
 * reanimated implementation. `dragHandle` is split into `dragHandleIcon` (just
 * the icon) and `DragHandle` (the wrapping component) so consumers can make a
 * much larger area draggable than the icon alone.
 *
 * This is a parallel component, not a refactor — DraggableList.tsx is
 * untouched and unused once call sites switch to this one, so the original
 * stays available for comparison or rollback without any diff to it.
 */
export function SortableExerciseList<T>({ data, keyExtractor, onReorder, renderItem }: Props<T>) {
  const handleDragEnd = useCallback(
    ({ data: reordered }: SortableGridDragEndParams<T>) => {
      onReorder(reordered);
    },
    [onReorder]
  );

  const gridRenderItem = useCallback<SortableGridRenderItem<T>>(
    ({ index, item }) => <Row index={index} item={item} renderItem={renderItem} />,
    [renderItem]
  );

  return (
    <Sortable.Grid
      columns={1}
      customHandle
      data={data}
      keyExtractor={keyExtractor}
      dragActivationDelay={120}
      activeItemScale={1.03}
      onDragEnd={handleDragEnd}
      renderItem={gridRenderItem}
    />
  );
}

function Row<T>({
  item,
  index,
  renderItem,
}: {
  item: T;
  index: number;
  renderItem: (info: SortableExerciseListRenderInfo<T>) => React.ReactNode;
}) {
  const { isActive } = useItemContext();
  const [isActiveState, setIsActiveState] = useState(false);

  useAnimatedReaction(
    () => isActive.value,
    (active, prevActive) => {
      if (active !== prevActive) {
        runOnJS(setIsActiveState)(active);
      }
    }
  );

  const dragHandleIcon = (
    <View style={{ padding: 8 }}>
      <MaterialCommunityIcons name="drag-horizontal-variant" size={20} color="#928d80" />
    </View>
  );

  return (
    <>
      {renderItem({
        item,
        index,
        isActive: isActiveState,
        dragHandleIcon,
        DragHandle: Sortable.Handle,
      })}
    </>
  );
}
