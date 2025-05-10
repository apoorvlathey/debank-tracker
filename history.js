// Global Variables
let chart = null;
let currentData = {};
let isDraggingYAxis = false;
let dragStartY = 0;
let initialZoom = null;
let initialBounds = null;
let lastUpdatedInterval = null;

// Helper Functions
// Aggregate data based on time scale
function aggregateData(data, timeScale) {
  const aggregated = new Map();

  data.forEach((item) => {
    const date = new Date(item.timestamp);
    let key;

    switch (timeScale) {
      case "minute":
        key = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          date.getHours(),
          date.getMinutes()
        ).getTime();
        break;
      case "hour":
        key = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          date.getHours()
        ).getTime();
        break;
      case "day":
        key = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate()
        ).getTime();
        break;
      case "month":
        key = new Date(date.getFullYear(), date.getMonth()).getTime();
        break;
      case "year":
        key = new Date(date.getFullYear()).getTime();
        break;
    }

    if (!aggregated.has(key)) {
      aggregated.set(key, []);
    }
    aggregated.get(key).push(item.value);
  });

  // Convert to array and calculate averages
  return Array.from(aggregated)
    .map(([timestamp, values]) => ({
      timestamp,
      value: values.reduce((a, b) => a + b) / values.length,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function formatDate(timestamp, timeScale) {
  const date = new Date(timestamp);
  switch (timeScale) {
    case "minute":
      return date.toLocaleString();
    case "hour":
      return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
      });
    case "day":
      return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
      });
    case "month":
      return date.toLocaleString(undefined, {
        month: "short",
        year: "numeric",
      });
    case "year":
      return date.getFullYear().toString();
  }
}

function formatTimeElapsed(startTimestamp, endTimestamp) {
  const elapsedMs = endTimestamp - startTimestamp;
  const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  const elapsedDays = Math.floor(elapsedHours / 24);

  if (elapsedDays > 0) {
    return `${elapsedDays} day${elapsedDays > 1 ? "s" : ""}`;
  } else if (elapsedHours > 0) {
    return `${elapsedHours} hour${elapsedHours > 1 ? "s" : ""}`;
  } else {
    return `${elapsedMinutes} minute${elapsedMinutes > 1 ? "s" : ""}`;
  }
}

function calculateChanges(data) {
  if (!data || data.length === 0) {
    return {
      dollarChange: 0,
      percentChange: 0,
      currentValue: 0,
      timeElapsed: 0,
    };
  }

  const currentValue = data[data.length - 1].value;
  const initialValue = data[0].value;
  const dollarChange = data.length > 1 ? currentValue - initialValue : 0;
  const percentChange =
    data.length > 1 ? ((currentValue - initialValue) / initialValue) * 100 : 0;
  const timeElapsed =
    data.length > 1
      ? formatTimeElapsed(data[0].timestamp, data[data.length - 1].timestamp)
      : 0;

  return {
    dollarChange,
    percentChange,
    currentValue,
    timeElapsed,
  };
}

