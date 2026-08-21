(() => {
	"use strict";

	const app = document.getElementById("tsinghua-benefits-app");
	if (!app) return;

	const byId = (id) => document.getElementById(id);
	const nodes = {
		cards: byId("tsinghua-benefits-cards"),
		count: byId("tsinghua-benefits-count"),
		filters: byId("tsinghua-benefits-filters"),
		search: byId("tsinghua-benefits-search-input"),
		mobileSearch: byId("tsinghua-benefits-mobile-search-input"),
		sort: byId("tsinghua-benefits-sort-select"),
		reset: byId("tsinghua-benefits-reset"),
		done: byId("tsinghua-benefits-done"),
		sidebar: byId("tsinghua-benefits-sidebar"),
		mobileFilter: byId("tsinghua-benefits-mobile-filter"),
		mobileOverlay: byId("tsinghua-benefits-mobile-overlay"),
		modalBg: byId("tsinghua-benefits-modal-bg"),
		modal: byId("tsinghua-benefits-modal"),
		toast: byId("tsinghua-benefits-toast"),
	};
	const dataUrl = app.dataset.dataUrl;
	const directModes = new Set(["自动获得", "认证即领", "直接使用"]);
	const effortRank = { 极低: 0, 低: 1, 中: 2, 高: 3, 竞争性: 4 };
	const filterOrders = {
		scope: ["清华专属", "海淀专属", "北京专属", "学生通用", "海外/地区限定"],
		acquisition: ["自动获得", "认证即领", "直接使用", "学生价/付费", "预约/报名", "申请审核", "项目报名", "项目申请", "岗位/持续参与", "奖学金/评定", "竞赛/评奖", "动态待开放"],
		effort: ["极低", "低", "中", "高", "竞争性"],
	};
	let items = [];
	let lastFocusedElement = null;
	let toastTimer = null;
	const state = {
		query: "",
		scopes: new Set(),
		acquisition: new Set(),
		effort: new Set(),
		status: new Set(),
		category: new Set(),
		sort: "default",
	};

	function escapeHtml(value = "") {
		return String(value).replace(/[&<>"']/g, (character) => ({
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			'"': "&quot;",
			"'": "&#039;",
		}[character]));
	}

	function externalUrl(value) {
		const url = String(value || "").trim();
		return /^https?:\/\//i.test(url) ? url : "";
	}

	function imageUrl(value) {
		const url = String(value || "").trim();
		return /^data:image\/(?:png|jpe?g|webp);base64,/i.test(url) ? url : "";
	}

	function unique(field) {
		return [...new Set(items.map((item) => item[field]).filter(Boolean))];
	}

	function countBy(field, value) {
		return items.filter((item) => item[field] === value).length;
	}

	function orderedValues(field) {
		const values = unique(field);
		const preferred = filterOrders[field] || [];
		return preferred.filter((value) => values.includes(value)).concat(
			values.filter((value) => !preferred.includes(value)),
		);
	}

	function filterBlock(title, field, values) {
		if (!values.length) return "";
		return [
			'<section class="tsinghua-benefits-filter-block">',
			'<span class="tsinghua-benefits-filter-label">', escapeHtml(title), "</span>",
			'<div class="tsinghua-benefits-check-list">',
			values.map((value) => [
				'<label class="tsinghua-benefits-check-row">',
				'<input type="checkbox" data-filter="', escapeHtml(field), '" value="', escapeHtml(value), '">',
				"<span>", escapeHtml(value), "</span>",
				"<em>", countBy(field, value), "</em>",
				"</label>",
			].join("")).join(""),
			"</div>",
			"</section>",
		].join("");
	}

	function renderFilters() {
		nodes.filters.innerHTML = [
			filterBlock("适用范围", "scope", orderedValues("scope")),
			filterBlock("获取方式", "acquisition", orderedValues("acquisition")),
			filterBlock("投入门槛", "effort", orderedValues("effort")),
			filterBlock("当前状态", "status", orderedValues("status")),
			filterBlock("分类", "category", orderedValues("category")),
		].join("");
	}

	function setForField(field) {
		return state[field];
	}

	function itemKey(item) {
		return String(item.id);
	}

	function itemSearchText(item) {
		const children = (item.children || []).map((child) => [
			child.name,
			child.benefit,
			child.cost,
		].filter(Boolean).join(" ")).join(" ");
		const platforms = (item.platforms || []).map((platform) => [
			platform.label,
			platform.platform,
			platform.note,
		].filter(Boolean).join(" ")).join(" ");
		return [
			item.name,
			item.benefit,
			item.category,
			item.subcategory,
			item.scope,
			item.contentType,
			item.acquisition,
			item.effort,
			item.status,
			item.cost,
			item.eligibility,
			item.requirements,
			item.validity,
			item.howto,
			item.notes,
			children,
			platforms,
		].filter(Boolean).join(" ").toLowerCase();
	}

	function matchesQuery(item) {
		const query = state.query.trim().toLowerCase();
		return !query || itemSearchText(item).includes(query);
	}

	function isLimited(item) {
		return /限时|动态|截止|待开放|核验|分批|地区限制|需App/.test(
			String(item.status || "") + " " + String(item.validity || ""),
		);
	}

	function ratingStars(item) {
		return ((item.rating || "").match(/★/g) || []).length;
	}

	function filteredItems() {
		const result = items.filter((item) => {
			if (!matchesQuery(item)) return false;
			if (state.scopes.size && !state.scopes.has(item.scope)) return false;
			if (state.acquisition.size && !state.acquisition.has(item.acquisition)) return false;
			if (state.effort.size && !state.effort.has(item.effort)) return false;
			if (state.status.size && !state.status.has(item.status)) return false;
			if (state.category.size && !state.category.has(item.category)) return false;
			return true;
		});

		if (state.sort === "easy") {
			result.sort((a, b) => (effortRank[a.effort] ?? 9) - (effortRank[b.effort] ?? 9) || a.id - b.id);
		} else if (state.sort === "rating") {
			result.sort((a, b) => ratingStars(b) - ratingStars(a) || a.id - b.id);
		} else if (state.sort === "limited") {
			result.sort((a, b) => Number(isLimited(b)) - Number(isLimited(a)) || a.id - b.id);
		} else if (state.sort === "name") {
			result.sort((a, b) => String(a.name).localeCompare(String(b.name), "zh-CN"));
		} else {
			result.sort((a, b) => a.id - b.id);
		}
		return result;
	}

	function scopeBadgeClass(scope) {
		if (scope === "清华专属") return "tsinghua-benefits-badge--green";
		if (scope === "北京专属") return "tsinghua-benefits-badge--blue";
		if (scope === "学生通用") return "tsinghua-benefits-badge--accent";
		return "tsinghua-benefits-badge--amber";
	}

	function modeBadgeClass(mode) {
		if (directModes.has(mode)) return "tsinghua-benefits-badge--green";
		if (["学生价/付费", "预约/报名"].includes(mode)) return "tsinghua-benefits-badge--blue";
		return "tsinghua-benefits-badge--accent";
	}

	function statusBadgeClass(status) {
		if (/截止|结束|过期/.test(status || "")) return "tsinghua-benefits-badge--red";
		if (/动态|核验|待|分批|地区|App/.test(status || "")) return "tsinghua-benefits-badge--amber";
		return "tsinghua-benefits-badge--green";
	}

	function badge(value, className) {
		return value
			? '<span class="tsinghua-benefits-badge ' + className + '">' + escapeHtml(value) + "</span>"
			: "";
	}

	function cardHtml(item) {
		const key = itemKey(item);
		const itemUrl = externalUrl(item.url);
		const category = [item.category, item.subcategory].filter(Boolean).join(" · ");
		const primaryAction = itemUrl
			? '<a class="tsinghua-benefits-button tsinghua-benefits-button--primary" href="' + escapeHtml(itemUrl) + '" target="_blank" rel="noopener noreferrer">打开入口 ↗</a>'
			: '<button class="tsinghua-benefits-button tsinghua-benefits-button--primary" type="button" data-open-detail="' + escapeHtml(key) + '">查看办理方式</button>';
		return [
			'<article class="tsinghua-benefits-card">',
			'<div class="tsinghua-benefits-card-top">',
			'<div class="tsinghua-benefits-card-title">',
			"<h3>", escapeHtml(item.name), "</h3>",
			'<span class="tsinghua-benefits-card-category">', escapeHtml(category || item.contentType || "学生服务"), "</span>",
			"</div>",
			"</div>",
			'<div class="tsinghua-benefits-badges">',
			badge(item.scope, scopeBadgeClass(item.scope)),
			badge(item.acquisition, modeBadgeClass(item.acquisition)),
			badge(item.status, statusBadgeClass(item.status)),
			"</div>",
			'<p class="tsinghua-benefits-card-summary">', escapeHtml(item.benefit || "暂无简介，请打开详情查看办理方式。"), "</p>",
			'<div class="tsinghua-benefits-meta-grid">',
			'<div class="tsinghua-benefits-meta"><span>费用 / 额度</span><strong title="', escapeHtml(item.cost || "—"), '">', escapeHtml(item.cost || "—"), "</strong></div>",
			'<div class="tsinghua-benefits-meta"><span>投入门槛</span><strong>', escapeHtml(item.effort || "—"), "</strong></div>",
			"</div>",
			'<div class="tsinghua-benefits-card-extra">',
			item.rating ? '<span class="tsinghua-benefits-rating" aria-label="评分 ' + escapeHtml(item.rating) + '">' + escapeHtml(item.rating) + "</span>" : "<span></span>",
			item.children && item.children.length ? "<span>含 " + item.children.length + " 项子权益</span>" : "<span>独立入口</span>",
			"</div>",
			'<div class="tsinghua-benefits-actions">',
			primaryAction,
			itemUrl ? '<button class="tsinghua-benefits-button" type="button" data-open-detail="' + escapeHtml(key) + '">详情</button>' : "",
			"</div>",
			"</article>",
		].join("");
	}

	function render() {
		const result = filteredItems();
		nodes.count.textContent = result.length + " 项";
		nodes.cards.setAttribute("aria-busy", "false");
		nodes.cards.innerHTML = result.length
			? result.map(cardHtml).join("")
			: '<div class="tsinghua-benefits-empty">没有找到匹配内容。可以减少筛选条件，或换一个关键词。</div>';
	}

	function showToast(message) {
		nodes.toast.textContent = message;
		nodes.toast.classList.add("is-visible");
		window.clearTimeout(toastTimer);
		toastTimer = window.setTimeout(() => nodes.toast.classList.remove("is-visible"), 1500);
	}

	function childHtml(child) {
		const childUrl = externalUrl(child.url || child.source);
		return [
			'<div class="tsinghua-benefits-child">',
			"<strong>", escapeHtml(child.name || "子权益"), "</strong>",
			child.benefit || child.cost ? "<p>" + escapeHtml(child.benefit || child.cost) + "</p>" : "",
			child.status ? '<p><span class="tsinghua-benefits-badge tsinghua-benefits-badge--accent">' + escapeHtml(child.status) + "</span></p>" : "",
			childUrl ? '<a href="' + escapeHtml(childUrl) + '" target="_blank" rel="noopener noreferrer">查看来源 ↗</a>' : "",
			"</div>",
		].join("");
	}

	function platformHtml(platform) {
		const platformUrl = externalUrl(platform.url);
		return [
			'<div class="tsinghua-benefits-platform-item">',
			'<div class="tsinghua-benefits-platform-name">', escapeHtml(platform.platform || "入口"), "</div>",
			platformUrl
				? '<a href="' + escapeHtml(platformUrl) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(platform.label || "打开平台") + " ↗</a>"
				: "<span>" + escapeHtml(platform.label || "暂无入口") + "</span>",
			platform.note ? '<div class="tsinghua-benefits-platform-note">' + escapeHtml(platform.note) + "</div>" : "",
			"</div>",
		].join("");
	}

	function detailBox(label, value) {
		return '<div class="tsinghua-benefits-detail-box"><span>' + escapeHtml(label) + "</span><div>" + escapeHtml(value || "—") + "</div></div>";
	}

	function openDetail(id) {
		const item = items.find((candidate) => itemKey(candidate) === String(id));
		if (!item) return;
		const itemUrl = externalUrl(item.url);
		const qr = imageUrl(item.qr);
		const sourceUrl = externalUrl(item.source);
		lastFocusedElement = document.activeElement;
		nodes.modal.innerHTML = [
			'<div class="tsinghua-benefits-modal-head">',
			'<div class="tsinghua-benefits-card-title">',
			'<div class="tsinghua-benefits-badges">',
			badge(item.scope, scopeBadgeClass(item.scope)),
			badge(item.acquisition, modeBadgeClass(item.acquisition)),
			badge(item.status, statusBadgeClass(item.status)),
			"</div>",
			'<h2 id="tsinghua-benefits-modal-title">', escapeHtml(item.name), "</h2>",
			"</div>",
			'<button class="tsinghua-benefits-modal-close" type="button" data-close-modal aria-label="关闭详情">×</button>',
			"</div>",
			'<div class="tsinghua-benefits-modal-body">',
			'<div class="tsinghua-benefits-detail-grid">',
			detailBox("费用 / 额度", item.cost),
			detailBox("投入门槛", item.effort),
			detailBox("适用对象", item.eligibility),
			detailBox("有效期", item.validity),
			"</div>",
			'<section class="tsinghua-benefits-detail-section"><h3>内容</h3><p>', escapeHtml(item.benefit || "—"), "</p></section>",
			'<section class="tsinghua-benefits-detail-section"><h3>怎么使用</h3><p>', escapeHtml(item.howto || "—"), "</p></section>",
			item.requirements ? '<section class="tsinghua-benefits-detail-section"><h3>认证 / 条件</h3><p>' + escapeHtml(item.requirements) + "</p></section>" : "",
			item.notes ? '<section class="tsinghua-benefits-detail-section"><h3>注意事项</h3><p>' + escapeHtml(item.notes) + "</p></section>" : "",
			item.platforms && item.platforms.length
				? '<section class="tsinghua-benefits-detail-section"><h3>平台入口</h3><div class="tsinghua-benefits-platform-grid">' + item.platforms.map(platformHtml).join("") + "</div></section>"
				: "",
			qr
				? [
					'<div class="tsinghua-benefits-qr-panel">',
					'<img src="', qr, '" alt="', escapeHtml(item.qrTitle || "二维码"), '" loading="lazy" decoding="async">',
					'<div class="tsinghua-benefits-qr-copy"><strong>', escapeHtml(item.qrTitle || "移动端入口"), "</strong>",
					item.qrCaption ? "<p>" + escapeHtml(item.qrCaption) + "</p>" : "",
					item.appPath ? '<div class="tsinghua-benefits-qr-path">' + escapeHtml(item.appPath) + "</div>" : "",
					"</div></div>",
				].join("")
				: "",
			item.children && item.children.length
				? '<section class="tsinghua-benefits-detail-section"><h3>包含内容</h3><div class="tsinghua-benefits-children">' + item.children.map(childHtml).join("") + "</div></section>"
				: "",
			sourceUrl
				? '<section class="tsinghua-benefits-detail-section"><h3>信息来源</h3><p><a class="external" href="' + escapeHtml(sourceUrl) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(sourceUrl) + " ↗</a></p></section>"
				: "",
			itemUrl ? '<div class="tsinghua-benefits-modal-actions"><a class="tsinghua-benefits-button tsinghua-benefits-button--primary" href="' + escapeHtml(itemUrl) + '" target="_blank" rel="noopener noreferrer">打开入口 ↗</a></div>' : "",
			"</div>",
		].join("");
		nodes.modalBg.classList.add("is-open");
		nodes.modalBg.setAttribute("aria-hidden", "false");
		updateBodyLock();
		nodes.modal.focus();
	}

	function closeModal() {
		nodes.modalBg.classList.remove("is-open");
		nodes.modalBg.setAttribute("aria-hidden", "true");
		nodes.modal.innerHTML = "";
		updateBodyLock();
		if (lastFocusedElement && document.contains(lastFocusedElement)) lastFocusedElement.focus();
		lastFocusedElement = null;
	}

	function openSidebar() {
		nodes.sidebar.classList.add("is-open");
		nodes.mobileOverlay.classList.add("is-open");
		nodes.mobileOverlay.setAttribute("aria-hidden", "false");
		nodes.mobileFilter.setAttribute("aria-expanded", "true");
		updateBodyLock();
	}

	function closeSidebar() {
		nodes.sidebar.classList.remove("is-open");
		nodes.mobileOverlay.classList.remove("is-open");
		nodes.mobileOverlay.setAttribute("aria-hidden", "true");
		nodes.mobileFilter.setAttribute("aria-expanded", "false");
		updateBodyLock();
	}

	function updateBodyLock() {
		document.body.style.overflow = nodes.modalBg.classList.contains("is-open") || nodes.sidebar.classList.contains("is-open")
			? "hidden"
			: "";
	}

	function resetFilters() {
		state.query = "";
		state.scopes.clear();
		state.acquisition.clear();
		state.effort.clear();
		state.status.clear();
		state.category.clear();
		state.sort = "default";
		nodes.search.value = "";
		nodes.mobileSearch.value = "";
		nodes.sort.value = "default";
		nodes.filters.querySelectorAll("[data-filter]").forEach((input) => {
			input.checked = false;
		});
		render();
		showToast("筛选条件已重置");
	}

	function showLoadError() {
		nodes.cards.setAttribute("aria-busy", "false");
		nodes.cards.innerHTML = [
			'<div class="tsinghua-benefits-error">',
			"权益清单加载失败，请检查网络后重试。",
			'<br><button class="tsinghua-benefits-button" type="button" data-retry>重新加载</button>',
			"</div>",
		].join("");
	}

	async function loadData() {
		nodes.cards.setAttribute("aria-busy", "true");
		nodes.cards.innerHTML = '<div class="tsinghua-benefits-loading">正在加载权益清单…</div>';
		try {
			const response = await fetch(dataUrl, { cache: "no-store" });
			if (!response.ok) throw new Error("HTTP " + response.status);
			const payload = await response.json();
			if (!Array.isArray(payload)) throw new Error("invalid data");
			items = payload;
			renderFilters();
			render();
		} catch (_error) {
			showLoadError();
		}
	}

	[nodes.search, nodes.mobileSearch].forEach((input) => {
		input.addEventListener("input", (event) => {
			state.query = event.target.value;
			nodes.search.value = state.query;
			nodes.mobileSearch.value = state.query;
			render();
		});
	});

	nodes.sort.addEventListener("change", (event) => {
		state.sort = event.target.value;
		render();
	});

	nodes.reset.addEventListener("click", resetFilters);
	nodes.done.addEventListener("click", closeSidebar);
	nodes.mobileFilter.addEventListener("click", openSidebar);
	nodes.mobileOverlay.addEventListener("click", closeSidebar);
	nodes.modalBg.addEventListener("click", (event) => {
		if (event.target === nodes.modalBg) closeModal();
	});

	app.addEventListener("change", (event) => {
		const target = event.target;
		if (target.matches("[data-filter]")) {
			const selected = setForField(target.dataset.filter);
			if (!selected) return;
			target.checked ? selected.add(target.value) : selected.delete(target.value);
			render();
		}
	});

	document.addEventListener("click", (event) => {
		const detail = event.target.closest("[data-open-detail]");
		if (detail) {
			openDetail(detail.dataset.openDetail);
			return;
		}
		const close = event.target.closest("[data-close-modal]");
		if (close) closeModal();
		const retry = event.target.closest("[data-retry]");
		if (retry) loadData();
	});

	document.addEventListener("keydown", (event) => {
		if (event.key !== "Escape") return;
		if (nodes.modalBg.classList.contains("is-open")) closeModal();
		else if (nodes.sidebar.classList.contains("is-open")) closeSidebar();
	});

	loadData();
})();
