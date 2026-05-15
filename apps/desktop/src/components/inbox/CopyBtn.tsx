import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

import { IconBtn } from '@/components/primitives/IconBtn';

interface CopyBtnProps {
  text: string;
}

export function CopyBtn({ text }: CopyBtnProps) {
  const [copied, setCopied] = useState(false);

  return (
    <IconBtn
      label={copied ? 'Copied' : 'Copy letter'}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </IconBtn>
  );
}
