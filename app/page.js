"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import {
  getCustomers,
  addCustomer as dbAddCustomer,
  deleteCustomer as dbDeleteCustomer,
  getOilProducts,
  addOilProduct as dbAddOilProduct,
  deleteOilProduct as dbDeleteOilProduct,
  getPersonnel,
  addPersonnel as dbAddPersonnel,
  deletePersonnel as dbDeletePersonnel,
  getTransactions,
  addTransaction as dbAddTransaction,
  deleteTransaction as dbDeleteTransaction,
  getShiftReports,
  addShiftReport as dbAddShiftReport,
  deleteShiftReport as dbDeleteShiftReport,
  createDailyBackup,
} from "./services/database";
import { motion } from "framer-motion";
import { Lock, LogOut, Users, Wallet, CreditCard, FileText, Plus, Trash2, Search, Fuel, UserPlus, ReceiptText, Package } from "lucide-react";

const DEFAULT_BANKS = ["Ziraat POS", "İş Bankası POS", "Garanti POS", "Yapı Kredi POS", "Akbank POS", "Diğer POS"];
const ADMIN_USER = "admin";
const ADMIN_PASS = "admin";

function money(value) {
  return Number(value || 0).toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
}

function numberValue(value) {
  const n = Number(String(value || "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function newLine() {
  return { id: Date.now() + Math.random(), description: "", amount: "" };
}

function newOilSaleLine() {
  return { id: Date.now() + Math.random(), productId: "", qty: "" };
}

function emptyStaffAccount(personnelId = "") {
  return {
    id: Date.now() + Math.random(),
    personnelId,
    incomeItems: [newLine()],
    expenseItems: [newLine()],
    oilSales: [newOilSaleLine()],
    cashDelivered: "",
    currentSaleCustomerId: "",
    currentSaleAmount: "",
    currentCollectionCustomerId: "",
    currentCollectionAmount: "",
    banks: Object.fromEntries(DEFAULT_BANKS.map((b) => [b, ""])),
  };
}

function loadSaved(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocal(key, value) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export default function CetinPetrolPanel() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [login, setLogin] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [active, setActive] = useState("vardiya");
  const [activeStaffIndex, setActiveStaffIndex] = useState(0);

  const [personnel, setPersonnel] = useState(() => loadSaved("cetin_personnel", [
    { id: 1, name: "Personel 1", active: true },
    { id: 2, name: "Personel 2", active: true },
    { id: 3, name: "Personel 3", active: true },
  ]));
  const [newPersonnel, setNewPersonnel] = useState("");

const [oilProducts, setOilProducts] = useState([]);
  const [oilForm, setOilForm] = useState({ name: "", price: "" });

  const [customers, setCustomers] = useState(() => loadSaved("cetin_customers", []));
  useEffect(() => {
  async function fetchCustomers() {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("id", { ascending: false });

    if (!error && data) {
      setCustomers(data);
    }
  }

  fetchCustomers();
}, []);
  const [customerForm, setCustomerForm] = useState({ name: "", phone: "", plate: "", note: "" });
  const [customerSearch, setCustomerSearch] = useState("");

  const [transactions, setTransactions] = useState(() => loadSaved("cetin_transactions", []));
  const [shiftHistory, setShiftHistory] = useState(() => loadSaved("cetin_shiftHistory", []));

  const today = new Date().toISOString().slice(0, 10);
  const [shift, setShift] = useState(() => loadSaved("cetin_currentShift", {
    date: today,
    staffAccounts: [emptyStaffAccount("1"), emptyStaffAccount("2"), emptyStaffAccount("3")],
  }));

useEffect(() => {
  async function loadDatabase() {
    const [
      customersData,
      oilProductsData,
      personnelData,
      transactionsData,
      shiftReportsData,
    ] = await Promise.all([
      getCustomers(),
      getOilProducts(),
      getPersonnel(),
      getTransactions(),
      getShiftReports(),
    ]);

    if (customersData) setCustomers(customersData);
    setOilProducts(oilProductsData || []);
    if (personnelData.length) setPersonnel(personnelData);
    if (transactionsData) setTransactions(transactionsData);
    if (shiftReportsData) setShiftHistory(shiftReportsData);

    await createDailyBackup({
      personnel: personnelData,
      customers: customersData,
      transactions: transactionsData,
      oil_products: oilProductsData,
      shift_reports: shiftReportsData,
    });
  }

  loadDatabase();
}, []);

  function getOilProduct(productId) {
    return oilProducts.find((p) => String(p.id) === String(productId));
  }

  function getOilLineTotal(line) {
    const product = getOilProduct(line.productId);
    return numberValue(product?.price) * numberValue(line.qty);
  }

  const staffSummaries = useMemo(() => {
    return shift.staffAccounts.map((account) => {
      const person = personnel.find((p) => String(p.id) === String(account.personnelId));
      const cardTotal = Object.values(account.banks).reduce((sum, value) => sum + numberValue(value), 0);
      const manualIncome = account.incomeItems.reduce((sum, item) => sum + numberValue(item.amount), 0);
      const oilIncome = account.oilSales.reduce((sum, item) => {
        const product = oilProducts.find((p) => String(p.id) === String(item.productId));
        return sum + numberValue(product?.price) * numberValue(item.qty);
      }, 0);
      const incomeAmount = manualIncome + oilIncome;
      const expenseAmount = account.expenseItems.reduce((sum, item) => sum + numberValue(item.amount), 0);
      const cashDelivered = numberValue(account.cashDelivered);
      const currentSale = numberValue(account.currentSaleAmount);
      const currentCollection = numberValue(account.currentCollectionAmount);
      const expectedCash = incomeAmount - cardTotal - currentSale + currentCollection - expenseAmount;
      const cashDifference = cashDelivered - expectedCash;
      return { ...account, personnelName: person?.name || "Personel seçilmedi", cardTotal, manualIncome, oilIncome, incomeAmount, cashDelivered, currentSale, currentCollection, expenses: expenseAmount, expectedCash, cashDifference };
    });
  }, [shift.staffAccounts, personnel, oilProducts]);

  const totals = useMemo(() => {
    return staffSummaries.reduce((acc, s) => {
      acc.incomeAmount += s.incomeAmount;
      acc.oilIncome += s.oilIncome;
      acc.cardTotal += s.cardTotal;
      acc.currentSale += s.currentSale;
      acc.currentCollection += s.currentCollection;
      acc.expenses += s.expenses;
      acc.expectedCash += s.expectedCash;
      acc.cashDelivered += s.cashDelivered;
      acc.cashDifference += s.cashDifference;
      return acc;
    }, { incomeAmount: 0, oilIncome: 0, cardTotal: 0, currentSale: 0, currentCollection: 0, expenses: 0, expectedCash: 0, cashDelivered: 0, cashDifference: 0 });
  }, [staffSummaries]);

  const customerBalances = useMemo(() => {
    const map = {};
    customers.forEach((c) => (map[c.id] = 0));
    transactions.forEach((t) => {
      const customerId = t.customer_id || t.customerId;
if (!map[customerId]) map[customerId] = 0;
if (t.type === "borc") map[customerId] += Number(t.amount || 0);
if (t.type === "tahsilat") map[customerId] -= Number(t.amount || 0);
    });
    return map;
  }, [customers, transactions]);

  const filteredCustomers = customers.filter((c) => `${c.name} ${c.phone} ${c.plate}`.toLowerCase().includes(customerSearch.toLowerCase()));

  function handleLogin(e) {
    e.preventDefault();
    if (login.username === ADMIN_USER && login.password === ADMIN_PASS) {
      setLoggedIn(true);
      setLoginError("");
      return;
    }
    setLoginError("Kullanıcı adı veya şifre hatalı.");
  }

  function updateStaffAccount(id, field, value) {
    setShift((s) => ({ ...s, staffAccounts: s.staffAccounts.map((a) => (a.id === id ? { ...a, [field]: value } : a)) }));
  }

  function updateStaffBank(id, bank, value) {
    setShift((s) => ({ ...s, staffAccounts: s.staffAccounts.map((a) => (a.id === id ? { ...a, banks: { ...a.banks, [bank]: value } } : a)) }));
  }

  function addStaffAccount() {
    const account = emptyStaffAccount();
    setShift((s) => ({ ...s, staffAccounts: [...s.staffAccounts, account] }));
    setActiveStaffIndex(shift.staffAccounts.length);
  }

  function removeStaffAccount(id) {
    setShift((s) => ({ ...s, staffAccounts: s.staffAccounts.filter((a) => a.id !== id) }));
    setActiveStaffIndex(0);
  }

  function addLine(accountId, type) {
    setShift((s) => ({ ...s, staffAccounts: s.staffAccounts.map((a) => {
      if (a.id !== accountId) return a;
      const key = type === "income" ? "incomeItems" : "expenseItems";
      return { ...a, [key]: [...a[key], newLine()] };
    }) }));
  }

  function updateLine(accountId, type, lineId, field, value) {
    setShift((s) => ({ ...s, staffAccounts: s.staffAccounts.map((a) => {
      if (a.id !== accountId) return a;
      const key = type === "income" ? "incomeItems" : "expenseItems";
      return { ...a, [key]: a[key].map((line) => (line.id === lineId ? { ...line, [field]: value } : line)) };
    }) }));
  }

  function deleteLine(accountId, type, lineId) {
    setShift((s) => ({ ...s, staffAccounts: s.staffAccounts.map((a) => {
      if (a.id !== accountId) return a;
      const key = type === "income" ? "incomeItems" : "expenseItems";
      const remaining = a[key].filter((line) => line.id !== lineId);
      return { ...a, [key]: remaining.length ? remaining : [newLine()] };
    }) }));
  }

  function addOilSale(accountId) {
    setShift((s) => ({ ...s, staffAccounts: s.staffAccounts.map((a) => a.id === accountId ? { ...a, oilSales: [...a.oilSales, newOilSaleLine()] } : a) }));
  }

  function updateOilSale(accountId, lineId, field, value) {
    setShift((s) => ({ ...s, staffAccounts: s.staffAccounts.map((a) => a.id === accountId ? { ...a, oilSales: a.oilSales.map((line) => line.id === lineId ? { ...line, [field]: value } : line) } : a) }));
  }

  function deleteOilSale(accountId, lineId) {
    setShift((s) => ({ ...s, staffAccounts: s.staffAccounts.map((a) => {
      if (a.id !== accountId) return a;
      const remaining = a.oilSales.filter((line) => line.id !== lineId);
      return { ...a, oilSales: remaining.length ? remaining : [newOilSaleLine()] };
    }) }));
  }

  async function addPersonnel() {
  if (!newPersonnel.trim()) return;

  const saved = await dbAddPersonnel({
    name: newPersonnel.trim(),
    active: true,
  });

  if (saved) {
    setPersonnel((p) => [saved, ...p]);
    setNewPersonnel("");
  }
}

async function deletePersonnel(id) {
  await dbDeletePersonnel(id);
  setPersonnel((p) => p.filter((x) => x.id !== id));
}

  async function deleteTransaction(id) {
  await dbDeleteTransaction(id);
  setTransactions((t) => t.filter((x) => x.id !== id));
}
  function togglePersonnel(id) { setPersonnel((p) => p.map((x) => (x.id === id ? { ...x, active: !x.active } : x))); }

  async function addOilProduct() {
  if (!oilForm.name.trim()) return;

  const newProduct = {
    name: oilForm.name.trim(),
    price: numberValue(oilForm.price),
  };

  const saved = await dbAddOilProduct(newProduct);

  if (saved) {
    setOilProducts((p) => [saved, ...p]);
    setOilForm({ name: "", price: "" });
  }
}

  function updateOilProduct(id, field, value) {
    setOilProducts((p) => p.map((x) => x.id === id ? { ...x, [field]: value } : x));
  }

  async function deleteOilProduct(id) {
  await dbDeleteOilProduct(id);

  setOilProducts((p) => p.filter((x) => x.id !== id));
  setShift((s) => ({
    ...s,
    staffAccounts: s.staffAccounts.map((a) => ({
      ...a,
      oilSales: a.oilSales.map((line) =>
        String(line.productId) === String(id) ? { ...line, productId: "" } : line
      ),
    })),
  }));
}

async function addCustomer() {
  if (!customerForm.name.trim()) return;

  const saved = await dbAddCustomer({
    name: customerForm.name.trim(),
    phone: customerForm.phone,
    plate: customerForm.plate,
    note: customerForm.note,
  });

  if (saved) {
    setCustomers((c) => [saved, ...c]);
    setCustomerForm({ name: "", phone: "", plate: "", note: "" });
  }
}

async function addCustomer() {
  if (!customerForm.name.trim()) return;

  const saved = await dbAddCustomer({
    name: customerForm.name.trim(),
    phone: customerForm.phone,
    plate: customerForm.plate,
    note: customerForm.note,
  });

  if (saved) {
    setCustomers((c) => [saved, ...c]);
    setCustomerForm({ name: "", phone: "", plate: "", note: "" });
  }
}

  async function deleteCustomer(id) {
  await dbDeleteCustomer(id);

  setCustomers((c) => c.filter((x) => x.id !== id));
  setTransactions((t) => t.filter((x) => String(x.customer_id) !== String(id)));
}


  async function addManualCustomerMove(customerId, type, amount, description) {
  const customer = customers.find((c) => String(c.id) === String(customerId));
  const value = numberValue(amount);
  if (!customer || value <= 0) return false;

  const saved = await dbAddTransaction({
    customer_id: Number(customerId),
    customer_name: customer.name,
    type,
    amount: value,
    description: description || (type === "borc" ? "Manuel borç eklendi" : "Manuel tahsilat düşüldü"),
    date: shift.date,
  });

  if (saved) {
    setTransactions((t) => [saved, ...t]);
    return true;
  }

  return false;
}

  async function addTransaction(type, customerId, amount, description = "", personName = "") {
  const value = numberValue(amount);
  if (!customerId || value <= 0) return false;

  const customer = customers.find((c) => String(c.id) === String(customerId));

  const saved = await dbAddTransaction({
    customer_id: Number(customerId),
    customer_name: customer?.name || "Cari",
    type,
    amount: value,
    description: personName ? `${description} - ${personName}` : description,
    date: shift.date,
  });

  if (saved) {
    setTransactions((t) => [saved, ...t]);
    return true;
  }

  return false;
}
  async function saveShift() {
  for (const s of staffSummaries) {
    if (s.currentSaleCustomerId && s.currentSale > 0) {
      await addTransaction("borc", s.currentSaleCustomerId, s.currentSale, "Vardiya cari satış / veresiye", s.personnelName);
    }

    if (s.currentCollectionCustomerId && s.currentCollection > 0) {
      await addTransaction("tahsilat", s.currentCollectionCustomerId, s.currentCollection, "Vardiya cari tahsilat", s.personnelName);
    }
  }

  const reportPayload = {
    date: shift.date,
    totals: { ...totals },
    staff: staffSummaries.map((s) => ({
      ...s,
      banks: { ...s.banks },
    })),
  };

  const saved = await dbAddShiftReport(reportPayload);

  if (saved) {
    setShiftHistory((h) => [saved, ...h]);
  }

  setShift((s) => ({
    ...s,
    staffAccounts: [emptyStaffAccount(), emptyStaffAccount(), emptyStaffAccount()],
  }));

  setActiveStaffIndex(0);
}
 async function deleteShiftReport(id) {
  await dbDeleteShiftReport(id);
  setShiftHistory((h) => h.filter((x) => x.id !== id));
}
  if (!loggedIn) {
    return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4"><motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-8"><div className="flex items-center gap-3 mb-8"><div className="w-12 h-12 rounded-2xl bg-blue-700 flex items-center justify-center shadow-lg shadow-blue-950/60"><Fuel className="w-7 h-7" /></div><div><h1 className="text-2xl font-bold tracking-tight">ÇETİN PETROL</h1><p className="text-slate-400 text-sm">Yönetim Paneli</p></div></div><form onSubmit={handleLogin} className="space-y-4"><Input label="Kullanıcı adı" value={login.username} onChange={(v) => setLogin({ ...login, username: v })} /><Input label="Şifre" type="password" value={login.password} onChange={(v) => setLogin({ ...login, password: v })} />{loginError && <p className="text-red-400 text-sm">{loginError}</p>}<button className="w-full rounded-2xl bg-blue-700 hover:bg-blue-600 transition px-4 py-3 font-semibold flex items-center justify-center gap-2"><Lock className="w-4 h-4" /> Giriş Yap</button></form></motion.div></div>;
  }

  const menu = [["vardiya", Wallet, "Vardiya"], ["cari", Users, "Cari Hesaplar"], ["yag", Package, "Yağ Cari"], ["personel", UserPlus, "Personeller"], ["rapor", FileText, "Raporlar"]];
  const activeAccount = shift.staffAccounts[activeStaffIndex] || shift.staffAccounts[0];
  const activeSummary = activeAccount ? staffSummaries.find((s) => s.id === activeAccount.id) : null;

  return <div className="min-h-screen bg-slate-950 text-white"><div className="flex">
    <aside className="hidden md:flex w-72 min-h-screen bg-slate-900 border-r border-slate-800 p-5 flex-col"><div className="flex items-center gap-3 mb-8"><div className="w-11 h-11 rounded-2xl bg-blue-700 flex items-center justify-center"><Fuel /></div><div><div className="font-black text-xl leading-5">ÇETİN PETROL</div><div className="text-slate-400 text-sm">Yönetim Paneli</div></div></div><nav className="space-y-2 flex-1">{menu.map(([key, Icon, label]) => <button key={key} onClick={() => setActive(key)} className={`w-full rounded-2xl px-4 py-3 flex items-center gap-3 text-left transition ${active === key ? "bg-blue-700 text-white" : "text-slate-300 hover:bg-slate-800"}`}><Icon className="w-5 h-5" /> {label}</button>)}</nav><button onClick={() => setLoggedIn(false)} className="rounded-2xl px-4 py-3 flex items-center gap-3 text-slate-300 hover:bg-slate-800"><LogOut className="w-5 h-5" /> Çıkış</button></aside>
    <main className="flex-1 p-3 md:p-8 pb-24"><div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950 border-t border-slate-800 p-2 flex gap-2 overflow-x-auto">{menu.map(([key, Icon, label]) => <button key={key} onClick={() => setActive(key)} className={`rounded-2xl px-4 py-3 flex items-center gap-2 whitespace-nowrap ${active === key ? "bg-blue-700" : "bg-slate-900"}`}><Icon className="w-4 h-4" /> {label}</button>)}</div><header className="mb-6"><h2 className="text-3xl font-black">{active === "vardiya" ? "Sekmeli Vardiya Hesabı" : active === "cari" ? "Cari Hesaplar" : active === "yag" ? "Yağ Cari / Ürün Fiyatları" : active === "personel" ? "Personel Yönetimi" : "Raporlar"}</h2><p className="text-slate-400 mt-1">Yağ ürünlerini fiyatıyla kaydet, vardiyada personel satışı olarak seç.</p></header>

      {active === "vardiya" && <div className="space-y-5"><section className="rounded-3xl bg-slate-900 border border-slate-800 p-5"><div className="grid md:grid-cols-5 gap-4 items-end"><Input label="Vardiya Tarihi" type="date" value={shift.date} onChange={(v) => setShift({ ...shift, date: v })} /><div className="md:col-span-4 rounded-2xl bg-slate-950 border border-slate-800 p-4 grid md:grid-cols-5 gap-3"><SummaryBox label="Toplam Gelir" value={money(totals.incomeAmount)} /><SummaryBox label="Yağ Satışı" value={money(totals.oilIncome)} /><SummaryBox label="Toplam Kart" value={money(totals.cardTotal)} /><SummaryBox label="Beklenen Nakit" value={money(totals.expectedCash)} /><SummaryBox label="Toplam Fark" value={money(totals.cashDifference)} negative={totals.cashDifference < 0} /></div></div></section>
      <section className="rounded-3xl bg-slate-900 border border-slate-800 p-5"><div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4"><h3 className="font-black text-xl">Personel Hesapları</h3><button onClick={addStaffAccount} className="rounded-2xl bg-blue-700 hover:bg-blue-600 px-4 py-3 font-bold flex items-center gap-2"><Plus className="w-5 h-5" /> Personel Hesabı Ekle</button></div><div className="flex gap-2 overflow-x-auto pb-3 mb-4">{staffSummaries.map((s, index) => <button key={s.id} onClick={() => setActiveStaffIndex(index)} className={`min-w-[190px] rounded-2xl p-4 text-left border transition ${activeStaffIndex === index ? "bg-blue-700 border-blue-500" : "bg-slate-950 border-slate-800 hover:border-slate-600"}`}><div className="text-xs opacity-80">Personel {index + 1}</div><div className="font-black truncate">{s.personnelName}</div><div className={`mt-2 text-sm font-bold ${s.cashDifference < 0 ? "text-red-200" : "text-emerald-200"}`}>{money(s.cashDifference)}</div></button>)}</div>
      {activeAccount && <div className="rounded-3xl bg-slate-950 border border-slate-800 p-5"><div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-5"><div><div className="font-black text-2xl">{activeSummary?.personnelName}</div><div className="text-sm text-slate-400">Seçili personelin gelir, yağ, kart, cari ve gider hesabı.</div></div><button onClick={() => removeStaffAccount(activeAccount.id)} className="rounded-xl bg-red-950/60 text-red-300 px-4 py-2 hover:bg-red-900 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Bu Hesabı Sil</button></div><div className="grid md:grid-cols-2 gap-4 mb-6"><Select label="Personel" value={activeAccount.personnelId} onChange={(v) => updateStaffAccount(activeAccount.id, "personnelId", v)} options={[{ value: "", label: "Personel seç" }, ...personnel.filter(p => p.active).map(p => ({ value: p.id, label: p.name }))]} /><Input label="Teslim Ettiği Nakit" value={activeAccount.cashDelivered} onChange={(v) => updateStaffAccount(activeAccount.id, "cashDelivered", v)} placeholder="0" /></div><LineSection title="Gelirler" subtitle="Akaryakıt, AdBlue veya manuel gelirleri ayrı satır gir." account={activeAccount} type="income" items={activeAccount.incomeItems} addLine={addLine} updateLine={updateLine} deleteLine={deleteLine} total={activeSummary?.manualIncome} />
      <OilSaleSection account={activeAccount} items={activeAccount.oilSales} oilProducts={oilProducts} addOilSale={addOilSale} updateOilSale={updateOilSale} deleteOilSale={deleteOilSale} getOilProduct={getOilProduct} getOilLineTotal={getOilLineTotal} total={activeSummary?.oilIncome} />
      <h4 className="font-bold mb-3 flex items-center gap-2"><CreditCard className="w-5 h-5" /> Kart / POS</h4><div className="grid md:grid-cols-3 gap-4 mb-6">{DEFAULT_BANKS.map((bank) => <Input key={bank} label={bank} value={activeAccount.banks[bank]} onChange={(v) => updateStaffBank(activeAccount.id, bank, v)} placeholder="0" />)}</div><h4 className="font-bold mb-3 flex items-center gap-2"><ReceiptText className="w-5 h-5" /> Cari / Veresiye</h4><div className="grid md:grid-cols-4 gap-4 mb-6"><Select label="Cari Satış Kişi" value={activeAccount.currentSaleCustomerId} onChange={(v) => updateStaffAccount(activeAccount.id, "currentSaleCustomerId", v)} options={[{ value: "", label: "Cari seç" }, ...customers.map(c => ({ value: c.id, label: c.name }))]} /><Input label="Cari Satış Tutarı" value={activeAccount.currentSaleAmount} onChange={(v) => updateStaffAccount(activeAccount.id, "currentSaleAmount", v)} placeholder="0" /><Select label="Cari Tahsilat Kişi" value={activeAccount.currentCollectionCustomerId} onChange={(v) => updateStaffAccount(activeAccount.id, "currentCollectionCustomerId", v)} options={[{ value: "", label: "Cari seç" }, ...customers.map(c => ({ value: c.id, label: c.name }))]} /><Input label="Cari Tahsilat Tutarı" value={activeAccount.currentCollectionAmount} onChange={(v) => updateStaffAccount(activeAccount.id, "currentCollectionAmount", v)} placeholder="0" /></div><LineSection title="Giderler" subtitle="Yemek, masraf gibi giderleri ayrı satır gir." account={activeAccount} type="expense" items={activeAccount.expenseItems} addLine={addLine} updateLine={updateLine} deleteLine={deleteLine} total={activeSummary?.expenses} /><div className="grid md:grid-cols-6 gap-3"><SummaryBox label="Gelir" value={money(activeSummary?.incomeAmount)} /><SummaryBox label="Yağ" value={money(activeSummary?.oilIncome)} /><SummaryBox label="Kart" value={money(activeSummary?.cardTotal)} /><SummaryBox label="Cari" value={money(activeSummary?.currentSale)} /><SummaryBox label="Beklenen" value={money(activeSummary?.expectedCash)} /><SummaryBox label="Açık / Fazla" value={money(activeSummary?.cashDifference)} negative={(activeSummary?.cashDifference || 0) < 0} /></div></div>}</section>
      <section className="rounded-3xl bg-slate-900 border border-slate-800 p-5"><h3 className="font-black text-xl mb-4">Vardiya Sonuç Listesi</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-slate-400"><tr className="border-b border-slate-800"><th className="text-left py-3">Personel</th><th className="text-right py-3">Gelir</th><th className="text-right py-3">Yağ</th><th className="text-right py-3">Kart</th><th className="text-right py-3">Cari Satış</th><th className="text-right py-3">Tahsilat</th><th className="text-right py-3">Gider</th><th className="text-right py-3">Beklenen</th><th className="text-right py-3">Teslim</th><th className="text-right py-3">Açık/Fazla</th></tr></thead><tbody>{staffSummaries.map((s) => <tr key={s.id} className="border-b border-slate-900"><td className="py-3 font-bold">{s.personnelName}</td><td className="text-right">{money(s.incomeAmount)}</td><td className="text-right">{money(s.oilIncome)}</td><td className="text-right">{money(s.cardTotal)}</td><td className="text-right">{money(s.currentSale)}</td><td className="text-right">{money(s.currentCollection)}</td><td className="text-right">{money(s.expenses)}</td><td className="text-right font-bold">{money(s.expectedCash)}</td><td className="text-right font-bold">{money(s.cashDelivered)}</td><td className={`text-right font-black ${s.cashDifference < 0 ? "text-red-300" : "text-emerald-300"}`}>{money(s.cashDifference)}</td></tr>)}</tbody></table></div><button onClick={saveShift} className="mt-5 w-full rounded-2xl bg-blue-700 hover:bg-blue-600 px-4 py-3 font-bold">Vardiyayı Kaydet</button></section></div>}

      {active === "yag" && <section className="rounded-3xl bg-slate-900 border border-slate-800 p-5 max-w-4xl"><h3 className="font-black text-xl mb-4">Yağ Cari / Ürün Fiyatları</h3><div className="grid md:grid-cols-[1fr_180px_120px] gap-3 items-end mb-6"><Input label="Ürün Adı" value={oilForm.name} onChange={(v) => setOilForm({ ...oilForm, name: v })} placeholder="Örn: 10W40 Motor Yağı" /><Input label="Satış Fiyatı" value={oilForm.price} onChange={(v) => setOilForm({ ...oilForm, price: v })} placeholder="0" /><button onClick={addOilProduct} className="rounded-2xl bg-blue-700 hover:bg-blue-600 px-4 py-3 font-bold flex justify-center gap-2"><Plus className="w-5 h-5" /> Ekle</button></div><div className="space-y-3">{oilProducts.length === 0 && <Empty text="Henüz yağ ürünü eklenmedi." />}{oilProducts.map((p) => <div key={p.id} className="grid md:grid-cols-[1fr_180px_48px] gap-3 items-end rounded-2xl bg-slate-950 border border-slate-800 p-4"><Input label="Ürün Adı" value={p.name} onChange={(v) => updateOilProduct(p.id, "name", v)} /><Input label="Fiyat" value={p.price} onChange={(v) => updateOilProduct(p.id, "price", v)} /><button onClick={() => deleteOilProduct(p.id)} className="rounded-xl bg-red-950/60 text-red-300 h-12 flex items-center justify-center hover:bg-red-900"><Trash2 className="w-4 h-4" /></button></div>)}</div></section>}

      {active === "cari" && <CariPanel customerForm={customerForm} setCustomerForm={setCustomerForm} addCustomer={addCustomer} customerSearch={customerSearch} setCustomerSearch={setCustomerSearch} filteredCustomers={filteredCustomers} customerBalances={customerBalances} deleteCustomer={deleteCustomer} transactions={transactions} addManualCustomerMove={addManualCustomerMove} deleteTransaction={deleteTransaction} />}
      {active === "personel" && <PersonelPanel personnel={personnel} newPersonnel={newPersonnel} setNewPersonnel={setNewPersonnel} addPersonnel={addPersonnel} togglePersonnel={togglePersonnel} deletePersonnel={deletePersonnel} />}
      {active === "rapor" && <RaporPanel shiftHistory={shiftHistory} transactions={transactions} deleteShiftReport={deleteShiftReport} />}
    </main></div></div>;
}

function OilSaleSection({ account, items, oilProducts, addOilSale, updateOilSale, deleteOilSale, getOilProduct, getOilLineTotal, total }) {
  return <div className="mb-6"><div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3"><div><h4 className="font-bold text-lg flex items-center gap-2"><Package className="w-5 h-5" /> Yağ Satışları</h4><p className="text-sm text-slate-500">Ürün seç, adet yaz; tutar otomatik gelir hesabına eklenir.</p></div><button onClick={() => addOilSale(account.id)} className="rounded-2xl bg-slate-800 hover:bg-slate-700 px-4 py-2 font-bold flex items-center gap-2"><Plus className="w-4 h-4" /> Yağ Satırı Ekle</button></div><div className="space-y-3">{items.map((item, index) => { const product = getOilProduct(item.productId); const totalLine = getOilLineTotal(item); return <div key={item.id} className="grid md:grid-cols-[1fr_120px_160px_48px] gap-3 items-end rounded-2xl bg-slate-900 border border-slate-800 p-3"><Select label={`${index + 1}. Ürün`} value={item.productId} onChange={(v) => updateOilSale(account.id, item.id, "productId", v)} options={[{ value: "", label: "Yağ seç" }, ...oilProducts.map((p) => ({ value: p.id, label: `${p.name} - ${money(p.price)}` }))]} /><Input label="Adet" value={item.qty} onChange={(v) => updateOilSale(account.id, item.id, "qty", v)} placeholder="0" /><div className="rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 h-[50px]"><div className="text-xs text-slate-500">Tutar</div><div className="font-black">{money(totalLine)}</div></div><button onClick={() => deleteOilSale(account.id, item.id)} className="rounded-xl bg-red-950/60 text-red-300 h-12 flex items-center justify-center hover:bg-red-900"><Trash2 className="w-4 h-4" /></button></div>})}</div><div className="mt-3 text-right text-sm text-slate-300">Yağ Satışı Toplamı: <span className="font-black text-white">{money(total)}</span></div></div>;
}

function LineSection({ title, subtitle, account, type, items, addLine, updateLine, deleteLine, total }) {
  return <div className="mb-6"><div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3"><div><h4 className="font-bold text-lg">{title}</h4><p className="text-sm text-slate-500">{subtitle}</p></div><button onClick={() => addLine(account.id, type)} className="rounded-2xl bg-slate-800 hover:bg-slate-700 px-4 py-2 font-bold flex items-center gap-2"><Plus className="w-4 h-4" /> Satır Ekle</button></div><div className="space-y-3">{items.map((item, index) => <div key={item.id} className="grid md:grid-cols-[1fr_180px_48px] gap-3 items-end rounded-2xl bg-slate-900 border border-slate-800 p-3"><Input label={`${index + 1}. Açıklama`} value={item.description} onChange={(v) => updateLine(account.id, type, item.id, "description", v)} placeholder={type === "income" ? "Akaryakıt, diğer gelir..." : "Yemek, masraf..."} /><Input label="Tutar" value={item.amount} onChange={(v) => updateLine(account.id, type, item.id, "amount", v)} placeholder="0" /><button onClick={() => deleteLine(account.id, type, item.id)} className="rounded-xl bg-red-950/60 text-red-300 h-12 flex items-center justify-center hover:bg-red-900"><Trash2 className="w-4 h-4" /></button></div>)}</div><div className="mt-3 text-right text-sm text-slate-300">{title} Toplamı: <span className="font-black text-white">{money(total)}</span></div></div>;
}

function CariPanel({ customerForm, setCustomerForm, addCustomer, customerSearch, setCustomerSearch, filteredCustomers, customerBalances, deleteCustomer, transactions, addManualCustomerMove, deleteTransaction }) {
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [moveForm, setMoveForm] = useState({ type: "borc", amount: "", description: "" });
  const selectedCustomer = filteredCustomers.find((c) => String(c.id) === String(selectedCustomerId));
  const customerMoves = transactions.filter((t) => String(t.customerId) === String(selectedCustomerId));

  function saveMove() {
    const ok = addManualCustomerMove(selectedCustomerId, moveForm.type, moveForm.amount, moveForm.description);
    if (ok) setMoveForm({ type: "borc", amount: "", description: "" });
  }

  return <div className="grid xl:grid-cols-3 gap-5">
    <section className="rounded-3xl bg-slate-900 border border-slate-800 p-5"><h3 className="font-black text-xl mb-4">Yeni Cari Ekle</h3><div className="space-y-3"><Input label="Ad Soyad / Firma" value={customerForm.name} onChange={(v) => setCustomerForm({ ...customerForm, name: v })} /><Input label="Telefon" value={customerForm.phone} onChange={(v) => setCustomerForm({ ...customerForm, phone: v })} /><Input label="Plaka" value={customerForm.plate} onChange={(v) => setCustomerForm({ ...customerForm, plate: v })} /><Input label="Not" value={customerForm.note} onChange={(v) => setCustomerForm({ ...customerForm, note: v })} /><button onClick={addCustomer} className="w-full rounded-2xl bg-blue-700 hover:bg-blue-600 px-4 py-3 font-bold flex justify-center gap-2"><Plus className="w-5 h-5" /> Cari Ekle</button></div></section>

    <section className="xl:col-span-2 rounded-3xl bg-slate-900 border border-slate-800 p-5"><div className="flex items-center gap-3 mb-4"><Search className="w-5 h-5 text-slate-400" /><input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Cari ara..." className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 outline-none focus:border-blue-500" /></div><div className="space-y-3">{filteredCustomers.length === 0 && <Empty text="Henüz cari hesap eklenmedi." />}{filteredCustomers.map((c) => <button key={c.id} onClick={() => setSelectedCustomerId(String(c.id))} className={`w-full rounded-2xl border p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-left ${String(c.id) === String(selectedCustomerId) ? "bg-blue-950/60 border-blue-600" : "bg-slate-950 border-slate-800"}`}><div><div className="font-bold text-lg">{c.name}</div><div className="text-sm text-slate-400">{c.phone || "Telefon yok"} {c.plate ? `• ${c.plate}` : ""}</div>{c.note && <div className="text-sm text-slate-500 mt-1">{c.note}</div>}</div><div className="flex items-center gap-3"><div className="text-right"><div className="text-xs text-slate-400">Bakiye</div><div className={`font-black text-xl ${(customerBalances[c.id] || 0) > 0 ? "text-red-300" : "text-emerald-300"}`}>{money(customerBalances[c.id] || 0)}</div></div><span onClick={(e) => { e.stopPropagation(); deleteCustomer(c.id); }} className="rounded-xl bg-red-950/60 text-red-300 p-3 hover:bg-red-900"><Trash2 className="w-4 h-4" /></span></div></button>)}</div></section>

    <section className="xl:col-span-3 rounded-3xl bg-slate-900 border border-slate-800 p-5">
      <h3 className="font-black text-xl mb-4">Cari Hareket Ekle / Çıkar</h3>
      {!selectedCustomer && <Empty text="Hareket girmek için yukarıdan bir cari seç." />}
      {selectedCustomer && <div className="space-y-5">
        <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"><div><div className="text-sm text-slate-400">Seçili Cari</div><div className="font-black text-2xl">{selectedCustomer.name}</div></div><div className="text-right"><div className="text-sm text-slate-400">Güncel Bakiye</div><div className={`font-black text-2xl ${(customerBalances[selectedCustomer.id] || 0) > 0 ? "text-red-300" : "text-emerald-300"}`}>{money(customerBalances[selectedCustomer.id] || 0)}</div></div></div>
        <div className="grid md:grid-cols-[180px_180px_1fr_140px] gap-3 items-end">
          <Select label="Hareket Tipi" value={moveForm.type} onChange={(v) => setMoveForm({ ...moveForm, type: v })} options={[{ value: "borc", label: "Borç Ekle" }, { value: "tahsilat", label: "Tahsilat / Ödeme Düş" }]} />
          <Input label="Tutar" value={moveForm.amount} onChange={(v) => setMoveForm({ ...moveForm, amount: v })} placeholder="0" />
          <Input label="Açıklama" value={moveForm.description} onChange={(v) => setMoveForm({ ...moveForm, description: v })} placeholder="Örn: dışardan ödeme, düzeltme..." />
          <button onClick={saveMove} className="rounded-2xl bg-blue-700 hover:bg-blue-600 px-4 py-3 font-bold">Kaydet</button>
        </div>
        <div className="space-y-3">
          {customerMoves.length === 0 && <Empty text="Bu cari için hareket yok." />}
          {customerMoves.map((t) => <div key={t.id} className="rounded-2xl bg-slate-950 border border-slate-800 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"><div><div className="font-bold">{t.type === "borc" ? "Borç" : "Tahsilat"}</div><div className="text-sm text-slate-400">{t.date} • {t.description}</div></div><div className="flex items-center gap-3"><div className={`font-black text-xl ${t.type === "borc" ? "text-red-300" : "text-emerald-300"}`}>{t.type === "borc" ? "+" : "-"}{money(t.amount)}</div><button onClick={() => deleteTransaction(t.id)} className="rounded-xl bg-red-950/60 text-red-300 p-3 hover:bg-red-900"><Trash2 className="w-4 h-4" /></button></div></div>)}
        </div>
      </div>}
    </section>
  </div>;
}

function PersonelPanel({ personnel, newPersonnel, setNewPersonnel, addPersonnel, togglePersonnel, deletePersonnel }) {
  return <section className="rounded-3xl bg-slate-900 border border-slate-800 p-5 max-w-3xl"><h3 className="font-black text-xl mb-4">Personel Ekle / Sil</h3><div className="flex gap-3 mb-5"><input value={newPersonnel} onChange={(e) => setNewPersonnel(e.target.value)} placeholder="Personel adı" className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 outline-none focus:border-blue-500" /><button onClick={addPersonnel} className="rounded-2xl bg-blue-700 hover:bg-blue-600 px-5 font-bold"><Plus /></button></div><div className="space-y-3">{personnel.map((p) => <div key={p.id} className="rounded-2xl bg-slate-950 border border-slate-800 p-4 flex items-center justify-between"><div><div className="font-bold">{p.name}</div><div className={`text-sm ${p.active ? "text-emerald-300" : "text-slate-500"}`}>{p.active ? "Aktif" : "Pasif"}</div></div><div className="flex gap-2"><button onClick={() => togglePersonnel(p.id)} className="rounded-xl bg-slate-800 px-3 py-2 text-sm">{p.active ? "Pasif Yap" : "Aktif Yap"}</button><button onClick={() => deletePersonnel(p.id)} className="rounded-xl bg-red-950/60 text-red-300 p-3 hover:bg-red-900"><Trash2 className="w-4 h-4" /></button></div></div>)}</div></section>;
}

function RaporPanel({ shiftHistory, transactions, deleteShiftReport }) {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState(today);

  const filteredShifts = shiftHistory.filter((h) => {
    if (startDate && h.date < startDate) return false;
    if (endDate && h.date > endDate) return false;
    return true;
  });

  const reportTotals = filteredShifts.reduce((acc, h) => {
    acc.incomeAmount += h.totals?.incomeAmount || 0;
    acc.oilIncome += h.totals?.oilIncome || 0;
    acc.cardTotal += h.totals?.cardTotal || 0;
    acc.currentSale += h.totals?.currentSale || 0;
    acc.currentCollection += h.totals?.currentCollection || 0;
    acc.expenses += h.totals?.expenses || 0;
    acc.expectedCash += h.totals?.expectedCash || 0;
    acc.cashDelivered += h.totals?.cashDelivered || 0;
    acc.cashDifference += h.totals?.cashDifference || 0;
    return acc;
  }, { incomeAmount: 0, oilIncome: 0, cardTotal: 0, currentSale: 0, currentCollection: 0, expenses: 0, expectedCash: 0, cashDelivered: 0, cashDifference: 0 });

  function printReport() {
    window.print();
  }

  return <div className="space-y-5">
    <section className="rounded-3xl bg-slate-900 border border-slate-800 p-5 print:bg-white print:text-black print:border-0">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 print:hidden">
        <div className="grid md:grid-cols-2 gap-3">
          <Input label="Başlangıç Tarihi" type="date" value={startDate} onChange={setStartDate} />
          <Input label="Bitiş Tarihi" type="date" value={endDate} onChange={setEndDate} />
        </div>
        <button onClick={printReport} className="rounded-2xl bg-blue-700 hover:bg-blue-600 px-5 py-3 font-bold">Yazdır / PDF Al</button>
      </div>

      <div id="printable-report" className="mt-5 print:mt-0">
        <div className="hidden print:block mb-6">
          <h1 className="text-2xl font-black">ÇETİN PETROL VARDİYA RAPORU</h1>
          <p>Tarih Aralığı: {startDate || "İlk kayıt"} - {endDate || "Son kayıt"}</p>
        </div>

        <div className="grid md:grid-cols-4 gap-3 mb-5 print:grid-cols-4">
          <SummaryBox label="Toplam Gelir" value={money(reportTotals.incomeAmount)} />
          <SummaryBox label="Yağ Satışı" value={money(reportTotals.oilIncome)} />
          <SummaryBox label="Toplam Kart" value={money(reportTotals.cardTotal)} />
          <SummaryBox label="Toplam Fark" value={money(reportTotals.cashDifference)} negative={reportTotals.cashDifference < 0} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse print:text-xs">
            <thead className="text-slate-400 print:text-black">
              <tr className="border-b border-slate-700 print:border-black">
                <th className="text-left py-3 print:border print:p-2">Tarih</th>
                <th className="text-left py-3 print:border print:p-2">Personel</th>
                <th className="text-right py-3 print:border print:p-2">Gelir</th>
                <th className="text-right py-3 print:border print:p-2">Yağ</th>
                <th className="text-right py-3 print:border print:p-2">Kart</th>
                <th className="text-right py-3 print:border print:p-2">Cari Satış</th>
                <th className="text-right py-3 print:border print:p-2">Tahsilat</th>
                <th className="text-right py-3 print:border print:p-2">Gider</th>
                <th className="text-right py-3 print:border print:p-2">Beklenen</th>
                <th className="text-right py-3 print:border print:p-2">Teslim</th>
                <th className="text-right py-3 print:border print:p-2">Açık/Fazla</th>
              </tr>
            </thead>
            <tbody>
              {filteredShifts.length === 0 && <tr><td colSpan="11" className="py-6 text-center text-slate-500 print:border print:text-black">Seçilen tarihte vardiya kaydı yok.</td></tr>}
              {filteredShifts.flatMap((h) => h.staff.map((s, index) => (
                <tr key={`${h.id}-${s.id}`} className="border-b border-slate-900 print:border-black">
                  <td className="py-3 print:border print:p-2">
  {index === 0 && (
    <div className="flex items-center gap-2">
      <span>{h.date}</span>
      <button
        onClick={() => deleteShiftReport(h.id)}
        className="print:hidden rounded-lg bg-red-950/60 text-red-300 px-2 py-1 text-xs hover:bg-red-900"
      >
        Sil
      </button>
    </div>
  )}
</td>
                  <td className="py-3 font-bold print:border print:p-2">{s.personnelName}</td>
                  <td className="text-right print:border print:p-2">{money(s.incomeAmount)}</td>
                  <td className="text-right print:border print:p-2">{money(s.oilIncome)}</td>
                  <td className="text-right print:border print:p-2">{money(s.cardTotal)}</td>
                  <td className="text-right print:border print:p-2">{money(s.currentSale)}</td>
                  <td className="text-right print:border print:p-2">{money(s.currentCollection)}</td>
                  <td className="text-right print:border print:p-2">{money(s.expenses)}</td>
                  <td className="text-right font-bold print:border print:p-2">{money(s.expectedCash)}</td>
                  <td className="text-right font-bold print:border print:p-2">{money(s.cashDelivered)}</td>
                  <td className={`text-right font-black print:border print:p-2 ${s.cashDifference < 0 ? "text-red-300 print:text-black" : "text-emerald-300 print:text-black"}`}>{money(s.cashDifference)}</td>
                </tr>
              )))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-700 font-black print:border-black">
                <td className="py-3 print:border print:p-2" colSpan="2">GENEL TOPLAM</td>
                <td className="text-right print:border print:p-2">{money(reportTotals.incomeAmount)}</td>
                <td className="text-right print:border print:p-2">{money(reportTotals.oilIncome)}</td>
                <td className="text-right print:border print:p-2">{money(reportTotals.cardTotal)}</td>
                <td className="text-right print:border print:p-2">{money(reportTotals.currentSale)}</td>
                <td className="text-right print:border print:p-2">{money(reportTotals.currentCollection)}</td>
                <td className="text-right print:border print:p-2">{money(reportTotals.expenses)}</td>
                <td className="text-right print:border print:p-2">{money(reportTotals.expectedCash)}</td>
                <td className="text-right print:border print:p-2">{money(reportTotals.cashDelivered)}</td>
                <td className="text-right print:border print:p-2">{money(reportTotals.cashDifference)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>

    <section className="rounded-3xl bg-slate-900 border border-slate-800 p-5 print:hidden">
      <h3 className="font-black text-xl mb-4">Cari Hareketleri</h3>
      <div className="space-y-3">{transactions.length === 0 && <Empty text="Henüz cari hareket yok." />}{transactions.map((t) => <div key={t.id} className="rounded-2xl bg-slate-950 border border-slate-800 p-4 flex justify-between gap-3"><div><div className="font-bold">{t.customerName}</div><div className="text-sm text-slate-400">{t.date} • {t.description}</div></div><div className={`font-black ${t.type === "borc" ? "text-red-300" : "text-emerald-300"}`}>{t.type === "borc" ? "+" : "-"}{money(t.amount)}</div></div>)}</div>
    </section>
  </div>;
}

function Input({ label, value, onChange, placeholder = "", type = "text" }) {
  return <label className="block"><span className="text-sm text-slate-300">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 outline-none focus:border-blue-500" /></label>;
}

function Select({ label, value, onChange, options }) {
  return <label className="block"><span className="text-sm text-slate-300">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 outline-none focus:border-blue-500">{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
}

function SummaryBox({ label, value, negative }) {
  return <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3"><div className="text-xs text-slate-400">{label}</div><div className={`font-black text-lg ${negative ? "text-red-300" : "text-white"}`}>{value}</div></div>;
}

function Empty({ text }) {
  return <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-center text-slate-500">{text}</div>;
}