function formatCurrency(value) {
  const prefix = value >= 0 ? "$" : "-$";
  return `${prefix}${Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPercentage(value) {
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

function getChangeClass(value) {
  if (value > 0) return "positive-change";
  if (value < 0) return "negative-change";
  return "no-change";
}

// Chart Functions
function createChart(data, timeScale) {
  const ctx = document.getElementById("valueChart").getContext("2d");
  const canvas = document.getElementById("valueChart");
  const aggregatedData = aggregateData(data, timeScale);

  // Update stats once when creating chart
  updateStats(aggregatedData);

  if (chart) {
    chart.destroy();
  }

  // Calculate initial bounds with padding
  const values = aggregatedData.map((item) => item.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue;
  const paddingFactor = 0.05;

  // Handle edge case where all values are the same
  let yMin, yMax;
  if (valueRange === 0) {
    // If all values are the same, create artificial range
    const baseValue = minValue;
    const artificialRange = Math.abs(baseValue) * 0.1 || 1; // Use 10% of the value or 1 if value is 0
    yMin = baseValue - artificialRange;
    yMax = baseValue + artificialRange;
  } else {
    yMin = minValue - valueRange * paddingFactor;
    yMax = maxValue + valueRange * paddingFactor;
  }

  // Store the initial bounds globally
  initialBounds = {
    min: Math.floor(yMin),
    max: Math.ceil(yMax),
  };

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: aggregatedData.map((item) =>
        formatDate(item.timestamp, timeScale)
      ),
      datasets: [
        {
          label: "Portfolio Value ($)",
          data: aggregatedData.map((item) => item.value),
          borderColor: "#4CAF50",
          tension: 0.1,
          pointRadius: aggregatedData.length <= 2 ? 5 : 0, // Show points when there are 2 or fewer data points
          pointHitRadius: 10,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      interaction: {
        intersect: false,
        mode: "index",
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
            color: "#a0a0a0",
          },
        },
        y: {
          beginAtZero: false,
          min: initialBounds.min, // Use min instead of suggestedMin for more control
          max: initialBounds.max, // Use max instead of suggestedMax for more control
          ticks: {
            callback: (value) => "$" + Math.round(value).toLocaleString(),
            color: "#a0a0a0",
          },
          grid: {
            color: "rgba(255, 255, 255, 0.05)",
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: "rgba(20, 20, 20, 0.95)",
          padding: {
            top: 12,
            right: 16,
            bottom: 12,
            left: 16,
          },
          cornerRadius: 8,
          bodySpacing: 8,
          displayColors: false,
          titleFont: {
            size: 13,
            weight: "500",
            family:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          },
          bodyFont: {
            size: 14,
            weight: "600",
            family:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          },
          borderColor: "rgba(255, 255, 255, 0.1)",
          borderWidth: 1,
          callbacks: {
            title: (tooltipItems) => {
              return formatDate(
                aggregatedData[tooltipItems[0].dataIndex].timestamp,
                timeScale
              );
            },
            label: (context) => {
              const currentValue = context.parsed.y;
              const startValue = context.dataset.data[0];
              const dollarChange = currentValue - startValue;
              const percentChange =
                ((currentValue - startValue) / startValue) * 100;

              const timeElapsed = formatTimeElapsed(
                aggregatedData[0].timestamp,
                aggregatedData[context.dataIndex].timestamp
              );

              return [
                "Value: " + formatCurrency(currentValue),
                "Change: " +
                  formatCurrency(dollarChange) +
                  " (" +
                  formatPercentage(percentChange) +
                  ")",
                "Time: " + timeElapsed,
              ];
            },
            labelTextColor: (tooltipItem) => {
              if (tooltipItem.dataIndex === 0) {
                return "#FFFFFF";
              }
              const currentValue = tooltipItem.parsed.y;
              const startValue = tooltipItem.dataset.data[0];
              const dollarChange = currentValue - startValue;
              return dollarChange >= 0 ? "#4CAF50" : "#FF4444";
            },
            afterLabel: (context) => "",
          },
          titleMarginBottom: 10,
          caretSize: 8,
          caretPadding: 12,
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        },
        zoom: {
          pan: {
            enabled: true,
            mode: "x",
            modifierKey: null,
          },
          zoom: {
            wheel: {
              enabled: true,
              modifierKey: "ctrl",
            },
            pinch: {
              enabled: true,
            },
            mode: "xy",
          },
          limits: {
            x: {
              min: "original",
              max: "original",
              minRange: 1000 * 60 * 60 * 24, // Minimum 1 day range
            },
            y: {
              min: "original",
              max: "original",
            },
          },
        },
      },
      animation: {
        duration: 0,
      },
      hover: {
        mode: "index",
        intersect: false,
      },
      elements: {
        line: {
          tension: 0.1,
        },
      },
    },
  });

  // Track mouse position and update cursor
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const chartArea = chart.chartArea;

    // Change cursor style when over the y-axis area
    if (x <= chartArea.left) {
      canvas.style.cursor = "ns-resize";
    } else {
      canvas.style.cursor = "default";
    }

    if (isDraggingYAxis && initialZoom) {
      const deltaY = e.clientY - dragStartY;
      const zoomFactor = 1 + deltaY / 200;

      const newRange = initialZoom.range * zoomFactor;
      const centerValue = (initialZoom.max + initialZoom.min) / 2;

      chart.scales.y.options.min = Math.floor(centerValue - newRange / 2);
      chart.scales.y.options.max = Math.ceil(centerValue + newRange / 2);
      chart.update("none");
    }
  });

  canvas.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const chartArea = chart.chartArea;

    if (x <= chartArea.left) {
      isDraggingYAxis = true;
      dragStartY = e.clientY;
      initialZoom = {
        min: chart.scales.y.min,
        max: chart.scales.y.max,
        range: chart.scales.y.max - chart.scales.y.min,
      };
    }
  });

  window.addEventListener("mouseup", () => {
    isDraggingYAxis = false;
    initialZoom = null;
    canvas.style.cursor = "default";
  });

  canvas.addEventListener("mouseleave", () => {
    canvas.style.cursor = "default";
  });
}

// Update Functions
function updateStats(data) {
  const stats = calculateChanges(data);

  document.getElementById("currentValue").textContent = formatCurrency(
    stats.currentValue
  );

  const dollarChangeEl = document.getElementById("dollarChange");
  dollarChangeEl.innerHTML = `${formatCurrency(stats.dollarChange)}`;
  if (stats.timeElapsed.toString() !== "0") {
    dollarChangeEl.innerHTML += ` <span class="time-elapsed">[${stats.timeElapsed}]</span>`;
  }
  dollarChangeEl.className = "stat-value " + getChangeClass(stats.dollarChange);

  const percentChangeEl = document.getElementById("percentChange");
  percentChangeEl.innerHTML = `${formatPercentage(stats.percentChange)}`;
  if (stats.timeElapsed.toString() !== "0") {
    percentChangeEl.innerHTML += ` <span class="time-elapsed">[${stats.timeElapsed}]</span>`;
  }
  percentChangeEl.className =
    "stat-value " + getChangeClass(stats.percentChange);
}

function updateLastUpdatedTime(data) {
  if (!data || data.length === 0) {
    document.getElementById("lastUpdated").textContent =
      "Last updated: No data yet";
    return;
  }

  const latestTimestamp = new Date(data[data.length - 1].timestamp).getTime(); // Parse timestamp string to Date object
  const now = Date.now();
  const timeElapsed = formatTimeElapsed(latestTimestamp, now);

  document.getElementById(
    "lastUpdated"
  ).textContent = `Last updated: ${timeElapsed} ago`;
}

// Function to start the auto-update interval
function startLastUpdatedInterval() {
  // Clear any existing interval first
  if (lastUpdatedInterval) {
    clearInterval(lastUpdatedInterval);
  }

  // Set up new interval
  lastUpdatedInterval = setInterval(() => {
    const bundleId = document.getElementById("bundleSelect").value;
    const data = currentData[bundleId];
    updateLastUpdatedTime(data);
  }, 29000); // Update 29 secs (29000 milliseconds)
}

function updateLastUpdatedLink(bundleId) {
  const linkElement = document.getElementById("lastUpdatedLink");
  linkElement.href = `https://debank.com/bundles/${bundleId}/accounts`;
}

