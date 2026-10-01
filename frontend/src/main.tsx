import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "maplibre-gl/dist/maplibre-gl.css";
import { App } from "./App";
import { ClimateDataProvider } from "./data/ClimateData";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ClimateDataProvider>
        <App />
      </ClimateDataProvider>
    </BrowserRouter>
  </StrictMode>,
);
