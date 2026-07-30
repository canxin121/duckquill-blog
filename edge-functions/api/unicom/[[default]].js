const SEND_SMS_URL = "https://m.client.10010.com/mobileService/sendRadomNum.htm";
const SMS_LOGIN_URL = "https://m.client.10010.com/mobileService/radomLogin.htm";
const CAPTCHA_VALIDATE_URL = "https://loginxhm.10010.com/login-web/v1/chartCaptcha/validateTencentCaptcha";
const SMS_CLIENT_VERSION = "android@11.0800";
const DEVICE_MODEL = "M2007J3SC";
const DEVICE_BRAND = "Xiaomi";
const MAX_BODY_BYTES = 24 * 1024;
const RATE_WINDOW_MS = 60 * 1000;

// China Unicom's current mobile-login public key (1024-bit RSA, PKCS#1 v1.5).
const RSA_MODULUS = BigInt(
	"0xdcf8264af5b040f4853e81950e73a1541aeef23bd5a94cd0743f39a014187de8c8355aba2f0f5a2a67e7881782e3bf129718e748efd25176f7bd34f850a34efebaa190804e229b0367471ecf16d091af288811c5286afb8db6e455a01026eaa741d12adcb606aa19f2e02af6473a7c138f236a8c1531ccc7909440b673310c4b",
);
const RSA_EXPONENT = 65537n;
const encoder = new TextEncoder();

// This is deliberately only a supplementary limit. Edge isolates are short-lived and
// independent; production protection must be configured in EdgeOne WAF as well.
const rateAttempts = new Map();

export default async function onRequest(context) {
	try {
		const request = context.request;
		const url = new URL(request.url);
		const path = url.pathname
			.replace(/^\/api\/unicom\/?/, "")
			.replace(/\/+$/, "");

		if (request.method === "GET" && path === "health") {
			return json({ ok: true, persistence: false });
		}

		if (request.method !== "POST") {
			return error(405, "只支持 POST 请求。", { Allow: "POST" });
		}

		const authorizationError = await requireAccessKey(context, request);
		if (authorizationError) return authorizationError;

		const body = await readRequestJson(request);
		if (body instanceof Response) return body;

		if (path === "send") return await sendCode(body);
		if (path === "captcha/validate") return await validateCaptcha(body);
		if (path === "login") return await login(body);

		return error(404, "未找到该登录接口。");
	} catch (_) {
		// Do not expose request data or upstream responses from a credential endpoint.
		return error(502, "登录服务暂时不可用，请稍后重试。");
	}
}

async function requireAccessKey(context, request) {
	const configured = context.env?.UNICOM_LOGIN_ACCESS_KEY;
	if (typeof configured !== "string" || configured.length < 16) {
		return error(503, "登录服务尚未完成访问控制配置。");
	}

	const supplied = request.headers.get("X-Unicom-Access-Key") || "";
	if (!supplied || !(await secureTextEquals(supplied, configured))) {
		return error(401, "访问口令无效。");
	}
	return null;
}

async function readRequestJson(request) {
	const contentLength = Number(request.headers.get("content-length") || "0");
	if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
		return error(413, "请求内容过大。");
	}

	let text;
	try {
		text = await request.text();
	} catch (_) {
		return error(400, "无法读取请求内容。");
	}
	if (encoder.encode(text).byteLength > MAX_BODY_BYTES) {
		return error(413, "请求内容过大。");
	}
	try {
		const value = JSON.parse(text);
		if (!value || typeof value !== "object" || Array.isArray(value)) {
			return error(400, "请求必须是 JSON 对象。");
		}
		return value;
	} catch (_) {
		return error(400, "请求不是有效的 JSON。");
	}
}

