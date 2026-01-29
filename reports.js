// التقارير والإحصائيات

// حساب الإحصائيات الأساسية (مستخدم في أماكن بسيطة)
async function calculateStats() {
  const accounts = await loadAccounts();
  const transactions = await loadTransactions(1000);

  let stats = {
    totalBalance: 0,
    totalTransactions: transactions.length,
    totalProfit: 0
  };

  accounts.forEach(acc => {
    stats.totalBalance += Number(acc.balance) || 0;
  });

  transactions.forEach(tx => {
    stats.totalProfit += Number(tx.commission) || 0;
  });

  return stats;
}

// تقرير يومي
async function getDailyReport(date) {
  const { data, error } = await supabase
    .from(TABLES.transactions)
    .select('*')
    .gte('date', date)
    .lt('date', new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  if (error) return [];
  return data;
}

// تقرير شهري
async function getMonthlyReport(month, year) {
  const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from(TABLES.transactions)
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate);
  if (error) return [];
  return data;
}

// Dashboard Stats — تجميع شامل لأرقام الداشبورد من Supabase
async function getDashboardStats() {
  try {
    // 1. جلب الحسابات (الخزنة، المحافظ، الشركات) - كما هي في كودك
    const { data: accountsRaw, error: accErr } = await supabase.from(TABLES.accounts).select('*');
    if (accErr) throw accErr;

    const accounts = (accountsRaw || []).filter(a => !a.deleted);
    let cashBal = 0, walletBal = 0, compBal = 0;
    let breakdown = { fawry: 0, maksab: 0, moshtrayat: 0 };

    accounts.forEach(acc => {
      const name = (acc.name || '').toLowerCase().trim();
      const bal = Number(acc.balance) || 0;
      const limit = Number(acc.daily_limit || acc.limit_out || 0);

      if (name.includes('الخزنة') || name.includes('كاش') || name.includes('cash')) {
        cashBal += bal;
      } else if (limit >= 900000000 || name.includes('فوري') || name.includes('fawry') || name.includes('مكسب') || name.includes('maksab') || name.includes('مشتريات')) {
        compBal += bal;
        if (name.includes('فوري') || name.includes('fawry')) breakdown.fawry += bal;
        else if (name.includes('مكسب') || name.includes('maksab')) breakdown.maksab += bal;
        else if (name.includes('مشتريات')) breakdown.moshtrayat += bal;
      } else {
        walletBal += bal;
      }
    });

    // 2. جلب مديونيات العملاء - كما هي في كودك
    const { data: clients } = await supabase.from('clients').select('name, balance');
    let oweMe = 0, have = 0, clientsCards = [];
    (clients || []).forEach(c => {
      const b = Number(c.balance) || 0;
      if (b > 0) oweMe += b; 
      else if (b < 0) have += Math.abs(b);
      if (b !== 0) clientsCards.push({ name: c.name, balance: b });
    });

    // 3. تجهيز التواريخ
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const todayStr = `${d}/${m}/${y}`;
    const monthStr = `/${m}/${y}`;

    // --- 4. جلب "كل" عمليات الشهر (حل مشكلة الـ 10 آلاف صف) ---
    let allMonthTxs = [];
    let from = 0;
    let to = 999;
    let hasMore = true;

    while (hasMore) {
      const { data: part, error: txErr } = await supabase
        .from(TABLES.transactions)
        .select('commission, amount, type, date')
        .ilike('date', `%${monthStr}`)
        .range(from, to); // جلب البيانات على أجزاء 1000 بـ 1000

      if (txErr) throw txErr;
      if (!part || part.length === 0) {
        hasMore = false;
      } else {
        allMonthTxs = allMonthTxs.concat(part);
        if (part.length < 1000) hasMore = false; // إذا رجع أقل من 1000 يعني خلصنا
        from += 1000;
        to += 1000;
      }
    }

    // 5. الحساب اليدوي من المصفوفة الكاملة لضمان الدقة
    let dP = 0, mP = 0, ex = 0;

    allMonthTxs.forEach(tx => {
      const txDate = (tx.date || "").trim();
      const type = (tx.type || "").toLowerCase().trim();
      const comm = parseFloat(tx.commission) || 0;
      const amt = parseFloat(tx.amount) || 0;

      // أ - حساب الأرباح
      if (comm !== 0) {
        if (txDate === todayStr) dP += comm;
        mP += comm;
      }

      // ب - حساب المصروفات
      const isExpense = type.includes('مصروف') || 
                        type.includes('مصاريف') || 
                        type.includes('خارج') || 
                        type.includes('عجز');
      if (isExpense) {
        ex += amt;
      }
    });

    // 6. إرجاع النتائج النهائية
    return {
      success: true, 
      cash: cashBal, walletsTotal: walletBal, compTotal: compBal,
      totalAvailable: cashBal + walletBal + compBal,
      grandTotal: (cashBal + walletBal + compBal + oweMe) - have,
      oweMe, have, dP, mP, ex, breakdown,
      clientsCards: clientsCards.sort((a,b) => Math.abs(b.balance) - Math.abs(a.balance)).slice(0, 6)
    };

  } catch (err) {
    console.error("Dashboard Error:", err);
    return { success: false };
  }
}