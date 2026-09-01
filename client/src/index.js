import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import Spinner from "react-bootstrap/Spinner";

import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { ConfigProvider } from "./config/ConfigProvider";
import LoginPage from "./screens/LoginPage";
import App from "./App";

import "bootstrap/dist/css/bootstrap.min.css";
import "./index.css";
import "./theme.css";

function RequireAuth() {
  const { status } = useAuth();
  if (status === "loading") {
    return (
      <div className="d-flex justify-content-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }
  if (status === "anon") {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <ConfigProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<App />}>
              <Route path="/" element={<div>home</div>} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </ConfigProvider>
  </BrowserRouter>
);
