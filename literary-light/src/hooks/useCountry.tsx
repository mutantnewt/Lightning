import { useState, useEffect, createContext, useContext, ReactNode } from "react";

// Supported Amazon affiliate countries
export const COUNTRIES = {
  US: { code: "US", name: "United States", amazonDomain: "amazon.com" },
  UK: { code: "UK", name: "United Kingdom", amazonDomain: "amazon.co.uk" },
  CA: { code: "CA", name: "Canada", amazonDomain: "amazon.ca" },
  DE: { code: "DE", name: "Germany", amazonDomain: "amazon.de" },
  FR: { code: "FR", name: "France", amazonDomain: "amazon.fr" },
  AU: { code: "AU", name: "Australia", amazonDomain: "amazon.com.au" },
} as const;

export type CountryCode = keyof typeof COUNTRIES;

interface CountryContextType {
  country: CountryCode;
  setCountry: (country: CountryCode) => void;
  amazonDomain: string;
}

const CountryContext = createContext<CountryContextType | undefined>(undefined);

const COUNTRY_STORAGE_KEY = "literary-light-country";

async function detectCountry(): Promise<CountryCode> {
  try {
    // Use a free IP geolocation API
    const response = await fetch("https://ipapi.co/country_code/", { 
      signal: AbortSignal.timeout(3000) 
    });
    if (response.ok) {
      const code = await response.text();
      // Map to our supported countries
      if (code === "GB") return "UK";
      if (code in COUNTRIES) return code as CountryCode;
    }
  } catch (e) {
    console.log("Country detection failed, using default");
  }
  return "US"; // Default to US
}

export function CountryProvider({ children }: { children: ReactNode }) {
  const [country, setCountryState] = useState<CountryCode>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(COUNTRY_STORAGE_KEY) as CountryCode;
      if (stored && stored in COUNTRIES) return stored;
    }
    return "US";
  });
  const [detected, setDetected] = useState(false);

  useEffect(() => {
    // Only auto-detect if no stored preference
    const stored = localStorage.getItem(COUNTRY_STORAGE_KEY);
    if (!stored && !detected) {
      detectCountry().then((detectedCountry) => {
        setCountryState(detectedCountry);
        setDetected(true);
      });
    }
  }, [detected]);

  const setCountry = (newCountry: CountryCode) => {
    setCountryState(newCountry);
    localStorage.setItem(COUNTRY_STORAGE_KEY, newCountry);
  };

  return (
    <CountryContext.Provider 
      value={{ 
        country, 
        setCountry, 
        amazonDomain: COUNTRIES[country].amazonDomain 
      }}
    >
      {children}
    </CountryContext.Provider>
  );
}

export function useCountry() {
  const context = useContext(CountryContext);
  if (!context) {
    throw new Error("useCountry must be used within a CountryProvider");
  }
  return context;
}
