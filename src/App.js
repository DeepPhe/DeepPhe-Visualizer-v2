import React from "react";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { DEEPPHE_API_LOCATION } from "./config";
import DebugView from "./views/debug";
import FiltersView from "./views/filters";
import FilterBarChartDemoView from "./views/filter-bar-chart-demo";
import FilterListControlDemoView from "./views/filter-list-control-demo";
import HorizontalBarChartDemoView from "./views/horizontal-bar-chart-demo";

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
        <Link to="/filters">Open Filters View</Link>
      </p>
      <p>
        <Link to="/filter-bar-chart-demo">Open Filter Bar Chart Demo</Link>
      </p>
      <p>
        <Link to="/filter-list-control-demo">Open Filter List Control Demo</Link>
      </p>
      <p>
        <Link to="/horizontal-bar-chart-demo">Open Horizontal Bar Chart Demo</Link>
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
        <Route path="/" element={<HomeView />} />
        <Route path="/debug" element={<DebugView />} />
        <Route path="/filters" element={<FiltersView />} />
        <Route
          path="/filter-bar-chart-demo"
          element={<FilterBarChartDemoView />}
        />
        <Route
          path="/filter-list-control-demo"
          element={<FilterListControlDemoView />}
        />
        <Route
          path="/horizontal-bar-chart-demo"
          element={<HorizontalBarChartDemoView />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
