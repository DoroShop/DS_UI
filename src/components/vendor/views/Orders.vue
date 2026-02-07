<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from "vue";
import { formatToPHCurrency } from "../../../utils/currencyFormat";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  PrinterIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon,
  TruckIcon,
  XCircleIcon,
  EllipsisHorizontalCircleIcon,
  ChatBubbleLeftEllipsisIcon,
  PaperAirplaneIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  CreditCardIcon,
  ExclamationTriangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/vue/24/outline";
import {
  CheckCircleIcon as CheckCircleSolidIcon,
  TruckIcon as TruckSolidIcon,
  XCircleIcon as XCircleSolidIcon,
} from "@heroicons/vue/24/solid";
import type { Order, AgreementMessage } from "../../../types/order";
import { useOrdersStore, type OrderStatus } from "../../../stores/vendor/vendorOrderStore";
import socketManager from "../../../utils/socket";
import { useAuthStore } from "../../../stores/authStores";

const ordersStore = useOrdersStore();
const authStore = useAuthStore();

const expandedOrderIds = ref<Set<string>>(new Set());
const showFilters = ref(false);

const activeChatOrder = ref<Order | null>(null);
const messageDraft = ref("");
const isSendingMessage = ref(false);
const isSocketConnected = ref(false);

const orderErrors = ref(new Map<string, string>());
const orderLoading = ref(new Map<string, boolean>());

let onSocketConnect: ((...args: any[]) => void) | null = null;
let onSocketDisconnect: ((...args: any[]) => void) | null = null;
let onSocketConnectError: ((...args: any[]) => void) | null = null;
let onNewAgreementMessage: ((...args: any[]) => void) | null = null;

const statusKeys = ["all", "pending", "paid", "shipped", "delivered", "cancelled"] as const;
type StatusKey = typeof statusKeys[number];

const BRAND = "rgb(21, 30, 46)";

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

const safeText = (v: unknown) => (typeof v === "string" ? v : "");
const trimmed = (v: unknown) => safeText(v).trim();
const lower = (v: unknown) => safeText(v).toLowerCase();

const safeNumber = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const currency = (n: number | null | undefined) => formatToPHCurrency(safeNumber(n));

// Helper function to decode HTML entities like &amp; to &
const decodeHtmlEntities = (str: string) => {
  if (!str) return '';
  const textarea = document.createElement('textarea');
  textarea.innerHTML = str;
  return textarea.value;
};

const dateLabel = (iso: string | number | Date | null | undefined) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-PH", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const escapeHtml = (value: unknown) =>
  safeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const safeItems = (order: Partial<Order> | null | undefined) => (Array.isArray(order?.items) ? order.items : []);

const safeStatusLabel = (status: OrderStatus | string) =>
  ordersStore.statusMap?.[status as OrderStatus]?.label ?? safeText(status);

const safeStatusColor = (status: OrderStatus | string) =>
  ordersStore.statusMap?.[status as OrderStatus]?.color ?? "#475569";

const paymentStatusClass = (status: unknown) => lower(status);

const formatAddress = (addr: Order["shippingAddress"] | null | undefined) => {
  if (!addr) return "N/A";
  const parts = [addr.street, addr.barangay, addr.city, addr.province, addr.zipCode]
    .map((p) => trimmed(p))
    .filter(Boolean);
  return parts.length ? parts.join(", ") : "N/A";
};

const getStatusIcon = (status: StatusKey) =>
  ({
    all: ClipboardDocumentListIcon,
    pending: ClockIcon,
    paid: CreditCardIcon,
    shipped: TruckIcon,
    delivered: CheckCircleIcon,
    cancelled: XCircleIcon,
  } as const)[status];

const getStatusIconSolid = (status: StatusKey) =>
  ({
    all: ClipboardDocumentListIcon,
    pending: ClockIcon,
    paid: CreditCardIcon,
    shipped: TruckSolidIcon,
    delivered: CheckCircleSolidIcon,
    cancelled: XCircleSolidIcon,
  } as const)[status];

const isOrderExpanded = (id: string) => expandedOrderIds.value.has(id);

const toggleOrderExpand = (id: string) => {
  const next = new Set(expandedOrderIds.value);
  next.has(id) ? next.delete(id) : next.add(id);
  expandedOrderIds.value = next;
};

const resetExpanded = () => {
  expandedOrderIds.value = new Set();
};

const onStatusTabClick = (key: StatusKey) => {
  ordersStore.setActiveStatus(key);
  ordersStore.setPage(1);
  resetExpanded();
};

const onTabKey = (e: KeyboardEvent) => {
  const idx = statusKeys.indexOf(ordersStore.activeStatus as StatusKey);
  if (idx === -1) return;

  const navKeys = ["ArrowRight", "ArrowLeft", "Home", "End"];
  if (!navKeys.includes(e.key)) return;

  e.preventDefault();

  let nextIdx = idx;
  if (e.key === "ArrowRight") nextIdx = (idx + 1) % statusKeys.length;
  if (e.key === "ArrowLeft") nextIdx = (idx - 1 + statusKeys.length) % statusKeys.length;
  if (e.key === "Home") nextIdx = 0;
  if (e.key === "End") nextIdx = statusKeys.length - 1;

  onStatusTabClick(statusKeys[nextIdx]);

  nextTick(() => {
    const el = document.querySelectorAll<HTMLButtonElement>(".status-tabs button")[nextIdx];
    el?.focus();
  });
};

const onPaginationKey = (e: KeyboardEvent, action: "prev" | "next") => {
  if (e.key !== "Enter" && e.key !== " ") return;
  e.preventDefault();

  if (action === "prev" && ordersStore.page > 1) ordersStore.prevPage();
  if (action === "next" && ordersStore.page < ordersStore.pageCount) ordersStore.nextPage();
};

const expandEnter = (el: Element) => {
  const element = el as HTMLElement;
  element.style.height = "0";
  element.style.opacity = "0";
  requestAnimationFrame(() => {
    element.style.transition = "height .35s ease, opacity .3s ease";
    element.style.height = element.scrollHeight + "px";
    element.style.opacity = "1";
  });
};

const expandAfterEnter = (el: Element) => {
  (el as HTMLElement).style.height = "auto";
};

const expandLeave = (el: Element) => {
  const element = el as HTMLElement;
  element.style.height = element.scrollHeight + "px";
  element.style.opacity = "1";
  requestAnimationFrame(() => {
    element.style.transition = "height .3s ease, opacity .25s ease";
    element.style.height = "0";
    element.style.opacity = "0";
  });
};

const scrollChatToBottom = () => {
  const chatHistory = document.querySelector<HTMLElement>(".chat-history");
  if (chatHistory) chatHistory.scrollTop = chatHistory.scrollHeight;
};

watch(
  () => activeChatOrder.value?.agreementMessages,
  async () => {
    await nextTick();
    scrollChatToBottom();
  },
  { deep: true, flush: "post" }
);

const queryKey = computed(() =>
  [
    trimmed(ordersStore.search),
    ordersStore.activeStatus,
    ordersStore.filterPaymentMethod,
    ordersStore.filterPaymentStatus,
    ordersStore.filterDateFrom,
    ordersStore.filterDateTo,
    ordersStore.page,
    ordersStore.pageSize,
    ordersStore.sortDir,
  ].join("|")
);

const searchTimer = ref<number | null>(null);

watch(
  () => ordersStore.search,
  () => {
    if (searchTimer.value) window.clearTimeout(searchTimer.value);
    searchTimer.value = window.setTimeout(() => {
      ordersStore.setPage(1);
      ordersStore.fetchOrders();
    }, 350);
  }
);

watch(
  queryKey,
  async (next, prev) => {
    if (next === prev) return;
    await ordersStore.fetchOrders();
  },
  { flush: "post" }
);

const connectSocket = async () => {
  if (socketManager.isConnected()) return;

  if (!authStore.token) {
    try {
      await authStore.fetchSession();
    } catch {}
  }

  const token = authStore.token;
  if (!token) return;

  socketManager.connect(token);

  onSocketConnect = () => {
    isSocketConnected.value = true;
  };

  onSocketDisconnect = () => {
    isSocketConnected.value = false;
  };

  onSocketConnectError = () => {
    isSocketConnected.value = false;
  };

  onNewAgreementMessage = (data: { orderId: string; message: AgreementMessage }) => {
    const idx = ordersStore.orders.findIndex((o) => o._id === data.orderId);
    if (idx === -1) return;

    const order = ordersStore.orders[idx];
    const list = Array.isArray(order.agreementMessages) ? order.agreementMessages : [];
    const exists = list.some(
      (m) => m.timestamp === data.message.timestamp && m.message === data.message.message && m.sender === data.message.sender
    );
    if (!exists) order.agreementMessages = [...list, data.message];

    if (activeChatOrder.value?._id === data.orderId) {
      const chatList = Array.isArray(activeChatOrder.value.agreementMessages) ? activeChatOrder.value.agreementMessages : [];
      const chatExists = chatList.some(
        (m) => m.timestamp === data.message.timestamp && m.message === data.message.message && m.sender === data.message.sender
      );
      if (!chatExists) activeChatOrder.value.agreementMessages = [...chatList, data.message];
    }
  };

  socketManager.on("connect", onSocketConnect);
  socketManager.on("disconnect", onSocketDisconnect);
  socketManager.on("connect_error", onSocketConnectError);
  socketManager.on("new_agreement_message", onNewAgreementMessage);
};

