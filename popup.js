document.addEventListener("DOMContentLoaded", function () {
  const switchInput = document.querySelector(".switch input");

  // Load the saved state from Chrome storage
  chrome.storage.sync.get(["autoRefresh"], function (result) {
    switchInput.checked = result.autoRefresh || false;
  });

  // Save the state to Chrome storage when the switch is toggled
  switchInput.addEventListener("change", function () {
    chrome.storage.sync.set({ autoRefresh: switchInput.checked });
  });
});
