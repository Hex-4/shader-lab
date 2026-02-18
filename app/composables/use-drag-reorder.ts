type DragReorderOptions = {
  /** Transition duration in ms for non-dragged items sliding into place. Default: 200 */
  animation?: number;
};

/**
 * Composable for smooth drag-to-reorder on a vertical list.
 *
 * Usage:
 * ```ts
 * const { containerRef, draggingIndex } = useDragReorder(items)
 * ```
 *
 * Bind `containerRef` to the list wrapper element.
 * Each direct child of that element becomes a draggable item.
 * `draggingIndex` is reactive — use it to style the dragged row.
 */
export function useDragReorder<T>(
  list: Ref<T[]>,
  options: DragReorderOptions = {},
) {
  const { animation = 200 } = options;
  const containerRef = ref<HTMLElement | null>(null);
  const draggingIndex = ref<number | null>(null);

  // Easing matching the project's ease-out-expo
  const easing = "cubic-bezier(0.19, 1, 0.22, 1)";

  // Internal drag state (not reactive — perf-critical, updated every pointermove)
  let startY = 0;
  let dragFrom = -1;
  let currentTarget = -1;
  let rowRects: { top: number; height: number; midY: number }[] = [];
  let active = false;

  function getChildren(): HTMLElement[] {
    if (!containerRef.value) return [];
    return Array.from(containerRef.value.children) as HTMLElement[];
  }

  function cacheRects() {
    const children = getChildren();
    rowRects = children.map((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, height: r.height, midY: r.top + r.height / 2 };
    });
  }

  function getTargetIndex(draggedCenterY: number): number {
    // Swap when the dragged item's center crosses into the neighboring row's space.
    // The boundary between two rows is the top edge of the lower row
    // (or equivalently, the bottom edge of the upper row).
    // This means you need to drag ~half a row height to trigger a swap.
    let target = dragFrom;

    // Check downward: swap when dragged center passes the top edge of the next row
    for (let i = dragFrom + 1; i < rowRects.length; i++) {
      if (draggedCenterY > rowRects[i]!.top) target = i;
      else break;
    }

    // Check upward (only if we haven't moved down)
    if (target === dragFrom) {
      for (let i = dragFrom - 1; i >= 0; i--) {
        const bottomEdge = rowRects[i]!.top + rowRects[i]!.height;
        if (draggedCenterY < bottomEdge) target = i;
        else break;
      }
    }

    return target;
  }

  function applyTransforms(target: number) {
    const children = getChildren();
    const draggedHeight = rowRects[dragFrom]?.height ?? 0;

    for (let i = 0; i < children.length; i++) {
      if (i === dragFrom) continue;
      const el = children[i]!;

      let shift = 0;
      // Items between dragFrom and target need to shift to fill the gap
      if (dragFrom < target) {
        // Dragging down: items between (dragFrom, target] shift up
        if (i > dragFrom && i <= target) shift = -draggedHeight;
      } else if (dragFrom > target) {
        // Dragging up: items between [target, dragFrom) shift down
        if (i >= target && i < dragFrom) shift = draggedHeight;
      }

      el.style.transition = `transform ${animation}ms ${easing}`;
      el.style.transform = shift ? `translateY(${shift}px)` : "";
    }
  }

  function clearTransforms() {
    const children = getChildren();
    for (const el of children) {
      el.style.transition = "";
      el.style.transform = "";
      el.style.position = "";
      el.style.zIndex = "";
    }
  }

  function commitReorder(from: number, to: number) {
    if (from === to) return;
    const updated = [...list.value];
    const [moved] = updated.splice(from, 1);
    if (moved) {
      updated.splice(to, 0, moved);
      list.value = updated;
    }
  }

  function onPointerDown(e: PointerEvent) {
    // Only primary button
    if (e.button !== 0) return;

    // Find which direct child was clicked
    const container = containerRef.value;
    if (!container) return;
    const target = e.target as HTMLElement;

    // Don't drag if clicking a button or interactive element
    if (target.closest("button")) return;

    const children = getChildren();
    const child = target.closest<HTMLElement>(":scope > *");
    // :scope > * doesn't work with closest. Find the direct child manually.
    let clickedChild: HTMLElement | null = null;
    let node: HTMLElement | null = target;
    while (node && node !== container) {
      if (node.parentElement === container) {
        clickedChild = node;
        break;
      }
      node = node.parentElement;
    }
    if (!clickedChild) return;

    const index = children.indexOf(clickedChild);
    if (index === -1) return;

    startY = e.clientY;
    dragFrom = index;
    active = false;

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("keydown", onKeyDown);
  }

  function onPointerMove(e: PointerEvent) {
    const deltaY = e.clientY - startY;

    // Dead zone: 4px before activating
    if (!active) {
      if (Math.abs(deltaY) < 4) return;
      active = true;
      draggingIndex.value = dragFrom;
      cacheRects();
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
    }

    // Move dragged element to follow pointer
    const children = getChildren();
    const draggedEl = children[dragFrom];
    if (draggedEl) {
      draggedEl.style.transform = `translateY(${deltaY}px)`;
      draggedEl.style.position = "relative";
      draggedEl.style.zIndex = "10";
      draggedEl.style.transition = "none";
    }

    // Figure out where we'd drop based on the dragged item's current center.
    // deltaY is exactly how far the item has moved, so its center is its
    // original midY + deltaY. Swap triggers when this crosses another row's midpoint.
    const draggedCenterY = rowRects[dragFrom]!.midY + deltaY;
    const target = getTargetIndex(draggedCenterY);
    if (target !== currentTarget) {
      currentTarget = target;
      applyTransforms(target);
    }
  }

  function animateSettle(finalY: number, onDone: () => void) {
    const children = getChildren();
    const draggedEl = children[dragFrom];
    if (!draggedEl) { onDone(); return; }

    draggedEl.style.transition = `transform ${animation}ms ${easing}`;
    draggedEl.style.transform = finalY ? `translateY(${finalY}px)` : "";

    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      draggedEl.removeEventListener("transitionend", onSettled);
      onDone();
    };
    const onSettled = () => settle();
    draggedEl.addEventListener("transitionend", onSettled);
    setTimeout(settle, animation + 50);
  }

  function onPointerUp() {
    if (!active) {
      cleanup();
      return;
    }

    // Remove window listeners early so no further pointermove fires
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("keydown", onKeyDown);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";

    const swapped = dragFrom !== currentTarget && currentTarget !== -1;
    const finalY = swapped
      ? rowRects[currentTarget]!.top - rowRects[dragFrom]!.top
      : 0; // Animate back to original position

    animateSettle(finalY, () => {
      if (swapped) commitReorder(dragFrom, currentTarget);
      clearTransforms();
      cleanup();
    });
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      clearTransforms();
      cleanup();
    }
  }

  function cleanup() {
    active = false;
    draggingIndex.value = null;
    dragFrom = -1;
    currentTarget = -1;
    rowRects = [];
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("keydown", onKeyDown);
  }

  onMounted(() => {
    containerRef.value?.addEventListener("pointerdown", onPointerDown);
  });

  onUnmounted(() => {
    containerRef.value?.removeEventListener("pointerdown", onPointerDown);
    cleanup();
  });

  return { containerRef, draggingIndex };
}
