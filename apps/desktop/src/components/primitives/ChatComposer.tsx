import { useCallback, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Paperclip, Send, Settings2 } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Btn } from './Btn';
import { IconBtn } from './IconBtn';

interface ChatComposerProps {
  placeholder?: string;
  onSend: (value: string) => void;
  agentHue?: number;
  disabled?: boolean;
  className?: string;
}

const MAX_HEIGHT = 120;
const MIN_HEIGHT = 38;

export function ChatComposer({
  placeholder = 'Message…',
  onSend,
  agentHue,
  disabled,
  className,
}: ChatComposerProps) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    const next = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, el.scrollHeight));
    el.style.height = `${next}px`;
  }, []);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    requestAnimationFrame(resize);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const accentOverride = agentHue !== undefined
    ? ({ '--accent': `hsl(${agentHue}, 70%, 46%)` } as React.CSSProperties)
    : undefined;

  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-popover-edge p-2 shadow-card',
        className,
      )}
      style={accentOverride}
    >
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          requestAnimationFrame(resize);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="block w-full resize-none border-0 bg-transparent px-1.5 py-1 text-sm leading-snug text-ink placeholder:text-ink4 focus:outline-none"
        style={{ height: MIN_HEIGHT }}
      />
      <div className="mt-1 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <IconBtn label="Attach" disabled={disabled}>
            <Paperclip size={14} />
          </IconBtn>
          <IconBtn label="Composer settings" disabled={disabled}>
            <Settings2 size={14} />
          </IconBtn>
        </div>
        <Btn
          variant="primary"
          size="sm"
          icon={<Send size={12} />}
          onClick={submit}
          disabled={disabled || !value.trim()}
        >
          Send
        </Btn>
      </div>
    </div>
  );
}
