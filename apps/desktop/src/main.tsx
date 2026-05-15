import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { initSentry } from '@/lib/telemetry/sentry';
import { track } from '@/lib/telemetry/events';
import './styles/fonts.css';
import './styles/theme.css';
import './styles/globals.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

void initSentry();
track({ name: 'desktop.launched', props: { firstRun: !localStorage.getItem('robin-session') } });

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
