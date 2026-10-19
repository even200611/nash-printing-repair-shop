
const STORAGE_KEY = "nashPrintingRepairData";

const defaultData = {
  customers: [],
  quotations: [],
  jobs: [],
  payments: []
};

let data = loadData();
let toastTimer;

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        customers: parsed.customers || [],
        quotations: parsed.quotations || [],
        jobs: parsed.jobs || [],
        payments: parsed.payments || []
      };
    }
  } catch (error) {
    console.error("Unable to load saved data:", error);
  }
  return structuredClone(defaultData);
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function nextId(prefix, items) {
  const max = items.reduce((highest, item) => {
    const number = Number(String(item.id).replace(prefix, ""));
    return Math.max(highest, number || 0);
  }, 0);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

function money(amount) {
  return Number(amount || 0).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP"
  });
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function today() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function statusBadge(status) {
  const safe = escapeHTML(status);
  const className = status.toLowerCase().replace(/\s+/g, "-");
  return `<span class="status status-${className}">${safe}</span>`;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function showConfirm(title, message, actionLabel = "Confirm") {
  return new Promise(resolve => {
    const modal = document.getElementById("confirmModal");
    const titleElement = document.getElementById("modalTitle");
    const messageElement = document.getElementById("modalMessage");
    const confirmButton = document.getElementById("modalConfirm");
    const cancelButton = document.getElementById("modalCancel");

    titleElement.textContent = title;
    messageElement.textContent = message;
    confirmButton.textContent = actionLabel;
    modal.classList.add("show");

    function finish(result) {
      modal.classList.remove("show");
      confirmButton.removeEventListener("click", confirmAction);
      cancelButton.removeEventListener("click", cancelAction);
      modal.removeEventListener("click", backdropAction);
      document.removeEventListener("keydown", escapeAction);
      resolve(result);
    }

    function confirmAction() {
      finish(true);
    }

    function cancelAction() {
      finish(false);
    }

    function backdropAction(event) {
      if (event.target === modal) finish(false);
    }

    function escapeAction(event) {
      if (event.key === "Escape") finish(false);
    }

    confirmButton.addEventListener("click", confirmAction);
    cancelButton.addEventListener("click", cancelAction);
    modal.addEventListener("click", backdropAction);
    document.addEventListener("keydown", escapeAction);
  });
}

function goToPage(pageId) {
  const target = document.getElementById(pageId);
  if (!target) return;

  document.querySelectorAll(".page").forEach(page => {
    page.classList.toggle("active", page.id === pageId);
  });

  document.querySelectorAll(".nav-link").forEach(link => {
    link.classList.toggle("active", link.dataset.page === pageId);
  });

  const activeLink = document.querySelector(
    `.nav-link[data-page="${pageId}"]`
  );

  document.getElementById("breadcrumb").textContent =
    activeLink?.querySelector("span")?.textContent || "Dashboard";

  document.getElementById("navigation").classList.remove("open");
  document.querySelector(".sidebar").classList.remove("open");

  renderAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => goToPage(button.dataset.page));
});

document.querySelectorAll("[data-go]").forEach(button => {
  button.addEventListener("click", () => goToPage(button.dataset.go));
});

document.getElementById("mobileMenu").addEventListener("click", () => {
  document.querySelector(".sidebar").classList.toggle("open");
});

function getCustomer(customerId) {
  return data.customers.find(customer => customer.id === customerId);
}

function getJob(jobId) {
  return data.jobs.find(job => job.id === jobId);
}

function totalPaid(jobId) {
  return data.payments
    .filter(payment => payment.jobId === jobId)
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
}

function jobBalance(job) {
  return Math.max(0, Number(job.price) - totalPaid(job.id));
}

function refreshDashboard() {
  document.getElementById("statCustomers").textContent =
    data.customers.length;

  document.getElementById("statJobs").textContent =
    data.jobs.length;

  document.getElementById("statPending").textContent =
    data.jobs.filter(job =>
      ["Pending", "In Progress"].includes(job.status)
    ).length;

  const received = data.payments.reduce(
    (sum, payment) => sum + Number(payment.amount), 0
  );

  document.getElementById("statPayments").textContent = money(received);

  const recentJobs = [...data.jobs].reverse().slice(0, 5);
  const recentBody = document.getElementById("recentJobs");

  recentBody.innerHTML = recentJobs.map(job => {
    const customer = getCustomer(job.customerId);
    return `
      <tr>
        <td><strong>${escapeHTML(job.id)}</strong></td>
        <td>${escapeHTML(customer?.name || "Unknown")}</td>
        <td>${escapeHTML(job.service)}</td>
        <td>${statusBadge(job.status)}</td>
      </tr>
    `;
  }).join("");

  document.getElementById("recentEmpty").style.display =
    recentJobs.length ? "none" : "block";
}

