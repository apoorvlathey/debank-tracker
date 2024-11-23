let chart = null;
let currentData = {};
let isDraggingYAxis = false;
let dragStartY = 0;
let initialZoom = null;
let initialBounds = null; // Store initial bounds for reset

function calculateChanges(data) {
  if (!data || data.length < 2)
    return { dollarChange: 0, percentChange: 0, currentValue: 0 };

  const currentValue = data[data.length - 1].value;
  const initialValue = data[0].value;
  const dollarChange = currentValue - initialValue;
  const percentChange = ((currentValue - initialValue) / initialValue) * 100;

  return {
    dollarChange,
    percentChange,
    currentValue,
  };
}

function updateStats(data) {
  const stats = calculateChanges(data);

  // Update current value
  const currentValueEl = document.getElementById("currentValue");
  currentValueEl.textContent = formatCurrency(stats.currentValue);

  // Update dollar change
  const dollarChangeEl = document.getElementById("dollarChange");
  dollarChangeEl.textContent = formatCurrency(stats.dollarChange);
  dollarChangeEl.className = "stat-value " + getChangeClass(stats.dollarChange);

  // Update percent change
  const percentChangeEl = document.getElementById("percentChange");
  percentChangeEl.textContent = formatPercentage(stats.percentChange);
  percentChangeEl.className =
    "stat-value " + getChangeClass(stats.percentChange);
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

// Helper function to aggregate data based on time scale
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

function createChart(data, timeScale) {
  const ctx = document.getElementById("valueChart").getContext("2d");
  const canvas = document.getElementById("valueChart");
  const aggregatedData = aggregateData(data, timeScale);

  // Update stats before creating the chart
  updateStats(aggregatedData);

  if (chart) {
    chart.destroy();
  }

  // Calculate initial bounds with padding
  const values = aggregatedData.map((item) => item.value);
  const minValue = Math.floor(Math.min(...values));
  const maxValue = Math.ceil(Math.max(...values));
  const valueRange = maxValue - minValue;
  const paddedMin = Math.floor(minValue - valueRange * 0.05);
  const paddedMax = Math.ceil(maxValue + valueRange * 0.05);

  // Store initial bounds for reset
  initialBounds = {
    min: paddedMin,
    max: paddedMax,
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
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: false,
          suggestedMin: paddedMin,
          suggestedMax: paddedMax,
          ticks: {
            callback: (value) => "$" + Math.round(value).toLocaleString(),
          },
          afterDataLimits: (scale) => {
            scale.min = Math.floor(scale.min);
            scale.max = Math.ceil(scale.max);
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (context) => {
              const dataIndex = context.dataIndex;
              const currentValue = context.parsed.y;
              const initialValue = context.dataset.data[0];
              const dollarChange = currentValue - initialValue;
              const percentChange =
                ((currentValue - initialValue) / initialValue) * 100;

              return [
                `Value: ${formatCurrency(currentValue)}`,
                `Change: ${formatCurrency(dollarChange)} (${formatPercentage(
                  percentChange
                )})`,
              ];
            },
          },
        },
        zoom: {
          pan: {
            enabled: true,
            mode: "y",
          },
          zoom: {
            wheel: {
              enabled: false,
            },
            pinch: {
              enabled: true,
            },
            mode: "y",
          },
        },
        legend: {
          onClick: null, // This disables the click handler
        },
      },
    },
  });

  // Track mouse position and update cursor
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const chartArea = chart.chartArea;
    const yAxis = chart.scales.y;

    // Check if mouse is over the y-axis area (including labels)
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

      const newMin = Math.floor(centerValue - newRange / 2);
      const newMax = Math.ceil(centerValue + newRange / 2);

      chart.scales.y.options.min = newMin;
      chart.scales.y.options.max = newMax;
      chart.update("none");
    }
  });

  canvas.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const chartArea = chart.chartArea;

    // Check if mouse is over the y-axis area (including labels)
    if (x <= chartArea.left) {
      isDraggingYAxis = true;
      dragStartY = e.clientY;
      initialZoom = {
        min: Math.floor(chart.scales.y.min),
        max: Math.ceil(chart.scales.y.max),
        range: Math.ceil(chart.scales.y.max) - Math.floor(chart.scales.y.min),
      };
      canvas.style.cursor = "ns-resize";
    }
  });

  window.addEventListener("mouseup", () => {
    if (isDraggingYAxis) {
      isDraggingYAxis = false;
      initialZoom = null;
      canvas.style.cursor = "default";
    }
  });

  canvas.addEventListener("mouseleave", () => {
    canvas.style.cursor = "default";
  });
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

    // Enable controls if we have data
    bundleSelect.disabled = false;
    timeScale.disabled = false;
    downloadBtn.disabled = false;
    resetZoom.disabled = false;

    updateChart();
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
  }
}

