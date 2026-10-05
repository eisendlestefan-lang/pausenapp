import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { env, isSupabaseConfigured, supabase } from '@/lib/supabase';

type Product = { id: string; name: string; price: number; tags: string[]; desc: string; active?: boolean; bakeryId?: string | null };
type Child = { id: string; name: string; school: string; schoolId?: string | null; className: string; allergies: string };
type SchoolOption = { id: string; name: string; bakeryId: string; bakeryName: string };
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
const paymentMethods = ['Überweisung', 'PayPal', 'Stripe', 'Kreditkarte'];
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
  const message = error instanceof Error ? error.message : String(error || 'Unbekannter Fehler');
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
    email: order.confirmation_email_sent ? 'gesendet' : 'vorgemerkt'
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

function getOrderDeadlineDate(weekday: string) {
  const deliveryDate = new Date(`${getNextDeliveryDate(weekday)}T00:00:00`);
  const deadline = new Date(deliveryDate);
  deadline.setDate(deliveryDate.getDate() - 1);
  deadline.setHours(ORDER_DEADLINE_HOUR, ORDER_DEADLINE_MINUTE, 0, 0);
  return deadline;
}

function isOrderDeadlineOpen(weekday: string, now = new Date()) {
  return now.getTime() <= getOrderDeadlineDate(weekday).getTime();
}

