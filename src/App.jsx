import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Warehouse = lazy(() => import("./pages/Warehouse"));

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/warehouse" element={<Suspense fallback={<div className="p-8 text-stone-600">Загрузка склада…</div>}><Warehouse /></Suspense>} />
      <Route
        path="/dashboard"
        element={
          <Suspense fallback={null}>
            <Dashboard />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
