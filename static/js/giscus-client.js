/*
 * Based on upstream giscus client logic:
 * https://github.com/giscus/giscus/blob/main/client.ts
 *
 * Local adjustments:
 * - load from a locally hosted script path
 * - allow overriding widget host via data-host
 * - remove iframe allow="clipboard-write" to avoid Firefox warnings
 */
(function () {
  var GISCUS_SESSION_KEY = "giscus-session";
  var script = document.currentScript;
  if (!script) {
    return;
  }

  var attributes = script.dataset;
  var giscusOrigin = resolveHost(attributes.host);

  function resolveHost(rawHost) {
    var fallback = "https://giscus.app";

    if (!rawHost) {
      return fallback;
    }

    var normalized = rawHost.trim();
    if (!normalized) {
      return fallback;
    }

    if (!/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(normalized)) {
      normalized = "https://" + normalized.replace(/^\/+/, "");
    }

    try {
      return new URL(normalized).origin;
    } catch (error) {
      return fallback;
    }
  }

  function formatError(message) {
    return "[giscus] An error occurred. Error message: \"" + message + "\".";
  }

  function normalizeTheme(theme) {
    if (!theme) {
      return "";
    }

    var value = theme.trim();
    if (!value) {
      return "";
    }

    if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value)) {
      return value;
    }

    if (value.charAt(0) === "/" || value.indexOf("./") === 0 || value.indexOf("../") === 0) {
      try {
        return new URL(value, window.location.href).href;
      } catch (error) {
        return value;
      }
    }

    return value;
  }

  function readCssVariable(name, fallback) {
    var value = window.getComputedStyle(document.documentElement).getPropertyValue(name);
    if (!value) {
      return fallback;
    }

    var normalized = value.trim();
    return normalized || fallback;
  }

  function buildThemeUrl(theme) {
    var normalized = normalizeTheme(theme);
    if (!normalized) {
      return normalized;
    }

    if (normalized.indexOf("giscus-duckquill-") === -1) {
      return normalized;
    }

    var accent = readCssVariable("--accent-color", "#ff7800");
    var fg = readCssVariable("--fg-color", "#1f2328");
    var muted = readCssVariable("--fg-muted-5", "#656d76");
    var subtle = readCssVariable("--fg-muted-4", "#6e7781");
    var bg = readCssVariable("--bg-color", "#ffffff");
    var surface = readCssVariable("--glass-bg", bg);
    var border = readCssVariable("--fg-muted-2", "rgb(0 0 0 / 0.16)");
    var accentSoft = readCssVariable("--accent-color-alpha", "rgb(84 174 255 / 40%)");

    var css = [
      "@import url(\"" + normalized + "\");",
      "main{",
      "--color-accent-fg:" + accent + ";",
      "--color-accent-emphasis:" + accent + ";",
      "--color-btn-primary-bg:" + accent + ";",
      "--color-btn-primary-hover-bg:" + accent + ";",
      "--color-btn-primary-selected-bg:" + accent + ";",
      "--color-fg-default:" + fg + ";",
      "--color-fg-muted:" + muted + ";",
      "--color-fg-subtle:" + subtle + ";",
      "--color-canvas-default:" + bg + ";",
      "--color-canvas-overlay:" + bg + ";",
      "--color-canvas-subtle:" + surface + ";",
      "--color-canvas-inset:" + surface + ";",
      "--color-border-default:" + border + ";",
      "--color-border-muted:" + border + ";",
      "--color-accent-muted:" + accentSoft + ";",
      "--color-accent-subtle:" + accentSoft + ";",
      "}"
    ].join("");

    return "data:text/css;charset=utf-8," + encodeURIComponent(css);
  }

  function getMetaContent(property, useOg) {
    var ogSelector = useOg ? "meta[property='og:" + property + "']," : "";
    var selector = ogSelector + "meta[name='" + property + "']";
    var element = document.querySelector(selector);
    return element ? element.content : "";
  }

  var url = new URL(window.location.href);
  var session = url.searchParams.get("giscus") || "";
  var savedSession = localStorage.getItem(GISCUS_SESSION_KEY);
  url.searchParams.delete("giscus");
  url.hash = "";
  var cleanedLocation = url.toString();

  if (session) {
    localStorage.setItem(GISCUS_SESSION_KEY, JSON.stringify(session));
    history.replaceState(undefined, document.title, cleanedLocation);
  } else if (savedSession) {
    try {
      session = JSON.parse(savedSession);
    } catch (error) {
      localStorage.removeItem(GISCUS_SESSION_KEY);
      console.warn(formatError(error && error.message) + " Session has been cleared.");
    }
  }

  var params = {};
  params.origin = cleanedLocation;
  params.session = session;
  params.theme = buildThemeUrl(attributes.theme);
  params.reactionsEnabled = attributes.reactionsEnabled || "1";
  params.emitMetadata = attributes.emitMetadata || "0";
  params.inputPosition = attributes.inputPosition || "bottom";
  params.repo = attributes.repo;
  params.repoId = attributes.repoId;
  params.category = attributes.category || "";
  params.categoryId = attributes.categoryId;
  params.strict = attributes.strict || "0";
  params.description = getMetaContent("description", true);
  params.backLink = getMetaContent("giscus:backlink", false) || cleanedLocation;

  switch (attributes.mapping) {
    case "url":
      params.term = cleanedLocation;
      break;
    case "title":
      params.term = document.title;
      break;
    case "og:title":
      params.term = getMetaContent("title", true);
      break;
    case "specific":
      params.term = attributes.term;
      break;
    case "number":
      params.number = attributes.term;
      break;
    case "pathname":
    default:
      params.term = window.location.pathname.length < 2
        ? "index"
        : window.location.pathname.substring(1).replace(/\.\w+$/, "");
      break;
  }

  var existingContainer = document.querySelector(".giscus");
  var id = existingContainer && existingContainer.id;
  if (id) {
    params.origin = cleanedLocation + "#" + id;
  }

  var locale = attributes.lang ? "/" + attributes.lang : "";
  var src = giscusOrigin + locale + "/widget?" + new URLSearchParams(params).toString();
  var loading = attributes.loading === "lazy" ? "lazy" : undefined;

  var iframeElement = document.createElement("iframe");
  var iframeAttributes = {
    class: "giscus-frame giscus-frame--loading",
    title: "Comments",
    scrolling: "no",
    src: src,
    loading: loading
  };

  Object.entries(iframeAttributes).forEach(function (entry) {
    var key = entry[0];
    var value = entry[1];
    if (value) {
      iframeElement.setAttribute(key, value);
    }
  });

  iframeElement.style.opacity = "0";
  iframeElement.addEventListener("load", function () {
    iframeElement.style.removeProperty("opacity");
    iframeElement.classList.remove("giscus-frame--loading");
  });

  var style = document.getElementById("giscus-css") || document.createElement("link");
  style.id = "giscus-css";
  style.rel = "stylesheet";
  style.href = giscusOrigin + "/default.css";
  document.head.prepend(style);

  if (!existingContainer) {
    var iframeContainer = document.createElement("div");
    iframeContainer.setAttribute("class", "giscus");
    iframeContainer.appendChild(iframeElement);
    script.insertAdjacentElement("afterend", iframeContainer);
  } else {
    while (existingContainer.firstChild) {
      existingContainer.firstChild.remove();
    }
    existingContainer.appendChild(iframeElement);
  }

  var suggestion = "Please consider reporting this error at https://github.com/giscus/giscus/issues/new.";

  function signOut() {
    delete params.session;
    iframeElement.src = giscusOrigin + locale + "/widget?" + new URLSearchParams(params).toString();
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== giscusOrigin) {
      return;
    }

    var data = event.data;
    if (!(typeof data === "object" && data && data.giscus)) {
      return;
    }

    if (data.giscus.resizeHeight) {
      iframeElement.style.height = data.giscus.resizeHeight + "px";
    }

    if (data.giscus.signOut) {
      localStorage.removeItem(GISCUS_SESSION_KEY);
      console.log("[giscus] User has logged out. Session has been cleared.");
      signOut();
      return;
    }

    if (!data.giscus.error) {
      return;
    }

    var message = data.giscus.error;
    if (
      message.indexOf("Bad credentials") !== -1 ||
      message.indexOf("Invalid state value") !== -1 ||
      message.indexOf("State has expired") !== -1
    ) {
      if (localStorage.getItem(GISCUS_SESSION_KEY) !== null) {
        localStorage.removeItem(GISCUS_SESSION_KEY);
        console.warn(formatError(message) + " Session has been cleared.");
        signOut();
      } else if (!savedSession) {
        console.error(formatError(message) + " No session is stored initially. " + suggestion);
      }
      return;
    }

    if (message.indexOf("Discussion not found") !== -1) {
      console.warn("[giscus] " + message + ". A new discussion will be created if a comment/reaction is submitted.");
      return;
    }

    if (message.indexOf("API rate limit exceeded") !== -1) {
      console.warn(formatError(message));
      return;
    }

    console.error(formatError(message) + " " + suggestion);
  });
})();
