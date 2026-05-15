import { SectionHeader } from '@/components/primitives/SectionHeader';
import { LiveLabel } from '@/components/primitives/LiveDot';
import type { WipTask } from '@/lib/realtime/useInProgressTasks';
import { WipCard } from './WipCard';

interface WipListProps {
  tasks: WipTask[];
}

export function WipList({ tasks }: WipListProps) {
  return (
    <div className="py-2">
      <SectionHeader right={<LiveLabel />}>
        {tasks.length === 1 ? '1 in flight' : `${tasks.length} in flight`}
      </SectionHeader>
      {tasks.map((task) => (
        <WipCard key={task.id} task={task} />
      ))}
    </div>
  );
}
