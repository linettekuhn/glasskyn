import type { AnnotationAction, CircleAnnotation } from "@/types";

export function nextOrder(circles: CircleAnnotation[]): number {
  return circles.reduce(
    (max, c) => Math.max(max, c.createdOrder),
    0,
  ) + 1;
}

export function renumber(circles: CircleAnnotation[]): CircleAnnotation[] {
  return [...circles]
    .sort((a, b) => a.createdOrder - b.createdOrder)
    .map((c, i) => ({ ...c, number: i + 1 }));
}

export function findNextUnlabeled(
  circles: CircleAnnotation[],
): CircleAnnotation | null {
  return [...circles]
    .sort((a, b) => a.createdOrder - b.createdOrder)
    .find((c) => c.status === "unlabeled") ?? null;
}

export function allSettled(circles: CircleAnnotation[]): boolean {
  return circles.length > 0 && circles.every((c) => c.status !== "unlabeled");
}

export function reverseAction(
  circles: CircleAnnotation[],
  action: AnnotationAction,
): CircleAnnotation[] {
  switch (action.type) {
    case "place":
      return renumber(circles.filter((c) => c.uuid !== action.circle.uuid));
    case "delete":
      return renumber([...circles, action.circle]);
    case "move":
      return renumber(
        circles.map((c) =>
          c.uuid === action.uuid
            ? { ...c, x: action.prev.x, y: action.prev.y }
            : c,
        ),
      );
  }
}