// ============================================================
// transactions.js — Sadek Cash (Supabase)
// ملاحظة: searchTimeout, loadClientsToSelect, getTransactionLogs
//         كلهم معرّفين في utils.js بس — مش هنا
// ============================================================

var globalPendingData = null;
var selectedProvider  = "";
var isRenderingPins   = false;

const _supa = () => window.supa;

async function getSession() {
    const { data } = await _supa().auth.getSession();
    return data.session;
}

// ============================================================
// 1. setOp
// ============================================================
function setOp(typeValue, provider, element) {
    const walletSelect = document.getElementById('wallet');
    const typeInput    = document.getElementById('type');

    if (typeInput) typeInput.value = typeValue;
    selectedProvider = provider || "";

    document.querySelectorAll('.op-card').forEach(c =>
        c.classList.remove('active','active-op'));
    if (element) element.classList.add('active','active-op');

    const lockList = ['فوري','مكسب','مشتريات','أمان','ضامن','2090'];
    const target   = _norm(provider);
    const isLockOp = lockList.some(p => _norm(p) === target) &&
                     (typeValue.includes("سحب") || typeValue.includes("فاتورة"));

    if (isLockOp && walletSelect) {
        for (let i = 0; i < walletSelect.options.length; i++) {
            if (_norm(walletSelect.options[i].text).includes(target)) {
                walletSelect.selectedIndex = i; break;
            }
        }
        walletSelect.disabled = true;
        walletSelect.style.backgroundColor = "var(--bg-body)";
        walletSelect.style.cursor = "not-allowed";
    } else if (walletSelect) {
        walletSelect.disabled = false;
        walletSelect.style.backgroundColor = "";
        walletSelect.style.cursor = "default";
        if (!lockList.some(p => _norm(p) === target))
            walletSelect.selectedIndex = 0;
    }

    _toggleOpFields(typeValue);
    if (typeof updateLimitDisplay === "function") updateLimitDisplay();
    if (typeof toggleClientField  === "function") toggleClientField();
    walletSelect?.dispatchEvent(new Event('change'));

    setTimeout(() => {
        const f = document.getElementById('amount');
        if (f) { f.scrollIntoView({ behavior:'smooth', block:'center' }); f.focus(); }
    }, 400);
}

function _norm(txt) {
    return txt ? String(txt).replace(/[أإآا]/g,'ا').replace(/\s+/g,'').trim().toLowerCase() : "";
}

function _toggleOpFields(typeValue) {
    const isDebt   = /دين|مديونية|سداد/.test(typeValue || '');
    const isWallet = typeValue && !isDebt && !typeValue.includes("مصروف");
    const show = (id, v) => { const el = document.getElementById(id); if (el) el.style.display = v ? 'block' : 'none'; };
    show('clientFieldContainer',     isDebt);
    show('commDestinationContainer', isWallet);
    show('deductCommContainer',      isWallet);
    if (isDebt && typeof loadClientsToSelect === "function") loadClientsToSelect();
}

// ============================================================
// 2. openProviderSelect
// ============================================================
// ============================================================
// serviceMap: خريطة العمليات — الشركات بتتجيب من Supabase أوتوماتيك
// ============================================================
const serviceMap = {
    client_withdraw: {
        label: 'سحب من عميل',
        buildTitle: (prov) => `سحب من عميل (تزويد ${prov})`,
        filterTag: 'شركة'
    },
    pay_bill: {
        label: 'دفع فاتورة',
        buildTitle: (prov) => `دفع فاتورة (${prov})`,
        filterTag: 'شركة'
    },
    cash_supply: {
        label: 'سحب كاش',
        buildTitle: (prov) => `سحب كاش (تزويد ${prov})`,
        filterTag: 'شركة'
    },
    visa_withdraw: {
        label: 'سحب فيزا',
        buildTitle: (prov) => `سحب فيزا (ماكينة ${prov})`,
        filterTag: 'شركة'
    }
};

// ألوان الشركات (بتتطبق على أي شركة موجودة في Supabase تلقائي)
const providerColors = {
    'فوري':      '#ff6b00',
    'مكسب':      '#00a651',
    'أمان':      '#1a56db',
    'ضامن':      '#7c3aed',
    '2090':      '#0f172a',
    'مشتريات':  '#dc2626'
};

