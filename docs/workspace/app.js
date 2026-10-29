(function () {
  "use strict";

  var labels = { pending: "待处理", shipped: "已发货", completed: "已完成", refunded: "已退款" };
  var products = {
    "design-kit": { name: "设计系统基础套件", price: 12900 },
    "icon-pack": { name: "界面图标资源包", price: 7900 },
    "workbook": { name: "产品设计工作手册", price: 5900 },
    "brand-template": { name: "品牌设计模板", price: 19900 }
  };
  var customers = [
    { name: "林可", email: "linke@example.com" }, { name: "陈安", email: "chenan@example.com" },
    { name: "许宁", email: "xuning@example.com" }, { name: "周禾", email: "zhouhe@example.com" },
    { name: "沈亦", email: "shenyi@example.com" }, { name: "江月", email: "jiangyue@example.com" },
    { name: "陆遥", email: "luyao@example.com" }, { name: "苏青", email: "suqing@example.com" },
    { name: "何川", email: "hechuan@example.com" }, { name: "顾言", email: "guyan@example.com" }
  ];
  var statuses = ["pending", "shipped", "pending", "completed", "refunded", "shipped", "pending", "completed", "shipped", "pending", "refunded", "completed", "pending", "shipped", "completed", "pending"];
  var productIds = Object.keys(products);
  var seedOrders = statuses.map(function (status, index) {
    var customer = customers[index % customers.length]; var product = products[productIds[index % 4]];
    var day = 29 - Math.floor(index / 2); var hour = 14 - index % 5; var quantity = index % 7 === 0 ? 2 : 1;
    return { id: "CC-" + String(1029 - Math.floor(index / 2)) + "-" + String(16 - index).padStart(3, "0"), customer: customer.name, email: customer.email, product: product.name, quantity: quantity, amount: product.price * quantity, status: status, date: "2026-10-" + String(day).padStart(2, "0") + "T" + String(hour).padStart(2, "0") + ":" + String(42 - index).padStart(2, "0"), note: index === 0 ? "演示订单：请确认收件信息。" : "" };
  });
  var keys = { orders: "calmconsole:orders:v1", preferences: "calmconsole:preferences:v1" };
  var state = { orders: [], view: "orders", status: "all", query: "", customerQuery: "", sort: "newest", page: 1, pageSize: 6, selected: new Set(), activeOrderId: null, detailOpener: null, newOpener: null, undo: null, navOpen: false, preferences: { density: "comfortable", theme: "light" } };
  var root = document.documentElement;
  var body = document.getElementById("orders-body");
  var detailDialog = document.getElementById("order-dialog");
  var newDialog = document.getElementById("new-order-dialog");
  var mobileQuery = window.matchMedia("(max-width: 740px)");
  var darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  var formatter = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", minimumFractionDigits: 2 });

  function readStorage(key) { try { return window.localStorage.getItem(key); } catch (error) { return null; } }
  function writeStorage(key, value) { try { window.localStorage.setItem(key, value); return true; } catch (error) { return false; } }
  function copyOrders(orders) { return orders.map(function (order) { return Object.assign({}, order); }); }
  function money(cents) { return formatter.format(cents / 100); }
  function node(tag, className, text) { var item = document.createElement(tag); if (className) item.className = className; if (text !== undefined) item.textContent = text; return item; }
  function icon(name) { var item = node("i"); item.dataset.lucide = name; item.setAttribute("aria-hidden", "true"); return item; }
  function refreshIcons() { if (window.lucide && typeof window.lucide.createIcons === "function") window.lucide.createIcons(); }
  function getOrder(id) { return state.orders.find(function (order) { return order.id === id; }); }
  function dateLabel(date) { return date.slice(5, 10).replace("-", "月") + "日 " + date.slice(11, 16); }
  function validOrder(order) {
    return order && typeof order.id === "string" && /^CC-[A-Za-z0-9-]+$/.test(order.id) && typeof order.customer === "string" && typeof order.email === "string" && typeof order.product === "string" && Number.isInteger(order.quantity) && order.quantity > 0 && order.quantity <= 99 && Number.isInteger(order.amount) && order.amount > 0 && Boolean(labels[order.status]) && typeof order.date === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(order.date) && typeof order.note === "string";
  }

  try { var storedOrders = JSON.parse(readStorage(keys.orders) || "null"); state.orders = Array.isArray(storedOrders) && storedOrders.length > 0 && storedOrders.every(validOrder) ? storedOrders : copyOrders(seedOrders); } catch (error) { state.orders = copyOrders(seedOrders); }
  try { var storedPreferences = JSON.parse(readStorage(keys.preferences) || "null"); if (storedPreferences) { if (["comfortable", "compact"].includes(storedPreferences.density)) state.preferences.density = storedPreferences.density; if (["light", "dark", "system"].includes(storedPreferences.theme)) state.preferences.theme = storedPreferences.theme; } } catch (error) { /* Defaults remain usable when stored data is malformed. */ }

  function toast(message, undoable) {
    document.getElementById("toast-message").textContent = message;
    document.getElementById("undo-action").hidden = !undoable || !state.undo;
    document.getElementById("toast").hidden = false;
    refreshIcons();
  }
  function commit(previous, message) {
    state.undo = copyOrders(previous);
    var persisted = writeStorage(keys.orders, JSON.stringify(state.orders));
    state.selected.clear(); renderAll();
    toast(message + (persisted ? "" : " 本次会话有效，浏览器存储不可用。"), true);
  }

  function applyPreferences(persist) {
    root.dataset.density = state.preferences.density;
    var theme = state.preferences.theme === "system" ? (darkQuery.matches ? "dark" : "light") : state.preferences.theme;
    root.dataset.theme = theme;
    document.querySelectorAll('input[name="density"]').forEach(function (input) { input.checked = input.value === state.preferences.density; });
    document.querySelectorAll('input[name="theme"]').forEach(function (input) { input.checked = input.value === state.preferences.theme; });
    var quickTheme = document.getElementById("quick-theme"); var label = theme === "dark" ? "切换到亮色主题" : "切换到暗色主题";
    quickTheme.setAttribute("aria-label", label); quickTheme.title = label; quickTheme.replaceChildren(icon(theme === "dark" ? "sun" : "moon"));
    if (persist) { var saved = writeStorage(keys.preferences, JSON.stringify(state.preferences)); document.getElementById("settings-status").textContent = saved ? "偏好已保存" : "本次会话内有效"; }
    refreshIcons();
  }
  applyPreferences(false);
  document.querySelectorAll('input[name="density"], input[name="theme"]').forEach(function (input) { input.addEventListener("change", function () { if (input.checked) { state.preferences[input.name] = input.value; applyPreferences(true); } }); });
  document.getElementById("quick-theme").addEventListener("click", function () { state.preferences.theme = root.dataset.theme === "dark" ? "light" : "dark"; applyPreferences(true); });
  document.getElementById("reset-preferences").addEventListener("click", function () { state.preferences = { density: "comfortable", theme: "light" }; applyPreferences(true); toast("已恢复默认偏好。", false); });
  if (darkQuery.addEventListener) darkQuery.addEventListener("change", function () { if (state.preferences.theme === "system") applyPreferences(false); });

  function updateNavigation(open, restoreFocus) {
    state.navOpen = Boolean(open && mobileQuery.matches);
    root.dataset.navOpen = String(state.navOpen);
    document.getElementById("nav-overlay").hidden = !state.navOpen;
    document.getElementById("nav-toggle").setAttribute("aria-expanded", String(state.navOpen));
    var sidebar = document.getElementById("sidebar"); sidebar.inert = mobileQuery.matches && !state.navOpen;
    document.getElementById("app-main").inert = state.navOpen;
    if (state.navOpen) { sidebar.setAttribute("role", "dialog"); sidebar.setAttribute("aria-modal", "true"); document.getElementById("nav-close").focus(); }
    else { sidebar.removeAttribute("role"); sidebar.removeAttribute("aria-modal"); if (restoreFocus && mobileQuery.matches) document.getElementById("nav-toggle").focus(); }
  }
  document.getElementById("nav-toggle").addEventListener("click", function () { updateNavigation(true, false); });
  document.getElementById("nav-close").addEventListener("click", function () { updateNavigation(false, true); });
  document.getElementById("nav-overlay").addEventListener("click", function () { updateNavigation(false, true); });
  if (mobileQuery.addEventListener) mobileQuery.addEventListener("change", function () { updateNavigation(false, false); });
  document.addEventListener("keydown", function (event) {
    if (!state.navOpen) return;
    if (event.key === "Escape") { event.preventDefault(); updateNavigation(false, true); }
    if (event.key === "Tab") { var controls = Array.from(document.getElementById("sidebar").querySelectorAll("button, a[href]")).filter(function (item) { return item.offsetParent !== null; }); var first = controls[0]; var last = controls[controls.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }
  });
  updateNavigation(false, false);

  function navigate(view, focusTitle) {
    if (!["orders", "customers", "settings"].includes(view)) return;
    state.view = view;
    document.querySelectorAll(".view").forEach(function (section) { section.hidden = section.id !== view + "-view"; });
    document.querySelectorAll("[data-view]").forEach(function (button) { var active = button.dataset.view === view; button.classList.toggle("is-current", active); if (active) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current"); });
    var title = { orders: "订单", customers: "客户", settings: "设置" }[view]; document.getElementById("breadcrumb-current").textContent = title; document.title = title + " · CalmConsole";
    updateNavigation(false, false);
    if (view === "customers") renderCustomers();
    if (focusTitle) document.getElementById(view + "-title").focus({ preventScroll: true });
    refreshIcons();
  }
  document.querySelectorAll("[data-view], [data-view-link]").forEach(function (button) { button.addEventListener("click", function (event) { event.preventDefault(); navigate(button.dataset.view || button.dataset.viewLink, true); }); });

  function matchingOrders() {
    var query = state.query.trim().toLocaleLowerCase();
    return state.orders.filter(function (order) { return (state.status === "all" || order.status === state.status) && (!query || [order.id, order.customer, order.email, order.product, order.note].join(" ").toLocaleLowerCase().includes(query)); }).sort(function (a, b) { if (state.sort === "amount-desc") return b.amount - a.amount || b.date.localeCompare(a.date); if (state.sort === "amount-asc") return a.amount - b.amount || b.date.localeCompare(a.date); return state.sort === "oldest" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date); });
  }
  function pageOrders() { return matchingOrders().slice((state.page - 1) * state.pageSize, state.page * state.pageSize); }
  function statusBadge(status) { var badge = node("span", "order-badge " + status); badge.append(node("span", "status-dot"), document.createTextNode(labels[status])); return badge; }
  function renderStats() {
    var valid = state.orders.filter(function (order) { return order.status !== "refunded"; }); var refunded = state.orders.filter(function (order) { return order.status === "refunded"; });
    document.getElementById("stat-total").textContent = money(valid.reduce(function (sum, order) { return sum + order.amount; }, 0));
    document.getElementById("stat-total-note").textContent = valid.length + " 笔有效订单";
    document.getElementById("stat-pending").replaceChildren(document.createTextNode(String(state.orders.filter(function (order) { return order.status === "pending"; }).length)), node("span", "", "笔"));
    document.getElementById("stat-shipped").replaceChildren(document.createTextNode(String(state.orders.filter(function (order) { return order.status === "shipped"; }).length)), node("span", "", "笔"));
    document.getElementById("stat-refunded").textContent = money(refunded.reduce(function (sum, order) { return sum + order.amount; }, 0));
    document.getElementById("stat-refund-note").textContent = refunded.length + " 笔退款订单";
    document.getElementById("nav-order-count").textContent = String(state.orders.length);
    document.querySelectorAll("[data-status-count]").forEach(function (item) { var status = item.dataset.statusCount; item.textContent = String(status === "all" ? state.orders.length : state.orders.filter(function (order) { return order.status === status; }).length); });
  }

  function renderRow(order) {
    var row = node("tr"); row.dataset.orderId = order.id; row.classList.toggle("is-selected", state.selected.has(order.id));
    var selectCell = node("td", "checkbox-cell"); var checkbox = node("input"); checkbox.type = "checkbox"; checkbox.checked = state.selected.has(order.id); checkbox.dataset.selectId = order.id; checkbox.setAttribute("aria-label", "选择订单 " + order.id);
    checkbox.addEventListener("change", function () { if (checkbox.checked) state.selected.add(order.id); else state.selected.delete(order.id); row.classList.toggle("is-selected", checkbox.checked); syncSelection(); }); var checkLabel = node("label", "checkbox-hit"); checkLabel.append(checkbox); selectCell.append(checkLabel);
    var idCell = node("td"); var idButton = node("button", "order-id", order.id); idButton.type = "button"; idButton.dataset.orderOpen = order.id; idButton.addEventListener("click", function () { openDetails(order.id, idButton); }); idCell.append(idButton);
    var customerCell = node("td", "customer-cell"); customerCell.append(node("span", "customer-name", order.customer), node("span", "secondary-text", order.email));
    var productCell = node("td", "product-cell"); productCell.append(node("span", "product-name", order.product), node("span", "secondary-text", "数量 × " + order.quantity));
    var badgeCell = node("td"); badgeCell.append(statusBadge(order.status));
    var actionCell = node("td", "row-action-cell"); var openButton = node("button", "icon-button row-open-button"); openButton.type = "button"; openButton.setAttribute("aria-label", "查看订单 " + order.id); openButton.title = "查看订单"; openButton.append(icon("arrow-up-right")); openButton.addEventListener("click", function () { openDetails(order.id, openButton); }); actionCell.append(openButton);
    row.append(selectCell, idCell, customerCell, productCell, badgeCell, node("td", "numeric amount-cell", money(order.amount)), node("td", "date-cell", dateLabel(order.date)), actionCell);
    row.addEventListener("click", function (event) { if (!event.target.closest("button, input, label, a, select")) openDetails(order.id, idButton); });
    return row;
  }
  function syncSelection() {
    var visible = pageOrders(); var selectedVisible = visible.filter(function (order) { return state.selected.has(order.id); });
    var master = document.getElementById("select-page"); master.checked = visible.length > 0 && selectedVisible.length === visible.length; master.indeterminate = selectedVisible.length > 0 && selectedVisible.length < visible.length; master.disabled = visible.length === 0;
    document.getElementById("bulk-toolbar").hidden = selectedVisible.length === 0;
    document.getElementById("selected-count").textContent = "已选择 " + selectedVisible.length + " 条本页订单";
    document.getElementById("bulk-ship").disabled = !selectedVisible.some(function (order) { return order.status === "pending"; });
  }
  function renderOrders() {
    var filtered = matchingOrders(); var pages = Math.max(1, Math.ceil(filtered.length / state.pageSize)); state.page = Math.max(1, Math.min(state.page, pages));
    var visible = filtered.slice((state.page - 1) * state.pageSize, state.page * state.pageSize); body.replaceChildren.apply(body, visible.map(renderRow));
    document.getElementById("orders-empty").hidden = filtered.length !== 0;
    document.querySelectorAll("[data-status]").forEach(function (button) { var active = button.dataset.status === state.status; button.classList.toggle("is-active", active); button.setAttribute("aria-pressed", String(active)); });
    var first = filtered.length ? (state.page - 1) * state.pageSize + 1 : 0; var last = Math.min(state.page * state.pageSize, filtered.length);
    document.getElementById("pagination-summary").textContent = "显示 " + first + "–" + last + " 条，共 " + filtered.length + " 条订单";
    document.getElementById("previous-page").disabled = state.page === 1; document.getElementById("next-page").disabled = state.page >= pages;
    var numbers = document.getElementById("page-numbers"); numbers.replaceChildren();
    var start = Math.max(1, state.page - 1); var end = Math.min(pages, start + 2); start = Math.max(1, end - 2);
    for (var page = start; page <= end; page += 1) {
      var button = node("button", "page-number", String(page)); button.type = "button"; button.dataset.page = String(page); button.setAttribute("aria-label", "第 " + page + " 页"); if (page === state.page) button.setAttribute("aria-current", "page");
      button.addEventListener("click", function (event) { state.page = Number(event.currentTarget.dataset.page); state.selected.clear(); renderOrders(); var active = document.querySelector('.page-number[aria-current="page"]'); if (active) active.focus(); }); numbers.append(button);
    }
    syncSelection(); refreshIcons();
  }
  function resetPaging() { state.page = 1; state.selected.clear(); renderOrders(); }
  document.querySelectorAll("[data-status]").forEach(function (button) { button.addEventListener("click", function () { state.status = button.dataset.status; resetPaging(); }); });
  document.getElementById("order-search-form").addEventListener("submit", function (event) { event.preventDefault(); });
  document.getElementById("order-search").addEventListener("input", function (event) { state.query = event.target.value; resetPaging(); });
  document.getElementById("order-sort").addEventListener("change", function (event) { state.sort = event.target.value; resetPaging(); });
  document.getElementById("page-size").addEventListener("change", function (event) { state.pageSize = Number(event.target.value); resetPaging(); });
  document.getElementById("previous-page").addEventListener("click", function () { state.page -= 1; state.selected.clear(); renderOrders(); });
  document.getElementById("next-page").addEventListener("click", function () { state.page += 1; state.selected.clear(); renderOrders(); });
  document.getElementById("reset-order-filters").addEventListener("click", function () { state.status = "all"; state.query = ""; document.getElementById("order-search").value = ""; resetPaging(); document.getElementById("order-search").focus(); });
  document.getElementById("select-page").addEventListener("change", function (event) { var checked = event.target.checked; state.selected.clear(); pageOrders().forEach(function (order) { if (checked) state.selected.add(order.id); }); document.querySelectorAll("[data-select-id]").forEach(function (checkbox) { checkbox.checked = checked; checkbox.closest("tr").classList.toggle("is-selected", checked); }); syncSelection(); });
  document.getElementById("clear-selection").addEventListener("click", function () { state.selected.clear(); renderOrders(); document.getElementById("select-page").focus(); });
  document.getElementById("bulk-ship").addEventListener("click", function () {
    var eligible = pageOrders().filter(function (order) { return state.selected.has(order.id) && order.status === "pending"; }); if (!eligible.length) return;
    var previous = copyOrders(state.orders); eligible.forEach(function (order) { order.status = "shipped"; }); commit(previous, "已将 " + eligible.length + " 笔订单标记为已发货。"); var master = document.getElementById("select-page"); if (!master.disabled) master.focus(); else document.querySelector('[data-status="' + state.status + '"]').focus();
  });

  function aggregateCustomers() {
    var map = new Map(); state.orders.forEach(function (order) { var key = order.email.toLocaleLowerCase(); if (!map.has(key)) map.set(key, { name: order.customer, email: order.email, count: 0, amount: 0, latest: order.date }); var customer = map.get(key); customer.count += 1; if (order.status !== "refunded") customer.amount += order.amount; if (order.date > customer.latest) { customer.latest = order.date; customer.name = order.customer; } }); return Array.from(map.values()).sort(function (a, b) { return b.amount - a.amount; });
  }
  function renderCustomers() {
    var all = aggregateCustomers(); var query = state.customerQuery.trim().toLocaleLowerCase(); var visible = all.filter(function (customer) { return !query || (customer.name + " " + customer.email).toLocaleLowerCase().includes(query); });
    document.getElementById("customer-summary").textContent = all.length + " 位演示客户";
    document.getElementById("customer-total").textContent = String(all.length); document.getElementById("customer-repeat").textContent = String(all.filter(function (customer) { return customer.count > 1; }).length); document.getElementById("customer-revenue").textContent = money(all.reduce(function (sum, customer) { return sum + customer.amount; }, 0));
    document.getElementById("customer-result-count").textContent = visible.length + " 位客户"; document.getElementById("customers-empty").hidden = visible.length !== 0;
    var rows = visible.map(function (customer) { var row = node("tr"); var profileCell = node("td"); var profile = node("div", "customer-profile"); profile.append(node("span", "customer-initial", customer.name.slice(0, 1)), node("span", "customer-name", customer.name)); profileCell.append(profile); var action = node("td", "row-action-cell"); var button = node("button", "customer-order-button", "查看订单"); button.type = "button"; button.dataset.customerEmail = customer.email; button.append(icon("arrow-up-right")); button.addEventListener("click", function () { state.status = "all"; state.query = customer.email; document.getElementById("order-search").value = customer.email; resetPaging(); navigate("orders", true); }); action.append(button); row.append(profileCell, node("td", "date-cell", customer.email), node("td", "numeric", String(customer.count)), node("td", "numeric amount-cell", money(customer.amount)), node("td", "date-cell", dateLabel(customer.latest)), action); return row; }); document.getElementById("customers-body").replaceChildren.apply(document.getElementById("customers-body"), rows); refreshIcons();
  }
  document.getElementById("customer-search-form").addEventListener("submit", function (event) { event.preventDefault(); });
  document.getElementById("customer-search").addEventListener("input", function (event) { state.customerQuery = event.target.value; renderCustomers(); });
  document.getElementById("reset-customer-search").addEventListener("click", function () { state.customerQuery = ""; document.getElementById("customer-search").value = ""; renderCustomers(); document.getElementById("customer-search").focus(); });

  function setDialogState() { if (detailDialog.open || newDialog.open) root.dataset.dialogOpen = "true"; else delete root.dataset.dialogOpen; }
  function openDetails(id, opener) {
    var order = getOrder(id); if (!order) return; state.activeOrderId = id; state.detailOpener = opener || document.activeElement;
    document.getElementById("detail-amount").textContent = money(order.amount); document.getElementById("detail-id").textContent = order.id; document.getElementById("detail-customer").textContent = order.customer; document.getElementById("detail-email").textContent = order.email; document.getElementById("detail-product").textContent = order.product; document.getElementById("detail-quantity").textContent = String(order.quantity); document.getElementById("detail-date").textContent = order.date.replace("T", " "); document.getElementById("detail-status").value = order.status; document.getElementById("detail-note").value = order.note; document.getElementById("detail-note-count").textContent = order.note.length + " / 500";
    detailDialog.showModal(); setDialogState(); document.getElementById("close-detail").focus();
  }
  document.getElementById("close-detail").addEventListener("click", function () { detailDialog.close(); });
  document.getElementById("cancel-detail").addEventListener("click", function () { detailDialog.close(); });
  document.getElementById("detail-note").addEventListener("input", function (event) { document.getElementById("detail-note-count").textContent = event.target.value.length + " / 500"; });
  document.getElementById("detail-form").addEventListener("submit", function (event) {
    event.preventDefault(); var order = getOrder(state.activeOrderId); if (!order) return;
    var status = document.getElementById("detail-status").value; var note = document.getElementById("detail-note").value.trim();
    if (!labels[status] || note.length > 500) return;
    if (order.status === status && order.note === note) { detailDialog.close(); toast("没有需要保存的更改。", false); return; }
    var previous = copyOrders(state.orders); order.status = status; order.note = note; commit(previous, "订单 " + order.id + " 已更新。"); detailDialog.close();
  });
  detailDialog.addEventListener("close", function () { setDialogState(); var replacement = document.querySelector('[data-order-open="' + state.activeOrderId + '"]'); if (state.detailOpener && state.detailOpener.isConnected) state.detailOpener.focus(); else if (replacement) replacement.focus(); else document.getElementById("new-order").focus(); state.activeOrderId = null; state.detailOpener = null; });

  var newForm = document.getElementById("new-order-form");
  function updateNewTotal() { var price = Number(document.getElementById("new-price").value); var quantity = Number(document.getElementById("new-quantity").value); document.getElementById("new-total").textContent = Number.isFinite(price) && Number.isFinite(quantity) ? money(Math.round(price * 100) * quantity) : "—"; }
  function clearNewErrors() { document.querySelectorAll(".field-error").forEach(function (item) { item.textContent = ""; }); newForm.querySelectorAll("[aria-invalid]").forEach(function (input) { input.removeAttribute("aria-invalid"); }); }
  document.getElementById("new-order").addEventListener("click", function () { state.newOpener = document.activeElement; newForm.reset(); clearNewErrors(); updateNewTotal(); newDialog.showModal(); setDialogState(); document.getElementById("new-customer").focus(); });
  document.getElementById("close-new").addEventListener("click", function () { newDialog.close(); }); document.getElementById("cancel-new").addEventListener("click", function () { newDialog.close(); });
  document.getElementById("new-product").addEventListener("change", function (event) { var product = products[event.target.value]; if (product) document.getElementById("new-price").value = (product.price / 100).toFixed(2); updateNewTotal(); });
  document.getElementById("new-price").addEventListener("input", updateNewTotal); document.getElementById("new-quantity").addEventListener("input", updateNewTotal);
  newForm.addEventListener("input", function (event) { if (event.target.name) { var error = document.getElementById("error-" + event.target.name); if (error) error.textContent = ""; event.target.removeAttribute("aria-invalid"); } });
  newForm.addEventListener("submit", function (event) {
    event.preventDefault(); clearNewErrors();
    var fields = { customer: document.getElementById("new-customer"), email: document.getElementById("new-email"), product: document.getElementById("new-product"), quantity: document.getElementById("new-quantity"), price: document.getElementById("new-price") };
    var quantity = Number(fields.quantity.value); var price = Number(fields.price.value); var errors = {};
    if (!fields.customer.value.trim() || !fields.customer.validity.valid) errors.customer = "请填写客户姓名，最多 40 个字符。";
    if (!fields.email.value.trim() || !fields.email.validity.valid) errors.email = "请填写有效的邮箱地址。";
    if (!products[fields.product.value]) errors.product = "请选择商品。";
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) errors.quantity = "数量须为 1–99 的整数。";
    if (!Number.isFinite(price) || price < 0.01 || price > 99999.99 || !fields.price.validity.valid) errors.price = "单价须为 0.01–99,999.99 元，最多两位小数。";
    var invalid = Object.keys(errors); if (invalid.length) { invalid.forEach(function (key) { fields[key].setAttribute("aria-invalid", "true"); document.getElementById("error-" + key).textContent = errors[key]; }); fields[invalid[0]].focus(); return; }
    var previous = copyOrders(state.orders); var now = new Date(); var date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-") + "T" + String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    var id = "CC-" + date.slice(5, 10).replace("-", "") + "-" + String(Date.now()).slice(-6); while (getOrder(id)) id += "1";
    state.orders.push({ id: id, customer: fields.customer.value.trim(), email: fields.email.value.trim(), product: products[fields.product.value].name, quantity: quantity, amount: Math.round(price * 100) * quantity, status: document.getElementById("new-status").value, date: date, note: "" });
    state.status = "all"; state.query = ""; state.sort = "newest"; state.page = 1; document.getElementById("order-search").value = ""; document.getElementById("order-sort").value = "newest";
    commit(previous, "演示订单 " + id + " 已创建。"); newDialog.close(); navigate("orders", false);
  });
  newDialog.addEventListener("close", function () { setDialogState(); if (state.newOpener && state.newOpener.isConnected) state.newOpener.focus(); else document.getElementById("new-order").focus(); state.newOpener = null; });
  [detailDialog, newDialog].forEach(function (dialog) { dialog.addEventListener("click", function (event) { if (event.target !== dialog) return; var rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); }); });

  function csvCell(value) { var text = String(value); if (/^\s*[=+@-]/.test(text) || /^[\t\r]/.test(text)) text = "'" + text; return '"' + text.replaceAll('"', '""') + '"'; }
  document.getElementById("export-orders").addEventListener("click", function () {
    var orders = matchingOrders(); if (!orders.length) { toast("当前筛选下没有可导出的订单。", false); return; }
    var rows = [["订单编号", "客户", "邮箱", "商品", "数量", "金额 CNY", "状态", "创建时间", "备注"]]; orders.forEach(function (order) { rows.push([order.id, order.customer, order.email, order.product, order.quantity, (order.amount / 100).toFixed(2), labels[order.status], order.date.replace("T", " "), order.note]); });
    var csv = "\ufeff" + rows.map(function (row) { return row.map(csvCell).join(","); }).join("\r\n"); var url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" })); var link = node("a"); link.href = url; link.download = "calmconsole-orders.csv"; document.body.append(link); link.click(); link.remove(); window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000); toast("已导出 " + orders.length + " 笔订单。", false);
  });
  document.getElementById("undo-action").addEventListener("click", function () { if (!state.undo) return; state.orders = copyOrders(state.undo); state.undo = null; state.selected.clear(); var saved = writeStorage(keys.orders, JSON.stringify(state.orders)); renderAll(); toast("已撤销上次修改。" + (saved ? "" : " 本次会话内有效。"), false); });
  document.getElementById("close-toast").addEventListener("click", function () { document.getElementById("toast").hidden = true; });

  function renderAll() { renderStats(); renderOrders(); renderCustomers(); }
  renderAll();
})();
