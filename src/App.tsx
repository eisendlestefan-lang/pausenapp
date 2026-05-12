import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SUPABASE_URL = "https://gvcelpwrkjsflegimolt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_GLVlO6oDEbiwIKkSOsJKnA_5Tno2wa0";
const supabase = SUPABASE_URL.startsWith("https://") ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const ADMIN_EMAIL = "eisendlestefan@gmail.com";
const ADMIN_NAME = "Stefan Eisendle";
const BAKERY_EMAIL = ADMIN_EMAIL;
const EMAIL_FUNCTION_NAME = "email-versand";
const PAYPAL_PAYMENT_LINK = "https://www.paypal.com/ncp/payment/8FV3GWW3RQQ9A";

const BANK_RECIPIENT = "Raiffeisenkasse Wipptal";
const BANK_IBAN = "IT32A0818259110000300279609";
const BANK_BIC = "";
const BANK_REFERENCE_PREFIX = "PAUSE";

const weekdays = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];
const paymentMethods = ["Überweisung", "PayPal", "Stripe", "Kreditkarte"];
const livePaymentMethods = ["Überweisung", "PayPal"];
const ORDER_DEADLINE_HOUR = 18;
const ORDER_DEADLINE_MINUTE = 0;

const demoUser = { id: "admin-001", name: ADMIN_NAME, email: ADMIN_EMAIL, role: "admin" };

const fallbackProducts = [
  { id: "laugen-schinken-kaese", name: "Laugenbrot mit Schinken & Käse", price: 3.2, tags: ["klassisch"], desc: "Beliebtes Pausenbrot mit Schinken und Käse." },
  { id: "laugen-speck-kaese", name: "Laugenbrot mit Speck & Käse", price: 3.4, tags: ["herzhaft"], desc: "Kräftig im Geschmack." },
  { id: "laugen-lyoner-kaese", name: "Laugenbrot mit Lyoner & Käse", price: 3.1, tags: ["klassisch"], desc: "Mildes Pausenbrot mit Lyoner und Käse." },
  { id: "semmel-schinken-kaese", name: "Semmel mit Schinken & Käse", price: 2.8, tags: ["klassisch"], desc: "Klassische Semmel für die Pause." },
  { id: "semmel-speck-kaese", name: "Semmel mit Speck & Käse", price: 3.0, tags: ["herzhaft"], desc: "Kräftige Semmel mit Speck und Käse." },
  { id: "semmel-lyoner-kaese", name: "Semmel mit Lyoner & Käse", price: 2.7, tags: ["klassisch"], desc: "Milde Variante mit Lyoner." },
  { id: "apfel", name: "Apfel", price: 1.0, tags: ["vegan", "frisch"], desc: "Frischer Apfel, saisonal." },
  { id: "banane", name: "Banane", price: 1.1, tags: ["vegan", "frisch"], desc: "Reife Banane als gesunder Snack." },
  { id: "wasser", name: "Mineralwasser klein", price: 1.1, tags: ["getränk"], desc: "0,33 l Wasser ohne Zuckerzusatz." },
];

const initialChildren = [
  { id: "lena", name: "Lena", school: "Grundschule Zentrum", className: "2B", allergies: "keine" },
  { id: "max", name: "Max", school: "Grundschule Zentrum", className: "4A", allergies: "Haselnüsse" },
];

const initialOrders = {
  lena: { Montag: ["laugen-schinken-kaese", "apfel"], Dienstag: ["semmel-lyoner-kaese", "wasser"] },
  max: { Montag: ["laugen-speck-kaese", "banane"], Mittwoch: ["semmel-schinken-kaese", "apfel"] },
};

const initialCompletedOrders = [
  { id: "ord-1001", parent: ADMIN_NAME, parentEmail: ADMIN_EMAIL, child: "Lena", school: "Grundschule Zentrum", day: "Montag", total: 4.2, payment: "Stripe", paymentReference: "", status: "bezahlt", email: "vorgemerkt" },
  { id: "ord-1002", parent: ADMIN_NAME, parentEmail: ADMIN_EMAIL, child: "Max", school: "Grundschule Zentrum", day: "Montag", total: 4.5, payment: "PayPal", paymentReference: "", status: "bezahlt", email: "vorgemerkt" },
  { id: "ord-1003", parent: ADMIN_NAME, parentEmail: ADMIN_EMAIL, child: "Lena", school: "Grundschule Zentrum", day: "Dienstag", total: 3.8, payment: "Überweisung", paymentReference: "PAUSE-DEMO-LENA", status: "offen", email: "vorgemerkt" },
];

function money(value) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value || 0);
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));
}

function normalizeProduct(product) {
  return { id: product.id, name: product.name, price: Number(product.price || 0), tags: Array.isArray(product.tags) ? product.tags : [], desc: product.desc || product.description || "", active: product.active !== false };
}

function normalizeChild(child) {
  return { id: child.id, name: child.name, school: child.school, className: child.class_name || child.className || "", allergies: child.allergies || "keine" };
}

function normalizeCompletedOrder(order, child, user) {
  return {
    id: order.id,
    parent: user?.name || demoUser.name,
    parentEmail: user?.email || demoUser.email,
    child: child?.name || "Kind",
    school: order.school || child?.school || "",
    day: order.weekday,
    total: Number(order.total || 0),
    payment: order.payment_method || "Überweisung",
    paymentReference: order.payment_reference || order.paymentReference || "",
    status: order.status || "offen",
    email: order.confirmation_email_sent ? "gesendet" : "vorgemerkt",
  };
}

function getNextDeliveryDate(weekday) {
  const weekdayIndex = weekdays.indexOf(weekday);
  const today = new Date();
  const todayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const daysToAdd = weekdayIndex >= todayIndex ? weekdayIndex - todayIndex : 7 - todayIndex + weekdayIndex;
  const deliveryDate = new Date(today);
  deliveryDate.setDate(today.getDate() + daysToAdd);
  return deliveryDate.toISOString().slice(0, 10);
}

function getOrderDeadlineDate(weekday) {
  const deliveryDate = new Date(`${getNextDeliveryDate(weekday)}T00:00:00`);
  const deadline = new Date(deliveryDate);
  deadline.setDate(deliveryDate.getDate() - 1);
  deadline.setHours(ORDER_DEADLINE_HOUR, ORDER_DEADLINE_MINUTE, 0, 0);
  return deadline;
}

function isOrderDeadlineOpen(weekday, now = new Date()) {
  return now.getTime() <= getOrderDeadlineDate(weekday).getTime();
}

function getOrderLockStatus(weekday, now = new Date()) {
  return isOrderDeadlineOpen(weekday, now) ? "offen" : "fixiert";
}

function isOrderEditable(weekday, now = new Date()) {
  return getOrderLockStatus(weekday, now) === "offen";
}