async function sendCode(body) {
	const mobile = normalizeMobile(body.mobile);
	if (!mobile) return error(400, "手机号必须是 11 位数字。");

	const loginContext = contextFrom(body.context, mobile);
	if (!loginContext) return error(400, "登录上下文无效，手机号变更后请重新发送验证码。");

	const resultToken = stringValue(body.result_token).trim();
	if (resultToken.length > 4096) return error(400, "安全验证参数无效。");

	const rateError = await enforceRateLimit("send", mobile, 3);
	if (rateError) return rateError;

	const form = {
		isFirstInstall: "1",
		simCount: "1",
		yw_code: "",
		deviceOS: "android13",
		mobile: rsaEncryptBase64(loginContext.mobile),
		netWay: "Wifi",
		loginCodeLen: "6",
		deviceId: loginContext.device_id,
		deviceCode: loginContext.device_id,
		version: SMS_CLIENT_VERSION,
		send_flag: "",
		resultToken,
		keyVersion: "",
		provinceChanel: "general",
		appId: loginContext.app_id,
		deviceModel: DEVICE_MODEL,
		androidId: loginContext.device_id.slice(0, 16),
		deviceBrand: DEVICE_BRAND,
		timestamp: chinaTimestamp(),
	};

	const result = await postUnicomForm(SEND_SMS_URL, loginContext, form);
	if (result instanceof Response) return result;

	const code = responseCode(result.payload);
	const message = responseMessage(result.payload);
	if (code === "0" || code === "0000" || result.payload.status === "success") {
		return json({
			ok: true,
			status: "sent",
			context: loginContext,
			message: message === "中国联通未返回说明" ? "验证码已发送。" : message,
		});
	}

	const captchaRequired =
		code === "ECS99998" ||
		code === "ECS99999" ||
		message.includes("ECS1164") ||
		message.includes("图形验证码");
	if (captchaRequired) {
		const challengeMobile = stringValue(result.payload.mobile).trim();
		if (!challengeMobile || challengeMobile.length > 4096) {
			return error(400, "运营商要求安全验证，但未返回完整验证参数。");
		}
		return json({
			ok: true,
			status: "captcha_required",
			context: loginContext,
			challenge_mobile: challengeMobile,
			message,
		});
	}

	return carrierError("验证码发送失败", code, message);
}

async function validateCaptcha(body) {
	const loginContext = contextFrom(body.context);
	if (!loginContext) return error(400, "登录上下文无效，请重新发送验证码。");

	const challengeMobile = stringValue(body.challenge_mobile).trim();
	const ticket = stringValue(body.ticket).trim();
	const randStr = stringValue(body.rand_str).trim();
	if (!challengeMobile || !ticket || !randStr) {
		return error(400, "安全验证参数不完整。");
	}
	if (challengeMobile.length > 4096 || ticket.length > 8192 || randStr.length > 1024) {
		return error(400, "安全验证参数无效。");
	}

	const rateError = await enforceRateLimit("captcha", loginContext.mobile, 6);
	if (rateError) return rateError;

	let response;
	try {
		response = await fetch(CAPTCHA_VALIDATE_URL, {
			method: "POST",
			cache: "no-store",
			headers: {
				"Content-Type": "application/json",
				Origin: "https://img.client.10010.com",
				Referer: "https://img.client.10010.com/loginRisk/index.html",
			},
			body: JSON.stringify({
				seq: randomHex(32),
				captchaType: "10",
				mobile: challengeMobile,
				ticket,
				randStr,
				imei: loginContext.device_id,
			}),
		});
	} catch (_) {
		return error(502, "无法连接运营商安全验证服务，请稍后重试。");
	}

	const payload = await readUpstreamJson(response, "安全验证服务");
	if (payload instanceof Response) return payload;
	const code = responseCode(payload);
	if (code !== "0" && code !== "0000") {
		return carrierError("安全验证失败", code, responseMessage(payload));
	}

	const resultToken = stringValue(payload.data?.resultToken).trim();
	if (!resultToken) return error(502, "安全验证成功但未返回可用令牌，请重新尝试。");
	return json({ ok: true, result_token: resultToken });
}

