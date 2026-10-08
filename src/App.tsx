import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { env, isSupabaseConfigured, supabase } from '@/lib/supabase';

type Product = { id: string; name: string; price: number; tags: string[]; desc: string; active?: boolean; bakeryId?: string | null };
type Child = { id: string; name: string; school: string; schoolId?: string | null; className: string; allergies: string };
type SchoolOption = { id: string; name: string; bakeryId: string; bakeryName: string };
type BakeryPaymentSettings = { bakeryId: string; bakeryName: string; accountHolder: string; iban: string; bic: string; paypalLink: string; bankTransferEnabled: boolean; paypalEnabled: boolean; deadlineDaysBefore: number; deadlineTime: string };
type PaymentGroupSummary = BakeryPaymentSettings & { total: number; paymentReference: string };
type OrderMap = Record<string, Record<string, string[]>>;
type CompletedOrder = {
  id: string;
  parent: string;
  parentEmail: string;
  child: string;
  school: string;
  day: string;
  deliveryDate: string;
  total: number;
  payment: string;
  paymentReference: string;
  status: 'offen' | 'bezahlt' | string;
  email: 'vorgemerkt' | 'gesendet' | string;
  checkoutId?: string | null;
  childId?: string | null;
  itemIds?: string[];
  bakeryId?: string | null;
};

const ADMIN_EMAIL = env.adminEmail;
const ADMIN_NAME = env.adminName;
const BAKERY_EMAIL = env.bakeryEmail;
const PAYPAL_PAYMENT_LINK = env.paypalLink;
const BANK_RECIPIENT = env.bankRecipient;
const BANK_IBAN = env.bankIban;
const BANK_BIC = env.bankBic;
const EMAIL_FUNCTION_NAME = env.emailFunctionName;
const BANK_REFERENCE_PREFIX = 'PAUSE';

const weekdays = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
const paymentMethods = ['Überweisung', 'PayPal'];
const livePaymentMethods = ['Überweisung', 'PayPal'];
const ORDER_DEADLINE_HOUR = 18;
const ORDER_DEADLINE_MINUTE = 0;

const demoUser = { id: 'admin-001', name: ADMIN_NAME, email: ADMIN_EMAIL, role: 'admin' };
const demoGuestUser = { id: 'guest-demo', name: 'Demo Gast', email: 'demo@pausenapp.local', role: 'parent' };

const fallbackProducts: Product[] = [
  { id: 'laugen-schinken-kaese', name: 'Laugenbrot mit Schinken & Käse', price: 3.2, tags: ['klassisch'], desc: 'Beliebtes Pausenbrot mit Schinken und Käse.' },
  { id: 'laugen-speck-kaese', name: 'Laugenbrot mit Speck & Käse', price: 3.4, tags: ['herzhaft'], desc: 'Kräftig im Geschmack.' },
  { id: 'laugen-lyoner-kaese', name: 'Laugenbrot mit Lyoner & Käse', price: 3.1, tags: ['klassisch'], desc: 'Mildes Pausenbrot mit Lyoner und Käse.' },
  { id: 'semmel-schinken-kaese', name: 'Semmel mit Schinken & Käse', price: 2.8, tags: ['klassisch'], desc: 'Klassische Semmel für die Pause.' },
  { id: 'apfel', name: 'Apfel', price: 1.0, tags: ['vegan', 'frisch'], desc: 'Frischer Apfel, saisonal.' },
  { id: 'banane', name: 'Banane', price: 1.1, tags: ['vegan', 'frisch'], desc: 'Reife Banane als gesunder Snack.' },
  { id: 'wasser', name: 'Mineralwasser klein', price: 1.1, tags: ['getränk'], desc: '0,33 l Wasser ohne Zuckerzusatz.' }
];

const initialChildren: Child[] = [
  { id: 'lena', name: 'Lena', school: 'Grundschule Zentrum', className: '2B', allergies: 'keine' },
  { id: 'max', name: 'Max', school: 'Grundschule Zentrum', className: '4A', allergies: 'Haselnüsse' }
];

const initialOrders: OrderMap = {
  lena: { Montag: ['laugen-schinken-kaese', 'apfel'], Dienstag: ['wasser'] },
  max: { Montag: ['laugen-speck-kaese', 'banane'], Mittwoch: ['apfel'] }
};

const demoGuestChildren: Child[] = [
  { id: 'demo-lisa', name: 'Lisa Demo', school: 'Grundschule Demo', className: '2A', allergies: 'keine' },
  { id: 'demo-max', name: 'Max Demo', school: 'Grundschule Demo', className: '4B', allergies: 'Nüsse' },
  { id: 'demo-anna', name: 'Anna Demo', school: 'Grundschule Demo', className: '3C', allergies: 'Laktose' }
];

const demoGuestOrders: OrderMap = {
  'demo-lisa': { Montag: ['laugen-schinken-kaese', 'apfel'], Dienstag: ['wasser'] },
  'demo-max': { Montag: ['laugen-speck-kaese', 'banane'], Mittwoch: ['apfel'] },
  'demo-anna': { Montag: ['laugen-schinken-kaese', 'wasser'], Donnerstag: ['banane'] }
};

const initialCompletedOrders: CompletedOrder[] = [
  { id: 'ord-1001', parent: ADMIN_NAME, parentEmail: ADMIN_EMAIL, child: 'Lena', school: 'Grundschule Zentrum', day: 'Montag', deliveryDate: getNextDeliveryDate('Montag'), total: 4.2, payment: 'Stripe', paymentReference: '', status: 'bezahlt', email: 'vorgemerkt' },
  { id: 'ord-1002', parent: ADMIN_NAME, parentEmail: ADMIN_EMAIL, child: 'Max', school: 'Grundschule Zentrum', day: 'Montag', deliveryDate: getNextDeliveryDate('Montag'), total: 4.5, payment: 'PayPal', paymentReference: '', status: 'bezahlt', email: 'vorgemerkt' },
  { id: 'ord-1003', parent: ADMIN_NAME, parentEmail: ADMIN_EMAIL, child: 'Lena', school: 'Grundschule Zentrum', day: 'Dienstag', deliveryDate: getNextDeliveryDate('Dienstag'), total: 3.8, payment: 'Überweisung', paymentReference: 'PAUSE-DEMO-LENA', status: 'offen', email: 'vorgemerkt' }
];

function money(value: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value || 0);
}

function slugify(value: string) {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));
}

function getNetworkErrorMessage(error: unknown) {
  let message = 'Unbekannter Fehler';
  if (error instanceof Error) message = error.message;
  else if (error && typeof error === 'object') {
    const e = error as any;
    message = [e.message, e.details, e.hint, e.code].filter(Boolean).join(' · ') || JSON.stringify(error);
  } else if (error) message = String(error);
  if (message.includes('Failed to fetch') || message.includes('fetch')) return 'Netzwerkfehler: Supabase ist gerade nicht erreichbar. App läuft lokal weiter.';
  return message;
}

function normalizeProduct(product: any): Product {
  return { id: product.id, name: product.name, price: Number(product.price || 0), tags: Array.isArray(product.tags) ? product.tags : [], desc: product.desc || product.description || '', active: product.active !== false, bakeryId: product.bakery_id || null };
}

function normalizeChild(child: any): Child {
  return { id: child.id, name: child.name, school: child.school, schoolId: child.school_id || child.schoolId || null, className: child.class_name || child.className || '', allergies: child.allergies || 'keine' };
}

function normalizeCompletedOrder(order: any, child: Child | undefined, user: any): CompletedOrder {
  return {
    id: order.id,
    parent: user?.name || demoUser.name,
    parentEmail: user?.email || demoUser.email,
    child: child?.name || 'Kind',
    school: order.school || child?.school || '',
    day: order.weekday,
    deliveryDate: order.delivery_date || '',
    total: Number(order.total || 0),
    payment: order.payment_method || 'Überweisung',
    paymentReference: order.payment_reference || '',
    status: order.status || 'offen',
    email: order.confirmation_email_sent ? 'gesendet' : 'vorgemerkt',
    checkoutId: order.checkout_id || null,
    childId: order.child_id || child?.id || null,
    itemIds: Array.isArray(order.itemIds) ? order.itemIds : [],
    bakeryId: order.bakery_id || null
  };
}

function getNextDeliveryDate(weekday: string) {
  const weekdayIndex = weekdays.indexOf(weekday);
  const today = new Date();
  const todayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const daysToAdd = weekdayIndex >= todayIndex ? weekdayIndex - todayIndex : 7 - todayIndex + weekdayIndex;
  const deliveryDate = new Date(today);
  deliveryDate.setDate(today.getDate() + daysToAdd);
  return deliveryDate.toISOString().slice(0, 10);
}

function getDeliveryDateForWeek(weekday: string, weekOffset = 0) {
  const base = new Date(`${getNextDeliveryDate(weekday)}T12:00:00`);
  base.setDate(base.getDate() + weekOffset * 7);
  return base.toISOString().slice(0, 10);
}

