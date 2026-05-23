export interface RawSmsMessage {
	id: string;
	number: string;
	content: string;
	date: string;
	tag: string; // '1' = received, '2' = sent
}

export interface SmsMessage {
	id: string;
	number: string;
	content: string;
	date: Date;
	isSent: boolean;
}

export interface Conversation {
	number: string;
	displayName: string;
	messages: SmsMessage[];
	lastMessage: SmsMessage;
	unreadCount: number;
}

/** UCS2 hex → human-readable string */
export function decodeZTE(hex: string): string {
	if (!hex) return "";
	let result = "";
	for (let i = 0; i < hex.length; i += 4) {
		const code = parseInt(hex.substring(i, i + 4), 16);
		if (!isNaN(code)) result += String.fromCharCode(code);
	}
	return result;
}

/** human-readable string → UCS2 hex */
export function encodeZTE(text: string): string {
	let result = "";
	for (let i = 0; i < text.length; i++) {
		result += text.charCodeAt(i).toString(16).padStart(4, "0").toUpperCase();
	}
	return result;
}

/** ZTE date format "yy,mm,dd,hh,mi,ss,tz" → JS Date */
export function parseZteDate(date: string): Date {
	if (!date) return new Date(0);
	const parts = date.split(",");
	const yy = parseInt(parts[0] ?? "0", 10);
	const mm = parseInt(parts[1] ?? "1", 10);
	const dd = parseInt(parts[2] ?? "1", 10);
	const hh = parseInt(parts[3] ?? "0", 10);
	const mi = parseInt(parts[4] ?? "0", 10);
	const ss = parseInt(parts[5] ?? "0", 10);
	return new Date(2000 + yy, mm - 1, dd, hh, mi, ss);
}

/** JS Date → ZTE sms_time format "yy;mm;dd;hh;mi;ss;+2" */
export function getSmsTime(): string {
	const now = new Date();
	const parts = [
		String(now.getFullYear()).substring(2),
		String(now.getMonth() + 1).padStart(2, "0"),
		String(now.getDate()).padStart(2, "0"),
		String(now.getHours()).padStart(2, "0"),
		String(now.getMinutes()).padStart(2, "0"),
		String(now.getSeconds()).padStart(2, "0"),
		"+2",
	];
	return parts.join(";");
}

/** Format date for display in the UI */
export function formatMessageDate(date: Date): string {
	const now = new Date();
	const startOfDay = (d: Date) =>
		new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

	const todayStart = startOfDay(now);
	const dateStart = startOfDay(date);
	const diffDays = Math.round((todayStart - dateStart) / 86400000);

	// Oggi -> mostra l'ora
	if (diffDays === 0) {
		return date.toLocaleTimeString("it-IT", {
			hour: "2-digit",
			minute: "2-digit",
		});
	}

	// Ieri -> mostra "Ieri"
	if (diffDays === 1) {
		return "Ieri";
	}

	// Ultimi 7 giorni -> mostra il nome del giorno
	if (diffDays < 7) {
		const dayName = date.toLocaleDateString("it-IT", { weekday: "long" });
		return dayName.charAt(0).toUpperCase() + dayName.slice(1);
	}

	// Altrimenti -> mostra dd/mm/yy
	const day = String(date.getDate()).padStart(2, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const year = String(date.getFullYear()).substring(2);
	return `${day}/${month}/${year}`;
}

/** Groups raw SMS messages into conversations keyed by phone number */
export function groupByConversation(
	rawMessages: RawSmsMessage[],
	readIds?: Set<string>,
): Conversation[] {
	const map = new Map<string, SmsMessage[]>();

	for (const raw of rawMessages) {
		const number = decodeZTE(raw.number) || raw.number;
		const content = decodeZTE(raw.content).trim();
		const date = parseZteDate(raw.date);

		// Force tag '0' (read) if ID is in our local readIds set
		const effectiveTag = readIds?.has(raw.id) ? "0" : raw.tag;

		// tag: '1' = received unread, '0' = received read, '2' = sent
		const isSent = effectiveTag === "2";

		const msg: SmsMessage = { id: raw.id, number, content, date, isSent };

		if (!map.has(number)) map.set(number, []);
		map.get(number)!.push(msg);
	}

	const conversations: Conversation[] = [];
	for (const [number, messages] of map.entries()) {
		messages.sort((a, b) => a.date.getTime() - b.date.getTime());
		const lastMessage = messages[messages.length - 1]!;

		// Check for unread messages (tag '1' in raw messages, ignoring local readIds)
		const unreadCount = rawMessages.filter(
			(raw) =>
				(decodeZTE(raw.number) || raw.number) === number &&
				raw.tag === "1" &&
				!readIds?.has(raw.id),
		).length;

		conversations.push({
			number,
			displayName: number,
			messages,
			lastMessage,
			unreadCount,
		});
	}

	conversations.sort(
		(a, b) => b.lastMessage.date.getTime() - a.lastMessage.date.getTime(),
	);
	return conversations;
}