async function login(body) {
	const loginContext = contextFrom(body.context);
	if (!loginContext) return error(400, "登录上下文无效，请重新发送验证码。");

	const smsCode = stringValue(body.sms_code).trim();
	if (!/^\d{4,8}$/.test(smsCode)) return error(400, "短信验证码格式不正确。");

	const rateError = await enforceRateLimit("login", loginContext.mobile, 8);
	if (rateError) return rateError;

	const form = {
		isFirstInstall: "1",
		simCount: "1",
		yw_code: "",
		loginStyle: "0",
		isRemberPwd: "true",
		deviceOS: "android13",
		mobile: rsaEncryptBase64(loginContext.mobile),
		netWay: "Wifi",
		version: SMS_CLIENT_VERSION,
		deviceId: loginContext.device_id,
		password: rsaEncryptBase64(smsCode),
		keyVersion: "",
		provinceChanel: "general",
		appId: loginContext.app_id,
		deviceModel: DEVICE_MODEL,
		androidId: loginContext.device_id.slice(0, 16),
		deviceBrand: DEVICE_BRAND,
		timestamp: chinaTimestamp(),
	};

	const result = await postUnicomForm(SMS_LOGIN_URL, loginContext, form);
	if (result instanceof Response) return result;

	const code = responseCode(result.payload);
	if (code !== "0" && code !== "0000") {
		return carrierError("短信登录失败", code, responseMessage(result.payload));
	}

	const tokenOnline = stringValue(result.payload.token_online).trim();
	if (!tokenOnline) return error(502, "运营商未返回登录凭据，请重新尝试。");

	const cookie = credentialCookie(result.responseCookie, result.payload);
	if (!cookie) return error(502, "运营商未返回可用 Cookie，请重新尝试。");

	return json({
		ok: true,
		credentials: {
			token_online: tokenOnline,
			app_id: stringValue(result.payload.appId).trim() || loginContext.app_id,
			cookie,
			captured_at: chinaNowIso(),
		},
	});
}

async function postUnicomForm(url, loginContext, form) {
	let response;
	try {
		response = await fetch(url, {
			method: "POST",
			cache: "no-store",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"X-Requested-With": "com.sinovatech.unicom.ui",
				"User-Agent": unicomUserAgent(loginContext.mobile),
			},
			body: new URLSearchParams(form).toString(),
		});
	} catch (_) {
		return error(502, "无法连接中国联通登录服务，请稍后重试。");
	}

	const responseCookie = collectResponseCookies(response);
	const payload = await readUpstreamJson(response, "中国联通登录服务");
	if (payload instanceof Response) return payload;
	return { payload, responseCookie };
}

async function readUpstreamJson(response, serviceName) {
	if (!response.ok) return error(502, `${serviceName}暂时不可用，请稍后重试。`);
	let text;
	try {
		text = await response.text();
	} catch (_) {
		return error(502, `${serviceName}响应读取失败，请稍后重试。`);
	}
	try {
		const payload = JSON.parse(text);
		if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error();
		return payload;
	} catch (_) {
		return error(502, `${serviceName}返回了无效响应，请稍后重试。`);
	}
}

function contextFrom(value, expectedMobile) {
	if (value === null || value === undefined) {
		if (!expectedMobile) return null;
		return {
			mobile: expectedMobile,
			device_id: randomHex(32),
			app_id: generateAppId(),
		};
	}
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;

	const mobile = normalizeMobile(value.mobile);
	const deviceId = stringValue(value.device_id).trim();
	const appId = stringValue(value.app_id).trim();
	if (!mobile || (expectedMobile && mobile !== expectedMobile)) return null;
	if (!/^[\da-f]{32}$/i.test(deviceId)) return null;
	if (!/^[\da-f]{160}$/i.test(appId)) return null;
	return { mobile, device_id: deviceId.toLowerCase(), app_id: appId.toLowerCase() };
}

function normalizeMobile(value) {
	const mobile = stringValue(value).trim();
	return /^\d{11}$/.test(mobile) ? mobile : "";
}

function stringValue(value) {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	return "";
}

function responseCode(payload) {
	return stringValue(payload.code ?? payload.rsp_code).trim();
}

