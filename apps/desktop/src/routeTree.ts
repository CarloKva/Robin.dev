/**
 * Hand-rolled route tree.
 *
 * TanStack Router supports a file-based route generator, but we're keeping the
 * tree explicit so Tauri's WebKit bundle remains small and so deep-link wiring
 * (`robin://...`) can resolve routes deterministically without filesystem
 * scanning at build time.
 */
import { Route as RootRoute } from './routes/__root';
import { Route as SignInRoute } from './routes/sign-in';
import { Route as PopoverLayoutRoute } from './routes/popover/__layout';
import { Route as PopoverInboxRoute } from './routes/popover/inbox';
import { Route as PopoverInProgressRoute } from './routes/popover/in-progress';
import { Route as PopoverHistoryRoute } from './routes/popover/history';
import { Route as PopoverSettingsRoute } from './routes/popover/settings';
import { Route as PopoverTaskRoute } from './routes/popover/task.$taskId';
import { Route as ExpandedRootRoute } from './routes/expanded/__root';
import { Route as ExpandedAgentRoute } from './routes/expanded/agents.$agentId';
import { Route as ExpandedSettingsGithubRoute } from './routes/expanded/settings.github';
import { Route as InternalStoriesRoute } from './routes/_internal/stories';

export const routeTree = RootRoute.addChildren([
  SignInRoute,
  PopoverLayoutRoute.addChildren([
    PopoverInboxRoute,
    PopoverInProgressRoute,
    PopoverHistoryRoute,
    PopoverSettingsRoute,
    PopoverTaskRoute,
  ]),
  ExpandedRootRoute.addChildren([ExpandedAgentRoute, ExpandedSettingsGithubRoute]),
  InternalStoriesRoute,
]);