// ============================================================
// openProviderSelect — يجيب الشركات من Supabase أوتوماتيك
// ============================================================
async function openProviderSelect(serviceKey, element) {
    // تمييز الكارت المختار
    document.querySelectorAll('.op-card').forEach(c => c.classList.remove('active','active-op'));
    if (element) element.classList.add('active','active-op');

    const config = serviceMap[serviceKey];
    if (!config) return;

    document.getElementById('selectedServiceKey').value = serviceKey;

    const grid = document.getElementById('providerButtonsGrid');
    const modal = document.getElementById('providerModal');
    if (!grid || !modal) return;

    // عرض loading
    grid.innerHTML = '<div class="text-center p-3"><i class="fa fa-circle-notch fa-spin fa-2x text-primary"></i></div>';
    modal.style.display = 'flex';

    try {
        // جيب الشركات من Supabase (daily_out_limit > 9M = شركة)
const { data: companies, error } = await _supa()
    .from('accounts')
    .select('id, name, balance, tag, color')
    .gt('daily_out_limit', 9000000)
    .not('name', 'ilike', '%خزنة%') // استبعاد أي اسم يحتوي على كلمة خزنة
    .not('name', 'ilike', '%كاش%')  // استبعاد أي اسم يحتوي على كلمة كاش
    .order('name');
        if (error) throw error;

        grid.innerHTML = '';

        if (!companies || companies.length === 0) {
            grid.innerHTML = '<div class="text-center text-muted p-3">لا توجد شركات مضافة</div>';
            return;
        }

        companies.forEach(function(company) {
            const btn = document.createElement('button');
            btn.type = 'button';

            // لون الشركة: من providerColors أو من color في الـ DB أو افتراضي
            const color = providerColors[company.name] || company.color || '#475569';

            const bal = Number(company.balance || 0);
            const balText = bal.toLocaleString();
            const balColor = bal < 0 ? '#ef4444' : '#10b981';

            btn.style.cssText = [
                'display:flex',
                'align-items:center',
                'justify-content:space-between',
                'width:100%',
                'padding:12px 16px',
                'border-radius:12px',
                'border:2px solid ' + color + '33',
                'background:' + color + '11',
                'cursor:pointer',
                'transition:all 0.2s',
                'margin-bottom:8px'
            ].join(';');

            btn.innerHTML = [
                '<div style="display:flex;align-items:center;gap:10px;">',
                    '<div style="width:10px;height:10px;border-radius:50%;background:' + color + ';flex-shrink:0;"></div>',
                    '<div style="text-align:right;">',
                        '<div style="font-weight:800;font-size:14px;color:' + color + ';">' + company.name + '</div>',
                        '<div style="font-size:10px;color:#64748b;">رصيد: <span style="color:' + balColor + ';font-weight:700;">' + balText + '</span> ج.م</div>',
                    '</div>',
                '</div>',
                '<i class="fa fa-chevron-left" style="color:' + color + ';opacity:0.6;"></i>'
            ].join('');

            btn.onmouseenter = function() {
                btn.style.borderColor = color;
                btn.style.background  = color + '22';
                btn.style.transform   = 'translateX(-3px)';
            };
            btn.onmouseleave = function() {
                btn.style.borderColor = color + '33';
                btn.style.background  = color + '11';
                btn.style.transform   = 'none';
            };

            btn.onclick = function() {
                confirmProviderSelection(serviceKey, company.name);
            };

            grid.appendChild(btn);
        });

    } catch(e) {
        console.error('openProviderSelect error:', e);
        grid.innerHTML = '<div class="text-center text-danger p-3">خطأ في تحميل الشركات</div>';
    }
}

// ============================================================
// confirmProviderSelection — يضبط العملية ويغلق المودال
// ============================================================
function confirmProviderSelection(serviceKey, provider) {
    const config = serviceMap[serviceKey];
    if (!config) return;

    const opTitle = config.buildTitle(provider);

    closeProviderModal();

    // تمييز الكارت الأصلي
    const originalCard = document.querySelector('.op-card[onclick*="' + serviceKey + '"]');
    setOp(opTitle, provider, originalCard);
}

function closeProviderModal() {
    const modal = document.getElementById('providerModal');
    if (modal) modal.style.display = 'none';
}