function updateStatsForVisibleRange() {
  if (!chart) return;

  const { min: start, max: end } = chart.scales.x;
  const bundleId = document.getElementById("bundleSelect").value;
  const data = currentData[bundleId];

  if (!data || data.length === 0) return;

  // Find the first visible data point
  let firstVisibleIndex = data.findIndex((item) => item.timestamp >= start);
  if (firstVisibleIndex === -1) firstVisibleIndex = 0;

  // Find the last visible data point
  let lastVisibleIndex = data.length - 1;
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i].timestamp <= end) {
      lastVisibleIndex = i;
      break;
    }
  }

  // Create a subset of data that includes the visible range
  const visibleData = [
    // Always include the first data point for correct change calculation
    data[0],
    // Include visible range
    ...data.slice(firstVisibleIndex, lastVisibleIndex + 1),
  ];

  updateStats(visibleData);
  updateLastUpdatedTime(data);
  updateLastUpdatedLink(bundleId);
}

function applyHideStatus(hideStatus) {
  const currentValueEl = document.getElementById("currentValue");
  const dollarChangeEl = document.getElementById("dollarChange");
  const percentChangeEl = document.getElementById("percentChange");
  const hideBtn = document.getElementById("hideBtn");
  const hideDollarBtn = document.getElementById("hideDollarBtn");
  const hidePercentBtn = document.getElementById("hidePercentBtn");

  // Update UI elements
  currentValueEl.style.filter = hideStatus ? "blur(20px)" : "none";
  dollarChangeEl.style.filter = hideStatus ? "blur(20px)" : "none";
  hideBtn.textContent = hideStatus ? "unhide" : "hide";

  // Show/hide the additional hide buttons
  hideDollarBtn.style.display = hideStatus ? "block" : "none";
  hidePercentBtn.style.display = hideStatus ? "block" : "none";

  // Update chart if it exists
  if (chart) {
    chart.options.scales.y.ticks.display = !hideStatus;
    chart.options.plugins.tooltip.enabled = !hideStatus;
    chart.update();
  }
}

