(function () {
  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback);
      return;
    }
    callback();
  }

  function setLinkLabel(link, label) {
    if (!link || !label) {
      return;
    }

    var icon = link.querySelector("i.icon");
    if (!icon) {
      link.textContent = label;
      return;
    }

    var nodes = Array.prototype.slice.call(link.childNodes);
    nodes.forEach(function (node) {
      if (node !== icon) {
        link.removeChild(node);
      }
    });

    link.appendChild(document.createTextNode(label));
  }

  function hrefPath(link) {
    try {
      return new URL(link.getAttribute("href"), window.location.origin).pathname;
    } catch (_error) {
      return "";
    }
  }

  function patchNavLabels() {
    var lang = (document.documentElement.getAttribute("lang") || "").toLowerCase();
    var isEnglish = lang === "en" || lang.indexOf("en-") === 0;

    var homeLink = document.querySelector("#home > a");
    setLinkLabel(homeLink, isEnglish ? "About" : "关于");

    var navLinks = document.querySelectorAll("#site-nav nav > ul > li > a[href]");
    navLinks.forEach(function (link) {
      var path = hrefPath(link).replace(/\/+$/, "/");
      if (path === "/friends/" || path === "/en/friends/") {
        setLinkLabel(link, isEnglish ? "Friends" : "友链");
      }
    });
  }

  onReady(patchNavLabels);
})();