const disconnectSocketHandlers = () => {
  if (onNewAgreementMessage) socketManager.off("new_agreement_message", onNewAgreementMessage);
  if (onSocketConnect) socketManager.off("connect", onSocketConnect);
  if (onSocketDisconnect) socketManager.off("disconnect", onSocketDisconnect);
  if (onSocketConnectError) socketManager.off("connect_error", onSocketConnectError);
};

const openAgreementChat = async (order: Order) => {
  const fullOrder = await ordersStore.fetchSingleOrder(order._id);
  if (!fullOrder) return;

  activeChatOrder.value = {
    ...fullOrder,
    agreementMessages: Array.isArray(fullOrder.agreementMessages) ? fullOrder.agreementMessages : [],
    items: safeItems(fullOrder),
  } as Order;

  if (socketManager.isConnected()) socketManager.emit("join_order", order._id);

  await nextTick();
  scrollChatToBottom();
};

const closeAgreementModal = () => {
  if (socketManager.isConnected() && activeChatOrder.value) socketManager.emit("leave_order", activeChatOrder.value._id);
  activeChatOrder.value = null;
  messageDraft.value = "";
};

const sendAgreementMessage = async () => {
  const orderId = activeChatOrder.value?._id;
  const message = trimmed(messageDraft.value);

  if (!orderId || !message || isSendingMessage.value || !isSocketConnected.value) return;

  isSendingMessage.value = true;
  messageDraft.value = "";

  try {
    await ordersStore.addAgreementMessage(orderId, message);
    await nextTick();
    scrollChatToBottom();
  } catch {
    messageDraft.value = message;
  } finally {
    isSendingMessage.value = false;
  }
};

const onMessageKeyDown = (e: KeyboardEvent) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendAgreementMessage();
  }
};

const resetFilters = () => ordersStore.resetFilters();

const onSearchInput = (e: Event) => {
  const input = e.target as HTMLInputElement | null;
  ordersStore.setSearch(input?.value ?? "");
};

const setOrderBusy = (id: string, busy: boolean) => {
  const map = new Map(orderLoading.value);
  busy ? map.set(id, true) : map.delete(id);
  orderLoading.value = map;
};

const setOrderError = (id: string, message: string | null) => {
  const map = new Map(orderErrors.value);
  message ? map.set(id, message) : map.delete(id);
  orderErrors.value = map;
};

const getErrorMessage = (err: any): string => {
  const apiError = err?.response?.data?.error;
  if (apiError) {
    const base = apiError.message || "Validation failed";
    const details = Array.isArray(apiError.details) ? apiError.details : [];
    return details.length ? `${base}: ${details.join(", ")}` : base;
  }
  return err?.message || "An error occurred";
};

const updateOrderStatus = async (order: Order, next: OrderStatus) => {
  setOrderError(order._id, null);
  setOrderBusy(order._id, true);

  try {
    await ordersStore.updateOrderStatus(order._id, next);
  } catch (err) {
    setOrderError(order._id, getErrorMessage(err));
  } finally {
    setOrderBusy(order._id, false);
  }
};

const shipOrder = (order: Order) => updateOrderStatus(order, "shipped");

const actionStatuses = (order: Order): OrderStatus[] => {
  let next = ordersStore.allowedStatusTransitions(order) as OrderStatus[];
  if (order.paymentMethod === "cod") next = next.filter((s) => s !== "paid");
  next = next.filter((s) => s !== "shipped");
  return next;
};

const buildReceiptHTML = (order: Order) => {
  const address = formatAddress(order.shippingAddress);

  const rows = safeItems(order)
    .map(
      (it) => `
        <tr>
          <td class="item">${escapeHtml(it.name)} <br/> ${escapeHtml(it.label)}</td>
          <td class="qty">${safeNumber(it.quantity)}</td>
          <td class="prc">${currency(it.price)}</td>
          <td class="ln">${currency(safeNumber(it.price) * safeNumber(it.quantity))}</td>
        </tr>`
    )
    .join("");

  const paymentMethod = order.paymentMethod ? safeText(order.paymentMethod).toUpperCase() : "-";
  const paymentStatus = safeText(order.paymentStatus) || "-";
  const tracking = safeText(order.trackingNumber) || "-";

  return `
  <section class="receipt">
    <header class="rh">
      <div class="brand">
        <div class="logo">DS</div>
        <div class="b-meta">
          <h1>DoroShop</h1>
          <p class="tag">Local Products</p>
        </div>
      </div>
      <div class="info">
        <div><span>Date:</span><strong>${dateLabel(order.createdAt)}</strong></div>
        <div><span>Status:</span><strong>${escapeHtml(safeStatusLabel(order.status))}</strong></div>
        <div><span>Payment:</span><strong>${escapeHtml(paymentMethod)} (${escapeHtml(paymentStatus)})</strong></div>
        <div><span>Tracking:</span><strong>${escapeHtml(tracking)}</strong></div>
      </div>
    </header>
    <div class="divider"></div>
    <div class="customer">
      <p class="c-head">Customer</p>
      <p class="c-name">${escapeHtml(order.name)}</p>
      <p class="c-addr">${escapeHtml(address)}</p>
    </div>
    <table class="items">
      <thead>
        <tr>
          <th class="item">Item</th>
          <th class="qty">Qty</th>
          <th class="prc">Price</th>
          <th class="ln">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="3" class="foot-lbl">Shippping Fee</td>
          <td class="foot-val">${currency(order.shippingFee)}</td>
        </tr>
        <tr>
          <td colspan="3" class="foot-lbl">Subtotal</td>
          <td class="foot-val">${currency(safeNumber(order.subTotal) + safeNumber(order.shippingFee))}</td>
        </tr>
      </tfoot>
    </table>
    <div class="thanks">Thank you for supporting local sellers!</div>
  </section>`;
};

const printScaffold = (content: string, title: string) => `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
:root {
  --brand:${BRAND};
  --bg:#ffffff;
  --text:#1f2937;
  --muted:#64748b;
  --border:#e2e8f0;
  --radius:16px;
}
* { box-sizing:border-box; }
body {
  margin:0;
  font-family: system-ui,-apple-system,Inter,Roboto,Arial,sans-serif;
  background:#f1f5f9;
  padding:24px;
  color:var(--text);
}
.receipt {
  background:var(--bg);
  border:1px solid var(--border);
  border-radius:var(--radius);
  padding:22px 24px 28px;
  max-width:680px;
  margin:0 auto 40px;
  box-shadow:0 6px 28px -4px rgba(0,0,0,.12);
  page-break-inside: avoid;
}
.rh {
  display:flex; flex-wrap:wrap; gap:24px;
  justify-content:space-between; align-items:flex-start;
}
.brand { display:flex; gap:14px; align-items:center; }
.logo {
  width:64px; height:64px;
  background:linear-gradient(135deg,var(--brand) 0%, #2b3f59 100%);
  border-radius:18px;
  display:flex; align-items:center; justify-content:center;
  font-weight:700; font-size:22px; letter-spacing:.5px;
  color:#fff; box-shadow:0 6px 18px -4px rgba(0,0,0,.35);
}
.b-meta h1 {
  margin:0; font-size:22px; font-weight:700; color:var(--brand);
  letter-spacing:.75px;
}
.b-meta .tag {
  margin:4px 0 0; font-size:12px; text-transform:uppercase;
  letter-spacing:1px; font-weight:600; color:var(--muted);
}
.info { display:grid; gap:6px; font-size:13px; min-width:220px; }
.info span { color:var(--muted); font-weight:600; margin-right:6px; display:inline-block; min-width:60px; }
.divider {
  height:1px;
  background:linear-gradient(90deg,transparent,var(--border),transparent);
  margin:22px 0 16px;
}
.customer { margin-bottom:12px; }
.c-head {
  margin:0 0 2px; font-size:11px; font-weight:700;
  text-transform:uppercase; letter-spacing:1px; color:var(--muted);
}
.c-name { margin:0 0 4px; font-weight:600; }
.c-addr { margin:0; font-size:13px; line-height:1.45; }
table.items {
  width:100%; border-collapse:collapse; margin-top:4px;
  overflow:hidden; border:1px solid var(--border); border-radius:12px;
}
table.items thead th {
  background:var(--brand); color:#fff; font-weight:600; font-size:12px;
  letter-spacing:.5px; padding:10px 12px; text-align:left;
}
table.items tbody td {
  padding:10px 12px; border-top:1px solid var(--border);
  font-size:13px; vertical-align:middle;
}
table.items tfoot td {
  padding:12px 12px; border-top:1px solid var(--border);
  font-size:13px; font-weight:600; background:#f8fafc;
}
.qty,.prc,.ln,.foot-val { text-align:right; white-space:nowrap; }
.foot-lbl { text-align:right; }
.thanks {
  margin-top:30px; font-size:12px; text-align:center;
  color:var(--muted); letter-spacing:.5px;
}
.page-break { page-break-after:always; }
@media print {
  body { background:#fff; padding:10px; }
  .receipt { box-shadow:none; margin:0 auto 24px; }
}
</style>
</head>
<body>${content}</body>
</html>`;

