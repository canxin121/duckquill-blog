(function () {
  const MERMAID_SELECTOR = "div.mermaid";
  const THEME_SWITCHER_SELECTOR = "#theme-switcher button";
  const codeBlocks = document.querySelectorAll("pre code.language-mermaid");

  codeBlocks.forEach((codeBlock) => {
    const source = codeBlock.textContent ? codeBlock.textContent.trim() : "";
    if (!source) {
      return;
    }

    const pre = codeBlock.parentElement;
    if (!pre) {
      return;
    }

    const mermaidBlock = document.createElement("div");
    mermaidBlock.className = "mermaid";
    mermaidBlock.setAttribute("data-mermaid-source", source);
    mermaidBlock.textContent = source;
    pre.replaceWith(mermaidBlock);
  });

  const mermaidNodes = document.querySelectorAll(MERMAID_SELECTOR);
  if (mermaidNodes.length === 0) {
    return;
  }

  mermaidNodes.forEach((node) => {
    if (node.getAttribute("data-mermaid-source")) {
      return;
    }

    const source = node.textContent ? node.textContent.trim() : "";
    if (!source) {
      return;
    }

    node.setAttribute("data-mermaid-source", source);
  });

  const darkMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  let currentTheme = "default";
  let mermaidModulePromise;

  function resolveTheme() {
    const forcedTheme = document.documentElement.getAttribute("data-theme");
    const prefersDark = darkMediaQuery.matches;
    return forcedTheme === "dark" || (!forcedTheme && prefersDark) ? "dark" : "default";
  }

  function loadMermaid() {
    if (!mermaidModulePromise) {
      mermaidModulePromise = import("https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs");
    }

    return mermaidModulePromise;
  }

  function restoreSourceBeforeRender() {
    document.querySelectorAll(MERMAID_SELECTOR).forEach((node) => {
      const source = node.getAttribute("data-mermaid-source");
      if (!source) {
        return;
      }

      node.removeAttribute("data-processed");
      node.innerHTML = "";
      node.textContent = source;
    });
  }

  function renderMermaid() {
    currentTheme = resolveTheme();

    loadMermaid()
      .then(({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          theme: currentTheme,
          securityLevel: "loose"
        });

        restoreSourceBeforeRender();

        mermaid.run({
          querySelector: MERMAID_SELECTOR
        });
      })
      .catch((error) => {
        console.error("Unable to initialize Mermaid diagrams.", error);
      });
  }

  function rerenderIfThemeChanged() {
    if (resolveTheme() === currentTheme) {
      return;
    }

    renderMermaid();
  }

  renderMermaid();

  document.querySelectorAll(THEME_SWITCHER_SELECTOR).forEach((button) => {
    button.addEventListener("click", () => {
      window.setTimeout(rerenderIfThemeChanged, 50);
    });
  });

  darkMediaQuery.addEventListener("change", () => {
    if (!document.documentElement.getAttribute("data-theme")) {
      rerenderIfThemeChanged();
    }
  });
})();
