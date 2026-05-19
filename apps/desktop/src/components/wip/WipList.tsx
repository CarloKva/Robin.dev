import type { WipTask } from '@/lib/realtime/useInProgressTasks';
import { WipCard } from './WipCard';

interface WipListProps {
  tasks: WipTask[];
}

export function WipList({ tasks }: WipListProps) {
  return (
    <div className="flex flex-col gap-2 px-3 pb-3">
      {tasks.map((task) => (
        <WipCard key={task.id} task={task} />
      ))}
    </div>
  );
}
