import React from "react";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { DEEPPHE_API_LOCATION } from "./config";
import FiltersView from "./views/filters";
import AccessibilityStatement from "./views/AccessibilityStatement";
import FilterSetsConfigView from "./views/FilterSetsConfigView";
import PatientView from "./views/patient";
import PerfPanel from "./components/PerfPanel";
import FeedbackWidget from "./components/FeedbackWidget";

const SHOW_PERF_TRACKER = false;

function HomeView() {
  return (
    <main className="app">
      <h1>DeepPhe Visualizer v2</h1>
      <p>
        <strong>DEEPPHE_API_LOCATION:</strong> {DEEPPHE_API_LOCATION}
      </p>
      <p>
        <Link to="/">Open Filters View</Link>
      </p>
      <p>
        <Link to="/accessibility">Accessibility Statement</Link>
      </p>
      <p>
        <Link to="/filter-sets-config">Open Filter Sets Config</Link>
      </p>
      <p>
        <Link to="/patient">Open Patient View</Link>
      </p>
    </main>
  );
}

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/" element={<FiltersView />} />
        <Route path="/debug" element={<HomeView />} />
        <Route path="/accessibility" element={<AccessibilityStatement />} />
        <Route path="/filter-sets-config" element={<FilterSetsConfigView />} />
        <Route path="/patient" element={<PatientView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {SHOW_PERF_TRACKER ? <PerfPanel /> : null}
      <FeedbackWidget />
    </BrowserRouter>
  );
}

export default App;
