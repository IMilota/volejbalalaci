import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import App from "./App";
import Volejbalalaci from "./volejbalalaci/volejbalalaci.js";

import { AppProvider } from "./app-provider";
import { UserProvider } from "./user-provider";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <BrowserRouter>
    <UserProvider>
      <AppProvider>
        <Routes>
          <Route path="/" element={<App />}>
            <Route path="" element={<Volejbalalaci />}></Route>
          </Route>
        </Routes>
      </AppProvider>
    </UserProvider>
  </BrowserRouter>
);
