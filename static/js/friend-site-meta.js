(function () {
  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback);
      return;
    }
    callback();
  }

  function currentOrigin() {
    if (window.location.origin && window.location.origin !== "null") {
      return window.location.origin.replace(/\/+$/, "");
    }
    return (window.location.protocol + "//" + window.location.host).replace(/\/+$/, "");
  }

  function fillOriginTemplates() {
    var origin = currentOrigin();
    var nodes = document.querySelectorAll("[data-origin-template]");

    nodes.forEach(function (node) {
      var template = node.getAttribute("data-origin-template") || "";
      node.textContent = template.replace(/\{origin\}/g, origin);
    });
  }

  function fallbackCopy(text) {
    var textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    var copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }

    return new Promise(function (resolve, reject) {
      try {
        if (fallbackCopy(text)) {
          resolve();
          return;
        }
      } catch (error) {
        reject(error);
        return;
      }

      reject(new Error("copy failed"));
    });
  }

  function bindCopyButtons() {
    var buttons = document.querySelectorAll(".friend-copy-btn");

    buttons.forEach(function (button) {
      var idle = button.getAttribute("data-copy-idle") || button.getAttribute("aria-label") || "Copy";
      var done = button.getAttribute("data-copy-done") || "Copied";
      var fail = button.getAttribute("data-copy-fail") || "Copy failed";

      function setButtonLabel(label) {
        button.setAttribute("aria-label", label);
        button.setAttribute("title", label);
      }

      function resetState() {
        button.classList.remove("is-done", "is-fail");
        setButtonLabel(idle);
      }

      resetState();

      button.addEventListener("click", function () {
        var targetId = button.getAttribute("data-copy-target");
        if (!targetId) {
          return;
        }

        var target = document.getElementById(targetId);
        if (!target) {
          return;
        }

        var text = (target.textContent || "").trim();
        if (!text) {
          return;
        }

        copyText(text)
          .then(function () {
            button.classList.remove("is-fail");
            button.classList.add("is-done");
            setButtonLabel(done);
          })
          .catch(function () {
            button.classList.remove("is-done");
            button.classList.add("is-fail");
            setButtonLabel(fail);
          })
          .finally(function () {
            window.setTimeout(function () {
              resetState();
            }, 1200);
          });
      });
    });
  }

  function bindCopyAllButtons() {
    var buttons = document.querySelectorAll("[data-friend-copy-all]");

    buttons.forEach(function (button) {
      var idle = button.getAttribute("data-copy-idle") || button.getAttribute("aria-label") || "Copy all";
      var done = button.getAttribute("data-copy-done") || "Copied all";
      var fail = button.getAttribute("data-copy-fail") || "Copy failed";

      function setButtonLabel(label) {
        button.setAttribute("aria-label", label);
        button.setAttribute("title", label);
      }

      function resetState() {
        button.classList.remove("is-done", "is-fail");
        setButtonLabel(idle);
      }

      resetState();

      button.addEventListener("click", function () {
        var modal = button.closest(".friend-meta-modal");
        if (!modal) {
          return;
        }

        var rows = modal.querySelectorAll(".friend-site-meta-list li");
        if (!rows.length) {
          return;
        }

        var lines = [];
        rows.forEach(function (row) {
          var labelNode = row.querySelector("strong");
          var valueNode = row.querySelector(".friend-meta-value");
          var label = labelNode ? (labelNode.textContent || "").trim() : "";
          var value = valueNode ? (valueNode.textContent || "").trim() : "";

          if (label && value) {
            lines.push(label + ": " + value);
          }
        });

        if (!lines.length) {
          return;
        }

        copyText(lines.join("\n"))
          .then(function () {
            button.classList.remove("is-fail");
            button.classList.add("is-done");
            setButtonLabel(done);
          })
          .catch(function () {
            button.classList.remove("is-done");
            button.classList.add("is-fail");
            setButtonLabel(fail);
          })
          .finally(function () {
            window.setTimeout(function () {
              resetState();
            }, 1200);
          });
      });
    });
  }

  function bindMetaModal() {
    var openButton = document.querySelector("[data-friend-meta-open]");
    var modal = document.querySelector("[data-friend-meta-modal]");

    if (!openButton || !modal) {
      return;
    }

    var closeButton = modal.querySelector("[data-friend-meta-close]");
    var hideTimer = null;

    function isOpen() {
      return !modal.hidden;
    }

    function openModal() {
      if (isOpen()) {
        return;
      }

      if (hideTimer) {
        window.clearTimeout(hideTimer);
      }

      modal.hidden = false;

      window.requestAnimationFrame(function () {
        modal.classList.add("is-open");
      });
    }

    function closeModal() {
      if (!isOpen()) {
        return;
      }

      modal.classList.remove("is-open");

      hideTimer = window.setTimeout(function () {
        modal.hidden = true;
      }, 160);
    }

    openButton.addEventListener("click", function () {
      if (isOpen()) {
        closeModal();
        return;
      }

      openModal();
    });

    if (closeButton) {
      closeButton.addEventListener("click", closeModal);
    }

    document.addEventListener("pointerdown", function (event) {
      if (!isOpen()) {
        return;
      }

      var target = event.target;
      if (modal.contains(target) || openButton.contains(target)) {
        return;
      }

      closeModal();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && isOpen()) {
        closeModal();
      }
    });
  }

  onReady(function () {
    fillOriginTemplates();
    bindCopyButtons();
    bindCopyAllButtons();
    bindMetaModal();
  });
})();