function renderCustomers() {
  const search = document.getElementById("customerSearch").value
    .trim().toLowerCase();

  const customers = [...data.customers].reverse().filter(customer =>
    `${customer.name} ${customer.phone} ${customer.email}`
      .toLowerCase().includes(search)
  );

  document.getElementById("customersTable").innerHTML =
    customers.map(customer => {
      const orderCount = data.quotations.filter(
        quotation => quotation.customerId === customer.id
      ).length;

      return `
        <tr>
          <td><strong>${escapeHTML(customer.id)}</strong></td>
          <td>${escapeHTML(customer.name)}</td>
          <td>${escapeHTML(customer.phone)}</td>
          <td>${escapeHTML(customer.email || "—")}</td>
          <td>${orderCount}</td>
        </tr>
      `;
    }).join("");

  document.getElementById("customersEmpty").style.display =
    customers.length ? "none" : "block";
}

function renderQuotations() {
  const search = document.getElementById("quotationSearch").value
    .trim().toLowerCase();

  const quotations = [...data.quotations].reverse().filter(quotation => {
    const customer = getCustomer(quotation.customerId);
    return `${quotation.id} ${customer?.name || ""} ${quotation.service}`
      .toLowerCase().includes(search);
  });

  document.getElementById("quotationsTable").innerHTML =
    quotations.map(quotation => {
      const customer = getCustomer(quotation.customerId);

      let action = "";

      if (quotation.status === "Pending") {
        action = `<button class="table-action" data-approve="${escapeHTML(quotation.id)}">Approve</button>`;
      } else if (quotation.status === "Approved") {
        action = `<button class="table-action" data-create-job="${escapeHTML(quotation.id)}">Create Job</button>`;
      } else {
        action = `<span>—</span>`;
      }

      return `
        <tr>
          <td><strong>${escapeHTML(quotation.id)}</strong></td>
          <td>${escapeHTML(customer?.name || "Unknown")}</td>
          <td>${escapeHTML(quotation.service)}</td>
          <td>${money(quotation.price)}</td>
          <td>${statusBadge(quotation.status)}</td>
          <td>${action}</td>
        </tr>
      `;
    }).join("");

  document.getElementById("quotationsEmpty").style.display =
    quotations.length ? "none" : "block";
}

function renderJobs() {
  const search = document.getElementById("jobSearch").value
    .trim().toLowerCase();
  const filter = document.getElementById("jobFilter").value;

  const jobs = [...data.jobs].reverse().filter(job => {
    const customer = getCustomer(job.customerId);
    const matchesSearch =
      `${job.id} ${customer?.name || ""} ${job.service}`
        .toLowerCase().includes(search);
    const matchesFilter = !filter || job.status === filter;

    return matchesSearch && matchesFilter;
  });

  document.getElementById("jobsTable").innerHTML =
    jobs.map(job => {
      const customer = getCustomer(job.customerId);

      const options = [
        "Pending",
        "In Progress",
        "Completed",
        "Released",
        "Cancelled"
      ].map(status => `
        <option value="${status}" ${job.status === status ? "selected" : ""}>
          ${status}
        </option>
      `).join("");

      const statusControl = job.status === "Cancelled" ||
        job.status === "Released"
        ? statusBadge(job.status)
        : `
          <select class="filter-select status-select"
            data-job-status="${escapeHTML(job.id)}"
            aria-label="Update status for ${escapeHTML(job.id)}">
            ${options}
          </select>
        `;

      return `
        <tr>
          <td><strong>${escapeHTML(job.id)}</strong></td>
          <td>${escapeHTML(customer?.name || "Unknown")}</td>
          <td>${escapeHTML(job.service)}</td>
          <td>${formatDate(job.deadline)}</td>
          <td>${money(job.price)}</td>
          <td>${statusBadge(job.status)}</td>
          <td>${statusControl}</td>
        </tr>
      `;
    }).join("");

  document.getElementById("jobsEmpty").style.display =
    jobs.length ? "none" : "block";

  renderPaymentJobOptions();
}