const printUsingIframe = (html: string, title: string) => {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.opacity = "0";
  iframe.setAttribute("sandbox", "allow-modals allow-same-origin allow-scripts");
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(printScaffold(html, title));
  doc.close();

  const cleanup = () => setTimeout(() => iframe.remove(), 500);

  const triggerPrint = () => {
    const win = iframe.contentWindow!;
    const imgs = Array.from(doc.images);
    const pending = imgs.filter((i) => !i.complete);

    const doPrint = () => {
      setTimeout(() => {
        win.focus();
        win.print();
        cleanup();
      }, 60);
    };

    if (!pending.length) return doPrint();

    let done = 0;
    const doneOne = () => {
      done++;
      if (done === pending.length) doPrint();
    };

    pending.forEach((img) => {
      img.addEventListener("load", doneOne, { once: true });
      img.addEventListener("error", doneOne, { once: true });
    });
  };

  if (doc.readyState === "complete") triggerPrint();
  else iframe.addEventListener("load", triggerPrint, { once: true });
};

const printSingle = (order: Order) => {
  if (!ordersStore.canPrint(order)) return;
  printUsingIframe(buildReceiptHTML(order), `Receipt ${safeText(order.orderId)}`);
};

const printVisible = () => {
  if (!ordersStore.hasPrintable) return;
  const html = ordersStore.printablePaged.map(buildReceiptHTML).join('<div class="page-break"></div>');
  printUsingIframe(html, "Batch Receipts");
};

onMounted(async () => {
  await ordersStore.ensureOrders().catch(() => {});
  await connectSocket();
});

onUnmounted(() => {
  if (activeChatOrder.value) socketManager.emit("leave_order", activeChatOrder.value._id);
  disconnectSocketHandlers();
});
</script>


