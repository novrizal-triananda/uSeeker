import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import KeyboardNav from './components/KeyboardNav';
import OfflineIndicator from './components/OfflineIndicator';
import Dashboard from './pages/Dashboard';
import Triage from './pages/Triage';
import Research from './pages/Research';
import Tailoring from './pages/Tailoring';
import Visibility from './pages/Visibility';
import Insights from './pages/Insights';
import DataHub from './pages/DataHub';
import Settings from './pages/Settings';
import './App.css';

function App() {
  useEffect(() => {
    // Service worker disabled until V2 (offline PWA support).
    // Causes stale-cache white screens in dev/preview when sw.js is present in public/.
  }, []);

  return (
    <BrowserRouter>
      <OfflineIndicator />
      <KeyboardNav />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="triage" element={<Triage />} />
          <Route path="triage/:jobId" element={<Triage />} />
          <Route path="research" element={<Research />} />
          <Route path="research/:intelId" element={<Research />} />
          <Route path="tailoring" element={<Tailoring />} />
          <Route path="visibility" element={<Visibility />} />
          <Route path="insights" element={<Insights />} />
          <Route path="data-hub" element={<DataHub />} />
          <Route path="data-hub/prep/:jobId" element={<DataHub />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