function renderPaymentJobOptions() {
  const select = document.getElementById("paymentJob");
  const previousValue = select.value;

  const eligibleJobs = data.jobs.filter(job =>
    !["Cancelled", "Released"].includes(job.status) &&
    jobBalance(job) > 0
  );

  select.innerHTML = '<option value="">Select job order</option>' +
    eligibleJobs.map(job => {
      const customer = getCustomer(job.customerId);
      return `
        <option value="${escapeHTML(job.id)}">
          ${escapeHTML(job.id)} — ${escapeHTML(customer?.name || "Unknown")}
          (Balance: ${money(jobBalance(job))})
        </option>
      `;
    }).join("");

  if (eligibleJobs.some(job => job.id === previousValue)) {
    select.value = previousValue;
  }
}

function renderPayments() {
  const received = data.payments.reduce(
    (sum, payment) => sum + Number(payment.amount), 0
  );

  const balance = data.jobs
    .filter(job => job.status !== "Cancelled")
    .reduce((sum, job) => sum + jobBalance(job), 0);

  document.getElementById("paymentCount").textContent =
    data.payments.length;

  document.getElementById("paymentTotal").textContent = money(received);
  document.getElementById("paymentBalance").textContent = money(balance);

  const payments = [...data.payments].reverse();

  document.getElementById("paymentsTable").innerHTML =
    payments.map(payment => {
      const job = getJob(payment.jobId);
      const customer = job ? getCustomer(job.customerId) : null;

      return `
        <tr>
          <td><strong>${escapeHTML(payment.id)}</strong></td>
          <td>${escapeHTML(payment.jobId)}</td>
          <td>${escapeHTML(customer?.name || "Unknown")}</td>
          <td>${formatDate(payment.date)}</td>
          <td>${escapeHTML(payment.method)}</td>
          <td>${money(payment.amount)}</td>
        </tr>
      `;
    }).join("");

  document.getElementById("paymentsEmpty").style.display =
    payments.length ? "none" : "block";
}

function renderAll() {
  refreshDashboard();
  renderCustomers();
  renderQuotations();
  renderJobs();
  renderPayments();
}

document.getElementById("requestForm").addEventListener("submit", async event => {
  event.preventDefault();

  const name = document.getElementById("customerName").value.trim();
  const phone = document.getElementById("customerPhone").value.trim();
  const email = document.getElementById("customerEmail").value.trim();
  const service = document.getElementById("serviceType").value;
  const description = document.getElementById("orderTitle").value.trim();
  const quantity = Number(document.getElementById("orderQuantity").value);
  const price = Number(document.getElementById("orderPrice").value);
  const deadline = document.getElementById("orderDeadline").value;
  const notes = document.getElementById("orderNotes").value.trim();

  if (!name || !phone || !service || !description) {
    showToast("Please complete all required fields.");
    return;
  }

  if (!Number.isFinite(quantity) || quantity < 1 ||
      !Number.isFinite(price) || price < 0) {
    showToast("Please enter a valid quantity and price.");
    return;
  }

  if (deadline && deadline < today()) {
    showToast("The deadline cannot be in the past.");
    return;
  }

  const confirmed = await showConfirm(
    "Create Customer Request",
    `Create a quotation for ${name} with an estimated cost of ${money(price)}?`,
    "Create Request"
  );

  if (!confirmed) return;

  let customer = data.customers.find(existing =>
    existing.phone === phone
  );

  if (customer) {
    customer.name = name;
    customer.email = email;
  } else {
    customer = {
      id: nextId("CUS", data.customers),
      name,
      phone,
      email
    };
    data.customers.push(customer);
  }

  const quotation = {
    id: nextId("QUO", data.quotations),
    customerId: customer.id,
    service,
    description,
    quantity,
    price,
    deadline,
    notes,
    status: "Pending",
    createdAt: today()
  };

  data.quotations.push(quotation);
  saveData();

  event.target.reset();
  document.getElementById("orderQuantity").value = 1;

  goToPage("quotations");
  showToast(`Request saved. Quotation ${quotation.id} created.`);
});

document.getElementById("quotationsTable").addEventListener("click", async event => {
  const approveButton = event.target.closest("[data-approve]");
  const createJobButton = event.target.closest("[data-create-job]");

  if (approveButton) {
    const quotation = data.quotations.find(
      item => item.id === approveButton.dataset.approve
    );

    if (!quotation || quotation.status !== "Pending") return;

    const confirmed = await showConfirm(
      "Approve Quotation",
      `Approve quotation ${quotation.id} for ${money(quotation.price)}?`,
      "Approve"
    );

    if (!confirmed) return;

    quotation.status = "Approved";
    saveData();
    renderAll();
    showToast(`Quotation ${quotation.id} approved.`);
  }

  if (createJobButton) {
    const quotation = data.quotations.find(
      item => item.id === createJobButton.dataset.createJob
    );

    if (!quotation || quotation.status !== "Approved") return;

    const existingJob = data.jobs.find(
      job => job.quotationId === quotation.id
    );

    if (existingJob) {
      showToast("A job order already exists for this quotation.");
      return;
    }

    const confirmed = await showConfirm(
      "Create Job Order",
      `Create a job order for quotation ${quotation.id}?`,
      "Create Job"
    );

    if (!confirmed) return;

    const job = {
      id: nextId("JOB", data.jobs),
      quotationId: quotation.id,
      customerId: quotation.customerId,
      service: quotation.service,
      description: quotation.description,
      quantity: quotation.quantity,
      price: quotation.price,
      deadline: quotation.deadline,
      notes: quotation.notes,
      status: "Pending",
      createdAt: today()
    };

    data.jobs.push(job);
    quotation.status = "Converted";
    saveData();
    goToPage("jobs");
    showToast(`Job order ${job.id} created.`);
  }
});

