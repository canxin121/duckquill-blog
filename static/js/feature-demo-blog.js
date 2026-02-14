(function () {
  const colorInput = document.getElementById("accent-color");
  const rangeInput = document.getElementById("demo-range");
  const panel = document.getElementById("demo-live-panel");
  const accentPreview = document.getElementById("accent-preview");
  const densityPreview = document.getElementById("density-preview");
  const densityProgress = document.getElementById("density-progress");

  function updateAccent() {
    if (!colorInput || !panel || !accentPreview) {
      return;
    }

    const value = colorInput.value;
    panel.style.setProperty("--demo-accent", value);
    accentPreview.textContent = "当前强调色：" + value;
  }

  function updateDensity() {
    if (!rangeInput || !densityPreview || !densityProgress) {
      return;
    }

    const value = Number.parseInt(rangeInput.value, 10) || 0;
    densityPreview.textContent = "内容密度：" + value + "%";
    densityProgress.value = value;
  }

  updateAccent();
  updateDensity();

  if (colorInput) {
    colorInput.addEventListener("input", updateAccent);
  }

  if (rangeInput) {
    rangeInput.addEventListener("input", updateDensity);
  }
})();
