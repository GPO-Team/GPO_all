import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import RequireAuth from "./components/auth/RequireAuth";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Warehouse = lazy(() => import("./pages/Warehouse"));
const Login = lazy(() => import("./pages/Login"));

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Suspense fallback={null}><Login /></Suspense>} />
      <Route path="/warehouse" element={<Suspense fallback={<div className="p-8 text-stone-600">Загрузка склада…</div>}><Warehouse /></Suspense>} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth><Suspense fallback={null}>
            <Dashboard />
          </Suspense></RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
