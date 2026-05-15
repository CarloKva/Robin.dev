/**
 * Renderer-side deep-link handler. Pairs with `src-tauri/src/deeplink.rs`
 * which emits `deeplink:received` events with `{ kind, path, raw }`.
 */

interface DeepLinkPayload {
  kind: string;
  path: string;
  raw: string;
}

type Router = {
  navigate: (opts: { to: string; params?: Record<string, string> }) => Promise<unknown>;
};

const TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function installDeepLinkRouter(router: Router): Promise<() => void> {
  if (!TAURI) return () => undefined;
  const { listen } = await import('@tauri-apps/api/event');
  const unlisten = await listen<DeepLinkPayload>('deeplink:received', (event) => {
    const { kind, path } = event.payload;
    switch (kind) {
      case 'auth': {
        const url = new URL(event.payload.raw);
        const state = url.searchParams.get('state');
        const code = url.searchParams.get('code');
        if (state && code) {
          window.dispatchEvent(
            new CustomEvent('robin:auth-callback', { detail: { state, code } }),
          );
        }
        break;
      }
      case 'task': {
        const id = path.replace(/^\/+/, '');
        if (id) void router.navigate({ to: '/popover/task/$taskId', params: { taskId: id } });
        break;
      }
      case 'agent': {
        const id = path.replace(/^\/+/, '');
        if (id) void router.navigate({ to: '/expanded/agents/$agentId', params: { agentId: id } });
        break;
      }
      default:
        break;
    }
  });
  return () => unlisten();
}