<template>
  <div class="order-cards-page">
    <a href="#main-content" class="skip-link">Skip to main content</a>

    <transition name="fade">
      <div v-if="activeChatOrder" class="agreement-modal-overlay" @click="closeAgreementModal">
        <div class="agreement-modal-container" @click.stop>
          <div class="agreement-modal-header">
            <div class="chat-header-info">
              <h3>Agreement Chat</h3>
              <div class="connection-status">
                <span v-if="isSocketConnected" class="status-indicator connected">●</span>
                <span v-else class="status-indicator disconnected">●</span>
                <span class="status-text">{{ isSocketConnected ? "Connected" : "Reconnecting..." }}</span>
              </div>
            </div>
            <button @click="closeAgreementModal" class="modal-close-btn">&times;</button>
          </div>

          <div class="chat-history">
            <div v-if="activeChatOrder.agreementDetails" class="message-bubble customer initial">
              <p class="msg-text">{{ activeChatOrder.agreementDetails }}</p>
              <span class="msg-meta">Initial Note</span>
            </div>

            <div
              v-for="(msg, index) in (activeChatOrder.agreementMessages || [])"
              :key="index"
              :class="['message-bubble', msg.sender]"
            >
              <p class="msg-text">{{ msg.message }}</p>
              <span class="msg-meta">{{ dateLabel(msg.timestamp) }}</span>
            </div>

            <div
              v-if="!activeChatOrder.agreementDetails && (!activeChatOrder.agreementMessages || activeChatOrder.agreementMessages.length === 0)"
              class="empty-chat enhanced-empty-chat"
            >
              <div class="empty-icon-wrapper">
                <ChatBubbleLeftEllipsisIcon class="empty-icon" />
                <div class="icon-glow"></div>
              </div>
              <div class="empty-content">
                <h3>No messages yet</h3>
                <p>Start the conversation with your customer to discuss shipping details</p>
              </div>
            </div>
          </div>

          <div class="chat-input-area">
            <textarea
              v-model="messageDraft"
              placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
              @keydown="onMessageKeyDown"
              :disabled="isSendingMessage || !isSocketConnected"
            ></textarea>

            <button
              @click="sendAgreementMessage"
              class="btn-send enhanced-send-btn"
              :disabled="isSendingMessage || !messageDraft.trim() || !isSocketConnected"
              :class="{ sending: isSendingMessage }"
              title="Send message"
            >
              <div v-if="isSendingMessage" class="loading-dots">
                <span></span><span></span><span></span>
              </div>
              <PaperAirplaneIcon v-else class="icon mini send-icon" />
            </button>
          </div>
        </div>
      </div>
    </transition>

    <header class="page-header">
      <div class="header-content">
        <h1 class="page-title">
          <ClipboardDocumentListIcon class="title-icon" />
          Orders Management
        </h1>
        <p class="page-subtitle">Track and manage your customer orders</p>
      </div>
    </header>

    <div class="status-tabs enhanced-nav" role="tablist" aria-label="Order status filter" @keydown="onTabKey">
      <button
        v-for="key in statusKeys"
        :key="key"
        role="tab"
        type="button"
        :aria-selected="ordersStore.activeStatus === key"
        :tabindex="ordersStore.activeStatus === key ? 0 : -1"
        :class="['status-chip', { active: ordersStore.activeStatus === key }]"
        @click="onStatusTabClick(key as any)"
      >
        <component :is="ordersStore.activeStatus === key ? getStatusIconSolid(key) : getStatusIcon(key)" class="status-icon" />
        <span class="lbl">{{ key === "all" ? "All Orders" : safeStatusLabel(key as any) }}</span>
        <span class="count order-status-count">{{ ordersStore.statusCountsDisplay[key] || 0 }}</span>
      </button>
    </div>

    <main id="main-content">
      <div class="controls">
        <div class="search-box">
          <MagnifyingGlassIcon class="icon" />
          <input
            v-model="ordersStore.search"
            type="search"
            placeholder="Search by order ID, customer name, or tracking number..."
            @input="onSearchInput"
          />
        </div>

        <div class="right-actions">
          <div class="page-size-selector">
            <label for="page-size" class="sr-only">Orders per page</label>
            <select id="page-size" v-model="ordersStore.pageSize" class="page-size-select">
              <option :value="6">6 per page</option>
              <option :value="12">12 per page</option>
              <option :value="24">24 per page</option>
              <option :value="50">50 per page</option>
            </select>
          </div>

          <button class="btn outline small" type="button" :disabled="!ordersStore.hasPrintable" @click="printVisible">
            <PrinterIcon class="icon mini" /> Print Visible
          </button>

          <button class="btn ghost small" type="button" @click="ordersStore.setSortDir(ordersStore.sortDir === 'asc' ? 'desc' : 'asc')">
            <ArrowPathIcon class="icon flip" />
            {{ ordersStore.sortDir === "asc" ? "Oldest" : "Newest" }}
          </button>

          <button class="btn ghost small" type="button" @click="showFilters = !showFilters" :aria-expanded="showFilters">
            <FunnelIcon class="icon" />
            Filters
          </button>
        </div>
      </div>

      <transition name="fade">
        <div v-if="showFilters" class="filters-panel">
          <div class="filters-grid">
            <div class="filter-group">
              <label>Date From</label>
              <input type="date" v-model="ordersStore.filterDateFrom" @change="ordersStore.setFilters({ dateFrom: ordersStore.filterDateFrom })" />
            </div>
            <div class="filter-group">
              <label>Date To</label>
              <input type="date" v-model="ordersStore.filterDateTo" @change="ordersStore.setFilters({ dateTo: ordersStore.filterDateTo })" />
            </div>
            <div class="filter-group">
              <label>Payment Method</label>
              <select v-model="ordersStore.filterPaymentMethod" @change="ordersStore.setFilters({ paymentMethod: ordersStore.filterPaymentMethod })">
                <option value="all">All</option>
                <option value="wallet">Wallet</option>
                <option value="gcash">GCash</option>
                <option value="cod">COD</option>
              </select>
            </div>
            <div class="filter-group">
              <label>Payment Status</label>
              <select v-model="ordersStore.filterPaymentStatus" @change="ordersStore.setFilters({ paymentStatus: ordersStore.filterPaymentStatus })">
                <option value="all">All</option>
                <option value="Pending">Pending</option>
                <option value="Paid">Paid</option>
                <option value="Refunded">Refunded</option>
                <option value="Failed">Failed</option>
              </select>
            </div>
          </div>

          <div class="filters-actions">
            <button class="btn tiny outline" type="button" @click="resetFilters">Reset Filters</button>
          </div>
        </div>
      </transition>

      <div class="summary">
        <span>{{ ordersStore.orders.length }} result<span v-if="ordersStore.orders.length !== 1">s</span></span>
        <span class="divider">|</span>
        <span>Page {{ ordersStore.page }} / {{ ordersStore.pageCount }}</span>
      </div>

      <div class="cards-grid">
        <div v-if="ordersStore.loading" class="loading-skeleton" v-for="n in 6" :key="'skel_' + n"></div>

        <template v-else>
          <div v-for="order in ordersStore.paged" :key="order._id" :class="['order-card', { updating: ordersStore.isUpdating(order._id) }]">
            <header class="card-head">
              <div class="left">
                <h2 class="oid">{{ order.orderId }}</h2>
                <p class="created">{{ dateLabel(order.updatedAt || Date.now()) }}</p>
              </div>
              <div class="right">
                <span class="status-pill" :style="{ '--pill': safeStatusColor(order.status) }">{{ safeStatusLabel(order.status) }}</span>
              </div>
            </header>

            <div class="info-line">
              <span class="lbl">Customer:</span>
              <span class="val">{{ order.name }}</span>
            </div>

            <div class="info-line">
              <span class="lbl">Shipping Fee:</span>
              <span class="val strong">{{ currency(order.shippingFee) }}</span>
            </div>

            <div class="info-line">
              <span class="lbl">Shipping Mode:</span>
              <span class="val strong">
                {{ decodeHtmlEntities(order.shippingOption || '') }}
                <button
                  v-if="order.shippingOption === 'agreement'"
                  class="btn-icon chat-btn"
                  @click="openAgreementChat(order)"
                  title="Open chat"
                >
                  <ChatBubbleLeftEllipsisIcon class="icon mini" />
                  <span class="btn-tooltip">Chat</span>
                </button>
              </span>
            </div>

            <div class="info-line">
              <span class="lbl">Subtotal:</span>
              <span class="val strong">{{ currency(safeNumber(order.subTotal) + safeNumber(order.shippingFee)) }}</span>
            </div>

            <div class="info-line wrap">
              <span class="lbl">Payment:</span>
              <span class="val">
                {{ order.paymentMethod ? String(order.paymentMethod).toUpperCase() : "-" }}
                <span class="pay-badge" :class="paymentStatusClass(order.paymentStatus)">
                  {{ order.paymentStatus }}
                </span>
              </span>
            </div>

            <div v-if="order.trackingNumber" class="info-line">
              <span class="lbl">Tracking:</span>
              <span class="val mono">{{ order.trackingNumber }}</span>
            </div>

            <button class="expand-btn" type="button" @click="toggleOrderExpand(order._id)" :aria-expanded="isOrderExpanded(order._id)">
              <span>{{ isOrderExpanded(order._id) ? "Hide Items" : `Show Items (${safeItems(order).length})` }}</span>
              <ChevronDownIcon v-if="!isOrderExpanded(order._id)" class="icon mini" />
              <ChevronUpIcon v-else class="icon mini" />
            </button>

            <transition @enter="expandEnter" @after-enter="expandAfterEnter" @leave="expandLeave">
              <div v-show="isOrderExpanded(order._id)" class="items-wrapper">
                <ul class="items-list">
                  <li v-for="it in safeItems(order)" :key="it._id" class="item-row">
                    <img :src="it.imgUrl || 'https://via.placeholder.com/80x60?text=No+Img'" alt="" class="thumb" />
                    <div class="it-meta">
                      <p class="it-name">{{ it.name }}</p>
                      <p class="it-label">{{ it.label }}</p>
                      <p class="it-sub muted">{{ it.quantity }} × {{ currency(it.price) }}</p>
                    </div>
                    <div class="it-total">{{ currency(safeNumber(it.price) * safeNumber(it.quantity)) }}</div>
                  </li>
                </ul>

                <div v-if="order.shippingAddress" class="ship-block">
                  <p class="ship-title">Ship To</p>
                  <p class="ship-addr">{{ formatAddress(order.shippingAddress) }}</p>
                </div>
              </div>
            </transition>

            <div class="actions">
              <button
                v-if="order.status === 'pending'"
                class="btn tiny outline"
                type="button"
                :disabled="ordersStore.isUpdating(order._id) || orderLoading.has(order._id)"
                @click="shipOrder(order)"
              >
                <TruckIcon class="icon mini" />
                Ship
              </button>

              <button
                v-for="next in actionStatuses(order)"
                :key="next"
                class="btn tiny outline"
                type="button"
                :disabled="ordersStore.isUpdating(order._id) || orderLoading.has(order._id)"
                @click="updateOrderStatus(order, next)"
              >
                <component
                  :is="next === 'paid' ? CheckCircleIcon : next === 'delivered' ? CheckCircleIcon : XCircleIcon"
                  class="icon mini"
                />
                <span class="capitalize">{{ safeStatusLabel(next) }}</span>
              </button>

              <button
                v-if="order.status !== 'cancelled' && order.status !== 'delivered' && order.status !== 'shipped'"
                class="btn tiny danger outline"
                type="button"
                :disabled="ordersStore.isUpdating(order._id) || orderLoading.has(order._id)"
                @click="updateOrderStatus(order, 'cancelled')"
              >
                <XCircleIcon class="icon mini" /> Cancel
              </button>

              <button
                v-if="ordersStore.canPrint(order)"
                class="btn tiny"
                type="button"
                :disabled="ordersStore.isUpdating(order._id) || orderLoading.has(order._id)"
                @click="printSingle(order)"
              >
                <PrinterIcon class="icon mini" /> Receipt
              </button>
            </div>

            <div v-if="orderLoading.has(order._id)" class="loading-indicator">
              <ArrowPathIcon class="icon mini spinning" />
              Updating order status...
            </div>

            <div v-if="orderErrors.has(order._id)" class="error-display">
              <ExclamationTriangleIcon class="icon mini" />
              <div class="error-details">
                <p class="error-message">{{ orderErrors.get(order._id) }}</p>
              </div>
              <button class="btn tiny ghost" @click="setOrderError(order._id, null)">×</button>
            </div>
          </div>

          <div v-if="!ordersStore.paged.length" class="empty-state">
            <EllipsisHorizontalCircleIcon class="icon large" />
            <p>No orders found.</p>
          </div>
        </template>
      </div>

      <nav class="pagination enhanced-pagination" v-if="ordersStore.pageCount > 1" role="navigation" aria-label="Orders pagination">
        <button
          class="btn tiny outline pagination-btn"
          type="button"
          :disabled="ordersStore.page === 1"
          @click="ordersStore.prevPage"
          @keydown="onPaginationKey($event, 'prev')"
          :aria-label="`Go to previous page, currently on page ${ordersStore.page}`"
        >
          <ChevronLeftIcon class="icon mini" /> Prev
        </button>

        <div class="pagination-info" role="status" aria-live="polite">
          <ClipboardDocumentListIcon class="page-icon" />
          <span class="pager-label">
            Page {{ ordersStore.page }} of {{ ordersStore.pageCount }}
            <span class="total-count">({{ ordersStore.total }} orders)</span>
          </span>
        </div>

        <button
          class="btn tiny outline pagination-btn"
          type="button"
          :disabled="ordersStore.page === ordersStore.pageCount"
          @click="ordersStore.nextPage"
          @keydown="onPaginationKey($event, 'next')"
          :aria-label="`Go to next page, currently on page ${ordersStore.page}`"
        >
          Next <ChevronRightIcon class="icon mini" />
        </button>
      </nav>
    </main>
  </div>
</template>


<style scoped>
/* Skip Link */
.skip-link {
  position: absolute;
  top: -40px;
  left: 6px;
  background: var(--surface);
  color: var(--text-primary);
  padding: 8px 12px;
  text-decoration: none;
  border-radius: var(--radius-sm);
  z-index: 1000;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.3s ease;
  border: 1px solid var(--border-primary);
}

.skip-link:focus {
  top: 6px;
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Layout & background */
.order-cards-page {
  min-height: 100dvh;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: clamp(1rem, 3vw, 2rem);
  position: relative;
  background: transparent;
  color: var(--text-primary);
  padding-bottom: 10rem;
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ============================================
   PAGE HEADER
   ============================================ */
.page-header {
  padding: 0.5rem 0 1.5rem;
  animation: slideDown 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.page-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0;
  font-size: 2rem;
  font-weight: 800;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.02em;
}

.title-icon {
  width: 2rem;
  height: 2rem;
  color: var(--color-primary);
  flex-shrink: 0;
}

.page-subtitle {
  margin: 0;
  font-size: 0.95rem;
  color: var(--text-secondary);
  font-weight: 500;
  padding-left: 2.75rem;
}

.status-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: .55rem;
  padding: .4rem;
  background: var(--surface);
  backdrop-filter: blur(6px);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-xl);
  box-shadow: var(--card-shadow);
}

.status-chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: 2px solid var(--border-primary);
  border-radius: 50px;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.status-chip:hover {
  background: var(--surface-hover);
  border-color: #1f8b4e;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(31, 139, 78, 0.15);
}

