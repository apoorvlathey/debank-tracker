// content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "CAPTURE_VALUE") {
    let valueHistory = [];
    const HISTORY_SIZE = 20; // Keep more historical values
    const STABLE_DURATION = 5000; // Wait longer (5 seconds) for stability
    const CHECK_INTERVAL = 200; // Check more frequently
    let lastChangeTime = Date.now();
    let hasLogged = false;
    let highestValue = 0; // Track highest value seen

    const parseValue = (str) => {
      return parseFloat(str.replace("$", "").replace(/,/g, ""));
    };

    const isValueIncreasing = (history) => {
      if (history.length < 2) return false;
      return (
        parseValue(history[history.length - 1]) >
        parseValue(history[history.length - 2])
      );
    };

    const captureValue = () => {
      const valueElement = document.querySelector(
        ".HeaderInfo_bundleAsset__KSevh"
      );
      if (valueElement && valueElement.innerHTML.includes("$")) {
        const currentValue = valueElement.innerHTML;
        const currentNumericValue = parseValue(currentValue);
        const currentTime = Date.now();

        // Update highest value seen
        if (currentNumericValue > highestValue) {
          highestValue = currentNumericValue;
          lastChangeTime = currentTime;
          console.log("New highest value:", currentValue);
        }

        // Add to history and maintain history size
        valueHistory.push(currentValue);
        if (valueHistory.length > HISTORY_SIZE) {
          valueHistory.shift();
        }

        // If value is still increasing, update lastChangeTime
        if (isValueIncreasing(valueHistory)) {
          lastChangeTime = currentTime;
          return false;
        }

        // Check if value has been stable for STABLE_DURATION and is not increasing
        const isStable = currentTime - lastChangeTime > STABLE_DURATION;
        const isDoneIncreasing = !isValueIncreasing(valueHistory);
        const isAtHighest = currentNumericValue >= highestValue * 0.999; // Allow 0.1% variance

        if (isStable && isDoneIncreasing && isAtHighest && !hasLogged) {
          const bundleId = window.location.pathname.split("/")[2];
          const timestamp = new Date().toISOString();

          console.log("Capturing final value:", currentValue);
          console.log("Value history:", valueHistory);
          console.log("Time since last change:", currentTime - lastChangeTime);
          console.log("Is at highest:", isAtHighest);
          console.log("Highest seen:", highestValue);

          chrome.storage.local.get(["portfolioHistory"], (result) => {
            const history = result.portfolioHistory || {};
            if (!history[bundleId]) {
              history[bundleId] = [];
            }
            history[bundleId].push({
              timestamp,
              value: currentNumericValue,
            });
            chrome.storage.local.set({ portfolioHistory: history });
          });

          hasLogged = true;
          return true;
        }
      }
      return false;
    };

    // Set up a MutationObserver to watch for DOM changes
    const observer = new MutationObserver(() => {
      if (captureValue()) {
        observer.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      characterDataOldValue: true,
    });

    // Check periodically
    const intervalId = setInterval(() => {
      if (captureValue()) {
        clearInterval(intervalId);
      }
    }, CHECK_INTERVAL);

    // Stop checking after 30 seconds to prevent infinite running
    setTimeout(() => {
      if (!hasLogged && valueHistory.length > 0) {
        // If we haven't logged yet, log the highest value we've seen
        console.log("Timeout reached - logging highest value");
        captureValue();
      }
      observer.disconnect();
      clearInterval(intervalId);
    }, 30000);
  }
});
