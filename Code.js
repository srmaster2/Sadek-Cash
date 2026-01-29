const MASTER_EMAIL = 'srmaster2@gmail.com';

function doGet() {
  const user = Session.getActiveUser();
  const email = user.getEmail();
  
  // التحقق من تسجيل الدخول في Supabase
  try {
    const { data, error } = fetchFromSupabase('users', { email: `eq.${email}` });
    if (error || !data || data.length === 0) {
      // إذا لم يكن مسجلاً، افتح صفحة تسجيل الدخول
      return HtmlService.createHtmlOutputFromFile('login');
    }
  } catch (e) {
    // في حالة خطأ، افتح صفحة تسجيل الدخول
    return HtmlService.createHtmlOutputFromFile('login');
  }
  
  // إذا كان مسجلاً، افتح الصفحة الرئيسية
  return HtmlService.createHtmlOutputFromFile('index');
}

// جلب بيانات المستخدم الحالي (محول لـ Supabase)
function getUserSessionData() {
  const user = Session.getActiveUser();
  const email = user.getEmail();
  
  // جلب الدور من Supabase بدلاً من Sheets
  const { data, error } = fetchFromSupabase('users', { email: `eq.${email}` });
  if (error || !data || data.length === 0) {
    return { role: 'GUEST', email: email, isMaster: false };
  }
  
  const userData = data[0];
  return {
    role: userData.role,
    isMaster: userData.is_master,
    email: email,
    name: userData.name
  };
}

// دوال Supabase المساعدة (محولة لـ GAS)
function initializeSupabase() {
  const SUPABASE_URL = 'https://hgzyjfsbqxqwzbdtuekh.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_cYK-ahWLrRzvrf_OC9K8DQ_aWlzObD5';
  return { url: SUPABASE_URL, key: SUPABASE_KEY };
}