function responseMessage(payload) {
	const message = stringValue(payload.dsc ?? payload.msg ?? payload.desc ?? payload.rsp_desc).trim();
	return message.slice(0, 240) || "中国联通未返回说明";
}

function carrierError(prefix, code, message) {
	const codeSuffix = code ? `（${code}）` : "";
	return error(400, `${prefix}${codeSuffix}：${message || "请稍后重试。"}`);
}

function unicomUserAgent(mobile) {
	return `Mozilla/5.0 (Linux; Android 13; ${DEVICE_MODEL} Build/TKQ1.220829.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/107.0.5304.141 Mobile Safari/537.36; unicom{version:${SMS_CLIENT_VERSION},desmobile:${mobile}};devicetype{deviceBrand:${DEVICE_BRAND},deviceModel:${DEVICE_MODEL}};{yw_code:}`;
}

function chinaTimestamp() {
	const china = new Date(Date.now() + 8 * 60 * 60 * 1000);
	const pad = (value) => String(value).padStart(2, "0");
	return `${china.getUTCFullYear()}${pad(china.getUTCMonth() + 1)}${pad(china.getUTCDate())}${pad(china.getUTCHours())}${pad(china.getUTCMinutes())}${pad(china.getUTCSeconds())}`;
}

function chinaNowIso() {
	const china = new Date(Date.now() + 8 * 60 * 60 * 1000);
	const pad = (value) => String(value).padStart(2, "0");
	return `${china.getUTCFullYear()}-${pad(china.getUTCMonth() + 1)}-${pad(china.getUTCDate())}T${pad(china.getUTCHours())}:${pad(china.getUTCMinutes())}:${pad(china.getUTCSeconds())}+08:00`;
}

function randomHex(length) {
	const bytes = crypto.getRandomValues(new Uint8Array(Math.ceil(length / 2)));
	return Array.from(bytes, (value) => value.toString(16).padStart(2, "0"))
		.join("")
		.slice(0, length);
}

function randomDigits(count) {
	let output = "";
	while (output.length < count) {
		const values = crypto.getRandomValues(new Uint8Array(count));
		for (const value of values) {
			if (value < 250) output += String(value % 10);
			if (output.length === count) break;
		}
	}
	return output;
}

function generateAppId() {
	const digits = randomDigits(5);
	return `${digits[0]}f${digits[1]}af${digits[2]}${digits[3]}ad${digits[4]}912d306b5053abf90c7ebbb695887bc870ae0706d573c348539c26c5c0a878641fcc0d3e90acb9be1e6ef858a59af546f3c826988332376b7d18c8ea2398ee3a9c3db947e2471d32a49612`;
}

function rsaEncryptBase64(plaintext) {
	const data = encoder.encode(plaintext);
	const blockLength = 128;
	if (!data.length || data.length > blockLength - 11) throw new Error("RSA 明文长度无效");

	const block = new Uint8Array(blockLength);
	block[0] = 0;
	block[1] = 2;
	const paddingEnd = blockLength - data.length - 1;
	let index = 2;
	while (index < paddingEnd) {
		const value = crypto.getRandomValues(new Uint8Array(1))[0];
		if (value !== 0) block[index++] = value;
	}
	block[paddingEnd] = 0;
	block.set(data, paddingEnd + 1);

	const encrypted = modPow(bytesToBigInt(block), RSA_EXPONENT, RSA_MODULUS);
	return bytesToBase64(bigIntToBytes(encrypted, blockLength));
}

function modPow(base, exponent, modulus) {
	let result = 1n;
	let factor = base % modulus;
	let power = exponent;
	while (power > 0n) {
		if (power & 1n) result = (result * factor) % modulus;
		factor = (factor * factor) % modulus;
		power >>= 1n;
	}
	return result;
}

function bytesToBigInt(bytes) {
	let value = 0n;
	for (const byte of bytes) value = (value << 8n) | BigInt(byte);
	return value;
}

