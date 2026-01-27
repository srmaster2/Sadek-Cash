// إدارة العمليات

// جلب العمليات
async function loadTransactions(limit = 50) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data.filter(tx => !tx.deleted);
}

// إضافة عملية جديدة
async function addTransaction(type, amount, commission = 0, walletId = '', clientId = '', notes = '') {
  if (!type || !amount) return false;
  const user = await getCurrentUser();
  const { error } = await supabase.from('transactions').insert([{
    type,
    amount: Number(amount),
    commission: Number(commission),
    account_name: walletId,
    client_name: clientId,
    user_email: user.email,
    user_name: user.name || user.email,
    note: notes,
    is_out: type.includes('سحب') || type.includes('صادر')
  }]);
  return !error;
}

// حساب الإحصائيات
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
