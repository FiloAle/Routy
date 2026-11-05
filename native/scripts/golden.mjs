// Runs the Expo app's own TypeScript on fixed inputs and writes what it returns to
// native/RoutyTests/golden.json. RoutyTests checks that the native app returns the same.
// Usage: node native/scripts/golden.mjs (from the repository root)
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// RouterApi logs every response.
console.log = () => {};
const print = console.info;
const ts = require("typescript");
const axios = require("axios");

// ── Loading the TypeScript sources with stubbed native modules ───────────────

const stubs = {};
function load(path) {
	const source = readFileSync(path, "utf8");
	const { outputText } = ts.transpileModule(source, {
		compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
	});
	const module = { exports: {} };
	const localRequire = (name) => stubs[name] ?? require(name);
	new Function("require", "module", "exports", outputText)(localRequire, module, module.exports);
	return module.exports;
}

const sms = load("src/utils/sms.ts");
stubs["../utils/sms"] = sms;
stubs["@/utils/sms"] = sms;
stubs["../i18n"] = { t: (key) => key };
stubs["crypto-js"] = require("crypto-js");

// The HTTP client RouterApi creates: answers GETs from a fixture and records every request.
let fixture = {};
let requests = [];
const fakeClient = {
	interceptors: { request: { use() {} }, response: { use() {} } },
	async get(_path, { params }) {
		requests.push({ method: "GET", params: Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
		const answer = fixture[params.cmd];
		return { data: typeof answer === "function" ? answer(params) : answer ?? {} };
	},
	async post(_path, body) {
		requests.push({ method: "POST", params: [...new URLSearchParams(body)] });
		return { data: { result: "success" } };
	},
};
stubs.axios = { create: () => fakeClient };
const { RouterApi } = load("src/services/router-api.ts");
const api = new RouterApi("http://192.168.0.1");

stubs["react-native"] = { Platform: { OS: "ios", Version: "26.0" } };
stubs["@/services/router-api"] = { isDisconnected: (d) => !d.ip || d.ip === "-" };
const deviceIcons = load("src/constants/deviceIcons.ts");
const wifi = load("src/utils/wifi.ts");
stubs["expo-contacts/legacy"] = {};
const { contactsService } = load("src/services/contacts-service.ts");

const local = (date) => {
	const pad = (n) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

// ── Cases ─────────────────────────────────────────────────────────────────────

const golden = {};

golden.hashes = [
	["admin", "A1B2C3"],
	["pässwörd 🔐", "0123456789ABCDEF"],
	["", "LD"],
].map(([password, ld]) => ({ password, ld, hash: api.hashPassword(password, ld) }));

fixture = {
	"cr_version,wa_inner_version": { cr_version: "CR_MF289FV1.0.0B05", wa_inner_version: "BD_MF289FV1.0.0B05" },
	RD: { RD: "9F3A1C" },
};
golden.adToken = { crVersion: "CR_MF289FV1.0.0B05", innerVersion: "BD_MF289FV1.0.0B05", rd: "9F3A1C", token: await api.getADToken() };

const texts = ["Ciao! Sei riuscito a sistemare il router?", "Porto io la pizza 🍕", "Sì, è fatta apposta per l'MF289F", "", " spazi \n"];
golden.ucs2 = texts.map((text) => ({ text, hex: sms.encodeZTE(text) }));
golden.ucs2Decode = ["004300690061006F", "D83CDF55", "00e800E9", "0041004", "zz41004200", "+393"].map((hex) => ({ hex, text: sms.decodeZTE(hex) }));

golden.dates = ["24,05,07,09,05,03,+8", "26,12,31,23,59,59,+1", "25,02,29,10,00,00,+1", "1,1,1,1,1,1"].map((value) => ({
	value,
	local: local(sms.parseZteDate(value)),
}));

const enc = (text) => sms.encodeZTE(text);
// Dates as a real MF289F lists them: received in quarters of an hour (8 in summer, 4 in winter), sent in hours.
const rawMessages = [
	{ id: "7", number: enc("+393331234567"), content: enc("Porto io la pizza 🍕 "), date: "26,11,05,18,10,00,4", tag: "1" },
	{ id: "6", number: enc("+393331234567"), content: enc("Ok"), date: "26,11,05,18,00,00,+1", tag: "2" },
	{ id: "5", number: enc("OPERATORE"), content: enc("Hai consumato l'80% dei GB"), date: "26,11,01,09,00,00,4", tag: "0" },
	{ id: "4", number: enc("+393331234567"), content: enc("Ciao"), date: "26,11,05,17,00,00,4", tag: "1" },
	{ id: "3", number: enc("40916"), content: enc("Codice 482913"), date: "26,10,20,08,00,00,8", tag: "1" },
	{ id: "2", number: enc("+393479876543"), content: enc("A dopo"), date: "26,11,05,18,10,00,4", tag: "0" },
	{ id: "1", number: enc("+393479876543"), content: enc("Stesso orario"), date: "26,11,05,18,10,00,+1", tag: "2" },
];
const readIds = ["4"];
golden.conversations = {
	raw: rawMessages,
	readIds,
	result: sms.groupByConversation(rawMessages, new Set(readIds)).map((c) => ({
		number: c.number,
		unreadCount: c.unreadCount,
		lastMessageId: c.lastMessage.id,
		messages: c.messages.map((m) => ({ id: m.id, number: m.number, content: m.content, date: local(m.date), isSent: m.isSent })),
	})),
};

const usageFixtures = [
	{
		ppp_status: "ppp_connected", wan_ipaddr: "100.64.12.34", monthly_rx_bytes: "335431254016", monthly_tx_bytes: 44774564659,
		spn_name_data: enc("Iliad"), network_provider: "iliad", network_type: "LTE", wan_lte_ca: "active",
		lte_ca_pcell_band: "3", lte_ca_scell_info: "120,1,7,3350,20;121,2,B20,6300,10", lte_rsrp: "-89", sinr: "14.2",
		realtime_rx_thrpt: "8396800", realtime_tx_thrpt: "972800", wifi_chip1_ssid1_ssid: " Casa ", wifi_chip2_ssid1_ssid: "Casa-5G",
		mcc: "222", mnc: "50", Z_eNB_id: "25600513", dns_mode: "manual", prefer_dns_manual: "1.1.1.1", standby_dns_manual: "1.0.0.1",
		lte_band_lock: "0x20080800C5",
	},
	{
		ppp_status: "ppp_disconnected", wan_ipaddr: "", monthly_rx_bytes: "0", monthly_tx_bytes: "", spn_name_data: "",
		network_provider: "TIM", network_type: "LTE_A", wan_lte_ca: "", lte_ca_pcell_band: "B1", lte_ca_scell_info: "",
		lte_rsrp: "", sinr: "", realtime_rx_thrpt: "", realtime_tx_thrpt: "0", wifi_chip1_ssid1_ssid: "", wifi_chip2_ssid1_ssid: "",
		mcc: "", mnc: "", Z_eNB_id: "-", dns_mode: "auto", prefer_dns_manual: "", standby_dns_manual: "", lte_band_lock: "",
	},
];
golden.dataUsage = [];
for (const json of usageFixtures) {
	fixture = { [requestCommand()]: json };
	try {
		golden.dataUsage.push({ json, usage: await api.fetchDataUsage() });
	} catch (error) {
		// Bug in the Expo app, fixed in the native one: an empty spn_name_data throws.
		golden.dataUsage.push({ json, error: String(error) });
	}
}
function requestCommand() {
	return "ppp_status,wan_ipaddr,wan_apn,monthly_rx_bytes,monthly_tx_bytes,spn_name_data,network_provider,network_type,wan_lte_ca,lte_ca_pcell_band,lte_ca_scell_info,lte_rsrp,sinr,wifi_access_sta_num,realtime_rx_thrpt,realtime_tx_thrpt,wifi_chip1_ssid1_ssid,wifi_chip2_ssid1_ssid,mcc,mnc,Z_eNB_id,dns_mode,prefer_dns_manual,standby_dns_manual,lte_band_lock";
}

const hostNameList = {
	devices: [
		{ mac: "a4:83:e7:12:34:56", hostname: "iPhone di Filippo" },
		{ mac: "5c:cb:99:aa:10:20", hostname: "Galaxy-S23" },
		{ mac: "70:2a:d5:11:22:33", hostname: "70:2A:D5:11:22:33" },
		{ mac_addr: "8C:86:1E:30:40:50", hostname: "" },
		{ hostname: "senza mac" },
	],
};
const stationList = {
	station_list: [
		{ mac_addr: "A4:83:E7:12:34:56", hostname: "iPhone", ip_addr: "192.168.0.101", connect_type: "wireless" },
		{ mac_addr: "70:2a:d5:11:22:33", hostname: "", ip_addr: "192.168.0.103", connect_type: "wired" },
		{ mac: "DC:A9:04:44:55:66", ip: "192.168.0.104" },
	],
};
fixture = { hostNameList, station_list: stationList };
golden.devices = { hostNameList, stationList, result: await api.fetchDevices() };

golden.accessControl = [
	{ AclMode: "2", BlackMacList: "AA:BB:CC:DD:EE:FF;11:22:33:44:55:66;77:88:99:AA:BB:CC", BlackNameList: "TV;;Camera" },
	{ AclMode: 0, BlackMacList: "", BlackNameList: "" },
].map((json) => {
	fixture = { queryDeviceAccessControlList: json };
	return json;
});
for (const entry of golden.accessControl) {
	fixture = { queryDeviceAccessControlList: entry };
	entry.result = await api.fetchAccessControl();
}
golden.accessControl = golden.accessControl.map(({ result, ...json }) => ({ json, result }));

golden.softwareInfo = [];
for (const cr_version of ["CR_MF289FV1.0.0B05", "BD_MF289F_V2.01.B07", "NOVERSION", "VERSION"]) {
	fixture = { cr_version: { cr_version } };
	golden.softwareInfo.push({ crVersion: cr_version, result: await api.fetchSoftwareVersion() });
}

golden.bandLocks = [];
for (const bands of [["B1", "B3", "B7", "B8", "B20", "B28", "B32", "B38"], ["B3"], ["B20", "B28"], ["B1", "B3", "B7", "B8", "B20", "B28", "B38"]]) {
	requests = [];
	fixture = { "cr_version,wa_inner_version": {}, RD: { RD: "" } };
	await api.setLteBands("manual", bands);
	const body = requests.find((r) => r.method === "POST").params;
	golden.bandLocks.push({ bands, lock: Object.fromEntries(body).lte_band_lock });
}

// The write commands, as decoded form fields, without the AD token (it depends on the router).
golden.commands = [];
const record = async (name, call) => {
	requests = [];
	fixture = { "cr_version,wa_inner_version": {}, RD: { RD: "" } };
	await call();
	const body = requests.filter((r) => r.method === "POST").map((r) => r.params.filter(([key]) => key !== "AD"));
	golden.commands.push({ name, body: body.at(-1) });
};
await record("deleteSms", () => api.deleteSms(["12", "13"]));
await record("markAsRead", () => api.markAsRead(["12", "13"]));
await record("connect", () => api.connectNetwork());
await record("disconnect", () => api.disconnectNetwork());
await record("reboot", () => api.reboot());
await record("nightMode", () => api.setNightMode(true, "22:30", "06:45"));
await record("dnsManual", () => api.setDns("manual", "1.1.1.1", "1.0.0.1"));
await record("bandsAuto", () => api.setLteBands("auto", []));
await record("rename", () => api.renameDevice("A4:83:E7:12:34:56", "iPhone di Filippo"));
fixture = {
	"cr_version,wa_inner_version": {},
	RD: { RD: "" },
	queryDeviceAccessControlList: { AclMode: "2", BlackMacList: "aa:bb:cc:dd:ee:ff", BlackNameList: "TV" },
};
for (const [name, call] of [
	["block", () => api.blockDevice("11:22:33:44:55:66", "Camera")],
	["unblock", () => api.unblockDevice("AA:BB:CC:DD:EE:FF")],
]) {
	requests = [];
	await call();
	golden.commands.push({ name, body: requests.filter((r) => r.method === "POST").at(-1).params.filter(([key]) => key !== "AD") });
}
// sendSms without its sms_time, which depends on the clock and is fixed in the native app.
requests = [];
fixture = { "cr_version,wa_inner_version": {}, RD: { RD: "" } };
await api.sendSms("+393331234567", "Ciao 🍕");
golden.commands.push({
	name: "sendSms",
	body: requests.at(-1).params.filter(([key]) => key !== "AD" && key !== "sms_time"),
});

// GET queries, as axios builds them.
const queries = [
	{ isTest: false, cmd: "LD" },
	{ isTest: false, cmd: "sms_data_total", page: 0, data_per_page: 500, mem_store: 1, tags: 10, order_by: "order by id desc" },
	{ isTest: false, cmd: "cr_version,wa_inner_version", multi_data: 1 },
	{ isTest: false, cmd: "a:b$c+d!e'f(g)h~i*j é/k" },
];
golden.queries = queries.map((params) => ({
	pairs: Object.entries(params).map(([k, v]) => [k, String(v)]),
	query: axios.getUri({ url: "http://x/", params }).split("?")[1],
}));

// POST bodies, as React Native's URLSearchParams.toString() writes them (Libraries/Blob/URLSearchParams.js).
const rnBody = (pairs) =>
	pairs.map(([k, v]) => `${encodeURIComponent(k).replace(/%20/g, "+")}=${encodeURIComponent(v).replace(/%20/g, "+")}`).join("&");
golden.bodies = [
	[["isTest", "false"], ["goformId", "SEND_SMS"], ["Number", "+393331234567"], ["MessageBody", "0043"]],
	[["hostname", "iPhone di Filippo"], ["BlackNameList", "TV;Camera \"2\" \\ ok"], ["x", "a:b,c$d!e'f(g)h~i*j é/k&l=m"]],
].map((pairs) => ({ pairs, body: rnBody(pairs) }));

golden.ssid = [["Casa", "Casa-5G"], ["Casa", "Casa"], ["", "Casa-5G"], [" ", ""], ["Casa ", ""]].map(([a, b]) => ({
	ssid24: a,
	ssid5: b,
	entries: wifi.getSsidEntries(a, b),
}));

const sampleDevices = [
	{ hostname: "iPhone di Filippo", ip: "192.168.0.101", type: "wireless" },
	{ hostname: "Smart-TV", ip: "192.168.0.103", type: "cable" },
	{ hostname: "my-nas", ip: "-", type: "cable" },
	{ hostname: "Desktop", ip: "192.168.0.5", type: "cable" },
	{ hostname: "Galaxy", ip: "-", type: "wireless" },
	{ hostname: "Galaxy", ip: "192.168.0.9", type: "wireless" },
	{ hostname: "MacBook-Pro", ip: "", type: "wireless" },
];
golden.deviceSymbols = sampleDevices.flatMap((device) =>
	[null, "speaker", "camera"].map((manual) => ({ device, manual, symbol: deviceIcons.deviceSymbol(device, manual) })),
);

golden.contactKeys = ["+39 333 123 4567", "333-123-4567", "+44 20 7946 0958", "39 333 1234", "(06) 1234567"].map((phone) => ({
	phone,
	key: contactsService.normalize(phone),
}));

writeFileSync("native/RoutyTests/golden.json", JSON.stringify(golden, null, "\t") + "\n");
print(Object.fromEntries(Object.entries(golden).map(([k, v]) => [k, Array.isArray(v) ? v.length : typeof v])));
