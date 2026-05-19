import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Alunos from './pages/Alunos';
import Faltas from './pages/Faltas';
import Importar from './pages/Importar';
import Turmas from './pages/Turmas';
import Dashboard from './pages/Dashboard';
import OCR from './pages/OCR';

const nav = { display: 'flex', gap: 2, padding: '10px 12px', background: '#1e40af', alignItems: 'center', flexWrap: 'wrap' as const };
const linkStyle = { color: '#bfdbfe', textDecoration: 'none', padding: '6px 10px', borderRadius: 6, fontSize: 13 };
const activeStyle = { ...linkStyle, background: '#1d4ed8', color: 'white', fontWeight: 600 };

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
        <nav style={nav}>
          <span style={{ color: 'white', fontWeight: 700, marginRight: 8, fontSize: 14, whiteSpace: 'nowrap' }}>📚 Diário</span>
          <NavLink to="/" end style={({ isActive }) => isActive ? activeStyle : linkStyle}>📊 Dashboard</NavLink>
          <NavLink to="/importar" style={({ isActive }) => isActive ? activeStyle : linkStyle}>📥 Importar</NavLink>
          <NavLink to="/turmas" style={({ isActive }) => isActive ? activeStyle : linkStyle}>👩‍🏫 Turmas</NavLink>
          <NavLink to="/alunos" style={({ isActive }) => isActive ? activeStyle : linkStyle}>👥 Alunos</NavLink>
          <NavLink to="/faltas" style={({ isActive }) => isActive ? activeStyle : linkStyle}>📋 Faltas</NavLink>
          <NavLink to="/ocr" style={({ isActive }) => isActive ? activeStyle : linkStyle}>📷 OCR</NavLink>
          <span style={{ marginLeft: 'auto' }}>
            <a
              href="https://github.com/ricardojoliveira313/diario_classe"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#93c5fd', textDecoration: 'none', padding: '6px 8px', borderRadius: 6, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <svg height="15" width="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              GitHub
            </a>
          </span>
        </nav>
        <div style={{ padding: 16, maxWidth: 960, margin: '0 auto' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/importar" element={<Importar />} />
            <Route path="/turmas" element={<Turmas />} />
            <Route path="/alunos" element={<Alunos />} />
            <Route path="/faltas" element={<Faltas />} />
            <Route path="/ocr" element={<OCR />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  </React.StrictMode>
);
