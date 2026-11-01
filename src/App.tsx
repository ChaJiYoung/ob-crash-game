import React from 'react';
import { PCGamePage } from './pc/PCGamePage';
import { MobileControllerPage } from './controller/MobileControllerPage';

export function resolveRouteMode(pathname: string, search: string): 'PC' | 'CONTROLLER' {
  if (pathname.startsWith('/controller') || new URLSearchParams(search).has('room')) {
    return 'CONTROLLER';
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

  return <PCGamePage />;
};

export default App;
