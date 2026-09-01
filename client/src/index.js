import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import Spinner from "react-bootstrap/Spinner";

import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { ConfigProvider } from "./config/ConfigProvider";
import { UsersProvider } from "./users/UsersProvider";
import LoginPage from "./screens/LoginPage";
import HomePage from "./screens/HomePage";
import EventListPage from "./screens/EventListPage";
import EventDetailPage from "./screens/EventDetailPage";
import BoardPage from "./screens/BoardPage";
import App from "./App";

import "bootstrap/dist/css/bootstrap.min.css";
import "./index.css";
import "./theme.css";

function RequireAuth() {
  const { status, error } = useAuth();
  if (status === "loading") {
    if (error) {
      return (
        <div className="container py-4">
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        </div>
      );
    }
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

function AuthedApp() {
  return (
    <UsersProvider>
      <App />
    </UsersProvider>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <ConfigProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<AuthedApp />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/events" element={<EventListPage />} />
              <Route path="/events/:id" element={<EventDetailPage />} />
              <Route path="board" element={<BoardPage />} />
              <Route path="*" element={<HomePage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </ConfigProvider>
  </BrowserRouter>
);
