import axios, { AxiosInstance } from "axios";
import CryptoJS from "crypto-js";

import {
	Conversation,
	RawSmsMessage,
	encodeZTE,
	getSmsTime,
	groupByConversation,
} from "../utils/sms";

export interface DataUsage {
	monthlyRxBytes: number;
	monthlyTxBytes: number;
	monthlyTotalBytes: number;
	networkProvider: string;
	networkType: string;
	isCA: boolean; // Carrier Aggregation (4G+)
	bands: string;
	rsrp: string;
	sinr: string;
	connectedDevices: number;
	realtimeRxThrpt: string; // Kbps
	realtimeTxThrpt: string; // Kbps
}

export interface Device {
	hostname: string;
	ip: string;
	mac: string;
	type: string; // 'cable' or 'wireless'
}

export class RouterApi {
	private client: AxiosInstance;
	private cookies: string = "";
	private baseUrl: string;

	constructor(baseUrl: string) {
		this.baseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

		this.client = axios.create({
			baseURL: this.baseUrl,
			timeout: 8000,
			headers: {
				Referer: this.baseUrl,
			},
		});

		// Capture session cookies
		this.client.interceptors.response.use((response) => {
			const setCookie = response.headers["set-cookie"];
			if (setCookie) {
				this.cookies = setCookie.map((c: string) => c.split(";")[0]).join("; ");
			}
			return response;
		});

		// Send stored cookies on every request
		this.client.interceptors.request.use((config) => {
			if (this.cookies) {
				config.headers = config.headers ?? {};
				config.headers["Cookie"] = this.cookies;
			}
			return config;
		});
	}

	// ── AUTH ─────────────────────────────────────────────────────────────────

	private hashPassword(password: string, ld: string): string {
		const hash1 = CryptoJS.SHA256(password)
			.toString(CryptoJS.enc.Hex)
			.toUpperCase();
		return CryptoJS.SHA256(hash1 + ld)
			.toString(CryptoJS.enc.Hex)
			.toUpperCase();
	}

	async login(password: string): Promise<void> {
		console.log("[RouterApi] Starting login process...");
		const ldRes = await this.client.get("goform/goform_get_cmd_process", {
			params: { isTest: false, cmd: "LD" },
		});

		const ld: string = ldRes.data?.LD;
		console.log("[RouterApi] Salt LD:", ld);
		if (!ld)
			throw new Error(
				"Impossibile ottenere il salt LD dal router. Controlla l'URL.",
			);

		const hashedPw = this.hashPassword(password, ld);
		console.log("[RouterApi] Hashed Password:", hashedPw);

		// Using a manual string for params to be 100% sure of the format
		const params = `isTest=false&goformId=LOGIN&password=${encodeURIComponent(hashedPw)}`;

		const loginRes = await this.client.post(
			"goform/goform_set_cmd_process",
			params,
			{
				headers: {
					"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
					"X-Requested-With": "XMLHttpRequest",
				},
			},
		);

		console.log("[RouterApi] Login response data:", loginRes.data);

		const result: string = loginRes.data?.result;

		// ZTE results:
		// "0" or "success": login ok
		// "1": already logged in
		// "3": wrong password
		if (result === "3") throw new Error("Password errata.");

		const isSuccess = result === "0" || result === "1" || result === "success";
		if (!isSuccess) {
			throw new Error(`Login fallito (codice: ${result})`);
		}

		console.log("[RouterApi] Login successful");
	}

	// ── AD TOKEN (required for write commands) ───────────────────────────────

	private async getADToken(): Promise<string> {
		const verRes = await this.client.get("goform/goform_get_cmd_process", {
			params: {
				isTest: false,
				cmd: "cr_version,wa_inner_version",
				multi_data: 1,
			},
		});
		const { cr_version, wa_inner_version } = verRes.data;

		const a = CryptoJS.MD5(wa_inner_version + cr_version).toString(
			CryptoJS.enc.Hex,
		);

		const rdRes = await this.client.get("goform/goform_get_cmd_process", {
			params: { isTest: false, cmd: "RD" },
		});
		const rd: string = rdRes.data?.RD;

		return CryptoJS.MD5(a + rd).toString(CryptoJS.enc.Hex);
	}