function updateChart() {
  const bundleId = document.getElementById("bundleSelect").value;
  const timeScale = document.getElementById("timeScale").value;
  const data = currentData[bundleId];

  // Store the last selected bundle in local storage
  chrome.storage.local.set({ lastSelectedBundle: bundleId });

  if (data && data.length > 0) {
    createChart(data, timeScale);
    updateLastUpdatedTime(data);
    updateLastUpdatedLink(bundleId);
    startLastUpdatedInterval(); // Start the interval when chart is updated

    // Apply hide status if it exists
    chrome.storage.local.get(["hideStatus"], (result) => {
      const hideStatus = result.hideStatus || false;
      applyHideStatus(hideStatus);
    });

    // Update refresh count
    document.getElementById(
      "refreshCount"
    ).textContent = `Refreshed: ${data.length} times`;
  } else {
    // Reset stats if no data
    updateStats([]);
    document.getElementById("lastUpdated").textContent =
      "Last updated: No data yet";
    // Update refresh count
    document.getElementById("refreshCount").textContent = `Refreshed: 0 times`;
    if (chart) {
      chart.destroy();
      chart = null;
    }
    // Clear the interval if there's no data
    if (lastUpdatedInterval) {
      clearInterval(lastUpdatedInterval);
      lastUpdatedInterval = null;
    }
  }
}

function resetZoom() {
  if (chart && initialBounds) {
    // Reset the scales to their original state
    chart.resetZoom();

    // Reset to initial bounds for Y axis
    chart.scales.y.options.min = initialBounds.min;
    chart.scales.y.options.max = initialBounds.max;

    // Reset the pan and zoom state
    isDraggingYAxis = false;
    initialZoom = null;

    // Instead of using updateStatsForVisibleRange, use the original data
    const bundleId = document.getElementById("bundleSelect").value;
    const data = currentData[bundleId];
    if (data && data.length > 0) {
      // Use the aggregated data that matches current timeScale
      const timeScale = document.getElementById("timeScale").value;
      const aggregatedData = aggregateData(data, timeScale);
      updateStats(aggregatedData);
    }

    // Update the chart with animation disabled
    chart.update("none");
  }
}

