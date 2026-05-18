import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Turmas from './pages/Turmas';
import Alunos from './pages/Alunos';
import Faltas from './pages/Faltas';

const nav = { display: 'flex', gap: 8, padding: '12px 16px', background: '#1e40af', alignItems: 'center' };
const linkStyle = { color: '#bfdbfe', textDecoration: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 14 };
const activeStyle = { ...linkStyle, background: '#1d4ed8', color: 'white', fontWeight: 600 };

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <div style={{ minHeight: '100vh' }}>
        <nav style={nav}>
          <span style={{ color: 'white', fontWeight: 700, marginRight: 16 }}>📚 Diário de Classe</span>
          <NavLink to="/" end style={({ isActive }) => isActive ? activeStyle : linkStyle}>Turmas</NavLink>
          <NavLink to="/alunos" style={({ isActive }) => isActive ? activeStyle : linkStyle}>Alunos</NavLink>
          <NavLink to="/faltas" style={({ isActive }) => isActive ? activeStyle : linkStyle}>Faltas</NavLink>
        </nav>
        <div style={{ padding: 16, maxWidth: 900, margin: '0 auto' }}>
          <Routes>
            <Route path="/" element={<Turmas />} />
            <Route path="/alunos" element={<Alunos />} />
            <Route path="/faltas" element={<Faltas />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  </React.StrictMode>
);