function formatDeliveryDate(weekday: string, weekOffset = 0) {
  return new Date(`${getDeliveryDateForWeek(weekday, weekOffset)}T12:00:00`).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function getOrderDeadlineDate(weekday: string, daysBefore = 1, time = `${String(ORDER_DEADLINE_HOUR).padStart(2, '0')}:${String(ORDER_DEADLINE_MINUTE).padStart(2, '0')}`) {
  const deliveryDate = new Date(`${getNextDeliveryDate(weekday)}T00:00:00`);
  const deadline = new Date(deliveryDate);
  const safeDaysBefore = Math.max(0, Math.min(7, Number(daysBefore) || 0));
  const [hoursRaw, minutesRaw] = String(time || '18:00').split(':');
  const hours = Math.max(0, Math.min(23, Number(hoursRaw) || 0));
  const minutes = Math.max(0, Math.min(59, Number(minutesRaw) || 0));
  deadline.setDate(deliveryDate.getDate() - safeDaysBefore);
  deadline.setHours(hours, minutes, 0, 0);
  return deadline;
}

function isOrderDeadlineOpen(weekday: string, now = new Date(), daysBefore = 1, time = '18:00') {
  return now.getTime() <= getOrderDeadlineDate(weekday, daysBefore, time).getTime();
}

function formatOrderDeadline(weekday: string, daysBefore = 1, time = '18:00') {
  return getOrderDeadlineDate(weekday, daysBefore, time).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function getReminderMessage(weekday: string, now = new Date(), daysBefore = 1, time = '18:00') {
  const deadline = getOrderDeadlineDate(weekday, daysBefore, time);
  const diffMs = deadline.getTime() - now.getTime();
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
  if (diffMs < 0) return `Bestellungen für ${weekday} sind fixiert.`;
  if (diffHours <= 3) return `Reminder: Bestellfrist für ${weekday} endet bald.`;
  if (diffHours <= 24) return `Reminder: Bestellfrist für ${weekday} endet heute bzw. morgen.`;
  return `Bestellfrist für ${weekday}: ${formatOrderDeadline(weekday, daysBefore, time)}`;
}

function calculateChildDayTotal(childId: string, day: string, orderMap: OrderMap, productList: Product[]) {
  return (orderMap[childId]?.[day] || []).reduce((sum, id) => sum + (productList.find((product) => product.id === id)?.price || 0), 0);
}

function calculateWeeklyTotal(orderMap: OrderMap, productList: Product[]) {
  return Object.values(orderMap).flatMap((childOrders) => Object.values(childOrders).flat()).reduce((sum, id) => sum + (productList.find((product) => product.id === id)?.price || 0), 0);
}

function getProductQuantity(itemIds: string[], productId: string) {
  return itemIds.filter((id) => id === productId).length;
}

function groupProductsByQuantity(selectedProducts: Product[]) {
  const grouped = new Map<string, { product: Product; quantity: number }>();
  selectedProducts.forEach((product) => {
    const existing = grouped.get(product.id);
    if (existing) existing.quantity += 1;
    else grouped.set(product.id, { product, quantity: 1 });
  });
  return Array.from(grouped.values());
}

function formatSelectedProducts(itemIds: string[], productList: Product[]) {
  const selectedProducts = itemIds.map((id) => productList.find((product) => product.id === id)).filter(Boolean) as Product[];
  return groupProductsByQuantity(selectedProducts)
    .map(({ product, quantity }) => `${quantity}× ${product.name}`)
    .join(', ');
}

function buildSchoolRows(childrenList: Child[], orderMap: OrderMap, day: string, productList: Product[]) {
  return childrenList.flatMap((child) => {
    const itemIds = orderMap[child.id]?.[day] || [];
    if (!itemIds.length) return [];
    return [{ child, items: itemIds.map((id) => productList.find((product) => product.id === id)?.name).filter(Boolean), total: calculateChildDayTotal(child.id, day, orderMap, productList) }];
  });
}

function buildProductSummary(childrenList: Child[], orderMap: OrderMap, day: string, productList: Product[]) {
  const summary: Record<string, { product: string; quantity: number }> = {};
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

function buildProductionOrderDetails({ childrenList, orderMap, day, productList, parentName, parentEmail, completedOrders = [], deliveryDate = '' }: { childrenList: Child[]; orderMap: OrderMap; day: string; productList: Product[]; parentName: string; parentEmail: string; completedOrders?: CompletedOrder[]; deliveryDate?: string }) {
  return childrenList.flatMap((child) => {
    const itemIds = orderMap[child.id]?.[day] || [];
    if (!itemIds.length) return [];
    const matchingOrder = completedOrders.find((order) => order.child === child.name && order.day === day && (!deliveryDate || !order.deliveryDate || order.deliveryDate === deliveryDate));
    return [{
      parentName,
      parentEmail,
      childId: child.id,
      childName: child.name,
      school: child.school,
      className: child.className,
      allergies: child.allergies || 'keine',
      paymentReference: matchingOrder?.paymentReference || '',
      items: itemIds.map((id) => productList.find((product) => product.id === id)?.name).filter(Boolean) as string[]
    }];
  });
}

function summarizeItemNames(items: string[]) {
  const counts = new Map<string, number>();
  items.forEach((item) => counts.set(item, (counts.get(item) || 0) + 1));
  return Array.from(counts.entries()).map(([name, quantity]) => ({ name, quantity }));
}

function getNavigationItems(user: any, isGuestMode = false) {
  const parentItems = [['start', 'home', 'Start'], ['bestellen', 'basket', 'Bestellen'], ['bestellungen', 'orders', 'Meine Bestellungen'], ['kinder', 'user', 'Kinder'], ['zahlung', 'payment', 'Zahlung'], ['statistiken', 'chart', 'Statistiken']];
  if (user?.role === 'bakery') return [['schule', 'school', 'Bäckerei'], ['bestellungen-bakery', 'orders', 'Bestellungen'], ['produkte', 'menu', 'Produkte'], ['einstellungen-bakery', 'admin', 'Einstellungen']];
  if (user?.role === 'admin') return [...parentItems, ['schule', 'school', 'Ausgabe'], ['admin', 'admin', 'Admin']];
  if (isGuestMode) return [...parentItems, ['schule', 'school', 'Ausgabe']];
  return parentItems;
}

function createPaymentReference({ child, day, createdAt = new Date() }: { child: Child; day: string; createdAt?: Date }) {
  const datePart = createdAt.toISOString().slice(2, 10).replace(/-/g, '');
  const childPart = slugify(child?.name || 'kind').replace(/-/g, '').slice(0, 6).toUpperCase() || 'KIND';
  const dayPart = String(day || 'tag').slice(0, 2).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${BANK_REFERENCE_PREFIX}-${datePart}-${childPart}-${dayPart}-${randomPart}`;
}

function createCheckoutReference(createdAt = new Date()) {
  const datePart = createdAt.toISOString().slice(2, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${BANK_REFERENCE_PREFIX}-${datePart}-FAM-${randomPart}`;
}

function filterOrdersBySearch(ordersList: CompletedOrder[], searchTerm: string) {
  const term = String(searchTerm || '').trim().toLowerCase();
  if (!term) return ordersList;
  return ordersList.filter((order) => [order.id, order.parent, order.parentEmail, order.child, order.school, order.day, order.payment, order.paymentReference, order.status, money(order.total)].filter(Boolean).some((value) => String(value).toLowerCase().includes(term)));
}

function getParentOrderStats(ordersList: CompletedOrder[]) {
  const activeOrders = ordersList.filter((order) => order.status !== 'storniert');
  return {
    count: activeOrders.length,
    cancelledCount: ordersList.filter((order) => order.status === 'storniert').length,
    openCount: activeOrders.filter((order) => order.status === 'offen').length,
    paidCount: activeOrders.filter((order) => order.status === 'bezahlt').length,
    openTotal: activeOrders.filter((order) => order.status === 'offen').reduce((sum, order) => sum + order.total, 0),
    paidTotal: activeOrders.filter((order) => order.status === 'bezahlt').reduce((sum, order) => sum + order.total, 0)
  };
}

function buildOrderEmailPayload({ order, child, day, selectedProducts }: { order: CompletedOrder; child: Child; day: string; selectedProducts: Product[] }) {
  return {
    orderId: order.id,
    parentName: order.parent,
    parentEmail: order.parentEmail,
    adminEmail: ADMIN_EMAIL,
    bakeryEmail: BAKERY_EMAIL,
    childName: child.name,
    school: child.school,
    className: child.className,
    allergies: child.allergies || 'keine',
    weekday: day,
    deliveryDate: getNextDeliveryDate(day),
    paymentMethod: order.payment,
    status: order.status,
    paymentReference: order.paymentReference || '',
    total: order.total,
    products: groupProductsByQuantity(selectedProducts).map(({ product, quantity }) => ({ name: product.name, price: product.price, quantity }))
  };
}

function createUserFromProfile(authUser: any, profile: any) {
  return { id: authUser.id, name: profile?.full_name || authUser.email || demoUser.name, email: profile?.email || authUser.email || demoUser.email, role: profile?.role || 'parent', bakeryId: profile?.bakery_id || null };
}

function functionNeedsRealUser(user: any) {
  return Boolean(user?.id && isUuid(user.id));
}

function runQuantitySelfTests() {
  const demoItems = ['apfel', 'apfel', 'wasser'];
  console.assert(getProductQuantity(demoItems, 'apfel') === 2, 'quantity: same product can be ordered twice');
  console.assert(getProductQuantity(demoItems, 'wasser') === 1, 'quantity: single product counted once');
  console.assert(formatSelectedProducts(demoItems, fallbackProducts).includes('2× Apfel'), 'quantity: summary groups duplicate products');
}

if (typeof window !== 'undefined') runQuantitySelfTests();

function Icon({ name, className = 'h-4 w-4' }: { name: string; className?: string }) {
  const icons: Record<string, string> = { home: '🏠', utensils: '🥪', basket: '🧺', user: '👧', school: '🏫', check: '✓', plus: '+', chevron: '›', admin: '⚙️', chart: '📊', mail: '✉️', payment: '💳', menu: '🍴', orders: '📋', children: '👨‍👩‍👧‍👦', clock: '⏰', salad: '🥗', euro: '€', bell: '🔔', calendar: '📅', warning: '⚠️' };
  return <span className={`inline-flex items-center justify-center leading-none ${className}`} aria-hidden="true">{icons[name] || '•'}</span>;
}

function StatCard({ label, value, hint, icon, tone = 'slate' }: { label: string; value: React.ReactNode; hint: string; icon: string; tone?: string }) {
  const toneClass: Record<string, string> = {
    violet: 'from-violet-50 to-white ring-violet-100 text-violet-700',
    emerald: 'from-emerald-50 to-white ring-emerald-100 text-emerald-700',
    orange: 'from-orange-50 to-white ring-orange-100 text-orange-700',
    blue: 'from-blue-50 to-white ring-blue-100 text-blue-700',
    slate: 'from-slate-50 to-white ring-slate-100 text-slate-700'
  };
  return <Card className={`rounded-[1.5rem] border-0 bg-gradient-to-br ${toneClass[tone] || toneClass.slate} shadow-sm ring-1`}><CardContent className="p-4 sm:p-6"><div className="mb-4 flex items-start justify-between gap-3 sm:mb-5"><span className="rounded-2xl bg-white/80 p-3 text-2xl shadow-sm"><Icon name={icon} className="h-7 w-7" /></span><span className="text-sm font-semibold text-slate-500">{label}</span></div><p className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{value}</p><p className="mt-3 text-sm font-medium text-slate-500">{hint}</p></CardContent></Card>;
}

function QuickActionCard({ icon, title, desc, onClick, tone = 'orange' }: { icon: string; title: string; desc: string; onClick: () => void; tone?: string }) {
  const toneClass: Record<string, string> = { orange: 'from-orange-50 to-white ring-orange-100', yellow: 'from-yellow-50 to-white ring-yellow-100', blue: 'from-blue-50 to-white ring-blue-100', violet: 'from-violet-50 to-white ring-violet-100', emerald: 'from-emerald-50 to-white ring-emerald-100', slate: 'from-slate-50 to-white ring-slate-100' };
  return <button onClick={onClick} className={`group rounded-[1.5rem] bg-gradient-to-br ${toneClass[tone] || toneClass.slate} p-5 text-left shadow-sm ring-1 transition hover:-translate-y-1 hover:shadow-md`}><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/80 text-3xl shadow-sm"><Icon name={icon} className="h-8 w-8" /></span><p className="mt-5 font-extrabold text-slate-950">{title}</p><p className="mt-2 min-h-[44px] text-sm leading-relaxed text-slate-600">{desc}</p><div className="mt-5 flex justify-end text-2xl text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-900">→</div></button>;
}

function ParentHome({ children, orders, completedOrders, onNavigate, onSelectChild, onSelectDay, currentUser, isGuestMode, schoolOptions, bakeryPaymentSettings }: { children: Child[]; orders: OrderMap; completedOrders: CompletedOrder[]; onNavigate: (tab: string) => void; onSelectChild: (id: string) => void; onSelectDay: (day: string) => void; currentUser: AppUser; isGuestMode: boolean; schoolOptions: SchoolOption[]; bakeryPaymentSettings: Record<string, BakeryPaymentSettings> }) {
  const nextDay = weekdays.find((day) => children.some((child) => (orders[child.id]?.[day] || []).length > 0)) || weekdays[0];
  const nextChildForDeadline = children.find((child) => (orders[child.id]?.[nextDay] || []).length > 0) || children[0];
  const nextSchoolOption = nextChildForDeadline?.schoolId ? schoolOptions.find((school) => school.id === nextChildForDeadline.schoolId) : undefined;
  const nextDeadlineSettings = nextSchoolOption?.bakeryId ? bakeryPaymentSettings[nextSchoolOption.bakeryId] : undefined;
  const nextDeadlineDaysBefore = nextDeadlineSettings?.deadlineDaysBefore ?? 1;
  const nextDeadlineTime = nextDeadlineSettings?.deadlineTime || '18:00';
  const nextDayOpen = isOrderDeadlineOpen(nextDay, new Date(), nextDeadlineDaysBefore, nextDeadlineTime);
  const reminderMessage = getReminderMessage(nextDay, new Date(), nextDeadlineDaysBefore, nextDeadlineTime);
  const openPayments = completedOrders.filter((order) => order.status === 'offen');
  const paidOrders = completedOrders.filter((order) => order.status === 'bezahlt');
  const openTotal = openPayments.reduce((sum, order) => sum + order.total, 0);
  const deadlineText = nextDayOpen ? formatOrderDeadline(nextDay, nextDeadlineDaysBefore, nextDeadlineTime) : 'fixiert';

  function goToOrder() {
    onSelectChild(children[0]?.id || initialChildren[0].id);
    onSelectDay(nextDay);
    onNavigate('bestellen');
  }

  return <div className="space-y-7"><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">Guten Morgen, {currentUser.name}! 👋</h2><p className="mt-2 text-lg text-slate-500">Schön, dass du da bist. Hier ist dein Überblick für heute.</p></div><div className="flex gap-3"><div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200"><Icon name="calendar" /> {new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</div><button className="relative rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200"><Icon name="bell" className="h-5 w-5" />{openPayments.length > 0 && <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">{openPayments.length}</span>}</button></div></div><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4"><StatCard label="Offene Bestellungen" value={openPayments.length} hint="Zahlungen oder Prüfung offen" icon="basket" tone="violet" /><StatCard label="Bezahlt" value={paidOrders.length} hint="bereits bestätigt" icon="check" tone="emerald" /><StatCard label="Bestellfrist endet" value={nextDayOpen ? nextDay : 'Fixiert'} hint={deadlineText} icon="clock" tone="orange" /><StatCard label="Offener Betrag" value={money(openTotal)} hint={`${openPayments.length} offene Bestellung(en)`} icon="euro" tone="blue" /></div><Card className="rounded-[2rem] border-0 bg-white/90 shadow-sm ring-1 ring-slate-200"><CardContent className="p-6"><h3 className="text-2xl font-black tracking-tight">Schnellzugriff</h3><div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6"><QuickActionCard icon="basket" title="Neue Bestellung" desc="Für deine Kinder bestellen" tone="orange" onClick={goToOrder} /><QuickActionCard icon="children" title="Kinder verwalten" desc="Kinder hinzufügen oder bearbeiten" tone="yellow" onClick={() => onNavigate('kinder')} /><QuickActionCard icon="payment" title="Zahlungen prüfen" desc="Zahlungsstatus einsehen" tone="blue" onClick={() => onNavigate('zahlung')} /><QuickActionCard icon="chart" title="Statistiken" desc="Übersichten und Auswertungen" tone="violet" onClick={() => onNavigate('statistiken')} />{(currentUser.role === 'admin' || isGuestMode) && <QuickActionCard icon="school" title="Ausgabe / Bäckerei" desc="Produktionsliste anzeigen" tone="emerald" onClick={() => onNavigate('schule')} />}{currentUser.role === 'admin' && !isGuestMode && <QuickActionCard icon="admin" title="Adminbereich" desc="Verwaltung und Einstellungen" tone="slate" onClick={() => onNavigate('admin')} />}</div></CardContent></Card><div className="rounded-[1.75rem] border border-yellow-200 bg-gradient-to-r from-yellow-50 to-orange-50 p-5 shadow-sm"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div className="flex items-start gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 text-xl shadow-sm"><Icon name="warning" /></span><div><p className="text-lg font-black text-slate-950">{reminderMessage}</p><p className="mt-1 text-sm text-slate-600">Bitte rechtzeitig bestellen, damit wir alles gut planen können.</p></div></div><Button onClick={goToOrder} className="rounded-2xl bg-yellow-400 px-6 py-6 font-black text-slate-950 hover:bg-yellow-500">Jetzt bestellen <Icon name="chevron" className="ml-2" /></Button></div></div></div>;
}

export default function PausenappMvpPrototype() {
  const [user, setUser] = useState<any>(null);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [loginEmail, setLoginEmail] = useState(ADMIN_EMAIL);
  const [loginPassword, setLoginPassword] = useState('');
  const [showParentRegistration, setShowParentRegistration] = useState(false);
  const [parentRegistration, setParentRegistration] = useState({ name: '', email: '', password: '' });
  const [parentRegistrationNotice, setParentRegistrationNotice] = useState('');
  const [parentRegistrationLoading, setParentRegistrationLoading] = useState(false);
  const [showBakeryRegistration, setShowBakeryRegistration] = useState(false);
  const [bakeryRegistration, setBakeryRegistration] = useState({
    name: '', legalName: '', email: '', phone: '', address: '', vatNumber: '', city: '', password: '',
    schoolName: '', schoolCity: '', schoolAddress: ''
  });
  const [bakeryRegistrationNotice, setBakeryRegistrationNotice] = useState('');
  const [bakeryRegistrationLoading, setBakeryRegistrationLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('start');
  const [children, setChildren] = useState<Child[]>(initialChildren);
  const [activeChildId, setActiveChildId] = useState(initialChildren[0].id);
  const [activeDay, setActiveDay] = useState(weekdays[0]);
  const [orders, setOrders] = useState<OrderMap>(initialOrders);
  const [completedOrders, setCompletedOrders] = useState<CompletedOrder[]>(initialCompletedOrders);
  const [newChildName, setNewChildName] = useState('');
  const [newChildSchoolId, setNewChildSchoolId] = useState('');
  const [newChildClassName, setNewChildClassName] = useState('');
  const [newChildAllergies, setNewChildAllergies] = useState('keine');
  const [editingChildId, setEditingChildId] = useState('');
  const [editingChild, setEditingChild] = useState({ name: '', schoolId: '', className: '', allergies: 'keine' });
  const [schoolOptions, setSchoolOptions] = useState<SchoolOption[]>([]);
  const [selectedPayment, setSelectedPayment] = useState('Überweisung');
  const [lastConfirmation, setLastConfirmation] = useState('');
  const [lastOrder, setLastOrder] = useState<CompletedOrder | null>(null);
  const [menuProducts, setMenuProducts] = useState<Product[]>(fallbackProducts);
  const [newProduct, setNewProduct] = useState({ name: '', price: '', tags: '', desc: '' });
  const [editingProductId, setEditingProductId] = useState('');
  const [editingProduct, setEditingProduct] = useState({ name: '', price: '', tags: '', desc: '' });
  const [adminOrderSearch, setAdminOrderSearch] = useState('');
  const [adminFilter, setAdminFilter] = useState('alle');
  const [copiedText, setCopiedText] = useState('');
  const [paypalStatus, setPaypalStatus] = useState('');
  const [backendNotice, setBackendNotice] = useState(isSupabaseConfigured ? 'Supabase verbunden' : 'Demo-Modus');
  const [dataLoading, setDataLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [issuedChildren, setIssuedChildren] = useState<Record<string, boolean>>({});
  const [bakeryWeekOffset, setBakeryWeekOffset] = useState(0);
  const [bakeryOrderCountsByDate, setBakeryOrderCountsByDate] = useState<Record<string, number>>({});
  const [bakeryOrderRows, setBakeryOrderRows] = useState<any[]>([]);
  const [bakeryOrderSearch, setBakeryOrderSearch] = useState('');
  const [bakeryOrderStatusFilter, setBakeryOrderStatusFilter] = useState('alle');
  const [bakeryApproval, setBakeryApproval] = useState<{ name: string; approvalStatus: string; active: boolean } | null>(null);
  const [pendingBakeryApplications, setPendingBakeryApplications] = useState<any[]>([]);
  const [pendingSchoolRequests, setPendingSchoolRequests] = useState<any[]>([]);
  const [adminApprovalLoadingId, setAdminApprovalLoadingId] = useState('');
  const [editingOrderId, setEditingOrderId] = useState('');
  const [editingOrderItems, setEditingOrderItems] = useState<string[]>([]);
  const [parentOrderNotice, setParentOrderNotice] = useState('');
  const [bakeryPaymentSettings, setBakeryPaymentSettings] = useState<Record<string, BakeryPaymentSettings>>({});
  const [bakeryPaymentForm, setBakeryPaymentForm] = useState({ accountHolder: '', iban: '', bic: '', paypalLink: '', bankTransferEnabled: true, paypalEnabled: false, deadlineDaysBefore: '1', deadlineTime: '18:00' });
  const [lastPaymentGroups, setLastPaymentGroups] = useState<PaymentGroupSummary[]>([]);

  useEffect(() => {
    async function loadSupabaseData() {
      if (!supabase) return;
      setDataLoading(true);
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        let loadedUser: any = null;
        if (authData?.user) {
          let { data: profile, error: profileError } = await supabase.from('profiles').select('id, email, full_name, role, bakery_id').eq('id', authData.user.id).maybeSingle();
          if (profileError) throw profileError;

          // Registration signups may not have an authenticated session until the email is confirmed.
          // Finish the matching profile automatically on the first confirmed session.
          if (!profile && authData.user.user_metadata?.account_type === 'bakery_application') {
            await finalizeBakeryApplication(authData.user);
            const profileResult = await supabase.from('profiles').select('id, email, full_name, role, bakery_id').eq('id', authData.user.id).maybeSingle();
            if (profileResult.error) throw profileResult.error;
            profile = profileResult.data;
          }
          if (!profile && authData.user.user_metadata?.account_type === 'parent_registration') {
            await finalizeParentRegistration(authData.user);
            const profileResult = await supabase.from('profiles').select('id, email, full_name, role, bakery_id').eq('id', authData.user.id).maybeSingle();
            if (profileResult.error) throw profileResult.error;
            profile = profileResult.data;
          }

          if (!profile) throw new Error('Für dieses Konto wurde noch kein Benutzerprofil angelegt.');
          loadedUser = createUserFromProfile(authData.user, profile);
          setUser(loadedUser);
        }
        const { data: productData, error: productError } = await supabase.from('products').select('id, name, description, price, tags, active, bakery_id').eq('active', true).order('name');
        if (productError) throw productError;
        if (Array.isArray(productData) && productData.length) {
          const normalizedProducts = productData.map(normalizeProduct);
          setMenuProducts(normalizedProducts);
        }
        if (loadedUser?.id) {
          if (loadedUser.role === 'bakery') {
            const approval = await loadMyBakeryApproval(loadedUser);
            if (approval?.approvalStatus === 'active' && approval.active) {
              await loadBakeryData(loadedUser);
              setActiveTab('schule');
              setBackendNotice('Bäckerei-Daten aus Supabase geladen');
            } else {
              setActiveTab('bakery-pending');
              setBackendNotice('Bäckerei-Freigabe ausstehend');
            }
          } else {
            await loadChildrenAndOrders(loadedUser);
            if (loadedUser.role === 'admin') await loadAdminApplications(loadedUser);
            setBackendNotice(loadedUser.role === 'admin' ? 'Admin-Daten aus Supabase geladen' : 'Kinder, Produkte und Bestellungen aus Supabase geladen');
          }
        } else {
          setBackendNotice('Produkte aus Supabase geladen. Bitte einloggen.');
        }
      } catch (error) {
        setBackendNotice(getNetworkErrorMessage(error));
      } finally {
        setDataLoading(false);
      }
    }
    loadSupabaseData();
  }, []);

  async function loadPaymentSettingsForSchools(schools: SchoolOption[]) {
    if (!supabase) return;
    const bakeryIds = Array.from(new Set(schools.map((school) => school.bakeryId).filter(Boolean)));
    if (!bakeryIds.length) {
      setBakeryPaymentSettings({});
      return;
    }
    const { data, error } = await supabase.rpc('get_bakery_payment_settings', { p_bakery_ids: bakeryIds });
    if (error) throw error;
    const next: Record<string, BakeryPaymentSettings> = {};
    (data || []).forEach((row: any) => {
      next[row.bakery_id] = {
        bakeryId: row.bakery_id,
        bakeryName: row.bakery_name || 'Bäckerei',
        accountHolder: row.account_holder || '',
        iban: row.iban || '',
        bic: row.bic || '',
        paypalLink: row.paypal_link || '',
        bankTransferEnabled: row.bank_transfer_enabled !== false,
        paypalEnabled: Boolean(row.paypal_enabled),
        deadlineDaysBefore: Number(row.deadline_days_before ?? 1),
        deadlineTime: String(row.deadline_time || '18:00').slice(0, 5)
      };
    });
    setBakeryPaymentSettings(next);
  }

  async function loadMyBakeryPaymentSettings(loadedUser = user) {
    if (!supabase || !functionNeedsRealUser(loadedUser) || loadedUser?.role !== 'bakery') return;
    const { data, error } = await supabase.rpc('get_my_bakery_payment_settings');
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    setBakeryPaymentForm({
      accountHolder: row?.account_holder || '',
      iban: row?.iban || '',
      bic: row?.bic || '',
      paypalLink: row?.paypal_link || '',
      bankTransferEnabled: row?.bank_transfer_enabled !== false,
      paypalEnabled: Boolean(row?.paypal_enabled),
      deadlineDaysBefore: String(row?.deadline_days_before ?? 1),
      deadlineTime: String(row?.deadline_time || '18:00').slice(0, 5)
    });
  }

  async function saveMyBakeryPaymentSettings() {
    if (!supabase || currentUser.role !== 'bakery' || !functionNeedsRealUser(currentUser)) return;
    if (!currentUser.bakeryId) return setBackendNotice('Bäckerei-ID fehlt. Bitte neu anmelden.');
    if (!bakeryPaymentForm.bankTransferEnabled && !bakeryPaymentForm.paypalEnabled) return setBackendNotice('Bitte mindestens eine Zahlungsart aktivieren.');
    if (bakeryPaymentForm.bankTransferEnabled && !bakeryPaymentForm.accountHolder.trim()) return setBackendNotice('Für Überweisung bitte den Kontoinhaber eingeben.');
    if (bakeryPaymentForm.bankTransferEnabled && !bakeryPaymentForm.iban.trim()) return setBackendNotice('Für Überweisung bitte eine IBAN eingeben.');
    if (bakeryPaymentForm.paypalEnabled && !bakeryPaymentForm.paypalLink.trim()) return setBackendNotice('Für PayPal bitte einen PayPal-Link hinterlegen.');

    const deadlineDays = Math.max(0, Math.min(7, Number(bakeryPaymentForm.deadlineDaysBefore) || 0));
    const deadlineTime = bakeryPaymentForm.deadlineTime || '18:00';

    setIsSaving(true);
    try {
      const { data: saved, error } = await supabase.rpc('save_my_bakery_settings_v3', {
        p_account_holder: bakeryPaymentForm.accountHolder.trim(),
        p_iban: bakeryPaymentForm.iban.trim().replace(/\s+/g, '').toUpperCase(),
        p_bic: bakeryPaymentForm.bic.trim().replace(/\s+/g, '').toUpperCase(),
        p_paypal_link: bakeryPaymentForm.paypalLink.trim(),
        p_bank_transfer_enabled: bakeryPaymentForm.bankTransferEnabled,
        p_paypal_enabled: bakeryPaymentForm.paypalEnabled,
        p_deadline_days_before: deadlineDays,
        p_deadline_time_text: deadlineTime
      });
      if (error) throw error;

      const row = Array.isArray(saved) ? saved[0] : saved;
      if (!row) throw new Error('Supabase hat nach dem Speichern keine Daten zurückgegeben.');

      const savedTime = String(row.deadline_time || deadlineTime).slice(0, 5);
      const savedDays = String(row.deadline_days_before ?? deadlineDays);
      setBakeryPaymentForm({
        accountHolder: row.account_holder || bakeryPaymentForm.accountHolder,
        iban: row.iban || bakeryPaymentForm.iban,
        bic: row.bic || '',
        paypalLink: row.paypal_link || '',
        bankTransferEnabled: row.bank_transfer_enabled !== false,
        paypalEnabled: Boolean(row.paypal_enabled),
        deadlineDaysBefore: savedDays,
        deadlineTime: savedTime
      });

      setBackendNotice(`Gespeichert · Bestellfrist: ${savedDays} Tag(e) vorher um ${savedTime} Uhr.`);
    } catch (error) {
      setBackendNotice(`Einstellungen konnten nicht gespeichert werden: ${getNetworkErrorMessage(error)}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function loadChildrenAndOrders(loadedUser = user) {
    if (!supabase || !functionNeedsRealUser(loadedUser)) return;
    try {
      const { data: schoolLinkData, error: schoolLinkError } = await supabase.rpc('get_available_schools');
      if (schoolLinkError) throw schoolLinkError;
      const availableSchools: SchoolOption[] = (schoolLinkData || [])
        .map((row: any) => ({
          id: row.school_id,
          name: row.school_name || 'Schule',
          bakeryId: row.bakery_id,
          bakeryName: row.bakery_name || 'Bäckerei'
        }))
        .filter((row: SchoolOption) => row.id && row.bakeryId);
      setSchoolOptions(availableSchools);
      await loadPaymentSettingsForSchools(availableSchools);
      if (!newChildSchoolId && availableSchools[0]?.id) setNewChildSchoolId(availableSchools[0].id);

      const { data: childData, error: childError } = await supabase.from('children').select('id, name, school, school_id, class_name, allergies').eq('parent_id', loadedUser.id).order('created_at', { ascending: true });
      if (childError) throw childError;
      const normalizedChildren = Array.isArray(childData)
        ? childData.map((child: any) => {
            const normalized = normalizeChild(child);
            const mappedSchool = availableSchools.find((school) => school.id === normalized.schoolId);
            return { ...normalized, school: mappedSchool?.name || normalized.school };
          })
        : [];
      setChildren(normalizedChildren);
      setActiveChildId(normalizedChildren[0]?.id || '');
      const { data: orderData, error: orderError } = await supabase.from('orders').select('id, child_id, school, delivery_date, weekday, total, payment_method, payment_reference, status, confirmation_email_sent, checkout_id, bakery_id, created_at').eq('parent_id', loadedUser.id).order('created_at', { ascending: false }).limit(50);
      if (orderError) throw orderError;
      if (Array.isArray(orderData)) {
        const orderIds = orderData.map((order: any) => order.id).filter(Boolean);
        const itemIdsByOrder = new Map<string, string[]>();
        if (orderIds.length) {
          const { data: itemData, error: itemError } = await supabase.from('order_items').select('order_id, product_id, quantity').in('order_id', orderIds);
          if (itemError) throw itemError;
          (itemData || []).forEach((item: any) => {
            const list = itemIdsByOrder.get(item.order_id) || [];
            const quantity = Math.max(1, Number(item.quantity || 1));
            for (let i = 0; i < quantity; i += 1) list.push(item.product_id);
            itemIdsByOrder.set(item.order_id, list);
          });
        }
        setCompletedOrders(orderData.map((order: any) => normalizeCompletedOrder({ ...order, itemIds: itemIdsByOrder.get(order.id) || [] }, normalizedChildren.find((child) => child.id === order.child_id), loadedUser)));
      }
    } catch (error) {
      setBackendNotice(`Daten konnten nicht geladen werden: ${getNetworkErrorMessage(error)}`);
    }
  }

  async function loadBakeryData(loadedUser = user, weekOffset = bakeryWeekOffset) {
    if (!supabase || !functionNeedsRealUser(loadedUser) || loadedUser?.role !== 'bakery' || !loadedUser?.bakeryId) return;
    try {
      await loadMyBakeryPaymentSettings(loadedUser);
      const { data: productData, error: productError } = await supabase.rpc('get_my_bakery_products');
      if (productError) throw productError;
      const bakeryProducts = Array.isArray(productData) ? productData.map(normalizeProduct) : [];
      setMenuProducts(bakeryProducts);

      const { data: orderData, error: orderError } = await supabase.from('orders').select('id, parent_id, child_id, school, delivery_date, weekday, total, payment_method, payment_reference, status, confirmation_email_sent, checkout_id, issued_at, created_at, bakery_id').eq('bakery_id', loadedUser.bakeryId).neq('status', 'storniert').in('delivery_date', weekdays.map((day) => getDeliveryDateForWeek(day, weekOffset))).order('delivery_date', { ascending: true }).order('created_at', { ascending: false }).limit(500);
      if (orderError) throw orderError;
      const bakeryOrders = Array.isArray(orderData) ? orderData : [];

      const issuedState: Record<string, boolean> = {};
      const issuedGroups = new Map<string, { total: number; issued: number }>();
      bakeryOrders.forEach((order: any) => {
        if (!order.child_id || !order.delivery_date) return;
        const key = `${order.delivery_date}::${order.child_id}`;
        const group = issuedGroups.get(key) || { total: 0, issued: 0 };
        group.total += 1;
        if (order.issued_at) group.issued += 1;
        issuedGroups.set(key, group);
      });
      issuedGroups.forEach((group, key) => {
        issuedState[key] = group.total > 0 && group.issued === group.total;
      });
      setIssuedChildren(issuedState);

      const orderCountsByDate: Record<string, number> = {};
      bakeryOrders.forEach((order: any) => {
        if (!order.delivery_date) return;
        orderCountsByDate[order.delivery_date] = (orderCountsByDate[order.delivery_date] || 0) + 1;
      });
      setBakeryOrderCountsByDate(orderCountsByDate);
      const childIds = Array.from(new Set(bakeryOrders.map((order: any) => order.child_id).filter(Boolean)));
      let bakeryChildren: Child[] = [];
      if (childIds.length) {
        const { data: childData, error: childError } = await supabase.from('children').select('id, name, school, school_id, class_name, allergies').in('id', childIds);
        if (childError) throw childError;
        bakeryChildren = Array.isArray(childData) ? childData.map(normalizeChild) : [];
      }
      setChildren(bakeryChildren);
      setActiveChildId(bakeryChildren[0]?.id || '');

      const orderIds = bakeryOrders.map((order: any) => order.id);
      const bakeryOrderMap: OrderMap = {};
      const bakeryItemsByOrder = new Map<string, string[]>();
      if (orderIds.length) {
        const { data: itemData, error: itemError } = await supabase.from('order_items').select('order_id, product_id, quantity').in('order_id', orderIds);
        if (itemError) throw itemError;
        (itemData || []).forEach((item: any) => {
          const list = bakeryItemsByOrder.get(item.order_id) || [];
          const quantity = Math.max(1, Number(item.quantity || 1));
          for (let i = 0; i < quantity; i += 1) list.push(item.product_id);
          bakeryItemsByOrder.set(item.order_id, list);
        });
        bakeryOrders.forEach((order: any) => {
          if (!order.child_id || !order.weekday || !order.delivery_date) return;
          if (order.delivery_date !== getDeliveryDateForWeek(order.weekday, weekOffset)) return;
          if (!bakeryOrderMap[order.child_id]) bakeryOrderMap[order.child_id] = {};
          const existing = bakeryOrderMap[order.child_id][order.weekday] || [];
          bakeryOrderMap[order.child_id][order.weekday] = [...existing, ...(bakeryItemsByOrder.get(order.id) || [])];
        });
      }
      setOrders(bakeryOrderMap);
      setBakeryOrderRows(bakeryOrders.map((order: any) => {
        const child = bakeryChildren.find((entry) => entry.id === order.child_id);
        const itemIds = bakeryItemsByOrder.get(order.id) || [];
        return {
          id: order.id,
          childName: child?.name || 'Kind',
          className: child?.className || '–',
          school: child?.school || order.school || '–',
          allergies: child?.allergies || 'keine',
          deliveryDate: order.delivery_date || '',
          weekday: order.weekday || '',
          total: Number(order.total || 0),
          paymentMethod: order.payment_method || '–',
          paymentReference: order.payment_reference || '',
          status: order.status || 'offen',
          issued: Boolean(order.issued_at),
          items: itemIds.map((id) => bakeryProducts.find((product) => product.id === id)?.name || 'Produkt')
        };
      }));
      setCompletedOrders(bakeryOrders.map((order: any) => normalizeCompletedOrder(order, bakeryChildren.find((child) => child.id === order.child_id), loadedUser)));
      setBackendNotice('Bäckerei-Daten aus Supabase geladen');
    } catch (error) {
      setBackendNotice(`Bäckerei-Daten konnten nicht geladen werden: ${getNetworkErrorMessage(error)}`);
    }
  }

  async function finalizeParentRegistration(authUser: any) {
    if (!supabase || !authUser?.id) throw new Error('Keine bestätigte Supabase-Session vorhanden.');
    const meta = authUser.user_metadata || {};
    const { error } = await supabase.rpc('register_parent_profile', {
      p_user_id: authUser.id,
      p_email: authUser.email || meta.email || '',
      p_full_name: meta.full_name || authUser.email || 'Elternkonto'
    });
    if (error) throw error;
  }

  async function registerParent() {
    if (!supabase) return setParentRegistrationNotice('Supabase ist nicht konfiguriert.');
    const form = parentRegistration;
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      return setParentRegistrationNotice('Bitte Name, E-Mail und Passwort ausfüllen.');
    }
    if (form.password.length < 6) return setParentRegistrationNotice('Das Passwort muss mindestens 6 Zeichen haben.');

    setParentRegistrationLoading(true);
    setParentRegistrationNotice('');
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: form.name.trim(),
            account_type: 'parent_registration'
          }
        }
      });
      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error('Registrierung konnte nicht erstellt werden.');

      if (signUpData.session) {
        await finalizeParentRegistration(signUpData.user);
        await supabase.auth.signOut();
        setParentRegistrationNotice('Elternkonto wurde erstellt. Du kannst dich jetzt einloggen.');
      } else {
        setParentRegistrationNotice('Registrierung erstellt. Bitte bestätige jetzt deine E-Mail-Adresse. Danach kannst du dich direkt einloggen.');
      }
      setParentRegistration((prev) => ({ ...prev, password: '' }));
    } catch (error) {
      setParentRegistrationNotice(`Registrierung fehlgeschlagen: ${getNetworkErrorMessage(error)}`);
    } finally {
      setParentRegistrationLoading(false);
    }
  }

  async function finalizeBakeryApplication(authUser: any) {
    if (!supabase || !authUser?.id) throw new Error('Keine bestätigte Supabase-Session vorhanden.');
    const meta = authUser.user_metadata || {};
    const { error } = await supabase.rpc('register_bakery_application', {
      p_user_id: authUser.id,
      p_email: authUser.email || meta.email || '',
      p_bakery_name: meta.bakery_name || meta.full_name || 'Bäckerei',
      p_company_name: meta.company_name || '',
      p_city: meta.city || '',
      p_address: meta.address || '',
      p_phone: meta.phone || '',
      p_vat_number: meta.vat_number || '',
      p_school_name: meta.school_name || null,
      p_school_city: meta.school_city || meta.city || null,
      p_school_address: meta.school_address || null
    });
    if (error) throw error;
  }

  async function registerBakery() {
    if (!supabase) return setBakeryRegistrationNotice('Supabase ist nicht konfiguriert.');
    const form = bakeryRegistration;
    if (!form.name.trim() || !form.email.trim() || !form.password || !form.city.trim()) {
      return setBakeryRegistrationNotice('Bitte Bäckereiname, Ort, E-Mail und Passwort ausfüllen.');
    }
    if (form.password.length < 6) return setBakeryRegistrationNotice('Das Passwort muss mindestens 6 Zeichen haben.');

    setBakeryRegistrationLoading(true);
    setBakeryRegistrationNotice('');
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: form.name.trim(),
            account_type: 'bakery_application',
            bakery_name: form.name.trim(),
            company_name: form.legalName.trim(),
            city: form.city.trim(),
            address: form.address.trim(),
            phone: form.phone.trim(),
            vat_number: form.vatNumber.trim(),
            school_name: form.schoolName.trim(),
            school_city: form.schoolCity.trim() || form.city.trim(),
            school_address: form.schoolAddress.trim()
          }
        }
      });
      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error('Registrierung konnte nicht erstellt werden.');

      if (signUpData.session) {
        await finalizeBakeryApplication(signUpData.user);
        await supabase.auth.signOut();
        setBakeryRegistrationNotice('Registrierung eingegangen. Die Bäckerei wartet jetzt auf die Freigabe durch den Pausenapp-Admin.');
      } else {
        setBakeryRegistrationNotice('Registrierung erstellt. Bitte bestätige jetzt die E-Mail-Adresse. Danach wird der Bäckereiantrag beim ersten Öffnen der Pausenapp automatisch fertiggestellt.');
      }
      setBakeryRegistration((prev) => ({ ...prev, password: '' }));
    } catch (error) {
      setBakeryRegistrationNotice(`Registrierung fehlgeschlagen: ${getNetworkErrorMessage(error)}`);
    } finally {
      setBakeryRegistrationLoading(false);
    }
  }

  async function loadMyBakeryApproval(loadedUser = user) {
    if (!supabase || !functionNeedsRealUser(loadedUser) || loadedUser?.role !== 'bakery') return null;
    const { data, error } = await supabase.rpc('get_my_bakery_status');
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    const approval = row ? {
      name: row.bakery_name || loadedUser.name || 'Bäckerei',
      approvalStatus: row.approval_status || 'pending',
      active: Boolean(row.active)
    } : { name: loadedUser.name || 'Bäckerei', approvalStatus: 'pending', active: false };
    setBakeryApproval(approval);
    return approval;
  }

  async function loadAdminApplications(loadedUser = user) {
    if (!supabase || !functionNeedsRealUser(loadedUser) || loadedUser?.role !== 'admin') return;
    const { data: bakeryData, error: bakeryError } = await supabase.rpc('get_pending_bakery_applications');
    if (bakeryError) throw bakeryError;
    const { data: schoolData, error: schoolError } = await supabase
      .from('school_requests')
      .select('id, bakery_id, school_name, city, address, status, created_at, bakeries(name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (schoolError) throw schoolError;
    setPendingBakeryApplications(Array.isArray(bakeryData) ? bakeryData : []);
    setPendingSchoolRequests(Array.isArray(schoolData) ? schoolData : []);
  }

  async function approveBakeryApplication(bakeryId: string) {
    if (!supabase) return;
    setAdminApprovalLoadingId(`bakery:${bakeryId}`);
    try {
      const { error } = await supabase.rpc('approve_bakery', { p_bakery_id: bakeryId });
      if (error) throw error;
      await loadAdminApplications(user);
      setBackendNotice('Bäckerei wurde freigegeben.');
    } catch (error) {
      setBackendNotice(`Bäckerei konnte nicht freigegeben werden: ${getNetworkErrorMessage(error)}`);
    } finally {
      setAdminApprovalLoadingId('');
    }
  }

  async function rejectBakeryApplication(bakeryId: string) {
    if (!supabase) return;
    setAdminApprovalLoadingId(`bakery:${bakeryId}`);
    try {
      const { error } = await supabase.rpc('reject_bakery', { p_bakery_id: bakeryId });
      if (error) throw error;
      await loadAdminApplications(user);
      setBackendNotice('Bäckerei wurde abgelehnt.');
    } catch (error) {
      setBackendNotice(`Bäckerei konnte nicht abgelehnt werden: ${getNetworkErrorMessage(error)}`);
    } finally {
      setAdminApprovalLoadingId('');
    }
  }

  async function approveSchoolRequestAdmin(requestId: string) {
    if (!supabase) return;
    setAdminApprovalLoadingId(`school:${requestId}`);
    try {
      const { error } = await supabase.rpc('approve_school_request', { p_request_id: requestId });
      if (error) throw error;
      await loadAdminApplications(user);
      setBackendNotice('Schule wurde freigegeben und der Bäckerei zugeordnet.');
    } catch (error) {
      setBackendNotice(`Schule konnte nicht freigegeben werden: ${getNetworkErrorMessage(error)}`);
    } finally {
      setAdminApprovalLoadingId('');
    }
  }

  async function rejectSchoolRequestAdmin(requestId: string) {
    if (!supabase) return;
    setAdminApprovalLoadingId(`school:${requestId}`);
    try {
      const { error } = await supabase.rpc('reject_school_request', { p_request_id: requestId });
      if (error) throw error;
      await loadAdminApplications(user);
      setBackendNotice('Schulvorschlag wurde abgelehnt.');
    } catch (error) {
      setBackendNotice(`Schulvorschlag konnte nicht abgelehnt werden: ${getNetworkErrorMessage(error)}`);
    } finally {
      setAdminApprovalLoadingId('');
    }
  }

  async function loginWithPassword() {
    if (!supabase) return setBackendNotice('Supabase ist nicht konfiguriert.');
    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
      if (error) throw error;
      let { data: profile, error: profileError } = await supabase.from('profiles').select('id, email, full_name, role, bakery_id').eq('id', data.user.id).maybeSingle();
      if (profileError) throw profileError;
      if (!profile && data.user.user_metadata?.account_type === 'bakery_application') {
        await finalizeBakeryApplication(data.user);
        const profileResult = await supabase.from('profiles').select('id, email, full_name, role, bakery_id').eq('id', data.user.id).maybeSingle();
        if (profileResult.error) throw profileResult.error;
        profile = profileResult.data;
      }
      if (!profile && data.user.user_metadata?.account_type === 'parent_registration') {
        await finalizeParentRegistration(data.user);
        const profileResult = await supabase.from('profiles').select('id, email, full_name, role, bakery_id').eq('id', data.user.id).maybeSingle();
        if (profileResult.error) throw profileResult.error;
        profile = profileResult.data;
      }
      if (!profile) throw new Error('Für dieses Konto wurde noch kein Benutzerprofil angelegt.');
      const loggedInUser = createUserFromProfile(data.user, profile);
      setUser(loggedInUser);

      if (loggedInUser.role === 'bakery') {
        const approval = await loadMyBakeryApproval(loggedInUser);
        if (approval?.approvalStatus === 'active' && approval.active) {
          await loadBakeryData(loggedInUser);
          setActiveTab('schule');
          setBackendNotice('Bäckerei-Login erfolgreich. Produktionsdaten geladen.');
        } else {
          setActiveTab('bakery-pending');
          setBackendNotice('Bäckerei-Login erfolgreich. Freigabe ausstehend.');
        }
      } else {
        await loadChildrenAndOrders(loggedInUser);
        if (loggedInUser.role === 'admin') await loadAdminApplications(loggedInUser);
        setActiveTab('start');
        setBackendNotice(loggedInUser.role === 'admin' ? 'Login erfolgreich. Admin-Daten geladen.' : 'Login erfolgreich. Kinder und Bestellungen geladen');
      }
    } catch (error) {
      setBackendNotice(`Login fehlgeschlagen: ${getNetworkErrorMessage(error)}`);
    } finally {
      setAuthLoading(false);
    }
  }

  function startGuestMode() {
    setIsGuestMode(true);
    setUser(null);
    setChildren(demoGuestChildren);
    setOrders(demoGuestOrders);
    setActiveChildId(demoGuestChildren[0].id);
    setCompletedOrders([]);
    setIssuedChildren({});
    setBackendNotice('Demo-Gastmodus aktiv – Änderungen werden nur lokal gespeichert.');
    setActiveTab('start');
  }

  function exitGuestMode() {
    setIsGuestMode(false);
    setUser(null);
    setChildren(initialChildren);
    setOrders(initialOrders);
    setActiveChildId(initialChildren[0].id);
    setCompletedOrders(initialCompletedOrders);
    setIssuedChildren({});
    setBackendNotice('Gastmodus beendet.');
    setActiveTab('start');
  }

  async function logout() {
    try { if (supabase) await supabase.auth.signOut(); } catch (error) { setBackendNotice(getNetworkErrorMessage(error)); }
    setUser(null);
    setBakeryApproval(null);
    setBackendNotice('Abgemeldet');
  }

  const hasRealSupabaseUser = functionNeedsRealUser(user);
  const currentUser = isGuestMode ? demoGuestUser : hasRealSupabaseUser ? user : demoUser;
  const navigationItems = getNavigationItems(currentUser, isGuestMode);
  const activeChild = children.find((child) => child.id === activeChildId) || children[0] || { id: '', name: '', school: '', className: '', allergies: 'keine' };
  const weeklyTotal = useMemo(() => calculateWeeklyTotal(orders, menuProducts), [orders, menuProducts]);
  const activeDayTotal = calculateChildDayTotal(activeChild.id, activeDay, orders, menuProducts);
  const dayItems = orders[activeChild.id]?.[activeDay] || [];
  const checkoutLines = useMemo(() => children.flatMap((child) => weekdays.flatMap((day) => {
    const itemIds = orders[child.id]?.[day] || [];
    if (!itemIds.length) return [];
    const products = itemIds.map((id) => menuProducts.find((product) => product.id === id)).filter(Boolean) as Product[];
    if (!products.length) return [];
    const schoolOption = schoolOptions.find((school) => school.id === child.schoolId);
    return [{ child, day, itemIds, products, total: products.reduce((sum, product) => sum + product.price, 0), bakeryId: schoolOption?.bakeryId || '', bakeryName: schoolOption?.bakeryName || 'Bäckerei' }];
  })), [children, orders, menuProducts, schoolOptions]);
  const checkoutGroups = useMemo(() => {
    const grouped = new Map<string, { bakeryId: string; bakeryName: string; total: number; lines: typeof checkoutLines }>();
    checkoutLines.forEach((line) => {
      const key = line.bakeryId || `school:${line.child.schoolId || line.child.school}`;
      const existing = grouped.get(key) || { bakeryId: line.bakeryId, bakeryName: line.bakeryName, total: 0, lines: [] as typeof checkoutLines };
      existing.total += line.total;
      existing.lines.push(line);
      grouped.set(key, existing);
    });
    return Array.from(grouped.values());
  }, [checkoutLines]);
  const checkoutPaymentReferences = useMemo(() => {
    const references: Record<string, string> = {};
    checkoutGroups.forEach((group) => {
      const key = group.bakeryId || group.bakeryName;
      references[key] = createCheckoutReference();
    });
    return references;
  }, [checkoutGroups]);
  const availableCheckoutPaymentMethods = useMemo(() => {
    if (isGuestMode) return paymentMethods;
    if (!checkoutGroups.length) return [] as string[];
    const bankAvailable = checkoutGroups.every((group) => {
      const settings = bakeryPaymentSettings[group.bakeryId];
      return Boolean(settings?.bankTransferEnabled && settings.accountHolder && settings.iban);
    });
    const paypalAvailable = checkoutGroups.every((group) => {
      const settings = bakeryPaymentSettings[group.bakeryId];
      return Boolean(settings?.paypalEnabled && settings.paypalLink);
    });
    return [bankAvailable ? 'Überweisung' : '', paypalAvailable ? 'PayPal' : ''].filter(Boolean);
  }, [checkoutGroups, bakeryPaymentSettings, isGuestMode]);
  useEffect(() => {
    if (activeTab !== 'zahlung' || !availableCheckoutPaymentMethods.length) return;
    if (!availableCheckoutPaymentMethods.includes(selectedPayment)) setSelectedPayment(availableCheckoutPaymentMethods[0]);
  }, [activeTab, availableCheckoutPaymentMethods, selectedPayment]);
  const checkoutTotal = checkoutLines.reduce((sum, line) => sum + line.total, 0);
  const checkoutChildrenCount = new Set(checkoutLines.map((line) => line.child.id)).size;
  const activeSchoolOption = schoolOptions.find((school) => school.id === activeChild.schoolId);
  const visibleMenuProducts =
    currentUser.role === 'parent' && !isGuestMode
      ? activeSchoolOption?.bakeryId
        ? menuProducts.filter((product) => product.bakeryId === activeSchoolOption.bakeryId)
        : []
      : menuProducts;
  const activeDeadlineSettings = activeSchoolOption?.bakeryId ? bakeryPaymentSettings[activeSchoolOption.bakeryId] : undefined;
  const activeDeadlineDaysBefore = activeDeadlineSettings?.deadlineDaysBefore ?? 1;
  const activeDeadlineTime = activeDeadlineSettings?.deadlineTime || '18:00';
  const activeDeadlineOpen = isOrderDeadlineOpen(activeDay, new Date(), activeDeadlineDaysBefore, activeDeadlineTime);
  const activeOrderEditable = activeDeadlineOpen;
  const schoolRows = buildSchoolRows(children, orders, activeDay, menuProducts);
  const productSummary = buildProductSummary(children, orders, activeDay, menuProducts);
  const paidRevenue = completedOrders.filter((order) => order.status === 'bezahlt').reduce((sum, order) => sum + order.total, 0);
  const openRevenue = completedOrders.filter((order) => order.status === 'offen').reduce((sum, order) => sum + order.total, 0);
  const filteredAdminOrders = useMemo(() => {
    let list = filterOrdersBySearch(completedOrders, adminOrderSearch);
    if (adminFilter === 'offen') list = list.filter((order) => order.status === 'offen');
    if (adminFilter === 'bezahlt') list = list.filter((order) => order.status === 'bezahlt');
    return list;
  }, [completedOrders, adminOrderSearch, adminFilter]);
  const parentOrderStats = useMemo(() => getParentOrderStats(completedOrders), [completedOrders]);
  const adminTodoSummary = useMemo(() => ({ openPayments: parentOrderStats.openCount, productionItems: productSummary.reduce((sum, row) => sum + row.quantity, 0), emailsOpen: completedOrders.filter((order) => order.status !== 'storniert' && order.email !== 'gesendet').length }), [completedOrders, parentOrderStats.openCount, productSummary]);
  const bakeryProductCount = productSummary.reduce((sum, row) => sum + row.quantity, 0);
  const activeBakeryDeliveryDate = getDeliveryDateForWeek(activeDay, bakeryWeekOffset);
  const bakeryOrderCount = bakeryOrderCountsByDate[activeBakeryDeliveryDate] || 0;
  const bakeryAllergyRows = schoolRows.filter(({ child }) => child.allergies && child.allergies.toLowerCase() !== 'keine');
  const bakerySchoolCount = new Set(schoolRows.map(({ child }) => child.school)).size;
  const bakeryRevenue = schoolRows.reduce((sum, row) => sum + row.total, 0);
  const bakeryDetails = buildProductionOrderDetails({ childrenList: children, orderMap: orders, day: activeDay, productList: menuProducts, parentName: currentUser.name, parentEmail: currentUser.email, completedOrders, deliveryDate: getDeliveryDateForWeek(activeDay, bakeryWeekOffset) });

  async function copyToClipboard(text: string, label = 'Text') {
    try { await navigator.clipboard.writeText(String(text)); setCopiedText(`${label} kopiert`); } catch { setCopiedText(`${label} konnte nicht kopiert werden`); }
  }

  function openPayPalPayment(paymentLink = PAYPAL_PAYMENT_LINK) {
    if (isGuestMode) {
      setPaypalStatus('Im Demo-Gastmodus werden keine echten PayPal-Zahlungen geöffnet.');
      return;
    }
    if (!paymentLink) { setPaypalStatus('Für diese Bäckerei ist noch kein PayPal-Link hinterlegt.'); return; }
    const opened = window.open(paymentLink, '_blank', 'noopener,noreferrer');
    setPaypalStatus(opened ? 'PayPal wurde geöffnet. Bitte dort Betrag und Verwendungszweck angeben.' : 'PayPal konnte vom Browser nicht automatisch geöffnet werden. Bitte Link kopieren und im Browser öffnen.');
  }

  function changeProductQuantity(productId: string, delta: number) {
    if (!activeOrderEditable) return setBackendNotice(`Bestellungen für ${activeDay} sind nach der Frist fixiert.`);
    setOrders((prev) => {
      const childOrders = prev[activeChild.id] || {};
      const current = childOrders[activeDay] || [];
      let next = [...current];

      if (delta > 0) {
        next.push(productId);
      } else if (delta < 0) {
        const index = next.lastIndexOf(productId);
        if (index >= 0) next.splice(index, 1);
      }

      return { ...prev, [activeChild.id]: { ...childOrders, [activeDay]: next } };
    });
  }

  async function toggleIssued(childId: string) {
    const deliveryDate = getDeliveryDateForWeek(activeDay, bakeryWeekOffset);
    const key = `${deliveryDate}::${childId}`;
    const nextIssued = !Boolean(issuedChildren[key]);

    if (supabase && currentUser.role === 'bakery' && functionNeedsRealUser(currentUser)) {
      setIsSaving(true);
      try {
        const { error } = await supabase.rpc('set_child_orders_issued', {
          p_child_id: childId,
          p_delivery_date: deliveryDate,
          p_issued: nextIssued
        });
        if (error) throw error;
        setIssuedChildren((prev) => ({ ...prev, [key]: nextIssued }));
        setBackendNotice(nextIssued ? 'Ausgabe in Supabase gespeichert.' : 'Ausgabestatus zurückgesetzt.');
      } catch (error) {
        setBackendNotice(`Ausgabestatus konnte nicht gespeichert werden: ${getNetworkErrorMessage(error)}`);
      } finally {
        setIsSaving(false);
      }
      return;
    }

    setIssuedChildren((prev) => ({ ...prev, [key]: nextIssued }));
  }

  async function addChild() {
    const trimmed = newChildName.trim();
    const selectedSchool = schoolOptions.find((school) => school.id === newChildSchoolId);
    if (!trimmed) return setBackendNotice('Bitte den Namen des Kindes eingeben.');
    if (!isGuestMode && functionNeedsRealUser(user) && !selectedSchool) return setBackendNotice('Bitte eine Schule auswählen.');
    const localChild: Child = { id: slugify(trimmed) || `kind-${children.length + 1}`, name: trimmed, school: selectedSchool?.name || 'Grundschule Demo', schoolId: selectedSchool?.id || null, className: newChildClassName.trim() || '1A', allergies: newChildAllergies.trim() || 'keine' };
    if (supabase && functionNeedsRealUser(user)) {
      try {
        const { data, error } = await supabase.from('children').insert({ parent_id: user.id, name: localChild.name, school: localChild.school, school_id: localChild.schoolId, class_name: localChild.className, allergies: localChild.allergies }).select('id, name, school, school_id, class_name, allergies').single();
        if (error) throw error;
        const savedChild = normalizeChild(data);
        setChildren((prev) => [...prev, savedChild]);
        setActiveChildId(savedChild.id);
        setBackendNotice(`Kind gespeichert · ${selectedSchool?.name} · ${selectedSchool?.bakeryName}`);
      } catch (error) { setBackendNotice(`Kind konnte nicht gespeichert werden: ${getNetworkErrorMessage(error)}`); }
    } else {
      setChildren((prev) => [...prev, localChild]);
      setActiveChildId(localChild.id);
      setBackendNotice('Kind lokal hinzugefügt. Für Supabase bitte einloggen.');
    }
    setNewChildName('');
    setNewChildClassName('');
    setNewChildAllergies('keine');
  }

  function startEditChild(child: Child) {
    const mappedSchoolId = child.schoolId || schoolOptions.find((school) => school.name === child.school)?.id || '';
    setEditingChildId(child.id);
    setEditingChild({
      name: child.name,
      schoolId: mappedSchoolId,
      className: child.className || '',
      allergies: child.allergies || 'keine'
    });
  }

  function cancelEditChild() {
    setEditingChildId('');
    setEditingChild({ name: '', schoolId: '', className: '', allergies: 'keine' });
  }

  async function saveChildChanges(childId: string) {
    const name = editingChild.name.trim();
    const selectedSchool = schoolOptions.find((school) => school.id === editingChild.schoolId);
    if (!name) return setBackendNotice('Bitte den Namen des Kindes eingeben.');
    if (!isGuestMode && functionNeedsRealUser(user) && !selectedSchool) return setBackendNotice('Bitte eine Schule auswählen.');

    const updatedChild: Child = {
      id: childId,
      name,
      school: selectedSchool?.name || children.find((child) => child.id === childId)?.school || 'Grundschule Demo',
      schoolId: selectedSchool?.id || null,
      className: editingChild.className.trim() || '1A',
      allergies: editingChild.allergies.trim() || 'keine'
    };

    setIsSaving(true);
    try {
      if (supabase && functionNeedsRealUser(user) && isUuid(childId)) {
        const { data, error } = await supabase
          .from('children')
          .update({
            name: updatedChild.name,
            school: updatedChild.school,
            school_id: updatedChild.schoolId,
            class_name: updatedChild.className,
            allergies: updatedChild.allergies
          })
          .eq('id', childId)
          .eq('parent_id', user.id)
          .select('id, name, school, school_id, class_name, allergies')
          .single();
        if (error) throw error;
        const savedChild = normalizeChild(data);
        setChildren((prev) => prev.map((child) => (child.id === childId ? savedChild : child)));
        setBackendNotice(`Kind aktualisiert · ${savedChild.school}${selectedSchool?.bakeryName ? ` · ${selectedSchool.bakeryName}` : ''}`);
      } else {
        setChildren((prev) => prev.map((child) => (child.id === childId ? updatedChild : child)));
        setBackendNotice('Kind lokal aktualisiert.');
      }
      cancelEditChild();
    } catch (error) {
      setBackendNotice(`Kind konnte nicht aktualisiert werden: ${getNetworkErrorMessage(error)}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteChild(child: Child) {
    const confirmed = window.confirm(`Soll ${child.name} wirklich gelöscht werden? Bereits vorhandene Bestellungen bleiben erhalten bzw. können das Löschen verhindern.`);
    if (!confirmed) return;

    setIsSaving(true);
    try {
      if (supabase && functionNeedsRealUser(user) && isUuid(child.id)) {
        const { error } = await supabase
          .from('children')
          .delete()
          .eq('id', child.id)
          .eq('parent_id', user.id);
        if (error) throw error;
      }

      setChildren((prev) => {
        const next = prev.filter((item) => item.id !== child.id);
        if (activeChildId === child.id) setActiveChildId(next[0]?.id || '');
        return next;
      });
      setOrders((prev) => {
        const next = { ...prev };
        delete next[child.id];
        return next;
      });
      if (editingChildId === child.id) cancelEditChild();
      setBackendNotice(`${child.name} wurde gelöscht.`);
    } catch (error) {
      setBackendNotice(`Kind konnte nicht gelöscht werden: ${getNetworkErrorMessage(error)}. Falls bereits Bestellungen vorhanden sind, sollte das Kind besser nur bearbeitet werden.`);
    } finally {
      setIsSaving(false);
    }
  }

  async function invokeEmailFunction(type: string, payload: any) {
    if (!supabase) return { sent: false, reason: 'Supabase ist nicht verbunden.' };
    if (!EMAIL_FUNCTION_NAME) return { sent: false, reason: 'EMAIL_FUNCTION_NAME ist leer.' };
    try {
      const { data, error } = await supabase.functions.invoke(EMAIL_FUNCTION_NAME, {
        method: 'POST',
        body: { type, payload }
      });
      if (error) {
        let details = error.message || 'Unbekannter Edge-Function-Fehler';
        const context = (error as any)?.context;
        if (context) {
          try {
            const status = context.status ? `HTTP ${context.status}` : '';
            const bodyText = typeof context.clone === 'function' ? await context.clone().text() : '';
            details = [status, details, bodyText].filter(Boolean).join(' · ');
          } catch {
            // Ignore secondary debug errors and keep the original message.
          }
        }
        return { sent: false, reason: `${EMAIL_FUNCTION_NAME}: ${details}` };
      }
      return { sent: true, data };
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error || 'Unbekannter Fehler');
      return { sent: false, reason: `${EMAIL_FUNCTION_NAME}: ${rawMessage}` };
    }
  }

  async function sendOrderEmails({ savedOrder, selectedProducts }: { savedOrder: CompletedOrder; selectedProducts: Product[] }) {
    const payload = buildOrderEmailPayload({ order: savedOrder, child: activeChild, day: activeDay, selectedProducts });
    const result = await invokeEmailFunction('order_confirmation', payload);
    if (result.sent && isUuid(savedOrder.id)) {
      try { await supabase!.from('orders').update({ confirmation_email_sent: true }).eq('id', savedOrder.id); } catch (error) { setBackendNotice(getNetworkErrorMessage(error)); }
    }
    return result;
  }

  async function sendReminderEmail(type: string, order: CompletedOrder | null = null) {
    const payload = order ? { adminEmail: ADMIN_EMAIL, parentName: order.parent, parentEmail: order.parentEmail, childName: order.child, weekday: order.day, total: order.total, paymentMethod: order.payment, paymentReference: order.paymentReference } : { adminEmail: ADMIN_EMAIL, parentName: currentUser.name, parentEmail: currentUser.email, weekday: activeDay, deadline: formatOrderDeadline(activeDay) };
    setIsSaving(true);
    const result = await invokeEmailFunction(type, payload);
    setIsSaving(false);
    setBackendNotice(result.sent ? 'Reminder-Mail gesendet' : `Reminder konnte nicht gesendet werden: ${result.reason}`);
  }

  async function sendProductionListToBakery() {
    if (isGuestMode) {
      setBackendNotice('Demo-Modus: Die Produktionsliste wird nicht wirklich versendet.');
      return;
    }
    if (!productSummary.length) {
      setBackendNotice('Keine Produkte für diesen Tag vorhanden.');
      return;
    }
    const orderDetails = buildProductionOrderDetails({ childrenList: children, orderMap: orders, day: activeDay, productList: menuProducts, parentName: currentUser.name, parentEmail: currentUser.email, completedOrders });
    setIsSaving(true);
    const result = await invokeEmailFunction('bakery_production_list', {
      adminEmail: ADMIN_EMAIL,
      bakeryEmail: BAKERY_EMAIL,
      weekday: activeDay,
      deliveryDate: getNextDeliveryDate(activeDay),
      products: productSummary.map((row) => ({ name: row.product, quantity: row.quantity })),
      orders: orderDetails
    });
    setIsSaving(false);
    setBackendNotice(result.sent ? `Produktionsliste an ${BAKERY_EMAIL} gesendet` : `Produktionsliste konnte nicht gesendet werden: ${result.reason}`);
  }

  async function saveCheckoutLineToSupabase({ line, checkoutId, paymentReference, status }: { line: { child: Child; day: string; products: Product[]; total: number; bakeryId: string; bakeryName: string }; checkoutId: string; paymentReference: string; status: string }) {
    const selectedProducts = line.products;
    if (!supabase || !functionNeedsRealUser(user)) return { saved: false, reason: 'Keine echte Supabase-Session aktiv.', selectedProducts };
    if (!selectedProducts.length) return { saved: false, reason: 'Keine Produkte ausgewählt.', selectedProducts };
    if (!selectedProducts.every((product) => isUuid(product.id))) return { saved: false, reason: 'Mindestens ein Produkt stammt noch aus Demo-Daten.', selectedProducts };
    const childId = isUuid(line.child.id) ? line.child.id : null;
    if (!childId) return { saved: false, reason: `Kind ${line.child.name} ist noch nicht in Supabase gespeichert.`, selectedProducts };
    try {
      const schoolOption = schoolOptions.find((school) => school.id === line.child.schoolId);
      const { data: insertedOrder, error: orderError } = await supabase.from('orders').insert({
        parent_id: user.id,
        child_id: childId,
        school: line.child.school,
        school_id: line.child.schoolId,
        bakery_id: line.bakeryId || schoolOption?.bakeryId || null,
        delivery_date: getNextDeliveryDate(line.day),
        weekday: line.day,
        total: line.total,
        payment_method: selectedPayment,
        payment_reference: paymentReference,
        checkout_id: checkoutId,
        status,
        confirmation_email_sent: false,
        bakery_email_sent: false
      }).select('id').single();
      if (orderError) throw orderError;
      const orderItems = groupProductsByQuantity(selectedProducts).map(({ product, quantity }) => ({ order_id: insertedOrder.id, product_id: product.id, product_name: product.name, quantity, unit_price: product.price }));
      const { error: itemError } = await supabase.from('order_items').insert(orderItems);
      if (itemError) throw itemError;
      return { saved: true, orderId: insertedOrder.id, selectedProducts };
    } catch (error) {
      return { saved: false, reason: getNetworkErrorMessage(error), selectedProducts };
    }
  }

  async function sendCheckoutLineEmail(savedOrder: CompletedOrder, line: { child: Child; day: string; products: Product[] }) {
    const payload = buildOrderEmailPayload({ order: savedOrder, child: line.child, day: line.day, selectedProducts: line.products });
    const result = await invokeEmailFunction('order_confirmation', payload);
    if (result.sent && isUuid(savedOrder.id)) {
      try { await supabase!.from('orders').update({ confirmation_email_sent: true }).eq('id', savedOrder.id); } catch (error) { setBackendNotice(getNetworkErrorMessage(error)); }
    }
    return result;
  }

  async function confirmOrder() {
    if (!checkoutLines.length) return setLastConfirmation('Bitte wähle zuerst mindestens ein Produkt für ein Kind aus.');
    const closedLines = checkoutLines.filter((line) => { const settings = bakeryPaymentSettings[line.bakeryId]; return !isOrderDeadlineOpen(line.day, new Date(), settings?.deadlineDaysBefore ?? 1, settings?.deadlineTime || '18:00'); });
    if (closedLines.length) {
      const affected = Array.from(new Set(closedLines.map((line) => `${line.child.name} · ${line.day}`))).join(', ');
      return setLastConfirmation(`Für folgende Auswahl ist die Bestellfrist bereits abgelaufen: ${affected}. Bitte entferne diese Auswahl zuerst.`);
    }

    const paymentReferenceByBakery = new Map<string, string>();
    checkoutGroups.forEach((group) => {
      const key = group.bakeryId || group.bakeryName;
      paymentReferenceByBakery.set(key, checkoutPaymentReferences[key] || createCheckoutReference());
    });
    const checkoutId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const status = selectedPayment === 'Stripe' || selectedPayment === 'Kreditkarte' ? 'bezahlt' : 'offen';

    if (!isGuestMode) {
      if (!availableCheckoutPaymentMethods.length) return setLastConfirmation('Für diese Bäckerei ist aktuell keine Zahlungsart freigeschaltet. Bitte die Bäckerei informieren.');
      if (!availableCheckoutPaymentMethods.includes(selectedPayment)) return setLastConfirmation('Die gewählte Zahlungsart ist für diese Bäckerei nicht verfügbar. Bitte eine andere Zahlungsart auswählen.');
      const missing = checkoutGroups.filter((group) => {
        const settings = bakeryPaymentSettings[group.bakeryId];
        if (selectedPayment === 'Überweisung') return !settings?.bankTransferEnabled || !settings.accountHolder || !settings.iban;
        if (selectedPayment === 'PayPal') return !settings?.paypalEnabled || !settings.paypalLink;
        return true;
      });
      if (missing.length) return setLastConfirmation(`Zahlung noch nicht möglich: ${selectedPayment} ist für ${missing.map((group) => group.bakeryName).join(', ')} nicht vollständig eingerichtet.`);
    }

    if (isGuestMode) {
      const demoOrders = checkoutLines.map((line, index) => ({
        id: `ord-${1000 + completedOrders.length + index + 1}`,
        parent: currentUser.name,
        parentEmail: currentUser.email,
        child: line.child.name,
        school: line.child.school,
        day: line.day,
        deliveryDate: getNextDeliveryDate(line.day),
        total: line.total,
        payment: selectedPayment,
        paymentReference: paymentReferenceByBakery.get(line.bakeryId || line.bakeryName) || createCheckoutReference(),
        status,
        email: 'vorgemerkt',
        checkoutId
      } as CompletedOrder));
      setCompletedOrders((prev) => [...demoOrders, ...prev]);
      setLastOrder({ ...demoOrders[0], child: `${checkoutChildrenCount} Kind(er)`, day: 'Sammelbestellung', total: checkoutTotal });
      setLastPaymentGroups(checkoutGroups.map((group) => ({ bakeryId: group.bakeryId, bakeryName: group.bakeryName, total: group.total, paymentReference: paymentReferenceByBakery.get(group.bakeryId || group.bakeryName) || '', accountHolder: 'Demo Bäckerei', iban: 'IT00X0000000000000000000000', bic: '', paypalLink: PAYPAL_PAYMENT_LINK || '', bankTransferEnabled: true, paypalEnabled: Boolean(PAYPAL_PAYMENT_LINK), deadlineDaysBefore: 1, deadlineTime: '18:00' })));
      setLastConfirmation(`Demo-Sammelbestellung erfolgreich: ${checkoutLines.length} Teilbestellung(en), ${money(checkoutTotal)} gesamt.`);
      setOrders({});
      return;
    }

    setIsSaving(true);
    setPaypalStatus('');
    try {
      const savedOrders: CompletedOrder[] = [];
      let emailFailures = 0;
      const emailFailureReasons: string[] = [];

      for (const line of checkoutLines) {
        const linePaymentReference = paymentReferenceByBakery.get(line.bakeryId || line.bakeryName) || createCheckoutReference();
        const result = await saveCheckoutLineToSupabase({ line, checkoutId, paymentReference: linePaymentReference, status });
        if (!result.saved) throw new Error(result.reason || `Bestellung für ${line.child.name} konnte nicht gespeichert werden.`);
        let savedOrder: CompletedOrder = {
          id: result.orderId!,
          parent: currentUser.name,
          parentEmail: currentUser.email,
          child: line.child.name,
          school: line.child.school,
          day: line.day,
          deliveryDate: getNextDeliveryDate(line.day),
          total: line.total,
          payment: selectedPayment,
          paymentReference: linePaymentReference,
          status,
          email: 'vorgemerkt',
          checkoutId
        };
        const emailResult = await sendCheckoutLineEmail(savedOrder, line);
        savedOrder = { ...savedOrder, email: emailResult.sent ? 'gesendet' : 'vorgemerkt' };
        if (!emailResult.sent) {
          emailFailures += 1;
          emailFailureReasons.push(`${line.child.name} · ${line.day}: ${emailResult.reason || 'Unbekannter Fehler'}`);
        }
        savedOrders.push(savedOrder);
      }

      if (selectedPayment === 'PayPal') {
        setPaypalStatus(checkoutGroups.length > 1 ? `Sammelbestellung gespeichert. Bitte die ${checkoutGroups.length} Bäckereien getrennt über PayPal bezahlen.` : `Sammelbestellung gespeichert. Bitte ${money(checkoutTotal)} über PayPal bezahlen.`);
      }

      setCompletedOrders((prev) => [...savedOrders, ...prev]);
      const paymentSummaries: PaymentGroupSummary[] = checkoutGroups.map((group) => {
        const settings = bakeryPaymentSettings[group.bakeryId] || { bakeryId: group.bakeryId, bakeryName: group.bakeryName, accountHolder: '', iban: '', bic: '', paypalLink: '', bankTransferEnabled: false, paypalEnabled: false, deadlineDaysBefore: 1, deadlineTime: '18:00' };
        return { ...settings, bakeryId: group.bakeryId, bakeryName: group.bakeryName, total: group.total, paymentReference: paymentReferenceByBakery.get(group.bakeryId || group.bakeryName) || '' };
      });
      setLastPaymentGroups(paymentSummaries);
      setLastOrder({ ...savedOrders[0], child: `${checkoutChildrenCount} Kind(er)`, day: 'Sammelbestellung', total: checkoutTotal, paymentReference: paymentSummaries.length === 1 ? paymentSummaries[0].paymentReference : 'Mehrere Zahlungsreferenzen' });
      setLastConfirmation(emailFailures === 0
        ? `Sammelbestellung erfolgreich: ${savedOrders.length} Teilbestellung(en) für ${checkoutChildrenCount} Kind(er).`
        : `Sammelbestellung gespeichert. ${emailFailures} Bestätigungs-E-Mail(s) konnten nicht versendet werden. Fehler: ${emailFailureReasons.join(' | ')}`);
      setBackendNotice(emailFailures === 0 ? 'Sammelbestellung gespeichert und E-Mails gesendet' : 'Sammelbestellung gespeichert, E-Mail-Versand teilweise offen');
      setOrders({});
      await loadChildrenAndOrders(user);
    } catch (error) {
      setLastOrder(null);
      setLastPaymentGroups([]);
      setLastConfirmation(`Fehler beim Speichern: ${getNetworkErrorMessage(error)}`);
    } finally {
      setIsSaving(false);
    }
  }

  function canParentEditOrder(order: CompletedOrder) {
    const settings = order.bakeryId ? bakeryPaymentSettings[order.bakeryId] : undefined;
    return order.status === 'offen' && isOrderDeadlineOpen(order.day, new Date(), settings?.deadlineDaysBefore ?? 1, settings?.deadlineTime || '18:00');
  }

  function startEditExistingOrder(order: CompletedOrder) {
    if (!canParentEditOrder(order)) {
      setParentOrderNotice('Diese Bestellung kann nicht mehr bearbeitet werden.');
      return;
    }
    setEditingOrderId(order.id);
    setEditingOrderItems([...(order.itemIds || [])]);
    setParentOrderNotice('');
  }

  function changeExistingOrderQuantity(productId: string, delta: number) {
    setEditingOrderItems((prev) => {
      const next = [...prev];
      if (delta > 0) next.push(productId);
      if (delta < 0) {
        const index = next.lastIndexOf(productId);
        if (index >= 0) next.splice(index, 1);
      }
      return next;
    });
  }

  async function saveExistingOrderChanges(order: CompletedOrder) {
    if (!supabase || !functionNeedsRealUser(user)) return;
    if (!canParentEditOrder(order)) return setParentOrderNotice('Die Bestellfrist ist abgelaufen oder die Bestellung ist nicht mehr offen.');
    if (!editingOrderItems.length) return setParentOrderNotice('Bitte wähle mindestens ein Produkt aus oder storniere die Bestellung.');

    const selectedProducts = editingOrderItems.map((id) => menuProducts.find((product) => product.id === id)).filter(Boolean) as Product[];
    if (!selectedProducts.length) return setParentOrderNotice('Die ausgewählten Produkte konnten nicht geladen werden.');
    const newTotal = selectedProducts.reduce((sum, product) => sum + product.price, 0);

    setIsSaving(true);
    try {
      const { error: orderError } = await supabase.from('orders').update({ total: newTotal, confirmation_email_sent: false }).eq('id', order.id).eq('parent_id', user.id).eq('status', 'offen');
      if (orderError) throw orderError;
      const { error: deleteItemsError } = await supabase.from('order_items').delete().eq('order_id', order.id);
      if (deleteItemsError) throw deleteItemsError;
      const rows = groupProductsByQuantity(selectedProducts).map(({ product, quantity }) => ({ order_id: order.id, product_id: product.id, product_name: product.name, quantity, unit_price: product.price }));
      const { error: insertItemsError } = await supabase.from('order_items').insert(rows);
      if (insertItemsError) throw insertItemsError;
      setEditingOrderId('');
      setEditingOrderItems([]);
      setParentOrderNotice(`Bestellung für ${order.child} wurde aktualisiert. Der Verwendungszweck bleibt unverändert.`);
      await loadChildrenAndOrders(user);
    } catch (error) {
      setParentOrderNotice(`Bestellung konnte nicht geändert werden: ${getNetworkErrorMessage(error)}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function cancelExistingOrder(order: CompletedOrder) {
    if (!supabase || !functionNeedsRealUser(user)) {
      setParentOrderNotice('Stornierung ist nur mit einem eingeloggten Elternkonto möglich.');
      return;
    }
    if (!canParentEditOrder(order)) {
      setParentOrderNotice('Diese Bestellung kann nicht mehr storniert werden.');
      return;
    }

    const confirmed = window.confirm(`Bestellung für ${order.child} am ${order.day} wirklich stornieren?`);
    if (!confirmed) return;

    setParentOrderNotice('Stornierung wird gespeichert ...');
    setIsSaving(true);
    try {
      const { data, error } = await supabase.rpc('cancel_my_order', { p_order_id: order.id });
      if (error) throw error;
      if (data === false) throw new Error('Die Bestellung wurde nicht storniert. Bitte prüfe Status und Bestellfrist.');

      if (editingOrderId === order.id) {
        setEditingOrderId('');
        setEditingOrderItems([]);
      }
      setParentOrderNotice(`Bestellung für ${order.child} wurde storniert.`);
      await loadChildrenAndOrders(user);
    } catch (error) {
      setParentOrderNotice(`Bestellung konnte nicht storniert werden: ${getNetworkErrorMessage(error)}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function markPaid(orderId: string) {
    const orderToConfirm = completedOrders.find((order) => order.id === orderId);
    const checkoutId = orderToConfirm?.checkoutId || null;
    const paymentReference = orderToConfirm?.paymentReference || '';
    setCompletedOrders((prev) => prev.map((order) => checkoutId && order.checkoutId === checkoutId && order.paymentReference === paymentReference && order.status === 'offen' ? { ...order, status: 'bezahlt' } : order.id === orderId && order.status === 'offen' ? { ...order, status: 'bezahlt' } : order));
    if (supabase && functionNeedsRealUser(user) && isUuid(orderId)) {
      setIsSaving(true);
      try {
        let paymentUpdate = supabase.from('orders').update({ status: 'bezahlt' });
        paymentUpdate = checkoutId ? paymentUpdate.eq('checkout_id', checkoutId).eq('payment_reference', paymentReference).eq('status', 'offen') : paymentUpdate.eq('id', orderId).eq('status', 'offen');
        const { error } = await paymentUpdate;
        if (error) throw error;
        if (orderToConfirm) {
          const payableCheckoutOrders = checkoutId ? completedOrders.filter((order) => order.checkoutId === checkoutId && order.paymentReference === paymentReference && order.status !== 'storniert') : [orderToConfirm];
          await invokeEmailFunction('payment_confirmed', { orderId, checkoutId, parentName: orderToConfirm.parent, parentEmail: orderToConfirm.parentEmail, childName: checkoutId ? 'Sammelbestellung' : orderToConfirm.child, total: payableCheckoutOrders.reduce((sum, order) => sum + order.total, 0), paymentReference: orderToConfirm.paymentReference, adminEmail: ADMIN_EMAIL });
        }
        setBackendNotice(checkoutId ? 'Zahlungsgruppe dieser Bäckerei als bezahlt markiert' : 'Zahlung bestätigt');
      } catch (error) { setBackendNotice(`Zahlungsstatus konnte nicht gespeichert werden: ${getNetworkErrorMessage(error)}`); }
      finally { setIsSaving(false); }
    } else setBackendNotice('Zahlung lokal als bezahlt markiert');
  }

  async function addProduct() {
    const name = newProduct.name.trim();
    const price = Number.parseFloat(String(newProduct.price).replace(',', '.'));
    const tags = newProduct.tags.split(',').map((tag) => tag.trim()).filter(Boolean);
    const desc = newProduct.desc.trim();
    if (!name) return setBackendNotice('Bitte einen Produktnamen eingeben.');
    if (Number.isNaN(price) || price <= 0) return setBackendNotice('Bitte einen gültigen Preis größer als 0 eingeben.');

    if (supabase && currentUser.role === 'bakery' && functionNeedsRealUser(currentUser)) {
      setIsSaving(true);
      try {
        const { error } = await supabase.rpc('create_my_bakery_product', {
          p_name: name,
          p_price: price,
          p_description: desc,
          p_tags: tags
        });
        if (error) throw error;
        setNewProduct({ name: '', price: '', tags: '', desc: '' });
        await loadBakeryData(currentUser, bakeryWeekOffset);
        setBackendNotice(`Produkt „${name}“ wurde angelegt.`);
      } catch (error) {
        setBackendNotice(`Produkt konnte nicht angelegt werden: ${getNetworkErrorMessage(error)}`);
      } finally {
        setIsSaving(false);
      }
      return;
    }

    const product = { id: slugify(name), name, price, tags, desc: desc || 'Beschreibung folgt.' };
    setMenuProducts((prev) => [...prev, product]);
    setNewProduct({ name: '', price: '', tags: '', desc: '' });
  }

  function startEditProduct(product: Product) {
    setEditingProductId(product.id);
    setEditingProduct({
      name: product.name,
      price: String(product.price).replace('.', ','),
      tags: product.tags.join(', '),
      desc: product.desc || ''
    });
  }

  function cancelEditProduct() {
    setEditingProductId('');
    setEditingProduct({ name: '', price: '', tags: '', desc: '' });
  }

  async function saveProductChanges(productId: string) {
    if (!supabase || currentUser.role !== 'bakery' || !functionNeedsRealUser(currentUser)) return;
    const name = editingProduct.name.trim();
    const price = Number.parseFloat(String(editingProduct.price).replace(',', '.'));
    const tags = editingProduct.tags.split(',').map((tag) => tag.trim()).filter(Boolean);
    const desc = editingProduct.desc.trim();
    if (!name) return setBackendNotice('Bitte einen Produktnamen eingeben.');
    if (Number.isNaN(price) || price <= 0) return setBackendNotice('Bitte einen gültigen Preis größer als 0 eingeben.');

    setIsSaving(true);
    try {
      const { error } = await supabase.rpc('update_my_bakery_product', {
        p_product_id: productId,
        p_name: name,
        p_price: price,
        p_description: desc,
        p_tags: tags
      });
      if (error) throw error;
      cancelEditProduct();
      await loadBakeryData(currentUser, bakeryWeekOffset);
      setBackendNotice('Produkt wurde gespeichert.');
    } catch (error) {
      setBackendNotice(`Produkt konnte nicht gespeichert werden: ${getNetworkErrorMessage(error)}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleProductActive(product: Product) {
    if (!supabase || currentUser.role !== 'bakery' || !functionNeedsRealUser(currentUser)) return;
    const nextActive = product.active === false;
    setIsSaving(true);
    try {
      const { error } = await supabase.rpc('set_my_bakery_product_active', {
        p_product_id: product.id,
        p_active: nextActive
      });
      if (error) throw error;
      await loadBakeryData(currentUser, bakeryWeekOffset);
      setBackendNotice(nextActive ? 'Produkt wurde aktiviert.' : 'Produkt wurde deaktiviert.');
    } catch (error) {
      setBackendNotice(`Produktstatus konnte nicht geändert werden: ${getNetworkErrorMessage(error)}`);
    } finally {
      setIsSaving(false);
    }
  }

  function printBakeryList() { window.print(); }

  if (hasRealSupabaseUser && currentUser.role === 'bakery' && (!bakeryApproval || bakeryApproval.approvalStatus !== 'active' || !bakeryApproval.active)) {
    const status = bakeryApproval?.approvalStatus || 'pending';
    const rejected = status === 'rejected';
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-emerald-50 px-4 py-10 text-slate-950">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 flex items-center justify-between">
            <div className="flex items-center gap-3"><span className="text-4xl">🥪</span><div><p className="text-2xl font-black">Pausenapp</p><p className="text-sm font-medium text-slate-500">Einfach. Bestellt.</p></div></div>
            <button onClick={logout} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm ring-1 ring-slate-200 hover:text-slate-950">↪ Abmelden</button>
          </div>
          <Card className="overflow-hidden rounded-[2rem] border-0 bg-white shadow-xl ring-1 ring-slate-200">
            <div className={`p-7 text-white ${rejected ? 'bg-gradient-to-r from-red-600 to-rose-500' : 'bg-gradient-to-r from-amber-500 to-orange-500'}`}>
              <div className="flex items-center gap-3"><span className="text-4xl">{rejected ? '✕' : '⏳'}</span><div><p className="text-sm font-black uppercase tracking-wide text-white/80">Bäckerei-Registrierung</p><h1 className="mt-1 text-3xl font-black">{rejected ? 'Registrierung nicht freigegeben' : 'Freigabe ausstehend'}</h1></div></div>
            </div>
            <CardContent className="p-7 sm:p-9">
              <h2 className="text-2xl font-black">{bakeryApproval?.name || currentUser.name}</h2>
              <p className="mt-2 text-slate-500">{currentUser.email}</p>
              {!rejected ? (
                <>
                  <div className="mt-6 rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200"><p className="font-black text-amber-950">🟡 Dein Konto wird geprüft.</p><p className="mt-2 leading-relaxed text-amber-900">Wir prüfen die Bäckereiangaben und die vorgeschlagenen Schulen. Sobald die Freigabe erfolgt ist, wird das Produktionsdashboard automatisch für dieses Konto verfügbar.</p></div>
                  <div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-400">1</p><p className="mt-1 font-black">Registrierung</p><p className="mt-1 text-sm text-emerald-700">✓ abgeschlossen</p></div><div className="rounded-2xl bg-amber-50 p-4"><p className="text-xs font-bold uppercase text-amber-500">2</p><p className="mt-1 font-black">Prüfung</p><p className="mt-1 text-sm text-amber-700">läuft</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-400">3</p><p className="mt-1 font-black">Freischaltung</p><p className="mt-1 text-sm text-slate-500">danach verfügbar</p></div></div>
                </>
              ) : <div className="mt-6 rounded-2xl bg-red-50 p-5 ring-1 ring-red-200"><p className="font-black text-red-950">Der Antrag wurde abgelehnt.</p><p className="mt-2 text-red-800">Bitte kontaktiere den Pausenapp-Administrator, wenn Angaben korrigiert oder erneut geprüft werden sollen.</p></div>}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!hasRealSupabaseUser && !isGuestMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-emerald-50 px-4 py-10 text-slate-950">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">🥪</span>
              <div><p className="text-2xl font-black">Pausenapp</p><p className="text-sm font-medium text-slate-500">Einfach. Bestellt.</p></div>
            </div>
            <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200">Live-Demo</span>
          </div>

          <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-[2rem] bg-white p-8 shadow-xl shadow-violet-100/60 ring-1 ring-slate-200 sm:p-10">
              <span className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-sm font-bold text-violet-700">Für Eltern, Schulen & Bäckereien</span>
              <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">Gesunde Schulpausen einfach digital bestellen.</h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">Teste den kompletten Ablauf mit Demo-Daten: Kind auswählen, Produkte bestellen, Zahlung simulieren und die Bäckerei-Produktionsansicht ansehen.</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button type="button" onClick={startGuestMode} className="rounded-2xl bg-violet-600 px-6 py-6 text-base font-black text-white hover:bg-violet-700">👤 Demo starten</Button>
                <span className="flex items-center rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">✓ Keine echten Bestellungen oder Zahlungen</span>
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-orange-50 p-4"><p className="font-black">🥪 Bestellen</p><p className="mt-1 text-sm text-slate-600">Produkte nach Kind und Tag auswählen.</p></div>
                <div className="rounded-2xl bg-blue-50 p-4"><p className="font-black">💳 Zahlung</p><p className="mt-1 text-sm text-slate-600">Überweisung oder PayPal simulieren.</p></div>
                <div className="rounded-2xl bg-emerald-50 p-4"><p className="font-black">🏫 Bäckerei</p><p className="mt-1 text-sm text-slate-600">Produktionsmengen und Allergien sehen.</p></div>
              </div>
            </section>

            <Card className="rounded-[2rem] border-0 bg-slate-950 text-white shadow-xl">
              <CardContent className="p-7">
                <p className="text-sm font-bold uppercase tracking-wide text-slate-400">Login</p>
                <h2 className="mt-2 text-2xl font-black">Eltern, Bäckerei & Verwaltung</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">Für registrierte Eltern, Bäckereien und die Verwaltung. Interessenten können den Demo-Modus verwenden.</p>
                <div className="mt-6 space-y-3">
                  <Input value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} placeholder="E-Mail" className="rounded-xl bg-white text-slate-950" />
                  <Input type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} placeholder="Passwort" className="rounded-xl bg-white text-slate-950" />
                  <Button onClick={loginWithPassword} disabled={authLoading || !loginPassword} className="w-full rounded-xl bg-white font-bold !text-slate-950 hover:bg-slate-100 hover:!text-slate-950">{authLoading ? 'Login...' : 'Einloggen'}</Button>
                  <button type="button" onClick={() => { setShowParentRegistration((value) => !value); setShowBakeryRegistration(false); }} className="w-full rounded-xl border border-slate-700 px-4 py-3 text-sm font-bold text-violet-300 transition hover:border-violet-400 hover:bg-slate-900">👨‍👩‍👧 {showParentRegistration ? 'Registrierung schließen' : 'Als Elternteil registrieren'}</button>
                  <button type="button" onClick={() => { setShowBakeryRegistration((value) => !value); setShowParentRegistration(false); }} className="w-full rounded-xl border border-slate-700 px-4 py-3 text-sm font-bold text-emerald-300 transition hover:border-emerald-400 hover:bg-slate-900">🥐 {showBakeryRegistration ? 'Registrierung schließen' : 'Als Bäckerei registrieren'}</button>
                </div>
                {showParentRegistration && <div className="mt-5 rounded-2xl bg-white p-5 text-slate-950"><div className="mb-4"><p className="text-lg font-black">Elternkonto registrieren</p><p className="mt-1 text-xs text-slate-500">Nach der E-Mail-Bestätigung kannst du dich direkt einloggen, dein Kind anlegen und die Schule auswählen.</p></div><div className="space-y-3"><Input value={parentRegistration.name} onChange={(e) => setParentRegistration((p) => ({ ...p, name: e.target.value }))} placeholder="Vor- und Nachname *" /><Input type="email" value={parentRegistration.email} onChange={(e) => setParentRegistration((p) => ({ ...p, email: e.target.value }))} placeholder="E-Mail *" /><Input type="password" value={parentRegistration.password} onChange={(e) => setParentRegistration((p) => ({ ...p, password: e.target.value }))} placeholder="Passwort *" /></div><Button type="button" onClick={registerParent} disabled={parentRegistrationLoading} className="mt-4 w-full rounded-xl bg-violet-600 font-black text-white hover:bg-violet-700">{parentRegistrationLoading ? 'Registrierung läuft...' : 'Elternkonto erstellen'}</Button>{parentRegistrationNotice && <p className="mt-3 rounded-xl bg-slate-100 p-3 text-xs font-semibold text-slate-700">{parentRegistrationNotice}</p>}</div>}
                {showBakeryRegistration && <div className="mt-5 rounded-2xl bg-white p-5 text-slate-950"><div className="mb-4"><p className="text-lg font-black">Bäckerei registrieren</p><p className="mt-1 text-xs text-slate-500">Nach der Registrierung wird dein Betrieb von Pausenapp geprüft. Eine Schule kann direkt vorgeschlagen werden.</p></div><div className="grid gap-3 sm:grid-cols-2"><Input value={bakeryRegistration.name} onChange={(e) => setBakeryRegistration((p) => ({ ...p, name: e.target.value }))} placeholder="Bäckereiname *" /><Input value={bakeryRegistration.legalName} onChange={(e) => setBakeryRegistration((p) => ({ ...p, legalName: e.target.value }))} placeholder="Firmenname" /><Input value={bakeryRegistration.city} onChange={(e) => setBakeryRegistration((p) => ({ ...p, city: e.target.value }))} placeholder="Ort *" /><Input value={bakeryRegistration.address} onChange={(e) => setBakeryRegistration((p) => ({ ...p, address: e.target.value }))} placeholder="Adresse" /><Input value={bakeryRegistration.phone} onChange={(e) => setBakeryRegistration((p) => ({ ...p, phone: e.target.value }))} placeholder="Telefon" /><Input value={bakeryRegistration.vatNumber} onChange={(e) => setBakeryRegistration((p) => ({ ...p, vatNumber: e.target.value }))} placeholder="MwSt.-Nr." /><Input type="email" value={bakeryRegistration.email} onChange={(e) => setBakeryRegistration((p) => ({ ...p, email: e.target.value }))} placeholder="E-Mail *" /><Input type="password" value={bakeryRegistration.password} onChange={(e) => setBakeryRegistration((p) => ({ ...p, password: e.target.value }))} placeholder="Passwort *" /></div><div className="my-5 border-t border-slate-200 pt-5"><p className="font-black">Erste Schule vorschlagen <span className="font-medium text-slate-400">(optional)</span></p><div className="mt-3 grid gap-3 sm:grid-cols-2"><Input value={bakeryRegistration.schoolName} onChange={(e) => setBakeryRegistration((p) => ({ ...p, schoolName: e.target.value }))} placeholder="Name der Schule" /><Input value={bakeryRegistration.schoolCity} onChange={(e) => setBakeryRegistration((p) => ({ ...p, schoolCity: e.target.value }))} placeholder="Ort der Schule" /><Input value={bakeryRegistration.schoolAddress} onChange={(e) => setBakeryRegistration((p) => ({ ...p, schoolAddress: e.target.value }))} placeholder="Adresse der Schule" className="sm:col-span-2" /></div></div><Button type="button" onClick={registerBakery} disabled={bakeryRegistrationLoading} className="w-full rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700">{bakeryRegistrationLoading ? 'Registrierung läuft...' : 'Registrierung absenden'}</Button>{bakeryRegistrationNotice && <p className="mt-3 rounded-xl bg-slate-100 p-3 text-xs font-semibold text-slate-700">{bakeryRegistrationNotice}</p>}</div>}
                {backendNotice && backendNotice !== 'Supabase verbunden' && <p className="mt-4 text-xs text-slate-400">{backendNotice}</p>}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return <div className="min-h-screen bg-[#f7f9fc] text-slate-950"><style>{`
@media screen { .print-only { display: none !important; } }

/* Mobile-first layout refinements: desktop remains unchanged. */
@media screen and (max-width: 639px) {
  html, body, #root { width: 100%; max-width: 100%; overflow-x: hidden; }
  body { -webkit-text-size-adjust: 100%; }
  .bakery-print-root { padding: 12px !important; border-radius: 16px !important; }
  .bakery-print-root, .bakery-print-root * { box-sizing: border-box; }
  .bakery-print-root h1 { font-size: 1.35rem !important; line-height: 1.28 !important; letter-spacing: -.025em; overflow-wrap: anywhere; }
  .bakery-print-root h2 { font-size: 1.17rem !important; line-height: 1.3 !important; overflow-wrap: anywhere; }
  .bakery-print-root h3 { font-size: 1.03rem !important; line-height: 1.35 !important; overflow-wrap: anywhere; }
  .bakery-print-root p { overflow-wrap: anywhere; }
  .bakery-print-root .text-3xl, .bakery-print-root .text-4xl, .bakery-print-root .text-5xl { font-size: 1.4rem !important; line-height: 1.25 !important; }
  .bakery-print-root .text-2xl { font-size: 1.18rem !important; line-height: 1.3 !important; }
  .bakery-print-root .text-xl, .bakery-print-root .text-lg { font-size: 1rem !important; line-height: 1.4 !important; }
  .bakery-print-root .space-y-7 > * + * { margin-top: 14px !important; }
  .bakery-print-root .space-y-6 > * + * { margin-top: 12px !important; }
  .bakery-print-root .gap-6, .bakery-print-root .gap-5 { gap: 12px !important; }
  .bakery-print-root .p-8, .bakery-print-root .p-7, .bakery-print-root .p-6, .bakery-print-root .p-5 { padding: 13px !important; }
  .bakery-print-root .px-6 { padding-left: 12px !important; padding-right: 12px !important; }
  .bakery-print-root .py-6 { padding-top: 11px !important; padding-bottom: 11px !important; }
  .bakery-print-root .mt-6, .bakery-print-root .mt-5 { margin-top: 12px !important; }
  .bakery-print-root .mb-6, .bakery-print-root .mb-5 { margin-bottom: 12px !important; }
  .bakery-print-root .rounded-\[2rem\], .bakery-print-root .rounded-\[1\.75rem\], .bakery-print-root .rounded-\[1\.5rem\] { border-radius: 14px !important; }
  .bakery-print-root .grid { min-width: 0; }
  .bakery-print-root .grid > * { min-width: 0; }
  .bakery-print-root button { max-width: 100%; white-space: normal; overflow-wrap: anywhere; line-height: 1.25; }
  .bakery-print-root input, .bakery-print-root select, .bakery-print-root textarea { max-width: 100%; min-width: 0; font-size: 16px; }
  .bakery-print-root table { min-width: 540px; }
  .bakery-print-root .overflow-x-auto { max-width: 100%; -webkit-overflow-scrolling: touch; }
  .bakery-print-root .shrink-0 { max-width: 55%; white-space: normal; text-align: right; }
  .bakery-print-root .grid.md\:grid-cols-2 { grid-template-columns: minmax(0,1fr) !important; }
  .bakery-print-root .grid.xl\:grid-cols-4 { grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
  .bakery-print-root .grid.xl\:grid-cols-6 { grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
  .bakery-print-root .grid.xl\:grid-cols-6 > button { padding: 12px !important; }
  .bakery-print-root .grid.xl\:grid-cols-6 > button > span:first-child { width: 36px !important; height: 36px !important; font-size: 20px !important; }
  .bakery-print-root .grid.xl\:grid-cols-6 > button p { margin-top: 6px !important; min-height: 0 !important; }
  .bakery-print-root .grid.xl\:grid-cols-6 > button p:nth-of-type(2) { display: none; }
  .bakery-print-root .grid.xl\:grid-cols-6 > button > div:last-child { display: none; }
}

@media print {
  @page { size: A4 portrait; margin: 12mm; }
  html, body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0 !important; }
  .no-print { display: none !important; }
  .print-only { display: block !important; }
  .bakery-print-root { display: block !important; padding: 0 !important; margin: 0 !important; box-shadow: none !important; border: 0 !important; background: #fff !important; }
  .bakery-print-header { margin: 0 0 5mm !important; padding: 5mm !important; border-radius: 4mm !important; box-shadow: none !important; break-inside: avoid; page-break-inside: avoid; }
  .bakery-print-header button { display: none !important; }
  .bakery-stats { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 3mm !important; margin-bottom: 4mm !important; }
  .bakery-stats > :nth-child(4), .bakery-stats > :nth-child(5) { display: none !important; }
  .bakery-stats > * { box-shadow: none !important; break-inside: avoid; page-break-inside: avoid; }
  .bakery-allergy-card { box-shadow: none !important; break-inside: avoid; page-break-inside: avoid; margin-bottom: 4mm !important; }
  .bakery-main-grid { display: block !important; }
  .bakery-production-card { box-shadow: none !important; break-inside: auto !important; page-break-inside: auto !important; margin-bottom: 0 !important; }
  .bakery-production-card > div { padding: 4mm !important; }
  .bakery-production-card > div > div.space-y-3 { gap: 2mm !important; }
  .bakery-production-card > div > div.space-y-3 > div { padding: 3mm !important; }
  .bakery-allergy-card > div { padding: 4mm !important; }
  .bakery-stats > * > div { padding: 4mm !important; }
  .bakery-commission-card { box-shadow: none !important; break-before: page; page-break-before: always; margin-top: 0 !important; }
  .bakery-commission-card button { display: none !important; }
  .bakery-commission-card > div > div.space-y-3 > div { break-inside: avoid; page-break-inside: avoid; }
  .bakery-production-card > div > div.space-y-3 > div { break-inside: avoid; page-break-inside: avoid; }
  .bakery-print-root h2, .bakery-print-root h3, .bakery-print-root p { orphans: 3; widows: 3; }
  .bakery-print-root main { padding: 0 !important; margin: 0 !important; box-shadow: none !important; border: 0 !important; }
}
`}</style><div className="grid min-h-screen min-w-0 gap-4 overflow-x-hidden bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-3 pb-24 sm:p-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-6 lg:p-6"><aside className="no-print hidden rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:flex lg:flex-col"><div className="flex items-center gap-3 px-2 py-3"><span className="text-4xl">🥪</span><div><p className="text-2xl font-black tracking-tight">Pausenapp</p><p className="text-sm font-medium text-slate-500">Einfach. Bestellt.</p></div></div><nav className="mt-8 space-y-2">{navigationItems.map(([id, iconName, label]) => <button key={id} onClick={() => setActiveTab(id)} className={`flex w-full items-center gap-4 rounded-2xl px-5 py-4 text-left text-base font-bold transition ${activeTab === id ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-100' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}><Icon name={id === 'start' ? 'home' : iconName} className="h-5 w-5" />{label === 'Ausgabe' ? 'Ausgabe / Bäckerei' : label}</button>)}</nav><div className="mt-auto rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200"><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500 font-black text-white">SE</span><div><p className="font-extrabold">{currentUser.name}</p><p className="text-sm font-semibold text-indigo-600">{currentUser.role === 'admin' ? 'Administrator' : currentUser.role === 'bakery' ? 'Bäckerei' : 'Elternkonto'}</p></div></div><div className="mt-4 border-t pt-4">{hasRealSupabaseUser ? <button onClick={logout} className="text-sm font-bold text-slate-500 hover:text-slate-950">↪ Abmelden</button> : isGuestMode ? <button onClick={exitGuestMode} className="text-sm font-bold text-violet-600 hover:text-violet-800">Demo beenden</button> : null}</div></div></aside><div className="min-w-0"><div className="no-print mb-4 rounded-[1.5rem] bg-white p-3 shadow-sm ring-1 ring-emerald-100 lg:hidden"><div className="mb-3 flex items-center justify-between px-2"><div className="flex items-center gap-2"><span className="text-2xl">🥪</span><span className="font-black">Pausenapp</span></div><div className="flex items-center gap-2"><span className="hidden text-xs font-semibold text-slate-500 sm:inline">{currentUser.role === 'admin' ? 'Admin' : currentUser.role === 'bakery' ? 'Bäckerei' : 'Eltern'}</span>{hasRealSupabaseUser ? <button type="button" onClick={logout} className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-extrabold text-rose-700 ring-1 ring-rose-100" aria-label="Abmelden">↪ Abmelden</button> : isGuestMode ? <button type="button" onClick={exitGuestMode} className="rounded-xl bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700">Demo beenden</button> : null}</div></div><nav className="hidden">{navigationItems.map(([id, iconName, label]) => <button key={id} onClick={() => setActiveTab(id)} className={`rounded-2xl px-3 py-3 text-xs font-bold transition ${activeTab === id ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-600'}`}><Icon name={id === 'start' ? 'home' : iconName} className="mx-auto mb-1 h-4 w-4" />{label}</button>)}</nav></div><nav aria-label="Mobile Schnellnavigation" className="no-print fixed inset-x-0 bottom-0 z-50 flex items-center gap-1 overflow-x-auto border-t border-emerald-100 bg-white/95 px-2 pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-lg lg:hidden" style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>{navigationItems.map(([id, iconName, label]) => <button type="button" key={id} onClick={() => { setActiveTab(id); window.scrollTo({ top: 0, behavior: "smooth" }); }} className={`flex min-w-[64px] flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-bold transition ${activeTab === id ? "bg-emerald-50 text-emerald-700" : "text-slate-500"}`} aria-current={activeTab === id ? "page" : undefined}><Icon name={id === "start" ? "home" : iconName} className="h-5 w-5" /><span className="max-w-full truncate">{label}</span></button>)}</nav><main className="bakery-print-root min-w-0 rounded-[1.5rem] bg-white/95 p-3 shadow-sm ring-1 ring-emerald-100 sm:p-5 lg:rounded-[2rem] lg:p-8"><div className="no-print mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400">{!isGuestMode && <span>{dataLoading ? 'Daten werden geladen...' : backendNotice}</span>}{isGuestMode && <span className="rounded-full bg-violet-100 px-3 py-1 text-violet-800">🧪 TESTMODUS</span>}</div>{isGuestMode && <div className="no-print mb-6 flex flex-col gap-4 rounded-2xl border border-violet-200 bg-violet-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-violet-900">🧪 TESTMODUS – Demo-Gast</p><p className="text-sm text-violet-700">Diese Sitzung ist nur zum Testen. Es werden keine echten Bestellungen, Zahlungen oder E-Mails ausgelöst und nichts in Supabase gespeichert.</p></div><Button variant="outline" onClick={exitGuestMode} className="rounded-xl bg-white">Demo beenden</Button></div>}<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>{currentUser.role !== 'bakery' && activeTab === 'start' && <ParentHome children={children} orders={orders} completedOrders={completedOrders} onNavigate={setActiveTab} onSelectChild={setActiveChildId} onSelectDay={setActiveDay} currentUser={currentUser} isGuestMode={isGuestMode} schoolOptions={schoolOptions} bakeryPaymentSettings={bakeryPaymentSettings} />}{currentUser.role !== 'bakery' && activeTab === 'bestellen' && <div className="grid gap-6 lg:grid-cols-[280px_1fr]"><Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-5"><h2 className="mb-4 text-xl font-bold">Kind auswählen</h2><div className="space-y-2">{children.map((child) => { const childItemCount = weekdays.reduce((sum, day) => sum + (orders[child.id]?.[day] || []).length, 0); const childCartTotal = weekdays.reduce((sum, day) => sum + calculateChildDayTotal(child.id, day, orders, menuProducts), 0); return <button key={child.id} onClick={() => setActiveChildId(child.id)} className={`w-full rounded-xl border p-4 text-left transition ${activeChildId === child.id ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white hover:bg-slate-50'}`}><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{child.name}</p><p className={`text-sm ${activeChildId === child.id ? 'text-slate-200' : 'text-slate-500'}`}>{child.className} · {child.school}</p></div>{childItemCount > 0 && <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${activeChildId === child.id ? 'bg-white text-slate-950' : 'bg-emerald-100 text-emerald-800'}`}>{childItemCount} Artikel · {money(childCartTotal)}</span>}</div></button>; })}</div></CardContent></Card><Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-5 md:p-7"><div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><p className="text-sm font-semibold text-emerald-700">Bestellung für {activeChild.name}</p><h2 className="text-2xl font-bold">Pause für {activeDay}</h2><div className={`mt-2 rounded-xl p-3 text-sm font-semibold ${activeOrderEditable ? 'bg-yellow-50 text-yellow-800' : 'bg-red-50 text-red-800 ring-1 ring-red-200'}`}>{activeOrderEditable ? getReminderMessage(activeDay, new Date(), activeDeadlineDaysBefore, activeDeadlineTime) : `🔒 Bestellfrist abgelaufen – Bestellung für ${activeDay} ist fixiert und kann nicht mehr geändert werden.`}</div><p className="mt-2 text-sm text-slate-500">Allergien: {activeChild.allergies}</p>{activeSchoolOption ? <p className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-800">🥐 Versorgt durch: {activeSchoolOption.bakeryName}</p> : currentUser.role === 'parent' && !isGuestMode ? <p className="mt-2 inline-flex rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700 ring-1 ring-red-200">Keine aktive Bäckerei für diese Schule zugeordnet.</p> : null}</div><div className="flex flex-wrap gap-2"><Button onClick={() => setActiveTab('zahlung')} disabled={!activeDeadlineOpen || !checkoutLines.length} className="rounded-xl">{activeDeadlineOpen ? `Warenkorb · ${money(checkoutTotal)}` : 'Frist abgelaufen'} <Icon name="chevron" className="ml-1 h-4 w-4" /></Button>{children.length > 1 && <Button type="button" variant="outline" onClick={() => { const currentIndex = Math.max(0, children.findIndex((child) => child.id === activeChild.id)); const nextChild = children[(currentIndex + 1) % children.length]; if (nextChild) setActiveChildId(nextChild.id); }} className="rounded-xl">Nächstes Kind auswählen</Button>}</div></div><div className="mb-4 rounded-2xl bg-blue-50 p-4 text-sm text-blue-900 ring-1 ring-blue-100"><p className="font-black">Gemeinsamer Warenkorb</p><p className="mt-1">Die Auswahl bleibt gespeichert, wenn du links zu einem anderen Kind wechselst. Erst auf der Zahlungsseite wird alles gemeinsam bestellt.</p>{checkoutLines.length > 0 && <p className="mt-2 font-bold">Aktuell im Warenkorb: {checkoutChildrenCount} Kind(er) · {checkoutLines.reduce((sum, line) => sum + line.itemIds.length, 0)} Artikel · {money(checkoutTotal)}</p>}</div><div className="mb-6 flex flex-wrap gap-2">{weekdays.map((day) => <button key={day} onClick={() => setActiveDay(day)} className={`rounded-full px-4 py-2 text-sm font-semibold ${activeDay === day ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{day.slice(0, 2)}</button>)}</div><div className="grid gap-4 md:grid-cols-2">{visibleMenuProducts.map((product) => { const quantity = getProductQuantity(dayItems, product.id); const selected = quantity > 0; return <div key={product.id} role="button" tabIndex={activeOrderEditable ? 0 : -1} onClick={() => activeOrderEditable && changeProductQuantity(product.id, 1)} onKeyDown={(event) => { if (activeOrderEditable && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); changeProductQuantity(product.id, 1); } }} className={`rounded-2xl border p-4 transition sm:p-5 ${selected ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white'} ${activeOrderEditable ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-sm' : 'cursor-not-allowed opacity-60'}`}><div className="flex items-start justify-between gap-3 sm:gap-4"><div><h3 className="font-bold">{product.name}</h3><p className="mt-1 text-sm text-slate-500">{product.desc}</p></div><div className="text-right"><p className="font-bold">{money(product.price)}</p>{selected && <span className="mt-2 inline-flex rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">{quantity}× gewählt</span>}</div></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{product.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{tag}</span>)}</div><div className="flex items-center gap-2"><span className="hidden text-xs font-semibold text-slate-400 sm:inline">Karte anklicken = +1</span><div className="flex items-center gap-2 rounded-xl bg-white p-1 ring-1 ring-slate-200"><button type="button" onClick={(event) => { event.stopPropagation(); changeProductQuantity(product.id, -1); }} disabled={!activeOrderEditable || quantity === 0} className="flex h-9 w-9 items-center justify-center rounded-lg text-lg font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30" aria-label={`${product.name} Menge reduzieren`}>−</button><span className="min-w-8 text-center text-lg font-black">{quantity}</span><button type="button" onClick={(event) => { event.stopPropagation(); changeProductQuantity(product.id, 1); }} disabled={!activeOrderEditable} className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-lg font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40" aria-label={`${product.name} Menge erhöhen`}>+</button></div></div></div>{quantity > 0 && <p className="mt-3 text-right text-sm font-bold text-emerald-800">Zwischensumme: {money(product.price * quantity)}</p>}</div>; })}</div></CardContent></Card></div>}{currentUser.role !== 'bakery' && activeTab === 'zahlung' && <div className="grid gap-6 lg:grid-cols-[1fr_360px]"><Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-6"><h2 className="text-2xl font-bold">Bestellung bezahlen</h2><p className="mt-2 text-slate-600">Wähle die Zahlungsart. Bestellungen derselben Bäckerei werden gemeinsam bezahlt. Bei mehreren Bäckereien wird die Zahlung automatisch getrennt. Bei PayPal und Überweisung bleibt die jeweilige Zahlung offen, bis der Admin bestätigt.</p><div className="mt-6 grid gap-4 md:grid-cols-2">{availableCheckoutPaymentMethods.map((method) => { const isLive = livePaymentMethods.includes(method); return <button key={method} onClick={() => setSelectedPayment(method)} className={`rounded-2xl border p-5 text-left ${selectedPayment === method ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white'}`}><div className="flex items-start justify-between gap-3"><p className="text-lg font-bold">{method}</p>{!isLive && <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">Demo</span>}</div><p className="mt-1 text-sm text-slate-500">{method === 'PayPal' ? 'PayPal-Zahlung direkt an die zuständige Bäckerei.' : 'Überweisung direkt an die zuständige Bäckerei; Zahlung wird danach bestätigt.'}</p></button>; })}{!isGuestMode && availableCheckoutPaymentMethods.length === 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 md:col-span-2"><p className="font-black">Keine Zahlungsart verfügbar</p><p className="mt-1">Die zuständige Bäckerei hat noch keine vollständige Zahlungsart freigeschaltet. Bitte die Bäckerei kontaktieren.</p></div>}{selectedPayment === 'PayPal' && <div className="mt-2 rounded-2xl border border-blue-200 bg-blue-50 p-5 ring-1 ring-blue-100 md:col-span-2"><p className="text-sm font-semibold text-blue-900">PayPal je Bäckerei</p><p className="mt-1 text-sm text-blue-800">Bei mehreren Bäckereien wird jede Bäckerei separat bezahlt.</p><div className="mt-4 space-y-3">{checkoutGroups.map((group) => { const settings = bakeryPaymentSettings[group.bakeryId]; return <div key={group.bakeryId || group.bakeryName} className="rounded-xl bg-white p-4 ring-1 ring-blue-100"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black text-slate-950">{group.bakeryName}</p><p className="text-sm text-slate-500">Betrag: {money(group.total)}</p><p className="mt-1 break-all text-xs text-blue-700">{settings?.paypalLink || 'PayPal-Link noch nicht hinterlegt'}</p></div><Button type="button" onClick={() => openPayPalPayment(settings?.paypalLink || '')} disabled={!settings?.paypalLink} className="rounded-xl bg-blue-700 text-white hover:bg-blue-800">PayPal öffnen</Button></div></div>; })}</div>{paypalStatus && <p className="mt-3 rounded-xl bg-white p-3 text-sm font-semibold text-blue-900">{paypalStatus}</p>}</div>}{selectedPayment === 'Überweisung' && <div className="mt-2 rounded-2xl border bg-white p-5 ring-1 ring-slate-200 md:col-span-2"><p className="text-sm font-semibold text-slate-600">Überweisung je Bäckerei</p><p className="mt-1 text-sm text-slate-500">Bei mehreren Bäckereien werden getrennte Überweisungen mit getrennten Referenzen erstellt.</p><div className="mt-4 space-y-3">{checkoutGroups.map((group) => { const settings = bakeryPaymentSettings[group.bakeryId]; return <div key={group.bakeryId || group.bakeryName} className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200"><div className="flex items-center justify-between gap-3"><p className="font-black">{group.bakeryName}</p><p className="font-black">{money(group.total)}</p></div><div className="mt-3 grid gap-2 text-sm"><div className="flex justify-between gap-3"><span className="text-slate-500">Empfänger</span><span className="font-semibold">{settings?.accountHolder || 'noch nicht hinterlegt'}</span></div><div className="flex justify-between gap-3"><span className="text-slate-500">IBAN</span><span className="flex items-center gap-2 font-mono font-semibold">{settings?.iban || '–'}{settings?.iban && <button onClick={() => copyToClipboard(settings.iban, 'IBAN')} className="rounded-full bg-white px-2 py-1 text-xs font-sans text-slate-700 ring-1 ring-slate-200">Kopieren</button>}</span></div><div className="flex justify-between gap-3"><span className="text-slate-500">BIC</span><span className="font-mono">{settings?.bic || 'nicht erforderlich'}</span></div><div className="mt-2 flex flex-col gap-2 border-t border-slate-200 pt-3 sm:flex-row sm:items-center sm:justify-between"><span className="text-slate-500">Verwendungszweck</span><span className="flex items-center gap-2"><span className="font-mono font-black">{checkoutPaymentReferences[group.bakeryId || group.bakeryName]}</span><button type="button" onClick={() => copyToClipboard(checkoutPaymentReferences[group.bakeryId || group.bakeryName], 'Verwendungszweck')} className="rounded-full bg-white px-2 py-1 text-xs font-sans text-slate-700 ring-1 ring-slate-200">Kopieren</button></span></div></div></div>; })}</div></div>}</div><div className="mt-6 flex flex-wrap gap-3"><Button type="button" variant="outline" onClick={() => setActiveTab('bestellen')} className="rounded-xl">← Weitere Kinder / Produkte hinzufügen</Button><Button onClick={confirmOrder} disabled={isSaving || !checkoutLines.length} className="rounded-xl">{isSaving ? 'Speichere...' : checkoutChildrenCount > 1 ? 'Alle zusammen bestellen und bestätigen' : 'Bestellung endgültig bestätigen'}</Button></div>{lastConfirmation && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-800">{lastConfirmation}</p>}{lastOrder && <div className="mt-6 rounded-2xl bg-emerald-50 p-6 text-emerald-900 shadow-sm"><div className="flex items-center gap-3 text-lg font-bold"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white">✓</span>Bestellung erfolgreich</div><p className="mt-3 text-sm">{lastOrder.child} · {lastOrder.day}</p><p className="text-sm">Gesamt: {money(lastOrder.total)}</p><p className="mt-4 text-sm font-semibold">Zahlungen</p><p className="text-xs font-bold text-red-600">WICHTIG: Jede Bäckerei separat mit der jeweiligen Referenz bezahlen.</p><div className="mt-3 space-y-3">{lastPaymentGroups.map((group) => <div key={group.bakeryId || group.bakeryName} className="rounded-xl bg-white p-4 text-slate-900"><div className="flex items-center justify-between gap-3"><p className="font-black">{group.bakeryName}</p><p className="font-black">{money(group.total)}</p></div>{lastOrder.payment === 'Überweisung' && <div className="mt-3 space-y-1 text-sm"><p><span className="text-slate-500">Empfänger:</span> {group.accountHolder}</p><p><span className="text-slate-500">IBAN:</span> <span className="font-mono">{group.iban}</span></p>{group.bic && <p><span className="text-slate-500">BIC:</span> <span className="font-mono">{group.bic}</span></p>}</div>}<p className="mt-3 text-xs font-semibold text-slate-500">Verwendungszweck</p><div className="mt-1 flex flex-col gap-2 rounded-lg bg-slate-50 p-2 sm:flex-row sm:items-center sm:justify-between"><p className="font-mono text-sm font-black">{group.paymentReference}</p><Button onClick={() => copyToClipboard(group.paymentReference, 'Verwendungszweck')} variant="outline" className="rounded-xl">Kopieren</Button></div>{lastOrder.payment === 'PayPal' && <Button type="button" onClick={() => openPayPalPayment(group.paypalLink)} disabled={!group.paypalLink} className="mt-3 rounded-xl bg-blue-700 text-white hover:bg-blue-800">PayPal für {group.bakeryName} öffnen</Button>}</div>)}</div></div>}</CardContent></Card><Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-6"><h3 className="text-xl font-bold">Gemeinsamer Warenkorb</h3><p className="mt-2 text-sm text-slate-500">{checkoutChildrenCount ? `${checkoutChildrenCount} Kind(er) · ${checkoutLines.length} Teilbestellung(en)` : 'Noch keine Produkte gewählt'}</p><div className="mt-4 space-y-3">{checkoutLines.map((line) => <div key={`${line.child.id}-${line.day}`} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200"><div className="flex items-start justify-between gap-3"><div><p className="font-black">{line.child.name} · {line.day}</p><p className="mt-1 text-xs text-slate-500">{line.child.school}</p><p className="mt-2 text-sm font-semibold text-slate-700">{formatSelectedProducts(line.itemIds, menuProducts)}</p></div><p className="whitespace-nowrap font-black">{money(line.total)}</p></div></div>)}</div><div className="mt-6 rounded-2xl bg-slate-950 p-5 text-white"><p className="text-sm text-slate-300">Gesamt</p><p className="text-3xl font-bold">{money(checkoutTotal)}</p></div></CardContent></Card></div> }{currentUser.role !== 'bakery' && activeTab === 'bestellungen' && <div className="space-y-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-black uppercase tracking-wide text-indigo-600">Elternbereich</p><h2 className="text-3xl font-black">Meine Bestellungen</h2><p className="mt-2 text-sm text-slate-500">Offene Bestellungen können bis zum Ende der Bestellfrist geändert oder storniert werden. Bezahlte oder bereits fixierte Bestellungen sind nur noch einsehbar.</p></div><Button type="button" onClick={() => setActiveTab('bestellen')} className="rounded-xl">+ Neue Bestellung</Button></div>{parentOrderNotice && <div className="rounded-2xl bg-blue-50 p-4 text-sm font-semibold text-blue-900 ring-1 ring-blue-100">{parentOrderNotice}</div>}<div className="grid gap-4 md:grid-cols-3"><StatCard label="Offen" value={completedOrders.filter((order) => order.status === 'offen').length} hint={money(completedOrders.filter((order) => order.status === 'offen').reduce((sum, order) => sum + order.total, 0))} icon="clock" tone="orange" /><StatCard label="Bezahlt" value={completedOrders.filter((order) => order.status === 'bezahlt').length} hint="Zahlung bestätigt" icon="check" tone="emerald" /><StatCard label="Gesamt" value={completedOrders.length} hint="gespeicherte Teilbestellungen" icon="orders" tone="violet" /></div><div className="space-y-4">{completedOrders.length ? completedOrders.map((order) => { const editable = canParentEditOrder(order); const isEditing = editingOrderId === order.id; const child = children.find((entry) => entry.id === order.childId) || children.find((entry) => entry.name === order.child); const bakeryId = child?.schoolId ? schoolOptions.find((school) => school.id === child.schoolId)?.bakeryId : null; const productsForOrder = bakeryId ? menuProducts.filter((product) => product.bakeryId === bakeryId) : menuProducts; const currentItems = isEditing ? editingOrderItems : (order.itemIds || []); const currentTotal = currentItems.reduce((sum, id) => sum + (menuProducts.find((product) => product.id === id)?.price || 0), 0); return <Card key={order.id} className="rounded-[1.5rem] border-0 shadow-sm ring-1 ring-slate-200"><CardContent className="p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-black">{order.child} · {order.day}</h3><span className={`rounded-full px-3 py-1 text-xs font-black ${order.status === 'bezahlt' ? 'bg-emerald-100 text-emerald-800' : order.status === 'storniert' ? 'bg-red-100 text-red-800' : editable ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>{order.status === 'bezahlt' ? 'Bezahlt' : order.status === 'storniert' ? 'Storniert' : editable ? 'Offen · bearbeitbar' : 'Fixiert'}</span></div><p className="mt-1 text-sm text-slate-500">{order.school}{order.deliveryDate ? ` · ${new Date(`${order.deliveryDate}T12:00:00`).toLocaleDateString('de-DE')}` : ''}</p><p className="mt-2 text-sm text-slate-600">Zahlung: <span className="font-semibold">{order.payment}</span></p>{order.paymentReference && <p className="mt-2 font-mono text-xs text-slate-500">{order.paymentReference}</p>}{order.checkoutId && <p className="mt-1 text-xs text-slate-400">Teil einer Sammelbestellung</p>}</div><div className="text-left lg:text-right"><p className="text-sm text-slate-500">Betrag</p><p className="text-2xl font-black">{money(isEditing ? currentTotal : order.total)}</p>{editable && !isEditing && <p className="mt-1 text-xs font-semibold text-amber-700">Bearbeitbar bis {formatOrderDeadline(order.day)}</p>}</div></div>{!isEditing ? <><div className="mt-5 flex flex-wrap gap-2">{(order.itemIds || []).length ? summarizeItemNames((order.itemIds || []).map((id) => menuProducts.find((product) => product.id === id)?.name || 'Produkt')).map((item) => <span key={item.name} className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 ring-1 ring-slate-200">{item.quantity > 1 ? `${item.quantity}× ` : ''}{item.name}</span>) : <span className="text-sm text-slate-400">Produktdetails nicht verfügbar.</span>}</div><div className="mt-5 flex flex-wrap gap-2">{editable && <Button type="button" variant="outline" onClick={() => startEditExistingOrder(order)} className="rounded-xl">Bearbeiten</Button>}{editable && <Button type="button" variant="outline" onClick={() => cancelExistingOrder(order)} disabled={isSaving} className="rounded-xl border-red-200 text-red-700 hover:bg-red-50">Stornieren</Button>}{!editable && order.status === 'offen' && <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600">🔒 Bestellfrist abgelaufen</span>}</div></> : <div className="mt-5 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"><div className="mb-4 flex items-center justify-between gap-3"><div><p className="font-black">Bestellung bearbeiten</p><p className="text-xs text-slate-500">Der Verwendungszweck bleibt unverändert.</p></div><Button type="button" variant="outline" onClick={() => { setEditingOrderId(''); setEditingOrderItems([]); }} className="rounded-xl">Abbrechen</Button></div><div className="grid gap-3 md:grid-cols-2">{productsForOrder.map((product) => { const qty = getProductQuantity(editingOrderItems, product.id); return <div key={product.id} className={`rounded-2xl border p-4 ${qty ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'}`}><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{product.name}</p><p className="mt-1 text-sm text-slate-500">{money(product.price)}</p></div>{qty > 0 && <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-black text-white">{qty}×</span>}</div><div className="mt-3 flex items-center gap-2"><button type="button" onClick={() => changeExistingOrderQuantity(product.id, -1)} disabled={qty === 0 || isSaving} className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-lg font-black ring-1 ring-slate-200 disabled:opacity-30">−</button><span className="min-w-8 text-center font-black">{qty}</span><button type="button" onClick={() => changeExistingOrderQuantity(product.id, 1)} disabled={isSaving} className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-lg font-black text-white disabled:opacity-40">+</button></div></div>; })}</div><div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-lg font-black">Neu: {money(currentTotal)}</p><Button type="button" onClick={() => saveExistingOrderChanges(order)} disabled={isSaving || !editingOrderItems.length} className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">{isSaving ? 'Speichere...' : 'Änderungen speichern'}</Button></div><p className="mt-3 text-xs text-amber-700">Falls du die Überweisung bereits ausgeführt hast und sich der Betrag ändert, bitte den Zahlungsstatus mit dem Betreiber klären.</p></div>}</CardContent></Card>; }) : <div className="rounded-2xl bg-slate-50 p-8 text-center text-slate-500 ring-1 ring-slate-200">Noch keine Bestellungen vorhanden.</div>}</div></div>}{currentUser.role !== 'bakery' && activeTab === 'kinder' && <Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-6"><div className="mb-4"><h2 className="text-2xl font-bold">Kinder verwalten</h2><p className="mt-1 text-sm text-slate-500">Schule, Klasse und Allergien können jederzeit geändert werden. Beim Schulwechsel wird automatisch das Sortiment der zuständigen Bäckerei verwendet.</p></div><div className="mb-6 grid gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 md:grid-cols-2"><Input value={newChildName} onChange={(event) => setNewChildName(event.target.value)} placeholder="Name des Kindes" className="rounded-xl bg-white" /><select value={newChildSchoolId} onChange={(event) => setNewChildSchoolId(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Schule auswählen</option>{schoolOptions.map((school) => <option key={school.id} value={school.id}>{school.name} · {school.bakeryName}</option>)}</select><Input value={newChildClassName} onChange={(event) => setNewChildClassName(event.target.value)} placeholder="Klasse, z. B. 3A" className="rounded-xl bg-white" /><Input value={newChildAllergies} onChange={(event) => setNewChildAllergies(event.target.value)} placeholder="Allergien / keine" className="rounded-xl bg-white" /><div className="md:col-span-2"><Button onClick={addChild} className="rounded-xl"><Icon name="plus" className="mr-1 h-4 w-4" /> Kind hinzufügen</Button></div></div><div className="grid gap-4 md:grid-cols-2">{children.map((child) => { const isEditingChild = editingChildId === child.id; const childBakery = schoolOptions.find((school) => school.id === child.schoolId)?.bakeryName; return <div key={child.id} className="rounded-2xl border bg-white p-5 shadow-sm">{isEditingChild ? <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Input value={editingChild.name} onChange={(event) => setEditingChild((prev) => ({ ...prev, name: event.target.value }))} placeholder="Name des Kindes" /><select value={editingChild.schoolId} onChange={(event) => setEditingChild((prev) => ({ ...prev, schoolId: event.target.value }))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Schule auswählen</option>{schoolOptions.map((school) => <option key={school.id} value={school.id}>{school.name} · {school.bakeryName}</option>)}</select><Input value={editingChild.className} onChange={(event) => setEditingChild((prev) => ({ ...prev, className: event.target.value }))} placeholder="Klasse" /><Input value={editingChild.allergies} onChange={(event) => setEditingChild((prev) => ({ ...prev, allergies: event.target.value }))} placeholder="Allergien / keine" /></div><div className="flex flex-wrap gap-2"><Button type="button" onClick={() => saveChildChanges(child.id)} disabled={isSaving} className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">{isSaving ? 'Speichere...' : 'Speichern'}</Button><Button type="button" variant="outline" onClick={cancelEditChild} disabled={isSaving} className="rounded-xl">Abbrechen</Button></div></div> : <><div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-black">{child.name}</h3><p className="mt-1 font-semibold text-slate-600">{child.school}</p>{childBakery && <p className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">🥐 {childBakery}</p>}<p className="mt-3 text-sm text-slate-600"><span className="font-semibold">Klasse:</span> {child.className || '–'}</p><p className="mt-1 text-sm text-slate-600"><span className="font-semibold">Allergien:</span> {child.allergies || 'keine'}</p></div></div><div className="mt-5 flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => startEditChild(child)} className="rounded-xl">Bearbeiten</Button><Button type="button" variant="outline" onClick={() => deleteChild(child)} disabled={isSaving} className="rounded-xl border-red-200 text-red-700 hover:bg-red-50">Löschen</Button></div></>}</div>; })}</div></CardContent></Card>}{currentUser.role !== 'bakery' && activeTab === 'statistiken' && <div className="space-y-6"><div className="grid gap-4 md:grid-cols-4"><StatCard label="Bestellungen" value={parentOrderStats.count} hint="bisher erfasst" icon="basket" /><StatCard label="Bezahlt" value={money(parentOrderStats.paidTotal)} hint="bereits bestätigt" icon="payment" /><StatCard label="Offen" value={money(parentOrderStats.openTotal)} hint="noch zu bezahlen" icon="mail" /><StatCard label="Kinder" value={children.length} hint="im Account" icon="user" /></div><Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-6"><h2 className="mb-4 text-2xl font-bold">Meine Bestellungen</h2><div className="space-y-3">{completedOrders.map((order) => <div key={order.id} className="rounded-2xl border bg-white p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-bold">{order.child} · {order.day}</p><p className="text-sm text-slate-500">{order.payment} · {money(order.total)}</p>{order.paymentReference && <p className="mt-2 font-mono text-xs text-slate-600">{order.paymentReference}</p>}</div><span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${order.status === 'bezahlt' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{order.status}</span></div></div>)}</div></CardContent></Card></div>}{currentUser.role === 'bakery' && activeTab === 'bestellungen-bakery' && <div className="space-y-6"><Card className="rounded-[2rem] border-0 shadow-sm ring-1 ring-slate-200"><CardContent className="p-6 md:p-7"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-black uppercase tracking-wide text-indigo-600">Bestelleingang</p><h2 className="mt-1 text-3xl font-black">Bestellungen</h2><p className="mt-2 text-sm text-slate-500">Alle Bestellungen deiner Bäckerei in der aktuell geladenen Woche.</p></div><div className="w-full lg:w-96"><label className="text-sm font-bold text-slate-600">Suche</label><Input value={bakeryOrderSearch} onChange={(event) => setBakeryOrderSearch(event.target.value)} placeholder="Kind, Schule, Produkt, Referenz …" className="mt-2 rounded-xl" /></div></div><div className="mt-5 flex flex-wrap gap-2"><Button variant={bakeryOrderStatusFilter === 'alle' ? 'default' : 'outline'} onClick={() => setBakeryOrderStatusFilter('alle')} className="rounded-xl">Alle</Button><Button variant={bakeryOrderStatusFilter === 'offen' ? 'default' : 'outline'} onClick={() => setBakeryOrderStatusFilter('offen')} className="rounded-xl">Offen</Button><Button variant={bakeryOrderStatusFilter === 'bezahlt' ? 'default' : 'outline'} onClick={() => setBakeryOrderStatusFilter('bezahlt')} className="rounded-xl">Bezahlt</Button><Button variant={bakeryOrderStatusFilter === 'ausgegeben' ? 'default' : 'outline'} onClick={() => setBakeryOrderStatusFilter('ausgegeben')} className="rounded-xl">Ausgegeben</Button></div></CardContent></Card>{(() => { const term = bakeryOrderSearch.trim().toLowerCase(); const rows = bakeryOrderRows.filter((row: any) => { const statusOk = bakeryOrderStatusFilter === 'alle' || (bakeryOrderStatusFilter === 'ausgegeben' ? row.issued : String(row.status).toLowerCase() === bakeryOrderStatusFilter); const haystack = [row.childName, row.className, row.school, row.weekday, row.deliveryDate, row.paymentMethod, row.paymentReference, row.status, ...(row.items || [])].join(' ').toLowerCase(); return statusOk && (!term || haystack.includes(term)); }); return <><div className="grid gap-4 md:grid-cols-3"><StatCard label="Bestellungen" value={rows.length} hint="im aktuellen Filter" icon="orders" tone="violet" /><StatCard label="Bestellwert" value={money(rows.reduce((sum: number, row: any) => sum + Number(row.total || 0), 0))} hint="Summe der angezeigten Bestellungen" icon="euro" tone="blue" /><StatCard label="Ausgegeben" value={rows.filter((row: any) => row.issued).length} hint="bereits ausgegeben" icon="check" tone="emerald" /></div><div className="space-y-3">{rows.length ? rows.map((row: any) => <Card key={row.id} className="rounded-2xl border-0 shadow-sm ring-1 ring-slate-200"><CardContent className="p-5"><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-lg font-black">{row.childName}</p><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-700">{row.className}</span>{row.allergies && row.allergies.toLowerCase() !== 'keine' && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800">⚠ {row.allergies}</span>}</div><p className="mt-1 text-sm text-slate-500">{row.school} · {row.weekday} {row.deliveryDate ? new Date(`${row.deliveryDate}T12:00:00`).toLocaleDateString('de-DE') : ''}</p><div className="mt-3 flex flex-wrap gap-2">{summarizeItemNames(row.items || []).map((item) => <span key={item.name} className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">{item.quantity > 1 ? `${item.quantity}× ` : ''}{item.name}</span>)}</div><p className="mt-3 text-xs text-slate-400">Referenz: {row.paymentReference || '–'}</p></div><div className="flex flex-wrap items-center gap-2 xl:justify-end"><span className={`rounded-full px-3 py-1 text-xs font-black ${row.status === 'bezahlt' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{row.status}</span><span className={`rounded-full px-3 py-1 text-xs font-black ${row.issued ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{row.issued ? '✓ Ausgegeben' : 'Noch nicht ausgegeben'}</span><span className="text-lg font-black">{money(row.total)}</span></div></div></CardContent></Card>) : <div className="rounded-2xl bg-slate-50 p-8 text-center text-slate-500 ring-1 ring-slate-200">Keine Bestellungen für diesen Filter gefunden.</div>}</div></>; })()}</div>}{currentUser.role === 'bakery' && activeTab === 'einstellungen-bakery' && <div className="space-y-6"><Card className="rounded-[2rem] border-0 bg-gradient-to-r from-slate-950 to-slate-800 text-white shadow-sm"><CardContent className="p-6 md:p-8"><p className="text-sm font-black uppercase tracking-wide text-emerald-300">Bäckerei-Einstellungen</p><h2 className="mt-2 text-3xl font-black">Einstellungen</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">Hier verwaltest du die Daten, die für Zahlungen deiner Kunden verwendet werden. Die hinterlegten Kontodaten werden nur bei Bestellungen angezeigt, die deiner Bäckerei zugeordnet sind.</p></CardContent></Card><div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]"><Card className="rounded-[1.75rem] border-0 shadow-sm ring-1 ring-slate-200"><CardContent className="p-6"><p className="text-sm font-bold uppercase tracking-wide text-violet-600">Konto</p><h3 className="mt-1 text-2xl font-black">Bäckereikonto</h3><div className="mt-5 space-y-4"><div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Bäckerei</p><p className="mt-1 font-black text-slate-900">{bakeryApproval?.name || currentUser.name || 'Bäckerei'}</p></div><div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Login / E-Mail</p><p className="mt-1 break-all font-semibold text-slate-900">{currentUser.email || '–'}</p></div><div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-100"><p className="font-black">✓ Bäckerei freigeschaltet</p><p className="mt-1">Zahlungen werden anhand der Bäckerei-Zuordnung der Schule automatisch deinem Konto zugeordnet.</p></div></div></CardContent></Card><Card className="rounded-[1.75rem] border-0 bg-gradient-to-br from-blue-50 to-emerald-50 shadow-sm ring-1 ring-blue-100"><CardContent className="p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-bold uppercase tracking-wide text-blue-600">Zahlungen</p><h3 className="mt-1 text-2xl font-black">Eigene Zahlungsdaten</h3><p className="mt-2 max-w-2xl text-sm text-slate-600">Eltern sehen bei der Zahlung ausschließlich die Daten der Bäckerei, bei der bestellt wurde. Bei Bestellungen bei mehreren Bäckereien wird der Betrag automatisch getrennt.</p></div><span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${bakeryPaymentForm.bankTransferEnabled || bakeryPaymentForm.paypalEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{bakeryPaymentForm.bankTransferEnabled || bakeryPaymentForm.paypalEnabled ? 'Zahlungsart aktiv' : 'Keine Zahlungsart aktiv'}</span></div><div className="mt-6 grid gap-4 md:grid-cols-2"><div><label className="text-sm font-bold text-slate-700">Kontoinhaber *</label><Input value={bakeryPaymentForm.accountHolder} onChange={(e) => setBakeryPaymentForm((p) => ({ ...p, accountHolder: e.target.value }))} placeholder="z. B. Testbäckerei Brixen GmbH" className="mt-2 bg-white" /></div><div><label className="text-sm font-bold text-slate-700">IBAN</label><Input value={bakeryPaymentForm.iban} onChange={(e) => setBakeryPaymentForm((p) => ({ ...p, iban: e.target.value }))} placeholder="IT00 ..." className="mt-2 bg-white font-mono" /></div><div><label className="text-sm font-bold text-slate-700">BIC</label><Input value={bakeryPaymentForm.bic} onChange={(e) => setBakeryPaymentForm((p) => ({ ...p, bic: e.target.value }))} placeholder="optional" className="mt-2 bg-white font-mono" /></div><div><label className="text-sm font-bold text-slate-700">PayPal-Link</label><Input value={bakeryPaymentForm.paypalLink} onChange={(e) => setBakeryPaymentForm((p) => ({ ...p, paypalLink: e.target.value }))} placeholder="https://paypal.me/..." className="mt-2 bg-white" /></div></div><div className="mt-5 rounded-2xl bg-white/80 p-4 text-sm text-slate-600 ring-1 ring-white"><p className="font-black text-slate-900">Zahlungsarten aktivieren</p><p className="mt-1 text-xs text-slate-500">Nur aktivierte und vollständig eingerichtete Zahlungsarten werden Eltern beim Bezahlen angeboten.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setBakeryPaymentForm((p) => ({ ...p, bankTransferEnabled: !p.bankTransferEnabled }))} className={`rounded-2xl border p-4 text-left transition ${bakeryPaymentForm.bankTransferEnabled ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-600'}`}><div className="flex items-center justify-between gap-3"><div><p className="font-black">Überweisung</p><p className="mt-1 text-xs">Benötigt Kontoinhaber und IBAN.</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${bakeryPaymentForm.bankTransferEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{bakeryPaymentForm.bankTransferEnabled ? 'Aktiv' : 'Aus'}</span></div></button><button type="button" onClick={() => setBakeryPaymentForm((p) => ({ ...p, paypalEnabled: !p.paypalEnabled }))} className={`rounded-2xl border p-4 text-left transition ${bakeryPaymentForm.paypalEnabled ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-slate-200 bg-white text-slate-600'}`}><div className="flex items-center justify-between gap-3"><div><p className="font-black">PayPal</p><p className="mt-1 text-xs">Nur aktivieren, wenn ein eigenes PayPal-Konto vorhanden ist.</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${bakeryPaymentForm.paypalEnabled ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{bakeryPaymentForm.paypalEnabled ? 'Aktiv' : 'Aus'}</span></div></button></div></div><div className="mt-6 rounded-2xl bg-white/90 p-5 ring-1 ring-amber-200"><p className="text-sm font-bold uppercase tracking-wide text-amber-600">Bestellfrist</p><h4 className="mt-1 text-xl font-black text-slate-950">Produktionsmenge automatisch fixieren</h4><p className="mt-2 text-sm text-slate-600">Nach Ablauf dieser Frist können Eltern für den jeweiligen Liefertag nicht mehr neu bestellen, ändern oder stornieren. Die Einstellung gilt für alle Schulen deiner Bäckerei.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><div><label className="text-sm font-bold text-slate-700">Tage vor Lieferung</label><Input type="number" min="0" max="7" value={bakeryPaymentForm.deadlineDaysBefore} onChange={(e) => setBakeryPaymentForm((p) => ({ ...p, deadlineDaysBefore: e.target.value }))} className="mt-2 bg-white" /><p className="mt-1 text-xs text-slate-500">Beispiel: 1 = am Vortag.</p></div><div><label className="text-sm font-bold text-slate-700">Uhrzeit</label><Input type="time" value={bakeryPaymentForm.deadlineTime} onChange={(e) => setBakeryPaymentForm((p) => ({ ...p, deadlineTime: e.target.value }))} className="mt-2 bg-white" /><p className="mt-1 text-xs text-slate-500">Zeitzone: Europa/Rom.</p></div></div><div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">Beispiel: {bakeryPaymentForm.deadlineDaysBefore || '0'} Tag(e) vorher um {bakeryPaymentForm.deadlineTime || '18:00'} Uhr.</div></div><Button type="button" onClick={saveMyBakeryPaymentSettings} disabled={isSaving} className="mt-5 rounded-xl bg-blue-700 px-6 text-white hover:bg-blue-800">{isSaving ? 'Speichere...' : 'Einstellungen speichern'}</Button></CardContent></Card></div></div>}{currentUser.role === 'bakery' && activeTab === 'produkte' && <div className="space-y-6"><Card className="rounded-[1.75rem] border-0 shadow-sm ring-1 ring-slate-200"><CardContent className="p-6"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-bold uppercase tracking-wide text-emerald-600">Sortiment</p><h2 className="text-3xl font-black">Produkte verwalten</h2><p className="mt-2 max-w-2xl text-sm text-slate-500">Diese Produkte werden Eltern angezeigt, deren Schule deiner Bäckerei zugeordnet ist. Deaktivierte Produkte bleiben gespeichert, können aber nicht bestellt werden.</p></div><span className="w-fit rounded-full bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">{menuProducts.filter((product) => product.active !== false).length} aktiv</span></div><div className="mt-6 grid gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 md:grid-cols-2 xl:grid-cols-[1.2fr_0.6fr_1fr_1.5fr_auto]"><Input value={newProduct.name} onChange={(event) => setNewProduct((prev) => ({ ...prev, name: event.target.value }))} placeholder="Produktname *" className="rounded-xl bg-white" /><Input value={newProduct.price} onChange={(event) => setNewProduct((prev) => ({ ...prev, price: event.target.value }))} placeholder="Preis, z. B. 3,20 *" className="rounded-xl bg-white" /><Input value={newProduct.tags} onChange={(event) => setNewProduct((prev) => ({ ...prev, tags: event.target.value }))} placeholder="Tags, z. B. vegan, frisch" className="rounded-xl bg-white" /><Input value={newProduct.desc} onChange={(event) => setNewProduct((prev) => ({ ...prev, desc: event.target.value }))} placeholder="Beschreibung" className="rounded-xl bg-white" /><Button type="button" onClick={addProduct} disabled={isSaving} className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">{isSaving ? 'Speichere...' : '+ Produkt'}</Button></div></CardContent></Card><div className="grid gap-4 lg:grid-cols-2">{menuProducts.length ? menuProducts.map((product) => { const isEditing = editingProductId === product.id; const isActive = product.active !== false; return <Card key={product.id} className={`rounded-[1.5rem] border-0 shadow-sm ring-1 ${isActive ? 'ring-slate-200' : 'bg-slate-50 ring-slate-200 opacity-80'}`}><CardContent className="p-5">{isEditing ? <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Input value={editingProduct.name} onChange={(event) => setEditingProduct((prev) => ({ ...prev, name: event.target.value }))} placeholder="Produktname" /><Input value={editingProduct.price} onChange={(event) => setEditingProduct((prev) => ({ ...prev, price: event.target.value }))} placeholder="Preis" /></div><Input value={editingProduct.tags} onChange={(event) => setEditingProduct((prev) => ({ ...prev, tags: event.target.value }))} placeholder="Tags" /><Input value={editingProduct.desc} onChange={(event) => setEditingProduct((prev) => ({ ...prev, desc: event.target.value }))} placeholder="Beschreibung" /><div className="flex flex-wrap gap-2"><Button type="button" onClick={() => saveProductChanges(product.id)} disabled={isSaving} className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">Speichern</Button><Button type="button" variant="outline" onClick={cancelEditProduct} disabled={isSaving} className="rounded-xl">Abbrechen</Button></div></div> : <><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black">{product.name}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-black ${isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{isActive ? 'Aktiv' : 'Deaktiviert'}</span></div><p className="mt-1 text-2xl font-black text-slate-950">{money(product.price)}</p><p className="mt-2 text-sm leading-relaxed text-slate-500">{product.desc || 'Keine Beschreibung'}</p><div className="mt-3 flex flex-wrap gap-2">{product.tags.length ? product.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{tag}</span>) : <span className="text-xs text-slate-400">Keine Tags</span>}</div></div></div><div className="mt-5 flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => startEditProduct(product)} disabled={isSaving} className="rounded-xl">Bearbeiten</Button><Button type="button" variant="outline" onClick={() => toggleProductActive(product)} disabled={isSaving} className={`rounded-xl ${isActive ? 'border-amber-200 text-amber-700 hover:bg-amber-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>{isActive ? 'Deaktivieren' : 'Aktivieren'}</Button></div></>}</CardContent></Card>; }) : <Card className="rounded-[1.5rem] border-0 shadow-sm ring-1 ring-slate-200 lg:col-span-2"><CardContent className="p-8 text-center"><div className="text-4xl">🥪</div><h3 className="mt-3 text-xl font-black">Noch keine Produkte</h3><p className="mt-2 text-sm text-slate-500">Lege oben dein erstes Produkt an. Danach kann es von Eltern deiner freigegebenen Schulen bestellt werden.</p></CardContent></Card>}</div></div>}{activeTab === 'schule' && <div className="space-y-6"><section className="bakery-print-header overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 p-4 text-white shadow-lg sm:rounded-[2rem] sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-bold"><Icon name="school" /> Bäckerei-Dashboard</div><span className={`rounded-full px-3 py-1 text-xs font-black ${activeDeadlineOpen ? 'bg-white/15 text-white' : 'bg-white text-emerald-700'}`}>{activeDeadlineOpen ? 'Vorläufige Produktionsmenge' : '🔒 Produktionsmenge fix'}</span></div><h2 className="mt-3 text-2xl font-black tracking-tight sm:mt-4 sm:text-3xl md:text-4xl">Produktion für {activeDay}, {formatDeliveryDate(activeDay, bakeryWeekOffset)}</h2><p className="mt-2 max-w-2xl text-sm text-emerald-50 sm:text-base">Alles, was für die Vorbereitung und Ausgabe benötigt wird – Mengen, Kinder, Klassen und Allergiehinweise auf einen Blick.</p></div><div className="flex flex-col gap-3 lg:items-end"><div className="no-print flex items-center gap-2"><button type="button" onClick={async () => { const next = bakeryWeekOffset - 1; setBakeryWeekOffset(next); await loadBakeryData(currentUser, next); }} className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/25">← Vorherige Woche</button><span className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold text-white">Woche {formatDeliveryDate('Montag', bakeryWeekOffset)} – {formatDeliveryDate('Freitag', bakeryWeekOffset)}</span><button type="button" onClick={async () => { const next = bakeryWeekOffset + 1; setBakeryWeekOffset(next); await loadBakeryData(currentUser, next); }} className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/25">Nächste Woche →</button></div><div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:flex-wrap lg:overflow-visible">{weekdays.map((day) => <button key={day} onClick={() => setActiveDay(day)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold transition sm:px-4 sm:text-sm ${activeDay === day ? 'bg-white text-emerald-700 shadow-sm' : 'bg-white/15 text-white hover:bg-white/25'}`}>{day}</button>)}</div></div></div></section><div className="bakery-stats grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5"><button type="button" onClick={() => setActiveTab('bestellungen-bakery')} className="text-left transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded-3xl"><StatCard label="Bestellungen" value={bakeryOrderCount} hint={`${activeDay}, ${formatDeliveryDate(activeDay, bakeryWeekOffset)}`} icon="orders" tone="violet" /></button><StatCard label="Produkte gesamt" value={bakeryProductCount} hint="zu produzieren" icon="basket" tone="emerald" /><StatCard label="Allergiehinweise" value={bakeryAllergyRows.length} hint="bitte beachten" icon="warning" tone="orange" /><StatCard label="Standorte" value={bakerySchoolCount} hint="Schule / Ausgabe" icon="school" tone="blue" /><StatCard label="Bestellwert" value={money(bakeryRevenue)} hint="Demo-Übersicht" icon="euro" tone="slate" /></div>{bakeryAllergyRows.length > 0 && <Card className="bakery-allergy-card rounded-[1.75rem] border-0 bg-amber-50 shadow-sm ring-1 ring-amber-200"><CardContent className="p-6"><div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-xl">⚠️</span><div className="min-w-0"><h3 className="text-xl font-black text-amber-950">Allergien & besondere Hinweise</h3><p className="mt-1 text-sm text-amber-800">Diese Bestellungen bitte bei der Vorbereitung besonders prüfen.</p><div className="mt-4 flex flex-wrap gap-2">{bakeryAllergyRows.map(({ child }) => <span key={child.id} className="rounded-full bg-white px-3 py-2 text-sm font-bold text-amber-900 shadow-sm ring-1 ring-amber-200">{child.name} · {child.className}: {child.allergies}</span>)}</div></div></div></CardContent></Card>}<div className="bakery-main-grid grid gap-6 xl:grid-cols-[1fr_1.35fr]"><Card className="bakery-production-card rounded-[1.5rem] border-0 shadow-sm ring-1 ring-slate-200 sm:rounded-[1.75rem]"><CardContent className="p-4 sm:p-6"><div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-wide text-emerald-600">Produktion</p><h3 className="text-2xl font-black">Mengen je Produkt</h3></div><span className="rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">{bakeryProductCount} Stück</span></div><div className="space-y-3">{productSummary.length ? productSummary.map((row, index) => <div key={row.product} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white font-black text-slate-500 shadow-sm">{index + 1}</span><p className="font-extrabold text-slate-900">{row.product}</p></div><span className="rounded-xl bg-slate-950 px-4 py-2 text-lg font-black text-white">{row.quantity}×</span></div>) : <p className="rounded-2xl bg-slate-50 p-5 text-slate-500">Keine Produkte für diesen Tag.</p>}</div></CardContent></Card><Card className="bakery-commission-card rounded-[1.5rem] border-0 shadow-sm ring-1 ring-slate-200 sm:rounded-[1.75rem]"><CardContent className="p-4 sm:p-6"><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold uppercase tracking-wide text-indigo-600">Kommissionierung</p><h3 className="text-2xl font-black">Bestellungen nach Kind</h3></div><div className="flex gap-2"><Button onClick={printBakeryList} variant="outline" className="rounded-xl">🖨️ PDF / Drucken</Button>{currentUser.role === 'admin' && !isGuestMode && <Button onClick={sendProductionListToBakery} disabled={isSaving} className="rounded-xl">✉️ An Bäckerei senden</Button>}</div></div><div className="space-y-3">{bakeryDetails.length ? bakeryDetails.map((detail, index) => { const issueKey = `${getDeliveryDateForWeek(activeDay, bakeryWeekOffset)}::${detail.childId}`; const isIssued = Boolean(issuedChildren[issueKey]); return <div key={`${detail.childName}-${index}`} className={`rounded-2xl border p-4 shadow-sm transition ${isIssued ? 'border-emerald-300 bg-emerald-50/70' : 'border-slate-200 bg-white'}`}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="text-lg font-black">{detail.childName}</p><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">{detail.className}</span>{detail.allergies && detail.allergies.toLowerCase() !== 'keine' && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800">⚠ {detail.allergies}</span>}{isIssued && <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-black text-white">✓ Ausgegeben</span>}</div><p className="mt-1 text-sm font-medium text-slate-500">{detail.school}</p></div><div className="flex items-center gap-2"><span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-700">{detail.items.length} Stück</span><Button type="button" onClick={() => toggleIssued(detail.childId)} disabled={isSaving} variant={isIssued ? 'default' : 'outline'} className={`no-print rounded-xl ${isIssued ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''}`}>{isIssued ? '✓ Ausgegeben' : 'Ausgeben'}</Button></div></div><div className="mt-4 flex flex-wrap gap-2">{summarizeItemNames(detail.items).map((item) => <span key={item.name} className={`rounded-xl px-3 py-2 text-sm font-bold ring-1 ${isIssued ? 'bg-white text-emerald-800 ring-emerald-200' : 'bg-emerald-50 text-emerald-800 ring-emerald-100'}`}>{item.quantity > 1 ? `${item.quantity}× ` : ''}{item.name}</span>)}</div></div>; }) : <p className="rounded-2xl bg-slate-50 p-5 text-slate-500">Keine Bestellungen für diesen Tag.</p>}</div></CardContent></Card></div><Card className="no-print rounded-[1.75rem] border-0 bg-slate-950 text-white shadow-sm"><CardContent className="p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-sm font-bold uppercase tracking-wide text-emerald-300">Ablauf in der Praxis</p><h3 className="mt-1 text-2xl font-black">Vom Auftrag bis zur Ausgabe</h3><p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">Nach Ablauf der Bestellfrist erhält die Bäckerei eine feste Produktionsmenge. Bei der Kommissionierung sieht sie Kind, Klasse und Allergiehinweise; anschließend kann die Liste gedruckt oder digital verwendet werden.</p></div>{isGuestMode && <span className="rounded-2xl bg-violet-500/20 px-4 py-3 text-sm font-bold text-violet-100 ring-1 ring-violet-400/30">🧪 Demo – keine echten Daten werden versendet</span>}</div></CardContent></Card></div>}{currentUser.role === 'admin' && activeTab === 'admin' && <div className="space-y-6"><div className="grid gap-4 md:grid-cols-4"><StatCard label="Admin-Umsatz" value={money(paidRevenue + openRevenue)} hint="inkl. offener Zahlungen" icon="chart" /><StatCard label="Offene Zahlungen" value={adminTodoSummary.openPayments} hint={money(openRevenue)} icon="payment" /><StatCard label="Produktion heute" value={adminTodoSummary.productionItems} hint={`Artikel für ${activeDay}`} icon="basket" /><StatCard label="Offene E-Mails" value={adminTodoSummary.emailsOpen} hint={`Admin: ${ADMIN_EMAIL}`} icon="mail" /></div><Card className="rounded-2xl border-0 shadow-sm ring-1 ring-slate-200"><CardContent className="p-6"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold uppercase tracking-wide text-orange-600">Onboarding</p><h2 className="text-2xl font-black">Neue Bäckerei-Anträge</h2><p className="mt-1 text-sm text-slate-500">Hier werden ausschließlich neue Bäckereien geprüft. Schul-Anträge werden darunter separat verwaltet.</p></div><span className="w-fit rounded-full bg-orange-100 px-3 py-1 text-sm font-black text-orange-800">{pendingBakeryApplications.length} offen</span></div><div className="mt-5 space-y-4">{pendingBakeryApplications.length ? pendingBakeryApplications.map((application: any) => { const schoolRequests = pendingSchoolRequests.filter((request: any) => request.bakery_id === application.bakery_id); const loadingBakery = adminApprovalLoadingId === `bakery:${application.bakery_id}`; return <div key={application.bakery_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="text-xl font-black">🥐 {application.bakery_name}</p><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800">Freigabe ausstehend</span></div>{application.legal_name && <p className="mt-1 text-sm font-semibold text-slate-600">{application.legal_name}</p>}<div className="mt-3 grid gap-1 text-sm text-slate-600"><p><span className="font-semibold text-slate-800">E-Mail:</span> {application.email || '–'}</p><p><span className="font-semibold text-slate-800">Telefon:</span> {application.phone || '–'}</p><p><span className="font-semibold text-slate-800">Adresse:</span> {application.address || '–'}</p><p><span className="font-semibold text-slate-800">MwSt.-Nr.:</span> {application.vat_number || '–'}</p></div></div><div className="flex flex-wrap gap-2"><Button type="button" onClick={() => approveBakeryApplication(application.bakery_id)} disabled={Boolean(adminApprovalLoadingId)} className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">{loadingBakery ? 'Speichere...' : 'Bäckerei freigeben'}</Button><Button type="button" variant="outline" onClick={() => rejectBakeryApplication(application.bakery_id)} disabled={Boolean(adminApprovalLoadingId)} className="rounded-xl border-red-200 text-red-700 hover:bg-red-50">Ablehnen</Button></div></div></div>; }) : <div className="rounded-2xl bg-emerald-50 p-5 text-sm font-semibold text-emerald-800">✓ Aktuell gibt es keine offenen Bäckerei-Anträge.</div>}</div></CardContent></Card><Card className="rounded-2xl border-0 shadow-sm ring-1 ring-slate-200"><CardContent className="p-6"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold uppercase tracking-wide text-indigo-600">Schulen</p><h2 className="text-2xl font-black">Offene Schul-Anträge</h2><p className="mt-1 text-sm text-slate-500">Schulvorschläge werden unabhängig von der Bäckerei-Freigabe geprüft.</p></div><span className="w-fit rounded-full bg-indigo-100 px-3 py-1 text-sm font-black text-indigo-800">{pendingSchoolRequests.length} offen</span></div><div className="mt-5 space-y-3">{pendingSchoolRequests.length ? pendingSchoolRequests.map((request: any) => { const loadingSchool = adminApprovalLoadingId === `school:${request.id}`; const matchingBakery = pendingBakeryApplications.find((application: any) => application.bakery_id === request.bakery_id); const bakeryName = request.bakeries?.name || matchingBakery?.bakery_name || 'Bäckerei'; return <div key={request.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="text-lg font-black">🏫 {request.school_name}</p><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800">Freigabe ausstehend</span></div><p className="mt-2 text-sm text-slate-600"><span className="font-semibold text-slate-800">Bäckerei:</span> {bakeryName}</p><p className="mt-1 text-sm text-slate-600"><span className="font-semibold text-slate-800">Ort / Adresse:</span> {[request.address, request.city].filter(Boolean).join(', ') || 'Keine Adresse angegeben'}</p></div><div className="flex flex-wrap gap-2"><Button type="button" onClick={() => approveSchoolRequestAdmin(request.id)} disabled={Boolean(adminApprovalLoadingId)} className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">{loadingSchool ? 'Speichere...' : 'Schule freigeben'}</Button><Button type="button" variant="outline" onClick={() => rejectSchoolRequestAdmin(request.id)} disabled={Boolean(adminApprovalLoadingId)} className="rounded-xl border-red-200 text-red-700 hover:bg-red-50">Ablehnen</Button></div></div>; }) : <div className="rounded-2xl bg-emerald-50 p-5 text-sm font-semibold text-emerald-800">✓ Aktuell gibt es keine offenen Schul-Anträge.</div>}</div></CardContent></Card><Card className="rounded-2xl border-0 bg-gradient-to-r from-emerald-50 to-orange-50 shadow-sm"><CardContent className="p-6"><h2 className="text-2xl font-bold">Heute zu erledigen</h2><div className="mt-4 grid gap-3 md:grid-cols-3"><div className="rounded-2xl bg-white p-4"><p className="text-sm text-slate-500">Zahlungen prüfen</p><p className="mt-1 text-xl font-bold">{adminTodoSummary.openPayments} offen</p></div><div className="rounded-2xl bg-white p-4"><p className="text-sm text-slate-500">Bäckerei informieren</p><p className="mt-1 text-xl font-bold">{adminTodoSummary.productionItems} Artikel</p></div><div className="rounded-2xl bg-white p-4"><p className="text-sm text-slate-500">Reminder</p><Button onClick={() => sendReminderEmail('deadline_reminder')} disabled={isSaving} className="mt-2 rounded-xl">Frist-Reminder senden</Button></div></div></CardContent></Card><Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-6"><div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><h2 className="text-2xl font-bold">Zahlungen verwalten</h2><p className="mt-1 text-sm text-slate-500">Suche nach Verwendungszweck, Kind, Eltern-Mail, Status oder Zahlungsart.</p></div><div className="w-full md:w-96"><label className="text-sm font-semibold text-slate-600">Suche</label><Input value={adminOrderSearch} onChange={(event) => setAdminOrderSearch(event.target.value)} placeholder="z. B. PAUSE-..., Lena, offen" className="mt-2 rounded-xl" /></div></div><div className="mb-3 flex flex-col gap-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between"><div className="flex gap-2"><Button variant={adminFilter === 'alle' ? 'default' : 'outline'} onClick={() => setAdminFilter('alle')}>Alle</Button><Button variant={adminFilter === 'offen' ? 'default' : 'outline'} onClick={() => setAdminFilter('offen')}>Offen</Button><Button variant={adminFilter === 'bezahlt' ? 'default' : 'outline'} onClick={() => setAdminFilter('bezahlt')}>Bezahlt</Button></div><span>{filteredAdminOrders.length} von {completedOrders.length} Bestellungen</span></div><div className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-100 text-slate-600"><tr><th className="p-4">Bestellung</th><th className="p-4">Kind</th><th className="p-4">E-Mail</th><th className="p-4">Zahlung</th><th className="p-4">Referenz</th><th className="p-4">Status</th><th className="p-4">Aktion</th></tr></thead><tbody>{filteredAdminOrders.length ? filteredAdminOrders.map((order) => <tr key={order.id} className="border-t"><td className="p-4 font-semibold">{order.id}</td><td className="p-4">{order.child}</td><td className="p-4">{order.parentEmail}</td><td className="p-4">{order.payment} · {money(order.total)}</td><td className="p-4 font-mono text-xs">{order.paymentReference || '–'}</td><td className="p-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${order.status === 'bezahlt' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{order.status}</span></td><td className="p-4">{order.status === 'offen' ? <div className="flex flex-col gap-2"><Button onClick={() => markPaid(order.id)} variant="outline" className="rounded-xl">Als bezahlt markieren</Button><Button onClick={() => sendReminderEmail('payment_reminder', order)} variant="outline" className="rounded-xl">Zahlungs-Reminder</Button></div> : '–'}</td></tr>) : <tr><td className="p-4 text-slate-500" colSpan={7}>Keine Bestellung gefunden.</td></tr>}</tbody></table></div></CardContent></Card><Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-6"><h2 className="mb-4 text-2xl font-bold">Menü verwalten</h2><div className="mb-6 grid gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 md:grid-cols-[1.2fr_0.7fr_1fr_1.4fr_auto]"><Input value={newProduct.name} onChange={(event) => setNewProduct((prev) => ({ ...prev, name: event.target.value }))} placeholder="Produktname" className="rounded-xl" /><Input value={newProduct.price} onChange={(event) => setNewProduct((prev) => ({ ...prev, price: event.target.value }))} placeholder="Preis z. B. 3,20" className="rounded-xl" /><Input value={newProduct.tags} onChange={(event) => setNewProduct((prev) => ({ ...prev, tags: event.target.value }))} placeholder="Tags, z. B. vegan" className="rounded-xl" /><Input value={newProduct.desc} onChange={(event) => setNewProduct((prev) => ({ ...prev, desc: event.target.value }))} placeholder="Beschreibung" className="rounded-xl" /><Button onClick={addProduct} disabled={isSaving} className="rounded-xl">Hinzufügen</Button></div><div className="space-y-3">{menuProducts.map((product) => <div key={product.id} className="rounded-2xl border bg-white p-4"><p className="font-bold">{product.name} · {money(product.price)}</p><p className="text-sm text-slate-500">{product.desc}</p></div>)}</div></CardContent></Card><Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-6"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-2xl font-bold">Produktionsliste für die Bäckerei</h2><p className="text-slate-500">Zusammenfassung für {activeDay}.</p></div><div className="flex flex-wrap gap-2"><Button onClick={printBakeryList} variant="outline" className="rounded-xl">PDF / Drucken</Button></div></div><div className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-100 text-slate-600"><tr><th className="p-4">Produkt</th><th className="p-4">Menge</th></tr></thead><tbody>{productSummary.length ? productSummary.map((row) => <tr key={row.product} className="border-t"><td className="p-4 font-semibold">{row.product}</td><td className="p-4">{row.quantity}</td></tr>) : <tr><td className="p-4 text-slate-500" colSpan={2}>Keine Produkte für diesen Tag.</td></tr>}</tbody></table></div></CardContent></Card></div>}</motion.div></main></div></div></div>;
}