function updateBundleSelect(portfolioHistory) {
  const bundleSelect = document.getElementById("bundleSelect");
  const timeScale = document.getElementById("timeScale");
  const downloadBtn = document.getElementById("downloadBtn");
  const resetZoom = document.getElementById("resetZoom");

  bundleSelect.innerHTML = "";
  currentData = portfolioHistory;

  const hasData = Object.keys(portfolioHistory).length > 0;

  if (hasData) {
    Object.keys(portfolioHistory).forEach((bundleId) => {
      const option = document.createElement("option");
      option.value = bundleId;
      option.textContent = `Bundle ${bundleId}`;
      bundleSelect.appendChild(option);
    });

    // Restore the last selected bundle if it exists
    chrome.storage.local.get(["lastSelectedBundle"], (result) => {
      if (
        result.lastSelectedBundle &&
        portfolioHistory[result.lastSelectedBundle]
      ) {
        bundleSelect.value = result.lastSelectedBundle;
      }
      updateChart();
    });

    // Update refresh count
    const bundleId = bundleSelect.value;
    document.getElementById(
      "refreshCount"
    ).textContent = `Refreshed: ${portfolioHistory[bundleId].length} times`;

    // Enable controls if we have data
    bundleSelect.disabled = false;
    timeScale.disabled = false;
    downloadBtn.disabled = false;
    resetZoom.disabled = false;
    updateLastUpdatedLink(bundleSelect.value);
  } else {
    // Disable controls if no data
    bundleSelect.disabled = true;
    timeScale.disabled = true;
    downloadBtn.disabled = true;
    resetZoom.disabled = true;

    // Clear chart if it exists
    if (chart) {
      chart.destroy();
      chart = null;
    }

    // Add a "No data" option to the bundle select
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No data available";
    bundleSelect.appendChild(option);

    document.getElementById("refreshCount").textContent = "Refreshed: 0 times";
  }
}

