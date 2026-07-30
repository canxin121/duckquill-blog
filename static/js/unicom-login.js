(() => {
	"use strict";

	const CAPTCHA_APP_ID = "195809716";
	const CREDENTIAL_KEYS = ["token_online", "app_id", "cookie", "captured_at"];
	const CAPTCHA_SCRIPT_URL = "https://turing.captcha.qcloud.com/TJCaptcha.js";
	const app = document.getElementById("unicom-login-app");

	if (!app) return;

	const apiBase = app.dataset.apiBase || "/api/unicom";
	const byId = (id) => document.getElementById(id);
	const fields = {
		mobile: byId("unicom-mobile"),
		smsCode: byId("unicom-sms-code"),
		send: byId("unicom-send-code"),
		login: byId("unicom-login-submit"),
		message: byId("unicom-login-message"),
		result: byId("unicom-login-result"),
		rows: byId("unicom-credential-rows"),
		copyPackage: byId("unicom-copy-package"),
		clear: byId("unicom-clear-result"),
	};

	let loginContext = null;
	let lastCredentials = null;
	let cooldownTimer = null;
	let captchaScriptPromise = null;

	function normalizeDigits(input, maximum) {
		const value = input.value.replace(/\D/g, "").slice(0, maximum);
		input.value = value;
		return value;
	}

	function cleanMobile() {
		const mobile = normalizeDigits(fields.mobile, 11);
		if (loginContext && loginContext.mobile !== mobile) loginContext = null;
		return mobile;
	}

	function cleanCode() {
		return normalizeDigits(fields.smsCode, 8);
	}

	function showMessage(text, type = "error") {
		fields.message.textContent = text || "";
		fields.message.className = text
			? `unicom-login-message is-visible is-${type}`
			: "unicom-login-message";
	}

	function setButton(button, busy, label) {
		button.disabled = busy;
		if (label) button.textContent = label;
	}

	async function postJson(path, value) {
		const response = await fetch(`${apiBase}${path}`, {
			method: "POST",
			credentials: "omit",
			cache: "no-store",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(value),
		});
		const payload = await response.json().catch(() => ({
			ok: false,
			message: "登录服务返回了无法识别的响应。",
		}));
		if (!response.ok || !payload.ok) {
			throw new Error(payload.message || `请求失败（HTTP ${response.status}）。`);
		}
		return payload;
	}

	function startCooldown(seconds = 60) {
		window.clearInterval(cooldownTimer);
		let remaining = seconds;
		fields.send.disabled = true;
		fields.send.textContent = `${remaining} 秒后重试`;
		cooldownTimer = window.setInterval(() => {
			remaining -= 1;
			if (remaining <= 0) {
				window.clearInterval(cooldownTimer);
				cooldownTimer = null;
				fields.send.disabled = false;
				fields.send.textContent = "发送验证码";
				return;
			}
			fields.send.textContent = `${remaining} 秒后重试`;
		}, 1000);
	}

	function loadCaptchaScript() {
		if (typeof window.TencentCaptcha === "function") {
			return Promise.resolve();
		}
		if (captchaScriptPromise) return captchaScriptPromise;

		captchaScriptPromise = new Promise((resolve, reject) => {
			const existing = document.querySelector(`script[src="${CAPTCHA_SCRIPT_URL}"]`);
			if (existing) {
				existing.addEventListener("load", resolve, { once: true });
				existing.addEventListener("error", reject, { once: true });
				return;
			}
			const script = document.createElement("script");
			script.src = CAPTCHA_SCRIPT_URL;
			script.async = true;
			script.referrerPolicy = "no-referrer";
			script.addEventListener("load", resolve, { once: true });
			script.addEventListener("error", () => reject(new Error("腾讯验证码组件加载失败。")), { once: true });
			document.head.append(script);
		}).catch((error) => {
			captchaScriptPromise = null;
			throw error;
		});

		return captchaScriptPromise;
	}

	async function sendCode(resultToken = "") {
		const mobile = cleanMobile();
		if (mobile.length !== 11) {
			showMessage("请输入 11 位手机号码。");
			return;
		}

		setButton(fields.send, true, "正在发送…");
		try {
			const payload = await postJson("/send", {
				mobile,
				context: loginContext,
				result_token: resultToken,
			});
			loginContext = payload.context;
			if (payload.status === "captcha_required") {
				showMessage(payload.message || "需要完成安全验证后才能发送短信。", "info");
				await openCaptcha(payload.challenge_mobile);
				return;
			}
			showMessage(payload.message || "验证码已发送，请查收短信。", "success");
			startCooldown();
		} catch (error) {
			showMessage(error.message || "验证码发送失败，请稍后重试。", "error");
			setButton(fields.send, false, "发送验证码");
		}
	}

	async function openCaptcha(challengeMobile) {
		if (!loginContext || !challengeMobile) {
			showMessage("运营商返回的安全验证参数不完整，请稍后重试。", "error");
			setButton(fields.send, false, "发送验证码");
			return;
		}

		try {
			await loadCaptchaScript();
		} catch (error) {
			showMessage(error.message || "腾讯验证码组件加载失败，请刷新后重试。", "error");
			setButton(fields.send, false, "发送验证码");
			return;
		}

		if (typeof window.TencentCaptcha !== "function") {
			showMessage("腾讯验证码组件不可用，请刷新后重试。", "error");
			setButton(fields.send, false, "发送验证码");
			return;
		}

		const captcha = new window.TencentCaptcha(CAPTCHA_APP_ID, async (result) => {
			if (!result || result.ret !== 0) {
				showMessage("安全验证已取消。", "info");
				setButton(fields.send, false, "发送验证码");
				return;
			}

			try {
				const validated = await postJson("/captcha/validate", {
					context: loginContext,
					challenge_mobile: challengeMobile,
					ticket: result.ticket,
					rand_str: result.randstr,
				});
				await sendCode(validated.result_token);
			} catch (error) {
				showMessage(error.message || "安全验证失败，请重新尝试。", "error");
				setButton(fields.send, false, "发送验证码");
			}
		});

		try {
			captcha.show();
		} catch (error) {
			showMessage(error?.message || "无法打开安全验证窗口，请刷新后重试。", "error");
			setButton(fields.send, false, "发送验证码");
		}
	}

	async function login() {
		const smsCode = cleanCode();
		if (!loginContext) {
			showMessage("请先发送短信验证码。", "error");
			return;
		}
		if (smsCode.length < 4) {
			showMessage("请输入短信中的验证码。", "error");
			return;
		}

		setButton(fields.login, true, "正在登录…");
		fields.result.hidden = true;
		try {
			const payload = await postJson("/login", {
				context: loginContext,
				sms_code: smsCode,
			});
			renderCredentials(payload.credentials);
			showMessage("登录成功。请手动复制并安全保存凭据。", "success");
			fields.mobile.value = "";
			fields.smsCode.value = "";
			loginContext = null;
		} catch (error) {
			showMessage(error.message || "短信登录失败，请检查验证码后重试。", "error");
		} finally {
			setButton(fields.login, false, "登录并生成凭据");
		}
	}

	function maskValue(key, value) {
		if (!value) return "（空）";
		if (key !== "token_online" && key !== "cookie") return value;
		if (value.length <= 14) return "********";
		return `${value.slice(0, 8)}********${value.slice(-6)}`;
	}

	async function copyText(value, button) {
		if (!value) {
			showMessage("没有可复制的数据。", "error");
			return;
		}
		try {
			await navigator.clipboard.writeText(value);
			showMessage("已复制到剪贴板。", "success");
			button?.classList.add("is-copied");
			window.setTimeout(() => button?.classList.remove("is-copied"), 800);
		} catch (_) {
			const area = document.createElement("textarea");
			area.value = value;
			area.readOnly = true;
			area.style.position = "fixed";
			area.style.left = "-9999px";
			document.body.append(area);
			area.select();
			const copied = document.execCommand("copy");
			area.remove();
			showMessage(copied ? "已复制到剪贴板。" : "复制失败，请手动选择复制。", copied ? "success" : "error");
		}
	}

	function renderCredentials(credentials) {
		lastCredentials = Object.fromEntries(
			CREDENTIAL_KEYS.map((key) => [key, String(credentials[key] || "")]),
		);
		fields.rows.replaceChildren();

		for (const key of CREDENTIAL_KEYS) {
			const value = lastCredentials[key];
			const row = document.createElement("div");
			row.className = "unicom-credential-row";
			const label = document.createElement("div");
			label.className = "unicom-credential-key";
			label.textContent = key;
			const preview = document.createElement("div");
			preview.className = "unicom-credential-value";
			preview.textContent = maskValue(key, value);
			preview.title = "敏感数据已遮挡；点击复制可获取原始值。";
			const copy = document.createElement("button");
			copy.type = "button";
			copy.textContent = "复制";
			copy.addEventListener("click", () => copyText(value, copy));
			row.append(label, preview, copy);
			fields.rows.append(row);
		}

		fields.result.hidden = false;
	}

	function clearSensitiveState() {
		loginContext = null;
		lastCredentials = null;
		window.clearInterval(cooldownTimer);
		cooldownTimer = null;
		fields.mobile.value = "";
		fields.smsCode.value = "";
		fields.send.disabled = false;
		fields.send.textContent = "发送验证码";
		fields.rows.replaceChildren();
		fields.result.hidden = true;
		showMessage("");
	}

	fields.mobile.addEventListener("input", cleanMobile);
	fields.smsCode.addEventListener("input", cleanCode);
	fields.send.addEventListener("click", () => sendCode());
	fields.login.addEventListener("click", login);
	fields.copyPackage.addEventListener("click", () => {
		copyText(lastCredentials && JSON.stringify(lastCredentials, null, 2), fields.copyPackage);
	});
	fields.clear.addEventListener("click", () => clearSensitiveState());
	window.addEventListener("pagehide", clearSensitiveState);
})();
