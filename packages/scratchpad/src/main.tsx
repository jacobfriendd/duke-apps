import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// AG Grid styles
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

if (!window.__INFORMER__?.openChat) {
  window.__INFORMER__ = {
    openChat: (opts) => console.log('openChat:', opts),
    registerTool: (def) => console.log('registerTool:', def.name),
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