.status-chip.active {
  background: linear-gradient(135deg, #1f8b4e 0%, #26a65b 100%);
  color: white;
  border-color: #1f8b4e;
  box-shadow: 0 4px 12px rgba(31, 139, 78, 0.3);
  transform: translateY(-2px);
}

.status-chip .count {
  font-size: .65rem;
  background: var(--bg-primary);
  color: var(--text-primary);
  padding: 2px 7px;
  border-radius: var(--radius-full);
  font-weight: 700;
  line-height: 1;
}

.status-chip .count.loading {
  opacity: 0.6;
  animation: pulse 1.5s ease-in-out infinite;
}

.status-chip.active .count {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: .8rem;
  align-items: center;
  justify-content: space-between;
}

.search-box {
  flex: 1 1 260px;
  display: flex;
  align-items: center;
  gap: .55rem;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  padding: .65rem .85rem;
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
}

.search-box:focus-within {
  border-color: var(--input-border-focus);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.search-box .icon {
  width: 18px;
  height: 18px;
  stroke-width: 2;
  color: var(--text-tertiary);
}

.search-box input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font: inherit;
  font-size: .88rem;
}

.search-box input::placeholder {
  color: var(--text-tertiary);
}

.right-actions {
  display: flex;
  gap: .5rem;
  flex-wrap: wrap;
}

.page-size-selector {
  display: flex;
  align-items: center;
  gap: .25rem;
}

.page-size-select {
  padding: .25rem .5rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-primary);
  font-size: .75rem;
  min-width: 100px;
}

.page-size-select:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.filters-panel {
  padding: .9rem 1rem;
  background: var(--surface);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  font-size: .75rem;
  display: flex;
  flex-direction: column;
  gap: .75rem;
  box-shadow: var(--card-shadow);
}

.filters-grid {
  display: grid;
  gap: .75rem;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: .35rem;
}

.filter-group label {
  font-size: .55rem;
  text-transform: uppercase;
  letter-spacing: .5px;
  font-weight: 600;
  color: var(--text-tertiary);
}

.filter-group input,
.filter-group select {
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  padding: .4rem .5rem;
  border-radius: var(--radius-sm);
  font-size: .65rem;
  color: var(--text-primary);
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s ease;
}

.filter-group input:focus,
.filter-group select:focus {
  border-color: var(--input-border-focus);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.filters-actions {
  display: flex;
  justify-content: flex-end;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity .25s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.summary {
  font-size: .7rem;
  display: flex;
  gap: .7rem;
  align-items: center;
  letter-spacing: .5px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  font-weight: 600;
}

.summary .divider {
  opacity: .35;
}

.cards-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
  align-items: start;
}

.loading-skeleton {
  height: 230px;
  border-radius: var(--radius-xl);
  background: linear-gradient(110deg, var(--bg-secondary) 25%, var(--surface-hover) 35%, var(--bg-secondary) 55%);
  background-size: 200% 100%;
  animation: shimmer 1.5s linear infinite;
}

@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
}

.order-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: var(--surface);
  border: 1px solid var(--border-primary);
  border-radius: 16px;
  padding: 1.25rem;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(31, 139, 78, 0.08);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.order-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #1f8b4e 0%, transparent 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.order-card:hover {
  border-color: rgba(31, 139, 78, 0.3);
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(31, 139, 78, 0.15);
}

.order-card:hover::before {
  opacity: 1;
}

.order-card.updating {
  opacity: 0.55;
  pointer-events: none;
}

.card-head {
  display: flex;
  justify-content: space-between;
  gap: .65rem;
}

.card-head .oid {
  margin: 0;
  font-size: .95rem;
  font-weight: 700;
  letter-spacing: .5px;
  color: var(--text-primary);
}

.card-head .created {
  margin: .25rem 0 0;
  font-size: .65rem;
  color: var(--text-tertiary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  letter-spacing: .4px;
}

.status-pill {
  display: inline-block;
  font-size: .55rem;
  font-weight: 700;
  letter-spacing: .6px;
  text-transform: uppercase;
  padding: .35rem .55rem;
  border-radius: 1rem;
  background: var(--pill);
  color: #fff;
  box-shadow: 0 2px 6px -2px rgba(0, 0, 0, .4);
  white-space: nowrap;
  align-self: flex-start;
}

.info-line {
  display: flex;
  justify-content: space-between;
  font-size: .7rem;
  gap: .75rem;
  color: var(--text-primary);
  line-height: 1.25;
}

.info-line.wrap {
  flex-wrap: wrap;
}

.info-line .lbl {
  font-weight: 600;
  font-size: .65rem;
  color: var(--text-tertiary);
  letter-spacing: .4px;
  text-transform: uppercase;
}

.info-line .val {
  flex: 1;
  text-align: right;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.5rem;
}

.info-line .val.strong {
  font-weight: 700;
  color: var(--text-primary);
}

.mono {
  font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
}

.pay-badge {
  margin-left: .45rem;
  font-size: .55rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .5px;
  padding: 3px 6px;
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border-primary);
}

.pay-badge.paid {
  background: var(--color-success);
  color: white;
  border-color: var(--color-success);
  box-shadow: 0 0 0 2px var(--color-success-light);
}

.pay-badge.pending {
  background: var(--color-warning);
  color: white;
  border-color: var(--color-warning);
  box-shadow: 0 0 0 2px var(--color-warning-light);
}

.pay-badge.refunded {
  background: var(--color-info);
  color: white;
  border-color: var(--color-info);
  box-shadow: 0 0 0 2px var(--color-info-light);
}

.pay-badge.failed {
  background: var(--color-danger);
  color: white;
  border-color: var(--color-danger);
  box-shadow: 0 0 0 2px var(--color-danger-light);
}

.expand-btn {
  margin-top: .25rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  padding: .55rem .7rem;
  border-radius: var(--radius-md);
  font: inherit;
  font-size: .65rem;
  letter-spacing: .6px;
  text-transform: uppercase;
  font-weight: 600;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.expand-btn:hover {
  background: var(--surface-hover);
  border-color: var(--color-primary);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: .5rem;
  transition: background .3s, border-color .3s;
}

.expand-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(255, 255, 255, 0.3);
}

.items-wrapper {
  overflow: hidden;
  margin-top: .4rem;
}

.items-list {
  list-style: none;
  margin: 0 0 .8rem;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: .6rem;
}

.item-row {
  display: flex;
  gap: .7rem;
  align-items: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: .75rem;
  padding: .55rem .65rem;
}

.thumb {
  width: 70px;
  height: 52px;
  object-fit: cover;
  border-radius: .55rem;
  background: #334155;
  flex-shrink: 0;
}

.it-meta {
  flex: 1 1 auto;
}

.it-name, .it-label {
  margin: 0 0 2px;
  font-size: .7rem;
  font-weight: 600;
  letter-spacing: .25px;
  color: var(--text-primary);
}

