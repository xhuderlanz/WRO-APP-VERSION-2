import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App'; // o donde montes WROPlaybackPlanner
import './index.css';    // <= IMPORTANTE

createRoot(document.getElementById('root')).render(<App />);
