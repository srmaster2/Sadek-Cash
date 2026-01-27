// إدارة المحافظ والحسابات

// جلب جميع الحسابات
async function loadAccounts() {
  const { data, error } = await supabase.from('accounts').select('*');
  if (error) return [];
  return data.filter(acc => !acc.deleted);
}

async function addAccount(name, type, tag = '', balance = 0) {
  if (!name) return false;
  const { error } = await supabase.from('accounts').insert([{ name, type, tag, balance: Number(balance) }]);
  return !error;
}

// تحديث حساب
async function updateAccount(id, updates) {
  const result = await updateSupabase(TABLES.accounts, updates, id);
  if (result.success) {
    showToast('تم التحديث');
    return true;
  } else {
    showToast('خطأ في التحديث', false);
    return false;
  }
}

// حذف حساب
async function deleteAccount(id) {
  const result = await updateSupabase(TABLES.accounts, { deleted: true }, id);
  if (result.success) {
    showToast('تم الحذف');
    loadAccountsList();
    return true;
  } else {
    showToast('خطأ في الحذف', false);
    return false;
  }
}