.it-label{
  font-size: .5rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.it-sub {
  margin: 0;
  font-size: .6rem;
}

.muted {
  color: var(--text-muted);
}

.it-total {
  font-size: .65rem;
  font-weight: 600;
  white-space: nowrap;
  color: var(--text-primary);
}

.ship-block {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  padding: .55rem .7rem .65rem;
  border-radius: .7rem;
  font-size: .6rem;
  line-height: 1.3;
  color: var(--text-primary);
  letter-spacing: .3px;
}

.ship-title {
  margin: 0 0 .3rem;
  text-transform: uppercase;
  font-weight: 600;
  font-size: .55rem;
  letter-spacing: .6px;
  color: var(--text-secondary);
}

.ship-addr {
  margin: 0;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: .45rem;
  margin-top: .4rem;
}

.btn {
  --btn-bg: linear-gradient(135deg, #1f8b4e 0%, #26a65b 100%);
  --btn-fg: white;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: none;
  background: var(--btn-bg);
  color: var(--btn-fg);
  font: inherit;
  font-weight: 700;
  padding: 0.625rem 1rem;
  border-radius: 10px;
  font-size: 0.875rem;
  letter-spacing: 0.02em;
  cursor: pointer;
  position: relative;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(31, 139, 78, 0.25);
}

.btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(31, 139, 78, 0.35);
  filter: brightness(1.1);
}

.btn:active:not(:disabled) {
  transform: translateY(0);
}

.btn:disabled {
  opacity: .4;
  cursor: not-allowed;
}

.btn.outline {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
  box-shadow: none;
}

.btn.outline:hover:not(:disabled) {
  background: var(--bg-secondary);
  border-color: var(--color-primary);
}

.btn.ghost {
  background: var(--bg-secondary);
  color: var(--text-primary);
  box-shadow: none;
}

.btn.ghost:hover:not(:disabled) {
  background: var(--bg-tertiary);
}

.btn.danger {
  --btn-bg: var(--color-danger);
  --btn-fg: var(--text-inverse);
}

.btn.danger.outline {
  background: transparent;
  color: var(--color-danger);
  border: 1px solid var(--color-danger);
}

.btn.danger.outline:hover {
  background: var(--color-danger);
  color: var(--text-inverse);
}

.btn.tiny {
  padding: .4rem .55rem;
  font-size: .55rem;
  letter-spacing: .5px;
}

.btn.small {
  padding: .5rem .75rem;
  font-size: .6rem;
}

.icon {
  width: 18px;
  height: 18px;
  stroke-width: 2;
}

.icon.mini {
  width: 14px;
  height: 14px;
}

.flip {
  transform: scaleY(-1);
}

.error-display {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: var(--color-danger-light, #fef2f2);
  border: 1px solid var(--color-danger, #dc2626);
  border-radius: 8px;
  color: var(--color-danger, #dc2626);
}

.error-details {
  flex: 1;
}

.error-message {
  margin: 0 0 0.25rem;
  font-weight: 600;
  font-size: 0.875rem;
}

.error-list {
  margin: 0;
  padding-left: 1rem;
  list-style: none;
}

.error-list li {
  font-size: 0.75rem;
  line-height: 1.4;
  margin-bottom: 0.125rem;
}

.error-display .btn {
  flex-shrink: 0;
  padding: 0.25rem;
  font-size: 1rem;
  line-height: 1;
  min-width: auto;
  width: 1.5rem;
  height: 1.5rem;
}

.loading-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: var(--bg-secondary, #f8fafc);
  border: 1px solid var(--border-primary, #e2e8f0);
  border-radius: 8px;
  color: var(--text-secondary, #64748b);
  font-size: 0.875rem;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 3rem 1rem;
  background: var(--bg-secondary);
  border: 1px dashed var(--border-primary);
  border-radius: 1rem;
  display: flex;
  flex-direction: column;
  gap: .85rem;
  color: var(--text-secondary);
  font-size: .85rem;
  letter-spacing: .5px;
}

.empty-state .icon.large {
  width: 46px;
  height: 46px;
  stroke-width: 1.5;
  margin: 0 auto;
  opacity: .8;
  color: var(--text-muted);
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: .9rem;
  margin-top: .5rem;
  flex-wrap: wrap;
  font-size: .65rem;
  color: var(--text-secondary);
  letter-spacing: .4px;
}

.pager-label {
  font-weight: 600;
}

.total-count {
  font-weight: 400;
  color: var(--text-secondary);
  font-size: .875em;
}

/* Agreement Modal Styles */
.agreement-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.agreement-modal-container {
  width: 100%;
  max-width: 500px;
  background: var(--surface);
  border: 1px solid var(--border-primary);
  border-radius: 1rem;
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
  max-height: 80vh;
}

.agreement-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-primary);
  background: var(--bg-secondary);
}

.chat-header-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.agreement-modal-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
}

.status-indicator {
  font-size: 0.6rem;
  line-height: 1;
}

.status-indicator.connected {
  color: var(--color-success);
}

.status-indicator.disconnected {
  color: var(--color-warning);
  animation: pulse 2s ease-in-out infinite;
}

.status-text {
  color: var(--text-secondary);
  font-weight: 500;
}

.modal-close-btn {
  background: none;
  border: none;
  color: var(--text-tertiary);
  font-size: 1.75rem;
  line-height: 1;
  cursor: pointer;
  transition: color 0.2s;
}

.modal-close-btn:hover {
  color: var(--text-primary);
}

.chat-history {
  flex-grow: 1;
  padding: 1rem 1.25rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  scroll-behavior: smooth;
  background: var(--bg-primary);
}

.message-bubble {
  padding: 0.75rem 1rem;
  border-radius: 1.25rem;
  max-width: 85%;
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  line-height: 1.4;
  word-wrap: break-word;
  animation: messageSlideIn 0.3s ease-out;
}

@keyframes messageSlideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-bubble.customer {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-bottom-left-radius: 0.25rem;
  align-self: flex-start;
  border: 1px solid var(--border-primary);
}

.message-bubble.customer.initial {
  background: var(--color-info-light);
  border: 1px solid var(--color-info);
  color: var(--text-primary);
}

.message-bubble.vendor {
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover));
  color: #ffffff;
  border-bottom-right-radius: 0.25rem;
  align-self: flex-end;
  border: 1px solid var(--color-primary);
}

.msg-text {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-size: 0.85rem;
  color: inherit;
}

.msg-meta {
  font-size: 0.65rem;
  margin-top: 0.4rem;
  font-weight: 500;
  color: inherit;
}

.message-bubble.vendor .msg-text,
.message-bubble.vendor .msg-meta {
  color: #ffffff;
}

.message-bubble.customer .msg-meta {
  opacity: 0.85;
}

.message-bubble.customer .msg-meta {
  align-self: flex-start;
}

.message-bubble.vendor .msg-meta {
  align-self: flex-end;
}

.empty-chat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary);
  flex-grow: 1;
}

.empty-icon {
  width: 48px;
  height: 48px;
  opacity: 0.6;
  color: var(--text-muted);
  transition: all 0.3s ease;
}

.chat-input-area {
  display: flex;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--border-primary);
  gap: 0.75rem;
  align-items: flex-end;
  background: var(--bg-secondary);
}

.chat-input-area textarea {
  flex: 1;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: 1rem;
  padding: 0.75rem 1rem;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 0.85rem;
  resize: none;
  outline: none;
  transition: all 0.2s;
  min-height: 44px;
  max-height: 120px;
  line-height: 1.4;
}

.chat-input-area textarea::placeholder {
  color: var(--text-muted);
}

.chat-input-area textarea:focus {
  border-color: var(--input-border-focus);
  box-shadow: 0 0 0 2px var(--color-primary-light);
}

.chat-input-area textarea:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-send {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover));
  color: var(--text-inverse);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(31, 139, 78, 0.3);
}

.btn-send:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--color-primary-hover), var(--color-primary-active));
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(31, 139, 78, 0.4);
}

.btn-send:active:not(:disabled) {
  transform: translateY(0);
}

.btn-send:disabled {
  background: var(--text-muted);
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
  opacity: 0.5;
}

/* Enhanced Message Icon Styles */
.btn-icon.chat-btn {
  position: relative;
  background: linear-gradient(135deg, #10b981, #059669);
  border: none;
  border-radius: 8px;
  padding: 6px 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-left: 8px;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.2);
  overflow: hidden;
}

.btn-icon.chat-btn:hover {
  background: linear-gradient(135deg, #059669, #047857);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn-icon.chat-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.2);
}

.btn-icon.chat-btn .icon {
  color: white;
  transition: transform 0.3s ease;
}

.btn-icon.chat-btn:hover .icon {
  transform: scale(1.1);
}

/* Tooltip for chat button */
.btn-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: #1f2937;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;
  z-index: 1000;
  pointer-events: none;
}

.btn-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: #1f2937;
}

.btn-icon.chat-btn:hover .btn-tooltip {
  opacity: 1;
  visibility: visible;
}

/* Enhanced Send Button */
.enhanced-send-btn {
  position: relative;
  overflow: hidden;
}

.enhanced-send-btn:not(:disabled):hover {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4);
}

.enhanced-send-btn .send-icon {
  transition: all 0.3s ease;
}

.enhanced-send-btn:hover .send-icon {
  transform: rotate(15deg) scale(1.1);
}

.enhanced-send-btn.sending {
  background: linear-gradient(135deg, #6b7280, #4b5563);
  animation: pulse 2s infinite;
}

/* Loading dots animation */
.loading-dots {
  display: flex;
  gap: 3px;
  align-items: center;
  justify-content: center;
}

.loading-dots span {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: white;
  animation: loading-bounce 1.4s infinite ease-in-out both;
}

.loading-dots span:nth-child(1) { animation-delay: -0.32s; }
.loading-dots span:nth-child(2) { animation-delay: -0.16s; }
.loading-dots span:nth-child(3) { animation-delay: 0s; }

@keyframes loading-bounce {
  0%, 80%, 100% { 
    transform: scale(0.6);
    opacity: 0.5;
  } 
  40% { 
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

/* Enhanced Empty Chat State */
.enhanced-empty-chat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px 20px;
  text-align: center;
}

.empty-icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.enhanced-empty-chat .empty-icon {
  width: 64px;
  height: 64px;
  color: var(--color-success);
  opacity: 0.8;
  z-index: 2;
  position: relative;
  animation: float 3s ease-in-out infinite;
}

.icon-glow {
  position: absolute;
  inset: -8px;
  background: radial-gradient(circle, rgba(31, 139, 78, 0.2) 0%, transparent 70%);
  border-radius: 50%;
  animation: glow-pulse 2s ease-in-out infinite alternate;
}

.empty-content h3 {
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.empty-content p {
  color: var(--text-secondary);
  font-size: 14px;
  margin: 0;
  max-width: 280px;
  line-height: 1.5;
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-8px); }
}

@keyframes glow-pulse {
  0% { opacity: 0.5; transform: scale(1); }
  100% { opacity: 0.8; transform: scale(1.1); }
}

/* Enhanced general icon styles */
.icon.mini {
  width: 16px;
  height: 16px;
  stroke-width: 2.5;
}

/* Enhanced Navigation Styles */
.enhanced-nav {
  position: relative;
  scroll-behavior: smooth;
}

.enhanced-nav .status-chip {
  position: relative;
  transition: all 0.3s ease;
  scroll-margin: 10px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Status Icons */
.status-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.status-chip:hover .status-icon {
  transform: scale(1.1);
}

.status-chip.active .status-icon {
  transform: scale(1.05);
}

/* Status-specific icon colors */
.status-chip:not(.active) .status-icon {
  opacity: 0.7;
}

/* Color coding for different status icons */
.status-chip[data-status="all"] .status-icon {
  color: #64748b;
}

.status-chip[data-status="pending"] .status-icon {
  color: #f59e0b;
}

.status-chip[data-status="paid"] .status-icon {
  color: #10b981;
}

.status-chip[data-status="shipped"] .status-icon {
  color: #3b82f6;
}

.status-chip[data-status="delivered"] .status-icon {
  color: #22c55e;
}

.status-chip[data-status="cancelled"] .status-icon {
  color: #ef4444;
}

.status-chip.active .status-icon {
  color: rgb(21, 30, 46);
  opacity: 1;
  animation: iconPulse 0.3s ease-out;
}

@keyframes iconPulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1.05); }
}

