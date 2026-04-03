import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./hooks/useTheme.tsx";
import { CountryProvider } from "./hooks/useCountry.tsx";
import { configureAmplifyAuth } from "./config/amplify.ts";
import App from "./App.tsx";
import "./index.css";

configureAmplifyAuth();

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <CountryProvider>
      <App />
    </CountryProvider>
  </ThemeProvider>
);