// ============================================================
// 3. renderPinnedWallets
// ============================================================
async function renderPinnedWallets() {
    const container = document.getElementById('pinnedWallets');
    if (!container || isRenderingPins) return;
    isRenderingPins = true;

    try {
        const { data: accounts, error } = await _supa()
            .from('accounts')
            .select('id, name, balance, is_pinned, tag, color, daily_out_limit, daily_in_limit, monthly_limit, daily_out_usage, daily_in_usage, monthly_usage_out')
            .eq('is_pinned', true)
            .order('name');

        container.innerHTML = '';
        if (error || !accounts || !accounts.length) {
            container.innerHTML = '<span class="text-muted small">لا توجد محافظ مثبتة.</span>';
            return;
        }

        const isDark =
            document.body.classList.contains('dark') ||
            document.documentElement.classList.contains('dark');

        accounts.forEach(function(w) {
            const btn = document.createElement('div');

            const bal      = Number(w.balance || 0);
            const lo       = Number(w.daily_out_limit || 0);
            const li       = Number(w.daily_in_limit  || 0);
            const lm       = Number(w.monthly_limit   || 0);
            const uo       = Number(w.daily_out_usage || 0);
            const ui       = Number(w.daily_in_usage  || 0);
            const um       = Number(w.monthly_usage_out || 0);

            const availOut = Math.max(0, lm > 0 ? Math.min(lo - uo, lm - um) : lo - uo);
            const availIn  = Math.max(0, li - ui);

            // ⭐ لون مضمون
            const dynamicMainColor = isDark ? '#ffffff' : '#1e293b';
            const importantMainColor = dynamicMainColor + ' !important';

            const balColor = bal < 300 ? '#ef4444'
                           : bal < 1000 ? '#f59e0b'
                           : importantMainColor;

            const inColor  = availIn  < 500 ? '#ef4444'
                           : availIn  < 2000 ? '#f59e0b'
                           : '#10b981';

            const outColor = availOut < 500 ? '#ef4444'
                           : availOut < 2000 ? '#f59e0b'
                           : '#10b981';

            const tagColor = w.color || '#0ea5e9';

            btn.style.cssText = `
                display:inline-flex;
                flex-direction:column;
                gap:6px;
                background:var(--card-bg, #ffffff);
                color: ${isDark ? '#ffffff' : '#1e293b'};
                border:1px solid var(--border-color, #e2e8f0);
                border-radius:14px;
                padding:10px 14px;
                cursor:pointer;
                min-width:140px;
                direction:rtl;
                user-select:none;
                box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05));
            `;

            var tagHtml = (w.tag && w.tag.trim())
                ? `<span style="font-size:9px; background:${tagColor}; color:#fff; padding:1px 7px; border-radius:20px; font-weight:700;">${w.tag}</span>`
                : '';

            var line1 = `
                <div style="display:flex; justify-content:space-between;">
                    <div style="display:flex; gap:6px;">
                        <i class="fa-solid fa-bolt" style="color:${tagColor}; font-size:11px;"></i>
                        <span style="font-size:12px; font-weight:800; color:${importantMainColor};">${w.name}</span>
                    </div>
                    ${tagHtml}
                </div>`;

            var line2 = `
                <div style="border-top:1px dashed var(--border-color, #e2e8f0); padding-top:6px;">
                    <span style="font-size:9px; color:var(--text-muted, #64748b);">رصيد</span>
                    <span style="font-size:14px; font-weight:800; color:${balColor}; margin-right:4px;">${bal.toLocaleString()}</span>
                    <span style="font-size:9px; color:var(--text-muted, #64748b);">ج.م</span>
                </div>`;

            var line3 = `
                <div style="display:flex; gap:6px;">
                    <div style="flex:1; text-align:center; background:rgba(16,185,129,0.08); border-radius:8px; padding:4px;">
                        <div style="font-size:8px;">دخول</div>
                        <div style="font-weight:700; color:${inColor};">${availIn.toLocaleString()}</div>
                    </div>
                    <div style="flex:1; text-align:center; background:rgba(239,68,68,0.08); border-radius:8px; padding:4px;">
                        <div style="font-size:8px;">خروج</div>
                        <div style="font-weight:700; color:${outColor};">${availOut.toLocaleString()}</div>
                    </div>
                </div>`;

            btn.innerHTML = line1 + line2 + line3;

            btn.onmouseenter = function() { btn.style.borderColor = tagColor; btn.style.boxShadow = '0 0 0 2px ' + tagColor + '33'; };
            btn.onmouseleave = function() {
                if (!btn.classList.contains('active')) {
                    btn.style.borderColor = 'var(--border-color, #e2e8f0)';
                    btn.style.boxShadow = 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))';
                }
            };
            btn.onclick = function() {
                document.querySelectorAll('#pinnedWallets > div').forEach(function(b) {
                    b.classList.remove('active');
                    b.style.borderColor = 'var(--border-color, #e2e8f0)';
                    b.style.boxShadow = 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))';
                });
                btn.classList.add('active');
                btn.style.borderColor = tagColor;
                btn.style.boxShadow = '0 0 0 3px ' + tagColor + '44';
                selectWalletFast(w.id, w.name, btn);
            };

            container.appendChild(btn);
        });

    } catch(e) {
        console.error('renderPinnedWallets Error:', e);
        if (container) container.innerHTML = '<span class="text-muted small">خطأ في العرض</span>';
    } finally {
        isRenderingPins = false;
    }
}
function selectWalletFast(walletId, walletName, btn) {
    const select = document.getElementById('wallet');
    if (!select) return;
    for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].value == walletId ||
            _norm(select.options[i].text).includes(_norm(walletName))) {
            select.selectedIndex = i; break;
        }
    }
    document.querySelectorAll('.pin-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    if (typeof updateLimitDisplay === "function") updateLimitDisplay();
    select.dispatchEvent(new Event('change'));
}

// ============================================================
// 4. loadWalletsToSelect — للفلترة حسب الفئة (SAFE/WALLET/COMPANY)
//    loadWallets في utils.js للقائمة العامة بدون فلترة
// ============================================================
async function loadWalletsToSelect(category) {
    const select = document.getElementById('wallet');
    if (!select) return;
    select.innerHTML = '<option value="">جاري التحميل...</option>';

    const { data: accounts, error } = await _supa()
        .from('accounts').select('id, name, balance, daily_out_limit').order('name');

    if (error || !accounts) {
        select.innerHTML = '<option value="">خطأ في التحميل</option>';
        return;
    }
    select.innerHTML = '<option value="">اختر الحساب...</option>';
    accounts.forEach(acc => {
        const limit     = Number(acc.daily_out_limit) || 0;
        const isCompany = limit > 10000000;
        const isSafe    = acc.name.includes("الخزنة");
        if (category === 'SAFE'    && !isSafe)               return;
        if (category === 'WALLET'  && (isSafe || isCompany)) return;
        if (category === 'COMPANY' && !isCompany)             return;
        const bal = Number(acc.balance) || 0;
        select.innerHTML += `<option value="${acc.id}"
            data-lo="${acc.daily_out_limit||0}"
            data-li="${acc.daily_in_limit||0}"
            data-lm="${acc.monthly_limit||0}">
            ${acc.name} (${bal.toLocaleString()} ج.م)
        </option>`;
    });
}

