import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Home } from "./pages/Home";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/en" replace />} />
        <Route path="/en" element={<Home />} />
        <Route path="/en/*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