	// ── HELPERS ────────────────────────────────────────────────────────────
	private hexToUtf16(hex: any) {
		return hex
			.match(/.{1,4}/g)
			.map((h: any) => String.fromCharCode(parseInt(h, 16)))
			.join("");
	}

	// ── TRAFFIC ─────────────────────────────────────────────────────────────

	async fetchDataUsage(): Promise<DataUsage> {
		console.log("[RouterApi] Fetching monthly statistics and network info...");
		const res = await this.client.get("goform/goform_get_cmd_process", {
			params: {
				isTest: false,
				cmd: "monthly_rx_bytes,monthly_tx_bytes,spn_name_data,network_provider,network_type,wan_lte_ca,lte_ca_pcell_band,lte_ca_scell_info,lte_rsrp,sinr,wifi_access_sta_num,realtime_rx_thrpt,realtime_tx_thrpt",
				multi_data: "1",
			},
		});

		console.log(
			"[RouterApi] Raw statistics response:",
			JSON.stringify(res.data, null, 2),
		);

		const data = res.data ?? {};

		// Parse PCell band (e.g. "B1", "B3"...)
		const pcell = data.lte_ca_pcell_band
			? data.lte_ca_pcell_band.startsWith("B")
				? data.lte_ca_pcell_band
				: `B${data.lte_ca_pcell_band}`
			: "";

		// Parse SCell bands from lte_ca_scell_info (format: "pci,index,band,earfcn,bandwidth;...")
		const scellInfo = data.lte_ca_scell_info || "";
		const scellBands = scellInfo
			.split(";")
			.map((s: string) => {
				const parts = s.split(",");
				if (parts.length >= 3) {
					const band = parts[2].trim();
					return band.startsWith("B") ? band : `B${band}`;
				}
				return null;
			})
			.filter(Boolean);

		const allBands = [pcell, ...scellBands].filter(Boolean).join(", ");

		// Convert throughput (assuming bits/s or Kbps, ZTE usually returns bits/s or Kbps)
		const toKbps = (val: string) =>
			(parseInt(val || "0", 10) / 1024).toFixed(1);

		// Map network type to human readable (LTE -> 4G, LTE_A -> 4G+)
		const rawNetType = data.network_type || "";
		let networkType = rawNetType;
		if (rawNetType.toUpperCase() === "LTE") networkType = "4G";
		if (rawNetType.toUpperCase() === "LTE_A") networkType = "4G+";

		return {
			monthlyRxBytes: parseInt(data.monthly_rx_bytes || "0", 10),
			monthlyTxBytes: parseInt(data.monthly_tx_bytes || "0", 10),
			monthlyTotalBytes:
				parseInt(data.monthly_rx_bytes || "0", 10) +
				parseInt(data.monthly_tx_bytes || "0", 10),
			networkProvider:
				this.hexToUtf16(data.spn_name_data) || data.network_provider || "VERY",
			networkType: networkType || "4G",
			isCA: data.wan_lte_ca === "active" || data.wan_lte_ca === "1",
			bands: allBands || "-",
			rsrp: data.lte_rsrp || "-",
			sinr: data.sinr || "-",
			connectedDevices: parseInt(data.wifi_access_sta_num || "0", 10),
			realtimeRxThrpt: toKbps(data.realtime_rx_thrpt),
			realtimeTxThrpt: toKbps(data.realtime_tx_thrpt),
		};
	}

	// ── SMS ──────────────────────────────────────────────────────────────────

	async fetchConversations(readIds?: Set<string>): Promise<Conversation[]> {
		const res = await this.client.get("goform/goform_get_cmd_process", {
			params: {
				isTest: false,
				cmd: "sms_data_total",
				page: 0,
				data_per_page: 500,
				mem_store: 1,
				tags: 10,
				order_by: "order by id desc",
			},
		});

		const messages: RawSmsMessage[] = res.data?.messages ?? [];
		return groupByConversation(messages, readIds);
	}

