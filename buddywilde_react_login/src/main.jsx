// src/main.jsx -------------------------------------------------
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';          // keep your global styles here
import App from './App.jsx';   // the login component we built earlier

// The element with id="root" will be injected by WordPress
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
