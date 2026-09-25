import { Conversation, RawSmsMessage, encodeZTE, groupByConversation } from "../utils/sms";
import { BlockedDevice, DataUsage, Device, RouterApi } from "./router-api";

// Entering these credentials in Settings switches the app to demo mode.
export const DEMO_HOST = "demo";
export const DEMO_PASSWORD = "demo";
// Prefix for every fake SMS id, so they never clash with real router ids.
export const DEMO_ID_PREFIX = "demo-";

export function isDemoCredentials(url: string, password: string): boolean {
	return url.replace(/^https?:\/\//i, "").replace(/\/$/, "") === DEMO_HOST && password === DEMO_PASSWORD;
}

// Fake contact names, used in place of the address book while in demo mode.
export const DEMO_CONTACTS: Record<string, string> = {
	"+393331234567": "Giulia Rossi",
	"+393479876543": "Marco Bianchi",
	"+393405551212": "Alessandra Maria Costantini De Santis",
	"+393288887766": "Luca",
};

interface DemoMessage {
	id: string;
	number: string;
	content: string;
	date: Date;
	tag: "0" | "1" | "2"; // '0' = received read, '1' = received unread, '2' = sent
}

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

/** JS Date → ZTE date format "yy,mm,dd,hh,mi,ss,tz" (the inverse of `parseZteDate`). */
function toZteDate(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	return [
		pad(date.getFullYear() % 100),
		pad(date.getMonth() + 1),
		pad(date.getDate()),
		pad(date.getHours()),
		pad(date.getMinutes()),
		pad(date.getSeconds()),
		"+2",
	].join(",");
}

function seedMessages(): DemoMessage[] {
	const now = Date.now();
	let nextId = 1;
	const msg = (
		number: string,
		agoMs: number,
		tag: DemoMessage["tag"],
		content: string,
	): DemoMessage => ({
		id: `${DEMO_ID_PREFIX}${nextId++}`,
		number,
		content,
		date: new Date(now - agoMs),
		tag,
	});

	return [
		// Today, unread, with a long back-and-forth to test the chat screen.
		msg("+393331234567", 3 * 60 * MINUTE_MS, "1", "Ciao! Sei riuscito a sistemare il router?"),
		msg("+393331234567", 170 * MINUTE_MS, "2", "Quasi, sto provando la nuova app"),
		msg("+393331234567", 160 * MINUTE_MS, "1", "Che app?"),
		msg("+393331234567", 150 * MINUTE_MS, "2", "Routy, gestisce SMS, consumi e dispositivi del router"),
		msg("+393331234567", 140 * MINUTE_MS, "1", "Figo! Funziona anche con il tuo ZTE?"),
		msg("+393331234567", 130 * MINUTE_MS, "2", "Sì, è fatta apposta per l'MF289F"),
		msg("+393331234567", 20 * MINUTE_MS, "1", "Allora stasera me la fai vedere 😄"),
		msg("+393331234567", 12 * MINUTE_MS, "1", "Porto io la pizza 🍕"),
		// Today, read, last message sent by us.
		msg("+393479876543", 90 * MINUTE_MS, "0", "Ci vediamo alle 18 in ufficio?"),
		msg("+393479876543", 80 * MINUTE_MS, "2", "Perfetto, a dopo!"),
		// Yesterday, very long name and preview to test truncation.
		msg(
			"+393405551212",
			DAY_MS + 2 * 60 * MINUTE_MS,
			"1",
			"Ti giro il riepilogo della riunione: abbiamo deciso di spostare il rilascio alla prossima settimana per completare i test sul nuovo firmware del router.",
		),
		// A few days ago, unknown number (no contact name).
		msg("+393201112233", 3 * DAY_MS, "0", "Buongiorno, il suo pacco è in consegna oggi."),
		msg("+393201112233", 3 * DAY_MS - 5 * MINUTE_MS, "2", "Grazie, sono a casa."),
		// Operator-style alphanumeric sender.
		msg(
			"OPERATORE",
			5 * DAY_MS,
			"0",
			"Hai consumato l'80% dei GB inclusi nella tua offerta. Il traffico si rinnova il giorno 1.",
		),
		// Older than a week.
		msg("+393288887766", 12 * DAY_MS, "0", "Buon compleanno! 🎉"),
		msg("+393288887766", 12 * DAY_MS - 30 * MINUTE_MS, "2", "Grazie mille Luca!"),
		// Numeric short code.
		msg("40916", 20 * DAY_MS, "0", "Il tuo codice di verifica è 482913"),
	];
}

const DEMO_DEVICES: Device[] = [
	{ hostname: "iPhone di Filippo", ip: "192.168.0.101", mac: "A4:83:E7:12:34:56", type: "wireless" },
	{ hostname: "MacBook-Pro", ip: "192.168.0.102", mac: "F0:18:98:AB:CD:EF", type: "wireless" },
	{ hostname: "Smart-TV", ip: "192.168.0.103", mac: "70:2A:D5:11:22:33", type: "cable" },
	{ hostname: "iPad", ip: "192.168.0.104", mac: "DC:A9:04:44:55:66", type: "wireless" },
	{ hostname: "NAS", ip: "192.168.0.10", mac: "00:11:32:77:88:99", type: "cable" },
	// Known but offline: like `hostNameList`-only entries, with no IP.
	{ hostname: "Galaxy-S23", ip: "-", mac: "5C:CB:99:AA:10:20", type: "wireless" },
	{ hostname: "Apple-Watch", ip: "-", mac: "8C:86:1E:30:40:50", type: "wireless" },
	{ hostname: "PlayStation-5", ip: "-", mac: "BC:33:29:60:70:80", type: "wireless" },
];

// Lets the app drop demo devices from its forgotten list when leaving demo mode.
export const DEMO_DEVICE_MACS = DEMO_DEVICES.map((d) => d.mac);

/**
 * In-memory stand-in for `RouterApi`, used in demo mode.
 * Every call resolves locally with fake data; nothing is sent over the network.
 */
export class DemoRouterApi extends RouterApi {
	private messages: DemoMessage[] = seedMessages();
	private nextId = this.messages.length + 1;
	private pppConnected = true;
	private nightMode = { enabled: false, start: "22:00", end: "07:00" };
	private dns: Pick<DataUsage, "dnsMode" | "preferDns" | "standbyDns"> = {
		dnsMode: "auto",
		preferDns: "",
		standbyDns: "",
	};
	private lteBandLock = "0x20080800C5";
	private devices: Device[] = DEMO_DEVICES.map((d) => ({ ...d }));
	private blocked: BlockedDevice[] = [];

	constructor() {
		super(`http://${DEMO_HOST}`);
	}

	private delay(ms = 300) {
		return new Promise<void>((resolve) => setTimeout(resolve, ms));
	}

	async login(_password: string): Promise<void> {
		await this.delay(600);
	}

	async fetchConversations(readIds?: Set<string>): Promise<Conversation[]> {
		await this.delay();
		// Go through the same decoding path as real router data.
		const raw: RawSmsMessage[] = this.messages.map((m) => ({
			id: m.id,
			number: encodeZTE(m.number),
			content: encodeZTE(m.content),
			date: toZteDate(m.date),
			tag: m.tag,
		}));
		return groupByConversation(raw, readIds);
	}

	async sendSms(number: string, text: string): Promise<void> {
		await this.delay();
		this.messages.push({
			id: `${DEMO_ID_PREFIX}${this.nextId++}`,
			number,
			content: text,
			date: new Date(),
			tag: "2",
		});
	}

	async markAsRead(msgIds: string[]): Promise<void> {
		const ids = new Set(msgIds);
		this.messages = this.messages.map((m) =>
			ids.has(m.id) && m.tag === "1" ? { ...m, tag: "0" } : m,
		);
	}

	async deleteSms(msgIds: string[]): Promise<void> {
		await this.delay();
		const ids = new Set(msgIds);
		this.messages = this.messages.filter((m) => !ids.has(m.id));
	}

	async fetchDataUsage(): Promise<DataUsage> {
		await this.delay();
		const rx = 312.4 * 1024 ** 3;
		const tx = 41.7 * 1024 ** 3;
		// Small random jitter so the live throughput looks alive.
		const jitter = (base: number) => (base * (0.8 + Math.random() * 0.4)).toFixed(1);
		return {
			monthlyRxBytes: rx,
			monthlyTxBytes: tx,
			monthlyTotalBytes: rx + tx,
			networkProvider: "Demo Mobile",
			networkType: "4G", // the dashboard appends "+" when isCA
			isCA: true,
			bands: "B3, B7, B20",
			rsrp: "-89",
			sinr: "14",
			connectedDevices: 5,
			realtimeRxThrpt: this.pppConnected ? jitter(8200) : "0.0",
			realtimeTxThrpt: this.pppConnected ? jitter(950) : "0.0",
			pppStatus: this.pppConnected ? "ppp_connected" : "ppp_disconnected",
			wanIp: this.pppConnected ? "100.64.12.34" : "",
			ssid: "Routy-Demo",
			cellId: "25600513",
			enbId: "100002",
			mcc: "222",
			mnc: "88",
			...this.dns,
			lteBandLock: this.lteBandLock,
		};
	}

	async fetchDevices(): Promise<Device[]> {
		await this.delay();
		return this.devices.map((d) => ({ ...d }));
	}

	async renameDevice(mac: string, hostname: string): Promise<void> {
		await this.delay();
		const device = this.devices.find((d) => d.mac === mac.toUpperCase());
		if (device) device.hostname = hostname;
	}

	async fetchBlockedDevices(): Promise<BlockedDevice[]> {
		await this.delay();
		return this.blocked.map((d) => ({ ...d }));
	}

	async blockDevice(mac: string, hostname: string): Promise<void> {
		await this.delay();
		if (!this.blocked.some((d) => d.mac === mac)) this.blocked.push({ hostname, mac });
	}

	async unblockDevice(mac: string): Promise<void> {
		await this.delay();
		this.blocked = this.blocked.filter((d) => d.mac !== mac);
	}

	async connectNetwork(): Promise<void> {
		await this.delay(800);
		this.pppConnected = true;
	}

	async disconnectNetwork(): Promise<void> {
		await this.delay(800);
		this.pppConnected = false;
	}

	async fetchSoftwareVersion(): Promise<{ model: string; version: string }> {
		return { model: "ZTE MF289F (Demo)", version: "DEMO_1.0.0" };
	}

	async fetchNightMode(): Promise<{ enabled: boolean; start: string; end: string }> {
		return { ...this.nightMode };
	}

	async reboot(): Promise<void> {
		await this.delay();
	}

	async setNightMode(enabled: boolean, start: string, end: string): Promise<void> {
		await this.delay();
		this.nightMode = { enabled, start, end };
	}

	async setDns(mode: "auto" | "manual", preferDns: string, standbyDns: string): Promise<void> {
		await this.delay();
		this.dns = { dnsMode: mode, preferDns, standbyDns };
	}

	async setLteBands(mode: "auto" | "manual", bands: string[]): Promise<void> {
		await this.delay();
		if (mode === "auto") {
			this.lteBandLock = "0x20080800C5";
			return;
		}
		// Same bitmask encoding as RouterApi.setLteBands.
		let n = 0n;
		bands.forEach((b) => {
			const bandNum = parseInt(b.replace("B", ""), 10);
			if (!isNaN(bandNum)) n += 1n << BigInt(bandNum - 1);
		});
		this.lteBandLock = "0x" + n.toString(16).toUpperCase();
	}
}
