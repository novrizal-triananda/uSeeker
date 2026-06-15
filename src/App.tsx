import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import KeyboardNav from './components/KeyboardNav';
import OfflineIndicator from './components/OfflineIndicator';
import Dashboard from './pages/Dashboard';
import Triage from './pages/Triage';
import Research from './pages/Research';
import Presentation from './pages/Presentation';
import Visibility from './pages/Visibility';
import Insights from './pages/Insights';
import DataHub from './pages/DataHub';
import './App.css';

function App() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Service worker registration failed — non-critical
      });
    }
  }, []);

  return (
    <BrowserRouter>
      <OfflineIndicator />
      <KeyboardNav />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="triage" element={<Triage />} />
          <Route path="research" element={<Research />} />
          <Route path="presentation" element={<Presentation />} />
          <Route path="visibility" element={<Visibility />} />
          <Route path="insights" element={<Insights />} />
          <Route path="data-hub" element={<DataHub />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
