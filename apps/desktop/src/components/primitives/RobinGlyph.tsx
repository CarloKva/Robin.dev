interface RobinGlyphProps {
  size?: number;
  color?: string;
  className?: string;
}

export function RobinGlyph({ size = 14, color, className }: RobinGlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M4 13 V3 H9 a3 3 0 0 1 0 6 H4.5 M8 9 L12.5 13"
        stroke={color ?? 'currentColor'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