// ============================================================
// 5. runTransaction
// ============================================================
function runTransaction() {
    try {
        const get = id => document.getElementById(id);
        const typeEl     = get('type');
        const amountEl   = get('amount');
        const walletEl   = get('wallet');
        const commEl     = get('comm');
        const commDestEl = get('commDestination');
        const clientEl   = get('client');
        const noteEl     = get('note');
        const deductEl   = get('deductCommFromAmount');

        if (!typeEl?.value?.trim())
            return showToast("⚠️ يجب اختيار نوع الخدمة من الكروت أولاً", false);
        if (!amountEl?.value || Number(amountEl.value) <= 0)
            return showToast("⚠️ برجاء إدخال مبلغ صحيح", false);
        if (!walletEl?.value)
            return showToast("⚠️ يرجى اختيار المحفظة أو الخزنة", false);

        const type       = typeEl.value;
        const amount     = amountEl.value.replace(/,/g,'');
        const walletId   = walletEl.value;
        const walletName = (walletEl.options[walletEl.selectedIndex]?.text||"").replace(/\s*\(.*\)/,'').trim();
        const comm       = (commEl?.value||'0').replace(/,/g,'');
        const commDest   = commDestEl?.value || 'CASH';
        const clientId   = clientEl?.value   || '';
        const note       = noteEl?.value     || '';
        const deductComm = deductEl?.checked  || false;
        const provider   = selectedProvider  || walletName || "الخزنة";

        if (/دين|مديونية|سداد/.test(type) && !clientId)
            return showToast("⚠️ هذه العملية تتطلب اختيار عميل", false);

        const summaryCard = `
            <div style="background:rgba(255,255,255,0.05);border-radius:18px;padding:15px;margin-bottom:15px;border:1px solid rgba(255,255,255,0.1);">
                <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
                    <span style="color:var(--text-muted);font-size:13px;">نوع العملية:</span>
                    <span style="color:var(--text-main);font-weight:800;">${type}</span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
                    <span style="color:var(--text-muted);font-size:13px;">المبلغ:</span>
                    <span style="color:var(--text-main);font-weight:800;font-size:18px;">${Number(amount).toLocaleString()} ج.م</span>
                </div>
                ${Number(comm)>0 ? `
                <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
                    <span style="color:var(--text-muted);font-size:13px;">العمولة:</span>
                    <span style="color:#f59e0b;font-weight:bold;">${Number(comm).toLocaleString()} ← ${commDest==='CASH'?'💰 الخزنة':'📱 المحفظة'}</span>
                </div>` : ''}
                <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px dashed rgba(255,255,255,0.2);">
                    <span style="color:var(--text-muted);font-size:13px;">الجهة:</span>
                    <span style="color:#ffca28;font-weight:bold;">${provider}</span>
                </div>
            </div>`;

        globalPendingData = { walletId, walletName, type, provider, amount, comm, clientId, note, commDest, deductComm };
        showCustomConfirmModal(summaryCard + _buildFlowCard(type, provider, walletName), _getOpColor(type));
    } catch(err) {
        console.error(err);
        alert("خطأ: " + err.message);
    }
}

function _getOpColor(type) {
    if (/سداد|وارد|سحب من محفظة/.test(type)) return "#10b981";
    if (/مصروف|سحب|إيداع/.test(type))         return "#ef4444";
    return "#3b82f6";
}

function _buildFlowCard(type, provider, walletName) {
    const box = (from, fi, to, ti, color, detail) => `
        <div style="background:rgba(255,255,255,0.02);padding:15px;border-radius:18px;border:1px solid rgba(255,255,255,0.05);">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                <div style="text-align:center;width:70px;">
                    <div style="width:45px;height:45px;background:rgba(255,255,255,0.1);border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 5px;">
                        <i class="fas ${fi}" style="color:var(--text-main)"></i></div>
                    <span style="font-size:10px;color:var(--text-muted);font-weight:bold;">${from}</span>
                </div>
                <i class="fas fa-long-arrow-alt-left fa-2x" style="color:${color};opacity:0.8;flex:1;text-align:center;"></i>
                <div style="text-align:center;width:70px;">
                    <div style="width:45px;height:45px;background:${color};border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 5px;">
                        <i class="fas ${ti}" style="color:#fff"></i></div>
                    <span style="font-size:10px;color:var(--text-muted);font-weight:bold;">${to}</span>
                </div>
            </div>
            <p style="margin:0;font-size:13px;color:var(--text-main);direction:rtl;line-height:1.5;">${detail}</p>
        </div>`;

    if (/سحب من عميل|سحب فيزا/.test(type))
        return box("العميل","fa-user",provider,"fa-server","#10b981",`📥 رصيد ${provider} هيزيد.<br>📤 كاش الخزنة هيقل.`);
    if (type.includes("دفع فاتورة"))
        return box("العميل","fa-money-bill",provider,"fa-server","#ef4444",`📥 كاش الخزنة هيزيد.<br>📤 رصيد ${provider} هيقل.`);
    if (/سحب كاش|تزويد/.test(type))
        return box("المحفظة","fa-wallet",provider,"fa-server","#3b82f6",`📥 رصيد ${provider} هيزيد.<br>ℹ️ عملية تنظيمية.`);
    if (/إيداع|شحن|تحويل/.test(type))
        return box(walletName,"fa-wallet","العميل","fa-user","#ef4444","�ى كاش الخزنة زاد.<br>📤 رصيد المحفظة قل.");
    if (type.includes("سحب من محفظة"))
        return box("العميل","fa-user",walletName,"fa-wallet","#10b981","📥 رصيد المحفظة هيزيد.<br>📤 كاش الخزنة هيقل.");
    if (type.includes("سداد"))
        return `<div style="padding:15px;text-align:center;color:#10b981;font-weight:bold;">✅ العميل يسدد دين</div>`;
    if (/دين|مديونية/.test(type))
        return `<div style="padding:15px;text-align:center;color:#ef4444;font-weight:bold;">⚠️ تسجيل دين جديد</div>`;
    if (type.includes("مصروف"))
        return `<div style="padding:15px;text-align:center;color:#f59e0b;font-weight:bold;">💸 مصروف من الخزنة</div>`;
    return `<p style="text-align:center;padding:10px;">تأكيد: <b>${type}</b></p>`;
}