.enhanced-nav .status-chip:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
}

.enhanced-nav .status-chip:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

.enhanced-nav .status-chip.active:focus {
  outline-color: #1d4ed8;
}

/* Screen reader only class */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Enhanced Pagination */
.enhanced-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
  flex-wrap: wrap;
  font-size: 0.75rem;
  color: #cbd5e1;
  letter-spacing: 0.025em;
}

.pagination-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 80px;
  justify-content: center;
  transition: all 0.3s ease;
  position: relative;
}

.pagination-btn:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
}

.pagination-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.pagination-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none !important;
}

.pagination-info {
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.5rem;
  min-width: 120px;
  text-align: center;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: center;
}

.page-icon {
  width: 14px;
  height: 14px;
  opacity: 0.7;
  flex-shrink: 0;
}

/* Pagination Icon Animations */
.pagination-btn:hover .icon {
  transform: translateX(2px);
}

.pagination-btn:hover .icon[data-direction="prev"] {
  transform: translateX(-2px);
}

/* ==================== MOBILE-FIRST RESPONSIVE DESIGN ==================== */
/* Enhanced Mobile Navigation & Layout */
@media (max-width: 768px) {
  /* Page Container - Optimized mobile spacing */
  .order-cards-page {
    padding: 0.75rem;
    padding-bottom: 2rem;
    gap: 0.875rem;
    overflow-x: hidden;
  }

  /* Page Header - Compact mobile layout */
  .page-header {
    padding: 0.5rem 0 0.75rem;
    gap: 0.4rem;
  }

  .page-title {
    font-size: 1.35rem;
    gap: 0.4rem;
    line-height: 1.2;
  }

  .title-icon {
    width: 1.35rem;
    height: 1.35rem;
    flex-shrink: 0;
  }

  .page-subtitle {
    font-size: 0.8rem;
    padding-left: 1.75rem;
    line-height: 1.3;
    color: var(--text-secondary);
  }
  
  /* Navigation Tabs - Horizontal scroll with enhanced UX */
  .enhanced-nav {
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scrollbar-color: rgba(31, 139, 78, 0.3) transparent;
    scroll-snap-type: x proximity;
    margin: 0 -0.75rem;
    padding: 0 0.75rem 0.4rem;
  }
  
  .enhanced-nav::-webkit-scrollbar {
    height: 3px;
  }
  
  .enhanced-nav::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .enhanced-nav::-webkit-scrollbar-thumb {
    background: var(--color-primary);
    border-radius: 3px;
  }
  
  .status-tabs {
    flex-wrap: nowrap;
    min-width: max-content;
    gap: 0.4rem;
    padding: 0.35rem;
  }
  
  .status-chip {
    flex-shrink: 0;
    white-space: nowrap;
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    gap: 0.35rem;
    scroll-snap-align: start;
    min-height: 38px;
  }
  
  .status-icon {
    width: 14px;
    height: 14px;
  }

  .status-chip .count {
    font-size: 0.6rem;
    padding: 1px 5px;
  }
  
  /* Controls & Search - Mobile-first stack layout */
  .controls {
    flex-direction: column;
    gap: 0.625rem;
    align-items: stretch;
  }
  
  .search-box {
    width: 100%;
    padding: 0.625rem 0.75rem;
  }

  .search-box .icon {
    width: 16px;
    height: 16px;
  }

  .search-box input {
    font-size: 0.85rem;
  }
  
  .right-actions {
    width: 100%;
    display: flex;
    gap: 0.5rem;
    justify-content: space-between;
  }

  .right-actions .btn {
    flex: 1;
    justify-content: center;
    min-height: 38px;
    font-size: 0.75rem;
    padding: 0.5rem 0.625rem;
  }

  .right-actions .btn .icon {
    width: 14px;
    height: 14px;
  }
  
  /* Filters Panel - Full width mobile */
  .filters-panel {
    padding: 0.875rem;
    gap: 0.875rem;
  }

  .filters-grid {
    grid-template-columns: 1fr;
    gap: 0.875rem;
  }

  .filter-group input,
  .filter-group select {
    padding: 0.65rem 0.75rem;
    font-size: 0.875rem;
  }

  .filters-actions {
    width: 100%;
  }

  .filters-actions .btn {
    width: 100%;
  }

  /* Summary - Better mobile spacing */
  .summary {
    font-size: 0.75rem;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.625rem;
    padding: 0.5rem 0;
  }
  
  /* Order Cards Grid - Single column mobile */
  .cards-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  .order-card {
    padding: 1rem;
    border-radius: 14px;
    gap: 0.875rem;
  }
  
  .card-head {
    flex-direction: column;
    gap: 0.625rem;
    align-items: flex-start;
  }
  
  .card-head .left {
    width: 100%;
  }
  
  .card-head .oid {
    font-size: 0.95rem;
    font-weight: 700;
    word-break: break-all;
    line-height: 1.3;
  }
  
  .card-head .created {
    font-size: 0.7rem;
    margin-top: 0.25rem;
    opacity: 0.85;
  }

  .card-head .right {
    width: 100%;
  }
  
  .status-pill {
    align-self: flex-start;
    font-size: 0.65rem;
    padding: 0.4rem 0.65rem;
    border-radius: 6px;
  }
  
  /* Info Lines - Enhanced readability */
  .info-line {
    font-size: 0.8rem;
    gap: 0.625rem;
    flex-wrap: wrap;
    line-height: 1.4;
  }
  
  .info-line .lbl {
    font-size: 0.75rem;
    min-width: 95px;
    font-weight: 600;
    color: var(--text-secondary);
  }
  
  .info-line .val {
    font-size: 0.8rem;
    word-break: break-word;
    flex: 1;
    color: var(--text-primary);
  }
  
  .mono {
    font-size: 0.7rem;
    word-break: break-all;
    font-family: 'Courier New', monospace;
  }
  
  .pay-badge {
    font-size: 0.65rem;
    padding: 3px 7px;
    border-radius: 4px;
    margin-left: 0.4rem;
  }
  
  /* Items List - Better mobile layout */
  .items-list {
    gap: 0.75rem;
  }
  
  .item-row {
    gap: 0.75rem;
    align-items: flex-start;
  }
  
  .thumb {
    width: 70px;
    height: 52px;
    min-width: 70px;
    flex-shrink: 0;
    border-radius: 8px;
  }
  
  .it-name {
    font-size: 0.8rem;
    line-height: 1.3;
    margin-bottom: 0.15rem;
  }

  .it-label {
    font-size: 0.65rem;
    margin-bottom: 0.25rem;
    opacity: 0.85;
  }
  
  .it-sub {
    font-size: 0.7rem;
    opacity: 0.75;
  }
  
  .it-total {
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
  }
  
  /* Shipping Block - Mobile optimized */
  .ship-block {
    padding: 0.75rem;
    font-size: 0.75rem;
    line-height: 1.5;
  }
  
  .ship-title {
    font-size: 0.7rem;
    margin-bottom: 0.4rem;
    font-weight: 600;
  }
  
  /* Action Buttons - Grid layout for mobile */
  .actions {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }
  
  .btn {
    font-size: 0.75rem;
    padding: 0.55rem 0.75rem;
  }
  
  .btn.tiny {
    padding: 0.5rem 0.65rem;
    font-size: 0.7rem;
    min-height: 40px;
    justify-content: center;
  }
  
  .icon.mini {
    width: 14px;
    height: 14px;
  }
  
  .expand-btn {
    font-size: 0.75rem;
    padding: 0.65rem;
    min-height: 42px;
    gap: 0.5rem;
  }
  
  /* Pagination - Mobile friendly */
  .enhanced-pagination {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: 0.75rem;
    align-items: center;
  }
  
  .pagination-btn {
    min-width: 75px;
    padding: 0.55rem 0.75rem;
    font-size: 0.75rem;
    min-height: 42px;
  }
  
  .pagination-info {
    flex: 1;
    text-align: center;
    padding: 0.5rem;
    font-size: 0.75rem;
    line-height: 1.4;
  }
  
  .page-icon {
    display: none;
  }
  
  /* Chat Button - Touch friendly */
  .btn-icon.chat-btn {
    width: 32px;
    height: 32px;
    padding: 0.4rem;
  }
  
  .btn-tooltip {
    display: none;
  }
  
  /* Agreement Modal - Full screen mobile */
  .agreement-modal-overlay {
    padding: 0;
  }
  
  .agreement-modal-container {
    max-width: 100%;
    width: 100%;
    max-height: 100dvh;
    height: 100dvh;
    border-radius: 0;
    margin: 0;
  }
  
  .agreement-modal-header {
    padding: 1rem 1.15rem;
    border-radius: 0;
  }
  
  .agreement-modal-header h3 {
    font-size: 1rem;
    line-height: 1.3;
  }
  
  .connection-status {
    font-size: 0.75rem;
  }
  
  .chat-history {
    padding: 1rem;
  }
  
  .message-bubble {
    max-width: 85%;
    padding: 0.75rem 1rem;
    border-radius: 14px;
  }
  
  .msg-text {
    font-size: 0.875rem;
    line-height: 1.4;
  }
  
  .msg-meta {
    font-size: 0.65rem;
    margin-top: 0.35rem;
  }
  
  .chat-input-area {
    padding: 0.875rem 1rem;
    gap: 0.625rem;
  }
  
  .chat-input-area textarea {
    font-size: 0.875rem;
    padding: 0.75rem 0.9rem;
    min-height: 44px;
    line-height: 1.4;
  }
  
  .btn-send {
    width: 44px;
    height: 44px;
    min-width: 44px;
    flex-shrink: 0;
  }
  
  /* Enhanced Empty Chat */
  .enhanced-empty-chat {
    padding: 2rem 1.15rem;
  }
  
  .enhanced-empty-chat .empty-icon {
    width: 56px;
    height: 56px;
  }
  
  .empty-content h3 {
    font-size: 1.05rem;
    line-height: 1.3;
  }
  
  .empty-content p {
    font-size: 0.875rem;
    line-height: 1.5;
  }
  
  /* Empty State */
  .empty-state {
    padding: 3rem 1.15rem;
    font-size: 0.875rem;
  }
  
  .empty-state .icon.large {
    width: 48px;
    height: 48px;
    margin-bottom: 1rem;
  }

  /* Loading Skeleton */
  .loading-skeleton {
    height: 300px;
    min-height: 300px;
  }
}

