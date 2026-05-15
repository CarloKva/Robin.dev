import { useEffect } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase/client';
import { connectionStateStore } from './connectionState';

interface UseChannelOptions {
  channelName: string;
  table: string;
  filter?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  onPayload: (payload: Record<string, unknown>) => void;
  enabled?: boolean;
}

/**
 * Thin wrapper around `supabase.channel(...).on('postgres_changes', ...)`.
 *
 * Reports its connection state into the shared `connectionStateStore` so the
 * disconnected overlay (M11) can flip based on aggregated channel health.
 * Channels that filter on the same table re-use the same subscription via
 * Supabase's internal multiplexing.
 */
export function useChannel({
  channelName,
  table,
  filter,
  event = 'INSERT',
  onPayload,
  enabled = true,
}: UseChannelOptions): void {
  useEffect(() => {
    if (!enabled) return;
    let channel: RealtimeChannel | null = null;
    const client = supabase();
    channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { event, schema: 'public', table, ...(filter ? { filter } : {}) } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          if (payload.new) onPayload(payload.new as Record<string, unknown>);
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') connectionStateStore.set('connected');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          connectionStateStore.set('disconnected');
        }
      });

    return () => {
      if (channel) {
        void client.removeChannel(channel);
      }
    };
  }, [channelName, table, filter, event, onPayload, enabled]);
}
