import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./hooks/useTheme.tsx";
import { CountryProvider } from "./hooks/useCountry.tsx";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <CountryProvider>
      <App />
    </CountryProvider>
  </ThemeProvider>
);
