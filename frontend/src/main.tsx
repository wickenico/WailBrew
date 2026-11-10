import React from "react";
import { createRoot } from "react-dom/client";
import WailBrewApp from "./App";
import { ThemeProvider } from "./context/ThemeContext";
import "./i18n";
import "./style.css";

const container = document.getElementById("root");

if (!container) {
    throw new Error("Root element #root not found");
}

const root = createRoot(container);

root.render(
    <React.StrictMode>
        <ThemeProvider>
            <WailBrewApp />
        </ThemeProvider>
    </React.StrictMode>,
);
