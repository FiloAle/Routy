// Builds the String Catalogs from the Expo app's translations, so both apps say the same thing.
// Usage: node native/scripts/strings.mjs (from the repository root)
import { readFileSync, writeFileSync } from "node:fs";

const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const flatten = (object, prefix = "") =>
	Object.entries(object).flatMap(([key, value]) =>
		typeof value === "object" ? flatten(value, `${prefix}${key}.`) : [[`${prefix}${key}`, value]],
	);

// i18n-js placeholders ("%{name}") become positional format specifiers; a literal % is escaped.
let placeholders = 0;
const toFormat = (text) =>
	text.replace(/%(?!\{)/g, "%%").replace(/%\{\w+\}/g, () => `%${++placeholders}$@`);

// Keys nothing reads anymore in either app.
const UNUSED = new Set(["settings.status_disconnecting", "settings.status_disconnected", "common.info", "common.save"]);

function catalog(languages) {
	const keys = [...new Set(Object.values(languages).flatMap((entries) => entries.map(([key]) => key)))].sort();
	const strings = {};
	for (const key of keys) {
		if (UNUSED.has(key)) continue;
		const localizations = {};
		for (const [language, entries] of Object.entries(languages)) {
			const value = entries.find(([k]) => k === key)?.[1];
			if (value === undefined) throw new Error(`${language} is missing ${key}`);
			placeholders = 0;
			localizations[language] = { stringUnit: { state: "translated", value: toFormat(value) } };
		}
		strings[key] = { extractionState: "manual", localizations };
	}
	return JSON.stringify({ sourceLanguage: "en", strings, version: "1.0" }, null, 2) + "\n";
}

const locales = "src/i18n/locales";
// Strings only the native app needs, in the same shape as the Expo files.
const extra = read("native/scripts/strings-native.json");
writeFileSync(
	"native/Routy/Resources/Localizable.xcstrings",
	catalog({
		en: [...flatten(read(`${locales}/en.json`)), ...flatten(extra.en)],
		it: [...flatten(read(`${locales}/it.json`)), ...flatten(extra.it)],
	}),
);

const infoPlist = (path) => flatten(read(path)).filter(([key]) => key !== "CFBundleDisplayName");
writeFileSync(
	"native/Routy/Resources/InfoPlist.xcstrings",
	catalog({ en: infoPlist(`${locales}/en-native.json`), it: infoPlist(`${locales}/it-native.json`) }),
);
