import React from "react";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { DEEPPHE_API_LOCATION } from "./config";
import DebugView from "./views/debug";

function HomeView() {
  return (
    <main className="app">
      <h1>Viz3 React App</h1>
      <p>CRACO is configured and dependencies are aligned to your Viz2 package versions.</p>
      <p>
        <strong>DEEPPHE_API_LOCATION:</strong> {DEEPPHE_API_LOCATION}
      </p>
      <p>
        <Link to="/debug">Open Debug View</Link>
      </p>
    </main>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeView />} />
        <Route path="/debug" element={<DebugView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