// ============================================================
// 6. showCustomConfirmModal
// ============================================================
function showCustomConfirmModal(content, themeColor) {
    themeColor = themeColor || "#3b82f6";
    document.getElementById('customConfirmModal')?.remove();
    document.body.insertAdjacentHTML('beforeend', `
        <div id="customConfirmModal"
            style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,0.85);
                   backdrop-filter:blur(4px);display:flex;justify-content:center;align-items:center;
                   z-index:10000;padding:20px;font-family:'Cairo',sans-serif;">
            <div style="background:var(--bg-card,#1e293b);width:100%;max-width:390px;border-radius:24px;
                        box-shadow:0 20px 50px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.1);overflow:hidden;">
                <div style="background:${themeColor};padding:15px;text-align:center;color:#fff;">
                    <i class="fas fa-file-invoice-dollar fa-2x mb-2"></i>
                    <h6 style="margin:0;font-weight:800;font-size:16px;">مراجعة وتأكيد العملية</h6>
                </div>
                <div style="padding:25px 20px;">${content}</div>
                <div style="padding:0 20px 25px;display:flex;gap:12px;">
                    <button onclick="finalExecuteStep(this)"
                        style="flex:2;padding:14px;border:none;border-radius:15px;background:${themeColor};
                               color:#fff;font-weight:bold;font-size:15px;cursor:pointer;">
                        ✅ تأكيد العملية
                    </button>
                    <button onclick="document.getElementById('customConfirmModal').remove()"
                        style="flex:1;padding:14px;border:1px solid #475569;border-radius:15px;
                               background:rgba(255,255,255,0.05);color:#94a3b8;cursor:pointer;">
                        إلغاء
                    </button>
                </div>
            </div>
        </div>`);
}