function formatOrderDeadline(weekday: string) {
  return getOrderDeadlineDate(weekday).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function getReminderMessage(weekday: string, now = new Date()) {
  const deadline = getOrderDeadlineDate(weekday);
  const diffMs = deadline.getTime() - now.getTime();
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
  if (diffMs < 0) return `Bestellungen für ${weekday} sind fixiert.`;
  if (diffHours <= 3) return `Reminder: Bestellfrist für ${weekday} endet bald.`;
  if (diffHours <= 24) return `Reminder: Bestellfrist für ${weekday} endet heute bzw. morgen.`;
  return `Bestellfrist für ${weekday}: ${formatOrderDeadline(weekday)}`;
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
  const parentItems = [['start', 'home', 'Start'], ['bestellen', 'basket', 'Bestellen'], ['kinder', 'user', 'Kinder'], ['zahlung', 'payment', 'Zahlung'], ['statistiken', 'chart', 'Statistiken']];
  if (user?.role === 'bakery') return [['schule', 'school', 'Bäckerei']];
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

function filterOrdersBySearch(ordersList: CompletedOrder[], searchTerm: string) {
  const term = String(searchTerm || '').trim().toLowerCase();
  if (!term) return ordersList;
  return ordersList.filter((order) => [order.id, order.parent, order.parentEmail, order.child, order.school, order.day, order.payment, order.paymentReference, order.status, money(order.total)].filter(Boolean).some((value) => String(value).toLowerCase().includes(term)));
}

function getParentOrderStats(ordersList: CompletedOrder[]) {
  return {
    count: ordersList.length,
    openCount: ordersList.filter((order) => order.status === 'offen').length,
    paidCount: ordersList.filter((order) => order.status === 'bezahlt').length,
    openTotal: ordersList.filter((order) => order.status === 'offen').reduce((sum, order) => sum + order.total, 0),
    paidTotal: ordersList.filter((order) => order.status === 'bezahlt').reduce((sum, order) => sum + order.total, 0)
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

function ParentHome({ children, orders, completedOrders, onNavigate, onSelectChild, onSelectDay, currentUser, isGuestMode }: { children: Child[]; orders: OrderMap; completedOrders: CompletedOrder[]; onNavigate: (tab: string) => void; onSelectChild: (id: string) => void; onSelectDay: (day: string) => void; currentUser: AppUser; isGuestMode: boolean }) {
  const nextDay = weekdays.find((day) => children.some((child) => (orders[child.id]?.[day] || []).length > 0)) || weekdays[0];
  const nextDayOpen = isOrderDeadlineOpen(nextDay);
  const reminderMessage = getReminderMessage(nextDay);
  const openPayments = completedOrders.filter((order) => order.status === 'offen');
  const paidOrders = completedOrders.filter((order) => order.status === 'bezahlt');
  const openTotal = openPayments.reduce((sum, order) => sum + order.total, 0);
  const deadlineText = nextDayOpen ? formatOrderDeadline(nextDay) : 'fixiert';

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
  const [schoolOptions, setSchoolOptions] = useState<SchoolOption[]>([]);
  const [selectedPayment, setSelectedPayment] = useState('Überweisung');
  const [lastConfirmation, setLastConfirmation] = useState('');
  const [lastOrder, setLastOrder] = useState<CompletedOrder | null>(null);
  const [menuProducts, setMenuProducts] = useState<Product[]>(fallbackProducts);
  const [newProduct, setNewProduct] = useState({ name: '', price: '', tags: '', desc: '' });
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
  const [bakeryApproval, setBakeryApproval] = useState<{ name: string; approvalStatus: string; active: boolean } | null>(null);
  const [pendingBakeryApplications, setPendingBakeryApplications] = useState<any[]>([]);
  const [pendingSchoolRequests, setPendingSchoolRequests] = useState<any[]>([]);
  const [adminApprovalLoadingId, setAdminApprovalLoadingId] = useState('');

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

          // A bakery signup has no authenticated session until the email is confirmed.
          // Finish the bakery application automatically on the first confirmed session.
          if (!profile && authData.user.user_metadata?.account_type === 'bakery_application') {
            await finalizeBakeryApplication(authData.user);
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
      const { data: orderData, error: orderError } = await supabase.from('orders').select('id, child_id, school, delivery_date, weekday, total, payment_method, payment_reference, status, confirmation_email_sent, created_at').eq('parent_id', loadedUser.id).order('created_at', { ascending: false }).limit(25);
      if (orderError) throw orderError;
      if (Array.isArray(orderData)) setCompletedOrders(orderData.map((order) => normalizeCompletedOrder(order, normalizedChildren.find((child) => child.id === order.child_id), loadedUser)));
    } catch (error) {
      setBackendNotice(`Daten konnten nicht geladen werden: ${getNetworkErrorMessage(error)}`);
    }
  }

  async function loadBakeryData(loadedUser = user, weekOffset = bakeryWeekOffset) {
    if (!supabase || !functionNeedsRealUser(loadedUser) || loadedUser?.role !== 'bakery' || !loadedUser?.bakeryId) return;
    try {
      const { data: productData, error: productError } = await supabase.from('products').select('id, name, description, price, tags, active, bakery_id').eq('bakery_id', loadedUser.bakeryId).eq('active', true).order('name');
      if (productError) throw productError;
      const bakeryProducts = Array.isArray(productData) ? productData.map(normalizeProduct) : [];
      if (bakeryProducts.length) setMenuProducts(bakeryProducts);

      const { data: orderData, error: orderError } = await supabase.from('orders').select('id, parent_id, child_id, school, delivery_date, weekday, total, payment_method, payment_reference, status, confirmation_email_sent, issued_at, created_at, bakery_id').eq('bakery_id', loadedUser.bakeryId).in('delivery_date', weekdays.map((day) => getDeliveryDateForWeek(day, weekOffset))).order('delivery_date', { ascending: true }).order('created_at', { ascending: false }).limit(500);
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
      if (orderIds.length) {
        const { data: itemData, error: itemError } = await supabase.from('order_items').select('order_id, product_id, quantity').in('order_id', orderIds);
        if (itemError) throw itemError;
        const itemsByOrder = new Map<string, string[]>();
        (itemData || []).forEach((item: any) => {
          const list = itemsByOrder.get(item.order_id) || [];
          const quantity = Math.max(1, Number(item.quantity || 1));
          for (let i = 0; i < quantity; i += 1) list.push(item.product_id);
          itemsByOrder.set(item.order_id, list);
        });
        bakeryOrders.forEach((order: any) => {
          if (!order.child_id || !order.weekday || !order.delivery_date) return;
          if (order.delivery_date !== getDeliveryDateForWeek(order.weekday, weekOffset)) return;
          if (!bakeryOrderMap[order.child_id]) bakeryOrderMap[order.child_id] = {};
          const existing = bakeryOrderMap[order.child_id][order.weekday] || [];
          bakeryOrderMap[order.child_id][order.weekday] = [...existing, ...(itemsByOrder.get(order.id) || [])];
        });
      }
      setOrders(bakeryOrderMap);
      setCompletedOrders(bakeryOrders.map((order: any) => normalizeCompletedOrder(order, bakeryChildren.find((child) => child.id === order.child_id), loadedUser)));
      setBackendNotice('Bäckerei-Daten aus Supabase geladen');
    } catch (error) {
      setBackendNotice(`Bäckerei-Daten konnten nicht geladen werden: ${getNetworkErrorMessage(error)}`);
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
  const activeSchoolOption = schoolOptions.find((school) => school.id === activeChild.schoolId);
  const visibleMenuProducts =
    currentUser.role === 'parent' && !isGuestMode
      ? activeSchoolOption?.bakeryId
        ? menuProducts.filter((product) => product.bakeryId === activeSchoolOption.bakeryId)
        : []
      : menuProducts;
  const activeDeadlineOpen = isOrderDeadlineOpen(activeDay);
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
  const adminTodoSummary = useMemo(() => ({ openPayments: parentOrderStats.openCount, productionItems: productSummary.reduce((sum, row) => sum + row.quantity, 0), emailsOpen: completedOrders.filter((order) => order.email !== 'gesendet').length }), [completedOrders, parentOrderStats.openCount, productSummary]);
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

  function openPayPalPayment() {
    if (isGuestMode) {
      setPaypalStatus('Im Demo-Gastmodus werden keine echten PayPal-Zahlungen geöffnet.');
      return;
    }
    const opened = window.open(PAYPAL_PAYMENT_LINK, '_blank', 'noopener,noreferrer');
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

  async function invokeEmailFunction(type: string, payload: any) {
    if (!supabase) return { sent: false, reason: 'Supabase ist nicht verbunden.' };
    try {
      const { error } = await supabase.functions.invoke(EMAIL_FUNCTION_NAME, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { type, payload } });
      if (error) return { sent: false, reason: error.message };
      return { sent: true };
    } catch (error) { return { sent: false, reason: getNetworkErrorMessage(error) }; }
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

  async function saveOrderToSupabase(localOrder: CompletedOrder) {
    const selectedProducts = dayItems.map((productId) => menuProducts.find((product) => product.id === productId)).filter(Boolean) as Product[];
    if (!supabase || !functionNeedsRealUser(user)) return { saved: false, reason: 'Keine echte Supabase-Session aktiv.', selectedProducts };
    if (!selectedProducts.length) return { saved: false, reason: 'Keine Produkte ausgewählt.', selectedProducts };
    if (!selectedProducts.every((product) => isUuid(product.id))) return { saved: false, reason: 'Mindestens ein Produkt stammt noch aus Demo-Daten.', selectedProducts };
    try {
      const childId = isUuid(activeChild.id) ? activeChild.id : null;
      if (!childId) return { saved: false, reason: 'Kind ist noch nicht in Supabase gespeichert.', selectedProducts };
      const { data: insertedOrder, error: orderError } = await supabase.from('orders').insert({ parent_id: user.id, child_id: childId, school: activeChild.school, school_id: activeChild.schoolId, delivery_date: getNextDeliveryDate(activeDay), weekday: activeDay, total: activeDayTotal, payment_method: selectedPayment, payment_reference: localOrder.paymentReference, status: localOrder.status, confirmation_email_sent: false, bakery_email_sent: false }).select('id').single();
      if (orderError) throw orderError;
      const orderItems = groupProductsByQuantity(selectedProducts).map(({ product, quantity }) => ({ order_id: insertedOrder.id, product_id: product.id, product_name: product.name, quantity, unit_price: product.price }));
      const { error: itemError } = await supabase.from('order_items').insert(orderItems);
      if (itemError) throw itemError;
      return { saved: true, orderId: insertedOrder.id, selectedProducts };
    } catch (error) { return { saved: false, reason: getNetworkErrorMessage(error), selectedProducts }; }
  }

  async function confirmOrder() {
    if (!activeDeadlineOpen) return setLastConfirmation(`Bestellfrist für ${activeDay} ist abgelaufen. Bitte wähle einen anderen Tag.`);
    if (!dayItems.length) return setLastConfirmation('Bitte wähle zuerst mindestens ein Produkt aus.');
    const localOrder: CompletedOrder = { id: `ord-${1000 + completedOrders.length + 1}`, parent: currentUser.name, parentEmail: currentUser.email, child: activeChild.name, school: activeChild.school, day: activeDay, deliveryDate: getNextDeliveryDate(activeDay), total: activeDayTotal, payment: selectedPayment, paymentReference: createPaymentReference({ child: activeChild, day: activeDay }), status: selectedPayment === 'Stripe' || selectedPayment === 'Kreditkarte' ? 'bezahlt' : 'offen', email: 'vorgemerkt' };

    if (isGuestMode) {
      setCompletedOrders((prev) => [localOrder, ...prev]);
      setLastOrder(localOrder);
      setLastConfirmation('Demo-Bestellung erfolgreich. Es wurden keine echten Daten gespeichert und keine E-Mails versendet.');
      setBackendNotice('Demo-Modus: Bestellung wurde nur lokal simuliert.');
      return;
    }

    setIsSaving(true);
    setPaypalStatus('');
    try {
      const result = await saveOrderToSupabase(localOrder);
      const savedOrder = result.saved ? { ...localOrder, id: result.orderId! } : localOrder;
      let finalOrder = { ...savedOrder };
      if (selectedPayment === 'PayPal') {
        setPaypalStatus('Bestellung gespeichert. Bitte öffne PayPal über den Button unten und gib dort Betrag und Verwendungszweck an.');
        finalOrder = { ...savedOrder, status: 'offen' };
      }
      const emailResult = result.saved ? await sendOrderEmails({ savedOrder: finalOrder, selectedProducts: result.selectedProducts }) : { sent: false, reason: result.reason };
      finalOrder = { ...finalOrder, email: emailResult.sent ? 'gesendet' : 'vorgemerkt' };
      setCompletedOrders((prev) => [finalOrder, ...prev]);
      setLastOrder(finalOrder);
      setLastConfirmation(emailResult.sent ? 'Bestellung erfolgreich!' : `Bestellung gespeichert, aber E-Mail/Supabase-Hinweis: ${emailResult.reason}`);
      setBackendNotice(emailResult.sent ? 'Bestellung gespeichert und E-Mails gesendet' : 'Bestellung gespeichert, E-Mail-Versand offen');
      await loadChildrenAndOrders(user);
    } catch (error) {
      setLastOrder(null);
      setLastConfirmation(`Fehler beim Speichern: ${getNetworkErrorMessage(error)}`);
    } finally { setIsSaving(false); }
  }

  async function markPaid(orderId: string) {
    const orderToConfirm = completedOrders.find((order) => order.id === orderId);
    setCompletedOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, status: 'bezahlt' } : order)));
    if (supabase && functionNeedsRealUser(user) && isUuid(orderId)) {
      setIsSaving(true);
      try {
        const { error } = await supabase.from('orders').update({ status: 'bezahlt' }).eq('id', orderId);
        if (error) throw error;
        if (orderToConfirm) await invokeEmailFunction('payment_confirmed', { orderId, parentName: orderToConfirm.parent, parentEmail: orderToConfirm.parentEmail, childName: orderToConfirm.child, total: orderToConfirm.total, paymentReference: orderToConfirm.paymentReference, adminEmail: ADMIN_EMAIL });
        setBackendNotice('Zahlung bestätigt');
      } catch (error) { setBackendNotice(`Zahlungsstatus konnte nicht gespeichert werden: ${getNetworkErrorMessage(error)}`); }
      finally { setIsSaving(false); }
    } else setBackendNotice('Zahlung lokal als bezahlt markiert');
  }

  async function addProduct() {
    const name = newProduct.name.trim();
    const price = Number.parseFloat(String(newProduct.price).replace(',', '.'));
    if (!name || Number.isNaN(price) || price <= 0) return;
    const product = { id: slugify(name), name, price, tags: newProduct.tags.split(',').map((tag) => tag.trim()).filter(Boolean), desc: newProduct.desc || 'Beschreibung folgt.' };
    setMenuProducts((prev) => [...prev, product]);
    setNewProduct({ name: '', price: '', tags: '', desc: '' });
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
                  <button type="button" onClick={() => setShowBakeryRegistration((value) => !value)} className="w-full rounded-xl border border-slate-700 px-4 py-3 text-sm font-bold text-emerald-300 transition hover:border-emerald-400 hover:bg-slate-900">🥐 {showBakeryRegistration ? 'Registrierung schließen' : 'Als Bäckerei registrieren'}</button>
                </div>
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
`}</style><div className="grid min-h-screen gap-6 p-4 lg:grid-cols-[280px_1fr] lg:p-6"><aside className="no-print hidden rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:flex lg:flex-col"><div className="flex items-center gap-3 px-2 py-3"><span className="text-4xl">🥪</span><div><p className="text-2xl font-black tracking-tight">Pausenapp</p><p className="text-sm font-medium text-slate-500">Einfach. Bestellt.</p></div></div><nav className="mt-8 space-y-2">{navigationItems.map(([id, iconName, label]) => <button key={id} onClick={() => setActiveTab(id)} className={`flex w-full items-center gap-4 rounded-2xl px-5 py-4 text-left text-base font-bold transition ${activeTab === id ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-100' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}><Icon name={id === 'start' ? 'home' : iconName} className="h-5 w-5" />{label === 'Ausgabe' ? 'Ausgabe / Bäckerei' : label}</button>)}</nav><div className="mt-auto rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200"><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500 font-black text-white">SE</span><div><p className="font-extrabold">{currentUser.name}</p><p className="text-sm font-semibold text-indigo-600">{currentUser.role === 'admin' ? 'Administrator' : currentUser.role === 'bakery' ? 'Bäckerei' : 'Elternkonto'}</p></div></div><div className="mt-4 border-t pt-4">{hasRealSupabaseUser ? <button onClick={logout} className="text-sm font-bold text-slate-500 hover:text-slate-950">↪ Abmelden</button> : isGuestMode ? <button onClick={exitGuestMode} className="text-sm font-bold text-violet-600 hover:text-violet-800">Demo beenden</button> : null}</div></div></aside><div className="min-w-0"><div className="no-print mb-4 rounded-[1.5rem] bg-white p-3 shadow-sm ring-1 ring-slate-200 lg:hidden"><div className="mb-3 flex items-center justify-between px-2"><div className="flex items-center gap-2"><span className="text-2xl">🥪</span><span className="font-black">Pausenapp</span></div><span className="text-xs font-semibold text-slate-500">{currentUser.role === 'admin' ? 'Admin' : currentUser.role === 'bakery' ? 'Bäckerei' : 'Eltern'}</span></div><nav className="grid grid-cols-3 gap-2 sm:grid-cols-6">{navigationItems.map(([id, iconName, label]) => <button key={id} onClick={() => setActiveTab(id)} className={`rounded-2xl px-3 py-3 text-xs font-bold transition ${activeTab === id ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-600'}`}><Icon name={id === 'start' ? 'home' : iconName} className="mx-auto mb-1 h-4 w-4" />{label}</button>)}</nav></div><main className="bakery-print-root rounded-[2rem] bg-white/90 p-5 shadow-sm ring-1 ring-slate-200 lg:p-8"><div className="no-print mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-400">{!isGuestMode && <span>{dataLoading ? 'Daten werden geladen...' : backendNotice}</span>}{isGuestMode && <span className="rounded-full bg-violet-100 px-3 py-1 text-violet-800">🧪 TESTMODUS</span>}</div>{isGuestMode && <div className="no-print mb-6 flex flex-col gap-4 rounded-2xl border border-violet-200 bg-violet-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-violet-900">🧪 TESTMODUS – Demo-Gast</p><p className="text-sm text-violet-700">Diese Sitzung ist nur zum Testen. Es werden keine echten Bestellungen, Zahlungen oder E-Mails ausgelöst und nichts in Supabase gespeichert.</p></div><Button variant="outline" onClick={exitGuestMode} className="rounded-xl bg-white">Demo beenden</Button></div>}<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>{currentUser.role !== 'bakery' && activeTab === 'start' && <ParentHome children={children} orders={orders} completedOrders={completedOrders} onNavigate={setActiveTab} onSelectChild={setActiveChildId} onSelectDay={setActiveDay} currentUser={currentUser} isGuestMode={isGuestMode} />}{currentUser.role !== 'bakery' && activeTab === 'bestellen' && <div className="grid gap-6 lg:grid-cols-[280px_1fr]"><Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-5"><h2 className="mb-4 text-xl font-bold">Kind auswählen</h2><div className="space-y-2">{children.map((child) => <button key={child.id} onClick={() => setActiveChildId(child.id)} className={`w-full rounded-xl border p-4 text-left transition ${activeChildId === child.id ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white hover:bg-slate-50'}`}><p className="font-bold">{child.name}</p><p className={`text-sm ${activeChildId === child.id ? 'text-slate-200' : 'text-slate-500'}`}>{child.className} · {child.school}</p></button>)}</div></CardContent></Card><Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-5 md:p-7"><div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><p className="text-sm font-semibold text-emerald-700">Bestellung für {activeChild.name}</p><h2 className="text-2xl font-bold">Pause für {activeDay}</h2><div className={`mt-2 rounded-xl p-3 text-sm font-semibold ${activeOrderEditable ? 'bg-yellow-50 text-yellow-800' : 'bg-red-50 text-red-800 ring-1 ring-red-200'}`}>{activeOrderEditable ? getReminderMessage(activeDay) : `🔒 Bestellfrist abgelaufen – Bestellung für ${activeDay} ist fixiert und kann nicht mehr geändert werden.`}</div><p className="mt-2 text-sm text-slate-500">Allergien: {activeChild.allergies}</p>{activeSchoolOption ? <p className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-800">🥐 Versorgt durch: {activeSchoolOption.bakeryName}</p> : currentUser.role === 'parent' && !isGuestMode ? <p className="mt-2 inline-flex rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700 ring-1 ring-red-200">Keine aktive Bäckerei für diese Schule zugeordnet.</p> : null}</div><Button onClick={() => setActiveTab('zahlung')} disabled={!activeDeadlineOpen} className="rounded-xl">{activeDeadlineOpen ? `Zur Zahlung · ${money(activeDayTotal)}` : 'Frist abgelaufen'} <Icon name="chevron" className="ml-1 h-4 w-4" /></Button></div><div className="mb-6 flex flex-wrap gap-2">{weekdays.map((day) => <button key={day} onClick={() => setActiveDay(day)} className={`rounded-full px-4 py-2 text-sm font-semibold ${activeDay === day ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{day.slice(0, 2)}</button>)}</div><div className="grid gap-4 md:grid-cols-2">{visibleMenuProducts.map((product) => { const quantity = getProductQuantity(dayItems, product.id); const selected = quantity > 0; return <div key={product.id} role="button" tabIndex={activeOrderEditable ? 0 : -1} onClick={() => activeOrderEditable && changeProductQuantity(product.id, 1)} onKeyDown={(event) => { if (activeOrderEditable && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); changeProductQuantity(product.id, 1); } }} className={`rounded-2xl border p-4 transition sm:p-5 ${selected ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white'} ${activeOrderEditable ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-sm' : 'cursor-not-allowed opacity-60'}`}><div className="flex items-start justify-between gap-3 sm:gap-4"><div><h3 className="font-bold">{product.name}</h3><p className="mt-1 text-sm text-slate-500">{product.desc}</p></div><div className="text-right"><p className="font-bold">{money(product.price)}</p>{selected && <span className="mt-2 inline-flex rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">{quantity}× gewählt</span>}</div></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{product.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{tag}</span>)}</div><div className="flex items-center gap-2"><span className="hidden text-xs font-semibold text-slate-400 sm:inline">Karte anklicken = +1</span><div className="flex items-center gap-2 rounded-xl bg-white p-1 ring-1 ring-slate-200"><button type="button" onClick={(event) => { event.stopPropagation(); changeProductQuantity(product.id, -1); }} disabled={!activeOrderEditable || quantity === 0} className="flex h-9 w-9 items-center justify-center rounded-lg text-lg font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30" aria-label={`${product.name} Menge reduzieren`}>−</button><span className="min-w-8 text-center text-lg font-black">{quantity}</span><button type="button" onClick={(event) => { event.stopPropagation(); changeProductQuantity(product.id, 1); }} disabled={!activeOrderEditable} className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-lg font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40" aria-label={`${product.name} Menge erhöhen`}>+</button></div></div></div>{quantity > 0 && <p className="mt-3 text-right text-sm font-bold text-emerald-800">Zwischensumme: {money(product.price * quantity)}</p>}</div>; })}</div></CardContent></Card></div>}{currentUser.role !== 'bakery' && activeTab === 'zahlung' && <div className="grid gap-6 lg:grid-cols-[1fr_360px]"><Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-6"><h2 className="text-2xl font-bold">Bestellung bezahlen</h2><p className="mt-2 text-slate-600">Wähle die Zahlungsart. Bei PayPal und Überweisung bleibt die Bestellung offen, bis der Admin bestätigt.</p><div className="mt-6 grid gap-4 md:grid-cols-2">{paymentMethods.map((method) => { const isLive = livePaymentMethods.includes(method); return <button key={method} onClick={() => setSelectedPayment(method)} className={`rounded-2xl border p-5 text-left ${selectedPayment === method ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white'}`}><div className="flex items-start justify-between gap-3"><p className="text-lg font-bold">{method}</p>{!isLive && <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">Demo</span>}</div><p className="mt-1 text-sm text-slate-500">{method === 'PayPal' ? 'PayPal-Link öffnen und Betrag/Verwendungszweck angeben.' : method === 'Überweisung' ? 'Admin bestätigt nach Zahlungseingang.' : 'Demo-Zahlungsart.'}</p></button>; })}{selectedPayment === 'PayPal' && <div className="mt-2 rounded-2xl border border-blue-200 bg-blue-50 p-5 ring-1 ring-blue-100 md:col-span-2"><p className="text-sm font-semibold text-blue-900">PayPal Checkout</p><Button type="button" onClick={openPayPalPayment} className="mt-4 rounded-xl bg-blue-700 text-white hover:bg-blue-800">PayPal öffnen</Button><div className="mt-3 rounded-xl bg-white p-3 text-xs text-blue-900"><p className="break-all font-mono">{PAYPAL_PAYMENT_LINK}</p><button type="button" onClick={() => copyToClipboard(PAYPAL_PAYMENT_LINK, 'PayPal-Link')} className="mt-2 rounded-lg bg-blue-100 px-3 py-1 font-semibold text-blue-800">Link kopieren</button></div>{paypalStatus && <p className="mt-3 rounded-xl bg-white p-3 text-sm font-semibold text-blue-900">{paypalStatus}</p>}</div>}{selectedPayment === 'Überweisung' && <div className="mt-2 rounded-2xl border bg-white p-5 ring-1 ring-slate-200 md:col-span-2"><p className="text-sm font-semibold text-slate-600">Überweisungsdaten</p><div className="mt-3 grid gap-2 text-sm"><div className="flex justify-between gap-3"><span className="text-slate-500">Empfänger</span><span className="font-semibold">{BANK_RECIPIENT}</span></div><div className="flex justify-between gap-3"><span className="text-slate-500">IBAN</span><span className="flex items-center gap-2 font-mono font-semibold">{BANK_IBAN}<button onClick={() => copyToClipboard(BANK_IBAN, 'IBAN')} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-sans text-slate-700">Kopieren</button></span></div><div className="flex justify-between gap-3"><span className="text-slate-500">BIC</span><span className="font-mono">{BANK_BIC || 'nicht erforderlich'}</span></div></div></div>}</div><Button onClick={confirmOrder} disabled={isSaving || !activeDeadlineOpen} className="mt-6 rounded-xl">{isSaving ? 'Speichere...' : 'Jetzt bestellen und bestätigen'}</Button>{lastConfirmation && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-800">{lastConfirmation}</p>}{lastOrder && <div className="mt-6 rounded-2xl bg-emerald-50 p-6 text-emerald-900 shadow-sm"><div className="flex items-center gap-3 text-lg font-bold"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white">✓</span>Bestellung erfolgreich</div><p className="mt-3 text-sm">{lastOrder.child} · {lastOrder.day}</p><p className="text-sm">Gesamt: {money(lastOrder.total)}</p><p className="mt-4 text-sm font-semibold">Verwendungszweck</p><p className="text-xs font-bold text-red-600">WICHTIG: exakt so angeben!</p><div className="mt-1 flex flex-col gap-2 rounded-lg bg-white p-2 sm:flex-row sm:items-center sm:justify-between"><p className="font-mono text-sm">{lastOrder.paymentReference}</p><Button onClick={() => copyToClipboard(lastOrder.paymentReference, 'Verwendungszweck')} variant="outline" className="rounded-xl">Kopieren</Button></div>{lastOrder.payment === 'PayPal' && <Button type="button" onClick={openPayPalPayment} className="mt-4 rounded-xl bg-blue-700 text-white hover:bg-blue-800">Jetzt mit PayPal bezahlen</Button>}</div>}</CardContent></Card><Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-6"><h3 className="text-xl font-bold">Zusammenfassung</h3><p className="mt-4 text-sm text-slate-500">Kind</p><p className="font-semibold">{activeChild.name}</p><p className="mt-4 text-sm text-slate-500">Tag</p><p className="font-semibold">{activeDay}</p><p className="mt-4 text-sm text-slate-500">Produkte</p><p className="font-semibold">{dayItems.length ? formatSelectedProducts(dayItems, menuProducts) : 'Keine Produkte gewählt'}</p><div className="mt-6 rounded-2xl bg-slate-950 p-5 text-white"><p className="text-sm text-slate-300">Gesamt</p><p className="text-3xl font-bold">{money(activeDayTotal)}</p></div></CardContent></Card></div>}{currentUser.role !== 'bakery' && activeTab === 'kinder' && <Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-6"><h2 className="mb-4 text-2xl font-bold">Kinder verwalten</h2><div className="mb-6 grid gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 md:grid-cols-2"><Input value={newChildName} onChange={(event) => setNewChildName(event.target.value)} placeholder="Name des Kindes" className="rounded-xl bg-white" /><select value={newChildSchoolId} onChange={(event) => setNewChildSchoolId(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Schule auswählen</option>{schoolOptions.map((school) => <option key={school.id} value={school.id}>{school.name} · {school.bakeryName}</option>)}</select><Input value={newChildClassName} onChange={(event) => setNewChildClassName(event.target.value)} placeholder="Klasse, z. B. 3A" className="rounded-xl bg-white" /><Input value={newChildAllergies} onChange={(event) => setNewChildAllergies(event.target.value)} placeholder="Allergien / keine" className="rounded-xl bg-white" /><div className="md:col-span-2"><Button onClick={addChild} className="rounded-xl"><Icon name="plus" className="mr-1 h-4 w-4" /> Kind hinzufügen</Button></div></div><div className="grid gap-4 md:grid-cols-2">{children.map((child) => <div key={child.id} className="rounded-2xl border bg-white p-5"><h3 className="text-lg font-bold">{child.name}</h3><p className="text-slate-500">{child.school}</p><p className="mt-2 text-sm">{child.className} · Allergien: {child.allergies}</p></div>)}</div></CardContent></Card>}{currentUser.role !== 'bakery' && activeTab === 'statistiken' && <div className="space-y-6"><div className="grid gap-4 md:grid-cols-4"><StatCard label="Bestellungen" value={parentOrderStats.count} hint="bisher erfasst" icon="basket" /><StatCard label="Bezahlt" value={money(parentOrderStats.paidTotal)} hint="bereits bestätigt" icon="payment" /><StatCard label="Offen" value={money(parentOrderStats.openTotal)} hint="noch zu bezahlen" icon="mail" /><StatCard label="Kinder" value={children.length} hint="im Account" icon="user" /></div><Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-6"><h2 className="mb-4 text-2xl font-bold">Meine Bestellungen</h2><div className="space-y-3">{completedOrders.map((order) => <div key={order.id} className="rounded-2xl border bg-white p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-bold">{order.child} · {order.day}</p><p className="text-sm text-slate-500">{order.payment} · {money(order.total)}</p>{order.paymentReference && <p className="mt-2 font-mono text-xs text-slate-600">{order.paymentReference}</p>}</div><span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${order.status === 'bezahlt' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{order.status}</span></div></div>)}</div></CardContent></Card></div>}{activeTab === 'schule' && <div className="space-y-6"><section className="bakery-print-header overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 p-4 text-white shadow-lg sm:rounded-[2rem] sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-bold"><Icon name="school" /> Bäckerei-Dashboard</div><span className={`rounded-full px-3 py-1 text-xs font-black ${activeDeadlineOpen ? 'bg-white/15 text-white' : 'bg-white text-emerald-700'}`}>{activeDeadlineOpen ? 'Vorläufige Produktionsmenge' : '🔒 Produktionsmenge fix'}</span></div><h2 className="mt-3 text-2xl font-black tracking-tight sm:mt-4 sm:text-3xl md:text-4xl">Produktion für {activeDay}, {formatDeliveryDate(activeDay, bakeryWeekOffset)}</h2><p className="mt-2 max-w-2xl text-sm text-emerald-50 sm:text-base">Alles, was für die Vorbereitung und Ausgabe benötigt wird – Mengen, Kinder, Klassen und Allergiehinweise auf einen Blick.</p></div><div className="flex flex-col gap-3 lg:items-end"><div className="no-print flex items-center gap-2"><button type="button" onClick={async () => { const next = bakeryWeekOffset - 1; setBakeryWeekOffset(next); await loadBakeryData(currentUser, next); }} className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/25">← Vorherige Woche</button><span className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold text-white">Woche {formatDeliveryDate('Montag', bakeryWeekOffset)} – {formatDeliveryDate('Freitag', bakeryWeekOffset)}</span><button type="button" onClick={async () => { const next = bakeryWeekOffset + 1; setBakeryWeekOffset(next); await loadBakeryData(currentUser, next); }} className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/25">Nächste Woche →</button></div><div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:flex-wrap lg:overflow-visible">{weekdays.map((day) => <button key={day} onClick={() => setActiveDay(day)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold transition sm:px-4 sm:text-sm ${activeDay === day ? 'bg-white text-emerald-700 shadow-sm' : 'bg-white/15 text-white hover:bg-white/25'}`}>{day}</button>)}</div></div></div></section><div className="bakery-stats grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5"><StatCard label="Bestellungen" value={bakeryOrderCount} hint={`${activeDay}, ${formatDeliveryDate(activeDay, bakeryWeekOffset)}`} icon="orders" tone="violet" /><StatCard label="Produkte gesamt" value={bakeryProductCount} hint="zu produzieren" icon="basket" tone="emerald" /><StatCard label="Allergiehinweise" value={bakeryAllergyRows.length} hint="bitte beachten" icon="warning" tone="orange" /><StatCard label="Standorte" value={bakerySchoolCount} hint="Schule / Ausgabe" icon="school" tone="blue" /><StatCard label="Bestellwert" value={money(bakeryRevenue)} hint="Demo-Übersicht" icon="euro" tone="slate" /></div>{bakeryAllergyRows.length > 0 && <Card className="bakery-allergy-card rounded-[1.75rem] border-0 bg-amber-50 shadow-sm ring-1 ring-amber-200"><CardContent className="p-6"><div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-xl">⚠️</span><div className="min-w-0"><h3 className="text-xl font-black text-amber-950">Allergien & besondere Hinweise</h3><p className="mt-1 text-sm text-amber-800">Diese Bestellungen bitte bei der Vorbereitung besonders prüfen.</p><div className="mt-4 flex flex-wrap gap-2">{bakeryAllergyRows.map(({ child }) => <span key={child.id} className="rounded-full bg-white px-3 py-2 text-sm font-bold text-amber-900 shadow-sm ring-1 ring-amber-200">{child.name} · {child.className}: {child.allergies}</span>)}</div></div></div></CardContent></Card>}<div className="bakery-main-grid grid gap-6 xl:grid-cols-[1fr_1.35fr]"><Card className="bakery-production-card rounded-[1.5rem] border-0 shadow-sm ring-1 ring-slate-200 sm:rounded-[1.75rem]"><CardContent className="p-4 sm:p-6"><div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-wide text-emerald-600">Produktion</p><h3 className="text-2xl font-black">Mengen je Produkt</h3></div><span className="rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">{bakeryProductCount} Stück</span></div><div className="space-y-3">{productSummary.length ? productSummary.map((row, index) => <div key={row.product} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white font-black text-slate-500 shadow-sm">{index + 1}</span><p className="font-extrabold text-slate-900">{row.product}</p></div><span className="rounded-xl bg-slate-950 px-4 py-2 text-lg font-black text-white">{row.quantity}×</span></div>) : <p className="rounded-2xl bg-slate-50 p-5 text-slate-500">Keine Produkte für diesen Tag.</p>}</div></CardContent></Card><Card className="bakery-commission-card rounded-[1.5rem] border-0 shadow-sm ring-1 ring-slate-200 sm:rounded-[1.75rem]"><CardContent className="p-4 sm:p-6"><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold uppercase tracking-wide text-indigo-600">Kommissionierung</p><h3 className="text-2xl font-black">Bestellungen nach Kind</h3></div><div className="flex gap-2"><Button onClick={printBakeryList} variant="outline" className="rounded-xl">🖨️ PDF / Drucken</Button>{currentUser.role === 'admin' && !isGuestMode && <Button onClick={sendProductionListToBakery} disabled={isSaving} className="rounded-xl">✉️ An Bäckerei senden</Button>}</div></div><div className="space-y-3">{bakeryDetails.length ? bakeryDetails.map((detail, index) => { const issueKey = `${getDeliveryDateForWeek(activeDay, bakeryWeekOffset)}::${detail.childId}`; const isIssued = Boolean(issuedChildren[issueKey]); return <div key={`${detail.childName}-${index}`} className={`rounded-2xl border p-4 shadow-sm transition ${isIssued ? 'border-emerald-300 bg-emerald-50/70' : 'border-slate-200 bg-white'}`}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="text-lg font-black">{detail.childName}</p><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">{detail.className}</span>{detail.allergies && detail.allergies.toLowerCase() !== 'keine' && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800">⚠ {detail.allergies}</span>}{isIssued && <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-black text-white">✓ Ausgegeben</span>}</div><p className="mt-1 text-sm font-medium text-slate-500">{detail.school}</p></div><div className="flex items-center gap-2"><span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-700">{detail.items.length} Stück</span><Button type="button" onClick={() => toggleIssued(detail.childId)} disabled={isSaving} variant={isIssued ? 'default' : 'outline'} className={`no-print rounded-xl ${isIssued ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''}`}>{isIssued ? '✓ Ausgegeben' : 'Ausgeben'}</Button></div></div><div className="mt-4 flex flex-wrap gap-2">{summarizeItemNames(detail.items).map((item) => <span key={item.name} className={`rounded-xl px-3 py-2 text-sm font-bold ring-1 ${isIssued ? 'bg-white text-emerald-800 ring-emerald-200' : 'bg-emerald-50 text-emerald-800 ring-emerald-100'}`}>{item.quantity > 1 ? `${item.quantity}× ` : ''}{item.name}</span>)}</div></div>; }) : <p className="rounded-2xl bg-slate-50 p-5 text-slate-500">Keine Bestellungen für diesen Tag.</p>}</div></CardContent></Card></div><Card className="no-print rounded-[1.75rem] border-0 bg-slate-950 text-white shadow-sm"><CardContent className="p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-sm font-bold uppercase tracking-wide text-emerald-300">Ablauf in der Praxis</p><h3 className="mt-1 text-2xl font-black">Vom Auftrag bis zur Ausgabe</h3><p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">Nach Ablauf der Bestellfrist erhält die Bäckerei eine feste Produktionsmenge. Bei der Kommissionierung sieht sie Kind, Klasse und Allergiehinweise; anschließend kann die Liste gedruckt oder digital verwendet werden.</p></div>{isGuestMode && <span className="rounded-2xl bg-violet-500/20 px-4 py-3 text-sm font-bold text-violet-100 ring-1 ring-violet-400/30">🧪 Demo – keine echten Daten werden versendet</span>}</div></CardContent></Card></div>}{currentUser.role === 'admin' && activeTab === 'admin' && <div className="space-y-6"><div className="grid gap-4 md:grid-cols-4"><StatCard label="Admin-Umsatz" value={money(paidRevenue + openRevenue)} hint="inkl. offener Zahlungen" icon="chart" /><StatCard label="Offene Zahlungen" value={adminTodoSummary.openPayments} hint={money(openRevenue)} icon="payment" /><StatCard label="Produktion heute" value={adminTodoSummary.productionItems} hint={`Artikel für ${activeDay}`} icon="basket" /><StatCard label="Offene E-Mails" value={adminTodoSummary.emailsOpen} hint={`Admin: ${ADMIN_EMAIL}`} icon="mail" /></div><Card className="rounded-2xl border-0 shadow-sm ring-1 ring-slate-200"><CardContent className="p-6"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold uppercase tracking-wide text-orange-600">Onboarding</p><h2 className="text-2xl font-black">Neue Bäckerei-Anträge</h2><p className="mt-1 text-sm text-slate-500">Hier werden ausschließlich neue Bäckereien geprüft. Schul-Anträge werden darunter separat verwaltet.</p></div><span className="w-fit rounded-full bg-orange-100 px-3 py-1 text-sm font-black text-orange-800">{pendingBakeryApplications.length} offen</span></div><div className="mt-5 space-y-4">{pendingBakeryApplications.length ? pendingBakeryApplications.map((application: any) => { const schoolRequests = pendingSchoolRequests.filter((request: any) => request.bakery_id === application.bakery_id); const loadingBakery = adminApprovalLoadingId === `bakery:${application.bakery_id}`; return <div key={application.bakery_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="text-xl font-black">🥐 {application.bakery_name}</p><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800">Freigabe ausstehend</span></div>{application.legal_name && <p className="mt-1 text-sm font-semibold text-slate-600">{application.legal_name}</p>}<div className="mt-3 grid gap-1 text-sm text-slate-600"><p><span className="font-semibold text-slate-800">E-Mail:</span> {application.email || '–'}</p><p><span className="font-semibold text-slate-800">Telefon:</span> {application.phone || '–'}</p><p><span className="font-semibold text-slate-800">Adresse:</span> {application.address || '–'}</p><p><span className="font-semibold text-slate-800">MwSt.-Nr.:</span> {application.vat_number || '–'}</p></div></div><div className="flex flex-wrap gap-2"><Button type="button" onClick={() => approveBakeryApplication(application.bakery_id)} disabled={Boolean(adminApprovalLoadingId)} className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">{loadingBakery ? 'Speichere...' : 'Bäckerei freigeben'}</Button><Button type="button" variant="outline" onClick={() => rejectBakeryApplication(application.bakery_id)} disabled={Boolean(adminApprovalLoadingId)} className="rounded-xl border-red-200 text-red-700 hover:bg-red-50">Ablehnen</Button></div></div></div>; }) : <div className="rounded-2xl bg-emerald-50 p-5 text-sm font-semibold text-emerald-800">✓ Aktuell gibt es keine offenen Bäckerei-Anträge.</div>}</div></CardContent></Card><Card className="rounded-2xl border-0 shadow-sm ring-1 ring-slate-200"><CardContent className="p-6"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold uppercase tracking-wide text-indigo-600">Schulen</p><h2 className="text-2xl font-black">Offene Schul-Anträge</h2><p className="mt-1 text-sm text-slate-500">Schulvorschläge werden unabhängig von der Bäckerei-Freigabe geprüft.</p></div><span className="w-fit rounded-full bg-indigo-100 px-3 py-1 text-sm font-black text-indigo-800">{pendingSchoolRequests.length} offen</span></div><div className="mt-5 space-y-3">{pendingSchoolRequests.length ? pendingSchoolRequests.map((request: any) => { const loadingSchool = adminApprovalLoadingId === `school:${request.id}`; const matchingBakery = pendingBakeryApplications.find((application: any) => application.bakery_id === request.bakery_id); const bakeryName = request.bakeries?.name || matchingBakery?.bakery_name || 'Bäckerei'; return <div key={request.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="text-lg font-black">🏫 {request.school_name}</p><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800">Freigabe ausstehend</span></div><p className="mt-2 text-sm text-slate-600"><span className="font-semibold text-slate-800">Bäckerei:</span> {bakeryName}</p><p className="mt-1 text-sm text-slate-600"><span className="font-semibold text-slate-800">Ort / Adresse:</span> {[request.address, request.city].filter(Boolean).join(', ') || 'Keine Adresse angegeben'}</p></div><div className="flex flex-wrap gap-2"><Button type="button" onClick={() => approveSchoolRequestAdmin(request.id)} disabled={Boolean(adminApprovalLoadingId)} className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">{loadingSchool ? 'Speichere...' : 'Schule freigeben'}</Button><Button type="button" variant="outline" onClick={() => rejectSchoolRequestAdmin(request.id)} disabled={Boolean(adminApprovalLoadingId)} className="rounded-xl border-red-200 text-red-700 hover:bg-red-50">Ablehnen</Button></div></div>; }) : <div className="rounded-2xl bg-emerald-50 p-5 text-sm font-semibold text-emerald-800">✓ Aktuell gibt es keine offenen Schul-Anträge.</div>}</div></CardContent></Card><Card className="rounded-2xl border-0 bg-gradient-to-r from-emerald-50 to-orange-50 shadow-sm"><CardContent className="p-6"><h2 className="text-2xl font-bold">Heute zu erledigen</h2><div className="mt-4 grid gap-3 md:grid-cols-3"><div className="rounded-2xl bg-white p-4"><p className="text-sm text-slate-500">Zahlungen prüfen</p><p className="mt-1 text-xl font-bold">{adminTodoSummary.openPayments} offen</p></div><div className="rounded-2xl bg-white p-4"><p className="text-sm text-slate-500">Bäckerei informieren</p><p className="mt-1 text-xl font-bold">{adminTodoSummary.productionItems} Artikel</p></div><div className="rounded-2xl bg-white p-4"><p className="text-sm text-slate-500">Reminder</p><Button onClick={() => sendReminderEmail('deadline_reminder')} disabled={isSaving} className="mt-2 rounded-xl">Frist-Reminder senden</Button></div></div></CardContent></Card><Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-6"><div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><h2 className="text-2xl font-bold">Zahlungen verwalten</h2><p className="mt-1 text-sm text-slate-500">Suche nach Verwendungszweck, Kind, Eltern-Mail, Status oder Zahlungsart.</p></div><div className="w-full md:w-96"><label className="text-sm font-semibold text-slate-600">Suche</label><Input value={adminOrderSearch} onChange={(event) => setAdminOrderSearch(event.target.value)} placeholder="z. B. PAUSE-..., Lena, offen" className="mt-2 rounded-xl" /></div></div><div className="mb-3 flex flex-col gap-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between"><div className="flex gap-2"><Button variant={adminFilter === 'alle' ? 'default' : 'outline'} onClick={() => setAdminFilter('alle')}>Alle</Button><Button variant={adminFilter === 'offen' ? 'default' : 'outline'} onClick={() => setAdminFilter('offen')}>Offen</Button><Button variant={adminFilter === 'bezahlt' ? 'default' : 'outline'} onClick={() => setAdminFilter('bezahlt')}>Bezahlt</Button></div><span>{filteredAdminOrders.length} von {completedOrders.length} Bestellungen</span></div><div className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-100 text-slate-600"><tr><th className="p-4">Bestellung</th><th className="p-4">Kind</th><th className="p-4">E-Mail</th><th className="p-4">Zahlung</th><th className="p-4">Referenz</th><th className="p-4">Status</th><th className="p-4">Aktion</th></tr></thead><tbody>{filteredAdminOrders.length ? filteredAdminOrders.map((order) => <tr key={order.id} className="border-t"><td className="p-4 font-semibold">{order.id}</td><td className="p-4">{order.child}</td><td className="p-4">{order.parentEmail}</td><td className="p-4">{order.payment} · {money(order.total)}</td><td className="p-4 font-mono text-xs">{order.paymentReference || '–'}</td><td className="p-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${order.status === 'bezahlt' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{order.status}</span></td><td className="p-4">{order.status === 'offen' ? <div className="flex flex-col gap-2"><Button onClick={() => markPaid(order.id)} variant="outline" className="rounded-xl">Als bezahlt markieren</Button><Button onClick={() => sendReminderEmail('payment_reminder', order)} variant="outline" className="rounded-xl">Zahlungs-Reminder</Button></div> : '–'}</td></tr>) : <tr><td className="p-4 text-slate-500" colSpan={7}>Keine Bestellung gefunden.</td></tr>}</tbody></table></div></CardContent></Card><Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-6"><h2 className="mb-4 text-2xl font-bold">Menü verwalten</h2><div className="mb-6 grid gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 md:grid-cols-[1.2fr_0.7fr_1fr_1.4fr_auto]"><Input value={newProduct.name} onChange={(event) => setNewProduct((prev) => ({ ...prev, name: event.target.value }))} placeholder="Produktname" className="rounded-xl" /><Input value={newProduct.price} onChange={(event) => setNewProduct((prev) => ({ ...prev, price: event.target.value }))} placeholder="Preis z. B. 3,20" className="rounded-xl" /><Input value={newProduct.tags} onChange={(event) => setNewProduct((prev) => ({ ...prev, tags: event.target.value }))} placeholder="Tags, z. B. vegan" className="rounded-xl" /><Input value={newProduct.desc} onChange={(event) => setNewProduct((prev) => ({ ...prev, desc: event.target.value }))} placeholder="Beschreibung" className="rounded-xl" /><Button onClick={addProduct} disabled={isSaving} className="rounded-xl">Hinzufügen</Button></div><div className="space-y-3">{menuProducts.map((product) => <div key={product.id} className="rounded-2xl border bg-white p-4"><p className="font-bold">{product.name} · {money(product.price)}</p><p className="text-sm text-slate-500">{product.desc}</p></div>)}</div></CardContent></Card><Card className="rounded-2xl border-0 shadow-sm"><CardContent className="p-6"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-2xl font-bold">Produktionsliste für die Bäckerei</h2><p className="text-slate-500">Zusammenfassung für {activeDay}.</p></div><div className="flex flex-wrap gap-2"><Button onClick={printBakeryList} variant="outline" className="rounded-xl">PDF / Drucken</Button></div></div><div className="overflow-hidden rounded-2xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-100 text-slate-600"><tr><th className="p-4">Produkt</th><th className="p-4">Menge</th></tr></thead><tbody>{productSummary.length ? productSummary.map((row) => <tr key={row.product} className="border-t"><td className="p-4 font-semibold">{row.product}</td><td className="p-4">{row.quantity}</td></tr>) : <tr><td className="p-4 text-slate-500" colSpan={2}>Keine Produkte für diesen Tag.</td></tr>}</tbody></table></div></CardContent></Card></div>}</motion.div></main></div></div></div>;
}