	async sendSms(number: string, text: string): Promise<void> {
		const adToken = await this.getADToken();

		const params = new URLSearchParams({
			isTest: "false",
			goformId: "SEND_SMS",
			Number: number,
			sms_time: getSmsTime(),
			MessageBody: encodeZTE(text),
			ID: "-1",
			encode_type: "UNICODE",
			AD: adToken,
		});

		const res = await this.client.post(
			"goform/goform_set_cmd_process",
			params.toString(),
			{
				headers: {
					"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
				},
			},
		);

		const result: string = res.data?.result;
		if (result !== "success" && result !== "0") {
			throw new Error(`Invio fallito (codice: ${result})`);
		}
	}

	async markAsRead(msgIds: string[]): Promise<void> {
		if (msgIds.length === 0) return;
		const adToken = await this.getADToken();

		// Standard ZTE syntax for marking messages as read
		const params = new URLSearchParams({
			isTest: "false",
			goformId: "SET_MSG_READ",
			msg_id: msgIds.join(";"),
			tag: "1", // 1 = Mark as Read
			AD: adToken,
		});

		console.log("[RouterApi] Sending SET_MSG_READ:", params.toString());

		const res = await this.client.post(
			"goform/goform_set_cmd_process",
			params.toString(),
			{
				headers: {
					"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
				},
			},
		);

		console.log("[RouterApi] Response SET_MSG_READ:", res.data);

		if (res.data?.result !== "success" && res.data?.result !== "0") {
			console.warn(
				"[RouterApi] markAsRead failed with result:",
				res.data?.result,
			);
		}
	}

	async deleteSms(msgIds: string[]): Promise<void> {
		if (msgIds.length === 0) return;
		const adToken = await this.getADToken();

		const params = new URLSearchParams({
			isTest: "false",
			goformId: "DELETE_SMS",
			msg_id: msgIds.join(";"),
			AD: adToken,
		});

		console.log("[RouterApi] Sending DELETE_SMS:", params.toString());

		const res = await this.client.post(
			"goform/goform_set_cmd_process",
			params.toString(),
			{
				headers: {
					"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
				},
			},
		);

		console.log("[RouterApi] Response DELETE_SMS:", res.data);

		if (res.data?.result !== "success" && res.data?.result !== "0") {
			throw new Error(`Eliminazione fallita (codice: ${res.data?.result})`);
		}
	}

	async fetchDevices(): Promise<Device[]> {
		try {
			// Fetch hostNameList
			const resHost = await this.client.get("goform/goform_get_cmd_process", {
				params: { isTest: false, cmd: "hostNameList" },
			});
			console.log(
				"[RouterApi] hostNameList raw:",
				JSON.stringify(resHost.data, null, 2),
			);

			// Fetch station_list
			const resStation = await this.client.get(
				"goform/goform_get_cmd_process",
				{
					params: { isTest: false, cmd: "station_list" },
				},
			);
			console.log(
				"[RouterApi] station_list raw:",
				JSON.stringify(resStation.data, null, 2),
			);

			const hostNames: any[] = resHost.data?.devices || [];
			const stations: any[] = resStation.data?.station_list || [];

			const deviceMap = new Map<string, Device>();

			stations.forEach((s: any) => {
				const mac = (s.mac_addr || s.mac || "").toUpperCase();
				if (!mac) return;
				deviceMap.set(mac, {
					hostname: s.hostname || mac,
					ip: s.ip_addr || s.ip || "-",
					mac: mac,
					type: s.connect_type === "wired" ? "cable" : "wireless",
				});
			});

			hostNames.forEach((h: any) => {
				const mac = (h.mac || h.mac_addr || "").toUpperCase();
				if (!mac) return;
				const existing = deviceMap.get(mac);
				if (existing) {
					if (h.hostname && h.hostname !== existing.mac)
						existing.hostname = h.hostname;
				} else {
					deviceMap.set(mac, {
						hostname: h.hostname || mac,
						ip: "-",
						mac: mac,
						type: "wireless",
					});
				}
			});

			return Array.from(deviceMap.values());
		} catch (e) {
			console.warn("[RouterApi] fetchDevices error:", e);
			return [];
		}
	}
}
