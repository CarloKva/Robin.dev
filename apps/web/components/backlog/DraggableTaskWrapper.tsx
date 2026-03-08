"use client";

import { useRef } from "react";
import { useDrag } from "react-dnd";
import { cn } from "@/lib/utils";

export const TASK_DND_TYPE = "BACKLOG_TASK";

export interface TaskDragItem {
  taskId: string;
}

interface Props {
  taskId: string;
  children: React.ReactNode;
  justLanded?: boolean;
}

export function DraggableTaskWrapper({ taskId, children, justLanded = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag<TaskDragItem, unknown, { isDragging: boolean }>({
    type: TASK_DND_TYPE,
    item: { taskId },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  drag(ref);

  return (
    <div
      ref={ref}
      className={cn(
        "cursor-grab active:cursor-grabbing",
        isDragging && "border border-dashed border-border/60 rounded-sm mx-1 my-0.5",
        justLanded && "animate-task-landing"
      )}
    >
      <div className={isDragging ? "invisible" : ""}>{children}</div>
    </div>
  );
}
