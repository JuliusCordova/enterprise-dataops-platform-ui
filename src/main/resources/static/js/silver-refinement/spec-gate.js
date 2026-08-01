(() => {
  "use strict";

  const saveButton = document.getElementById("sw-save-contract");
  const nextButton = document.getElementById("sw-next");
  const specInput = document.getElementById("sw-spec-id");
  const message = document.getElementById("silver-wizard-message");

  function mappingStepVisible() {
    const panel = document.querySelector('[data-panel="3"]');
    return panel && !panel.hidden;
  }

  function showBlockedMessage() {
    message.hidden = false;
    message.className = "message dq-message message-warning";
    message.textContent =
      "No se puede guardar aún el contrato Silver: el backend no expone el endpoint para persistir y versionar el mapping. Por seguridad, el flujo no avanzará a artefactos hasta recibir un Spec ID real.";
    message.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  if (saveButton) {
    saveButton.addEventListener("click", showBlockedMessage);
  }

  if (nextButton) {
    nextButton.addEventListener(
      "click",
      event => {
        if (mappingStepVisible() && !specInput.value.trim()) {
          event.preventDefault();
          event.stopImmediatePropagation();
          showBlockedMessage();
        }
      },
      true
    );
  }
})();