// ============================================================
// 7. finalExecuteStep
// ============================================================
async function finalExecuteStep(btn) {
    if (!globalPendingData) return;
    btn.disabled  = true;
    btn.innerHTML = '<i class="fa fa-circle-notch fa-spin"></i> جاري الحفظ...';

    try {
        const session  = await getSession();
        const userName = session?.user?.user_metadata?.name || session?.user?.email || 'Unknown';
        const now      = new Date();
        const { walletId, walletName, type, provider, amount, comm, clientId, note, commDest, deductComm } = globalPendingData;

        const { data: allAccounts } = await _supa().from('accounts').select('*');
        const cashAcc   = allAccounts?.find(a => a.name.includes("الخزنة"));
        const walletAcc = allAccounts?.find(a => a.id == walletId && !a.name.includes("الخزنة"));
        const provAcc   = allAccounts?.find(a =>
            _norm(a.name).includes(_norm(provider)) && Number(a.daily_out_limit) > 10000000);

        if (!cashAcc) throw new Error("حساب الخزنة غير موجود");

        const val     = Number(amount);
        const fee     = Number(comm) || 0;
        const updates = [];
        let balanceAfter = 0;
        const push = (acc, changes) => { if (acc) updates.push({ id: acc.id, changes }); };


        // ── التحقق من الليميت قبل التنفيذ ──
        const _checkLimit = (acc, opVal, dir) => {
            if (!acc) return;
            if (Number(acc.daily_out_limit) > 10000000) return; // شركات بدون ليميت
            if (dir === 'OUT') {
                const availDay   = Math.max(0, Number(acc.daily_out_limit)  - Number(acc.daily_out_usage));
                const availMonth = Math.max(0, Number(acc.monthly_limit)    - Number(acc.monthly_usage_out));
                const avail      = Number(acc.monthly_limit) > 0 ? Math.min(availDay, availMonth) : availDay;
                if (opVal > avail)
                    throw new Error('❌ تجاوز الليميت — المتاح للإرسال: ' + avail.toLocaleString() + ' ج.م');
            } else if (dir === 'IN') {
                const availIn = Math.max(0, Number(acc.daily_in_limit) - Number(acc.daily_in_usage));
                if (Number(acc.daily_in_limit) > 0 && opVal > availIn)
                    throw new Error('❌ تجاوز ليميت الاستقبال — المتاح: ' + availIn.toLocaleString() + ' ج.م');
            }
        };

        if (/إيداع|شحن|تحويل|باقة|تجديد|رصيد|دفع فيزا/.test(type) && !type.includes("سحب من")) {
            _checkLimit(walletAcc, val, 'OUT');
        } else if (type.includes("سحب من محفظة")) {
            _checkLimit(walletAcc, val, 'IN');
        } else if (type.includes("سحب كاش")) {
            _checkLimit(walletAcc, val, 'OUT');
        } else if (/دين|مديونية/.test(type)) {
            if (/سحب|صادر/.test(type)) _checkLimit(walletAcc, val, 'OUT');
            else                        _checkLimit(walletAcc, val, 'IN');
        }

        if (type.includes("سحب كاش") && /مكسب|فوري/.test(provider)) {
            push(provAcc,   { balance: +provAcc.balance + val });
            push(walletAcc, { balance: +walletAcc.balance - val + fee, profit: +walletAcc.profit + fee,
                              daily_out_usage: +walletAcc.daily_out_usage + val,
                              monthly_usage_out: +walletAcc.monthly_usage_out + val });
            balanceAfter = +walletAcc.balance - val + fee;
        }
        else if (type.includes("سحب كاش") && provAcc) {
            push(walletAcc, { balance: +walletAcc.balance - val,
                              daily_out_usage: +walletAcc.daily_out_usage + val,
                              monthly_usage_out: +walletAcc.monthly_usage_out + val });
            if (commDest === 'CASH') {
                push(provAcc, { balance: +provAcc.balance + val });
                push(cashAcc, { balance: +cashAcc.balance + fee, profit: +cashAcc.profit + fee });
            } else {
                push(provAcc, { balance: +provAcc.balance + val + fee, profit: +provAcc.profit + fee });
            }
            balanceAfter = +walletAcc.balance - val;
        }
        else if (/سحب من عميل|سحب فيزا/.test(type)) {
            if (!provAcc)               throw new Error(`حساب ${provider} غير موجود`);
            if (+cashAcc.balance < val) throw new Error("رصيد الخزنة لا يكفي");
            if (commDest === 'CASH') {
                push(cashAcc, { balance: +cashAcc.balance - val + fee, profit: +cashAcc.profit + fee });
                push(provAcc, { balance: +provAcc.balance + val });
            } else {
                push(cashAcc, { balance: +cashAcc.balance - val });
                push(provAcc, { balance: +provAcc.balance + val + fee, profit: +provAcc.profit + fee });
            }
            balanceAfter = +provAcc.balance + val;
        }
        else if (type.includes("دفع فاتورة")) {
            if (!provAcc) throw new Error(`حساب ${provider} غير موجود`);
            push(provAcc, { balance: +provAcc.balance - val });
            push(cashAcc, { balance: +cashAcc.balance + val + fee, profit: +cashAcc.profit + fee });
            balanceAfter = +provAcc.balance - val;
        }
        else if (type.includes("مصروف")) {
            if (+cashAcc.balance < val) throw new Error("رصيد الخزنة لا يكفي");
            push(cashAcc, { balance: +cashAcc.balance - val });
            balanceAfter = +cashAcc.balance - val;
        }
        else if (/إيداع|شحن|تحويل|باقة|تجديد|رصيد|دفع فيزا/.test(type) && !type.includes("سحب من")) {
            if (!walletAcc) throw new Error("يجب تحديد المحفظة");
            let finalW = +walletAcc.balance - val - 1 + (commDest === 'WALLET' ? fee : 0);
            if (finalW < 0) throw new Error(`الرصيد لا يكفي — المتاح ${Number(walletAcc.balance).toLocaleString()}`);
            push(walletAcc, { balance: finalW,
                              daily_out_usage: +walletAcc.daily_out_usage + val,
                              monthly_usage_out: +walletAcc.monthly_usage_out + val,
                              ...(commDest==='WALLET' ? { profit: +walletAcc.profit + fee } : {}) });
            push(cashAcc,   { balance: +cashAcc.balance + val,
                              ...(commDest==='CASH' ? { profit: +cashAcc.profit + fee } : {}) });
            balanceAfter = finalW;
        }
        else if (type.includes("سحب من محفظة")) {
            if (!walletAcc) throw new Error("المحفظة غير محددة");
            const cashEffect = deductComm ? val : val - fee;
            if (+cashAcc.balance < cashEffect) throw new Error("رصيد الخزنة لا يكفي");
            push(walletAcc, { balance: +walletAcc.balance + val,
                              daily_in_usage: +walletAcc.daily_in_usage + val,
                              monthly_usage_in: +walletAcc.monthly_usage_in + val,
                              ...(commDest==='WALLET'&&fee>0 ? { profit: +walletAcc.profit + fee } : {}) });
            push(cashAcc,   { balance: +cashAcc.balance - cashEffect,
                              ...(commDest==='CASH'&&fee>0 ? { profit: +cashAcc.profit + fee } : {}) });
            balanceAfter = +walletAcc.balance + val;
        }
        else if (/دين|مديونية/.test(type)) {
            const target = walletAcc || cashAcc;
            const isOut  = /سحب|صادر/.test(type);
            if (isOut) {
                if (+target.balance < val) throw new Error("الرصيد لا يكفي");
                push(target, { balance: +target.balance - val,
                    ...(walletAcc ? { daily_out_usage: +walletAcc.daily_out_usage + val,
                                       monthly_usage_out: +walletAcc.monthly_usage_out + val } : {}) });
                if (fee > 0) push(cashAcc, { balance: +cashAcc.balance + fee, profit: +cashAcc.profit + fee });
                balanceAfter = +target.balance - val;
            } else {
                push(target, { balance: +target.balance + val + fee, profit: +target.profit + fee,
                    ...(walletAcc ? { daily_in_usage: +walletAcc.daily_in_usage + val,
                                       monthly_usage_in: +walletAcc.monthly_usage_in + val } : {}) });
                balanceAfter = +target.balance + val + fee;
            }
            if (clientId) await _updateClientBalance(clientId, val, isOut ? "OUT" : "IN");
        }
        else {
            throw new Error(`نوع العملية '${type}' غير معرّف`);
        }

        for (const upd of updates) {
            const { error } = await _supa().from('accounts').update(upd.changes).eq('id', upd.id);
            if (error) throw error;
        }

        const { error: txErr } = await _supa().from('transactions').insert([{
            date:          now.toLocaleDateString('en-CA'),
            time:          now.toLocaleTimeString('ar-EG', { hour:'2-digit', minute:'2-digit' }),
            type, amount: val, commission: fee,
            wallet_name: walletName, provider,
            balance_after: balanceAfter,
            notes: note || '', added_by: userName
        }]);
        if (txErr) throw txErr;

        document.getElementById('customConfirmModal')?.remove();
        showToast("✅ تمت العملية بنجاح", true);
        resetSystemInterface();

        if (typeof loadDash              === "function") loadDash();
        if (typeof loadTransactionLogs   === "function") loadTransactionLogs();
        if (typeof renderPinnedWallets   === "function") renderPinnedWallets();
        if (typeof refreshAllWalletViews === "function") refreshAllWalletViews();

    } catch(err) {
        console.error("finalExecuteStep:", err);
        showToast("❌ " + err.message, false);
        btn.disabled  = false;
        btn.innerHTML = "✅ تأكيد العملية";
    } finally {
        globalPendingData = null;
    }
}

