import { RobinGlyph } from './RobinGlyph';
import { cn } from '@/lib/cn';

interface RobinLogoTileProps {
  size?: number;
  className?: string;
}

export function RobinLogoTile({ size = 36, className }: RobinLogoTileProps) {
  const radius = Math.round(size * 0.28);
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center text-accent-ink',
        className,
      )}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: 'linear-gradient(135deg, #ff7e58 0%, #d63916 100%)',
        boxShadow: '0 4px 12px rgba(214, 57, 22, 0.25)',
      }}
      aria-hidden="true"
    >
      <RobinGlyph size={Math.round(size * 0.5)} color="#fff7f3" />
    </div>
  );
}
