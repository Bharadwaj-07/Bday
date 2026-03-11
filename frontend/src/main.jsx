import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: '#171b25',
          color: '#f8fafc',
          border: '1px solid #2a2f40',
          borderRadius: '10px',
          fontSize: '0.875rem',
        },
        success: { iconTheme: { primary: '#22c55e', secondary: '#171b25' } },
        error:   { iconTheme: { primary: '#ef4444', secondary: '#171b25' } },
      }}
    />
  </React.StrictMode>
);
