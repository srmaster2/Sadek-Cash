async function removeUserFromBranch(t,e){let i=await Swal.fire({title:"إزالة من الفرع؟",text:`سيتم إزالة "${e}" من الفرع الحالي`,icon:"warning",showCancelButton:!0,confirmButtonText:"نعم، أزل",cancelButtonText:"إلغاء",confirmButtonColor:"#f59e0b"});if(i.isConfirmed)try{let{error:r}=await supabase.from("users").update({branch_id:null}).eq("id",t);if(r)throw r;Swal.fire({icon:"success",title:"تم",timer:1e3,showConfirmButton:!1,width:"300px"}),window.loadUsersTable()}catch(s){Swal.fire("خطأ",s.message,"error")}}async function openEditRoleModal(t,e){let i=`
        <div class="edit-role-container" style="direction: rtl; padding: 10px;">
            <p style="color: #666; font-size: 14px; margin-bottom: 20px;">اختر الصلاحية الجديدة للعضو:</p>
            <select id="swal-custom-select" class="form-select"
                style="max-width: 180px !important; margin: 0 auto !important; display: block;
                       padding: 8px; border-radius: 8px; border: 1px solid #ddd; text-align: center;">
                <option value="USER"  ${"USER"===e?"selected":""}>موظف</option>
                <option value="ADMIN" ${"ADMIN"===e?"selected":""}>مدير فرع</option>
            </select>
        </div>`,{isConfirmed:r}=await Swal.fire({title:'<span style="font-size: 18px;">تعديل الصلاحية</span>',html:i,showCancelButton:!0,confirmButtonText:"حفظ التعديل",cancelButtonText:"إلغاء",confirmButtonColor:"#0d6efd",cancelButtonColor:"#6c757d",width:"350px",focusConfirm:!1,preConfirm:()=>document.getElementById("swal-custom-select").value});if(r){let s=Swal.getHtmlContainer().querySelector("#swal-custom-select").value;if(s!==e)try{let{error:a}=await supabase.from("users").update({role:s}).eq("id",t);if(a)throw a;Swal.fire({icon:"success",title:"تم التحديث",timer:1e3,showConfirmButton:!1,width:"300px"}),window.loadUsersTable()}catch(n){Swal.fire("خطأ","فشل في تحديث البيانات","error")}}}async function confirmDeleteUser(t,e){let i=await Swal.fire({title:"هل أنت متأكد؟",text:`سيتم حذف العضو "${e}" نهائياً`,icon:"warning",showCancelButton:!0,confirmButtonText:"نعم، احذف",cancelButtonText:"إلغاء",confirmButtonColor:"#d33"});if(i.isConfirmed)try{let{error:r}=await supabase.from("users").delete().eq("id",t);if(r)throw r;Swal.fire("تم!","تم حذف العضو بنجاح","success"),window.loadUsersTable()}catch(s){Swal.fire("خطأ",s.message,"error")}}async function loadAdminLogs(){let t=document.getElementById("adminLogsDiv");if(t)try{let e=window.currentUserData,i=e?.isMaster===!0,r=supabase.from("admin_logs").select("*").order("created_at",{ascending:!1}).limit(20);!i&&e?.branch_id?r=r.eq("branch_id",e.branch_id):i||e?.branch_id||(r=r.eq("branch_id","00000000-0000-0000-0000-000000000000"));let{data:s,error:a}=await r;if(a)throw a;if(!s||0===s.length){t.innerHTML='<div class="text-center p-4 small text-muted">لا توجد سجلات حالياً.</div>';return}let n=`
        <div class="table-responsive">
            <table class="table table-borderless align-middle mb-0" style="direction: rtl; min-width: 450px;">
                <thead>
                    <tr class="text-muted border-bottom" style="font-size: 11px; background-color: #f8f9fa;">
                        <th style="width: 15%;" class="py-2 text-start">الوقت</th>
                        <th style="width: 20%;" class="py-2 text-center">الإجراء</th>
                        <th style="width: 45%;" class="py-2 text-center">التفاصيل</th>
                        <th style="width: 20%;" class="py-2 text-center">المسؤول</th>
                    </tr>
                </thead>
                <tbody style="font-size: 12.5px;">`;s.forEach(t=>{let e=new Date(t.created_at).toLocaleTimeString("en-EG",{hour:"2-digit",minute:"2-digit",hour12:!0});n+=`
                <tr class="border-bottom hover-row">
                    <td class="text-start text-muted english-num" style="font-size: 11px;">${esc(e)}</td>
                    <td class="text-center"><span class="badge bg-light text-primary border-0">${esc(t.action)}</span></td>
                    <td class="text-center text-secondary" style="line-height: 1.4;">${esc(t.details)||"---"}</td>
                    <td class="text-center fw-bold text-dark">${esc(t.created_by)||"النظام"}</td>
                </tr>`}),n+="</tbody></table></div>",t.innerHTML=n}catch(l){t.innerHTML='<div class="text-center p-3 text-danger small">تعذر تحديث السجل</div>'}}window.loadUsersTable=async function(){let t=document.getElementById("usersList");if(t){t.innerHTML='<div class="text-center p-3 small text-muted">جاري الاتصال بقاعدة البيانات...</div>';try{let e=window.currentUserData,i=e?.isMaster===!0,r=e?.isAdmin===!0,s=supabase.from("users").select("*").order("created_at",{ascending:!1});!i&&e?.branch_id?s=s.eq("branch_id",e.branch_id):i||e?.branch_id||(s=s.eq("branch_id","00000000-0000-0000-0000-000000000000"));let{data:a,error:n}=await s;if(n)throw n;if(!a||0===a.length){t.innerHTML='<div class="text-center p-4 text-muted small">لا يوجد أعضاء مسجلين حالياً</div>';return}t.innerHTML=a.map(t=>{let e=t.is_master,s=e?"\uD83D\uDC51 مدير عام":"ADMIN"===t.role?"\uD83D\uDD11 مدير فرع":"\uD83D\uDC64 موظف",a=e?"bg-warning text-dark":"ADMIN"===t.role?"bg-primary":"bg-light text-primary border",n=esc(t.id),l=esc(t.role),o=esc(t.name),d="";return i?d=`
                <button class="btn btn-sm btn-light border p-1" title="تعديل الصلاحية" onclick="openEditRoleModal('${n}','${l}')">
                    <i class="fa fa-shield-alt text-primary"></i>
                </button>
                <button class="btn btn-sm btn-light border p-1" title="حذف العضو" onclick="confirmDeleteUser('${n}','${safeAttr(t.name)}')">
                    <i class="fa fa-trash-alt text-danger"></i>
                </button>`:r&&!e&&(d=`
                <button class="btn btn-sm btn-light border p-1" title="إزالة من الفرع" onclick="removeUserFromBranch('${n}','${safeAttr(t.name)}')">
                    <i class="fa fa-user-minus text-warning"></i>
                </button>`),`
            <div class="member-card d-flex align-items-center p-2 mb-2 bg-white border rounded-3 shadow-sm" style="direction:rtl;">
                <div style="width:50%;" class="text-start ps-2">
                    <div class="fw-bold text-dark" style="font-size:13px;">${o||"مستخدم جديد"}</div>
                    <div class="text-muted small" style="font-size:10px;">${esc(t.email)}</div>
                </div>
                <div style="width:25%;" class="text-center">
                    <span class="badge ${a}" style="font-size:9px;">${s}</span>
                </div>
                <div style="width:25%;" class="text-end d-flex justify-content-end gap-1">${d}</div>
            </div>`}).join("")}catch(l){t.innerHTML='<div class="alert alert-danger p-2 small text-center">خطأ في الاتصال، يرجى المحاولة لاحقاً</div>'}}};
