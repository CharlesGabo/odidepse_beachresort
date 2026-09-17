import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import IndexPage from './pages/index/IndexPage.jsx';
import './shared/styles/global.css';
import './pages/index/styles/resort-info.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <IndexPage />
  </StrictMode>,
);
