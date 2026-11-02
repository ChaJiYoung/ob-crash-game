import React from 'react';
import { PCGamePage } from './pc/PCGamePage';
import { MobileControllerPage } from './controller/MobileControllerPage';

export function resolveRouteMode(
  pathname: string,
  search: string
): 'PC' | 'CONTROLLER' | 'SANDBOX' {
  const params = new URLSearchParams(search);
  if (pathname.startsWith('/controller') || params.has('room')) {
    return 'CONTROLLER';
  }
  if (pathname.startsWith('/sensor-test') || params.get('mode') === 'test') {
    return 'SANDBOX';
  }
  return 'PC';
}

export const App: React.FC = () => {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const search = typeof window !== 'undefined' ? window.location.search : '';
  const mode = resolveRouteMode(pathname, search);

  if (mode === 'CONTROLLER') {
    return <MobileControllerPage />;
  }

  if (mode === 'SANDBOX') {
    return <PCGamePage initialPhase="SANDBOX" />;
  }

  return <PCGamePage />;
};

export default App;
