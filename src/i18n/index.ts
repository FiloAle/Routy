import { getLocales } from "expo-localization";
import { I18n } from "i18n-js";

import en from "./locales/en.json";
import it from "./locales/it.json";

const translations = {
	en,
	it,
};

const i18n = new I18n(translations);

// Set the locale once at the beginning of the app.
const locales = getLocales();
const languageCode = locales[0]?.languageCode;
i18n.locale = languageCode && translations[languageCode as keyof typeof translations] ? languageCode : "en";

// When a value is missing from a language it'll fallback to another language with the key present.
i18n.enableFallback = true;

export default i18n;
export const t = (key: string, options?: any) => i18n.t(key, options);
