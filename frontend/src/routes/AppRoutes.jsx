
import { Routes, Route, Navigate } from "react-router-dom";

import Dashboard from "../pages/Dashboard";
import ScheduledEmails from "../pages/ScheduledEmails";
import SentEmails from "../pages/SentEmails";

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />

      <Route
        path="/scheduled"
        element={<ScheduledEmails />}
      />

      <Route
        path="/sent"
        element={<SentEmails />}
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