function downloadData() {
  const bundleId = document.getElementById("bundleSelect").value;
  const dataStr = JSON.stringify(currentData, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bundle-history-${bundleId}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function clearData() {
  // Clear the interval when data is cleared
  if (lastUpdatedInterval) {
    clearInterval(lastUpdatedInterval);
    lastUpdatedInterval = null;
  }

  const bundleId = document.getElementById("bundleSelect").value;
  chrome.storage.local.get(["portfolioHistory"], (result) => {
    const portfolioHistory = result.portfolioHistory || {};
    delete portfolioHistory[bundleId];
    chrome.storage.local.set({ portfolioHistory }, () => {
      currentData = portfolioHistory;
      updateBundleSelect(portfolioHistory);

      // Clear the existing chart
      if (chart) {
        chart.destroy();
        chart = null;
      }

      // Clear the chart canvas
      const ctx = document.getElementById("valueChart");
      ctx.getContext("2d").clearRect(0, 0, ctx.width, ctx.height);

      // reset stats
      updateStats([]);

      // Hide or disable controls since there's no data
      document.getElementById("timeScale").disabled = true;
      document.getElementById("downloadBtn").disabled = true;
      document.getElementById("bundleSelect").disabled = true;
      document.getElementById("resetZoom").disabled = true;

      // Close the modal
      document.getElementById("confirmModal").style.display = "none";
    });
  });
}

// Event Listeners
document.getElementById("bundleSelect").addEventListener("change", updateChart);
document.getElementById("timeScale").addEventListener("change", updateChart);
document.getElementById("downloadBtn").addEventListener("click", downloadData);
document.getElementById("clearBtn").addEventListener("click", () => {
  document.getElementById("confirmModal").style.display = "flex";
});

document.getElementById("resetZoom").addEventListener("click", resetZoom);

document
  .getElementById("downloadAndClearBtn")
  .addEventListener("click", async () => {
    const bundleId = document.getElementById("bundleSelect").value;
    const dataStr = JSON.stringify(currentData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    try {
      if (window.showSaveFilePicker) {
        // Modern approach
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: `bundle-history-${bundleId}.json`,
          types: [
            {
              description: "JSON File",
              accept: {
                "application/json": [".json"],
              },
            },
          ],
        });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        clearData();
      } else {
        // Fallback approach
        const a = document.createElement("a");
        a.href = url;
        a.download = `bundle-history-${bundleId}.json`;

        // Create a confirmation dialog
        if (
          confirm(
            "This bundle's data will be cleared. Click OK to proceed with download, or Cancel to abort."
          )
        ) {
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          clearData();
        }
      }
    } catch (err) {
      console.log("Save was cancelled or failed:", err);
    } finally {
      URL.revokeObjectURL(url);
    }
  });

document.getElementById("clearOnlyBtn").addEventListener("click", clearData);

document.getElementById("cancelBtn").addEventListener("click", () => {
  document.getElementById("confirmModal").style.display = "none";
});

document.getElementById("hideBtn").addEventListener("click", () => {
  const hideBtn = document.getElementById("hideBtn");
  const newHideStatus = hideBtn.textContent === "hide";

  applyHideStatus(newHideStatus);
  chrome.storage.local.set({ hideStatus: newHideStatus });
});

document.getElementById("hideDollarBtn").addEventListener("click", () => {
  const dollarChangeEl = document.getElementById("dollarChange");
  const hideDollarBtn = document.getElementById("hideDollarBtn");

  const isHidden = hideDollarBtn.textContent === "hide";
  dollarChangeEl.style.filter = isHidden ? "blur(20px)" : "none";
  hideDollarBtn.textContent = isHidden ? "unhide" : "hide";
});

document.getElementById("hidePercentBtn").addEventListener("click", () => {
  const percentChangeEl = document.getElementById("percentChange");
  const hidePercentBtn = document.getElementById("hidePercentBtn");

  const isHidden = hidePercentBtn.textContent === "hide";
  percentChangeEl.style.filter = isHidden ? "blur(20px)" : "none";
  hidePercentBtn.textContent = isHidden ? "unhide" : "hide";
});

chrome.storage.local.get(["portfolioHistory", "hideStatus"], (result) => {
  const portfolioHistory = result.portfolioHistory || {};
  updateBundleSelect(portfolioHistory);

  // Start the interval if there's data
  const bundleId = document.getElementById("bundleSelect").value;
  if (portfolioHistory[bundleId]) {
    startLastUpdatedInterval();
  }

  // Apply hide status if it exists
  const hideStatus = result.hideStatus || false;
  applyHideStatus(hideStatus);
});

// Load initial data
chrome.storage.local.get(["portfolioHistory", "hideStatus"], (result) => {
  const portfolioHistory = result.portfolioHistory || {};
  updateBundleSelect(portfolioHistory);

  // Start the interval if there's data
  const bundleId = document.getElementById("bundleSelect").value;
  if (portfolioHistory[bundleId]) {
    startLastUpdatedInterval();
  }

  // Apply hide status if it exists
  const hideStatus = result.hideStatus || false;
  const currentValueEl = document.getElementById("currentValue");
  const percentChangeEl = document.getElementById("percentChange");
  const hideBtn = document.getElementById("hideBtn");

  if (hideStatus) {
    currentValueEl.style.filter = "blur(20px)";
    percentChangeEl.style.filter = "blur(20px)";
    hideBtn.textContent = "unhide";
    if (chart) {
      chart.options.scales.y.ticks.display = false;
      chart.options.plugins.tooltip.enabled = false;
      chart.update();
    }
  } else {
    currentValueEl.style.filter = "none";
    percentChangeEl.style.filter = "none";
    hideBtn.textContent = "hide";
    if (chart) {
      chart.options.scales.y.ticks.display = true;
      chart.options.plugins.tooltip.enabled = true;
      chart.update();
    }
  }
});

// Listen for changes for new entry to the storage and update the chart
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.portfolioHistory) {
    // Get the new value from the changes object
    const newPortfolioHistory = changes.portfolioHistory.newValue || {};
    // Update the bundle select and chart with new data
    updateBundleSelect(newPortfolioHistory);

    // Restart the interval with new data
    const bundleId = document.getElementById("bundleSelect").value;
    if (newPortfolioHistory[bundleId]) {
      startLastUpdatedInterval();
    }
  }
});
