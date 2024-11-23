chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url?.startsWith("https://debank.com/bundles/")
  ) {
    chrome.tabs.sendMessage(tabId, { type: "CAPTURE_VALUE" });
  }
});

// Function to refresh tabs
function refreshTabs() {
  chrome.storage.sync.get(["autoRefresh"], function (result) {
    if (result.autoRefresh) {
      chrome.tabs.query(
        { url: "https://debank.com/bundles/*" },
        function (tabs) {
          tabs.forEach((tab) => {
            chrome.tabs.reload(tab.id);
          });
        }
      );
    }
  });
}

// Set interval to refresh tabs every 30 minutes
setInterval(refreshTabs, 30 * 60 * 1000);

// Initial call to refresh tabs in case the extension is loaded and autoRefresh is enabled
refreshTabs();
