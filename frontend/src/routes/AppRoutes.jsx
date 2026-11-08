
import { Routes, Route, Navigate } from "react-router-dom";

import Dashboard from "../pages/Dashboard";
import ScheduledEmails from "../pages/ScheduledEmails";
import SentEmails from "../pages/SentEmails";
import ComposeEmail from "../pages/ComposeEmail";
import Login from "../pages/Login";
import ProtectedRoute from "../components/layout/ProtectedRoute";

const protect = (element) => (
  <ProtectedRoute>{element}</ProtectedRoute>
);

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={protect(<Dashboard />)} />
      <Route path="/scheduled" element={protect(<ScheduledEmails />)} />
      <Route path="/sent" element={protect(<SentEmails />)} />
      <Route path="/compose" element={protect(<ComposeEmail />)} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
