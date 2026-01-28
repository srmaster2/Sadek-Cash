// إدارة المصادقة والصلاحيات

// جلب بيانات المستخدم الحالي
async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { role: 'GUEST', email: '', isMaster: false };
  const { data, error } = await supabase.from(TABLES.users).select('*').eq('email', user.email).single();
  if (!error && data) {
    return {
      role: data.role || 'USER',
      email: user.email,
      name: data.name || user.email,
      isMaster: data.is_master || false
    };
  }
  // إذا لم يكن في جدول users أضفه كمستخدم عادي
  await supabase.from(TABLES.users).insert({
    email: user.email,
    name: user.user_metadata?.name || user.email,
    role: 'USER',
    is_master: false
  });
  return {
    role: 'USER',
    email: user.email,
    name: user.user_metadata?.name || user.email,
    isMaster: false
  };
}

// تسجيل الدخول
async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    showToast('خطأ في تسجيل الدخول: ' + error.message, false);
    return false;
  }
  showToast('تم تسجيل الدخول بنجاح');
  window.location.href = 'index.html';
  return true;
}

// إنشاء حساب جديد
async function signUp(email, password, name) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } }
  });
  if (error) {
    showToast('خطأ في إنشاء الحساب: ' + error.message, false);
    return false;
  }
  showToast('تم إنشاء الحساب، تحقق من بريدك الإلكتروني');
  return true;
}

// تسجيل الخروج
async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    showToast('خطأ في تسجيل الخروج', false);
  } else {
    showToast('تم تسجيل الخروج');
    window.location.href = 'login.html';
  }
}

// التحقق من الصلاحيات
async function hasPermission(user, requiredRole) {
  // 1. المدير العام له كل الصلاحيات دائماً
  if (user.isMaster) return true;
  
  // 2. إذا كان المطلوب صلاحية موظف، والمنفذ أدمن، اسمح له
  if (requiredRole === 'staff' && user.role === 'admin') return true;
  
  // 3. التحقق المباشر
  return user.role === requiredRole;
}

// جلب بيانات مستخدم واحد من جدول users حسب الإيميل
async function getUserByEmail(email) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
  if (error || !data) return null;
  return data;
}

// مثال استخدام:
// const user = await getUserByEmail('user@example.com');
// if (user) { /* بيانات المستخدم موجودة */ }