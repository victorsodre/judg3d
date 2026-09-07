import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { resolveLocale, translate, type Locale } from "./messages.js";

const STORAGE_KEY = "judg3d.locale";
const LocaleContext = createContext<
  { locale: Locale; setLocale: (locale: Locale) => void } | undefined
>(undefined);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => {
    try {
      return resolveLocale(localStorage.getItem(STORAGE_KEY));
    } catch {
      return "en";
    }
  });
  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* Language switching still works when storage is blocked. */
    }
  }, [locale]);
  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (context === undefined) throw new Error("LocaleProvider is missing.");
  return { ...context, t: translate(context.locale) };
}