async function _updateClientBalance(clientId, amount, mode) {
    const { data: cl } = await _supa()
        .from('clients').select('id, balance').eq('id', clientId).maybeSingle();
    if (!cl) return;
    const newBal = mode === "IN" ? +cl.balance + amount : +cl.balance - amount;
    await _supa().from('clients').update({ balance: newBal }).eq('id', cl.id);
}

// ============================================================
// 8. resetSystemInterface
// ============================================================
function resetSystemInterface() {
    ['amount','note','type'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    const commEl = document.getElementById('comm');
    if (commEl) commEl.value = '0';
    const commDest = document.getElementById('commDestination');
    if (commDest) { commDest.value = 'CASH'; commDest.dispatchEvent(new Event('change')); }
    ['wallet','client'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.selectedIndex = 0; el.disabled = false; el.style.backgroundColor = ""; el.style.cursor = "default"; }
    });
    document.querySelectorAll('.op-card').forEach(c => {
        c.classList.remove('active','active-op'); c.style.background = ""; c.style.borderColor = "";
    });
    document.querySelectorAll('.pin-btn').forEach(b => b.classList.remove('active'));
    globalPendingData = null; selectedProvider = "";
    const cs = document.getElementById('clientBalanceStatus'); if (cs) cs.innerHTML = '';
    const lb = document.getElementById('limitStatus'); if (lb) lb.style.display = 'none';
    if (typeof toggleClientField === "function") toggleClientField();
}

var resetTransactionForm = resetSystemInterface;

// ============================================================
// 9. renderTransactionsTable + executeAdvancedSearch + rollbackTx
// ============================================================
function renderTransactionsTable(data) {
    const container = document.getElementById('timelineContainer');
    if (!container) return;
    if (!data || !data.length) {
        container.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">لا توجد بيانات</td></tr>';
        return;
    }
    let i = 1;
    container.innerHTML = data.map(tx => {
        const isOut = /سحب|صادر/.test(tx.type || '');
        return `
            <tr>
                <td>${i++}</td>
                <td class="english-num small">${tx.date||'-'} ${tx.time||''}</td>
                <td class="${isOut?'text-danger':'text-success'} fw-bold">${tx.type||'-'}</td>
                <td class="english-num fw-bold">
                    ${Number(tx.amount||0).toLocaleString()}
                    ${tx.commission ? `<br><small class="text-warning">عمولة: ${Number(tx.commission).toLocaleString()}</small>` : ''}
                </td>
                <td class="english-num text-primary">${Number(tx.balance_after||0).toLocaleString()}</td>
                <td class="small">${tx.notes||'-'}</td>
                <td class="small">${tx.added_by||'-'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-secondary" onclick="showDetails(${tx.id})">
                        <i class="fa fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger admin-only ms-1" onclick="rollbackTx(${tx.id})">
                        <i class="fa fa-undo"></i>
                    </button>
                </td>
            </tr>`;
    }).join('');
}

function executeAdvancedSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        const filters = {
            text:     (document.getElementById('advSearchText')?.value||"").trim().toLowerCase(),
            type:     document.getElementById('advSearchType')?.value  || "",
            dateFrom: document.getElementById('advDateFrom')?.value    || "",
            dateTo:   document.getElementById('advDateTo')?.value      || ""
        };
        const container = document.getElementById('timelineContainer');
        if (container)
            container.innerHTML = '<tr><td colspan="8" class="py-4 text-center"><i class="fa fa-sync fa-spin"></i> جاري البحث...</td></tr>';

        const data = await getTransactionLogs(filters);
        if (!data) return;

        const filtered = data.filter(tx =>
            (tx.wallet_name?.toLowerCase()||"").includes(filters.text) ||
            (tx.notes?.toLowerCase()||"").includes(filters.text)       ||
            String(tx.amount).includes(filters.text)
        );
        renderTransactionsTable(filtered);
        const countEl = document.getElementById('rowsCountDisplay');
        if (countEl) countEl.innerText = `تم العثور على ${filtered.length} عملية`;
    }, 500);
}

async function rollbackTx(txId) {
    if (!confirm("⚠️ هل أنت متأكد من التراجع عن هذه العملية؟")) return;
    const { data: tx } = await _supa().from('transactions').select('*').eq('id', txId).maybeSingle();
    if (!tx) return showToast("❌ العملية غير موجودة", false);

    const { data: allAccounts } = await _supa().from('accounts').select('*');
    const val     = Number(tx.amount);
    const fee     = Number(tx.commission) || 0;
    const updates = [];
    const clamp   = v => Math.max(0, v);
    const cashAcc   = allAccounts?.find(a => a.name.includes("الخزنة"));
    const walletAcc = allAccounts?.find(a => a.name === tx.wallet_name &&
                      !a.name.includes("الخزنة") && Number(a.daily_out_limit) <= 10000000);
    const provAcc   = allAccounts?.find(a =>
        _norm(a.name).includes(_norm(tx.provider)) && Number(a.daily_out_limit) > 10000000);
    const push = (acc, ch) => { if (acc) updates.push({ id: acc.id, changes: ch }); };

    if      (tx.type.includes("دفع فاتورة"))               { push(provAcc, { balance: +provAcc?.balance + val }); push(cashAcc, { balance: +cashAcc?.balance - val - fee, profit: clamp(+cashAcc?.profit - fee) }); }
    else if (/سحب من عميل|سحب فيزا/.test(tx.type))        { push(provAcc, { balance: +provAcc?.balance - val }); push(cashAcc, { balance: +cashAcc?.balance + val - fee, profit: clamp(+cashAcc?.profit - fee) }); }
    else if (/إيداع|شحن|تحويل/.test(tx.type) && walletAcc) { push(walletAcc, { balance: +walletAcc.balance + val, daily_out_usage: clamp(+walletAcc.daily_out_usage - val), monthly_usage_out: clamp(+walletAcc.monthly_usage_out - val) }); push(cashAcc, { balance: +cashAcc?.balance - val, profit: clamp(+cashAcc?.profit - fee) }); }
    else if (tx.type.includes("سحب من محفظة") && walletAcc) { push(walletAcc, { balance: +walletAcc.balance - val, daily_in_usage: clamp(+walletAcc.daily_in_usage - val), monthly_usage_in: clamp(+walletAcc.monthly_usage_in - val) }); push(cashAcc, { balance: +cashAcc?.balance + val - fee, profit: clamp(+cashAcc?.profit - fee) }); }
    else if (tx.type.includes("سحب كاش") && walletAcc)      { push(walletAcc, { balance: +walletAcc.balance + val, profit: clamp(+walletAcc.profit - fee), daily_out_usage: clamp(+walletAcc.daily_out_usage - val), monthly_usage_out: clamp(+walletAcc.monthly_usage_out - val) }); push(provAcc, { balance: +provAcc?.balance - val }); }

    for (const upd of updates)
        await _supa().from('accounts').update(upd.changes).eq('id', upd.id);

    await _supa().from('transactions').delete().eq('id', txId);
    await _supa().from('admin_logs').insert([{
        action: 'ROLLBACK', details: `تراجع: ${tx.type} بمبلغ ${val}`,
        created_by: (await getSession())?.user?.email
    }]);

    showToast("✅ تم التراجع بنجاح", true);
    if (typeof loadTransactionLogs === "function") loadTransactionLogs();
    if (typeof loadDash            === "function") loadDash();
}

// ============================================================
// 10. الدوال الثانوية
// ============================================================
function applySecurityUI(role) {
    document.querySelectorAll('.admin-only').forEach(el => {
        if (role === 'ADMIN')
            el.style.setProperty('display', (el.tagName==='TD'||el.tagName==='TH') ? 'table-cell' : 'block', 'important');
        else el.style.display = 'none';
    });
}

async function calculateStats() {
    const { data: accounts }     = await _supa().from('accounts').select('balance');
    const { data: transactions } = await _supa().from('transactions').select('commission').limit(1000);
    return {
        totalBalance:      (accounts||[]).reduce((s,a) => s + Number(a.balance), 0),
        totalProfit:       (transactions||[]).reduce((s,t) => s + Number(t.commission), 0),
        totalTransactions: transactions?.length || 0
    };
}

window.addEventListener('DOMContentLoaded', function() {
    if (typeof applyTheme    === "function") applyTheme();
    if (typeof checkUserRole === "function") checkUserRole();
    loadWallets();
    renderPinnedWallets();
    loadClientsToSelect();
    if (typeof toggleClientField  === "function") toggleClientField();
    if (typeof renderWalletsCards === "function") renderWalletsCards();
    if (typeof loadDash           === "function") loadDash();
});