function downloadData() {
  const dataStr = JSON.stringify(currentData, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "portfolio-history.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function clearData() {
  chrome.storage.local.set({ portfolioHistory: {} }, () => {
    currentData = {};
    updateBundleSelect({});

    // Clear the existing chart
    if (chart) {
      chart.destroy();
      chart = null;
    }

    // Clear the chart canvas
    const ctx = document.getElementById("valueChart");
    ctx.getContext("2d").clearRect(0, 0, ctx.width, ctx.height);

    // Hide or disable controls since there's no data
    document.getElementById("timeScale").disabled = true;
    document.getElementById("downloadBtn").disabled = true;
    document.getElementById("bundleSelect").disabled = true;
    document.getElementById("resetZoom").disabled = true;

    // Close the modal
    document.getElementById("confirmModal").style.display = "none";
  });
}

function resetZoom() {
  if (chart && initialBounds) {
    // Reset to initial bounds
    chart.scales.y.options.min = initialBounds.min;
    chart.scales.y.options.max = initialBounds.max;

    // Clear any zoom-specific options
    chart.scales.y.options.suggestedMin = initialBounds.min;
    chart.scales.y.options.suggestedMax = initialBounds.max;

    // Reset zoom state
    isDraggingYAxis = false;
    initialZoom = null;

    // Update the chart
    chart.update();
  }
}

function updateChart() {
  const bundleId = document.getElementById("bundleSelect").value;
  const timeScale = document.getElementById("timeScale").value;
  const data = currentData[bundleId];

  if (data && data.length > 0) {
    createChart(data, timeScale);
  } else {
    // Reset stats if no data
    updateStats([]);
    if (chart) {
      chart.destroy();
      chart = null;
    }
  }
}

// Event Listeners
document.getElementById("bundleSelect").addEventListener("change", updateChart);
document.getElementById("timeScale").addEventListener("change", updateChart);
document.getElementById("downloadBtn").addEventListener("click", downloadData);
document.getElementById("clearBtn").addEventListener("click", () => {
  document.getElementById("confirmModal").style.display = "flex";
});

document.getElementById("resetZoom").addEventListener("click", resetZoom);

document.getElementById("downloadAndClearBtn").addEventListener("click", () => {
  downloadData();
  clearData();
});

document.getElementById("clearOnlyBtn").addEventListener("click", clearData);

document.getElementById("cancelBtn").addEventListener("click", () => {
  document.getElementById("confirmModal").style.display = "none";
});

// Load initial data
chrome.storage.local.get(["portfolioHistory"], (result) => {
  const portfolioHistory = result.portfolioHistory || {};
  updateBundleSelect(portfolioHistory);
});

// Listen for changes to the portfolio history and update the chart
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.portfolioHistory) {
    // Get the new value from the changes object
    const newPortfolioHistory = changes.portfolioHistory.newValue || {};
    // Update the bundle select and chart with new data
    updateBundleSelect(newPortfolioHistory);
  }
});
