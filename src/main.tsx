import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@jetbrains/int-ui-kit/styles.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