document.getElementById("jobsTable").addEventListener("change", async event => {
  const select = event.target.closest("[data-job-status]");
  if (!select) return;

  const job = getJob(select.dataset.jobStatus);
  if (!job) return;

  const newStatus = select.value;
  const previousStatus = job.status;

  if (newStatus === previousStatus) return;

  if (newStatus === "Released" && jobBalance(job) > 0) {
    select.value = previousStatus;
    showToast("Record full payment before releasing this job.");
    return;
  }

  const confirmed = await showConfirm(
    "Update Job Status",
    `Change ${job.id} from ${previousStatus} to ${newStatus}?`,
    "Update Status"
  );

  if (!confirmed) {
    select.value = previousStatus;
    return;
  }

  job.status = newStatus;
  saveData();
  renderAll();
  showToast(`${job.id} status updated to ${newStatus}.`);
});

document.getElementById("paymentJob").addEventListener("change", event => {
  const job = getJob(event.target.value);
  const amountInput = document.getElementById("paymentAmount");

  if (job) {
    amountInput.max = jobBalance(job).toFixed(2);
    amountInput.placeholder = `Balance: ${jobBalance(job).toFixed(2)}`;
  } else {
    amountInput.removeAttribute("max");
    amountInput.placeholder = "0.00";
  }
});

document.getElementById("paymentForm").addEventListener("submit", async event => {
  event.preventDefault();

  const job = getJob(document.getElementById("paymentJob").value);
  const amount = Number(document.getElementById("paymentAmount").value);
  const method = document.getElementById("paymentMethod").value;
  const date = document.getElementById("paymentDate").value;

  if (!job || !method || !date ||
      !Number.isFinite(amount) || amount <= 0) {
    showToast("Please enter valid payment details.");
    return;
  }

  if (date > today()) {
    showToast("The payment date cannot be in the future.");
    return;
  }

  if (amount > jobBalance(job) + 0.001) {
    showToast(`Payment exceeds the remaining balance of ${money(jobBalance(job))}.`);
    return;
  }

  const confirmed = await showConfirm(
    "Confirm Payment",
    `Record ${money(amount)} for ${job.id} via ${method}?`,
    "Record Payment"
  );

  if (!confirmed) return;

  const payment = {
    id: nextId("REC", data.payments),
    jobId: job.id,
    amount,
    method,
    date
  };

  data.payments.push(payment);

  if (jobBalance(job) < 0.01) {
    job.status = "Completed";
  }

  saveData();
  event.target.reset();
  document.getElementById("paymentDate").value = today();

  renderAll();
  showToast(`Payment recorded. Receipt ${payment.id}.`);
});

document.getElementById("customerSearch").addEventListener("input", renderCustomers);
document.getElementById("quotationSearch").addEventListener("input", renderQuotations);
document.getElementById("jobSearch").addEventListener("input", renderJobs);
document.getElementById("jobFilter").addEventListener("change", renderJobs);

document.getElementById("exportPayments").addEventListener("click", () => {
  if (!data.payments.length) {
    showToast("There are no payment records to export.");
    return;
  }

  const rows = [
    ["Receipt ID", "Job Order", "Customer", "Date", "Method", "Amount"],
    ...data.payments.map(payment => {
      const job = getJob(payment.jobId);
      const customer = job ? getCustomer(job.customerId) : null;

      return [
        payment.id,
        payment.jobId,
        customer?.name || "Unknown",
        payment.date,
        payment.method,
        payment.amount
      ];
    })
  ];

  const csv = rows.map(row =>
    row.map(value =>
      `"${String(value ?? "").replace(/"/g, '""')}"`
    ).join(",")
  ).join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `NASH-Payments-${today()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  showToast("Payment records exported.");
});

document.getElementById("paymentDate").value = today();

renderAll();
