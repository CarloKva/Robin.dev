/**
 * IPC helpers for surfacing the expanded window from the popover.
 * Falls back to no-op in browser dev so the renderer doesn't crash.
 */

const TAURI_AVAILABLE = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function focusExpandedAgent(agentId: string): Promise<void> {
  if (!TAURI_AVAILABLE) {
    window.location.assign(`/expanded/agents/${agentId}`);
    return;
  }
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('cmd_focus_agent', { agentId });
}

export async function showExpandedAtGithub(): Promise<void> {
  if (!TAURI_AVAILABLE) {
    window.location.assign('/expanded/settings/github');
    return;
  }
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('cmd_show_expanded', { agentId: null });
  // The expanded window renders its own router; deep-link there.
  window.dispatchEvent(new CustomEvent('robin:expanded:navigate', { detail: '/expanded/settings/github' }));
}