/* Extra Small Screens - Ultra compact mobile */
@media (max-width: 480px) {
  .order-cards-page {
    padding: 0.625rem;
    gap: 0.875rem;
  }

  .page-header {
    padding: 0.375rem 0 0.875rem;
  }

  .page-title {
    font-size: 1.35rem;
    gap: 0.4rem;
    line-height: 1.2;
  }

  .title-icon {
    width: 1.35rem;
    height: 1.35rem;
  }

  .page-subtitle {
    font-size: 0.8rem;
    padding-left: 1.75rem;
    line-height: 1.4;
  }
  
  /* Status Tabs - Compact */
  .enhanced-nav {
    margin: 0 -0.625rem;
    padding: 0 0.625rem 0.4rem;
  }

  .status-chip {
    padding: 0.45rem 0.7rem;
    font-size: 0.75rem;
    min-height: 38px;
  }

  .status-icon {
    width: 13px;
    height: 13px;
  }
  
  /* Search & Actions - Stacked */
  .search-box {
    padding: 0.65rem 0.8rem;
  }

  .search-box input {
    font-size: 0.85rem;
  }

  .right-actions .btn {
    font-size: 0.75rem;
    min-height: 40px;
    padding: 0.5rem 0.65rem;
  }

  /* Cards - More compact */
  .cards-grid {
    gap: 0.875rem;
  }
  
  .order-card {
    padding: 0.875rem;
    gap: 0.75rem;
    border-radius: 12px;
  }
  
  .card-head .oid {
    font-size: 0.875rem;
  }

  .card-head .created {
    font-size: 0.65rem;
  }

  .status-pill {
    font-size: 0.6rem;
    padding: 0.35rem 0.6rem;
  }
  
  /* Info Lines - Compact */
  .info-line {
    font-size: 0.75rem;
    gap: 0.5rem;
  }
  
  .info-line .lbl {
    min-width: 85px;
    font-size: 0.7rem;
  }

  .info-line .val {
    font-size: 0.75rem;
  }

  .mono {
    font-size: 0.65rem;
  }

  .pay-badge {
    font-size: 0.6rem;
    padding: 2px 6px;
  }

  /* Items - Compact layout */
  .thumb {
    width: 65px;
    height: 48px;
    min-width: 65px;
  }

  .it-name {
    font-size: 0.75rem;
  }

  .it-label {
    font-size: 0.6rem;
  }

  .it-sub {
    font-size: 0.65rem;
  }

  .it-total {
    font-size: 0.75rem;
  }

  /* Shipping Block */
  .ship-block {
    padding: 0.65rem;
    font-size: 0.7rem;
  }

  .ship-title {
    font-size: 0.65rem;
  }

  /* Actions - Compact buttons */
  .actions {
    gap: 0.45rem;
  }

  .btn.tiny {
    padding: 0.45rem 0.6rem;
    font-size: 0.675rem;
    min-height: 38px;
  }

  .icon.mini {
    width: 13px;
    height: 13px;
  }

  .expand-btn {
    font-size: 0.7rem;
    padding: 0.6rem;
    min-height: 40px;
  }

  /* Pagination - Compact */
  .pagination-btn {
    min-width: 70px;
    padding: 0.5rem 0.65rem;
    font-size: 0.7rem;
    min-height: 40px;
  }

  .pagination-info {
    padding: 0.45rem;
    font-size: 0.7rem;
  }

  /* Chat Button */
  .btn-icon.chat-btn {
    width: 30px;
    height: 30px;
  }

  /* Modal - Full screen */
  .agreement-modal-header h3 {
    font-size: 0.95rem;
  }

  .connection-status {
    font-size: 0.7rem;
  }

  .message-bubble {
    padding: 0.65rem 0.875rem;
  }

  .msg-text {
    font-size: 0.825rem;
  }

  .msg-meta {
    font-size: 0.625rem;
  }

  .chat-input-area {
    padding: 0.75rem 0.875rem;
  }

  .chat-input-area textarea {
    font-size: 0.825rem;
    padding: 0.65rem 0.8rem;
    min-height: 42px;
  }

  .btn-send {
    width: 42px;
    height: 42px;
  }

  /* Empty States */
  .enhanced-empty-chat {
    padding: 1.5rem 1rem;
  }

  .enhanced-empty-chat .empty-icon {
    width: 52px;
    height: 52px;
  }

  .empty-content h3 {
    font-size: 1rem;
  }

  .empty-content p {
    font-size: 0.825rem;
  }

  .empty-state {
    padding: 2.5rem 1rem;
  }

  .empty-state .icon.large {
    width: 44px;
    height: 44px;
  }

  /* Summary */
  .summary {
    font-size: 0.7rem;
    gap: 0.5rem;
  }
}

/* Tablet & Medium Screens (769px - 1024px) */
@media (min-width: 769px) and (max-width: 1024px) {
  .order-cards-page {
    padding: 1.25rem;
  }

  /* Page Header - Tablet layout */
  .page-header {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .page-subtitle {
    flex-basis: 100%;
    padding-left: 2.25rem;
  }

  /* Status Tabs - Allow wrapping on tablet */
  .enhanced-nav {
    flex-wrap: wrap;
  }

  .status-chip {
    padding: 0.6rem 1rem;
    font-size: 0.85rem;
  }

  /* Search & Actions - Better tablet spacing */
  .controls {
    flex-direction: row;
    align-items: center;
    gap: 1rem;
  }

  .search-box {
    flex: 1;
    min-width: 280px;
  }

  .right-actions {
    flex-shrink: 0;
    width: auto;
  }

  /* Filters - Two columns */
  .filters-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  /* Cards Grid - Two columns on tablet */
  .cards-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1.15rem;
  }

  .order-card {
    padding: 1.15rem;
  }

  /* Actions - Better spacing */
  .actions {
    display: flex;
    flex-wrap: wrap;
    grid-template-columns: none;
  }

  /* Pagination - Centered with good spacing */
  .enhanced-pagination {
    justify-content: center;
    gap: 1rem;
  }

  .pagination-info {
    display: flex;
    align-items: center;
    padding: 0.5rem 1.15rem;
  }

  .page-icon {
    display: inline-block;
    width: 18px;
    height: 18px;
    margin-right: 0.5rem;
  }
}

/* Large Screens (1025px+) - Ensure optimal desktop experience */
@media (min-width: 1025px) {
  .cards-grid {
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  }

  .enhanced-pagination {
    justify-content: center;
  }

  /* Hover enhancements for desktop */
  .status-chip:hover {
    transform: translateY(-1px);
  }

  .order-card:hover {
    transform: translateY(-2px);
  }

  .btn:hover {
    transform: translateY(-1px);
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .enhanced-nav .status-chip:focus {
    outline: 3px solid;
    outline-offset: 2px;
  }
  
  .pagination-btn:focus {
    outline: 3px solid;
    outline-offset: 2px;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .enhanced-nav {
    scroll-behavior: auto;
  }
  
  .enhanced-nav .status-chip,
  .pagination-btn,
  .loading-dots span {
    transition: none;
    animation: none;
  }
}

/* Rest of existing styles remain the same */
</style>