function fetchFromSupabase(table, filters = {}) {
  try {
    const config = initializeSupabase();
    let url = `${config.url}/rest/v1/${table}`;
    const params = new URLSearchParams();
    Object.keys(filters).forEach(key => params.append(key, filters[key]));
    if (params.toString()) url += '?' + params.toString();
    
    const response = UrlFetchApp.fetch(url, {
      method: 'GET',
      headers: {
        'apikey': config.key,
        'Authorization': `Bearer ${config.key}`,
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true
    });
    
    const result = JSON.parse(response.getContentText());
    return response.getResponseCode() === 200 ? { data: result, error: null } : { data: null, error: result };
  } catch (error) {
    return { data: null, error: error.toString() };
  }
}

function insertToSupabase(table, data) {
  try {
    const config = initializeSupabase();
    const response = UrlFetchApp.fetch(`${config.url}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': config.key,
        'Authorization': `Bearer ${config.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      payload: JSON.stringify(data),
      muteHttpExceptions: true
    });
    
    const result = JSON.parse(response.getContentText());
    return response.getResponseCode() === 201 ? { success: true, data: result } : { success: false, error: result };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function updateSupabase(table, data, id) {
  try {
    const config = initializeSupabase();
    const response = UrlFetchApp.fetch(`${config.url}/rest/v1/${table}?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'apikey': config.key,
        'Authorization': `Bearer ${config.key}`,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(data),
      muteHttpExceptions: true
    });
    
    return response.getResponseCode() === 200 ? { success: true } : { success: false, error: response.getContentText() };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// دوال الإدارة (محولة لـ Supabase)
function getAllAccountsData() {
  const role = getUserSessionData().role;
  if (role !== 'ADMIN') return [];
  
  const { data, error } = fetchFromSupabase('accounts');
  if (error) return [];
  
  return data.map((acc, i) => ({
    row: acc.id,
    name: acc.name,
    balance: acc.balance,
    lo: acc.daily_limit,
    li: acc.daily_limit,
    lm: acc.monthly_limit,
    isPinned: acc.is_pinned,
    tag: acc.tag || "",
    color: acc.color || ""
  })).filter(acc => !acc.deleted);
}

function getWalletsList() {
  const { data, error } = fetchFromSupabase('accounts', { type: 'eq.wallet' });
  if (error) return [];
  
  return data.filter(acc => !acc.deleted).map(acc => `${acc.name} (${acc.balance})`);
}

function getWalletInfo(walletName) {
  const { data, error } = fetchFromSupabase('accounts', { name: `eq.${walletName}` });
  if (error || !data || data.length === 0) return { exists: false };
  
  const acc = data[0];
  return {
    exists: true,
    balance: acc.balance,
    availableInc: acc.monthly_limit - acc.used_month,
    availableOut: acc.daily_limit - acc.used_today,
    limitOut: acc.daily_limit,
    limitInc: acc.monthly_limit,
    isMonthRestricted: (acc.monthly_limit - acc.used_month) < (acc.daily_limit - acc.used_today),
    remainingMonth: acc.monthly_limit - acc.used_month
  };
}

function editAccountDetails(id, name, lo, li, lm) {
  if (getUserSessionData().role !== 'ADMIN') return { success: false, msg: "⛔" };
  
  const result = updateSupabase('accounts', { name, daily_limit: lo, monthly_limit: lm }, id);
  if (result.success) {
    logAdminOperation("تعديل حساب", `تم تعديل حدود ${name}`);
    return { success: true, msg: "✅ تم التعديل" };
  } else {
    return { success: false, msg: "❌ خطأ في التحديث" };
  }
}

function deleteAccount(id) {
  if (getUserSessionData().role !== 'ADMIN') return { success: false, msg: "⛔" };
  
  const result = updateSupabase('accounts', { deleted: true }, id);
  if (result.success) {
    logAdminOperation("حذف حساب", `تم حذف حساب ${id}`);
    return { success: true, msg: "🗑️ تم الحذف" };
  } else {
    return { success: false, msg: "❌ خطأ في الحذف" };
  }
}

// دوال العملاء (محولة لـ Supabase)
function getClientsData() {
  if (getUserSessionData().role !== 'ADMIN') return [];
  
  const { data, error } = fetchFromSupabase('clients');
  if (error) return [];
  
  return data.filter(cl => !cl.deleted).map((cl, i) => ({ row: cl.id, name: cl.name, phone: cl.phone, bal: cl.balance }));
}

function addNewClient(name, phone) {
  if (getUserSessionData().role !== 'ADMIN') return { success: false, msg: "⛔" };
  
  const result = insertToSupabase('clients', { name, phone, balance: 0 });
  if (result.success) {
    logAdminOperation("إضافة عميل", `تم إضافة ${name}`);
    return { success: true, msg: "✅ تم" };
  } else {
    return { success: false, msg: "❌ خطأ في الإضافة" };
  }
}

function editClientData(id, newName, newPhone, newBal) {
  if (getUserSessionData().role !== 'ADMIN') return { success: false, msg: "⛔" };
  
  const result = updateSupabase('clients', { name: newName, phone: newPhone, balance: newBal }, id);
  if (result.success) {
    return { success: true, msg: "✅ تم تعديل العميل" };
  } else {
    return { success: false, msg: "❌ خطأ في التحديث" };
  }
}

function deleteClientData(id) {
  if (getUserSessionData().role !== 'ADMIN') return { success: false, msg: "⛔" };
  
  const result = updateSupabase('clients', { deleted: true }, id);
  if (result.success) {
    logAdminOperation("حذف عميل", `تم حذف عميل ${id}`);
    return { success: true, msg: "🗑️ تم الحذف" };
  } else {
    return { success: false, msg: "❌ خطأ في الحذف" };
  }
}

// دوال العمليات (محولة لـ Supabase)
function getTransactionLogs() {
  const { data, error } = fetchFromSupabase('transactions', { order: 'created_at.desc', limit: '50' });
  if (error) return [];
  
  return data.filter(tx => !tx.deleted).map(tx => ({
    rowId: tx.id,
    date: tx.date,
    time: tx.time,
    type: tx.type,
    amount: tx.amount,
    comm: tx.commission,
    wallet: tx.account_name,
    client: tx.client_name,
    user: tx.user_name,
    note: tx.note,
    balanceAfter: tx.balance_after,
    isOut: tx.is_out
  }));
}

function processTransaction(data) {
  const user = getUserSessionData();
  if (user.role === 'GUEST') return { success: false, msg: "⛔ لا صلاحية" };
  
  // إدراج العملية في Supabase
  const txData = {
    type: data.type,
    amount: data.amount,
    commission: data.comm,
    account_name: data.wallet,
    client_name: data.client,
    user_email: user.email,
    user_name: user.name,
    note: data.note,
    is_out: data.type.includes('سحب') || data.type.includes('صادر')
  };
  
  const result = insertToSupabase('transactions', txData);
  if (result.success) {
    logAdminOperation("عملية جديدة", `${data.type} - ${data.amount}`);
    return { success: true, msg: "✅ تم بنجاح" };
  } else {
    return { success: false, msg: "❌ خطأ في الحفظ" };
  }
}

// دوال المستخدمين (محولة لـ Supabase)
function getUsersData() {
  if (getUserSessionData().role !== 'ADMIN') return [];
  
  const { data, error } = fetchFromSupabase('users');
  if (error) return [];
  
  return data.map((user, i) => ({
    row: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isMaster: user.is_master
  }));
}

function addNewUser(email, name, role) {
  if (getUserSessionData().role !== 'ADMIN') return { success: false, msg: "⛔" };
  
  const result = insertToSupabase('users', { 
    email: email.toLowerCase(), 
    name, 
    role: role.toUpperCase(),
    is_master: email.toLowerCase() === MASTER_EMAIL.toLowerCase()
  });
  
  if (result.success) {
    logAdminOperation("إضافة مستخدم", `تم إضافة ${name}`);
    return { success: true, msg: "✅ تم إضافة المستخدم" };
  } else {
    return { success: false, msg: "❌ خطأ في الإضافة" };
  }
}

function editUserRole(targetEmail, newRole) {
  if (getUserSessionData().role !== 'ADMIN') return { success: false, msg: "⛔" };
  
  const result = updateSupabase('users', { role: newRole }, targetEmail);
  if (result.success) {
    logAdminOperation("تعديل صلاحية", `تم تعديل ${targetEmail} إلى ${newRole}`);
    return { success: true, msg: `✅ تم تعديل الصلاحية إلى ${newRole}` };
  } else {
    return { success: false, msg: "❌ المستخدم غير موجود" };
  }
}

function removeUser(email) {
  if (getUserSessionData().role !== 'ADMIN') return { success: false, msg: "⛔" };
  
  const result = updateSupabase('users', { deleted: true }, email);
  if (result.success) {
    logAdminOperation("حذف مستخدم", `تم حذف ${email}`);
    return { success: true, msg: "🗑️ تم الحذف" };
  } else {
    return { success: false, msg: "❌ خطأ في الحذف" };
  }
}

// دوال السجلات (محولة لـ Supabase)
function getAdminLogs() {
  if (getUserSessionData().role !== 'ADMIN') return [];
  
  const { data, error } = fetchFromSupabase('logs', { order: 'created_at.desc' });
  if (error) return [];
  
  return data.map(log => ({
    date: Utilities.formatDate(new Date(log.created_at), Session.getScriptTimeZone(), "yyyy-MM-dd"),
    time: Utilities.formatDate(new Date(log.created_at), Session.getScriptTimeZone(), "hh:mm a"),
    action: log.action,
    details: log.details,
    user: log.user
  }));
}

function logAdminOperation(action, details) {
  const user = getUserSessionData();
  insertToSupabase('logs', {
    action,
    details,
    user: user.name || user.email
  });
}

// دوال التقارير (محولة لـ Supabase)
function getDashboardStats() {
  const user = getUserSessionData();
  if (user.role !== 'ADMIN' && user.role !== 'USER') return { success: false, error: "⛔ لا صلاحية" };
  
  const { data: accounts, error: accErr } = fetchFromSupabase('accounts');
  const { data: transactions, error: txErr } = fetchFromSupabase('transactions');
  const { data: clients, error: clErr } = fetchFromSupabase('clients');
  
  if (accErr || txErr || clErr) return { success: false, error: "خطأ في جلب البيانات" };
  
  // حساب الإحصائيات كما في الكود الأصلي
  let cashBal = 0, walletBal = 0, compBal = 0;
  let walletsList = [], compList = [];
  
  accounts.filter(acc => !acc.deleted).forEach(acc => {
    let name = acc.name;
    let bal = acc.balance;
    let limitOut = acc.daily_limit || 0;
    
    if (name.includes("الخزنة") || name.includes("الكاش")) {
      cashBal = bal;
    } else if (limitOut > 10000000) {
      compBal += bal;
      compList.push({ name, bal });
    } else {
      walletBal += bal;
      walletsList.push({
        name, bal, limDay: limitOut, usedDay: acc.used_today || 0,
        remDay: Math.max(0, limitOut - (acc.used_today || 0)),
        limMon: acc.monthly_limit || 0, usedMon: acc.used_month || 0,
        remMon: Math.max(0, (acc.monthly_limit || 0) - (acc.used_month || 0))
      });
    }
  });
  
  let clientsOweMe = 0, clientsHave = 0, clientsCardList = [];
  clients.filter(cl => !cl.deleted).forEach(cl => {
    let bal = cl.balance;
    clientsCardList.push({ name: cl.name, bal });
    if (bal < 0) clientsOweMe += Math.abs(bal);
    else clientsHave += bal;
  });
  
  let totalAvailable = cashBal + walletBal + compBal;
  let grandTotal = (totalAvailable + clientsOweMe) - clientsHave;
  
  let todayProfit = 0, monthProfit = 0, totalExp = 0;
  const now = new Date();
  const todayStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd");
  const monthStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM");
  
  transactions.filter(tx => !tx.deleted).forEach(tx => {
    let rowDate = new Date(tx.created_at);
    let dStr = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
    let mStr = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "yyyy-MM");
    let comm = tx.commission || 0;
    let type = tx.type;
    let amt = tx.amount;
    
    if (dStr === todayStr) todayProfit += comm;
    if (mStr === monthStr) monthProfit += comm;
    if (type.includes("مصروف")) totalExp += amt;
  });
  
  return {
    success: true,
    cash: cashBal, walletsTotal: walletBal, compTotal: compBal,
    totalAvailable, grandTotal, clientsOweMe, clientsHave,
    companies: compList, clientsCards: clientsCardList,
    dayProf: todayProfit, monProf: monthProfit, exp: totalExp, wallets: walletsList
  };
}

// دوال أخرى (محولة لـ Supabase)
function createNewWallet(name, type) {
  const result = insertToSupabase('accounts', {
    name, type: type.toLowerCase(), balance: 0, tag: type === 'Wallet' ? 'محفظة' : 'شركة'
  });
  
  if (result.success) {
    logAdminOperation("إضافة حساب", `تم إضافة ${name}`);
    return { success: true, msg: "✅ تم إضافة الحساب" };
  } else {
    return { success: false, msg: "❌ خطأ في الإضافة" };
  }
}

function getClientsList() {
  const { data, error } = fetchFromSupabase('clients');
  if (error) return [];
  
  return data.filter(cl => !cl.deleted).map(cl => cl.name);
}

function getClientBalanceByName(name) {
  const { data, error } = fetchFromSupabase('clients', { name: `eq.${name}` });
  if (error || !data || data.length === 0) return { status: "العميل غير مسجل", bal: 0 };
  
  const bal = data[0].balance;
  const status = bal < 0 ? `مدين بـ ${Math.abs(bal)} ج.م` : bal > 0 ? `له ${bal} ج.م` : "رصيد صفر";
  return { status, bal };
}

// دوال إضافية للتقارير (محولة لـ Supabase)
function getDailyClosingReport(fromDate, toDate) {
  const { data, error } = fetchFromSupabase('transactions', {
    created_at: `gte.${fromDate}T00:00:00,lte.${toDate}T23:59:59`
  });
  
  if (error) return { success: false };
  
  // حساب الإحصائيات
  let totalIn = 0, totalOut = 0, totalProfit = 0, usersStats = {}, topTransactions = [];
  
  data.filter(tx => !tx.deleted).forEach(tx => {
    if (tx.is_out) totalOut += tx.amount;
    else totalIn += tx.amount;
    totalProfit += tx.commission || 0;
    
    // إحصائيات المستخدمين
    if (!usersStats[tx.user_name]) usersStats[tx.user_name] = { profit: 0, opsCount: 0 };
    usersStats[tx.user_name].profit += tx.commission || 0;
    usersStats[tx.user_name].opsCount++;
    
    // أهم العمليات
    topTransactions.push({ type: tx.type, amount: tx.amount });
  });
  
  topTransactions.sort((a, b) => b.amount - a.amount);
  topTransactions = topTransactions.slice(0, 5);
  
  return {
    success: true,
    totalIn, totalOut, totalProfit, usersStats,
    topTransactions: topTransactions.map(t => ({ type: t.type, amount: t.amount }))
  };
}

function getWalletIntelligence(type) {
  const { data, error } = fetchFromSupabase('accounts', { type: `eq.${type.toLowerCase()}` });
  if (error) return [];
  
  return data.filter(acc => !acc.deleted).map(acc => ({
    name: acc.name,
    totalProfit: 0, // حساب من العمليات لاحقاً
    totalVol: acc.balance,
    txCount: 0 // حساب من العمليات لاحقاً
  }));
}

// دوال أخرى (محولة لـ Supabase)
function getBusyDaysData() {
  // حساب أيام العمل من العمليات
  const { data, error } = fetchFromSupabase('transactions');
  if (error) return { labels: [], counts: [], profits: [] };
  
  let days = {};
  data.filter(tx => !tx.deleted).forEach(tx => {
    const day = tx.date;
    if (!days[day]) days[day] = { count: 0, profit: 0 };
    days[day].count++;
    days[day].profit += tx.commission || 0;
  });
  
  const labels = Object.keys(days).sort();
  const counts = labels.map(d => days[d].count);
  const profits = labels.map(d => days[d].profit);
  
  return { labels, counts, profits };
}

function getPeakHoursData(dateFilter) {
  const { data, error } = fetchFromSupabase('transactions', dateFilter ? { date: `eq.${dateFilter}` } : {});
  if (error) return { success: false };
  
  let hours = {};
  data.filter(tx => !tx.deleted).forEach(tx => {
    const hour = tx.time.split(':')[0];
    hours[hour] = (hours[hour] || 0) + 1;
  });
  
  const labels = Object.keys(hours).sort();
  const values = labels.map(h => hours[h]);
  
  return { success: true, labels, values };
}

function getTopDatesLeaderboard() {
  const { data, error } = fetchFromSupabase('transactions');
  if (error) return [];
  
  let dates = {};
  data.filter(tx => !tx.deleted).forEach(tx => {
    const date = tx.date;
    dates[date] = (dates[date] || 0) + (tx.commission || 0);
  });
  
  return Object.entries(dates)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([date, profit]) => [date, profit]);
}

// دوال إضافية
function logCashInventory(data) {
  insertToSupabase('logs', {
    action: 'جرد نقدية',
    details: `السيستم: ${data.systemBal}, الفعلي: ${data.actualBal}, الفارق: ${data.diff}, الفئات: ${data.details}`,
    user: getUserSessionData().name
  });
}

function autoRollback(rowId, type, amount, wallet, comm, client) {
  if (getUserSessionData().role !== 'ADMIN') return { success: false, msg: "⛔ صلاحية المدير مطلوبة" };
  
  // عكس العملية
  const reverseAmount = -amount;
  const reverseComm = -comm;
  
  // تحديث الرصيد
  const { data: accData } = fetchFromSupabase('accounts', { name: `eq.${wallet}` });
  if (accData && accData.length > 0) {
    updateSupabase('accounts', { balance: accData[0].balance + reverseAmount }, accData[0].id);
  }
  
  // حذف السجل
  updateSupabase('transactions', { deleted: true }, rowId);
  
  logAdminOperation("تراجع عملية", `تم التراجع عن: ${type} (${amount})`);
  return { success: true, msg: "✅ تم التراجع بنجاح" };
}

function updateWalletAppearance(row, tag, color) {
  const result = updateSupabase('accounts', { tag, color }, row);
  return result.success ? { success: true } : { success: false };
}

function toggleWalletPin(row, currentState) {
  const result = updateSupabase('accounts', { is_pinned: !currentState }, row);
  return result.success ? { success: true, msg: "تم التحديث" } : { success: false, msg: "خطأ" };
}

function saveWalletTag(row, newTag) {
  const result = updateSupabase('accounts', { tag: newTag }, row);
  return result.success ? { success: true } : { success: false };
}

// دوال أخرى محولة
function getGlobalSyncKey() {
  return new Date().getTime().toString();
}

function triggerSyncUpdate() {
  // لا حاجة لها في Supabase
}

function initializeMissingSheets() {
  // لا حاجة لها في Supabase
  return { success: true, msg: "الجداول جاهزة في Supabase" };
}

function drawDashboardManual() {
  // لا حاجة لها في Supabase
  return { success: true, msg: "الداشبورد مباشر من Supabase" };
}