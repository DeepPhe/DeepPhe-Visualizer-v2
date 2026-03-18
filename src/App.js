import React from "react";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { DEEPPHE_API_LOCATION } from "./config";
import DebugView from "./views/debug";
import FilterBarChartDemoView from "./views/filter-bar-chart-demo";
import FilterListControlDemoView from "./views/filter-list-control-demo";

function HomeView() {
  return (
    <main className="app">
      <h1>DeepPhe Visualizer v3</h1>
      <p>
        <strong>DEEPPHE_API_LOCATION:</strong> {DEEPPHE_API_LOCATION}
      </p>
      <p>
        <Link to="/debug">Open Debug View</Link>
      </p>
      <p>
        <Link to="/filter-bar-chart-demo">Open Filter Bar Chart Demo</Link>
      </p>
      <p>
        <Link to="/filter-list-control-demo">Open Filter List Control Demo</Link>
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
        <Route
          path="/filter-bar-chart-demo"
          element={<FilterBarChartDemoView />}
        />
        <Route
          path="/filter-list-control-demo"
          element={<FilterListControlDemoView />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
