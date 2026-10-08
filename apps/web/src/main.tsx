import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from './lib/router';
import { AuthProvider } from './lib/auth';
import App from './App';
import './styles/global.css';
import './styles/site.css';
import './styles/console.css';
import './styles/pdf.css';
import './styles/ops.css';
import './styles/invoice.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element in index.html');

createRoot(container).render(
  <StrictMode>
    <RouterProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </RouterProvider>
  </StrictMode>
);