function formatOrderDeadline(weekday) {
  return getOrderDeadlineDate(weekday).toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function getReminderMessage(weekday, now = new Date()) {
  const deadline = getOrderDeadlineDate(weekday);
  const diffMs = deadline.getTime() - now.getTime();
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
  if (diffMs < 0) return `Bestellungen für ${weekday} sind fixiert.`;
  if (diffHours <= 3) return `Reminder: Bestellfrist für ${weekday} endet bald.`;
  if (diffHours <= 24) return `Reminder: Bestellfrist für ${weekday} endet heute bzw. morgen.`;
  return `Bestellfrist für ${weekday}: ${formatOrderDeadline(weekday)}`;
}

function calculateChildDayTotal(childId, day, orderMap, productList) {
  return (orderMap[childId]?.[day] || []).reduce((sum, id) => sum + (productList.find((product) => product.id === id)?.price || 0), 0);
}

function calculateWeeklyTotal(orderMap, productList) {
  return Object.values(orderMap).flatMap((childOrders) => Object.values(childOrders).flatMap((ids) => ids)).reduce((sum, id) => sum + (productList.find((product) => product.id === id)?.price || 0), 0);
}

function buildSchoolRows(childrenList, orderMap, day, productList) {
  return childrenList.flatMap((child) => {
    const itemIds = orderMap[child.id]?.[day] || [];
    if (!itemIds.length) return [];
    return [{ child, items: itemIds.map((id) => productList.find((product) => product.id === id)?.name).filter(Boolean), total: calculateChildDayTotal(child.id, day, orderMap, productList) }];
  });
}

function buildProductSummary(childrenList, orderMap, day, productList) {
  const summary = {};
  childrenList.forEach((child) => {
    (orderMap[child.id]?.[day] || []).forEach((productId) => {
      const product = productList.find((item) => item.id === productId);
      if (!product) return;
      if (!summary[product.id]) summary[product.id] = { product: product.name, quantity: 0 };
      summary[product.id].quantity += 1;
    });
  });
  return Object.values(summary);
}

function buildProductionOrderDetails({ childrenList, orderMap, day, productList, parentName, parentEmail, completedOrders = [] }) {
  return childrenList.flatMap((child) => {
    const itemIds = orderMap[child.id]?.[day] || [];
    if (!itemIds.length) return [];
    const matchingOrder = completedOrders.find((order) => order.child === child.name && order.day === day);
    return [{ parentName, parentEmail, childName: child.name, school: child.school, className: child.className, allergies: child.allergies || "keine", paymentReference: matchingOrder?.paymentReference || "", items: itemIds.map((id) => productList.find((product) => product.id === id)?.name).filter(Boolean) }];
  });
}

function getNavigationItems(user) {
  const baseItems = [["start", "utensils", "Start"], ["bestellen", "basket", "Bestellen"], ["kinder", "user", "Kinder"], ["zahlung", "payment", "Zahlung"], ["statistiken", "chart", "Statistiken"], ["schule", "school", "Ausgabe"]];
  return user?.role === "admin" ? [...baseItems, ["admin", "admin", "Admin"]] : baseItems;
}

function updateChildAllergies(childrenList, childId, allergies) {
  return childrenList.map((child) => (child.id === childId ? { ...child, allergies } : child));
}

function updateChildClass(childrenList, childId, className) {
  return childrenList.map((child) => (child.id === childId ? { ...child, className } : child));
}

function mergeChildDraft(previousDrafts, childId, updates) {
  return { ...previousDrafts, [childId]: { ...(previousDrafts[childId] || {}), ...updates } };
}

function createProductFromForm(form) {
  const name = form.name.trim();
  const price = Number.parseFloat(String(form.price).replace(",", "."));
  const desc = form.desc.trim() || "Beschreibung folgt.";
  const tags = form.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  if (!name || Number.isNaN(price) || price <= 0) return null;
  return { id: slugify(name), name, price, tags: tags.length ? tags : ["menü"], desc };
}

function removeProductFromOrders(orderMap, productId) {
  const nextOrders = {};
  Object.entries(orderMap).forEach(([childId, childOrders]) => {
    nextOrders[childId] = {};
    Object.entries(childOrders).forEach(([day, ids]) => {
      nextOrders[childId][day] = ids.filter((id) => id !== productId);
    });
  });
  return nextOrders;
}

function removeUnknownProductIdsFromOrders(orderMap, productList) {
  const validProductIds = new Set(productList.map((product) => product.id));
  const nextOrders = {};
  Object.entries(orderMap).forEach(([childId, childOrders]) => {
    nextOrders[childId] = {};
    Object.entries(childOrders).forEach(([day, ids]) => {
      nextOrders[childId][day] = ids.filter((id) => validProductIds.has(id));
    });
  });
  return nextOrders;
}

function getInitialPaymentStatus(paymentMethod) {
  if (paymentMethod === "Überweisung") return "offen";
  if (paymentMethod === "PayPal") return "offen";
  return "bezahlt";
}

function getPaymentHint(paymentMethod) {
  if (paymentMethod === "Überweisung") return "Bestellung wird gespeichert. Zahlung wird vom Admin nach Zahlungseingang bestätigt.";
  if (paymentMethod === "PayPal") return "PayPal öffnet deinen Zahlungslink. Nach Zahlungseingang markiert der Admin die Bestellung als bezahlt.";
  return "Demo-Modus: Diese Zahlungsart ist vorbereitet, aber noch nicht live verbunden.";
}

function isOnlinePayment(paymentMethod) {
  return paymentMethod === "PayPal";
}

function createPaymentReference({ child, day, createdAt = new Date() }) {
  const datePart = createdAt.toISOString().slice(2, 10).replace(/-/g, "");
  const childPart = slugify(child?.name || "kind").replace(/-/g, "").slice(0, 6).toUpperCase() || "KIND";
  const dayPart = String(day || "tag").slice(0, 2).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${BANK_REFERENCE_PREFIX}-${datePart}-${childPart}-${dayPart}-${randomPart}`;
}

function createLocalOrderRecord({ completedOrders, user, child, day, total, paymentMethod }) {
  return { id: `ord-${1000 + completedOrders.length + 1}`, parent: user?.name || demoUser.name, parentEmail: user?.email || demoUser.email, child: child.name, school: child.school, day, total, payment: paymentMethod, paymentReference: createPaymentReference({ child, day }), status: getInitialPaymentStatus(paymentMethod), email: "vorgemerkt" };
}

function buildOrderEmailPayload({ order, child, day, selectedProducts, adminEmail, bakeryEmail }) {
  return { orderId: order.id, parentName: order.parent, parentEmail: order.parentEmail, adminEmail, bakeryEmail, childName: child.name, school: child.school, className: child.className, allergies: child.allergies || "keine", weekday: day, deliveryDate: getNextDeliveryDate(day), paymentMethod: order.payment, status: order.status, paymentReference: order.paymentReference || "", total: order.total, products: selectedProducts.map((product) => ({ name: product.name, price: product.price, quantity: 1 })) };
}

function buildProductionEmailPayload({ day, productSummary, adminEmail, bakeryEmail, orderDetails = [] }) {
  return { adminEmail, bakeryEmail, weekday: day, deliveryDate: getNextDeliveryDate(day), products: productSummary.map((row) => ({ name: row.product, quantity: row.quantity })), orders: orderDetails.map((detail) => ({ parentName: detail.parentName, parentEmail: detail.parentEmail, childName: detail.childName, school: detail.school, className: detail.className, allergies: detail.allergies || "keine", paymentReference: detail.paymentReference || "", items: detail.items || [] })) };
}

function buildPaymentConfirmationPayload({ order, adminEmail }) {
  return { orderId: order.id, parentName: order.parent, parentEmail: order.parentEmail, adminEmail, childName: order.child, school: order.school, weekday: order.day, paymentMethod: order.payment, total: order.total, status: "bezahlt", paymentReference: order.paymentReference || "" };
}

function filterOrdersBySearch(ordersList, searchTerm) {
  const term = String(searchTerm || "").trim().toLowerCase();
  if (!term) return ordersList;
  return ordersList.filter((order) => [order.id, order.parent, order.parentEmail, order.child, order.school, order.day, order.payment, order.paymentReference, order.status, money(order.total)].filter(Boolean).some((value) => String(value).toLowerCase().includes(term)));
}

function getParentOrderStats(ordersList) {
  return { count: ordersList.length, openCount: ordersList.filter((order) => order.status === "offen").length, paidCount: ordersList.filter((order) => order.status === "bezahlt").length, openTotal: ordersList.filter((order) => order.status === "offen").reduce((sum, order) => sum + order.total, 0), paidTotal: ordersList.filter((order) => order.status === "bezahlt").reduce((sum, order) => sum + order.total, 0) };
}

function getAdminTodoSummary(ordersList, activeProductSummary) {
  return { openPayments: ordersList.filter((order) => order.status === "offen").length, productionItems: activeProductSummary.reduce((sum, row) => sum + row.quantity, 0), emailsOpen: ordersList.filter((order) => order.email !== "gesendet").length };
}

function createUserFromProfile(authUser, profile) {
  return { id: authUser.id, name: profile?.full_name || authUser.email || demoUser.name, email: profile?.email || authUser.email || demoUser.email, role: profile?.role || "parent" };
}

function functionNeedsRealUser(user) {
  return Boolean(user?.id && isUuid(user.id));
}

function getNetworkErrorMessage(error) {
  const message = error?.message || String(error || "Unbekannter Fehler");
  if (message.includes("Failed to fetch") || message.includes("fetch")) return "Netzwerkfehler: Supabase ist aus dieser Vorschau gerade nicht erreichbar. App läuft im lokalen Modus weiter.";
  return message;
}

function runSelfTests() {
  console.assert(money(2.9).includes("2,90"), "money() formats German EUR values");
  console.assert(slugify("Lena Müller") === "lena-muller", "slugify() creates stable ASCII ids");
  console.assert(isUuid("550e8400-e29b-41d4-a716-446655440000"), "isUuid() detects valid UUIDs");
  console.assert(!isUuid("apfel"), "isUuid() rejects demo ids");
  console.assert(getInitialPaymentStatus("PayPal") === "offen", "PayPal stays open until admin confirmation");
  console.assert(isOnlinePayment("PayPal"), "PayPal is treated as online payment");
  console.assert(getPaymentHint("PayPal").includes("PayPal"), "PayPal hint is visible");
  console.assert(createPaymentReference({ child: initialChildren[0], day: "Montag" }).startsWith(`${BANK_REFERENCE_PREFIX}-`), "payment reference uses prefix");
  console.assert(formatOrderDeadline("Montag").length > 0, "deadline is readable");
  console.assert(["offen", "fixiert"].includes(getOrderLockStatus("Montag")), "lock status is valid");
  console.assert(typeof isOrderEditable("Montag") === "boolean", "editable status is boolean");
  console.assert(getReminderMessage("Montag").length > 0, "reminder message is visible");
  console.assert(calculateChildDayTotal("lena", "Montag", initialOrders, fallbackProducts) > 0, "day total is calculated");
  console.assert(calculateWeeklyTotal(initialOrders, fallbackProducts) > 0, "weekly total is calculated");
  console.assert(buildSchoolRows(initialChildren, initialOrders, "Montag", fallbackProducts).length === 2, "school rows build correctly");
  console.assert(buildProductSummary(initialChildren, initialOrders, "Montag", fallbackProducts).length > 0, "product summary builds correctly");
  console.assert(updateChildAllergies(initialChildren, "max", "Laktose").find((child) => child.id === "max")?.allergies === "Laktose", "allergies update");
  console.assert(updateChildClass(initialChildren, "lena", "3C").find((child) => child.id === "lena")?.className === "3C", "class update");
  console.assert(mergeChildDraft({}, "lena", { allergies: "Nüsse" }).lena.allergies === "Nüsse", "draft update");
  console.assert(createProductFromForm({ name: "Test Semmel", price: "2,50", tags: "test", desc: "Demo" })?.price === 2.5, "product form parses comma prices");
  console.assert(createProductFromForm({ name: "", price: "2.5", tags: "", desc: "" }) === null, "product form rejects empty names");
  console.assert(!removeProductFromOrders({ lena: { Montag: ["apfel", "wasser"] } }, "apfel").lena.Montag.includes("apfel"), "remove product works");
  console.assert(removeUnknownProductIdsFromOrders({ lena: { Montag: ["apfel", "unknown"] } }, fallbackProducts).lena.Montag.length === 1, "unknown products removed");
  console.assert(normalizeProduct({ id: "1", name: "A", price: "2.40", tags: ["x"], description: "Text" }).desc === "Text", "product normalize supports description");
  console.assert(normalizeChild({ id: "c1", name: "Mia", school: "GS", class_name: "1A", allergies: "Nüsse" }).className === "1A", "child normalize supports class_name");
  console.assert(normalizeCompletedOrder({ id: "o1", weekday: "Montag", total: "3.20", payment_method: "Stripe", status: "bezahlt", confirmation_email_sent: true }, initialChildren[0], demoUser).email === "gesendet", "completed order normalize supports email flag");
  console.assert(!getNavigationItems({ role: "parent" }).some(([id]) => id === "admin"), "parents do not see admin nav");
  console.assert(getNavigationItems({ role: "admin" }).some(([id]) => id === "admin"), "admins see admin nav");
  console.assert(buildOrderEmailPayload({ order: createLocalOrderRecord({ completedOrders: [], user: demoUser, child: initialChildren[0], day: "Montag", total: 4.2, paymentMethod: "PayPal" }), child: initialChildren[0], day: "Montag", selectedProducts: [fallbackProducts[0]], adminEmail: ADMIN_EMAIL, bakeryEmail: BAKERY_EMAIL }).paymentReference.startsWith(BANK_REFERENCE_PREFIX), "order email includes reference");
  console.assert(buildProductionEmailPayload({ day: "Montag", productSummary: [{ product: "Apfel", quantity: 3 }], adminEmail: ADMIN_EMAIL, bakeryEmail: BAKERY_EMAIL }).products[0].quantity === 3, "bakery payload includes quantities");
  console.assert(buildProductionOrderDetails({ childrenList: initialChildren, orderMap: initialOrders, day: "Montag", productList: fallbackProducts, parentName: demoUser.name, parentEmail: demoUser.email, completedOrders: initialCompletedOrders }).length === 2, "bakery details build rows");
  console.assert(buildPaymentConfirmationPayload({ order: initialCompletedOrders[2], adminEmail: ADMIN_EMAIL }).status === "bezahlt", "payment confirmation status is paid");
  console.assert(filterOrdersBySearch(initialCompletedOrders, "PAUSE-DEMO").length === 1, "admin search finds reference");
  console.assert(getParentOrderStats(initialCompletedOrders).count === initialCompletedOrders.length, "parent stats count orders");
  console.assert(getParentOrderStats(initialCompletedOrders).openCount === 1, "parent stats count open orders");
  console.assert(getAdminTodoSummary(initialCompletedOrders, [{ product: "Apfel", quantity: 2 }]).productionItems === 2, "admin todo summary counts production items");
  console.assert(getNetworkErrorMessage(new Error("Failed to fetch")).includes("Netzwerkfehler"), "network errors should become user-friendly");
}
if (typeof window !== "undefined") runSelfTests();

function Icon({ name, className = "h-4 w-4" }) {
  const icons = { home: "🏠", utensils: "🥪", basket: "🧺", user: "👧", school: "🏫", check: "✓", plus: "+", chevron: "›", admin: "⚙️", chart: "📊", mail: "✉️", payment: "💳", menu: "🍴", orders: "📋", children: "👨‍👩‍👧‍👦", clock: "⏰", salad: "🥗", euro: "€", bell: "🔔", calendar: "📅", warning: "⚠️" };
  return <span className={`inline-flex items-center justify-center leading-none ${className}`} aria-hidden="true">{icons[name] || "•"}</span>;
}

function StatCard({ label, value, hint, icon, tone = "slate" }) {
  const toneClass = {
    violet: "from-violet-50 to-white ring-violet-100 text-violet-700",
    emerald: "from-emerald-50 to-white ring-emerald-100 text-emerald-700",
    orange: "from-orange-50 to-white ring-orange-100 text-orange-700",
    blue: "from-blue-50 to-white ring-blue-100 text-blue-700",
    slate: "from-slate-50 to-white ring-slate-100 text-slate-700",
  }[tone] || "from-slate-50 to-white ring-slate-100 text-slate-700";

  return <Card className={`rounded-[1.5rem] border-0 bg-gradient-to-br ${toneClass} shadow-sm ring-1`}><CardContent className="p-6"><div className="mb-5 flex items-start justify-between gap-3"><span className="rounded-2xl bg-white/80 p-3 text-2xl shadow-sm"><Icon name={icon} className="h-7 w-7" /></span><span className="text-sm font-semibold text-slate-500">{label}</span></div><p className="text-4xl font-black tracking-tight text-slate-950">{value}</p><p className="mt-3 text-sm font-medium text-slate-500">{hint}</p></CardContent></Card>;
}

function QuickActionCard({ icon, title, desc, onClick, tone = "orange" }) {
  const toneClass = {
    orange: "from-orange-50 to-white ring-orange-100",
    yellow: "from-yellow-50 to-white ring-yellow-100",
    blue: "from-blue-50 to-white ring-blue-100",
    violet: "from-violet-50 to-white ring-violet-100",
    emerald: "from-emerald-50 to-white ring-emerald-100",
    slate: "from-slate-50 to-white ring-slate-100",
  }[tone] || "from-slate-50 to-white ring-slate-100";

  return <button onClick={onClick} className={`group rounded-[1.5rem] bg-gradient-to-br ${toneClass} p-5 text-left shadow-sm ring-1 transition hover:-translate-y-1 hover:shadow-md`}><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/80 text-3xl shadow-sm"><Icon name={icon} className="h-8 w-8" /></span><p className="mt-5 font-extrabold text-slate-950">{title}</p><p className="mt-2 min-h-[44px] text-sm leading-relaxed text-slate-600">{desc}</p><div className="mt-5 flex justify-end text-2xl text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-900">→</div></button>;
}

function ParentHome({ children, orders, completedOrders, onNavigate, onSelectChild, onSelectDay }) {
  const nextDay = weekdays.find((day) => children.some((child) => (orders[child.id]?.[day] || []).length > 0)) || weekdays[0];
  const nextDayOpen = isOrderDeadlineOpen(nextDay);
  const reminderMessage = getReminderMessage(nextDay);
  const openPayments = completedOrders.filter((order) => order.status === "offen");
  const paidOrders = completedOrders.filter((order) => order.status === "bezahlt");
  const openTotal = openPayments.reduce((sum, order) => sum + order.total, 0);
  const deadlineText = nextDayOpen ? formatOrderDeadline(nextDay) : "fixiert";

  function goToOrder() {
    onSelectChild(children[0]?.id || initialChildren[0].id);
    onSelectDay(nextDay);
    onNavigate("bestellen");
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">Guten Morgen, Stefan! 👋</h2>
          <p className="mt-2 text-lg text-slate-500">Schön, dass du da bist. Hier ist dein Überblick für heute.</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200"><Icon name="calendar" /> {new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}</div>
          <button className="relative rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200"><Icon name="bell" className="h-5 w-5" />{openPayments.length > 0 && <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">{openPayments.length}</span>}</button>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Offene Bestellungen" value={openPayments.length} hint="Zahlungen oder Prüfung offen" icon="basket" tone="violet" />
        <StatCard label="Bezahlt" value={paidOrders.length} hint="bereits bestätigt" icon="check" tone="emerald" />
        <StatCard label="Bestellfrist endet" value={nextDayOpen ? nextDay : "Fixiert"} hint={deadlineText} icon="clock" tone="orange" />
        <StatCard label="Offener Betrag" value={money(openTotal)} hint={`${openPayments.length} offene Bestellung(en)`} icon="euro" tone="blue" />
      </div>

      <Card className="rounded-[2rem] border-0 bg-white/90 shadow-sm ring-1 ring-slate-200">
        <CardContent className="p-6">
          <h3 className="text-2xl font-black tracking-tight">Schnellzugriff</h3>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <QuickActionCard icon="basket" title="Neue Bestellung" desc="Für deine Kinder bestellen" tone="orange" onClick={goToOrder} />
            <QuickActionCard icon="children" title="Kinder verwalten" desc="Kinder hinzufügen oder bearbeiten" tone="yellow" onClick={() => onNavigate("kinder")} />
            <QuickActionCard icon="payment" title="Zahlungen prüfen" desc="Zahlungsstatus einsehen" tone="blue" onClick={() => onNavigate("zahlung")} />
            <QuickActionCard icon="chart" title="Statistiken" desc="Übersichten und Auswertungen" tone="violet" onClick={() => onNavigate("statistiken")} />
            <QuickActionCard icon="school" title="Ausgabe / Bäckerei" desc="Produktionsliste anzeigen" tone="emerald" onClick={() => onNavigate("schule")} />
            <QuickActionCard icon="admin" title="Adminbereich" desc="Verwaltung und Einstellungen" tone="slate" onClick={() => onNavigate("admin")} />
          </div>
        </CardContent>
      </Card>

      <div className="rounded-[1.75rem] border border-yellow-200 bg-gradient-to-r from-yellow-50 to-orange-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 text-xl shadow-sm"><Icon name="warning" /></span>
            <div>
              <p className="text-lg font-black text-slate-950">{reminderMessage}</p>
              <p className="mt-1 text-sm text-slate-600">Bitte rechtzeitig bestellen, damit wir alles gut planen können.</p>
            </div>
          </div>
          <Button onClick={goToOrder} className="rounded-2xl bg-yellow-400 px-6 py-6 font-black text-slate-950 hover:bg-yellow-500">Jetzt bestellen <Icon name="chevron" className="ml-2" /></Button>
        </div>
      </div>
    </div>
  );
}

export default function PausenappMvpPrototype() {
  const [user, setUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState(ADMIN_EMAIL);
  const [loginPassword, setLoginPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("start");
  const [children, setChildren] = useState(initialChildren);
  const [activeChildId, setActiveChildId] = useState(initialChildren[0].id);
  const [activeDay, setActiveDay] = useState(weekdays[0]);
  const [orders, setOrders] = useState(initialOrders);
  const [completedOrders, setCompletedOrders] = useState(initialCompletedOrders);
  const [newChildName, setNewChildName] = useState("");
  const [pendingChildUpdates, setPendingChildUpdates] = useState({});
  const [selectedPayment, setSelectedPayment] = useState("Überweisung");
  const [lastConfirmation, setLastConfirmation] = useState("");
  const [lastOrder, setLastOrder] = useState(null);
  const [menuProducts, setMenuProducts] = useState(fallbackProducts);
  const [newProduct, setNewProduct] = useState({ name: "", price: "", tags: "", desc: "" });
  const [adminOrderSearch, setAdminOrderSearch] = useState("");
  const [adminFilter, setAdminFilter] = useState("alle");
  const [copiedText, setCopiedText] = useState("");
  const [paypalStatus, setPaypalStatus] = useState("");
  const [backendNotice, setBackendNotice] = useState(supabase ? "Supabase verbunden" : "Demo-Modus");
  const [dataLoading, setDataLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadSupabaseData() {
      if (!supabase) return;
      setDataLoading(true);
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        let loadedUser = null;
        if (authData?.user) {
          const { data: profile, error: profileError } = await supabase.from("profiles").select("id, email, full_name, role").eq("id", authData.user.id).maybeSingle();
          if (profileError) throw profileError;
          loadedUser = createUserFromProfile(authData.user, profile);
          setUser(loadedUser);
        } else {
          setUser(null);
        }
        const { data: productData, error: productError } = await supabase.from("products").select("id, name, description, price, tags, active").eq("active", true).order("name");
        if (productError) throw productError;
        if (Array.isArray(productData) && productData.length) {
          const normalizedProducts = productData.map(normalizeProduct);
          setMenuProducts(normalizedProducts);
          setOrders((prev) => removeUnknownProductIdsFromOrders(prev, normalizedProducts));
        }
        if (loadedUser?.id) await loadChildrenAndOrders(loadedUser);
        setBackendNotice(loadedUser ? "Kinder, Produkte und Bestellungen aus Supabase geladen" : "Produkte aus Supabase geladen. Bitte einloggen.");
      } catch (error) {
        setBackendNotice(getNetworkErrorMessage(error));
      } finally {
        setDataLoading(false);
      }
    }
    loadSupabaseData();
  }, []);

  async function loadChildrenAndOrders(loadedUser = user) {
    if (!supabase || !functionNeedsRealUser(loadedUser)) return;
    try {
      const { data: childData, error: childError } = await supabase.from("children").select("id, name, school, class_name, allergies").eq("parent_id", loadedUser.id).order("created_at", { ascending: true });
      if (childError) throw childError;
      const normalizedChildren = Array.isArray(childData) && childData.length ? childData.map(normalizeChild) : initialChildren;
      setChildren(normalizedChildren);
      setActiveChildId(normalizedChildren[0]?.id || initialChildren[0].id);
      const { data: orderData, error: orderError } = await supabase.from("orders").select("id, child_id, school, weekday, total, payment_method, payment_reference, status, confirmation_email_sent, created_at").eq("parent_id", loadedUser.id).order("created_at", { ascending: false }).limit(25);
      if (orderError) throw orderError;
      if (Array.isArray(orderData)) setCompletedOrders(orderData.map((order) => normalizeCompletedOrder(order, normalizedChildren.find((child) => child.id === order.child_id), loadedUser)));
    } catch (error) {
      setBackendNotice(`Daten konnten nicht geladen werden: ${getNetworkErrorMessage(error)}`);
    }
  }

  async function loginWithPassword() {
    if (!supabase) return setBackendNotice("Supabase ist nicht konfiguriert.");
    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
      if (error) throw error;
      const { data: profile, error: profileError } = await supabase.from("profiles").select("id, email, full_name, role").eq("id", data.user.id).maybeSingle();
      if (profileError) throw profileError;
      const loggedInUser = createUserFromProfile(data.user, profile);
      setUser(loggedInUser);
      await loadChildrenAndOrders(loggedInUser);
      setBackendNotice("Login erfolgreich. Kinder und Bestellungen geladen");
    } catch (error) {
      setBackendNotice(`Login fehlgeschlagen: ${getNetworkErrorMessage(error)}`);
    } finally {
      setAuthLoading(false);
    }
  }

  async function logout() {
    try {
      if (supabase) await supabase.auth.signOut();
    } catch (error) {
      setBackendNotice(getNetworkErrorMessage(error));
    }
    setUser(null);
    setBackendNotice("Abgemeldet");
  }

  const hasRealSupabaseUser = functionNeedsRealUser(user);
  const currentUser = hasRealSupabaseUser ? user : demoUser;
  const navigationItems = getNavigationItems(currentUser);
  const activeChild = children.find((child) => child.id === activeChildId) || children[0];
  const weeklyTotal = useMemo(() => calculateWeeklyTotal(orders, menuProducts), [orders, menuProducts]);
  const activeDayTotal = calculateChildDayTotal(activeChild.id, activeDay, orders, menuProducts);
  const dayItems = orders[activeChild.id]?.[activeDay] || [];
  const activeDeadlineOpen = isOrderDeadlineOpen(activeDay);
  const activeOrderEditable = isOrderEditable(activeDay);
  const activeLockStatus = getOrderLockStatus(activeDay);
  const activeReminderMessage = getReminderMessage(activeDay);
  const schoolRows = buildSchoolRows(children, orders, activeDay, menuProducts);
  const productSummary = buildProductSummary(children, orders, activeDay, menuProducts);
  const paidRevenue = completedOrders.filter((order) => order.status === "bezahlt").reduce((sum, order) => sum + order.total, 0);
  const openRevenue = completedOrders.filter((order) => order.status === "offen").reduce((sum, order) => sum + order.total, 0);
  const filteredAdminOrders = useMemo(() => {
    let list = filterOrdersBySearch(completedOrders, adminOrderSearch);
    if (adminFilter === "offen") list = list.filter((order) => order.status === "offen");
    if (adminFilter === "bezahlt") list = list.filter((order) => order.status === "bezahlt");
    return list;
  }, [completedOrders, adminOrderSearch, adminFilter]);
  const parentOrderStats = useMemo(() => getParentOrderStats(completedOrders), [completedOrders]);
  const adminTodoSummary = useMemo(() => getAdminTodoSummary(completedOrders, productSummary), [completedOrders, productSummary]);

  async function copyToClipboard(text, label = "Text") {
    try {
      await navigator.clipboard.writeText(String(text));
      setCopiedText(`${label} kopiert`);
    } catch {
      setCopiedText(`${label} konnte nicht kopiert werden`);
    }
  }

  function openPayPalPayment() {
    const opened = window.open(PAYPAL_PAYMENT_LINK, "_blank", "noopener,noreferrer");
    setPaypalStatus(opened ? "PayPal wurde geöffnet. Bitte dort Betrag und Verwendungszweck angeben." : "PayPal konnte vom Browser nicht automatisch geöffnet werden. Bitte Link kopieren und im Browser öffnen.");
  }

  function toggleProduct(productId) {
    if (!activeOrderEditable) {
      setBackendNotice(`Bestellungen für ${activeDay} sind nach der Frist fixiert.`);
      return;
    }
    setOrders((prev) => {
      const childOrders = prev[activeChild.id] || {};
      const current = childOrders[activeDay] || [];
      const next = current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId];
      return { ...prev, [activeChild.id]: { ...childOrders, [activeDay]: next } };
    });
  }

  async function addChild() {
    const trimmed = newChildName.trim();
    if (!trimmed) return;
    const localChild = { id: slugify(trimmed) || `kind-${children.length + 1}`, name: trimmed, school: "Grundschule Zentrum", className: "1A", allergies: "keine" };
    if (supabase && functionNeedsRealUser(user)) {
      try {
        const { data, error } = await supabase.from("children").insert({ parent_id: user.id, name: localChild.name, school: localChild.school, class_name: localChild.className, allergies: localChild.allergies }).select("id, name, school, class_name, allergies").single();
        if (error) throw error;
        const savedChild = normalizeChild(data);
        setChildren((prev) => [...prev, savedChild]);
        setActiveChildId(savedChild.id);
        setBackendNotice("Kind in Supabase gespeichert");
      } catch (error) {
        setBackendNotice(`Kind konnte nicht gespeichert werden: ${getNetworkErrorMessage(error)}`);
      }
    } else {
      setChildren((prev) => [...prev, localChild]);
      setActiveChildId(localChild.id);
      setBackendNotice("Kind lokal hinzugefügt. Für Supabase bitte einloggen.");
    }
    setNewChildName("");
  }

  async function saveChildChanges(childId) {
    const child = children.find((item) => item.id === childId);
    const updates = pendingChildUpdates[childId];
    if (!child || !updates) return setBackendNotice("Keine Änderungen zum Speichern vorhanden.");
    if (!supabase || !functionNeedsRealUser(user) || !isUuid(childId)) return setBackendNotice("Änderungen sind lokal vorgemerkt. Für Supabase bitte einloggen.");
    const dbUpdates = {};
    if (Object.prototype.hasOwnProperty.call(updates, "className")) dbUpdates.class_name = child.className;
    if (Object.prototype.hasOwnProperty.call(updates, "allergies")) dbUpdates.allergies = child.allergies;
    setIsSaving(true);
    try {
      const { error } = await supabase.from("children").update(dbUpdates).eq("id", childId).eq("parent_id", user.id);
      if (error) throw error;
      setPendingChildUpdates((prev) => {
        const next = { ...prev };
        delete next[childId];
        return next;
      });
      setBackendNotice("Kind gespeichert");
    } catch (error) {
      setBackendNotice(`Kind konnte nicht gespeichert werden: ${getNetworkErrorMessage(error)}`);
    } finally {
      setIsSaving(false);
    }
  }

  function handleChildAllergiesChange(childId, allergies) {
    setChildren((prev) => updateChildAllergies(prev, childId, allergies));
    setPendingChildUpdates((prev) => mergeChildDraft(prev, childId, { allergies }));
  }

  function handleChildClassChange(childId, className) {
    setChildren((prev) => updateChildClass(prev, childId, className));
    setPendingChildUpdates((prev) => mergeChildDraft(prev, childId, { className }));
  }

  async function ensureChildInSupabase(child) {
    if (!supabase || !functionNeedsRealUser(user)) return null;
    if (isUuid(child.id)) return child.id;
    const { data: existingChild, error: existingError } = await supabase.from("children").select("id").eq("parent_id", user.id).eq("name", child.name).eq("school", child.school).eq("class_name", child.className).maybeSingle();
    if (existingError) throw existingError;
    if (existingChild?.id) return existingChild.id;
    const { data: insertedChild, error: insertError } = await supabase.from("children").insert({ parent_id: user.id, name: child.name, school: child.school, class_name: child.className, allergies: child.allergies || "keine" }).select("id").single();
    if (insertError) throw insertError;
    return insertedChild.id;
  }

  async function invokeEmailFunction(type, payload) {
    if (!supabase) return { sent: false, reason: "Supabase ist nicht verbunden." };
    try {
      const { error } = await supabase.functions.invoke(EMAIL_FUNCTION_NAME, { method: "POST", headers: { "Content-Type": "application/json" }, body: { type, payload } });
      if (error) return { sent: false, reason: error.message };
      return { sent: true };
    } catch (error) {
      return { sent: false, reason: getNetworkErrorMessage(error) };
    }
  }

  async function sendOrderEmails({ savedOrder, selectedProducts }) {
    const payload = buildOrderEmailPayload({ order: savedOrder, child: activeChild, day: activeDay, selectedProducts, adminEmail: ADMIN_EMAIL, bakeryEmail: BAKERY_EMAIL });
    const result = await invokeEmailFunction("order_confirmation", payload);
    if (result.sent && isUuid(savedOrder.id)) {
      try {
        await supabase.from("orders").update({ confirmation_email_sent: true }).eq("id", savedOrder.id);
      } catch (error) {
        setBackendNotice(getNetworkErrorMessage(error));
      }
    }
    return result;
  }

  async function sendPaymentConfirmationEmail(order) {
    return invokeEmailFunction("payment_confirmed", buildPaymentConfirmationPayload({ order, adminEmail: ADMIN_EMAIL }));
  }

  async function sendReminderEmail(type, order = null) {
    if (!supabase) return setBackendNotice("Supabase ist nicht verbunden.");
    const payload = order ? { adminEmail: ADMIN_EMAIL, parentName: order.parent, parentEmail: order.parentEmail, childName: order.child, weekday: order.day, total: order.total, paymentMethod: order.payment, paymentReference: order.paymentReference } : { adminEmail: ADMIN_EMAIL, parentName: currentUser.name, parentEmail: currentUser.email, weekday: activeDay, deadline: formatOrderDeadline(activeDay) };
    setIsSaving(true);
    const result = await invokeEmailFunction(type, payload);
    setIsSaving(false);
    setBackendNotice(result.sent ? "Reminder-Mail gesendet" : `Reminder konnte nicht gesendet werden: ${result.reason}`);
  }

  function printBakeryList() {
    window.print();
  }

  async function sendProductionListToBakery() {
    if (!supabase) return setBackendNotice("Supabase ist nicht verbunden.");
    if (!productSummary.length) return setBackendNotice("Keine Produkte für diesen Tag vorhanden.");
    setIsSaving(true);
    try {
      const orderDetails = buildProductionOrderDetails({ childrenList: children, orderMap: orders, day: activeDay, productList: menuProducts, parentName: currentUser.name, parentEmail: currentUser.email, completedOrders });
      const result = await invokeEmailFunction("bakery_production_list", buildProductionEmailPayload({ day: activeDay, productSummary, adminEmail: ADMIN_EMAIL, bakeryEmail: BAKERY_EMAIL, orderDetails }));
      if (!result.sent) throw new Error(result.reason);
      setBackendNotice(`Produktionsliste an ${BAKERY_EMAIL} gesendet`);
    } catch (error) {
      setBackendNotice(`E-Mail-Versand fehlgeschlagen: ${getNetworkErrorMessage(error)}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function saveOrderToSupabase(localOrder) {
    if (!supabase || !functionNeedsRealUser(user)) return { saved: false, reason: "Keine echte Supabase-Session aktiv." };
    const selectedProducts = dayItems.map((productId) => menuProducts.find((product) => product.id === productId)).filter(Boolean);
    if (!selectedProducts.length) return { saved: false, reason: "Keine Produkte ausgewählt." };
    if (!selectedProducts.every((product) => isUuid(product.id))) return { saved: false, reason: "Mindestens ein Produkt stammt noch aus Demo-Daten." };
    try {
      const childId = await ensureChildInSupabase(activeChild);
      if (!childId) return { saved: false, reason: "Kind konnte nicht in Supabase angelegt werden." };
      const { data: insertedOrder, error: orderError } = await supabase.from("orders").insert({ parent_id: user.id, child_id: childId, school: activeChild.school, delivery_date: getNextDeliveryDate(activeDay), weekday: activeDay, total: activeDayTotal, payment_method: selectedPayment, payment_reference: localOrder.paymentReference, status: localOrder.status, confirmation_email_sent: false, bakery_email_sent: false }).select("id").single();
      if (orderError) throw orderError;
      const orderItems = selectedProducts.map((product) => ({ order_id: insertedOrder.id, product_id: product.id, product_name: product.name, quantity: 1, unit_price: product.price }));
      const { error: itemError } = await supabase.from("order_items").insert(orderItems);
      if (itemError) throw itemError;
      return { saved: true, orderId: insertedOrder.id, selectedProducts };
    } catch (error) {
      return { saved: false, reason: getNetworkErrorMessage(error) };
    }
  }

  async function confirmOrder() {
    if (!activeDeadlineOpen) {
      setLastConfirmation(`Bestellfrist für ${activeDay} ist abgelaufen. Bitte wähle einen anderen Tag.`);
      setLastOrder(null);
      return;
    }
    if (!dayItems.length) {
      setLastConfirmation("Bitte wähle zuerst mindestens ein Produkt aus.");
      setLastOrder(null);
      return;
    }
    const localOrder = createLocalOrderRecord({ completedOrders, user, child: activeChild, day: activeDay, total: activeDayTotal, paymentMethod: selectedPayment });
    setIsSaving(true);
    setPaypalStatus("");
    try {
      const result = await saveOrderToSupabase(localOrder);
      const savedOrder = result.saved ? { ...localOrder, id: result.orderId } : localOrder;
      if (!result.saved) {
        setCompletedOrders((prev) => [savedOrder, ...prev]);
        setLastOrder(null);
        setLastConfirmation(`Bestellung nicht in Supabase gespeichert: ${result.reason}`);
        return;
      }
      let finalOrder = { ...savedOrder };
      if (selectedPayment === "PayPal") {
        setPaypalStatus("Bestellung gespeichert. Bitte öffne PayPal über den Button unten und gib dort Betrag und Verwendungszweck an.");
        finalOrder = { ...savedOrder, status: "offen" };
      }
      const emailResult = await sendOrderEmails({ savedOrder: finalOrder, selectedProducts: result.selectedProducts });
      finalOrder = { ...finalOrder, email: emailResult.sent ? "gesendet" : "vorgemerkt" };
      setCompletedOrders((prev) => [finalOrder, ...prev]);
      setLastOrder(finalOrder);
      setLastConfirmation(emailResult.sent ? "Bestellung erfolgreich!" : `Bestellung gespeichert, aber E-Mail-Problem: ${emailResult.reason}`);
      setBackendNotice(emailResult.sent ? "Bestellung gespeichert und E-Mails gesendet" : "Bestellung gespeichert, E-Mail-Versand offen");
      await loadChildrenAndOrders(user);
    } catch (error) {
      setLastOrder(null);
      setLastConfirmation(`Fehler beim Speichern: ${getNetworkErrorMessage(error)}`);
      setBackendNotice(`Supabase-Fehler: ${getNetworkErrorMessage(error)}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function markPaid(orderId) {
    const orderToConfirm = completedOrders.find((order) => order.id === orderId);
    const paidOrder = orderToConfirm ? { ...orderToConfirm, status: "bezahlt" } : null;
    setCompletedOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, status: "bezahlt" } : order)));
    if (supabase && functionNeedsRealUser(user) && isUuid(orderId)) {
      setIsSaving(true);
      try {
        const { error } = await supabase.from("orders").update({ status: "bezahlt" }).eq("id", orderId);
        if (error) throw error;
        const emailResult = paidOrder ? await sendPaymentConfirmationEmail(paidOrder) : { sent: false, reason: "Bestellung nicht gefunden." };
        setBackendNotice(emailResult.sent ? "Zahlung bestätigt und E-Mail an Eltern gesendet" : `Zahlung bestätigt, aber E-Mail konnte nicht gesendet werden: ${emailResult.reason}`);
      } catch (error) {
        setBackendNotice(`Zahlungsstatus konnte nicht gespeichert werden: ${getNetworkErrorMessage(error)}`);
      } finally {
        setIsSaving(false);
      }
    } else {
      setBackendNotice("Zahlung lokal als bezahlt markiert");
    }
  }

  async function addProduct() {
    const product = createProductFromForm(newProduct);
    if (!product) return;
    setIsSaving(true);
    try {
      if (supabase && user?.role === "admin" && functionNeedsRealUser(user)) {
        const { data, error } = await supabase.from("products").insert({ name: product.name, description: product.desc, price: product.price, tags: product.tags, active: true }).select("id, name, description, price, tags, active").single();
        if (error) throw error;
        setMenuProducts((prev) => [...prev, normalizeProduct(data)]);
        setBackendNotice("Produkt in Supabase gespeichert");
      } else {
        let id = product.id;
        let counter = 2;
        while (menuProducts.some((item) => item.id === id)) {
          id = `${product.id}-${counter}`;
          counter += 1;
        }
        setMenuProducts((prev) => [...prev, { ...product, id }]);
        setBackendNotice("Produkt lokal hinzugefügt. Für Supabase bitte als Admin einloggen.");
      }
      setNewProduct({ name: "", price: "", tags: "", desc: "" });
    } catch (error) {
      setBackendNotice(`Produkt konnte nicht gespeichert werden: ${getNetworkErrorMessage(error)}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function updateProduct(productId, field, value) {
    let nextValue = value;
    if (field === "price") {
      const parsed = Number.parseFloat(String(value).replace(",", "."));
      if (Number.isNaN(parsed)) return;
      nextValue = parsed;
    }
    if (field === "tags") nextValue = String(value).split(",").map((tag) => tag.trim()).filter(Boolean);
    setMenuProducts((prev) => prev.map((product) => (product.id === productId ? { ...product, [field]: nextValue } : product)));
    if (supabase && user?.role === "admin" && functionNeedsRealUser(user) && isUuid(productId)) {
      try {
        const dbField = field === "desc" ? "description" : field;
        const { error } = await supabase.from("products").update({ [dbField]: nextValue }).eq("id", productId);
        if (error) throw error;
        setBackendNotice("Produktänderung in Supabase gespeichert");
      } catch (error) {
        setBackendNotice(`Produktänderung nicht gespeichert: ${getNetworkErrorMessage(error)}`);
      }
    }
  }

  async function deleteProduct(productId) {
    setMenuProducts((prev) => prev.filter((product) => product.id !== productId));
    setOrders((prev) => removeProductFromOrders(prev, productId));
    if (supabase && user?.role === "admin" && functionNeedsRealUser(user) && isUuid(productId)) {
      try {
        const { error } = await supabase.from("products").update({ active: false }).eq("id", productId);
        if (error) throw error;
        setBackendNotice("Produkt in Supabase deaktiviert");
      } catch (error) {
        setBackendNotice(`Produkt konnte nicht gelöscht werden: ${getNetworkErrorMessage(error)}`);
      }
    } else {
      setBackendNotice("Produkt lokal entfernt");
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <div className="grid min-h-screen gap-6 p-4 lg:grid-cols-[280px_1fr] lg:p-6">
        <aside className="hidden rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:flex lg:flex-col">
          <div className="flex items-center gap-3 px-2 py-3">
            <span className="text-4xl">🥪</span>
            <div>
              <p className="text-2xl font-black tracking-tight">Pausenapp</p>
              <p className="text-sm font-medium text-slate-500">Einfach. Bestellt.</p>
            </div>
          </div>

          <nav className="mt-8 space-y-2">
            {navigationItems.map(([id, iconName, label]) => (
              <button key={id} onClick={() => setActiveTab(id)} className={`flex w-full items-center gap-4 rounded-2xl px-5 py-4 text-left text-base font-bold transition ${activeTab === id ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-100" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}>
                <Icon name={id === "start" ? "home" : iconName} className="h-5 w-5" />
                {label === "Ausgabe" ? "Ausgabe / Bäckerei" : label}
              </button>
            ))}
          </nav>

          <div className="mt-auto rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500 font-black text-white">SE</span>
              <div>
                <p className="font-extrabold">{currentUser.name}</p>
                <p className="text-sm font-semibold text-indigo-600">{currentUser.role === "admin" ? "Administrator" : "Elternkonto"}</p>
              </div>
            </div>
            <div className="mt-4 border-t pt-4">
              {hasRealSupabaseUser ? <button onClick={logout} className="text-sm font-bold text-slate-500 hover:text-slate-950">↪ Abmelden</button> : <span className="text-xs font-semibold text-amber-700">Lokaler Vorschaumodus</span>}
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-4 rounded-[1.5rem] bg-white p-3 shadow-sm ring-1 ring-slate-200 lg:hidden">
            <div className="mb-3 flex items-center justify-between px-2"><div className="flex items-center gap-2"><span className="text-2xl">🥪</span><span className="font-black">Pausenapp</span></div><span className="text-xs font-semibold text-slate-500">{currentUser.role === "admin" ? "Admin" : "Eltern"}</span></div>
            <nav className="grid grid-cols-3 gap-2 sm:grid-cols-6">{navigationItems.map(([id, iconName, label]) => <button key={id} onClick={() => setActiveTab(id)} className={`rounded-2xl px-3 py-3 text-xs font-bold transition ${activeTab === id ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-600"}`}><Icon name={id === "start" ? "home" : iconName} className="mx-auto mb-1 h-4 w-4" />{label}</button>)}</nav>
          </div>

          <main className="rounded-[2rem] bg-white/90 p-5 shadow-sm ring-1 ring-slate-200 lg:p-8">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400">
              <span>{dataLoading ? "Daten werden geladen..." : backendNotice}</span>
              {!hasRealSupabaseUser && <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">Speichern nur lokal</span>}
            </div>

        {!hasRealSupabaseUser && <Card className="mb-6 rounded-2xl border-2 border-amber-300 bg-amber-50 shadow-sm"><CardContent className="grid gap-3 p-5 md:grid-cols-[1fr_1fr_auto] md:items-end"><div className="md:col-span-3"><h2 className="text-xl font-bold text-amber-950">Supabase Login erforderlich</h2><p className="mt-1 text-sm text-amber-800">Bitte hier mit deinem Supabase-Admin-User einloggen. Falls die Vorschau Supabase blockiert, läuft die App lokal weiter.</p></div><div><label className="text-sm font-semibold text-slate-600">Admin E-Mail</label><Input value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} className="mt-2 rounded-xl" /></div><div><label className="text-sm font-semibold text-slate-600">Passwort</label><Input type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} className="mt-2 rounded-xl" /></div><Button onClick={loginWithPassword} disabled={authLoading || !loginPassword} className="rounded-xl">{authLoading ? "Login..." : "Einloggen"}</Button></CardContent></Card>}

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          {activeTab === "start" && <ParentHome children={children} orders={orders} completedOrders={completedOrders} onNavigate={setActiveTab} onSelectChild={setActiveChildId} onSelectDay={setActiveDay} />}

          {activeTab === "bestellen" && <div className="grid gap-6 lg:grid-cols-[280px_1fr]"><Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-5"><h2 className="mb-4 text-xl font-bold">Kind auswählen</h2><div className="space-y-2">{children.map((child) => <button key={child.id} onClick={() => setActiveChildId(child.id)} className={`w-full rounded-xl border p-4 text-left transition ${activeChildId === child.id ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white hover:bg-slate-50"}`}><p className="font-bold">{child.name}</p><p className={`text-sm ${activeChildId === child.id ? "text-slate-200" : "text-slate-500"}`}>{child.className} · {child.school}</p></button>)}</div></CardContent></Card><Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-5 md:p-7"><div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><p className="text-sm font-semibold text-emerald-700">Bestellung für {activeChild.name}</p><h2 className="text-2xl font-bold">Pause für {activeDay}</h2><div className="mt-2 rounded-xl bg-yellow-50 p-3 text-sm font-semibold text-yellow-800">{activeReminderMessage}</div><p className="mt-2 text-sm text-slate-500">Allergien: {activeChild.allergies}</p><p className="mt-2 text-xs font-semibold text-slate-500">Status: {activeLockStatus === "fixiert" ? "Bestellungen fixiert" : "Änderungen noch möglich"}</p></div><Button onClick={() => setActiveTab("zahlung")} disabled={!activeDeadlineOpen} className="rounded-xl">{activeDeadlineOpen ? `Zur Zahlung · ${money(activeDayTotal)}` : "Frist abgelaufen"} <Icon name="chevron" className="ml-1 h-4 w-4" /></Button></div><div className="mb-6 flex flex-wrap gap-2">{weekdays.map((day) => <button key={day} onClick={() => setActiveDay(day)} className={`rounded-full px-4 py-2 text-sm font-semibold ${activeDay === day ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"}`}>{day.slice(0, 2)}</button>)}</div><div className="grid gap-4 md:grid-cols-2">{menuProducts.map((product) => { const selected = dayItems.includes(product.id); return <button key={product.id} onClick={() => toggleProduct(product.id)} disabled={!activeOrderEditable} className={`rounded-2xl border p-5 text-left transition ${selected ? "border-emerald-600 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"} ${!activeOrderEditable ? "cursor-not-allowed opacity-60" : ""}`}><div className="flex items-start justify-between gap-4"><div><h3 className="font-bold">{product.name}</h3><p className="mt-1 text-sm text-slate-500">{product.desc}</p></div><div className="text-right"><p className="font-bold">{money(product.price)}</p>{selected && <span className="ml-auto mt-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white"><Icon name="check" /></span>}</div></div><div className="mt-4 flex flex-wrap gap-2">{product.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{tag}</span>)}</div></button>; })}</div></CardContent></Card></div>}

          {activeTab === "zahlung" && <div className="grid gap-6 lg:grid-cols-[1fr_360px]"><Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-6"><h2 className="text-2xl font-bold">Bestellung bezahlen</h2><p className="mt-2 text-slate-600">Eltern melden sich einmal an, hinterlegen Kinder und bezahlen Bestellungen direkt oder per Überweisung.</p><p className={`mt-4 rounded-2xl p-4 text-sm font-semibold ${activeDeadlineOpen ? "bg-orange-50 text-orange-700" : "bg-red-50 text-red-700"}`}>{activeDeadlineOpen ? `Bestellfrist für ${activeDay}: ${formatOrderDeadline(activeDay)}` : `Bestellfrist für ${activeDay} ist abgelaufen. Bitte wähle einen anderen Tag.`}</p><div className="mt-6 grid gap-4 md:grid-cols-2">{paymentMethods.map((method) => { const isLive = livePaymentMethods.includes(method); return <button key={method} onClick={() => setSelectedPayment(method)} className={`rounded-2xl border p-5 text-left ${selectedPayment === method ? "border-emerald-600 bg-emerald-50" : "border-slate-200 bg-white"}`}><div className="flex items-start justify-between gap-3"><p className="text-lg font-bold">{method}</p>{!isLive && <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">Demo</span>}</div><p className="mt-1 text-sm text-slate-500">{getPaymentHint(method)}</p></button>; })}{selectedPayment === "PayPal" && <div className="mt-2 rounded-2xl border border-blue-200 bg-blue-50 p-5 ring-1 ring-blue-100 md:col-span-2"><p className="text-sm font-semibold text-blue-900">PayPal Checkout</p><p className="mt-2 text-sm text-blue-800">Nach dem Speichern öffnest du PayPal über einen Button. Bitte verwende dort denselben Betrag und den angezeigten Verwendungszweck.</p><Button type="button" onClick={openPayPalPayment} className="mt-4 rounded-xl bg-blue-700 text-white hover:bg-blue-800">PayPal manuell öffnen</Button><div className="mt-3 rounded-xl bg-white p-3 text-xs text-blue-900"><p className="font-semibold">Falls der Button nicht reagiert:</p><p className="break-all font-mono">{PAYPAL_PAYMENT_LINK}</p><button type="button" onClick={() => copyToClipboard(PAYPAL_PAYMENT_LINK, "PayPal-Link")} className="mt-2 rounded-lg bg-blue-100 px-3 py-1 font-semibold text-blue-800">Link kopieren</button></div>{paypalStatus && <p className="mt-3 rounded-xl bg-white p-3 text-sm font-semibold text-blue-900">{paypalStatus}</p>}</div>}{selectedPayment === "Überweisung" && <div className="mt-2 rounded-2xl border bg-white p-5 ring-1 ring-slate-200 md:col-span-2"><p className="text-sm font-semibold text-slate-600">Überweisungsdaten</p><div className="mt-3 grid gap-2 text-sm"><div className="flex justify-between gap-3"><span className="text-slate-500">Empfänger</span><span className="font-semibold">{BANK_RECIPIENT}</span></div><div className="flex justify-between gap-3"><span className="text-slate-500">IBAN</span><span className="flex items-center gap-2 font-mono font-semibold">{BANK_IBAN}<button onClick={() => copyToClipboard(BANK_IBAN, "IBAN")} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-sans text-slate-700">Kopieren</button></span></div><div className="flex justify-between gap-3"><span className="text-slate-500">BIC</span><span className="font-mono">{BANK_BIC || "nicht erforderlich"}</span></div><div className="flex justify-between gap-3"><span className="text-slate-500">Verwendungszweck</span><span className="font-semibold">Wird nach Bestellung eindeutig erstellt</span></div></div><p className="mt-3 text-xs text-slate-500">Bitte gib den Verwendungszweck exakt an, damit die Zahlung automatisch zugeordnet werden kann.</p>{copiedText && <p className="mt-2 text-xs font-semibold text-emerald-700">{copiedText}</p>}</div>}</div><div className="mt-6 rounded-2xl bg-slate-100 p-4"><p className="text-sm font-semibold text-slate-600">Eingeloggt als</p><p className="mt-1 font-bold">{currentUser.name}</p><p className="text-sm text-slate-600">Bestätigung an: {currentUser.email}</p><p className="text-sm text-slate-600">Admin-Kopie an: {ADMIN_EMAIL}</p></div><Button onClick={confirmOrder} disabled={isSaving || !activeDeadlineOpen} className="mt-6 rounded-xl">{isSaving ? "Speichere..." : activeDeadlineOpen ? "Jetzt bestellen und bestätigen" : "Bestellfrist abgelaufen"}</Button>{lastConfirmation && !lastOrder && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-800">{lastConfirmation}</p>}{lastConfirmation && lastOrder && <div className="mt-6 rounded-2xl bg-emerald-50 p-6 text-emerald-900 shadow-sm"><div className="flex items-center gap-3 text-lg font-bold"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white">✓</span>Bestellung erfolgreich</div><p className="mt-3 text-sm">{lastOrder.child} · {lastOrder.day}</p><p className="text-sm">Gesamt: {money(lastOrder.total)}</p><p className="mt-4 text-sm font-semibold">Verwendungszweck</p><p className="text-xs font-bold text-red-600">WICHTIG: exakt so angeben!</p><div className="mt-1 flex flex-col gap-2 rounded-lg bg-white p-2 sm:flex-row sm:items-center sm:justify-between"><p className="font-mono text-sm">{lastOrder.paymentReference}</p><Button onClick={() => copyToClipboard(lastOrder.paymentReference, "Verwendungszweck")} variant="outline" className="rounded-xl">Kopieren</Button></div><p className="mt-3 text-xs text-slate-600">Bitte genau diesen Verwendungszweck bei Überweisung oder PayPal angeben.</p>{copiedText && <p className="mt-2 text-xs font-semibold text-emerald-700">{copiedText}</p>}{lastOrder.payment === "PayPal" && <Button type="button" onClick={openPayPalPayment} className="mt-4 rounded-xl bg-blue-700 text-white hover:bg-blue-800">Jetzt mit PayPal bezahlen</Button>}<Button onClick={() => { setActiveTab("start"); setLastConfirmation(""); setLastOrder(null); }} className="mt-4 rounded-xl">Zur Startseite</Button></div>}</CardContent></Card><Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-6"><h3 className="text-xl font-bold">Zusammenfassung</h3><p className="mt-4 text-sm text-slate-500">Kind</p><p className="font-semibold">{activeChild.name}</p><p className="mt-4 text-sm text-slate-500">Tag</p><p className="font-semibold">{activeDay}</p><p className="mt-4 text-sm text-slate-500">Produkte</p><p className="font-semibold">{dayItems.length ? dayItems.map((id) => menuProducts.find((product) => product.id === id)?.name).filter(Boolean).join(", ") : "Keine Produkte gewählt"}</p><p className="mt-4 text-sm text-slate-500">Zahlungsstatus</p><p className="font-semibold">{selectedPayment === "Überweisung" ? "offen bis Zahlungseingang" : selectedPayment === "PayPal" ? "offen bis Admin bestätigt" : "Demo: als bezahlt markiert"}</p><div className="mt-6 rounded-2xl bg-slate-950 p-5 text-white"><p className="text-sm text-slate-300">Gesamt</p><p className="text-3xl font-bold">{money(activeDayTotal)}</p></div></CardContent></Card></div>}

          {activeTab === "kinder" && <Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-6"><h2 className="mb-4 text-2xl font-bold">Kinder verwalten</h2><div className="mb-6 flex gap-2"><Input value={newChildName} onChange={(event) => setNewChildName(event.target.value)} placeholder="Name des Kindes" className="rounded-xl" /><Button onClick={addChild} className="rounded-xl"><Icon name="plus" className="mr-1 h-4 w-4" /> Hinzufügen</Button></div><div className="grid gap-4 md:grid-cols-2">{children.map((child) => <div key={child.id} className="rounded-2xl border bg-white p-5"><h3 className="text-lg font-bold">{child.name}</h3><p className="text-slate-500">{child.school}</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><div><label className="text-sm font-semibold text-slate-600">Klasse</label><Input value={child.className} onChange={(event) => handleChildClassChange(child.id, event.target.value)} className="mt-2 rounded-xl" placeholder="z. B. 2B" /></div><div><label className="text-sm font-semibold text-slate-600">Allergien & Präferenzen</label><Input value={child.allergies} onChange={(event) => handleChildAllergiesChange(child.id, event.target.value)} className="mt-2 rounded-xl" placeholder="z. B. Nüsse, Laktose, vegetarisch" /></div></div><div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Wird bei Bestellungen angezeigt: {child.allergies || "keine Angabe"}</p><Button onClick={() => saveChildChanges(child.id)} disabled={isSaving || !pendingChildUpdates[child.id]} className="rounded-xl">{pendingChildUpdates[child.id] ? (isSaving ? "Speichert..." : "Speichern") : "Gespeichert"}</Button></div></div>)}</div></CardContent></Card>}

          {activeTab === "statistiken" && <div className="space-y-6"><div className="grid gap-4 md:grid-cols-4"><StatCard label="Bestellungen" value={parentOrderStats.count} hint="bisher erfasst" icon="basket" /><StatCard label="Bezahlt" value={money(parentOrderStats.paidTotal)} hint="bereits bestätigt" icon="payment" /><StatCard label="Offen" value={money(parentOrderStats.openTotal)} hint="noch zu bezahlen" icon="mail" /><StatCard label="Kinder" value={children.length} hint="im Account" icon="user" /></div><Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-6"><h2 className="mb-4 text-2xl font-bold">Meine Bestellungen</h2><div className="space-y-3">{completedOrders.length ? completedOrders.map((order) => <div key={order.id} className="rounded-2xl border bg-white p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-bold">{order.child} · {order.day}</p><p className="text-sm text-slate-500">{order.payment} · {money(order.total)}</p>{order.paymentReference && <p className="mt-2 font-mono text-xs text-slate-600">{order.paymentReference}</p>}</div><span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${order.status === "bezahlt" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{order.status}</span></div>{order.status === "offen" && order.paymentReference && <Button onClick={() => copyToClipboard(order.paymentReference, "Verwendungszweck")} variant="outline" className="mt-3 rounded-xl">Verwendungszweck kopieren</Button>}</div>) : <p className="rounded-2xl bg-white p-5 text-slate-500">Noch keine Bestellungen vorhanden.</p>}</div></CardContent></Card><Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-6"><h2 className="mb-4 text-2xl font-bold">Wochenübersicht</h2><div className="grid gap-3 md:grid-cols-5">{weekdays.map((day) => <div key={day} className="rounded-2xl bg-white p-4 ring-1 ring-slate-100"><p className="text-sm text-slate-500">{day}</p><p className="mt-2 text-2xl font-bold">{money(children.reduce((sum, child) => sum + calculateChildDayTotal(child.id, day, orders, menuProducts), 0))}</p><p className={`mt-2 text-xs font-semibold ${isOrderEditable(day) ? "text-orange-600" : "text-red-600"}`}>{isOrderEditable(day) ? "offen" : "fixiert"}</p></div>)}</div></CardContent></Card></div>}

          {activeTab === "schule" && <Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-6"><div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><p className="text-sm font-semibold text-emerald-700">Ausgabeansicht</p><h2 className="text-2xl font-bold">Bestellungen für {activeDay}</h2></div><div className="flex flex-wrap gap-2">{weekdays.map((day) => <button key={day} onClick={() => setActiveDay(day)} className={`rounded-full px-4 py-2 text-sm font-semibold ${activeDay === day ? "bg-slate-950 text-white" : "bg-slate-100"}`}>{day.slice(0, 2)}</button>)}</div></div><div className="grid gap-3">{schoolRows.length ? schoolRows.map(({ child, items, total }) => <div key={child.id} className="flex items-center justify-between rounded-2xl border bg-white p-4"><div><p className="font-bold">{child.name} · {child.className}</p><p className="text-sm text-slate-500">{items.join(", ")} · {money(total)}</p></div><Button variant="outline" className="rounded-xl">Ausgegeben</Button></div>) : <p className="rounded-2xl bg-white p-5 text-slate-500">Keine Bestellungen für diesen Tag.</p>}</div></CardContent></Card>}

          {currentUser.role === "admin" && activeTab === "admin" && <div className="space-y-6"><div className="grid gap-4 md:grid-cols-4"><StatCard label="Admin-Umsatz" value={money(paidRevenue + openRevenue)} hint="inkl. offener Zahlungen" icon="chart" /><StatCard label="Offene Zahlungen" value={adminTodoSummary.openPayments} hint={money(openRevenue)} icon="payment" /><StatCard label="Produktion heute" value={adminTodoSummary.productionItems} hint={`Artikel für ${activeDay}`} icon="basket" /><StatCard label="Offene E-Mails" value={adminTodoSummary.emailsOpen} hint={`Admin: ${ADMIN_EMAIL}`} icon="mail" /></div><Card className="rounded-2xl border-0 bg-gradient-to-r from-emerald-50 to-orange-50 shadow-sm"><CardContent className="p-6"><h2 className="text-2xl font-bold">Heute zu erledigen</h2><div className="mt-4 grid gap-3 md:grid-cols-3"><div className="rounded-2xl bg-white p-4"><p className="text-sm text-slate-500">Zahlungen prüfen</p><p className="mt-1 text-xl font-bold">{adminTodoSummary.openPayments} offen</p></div><div className="rounded-2xl bg-white p-4"><p className="text-sm text-slate-500">Bäckerei informieren</p><p className="mt-1 text-xl font-bold">{adminTodoSummary.productionItems} Artikel</p></div><div className="rounded-2xl bg-white p-4"><p className="text-sm text-slate-500">Reminder</p><Button onClick={() => sendReminderEmail("deadline_reminder")} disabled={isSaving} className="mt-2 rounded-xl">Frist-Reminder senden</Button></div></div></CardContent></Card><Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-6"><div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><h2 className="text-2xl font-bold">Zahlungen verwalten</h2><p className="mt-1 text-sm text-slate-500">Suche nach Verwendungszweck, Kind, Eltern-Mail, Status oder Zahlungsart.</p></div><div className="w-full md:w-96"><label className="text-sm font-semibold text-slate-600">Suche</label><Input value={adminOrderSearch} onChange={(event) => setAdminOrderSearch(event.target.value)} placeholder="z. B. PAUSE-..., Lena, offen" className="mt-2 rounded-xl" /></div></div><div className="mb-3 flex flex-col gap-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between"><div className="flex gap-2"><Button variant={adminFilter === "alle" ? "default" : "outline"} onClick={() => setAdminFilter("alle")}>Alle</Button><Button variant={adminFilter === "offen" ? "default" : "outline"} onClick={() => setAdminFilter("offen")}>Offen</Button><Button variant={adminFilter === "bezahlt" ? "default" : "outline"} onClick={() => setAdminFilter("bezahlt")}>Bezahlt</Button></div><span>{filteredAdminOrders.length} von {completedOrders.length} Bestellungen</span>{adminOrderSearch && <button onClick={() => setAdminOrderSearch("")} className="font-semibold text-emerald-700">Suche löschen</button>}</div><div className="overflow-hidden rounded-2xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-100 text-slate-600"><tr><th className="p-4">Bestellung</th><th className="p-4">Kind</th><th className="p-4">Eltern-E-Mail</th><th className="p-4">Zahlung</th><th className="p-4">Referenz</th><th className="p-4">Status</th><th className="p-4">Aktion</th></tr></thead><tbody>{filteredAdminOrders.length ? filteredAdminOrders.map((order) => <tr key={order.id} className="border-t"><td className="p-4 font-semibold">{order.id}</td><td className="p-4">{order.child}</td><td className="p-4">{order.parentEmail}</td><td className="p-4">{order.payment} · {money(order.total)}</td><td className="p-4 font-mono text-xs">{order.paymentReference || "–"}</td><td className="p-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${order.status === "bezahlt" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{order.status}</span></td><td className="p-4">{order.status === "offen" ? <div className="flex flex-col gap-2"><Button onClick={() => markPaid(order.id)} variant="outline" className="rounded-xl">Als bezahlt markieren</Button><Button onClick={() => sendReminderEmail("payment_reminder", order)} variant="outline" className="rounded-xl">Zahlungs-Reminder</Button></div> : "–"}</td></tr>) : <tr><td className="p-4 text-slate-500" colSpan={7}>Keine Bestellung gefunden.</td></tr>}</tbody></table></div></CardContent></Card><Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-6"><h2 className="mb-4 text-2xl font-bold">Menü verwalten</h2><div className="mb-6 grid gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 md:grid-cols-[1.2fr_0.7fr_1fr_1.4fr_auto]"><Input value={newProduct.name} onChange={(event) => setNewProduct((prev) => ({ ...prev, name: event.target.value }))} placeholder="Produktname" className="rounded-xl" /><Input value={newProduct.price} onChange={(event) => setNewProduct((prev) => ({ ...prev, price: event.target.value }))} placeholder="Preis z. B. 3,20" className="rounded-xl" /><Input value={newProduct.tags} onChange={(event) => setNewProduct((prev) => ({ ...prev, tags: event.target.value }))} placeholder="Tags, z. B. vegan" className="rounded-xl" /><Input value={newProduct.desc} onChange={(event) => setNewProduct((prev) => ({ ...prev, desc: event.target.value }))} placeholder="Beschreibung" className="rounded-xl" /><Button onClick={addProduct} disabled={isSaving} className="rounded-xl">{isSaving ? "Speichert..." : "Hinzufügen"}</Button></div><div className="space-y-3">{menuProducts.map((product) => <div key={product.id} className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-[1.2fr_0.6fr_1fr_1.4fr_auto]"><Input value={product.name} onChange={(event) => updateProduct(product.id, "name", event.target.value)} className="rounded-xl" /><Input value={String(product.price)} onChange={(event) => updateProduct(product.id, "price", event.target.value)} className="rounded-xl" /><Input value={product.tags.join(", ")} onChange={(event) => updateProduct(product.id, "tags", event.target.value)} className="rounded-xl" /><Input value={product.desc} onChange={(event) => updateProduct(product.id, "desc", event.target.value)} className="rounded-xl" /><Button onClick={() => deleteProduct(product.id)} variant="outline" className="rounded-xl">Löschen</Button></div>)}</div></CardContent></Card><Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-6"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-2xl font-bold">Produktionsliste für die Bäckerei</h2><p className="text-slate-500">Zusammenfassung plus Detailzeilen mit Kind, Klasse, Allergien und Referenz für {activeDay}.</p></div><div className="flex flex-wrap gap-2"><Button onClick={printBakeryList} variant="outline" className="rounded-xl">PDF / Drucken</Button><Button onClick={sendProductionListToBakery} disabled={isSaving} className="rounded-xl"><Icon name="mail" className="mr-2" /> {isSaving ? "Sendet..." : "An Bäckerei senden"}</Button></div></div><div className="overflow-hidden rounded-2xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-100 text-slate-600"><tr><th className="p-4">Produkt</th><th className="p-4">Menge</th></tr></thead><tbody>{productSummary.length ? productSummary.map((row) => <tr key={row.product} className="border-t"><td className="p-4 font-semibold">{row.product}</td><td className="p-4">{row.quantity}</td></tr>) : <tr><td className="p-4 text-slate-500" colSpan={2}>Keine Produkte für diesen Tag.</td></tr>}</tbody></table></div></CardContent></Card></div>}
        </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
}