function bigIntToBytes(value, length) {
	const bytes = new Uint8Array(length);
	for (let index = length - 1; index >= 0; index -= 1) {
		bytes[index] = Number(value & 255n);
		value >>= 8n;
	}
	return bytes;
}

function bytesToBase64(bytes) {
	let binary = "";
	for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
	return btoa(binary);
}

async function secureTextEquals(left, right) {
	const [leftDigest, rightDigest] = await Promise.all([
		crypto.subtle.digest("SHA-256", encoder.encode(left)),
		crypto.subtle.digest("SHA-256", encoder.encode(right)),
	]);
	const leftBytes = new Uint8Array(leftDigest);
	const rightBytes = new Uint8Array(rightDigest);
	let different = 0;
	for (let index = 0; index < leftBytes.length; index += 1) different |= leftBytes[index] ^ rightBytes[index];
	return different === 0;
}

async function enforceRateLimit(kind, mobile, limit) {
	const digest = await crypto.subtle.digest("SHA-256", encoder.encode(mobile));
	const hash = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
	const key = `${kind}:${hash}`;
	const now = Date.now();
	const attempts = (rateAttempts.get(key) || []).filter((time) => now - time < RATE_WINDOW_MS);
	if (attempts.length >= limit) {
		rateAttempts.set(key, attempts);
		return error(429, "操作过于频繁，请稍后再试。");
	}
	attempts.push(now);
	rateAttempts.set(key, attempts);
	if (rateAttempts.size > 512) pruneRateAttempts(now);
	return null;
}

function pruneRateAttempts(now) {
	for (const [key, attempts] of rateAttempts) {
		const active = attempts.filter((time) => now - time < RATE_WINDOW_MS);
		if (active.length) rateAttempts.set(key, active);
		else rateAttempts.delete(key);
	}
}

function collectResponseCookies(response) {
	const raw = typeof response.headers.getSetCookie === "function"
		? response.headers.getSetCookie()
		: [response.headers.get("set-cookie")].filter(Boolean);
	return raw.join("; ");
}

function credentialCookie(responseCookie, payload) {
	let source = responseCookie || "";
	for (const key of ["JUT", "ecs_token", "ecs_acc"]) {
		const value = stringValue(payload[key]).trim();
		if (!value) continue;
		const part = value.startsWith(`${key}=`) ? value : `${key}=${value}`;
		source += source ? `; ${part}` : part;
	}

	const parsed = parseCookieString(source);
	return ["JUT", "ecs_token", "ecs_acc"]
		.filter((key) => parsed.has(key))
		.map((key) => `${key}=${parsed.get(key)}`)
		.join("; ");
}

function parseCookieString(input) {
	const attributes = new Set([
		"path", "domain", "expires", "max-age", "secure", "httponly", "samesite", "priority", "partitioned",
	]);
	const result = new Map();
	for (const segment of input.split(";")) {
		const separator = segment.indexOf("=");
		if (separator < 1) continue;
		let key = segment.slice(0, separator).trim();
		const comma = key.lastIndexOf(",");
		if (comma >= 0) key = key.slice(comma + 1).trim();
		const value = segment.slice(separator + 1).trim().replace(/^"|"$/g, "");
		if (!key || !value || attributes.has(key.toLowerCase())) continue;
		result.set(key, value);
	}
	return result;
}

function json(value, extraHeaders = {}) {
	return new Response(JSON.stringify(value), {
		status: 200,
		headers: securityHeaders({ "Content-Type": "application/json; charset=utf-8", ...extraHeaders }),
	});
}

function error(status, message, extraHeaders = {}) {
	return new Response(JSON.stringify({ ok: false, message }), {
		status,
		headers: securityHeaders({ "Content-Type": "application/json; charset=utf-8", ...extraHeaders }),
	});
}

function securityHeaders(headers) {
	return {
		"Cache-Control": "no-store, max-age=0",
		"Referrer-Policy": "no-referrer",
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options": "DENY",
		"Cross-Origin-Resource-Policy": "same-origin",
		"Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
		...headers,
	};
}
