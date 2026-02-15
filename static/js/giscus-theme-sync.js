(function () {
  function normalizeTheme(theme) {
    if (!theme) {
      return theme;
    }

    var value = theme.trim();
    if (!value) {
      return value;
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

  function currentTheme(lightTheme, darkTheme) {
    var forcedTheme = document.documentElement.getAttribute("data-theme");
    if (forcedTheme === "dark") {
      return buildThemeUrl(darkTheme);
    }

    if (forcedTheme === "light") {
      return buildThemeUrl(lightTheme);
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? buildThemeUrl(darkTheme)
      : buildThemeUrl(lightTheme);
  }

  function resolveGiscusTarget() {
    var frame = document.querySelector("iframe.giscus-frame");
    if (!frame || !frame.contentWindow) {
      return null;
    }

    // Giscus keeps this class until the widget frame has loaded.
    if (frame.classList.contains("giscus-frame--loading")) {
      return null;
    }

    var src = frame.getAttribute("src") || "";
    if (!src) {
      return null;
    }

    try {
      var parsed = new URL(src, window.location.href);
      if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || parsed.pathname.indexOf("/widget") === -1) {
        return null;
      }

      return {
        frame: frame,
        origin: parsed.origin
      };
    } catch (error) {
      return null;
    }
  }

  function postTheme(lightTheme, darkTheme) {
    var target = resolveGiscusTarget();
    if (!target) {
      return false;
    }

    try {
      target.frame.contentWindow.postMessage(
        {
          giscus: {
            setConfig: {
              theme: currentTheme(lightTheme, darkTheme)
            }
          }
        },
        target.origin
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  function syncGiscusTheme() {
    var comments = document.querySelector("#comments.giscus-comments");
    if (!comments) {
      return;
    }

    var lightTheme = comments.getAttribute("data-giscus-theme-light") || "light";
    var darkTheme = comments.getAttribute("data-giscus-theme-dark") || "dark";

    postTheme(lightTheme, darkTheme);

    var observer = new MutationObserver(function () {
      postTheme(lightTheme, darkTheme);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
      if (!document.documentElement.getAttribute("data-theme")) {
        postTheme(lightTheme, darkTheme);
      }
    });

    var checkFrame = window.setInterval(function () {
      if (!postTheme(lightTheme, darkTheme)) {
        return;
      }
      window.clearInterval(checkFrame);
    }, 250);

    window.setTimeout(function () {
      window.clearInterval(checkFrame);
    }, 12000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncGiscusTheme);
    return;
  }

  syncGiscusTheme();
})();
