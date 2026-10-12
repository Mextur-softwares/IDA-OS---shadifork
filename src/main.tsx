import React from 'react';
import { createRoot } from 'react-dom/client';
import { CloudGate } from './CloudGate';
import './styles.css';
import './ida-redesign.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><CloudGate /></React.StrictMode>);
