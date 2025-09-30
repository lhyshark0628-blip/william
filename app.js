const STORAGE_KEY = "budget-transactions";

const form = document.getElementById("transaction-form");
const tableBody = document.getElementById("transaction-table");
const template = document.getElementById("transaction-row-template");
const totalIncomeEl = document.getElementById("total-income");
const totalExpenseEl = document.getElementById("total-expense");
const balanceEl = document.getElementById("balance");
const chartRangeSelect = document.getElementById("chart-range");
const clearBtn = document.getElementById("clear-transactions");
const dateInput = document.getElementById("date");
const chartEmptyMessage = document.getElementById("chart-empty");

let chartInstance;

const state = {
  transactions: loadTransactions(),
};

init();

function init() {
  setDefaultDate();
  render();
  form.addEventListener("submit", onSubmit);
  tableBody.addEventListener("click", onTableClick);
  chartRangeSelect.addEventListener("change", updateChart);
  clearBtn.addEventListener("click", onClearAll);
}

function onSubmit(event) {
  event.preventDefault();
  const formData = new FormData(form);

  const transaction = {
    id: generateId(),
    type: formData.get("type"),
    category: formData.get("category").trim(),
    amount: Number(formData.get("amount")),
    date: formData.get("date"),
    note: formData.get("note").trim(),
  };

  if (!transaction.category || !transaction.date || transaction.amount <= 0) {
    alert("請確認所有欄位皆已填寫且金額大於 0。");
    return;
  }

  state.transactions.push(transaction);
  persistTransactions();
  form.reset();
  setDefaultDate();
  render();
}

function onTableClick(event) {
  const button = event.target.closest("button[data-action='delete']");
  if (!button) return;

  const row = button.closest("tr");
  const id = row?.dataset?.id;
  if (!id) return;

  state.transactions = state.transactions.filter((item) => item.id !== id);
  persistTransactions();
  render();
}

function onClearAll() {
  if (state.transactions.length === 0) return;
  const confirmed = confirm("確定要清空所有交易紀錄嗎？此動作無法復原。");
  if (!confirmed) return;

  state.transactions = [];
  persistTransactions();
  render();
}

function render() {
  renderSummary();
  renderTable();
  updateClearButton();
  updateChart();
}

function renderSummary() {
  const totals = state.transactions.reduce(
    (acc, transaction) => {
      if (transaction.type === "income") {
        acc.income += transaction.amount;
      } else {
        acc.expense += transaction.amount;
      }
      return acc;
    },
    { income: 0, expense: 0 }
  );

  const balance = totals.income - totals.expense;

  totalIncomeEl.textContent = formatCurrency(totals.income);
  totalExpenseEl.textContent = formatCurrency(totals.expense);
  balanceEl.textContent = formatCurrency(balance);
  balanceEl.classList.toggle("negative", balance < 0);
}

function renderTable() {
  tableBody.innerHTML = "";

  const sorted = [...state.transactions].sort((a, b) =>
    new Date(b.date) - new Date(a.date)
  );

  for (const transaction of sorted) {
    const clone = template.content.firstElementChild.cloneNode(true);
    clone.dataset.id = transaction.id;

    clone.querySelector('[data-field="date"]').textContent = formatDate(
      transaction.date
    );
    clone.querySelector('[data-field="category"]').textContent =
      transaction.category || "-";
    clone.querySelector('[data-field="type"]').textContent =
      transaction.type === "income" ? "收入" : "支出";
    clone.querySelector('[data-field="amount"]').textContent =
      (transaction.type === "expense" ? "-" : "") +
      formatCurrency(transaction.amount, false);
    clone.querySelector('[data-field="note"]').textContent =
      transaction.note || "-";

    tableBody.appendChild(clone);
  }

  if (state.transactions.length === 0) {
    const emptyRow = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = "目前尚無交易紀錄，快來新增第一筆吧！";
    cell.style.textAlign = "center";
    cell.style.padding = "1.5rem";
    cell.style.color = "var(--muted)";
    emptyRow.appendChild(cell);
    tableBody.appendChild(emptyRow);
  }
}

function updateChart() {
  const range = chartRangeSelect.value;
  const filtered = getFilteredTransactions(range);
  const sorted = filtered.sort((a, b) => new Date(a.date) - new Date(b.date));

  const labels = [];
  const balances = [];
  let runningBalance = 0;

  for (const transaction of sorted) {
    runningBalance +=
      transaction.type === "income"
        ? transaction.amount
        : -transaction.amount;
    labels.push(formatDate(transaction.date));
    balances.push(Number(runningBalance.toFixed(2)));
  }

  chartEmptyMessage.hidden = balances.length !== 0;

  const bounds = getChartBounds(balances);

  if (!chartInstance) {
    const ctx = document.getElementById("balance-chart").getContext("2d");
    chartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "結餘",
            data: balances,
            fill: true,
            borderColor: "#5d5fe7",
            backgroundColor: "rgba(93, 95, 231, 0.15)",
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: (context) => `結餘：${formatCurrency(context.parsed.y)}`,
            },
          },
        },
        scales: {
          x: {
            ticks: {
              maxTicksLimit: 6,
            },
          },
          y: {
            beginAtZero: false,
            suggestedMin: bounds.min,
            suggestedMax: bounds.max,
            ticks: {
              callback: (value) => formatCurrency(value),
            },
          },
        },
      },
    });
  } else {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = balances;
    chartInstance.options.scales.y.suggestedMin = bounds.min;
    chartInstance.options.scales.y.suggestedMax = bounds.max;
    chartInstance.update();
  }
}

function getFilteredTransactions(range) {
  if (range === "all") {
    return [...state.transactions];
  }

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const monthsMap = {
    "3m": 3,
    "6m": 6,
    "12m": 12,
  };

  const months = monthsMap[range] ?? 0;
  startDate.setMonth(startDate.getMonth() - months);

  return state.transactions.filter((transaction) => {
    const transactionDate = new Date(transaction.date);
    return transactionDate >= startDate;
  });
}

function persistTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.transactions));
}

function loadTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item === "object" &&
        item.id &&
        item.date &&
        (item.type === "income" || item.type === "expense") &&
        typeof item.amount === "number" &&
        !Number.isNaN(item.amount)
    );
  } catch (error) {
    console.error("Failed to load transactions", error);
    return [];
  }
}

function setDefaultDate() {
  const today = new Date();
  const formatted = today.toISOString().split("T")[0];
  dateInput.value = formatted;
}

function formatCurrency(value, withSymbol = true) {
  const options = {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  };

  if (withSymbol) {
    options.style = "currency";
    options.currency = "TWD";
  }

  const formatter = new Intl.NumberFormat("zh-Hant", options);
  return formatter.format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("zh-Hant", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

window.addEventListener("storage", () => {
  state.transactions = loadTransactions();
  render();
});

function updateClearButton() {
  const disabled = state.transactions.length === 0;
  clearBtn.disabled = disabled;
}

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function getChartBounds(values) {
  if (!values.length) {
    return { min: 0, max: 100 };
  }

  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 0);
  const span = maxValue - minValue;
  const padding = span === 0 ? Math.max(Math.abs(maxValue), 50) * 0.2 : span * 0.15;

  return {
    min: minValue - padding,
    max: maxValue + padding,
  };
}
