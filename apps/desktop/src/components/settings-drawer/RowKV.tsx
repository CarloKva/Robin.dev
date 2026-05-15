interface RowKVProps {
  label: string;
  value: string;
}

export function RowKV({ label, value }: RowKVProps) {
  return (
    <div className="flex items-center justify-between text-2xs">
      <span className="text-ink3">{label}</span>
      <span className="font-mono text-ink">{value}</span>
    </div>
  );
}
