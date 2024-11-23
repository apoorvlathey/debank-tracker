chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url?.startsWith("https://debank.com/bundles/")
  ) {
    chrome.tabs.sendMessage(tabId, { type: "CAPTURE_VALUE" });
  }
});
