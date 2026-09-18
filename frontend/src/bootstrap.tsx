import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import CensoProfessorFormulario from './pages/CensoProfessorFormulario';
import CensoProfessorConvites from './pages/CensoProfessorConvites';
import { ThemeProvider } from './ThemeContext';

const root = document.getElementById('root')!;
const rotaPublica = /^\/censo-professor\/[0-9a-f]{64}\/?$/i.test(window.location.pathname);

if (rotaPublica) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ThemeProvider>
        <BrowserRouter>
          <CensoProfessorFormulario />
        </BrowserRouter>
      </ThemeProvider>
    </React.StrictMode>,
  );
} else {
  void import('./main').then(() => {
    let host: HTMLDivElement | null = null;
    let painelRoot: ReturnType<typeof ReactDOM.createRoot> | null = null;

    const desmontar = () => {
      painelRoot?.unmount();
      painelRoot = null;
      host?.remove();
      host = null;
    };

    const montar = () => {
      if (window.location.pathname !== '/educacenso-docentes') {
        desmontar();
        return;
      }
      if (host?.isConnected) return;
      const appRoot = document.getElementById('root');
      const shell = appRoot?.firstElementChild as HTMLElement | null;
      const content = shell?.children?.[1] as HTMLElement | undefined;
      if (!content) {
        window.setTimeout(montar, 80);
        return;
      }
      host = document.createElement('div');
      host.id = 'censo-professor-coleta-slot';
      content.prepend(host);
      painelRoot = ReactDOM.createRoot(host);
      painelRoot.render(<CensoProfessorConvites />);
    };

    const agendar = () => window.setTimeout(montar, 0);
    const pushState = history.pushState.bind(history);
    const replaceState = history.replaceState.bind(history);
    history.pushState = (...args) => { pushState(...args); agendar(); };
    history.replaceState = (...args) => { replaceState(...args); agendar(); };
    window.addEventListener('popstate', agendar);
    agendar();
  });
}
