# RBAC Manual QA Checklist
**Role-Based Access Control Implementation**  
**Date**: 2026-02-06  
**Version**: 1.0

---

## Pre-Requisites

**Test Accounts Required**:
1. Admin user (existing)
2. Secretary user (create via Settings > Utilizadores)
3. Doctor user (create via Settings > Utilizadores)

**Database Setup**:
- Ensure `professionals` table has `user_id` column (migration 20260129234954)
- For doctor testing: Link doctor user to a professional via SQL:
  ```sql
  UPDATE professionals 
  SET user_id = (SELECT id FROM auth.users WHERE email = 'doctor@test.com')
  WHERE id = '<professional_id>';
  ```

---

## TEST 1: ADMIN Role - Full Access

### 1.1: Login
**Steps**:
1. Navigate to `/admin/login`
2. Enter admin credentials
3. Click "Entrar"

**Expected**:
- ✅ Redirected to `/admin/dashboard`
- ✅ No errors

### 1.2: Sidebar Menu
**Expected Visible Items**:
- ✅ Dashboard
- ✅ Agenda
- ✅ Pedidos
- ✅ Pacientes
- ✅ **Estatísticas** (admin only)
- ✅ Sala de Espera
- ✅ Configurações (bottom)
- ✅ Sair (bottom)

### 1.3: Route Access
**Steps**: Navigate to each route manually

**Expected**:
- ✅ `/admin/dashboard` - accessible
- ✅ `/admin/agenda` - accessible, shows ALL professionals' appointments
- ✅ `/admin/pedidos` - accessible
- ✅ `/admin/pacientes` - accessible
- ✅ `/admin/estatisticas` - **accessible** (admin only)
- ✅ `/admin/sala-espera` - accessible, shows ALL appointments
- ✅ `/admin/configuracoes` - **accessible** (admin + secretary)

### 1.4: Settings Features
**Steps**:
1. Navigate to `/admin/configuracoes`
2. Scroll to "Tipos de Consulta" card

**Expected**:
- ✅ "Novo" button **visible**
- ✅ Button opens ManageConsultationTypesModal
- ✅ Can create/edit/delete consultation types

**Steps**:
1. Scroll to "Utilizadores" card

**Expected**:
- ✅ Invite form **visible**
- ✅ Can invite new users (secretary/doctor)

---

## TEST 2: SECRETARY Role - Limited Access

### 2.1: Login
**Steps**:
1. Log out admin
2. Log in with secretary credentials

**Expected**:
- ✅ Login succeeds (no immediate logout)
- ✅ Redirected to `/admin/dashboard`

### 2.2: Sidebar Menu
**Expected Visible Items**:
- ✅ Dashboard
- ✅ Agenda
- ✅ Pedidos
- ✅ Pacientes
- ❌ **Estatísticas HIDDEN** (admin only)
- ✅ Sala de Espera
- ✅ Configurações (bottom)
- ✅ Sair (bottom)

### 2.3: Route Access
**Expected**:
- ✅ `/admin/dashboard` - accessible
- ✅ `/admin/agenda` - accessible, professional filter visible
- ✅ `/admin/pedidos` - accessible
- ✅ `/admin/pacientes` - accessible, all patients visible
- ❌ `/admin/estatisticas` - **BLOCKED**, redirected to `/admin/dashboard`
- ✅ `/admin/sala-espera` - accessible, all appointments visible
- ✅ `/admin/configuracoes` - **accessible**

### 2.4: Settings Features
**Steps**:
1. Navigate to `/admin/configuracoes`
2. Scroll to "Tipos de Consulta" card

**Expected**:
- ✅ "Novo" button **visible** (secretary can manage types)
- ✅ Button works, modal opens

**Steps**:
1. Scroll to "Utilizadores" card

**Expected**:
- ❌ Invite form **HIDDEN** (admin only - based on current implementation with Badge logic)
- ℹ️ Note: Current implementation shows Badge but hides form for non-admin

---

## TEST 3: DOCTOR Role - Restricted Access

### 3.1: Login
**Steps**:
1. Log out secretary
2. Log in with doctor credentials

**Expected**:
- ✅ Login succeeds
- ✅ Redirected to `/admin/dashboard` OR `/admin/agenda`

### 3.2: Sidebar Menu
**Expected Visible Items**:
- ✅ Dashboard
- ✅ Agenda
- ❌ **Pedidos HIDDEN** (admin + secretary only)
- ✅ Pacientes
- ❌ **Estatísticas HIDDEN** (admin only)
- ✅ Sala de Espera
- ❌ **Configurações HIDDEN** (admin + secretary only)
- ✅ Sair (bottom)

### 3.3: Route Access
**Expected**:
- ✅ `/admin/dashboard` - accessible
- ✅ `/admin/agenda` - accessible, **ONLY shows doctor's own appointments**
- ❌ `/admin/pedidos` - accessible but redundant (sidebar hides it)
- ✅ `/admin/pacientes` - accessible, all patients visible
- ❌ `/admin/estatisticas` - **BLOCKED**, redirected to `/admin/agenda`
- ✅ `/admin/sala-espera` - accessible, **ONLY shows doctor's own appointments**
- ❌ `/admin/configuracoes` - **BLOCKED**, redirected to `/admin/agenda`

### 3.4: Agenda Page - Data Filtering
**Steps**:
1. Navigate to `/admin/agenda`
2. Check visible appointments

**Expected**:
- ✅ Professional filter dropdown **HIDDEN** (doctor can only see own agenda)
- ✅ **ONLY appointments where `professional_id = doctor's professional_id`** visible
- ✅ Cannot see other doctors' appointments

**SQL Verification**:
```sql
-- Find doctor's professional_id
SELECT p.id, p.name, p.user_id 
FROM professionals p 
WHERE p.user_id = (SELECT id FROM auth.users WHERE email = 'doctor@test.com');

-- Verify appointments shown match
SELECT id, date, time, professional_id, status 
FROM appointments 
WHERE professional_id = '<doctor_professional_id>' 
AND date = CURRENT_DATE;
```

### 3.5: Sala de Espera - Data Filtering
**Steps**:
1. Navigate to `/admin/sala-espera`
2. Check visible appointments in all columns

**Expected**:
- ✅ **ONLY appointments where `professional_id = doctor's professional_id`** visible
- ✅ Other doctors' appointments NOT shown
- ✅ Can drag/drop only own appointments

### 3.6: Settings - Blocked Access
**Steps**:
1. Manually navigate to `/admin/configuracoes`

**Expected**:
- ❌ **Redirected to `/admin/agenda`** (doctor not allowed)
- ✅ No error messages (graceful redirect)

---

## TEST 4: Cross-Role Edge Cases

### 4.1: Doctor Without Professional Link
**Setup**: Create doctor user WITHOUT linking to `professionals.user_id`

**Expected**:
- ✅ Login succeeds
- ✅ Agenda page loads but shows NO appointments (empty)
- ✅ No crashes or errors

### 4.2: Invalid Role Navigation
**Steps**:
1. Log in as secretary
2. Manually navigate to `/admin/estatisticas`

**Expected**:
- ✅ Redirected to `/admin/dashboard` (secretary's fallback)
- ✅ No error toast

**Steps**:
1. Log in as doctor
2. Manually navigate to `/admin/configuracoes`

**Expected**:
- ✅ Redirected to `/admin/agenda` (doctor's fallback)
- ✅ No error toast

### 4.3: Sidebar Consistency
**For Each Role**: Verify sidebar items match expected list exactly (no extra items, no missing items)

---

## TEST 5: Settings "Tipos" Button Visibility

### 5.1: Admin
**Expected**: ✅ "Novo" button visible and functional

### 5.2: Secretary
**Expected**: ✅ "Novo" button visible and functional

### 5.3: Doctor
**Expected**: ❌ "Novo" button **HIDDEN** (cannot manage consultation types)

---

## Smoke Test (10 Minutes)

**Quick validation across all roles**:

1. **Admin**:
   - ✅ Login → Dashboard loads
   - ✅ Estatísticas accessible
   - ✅ Configurações accessible
   - ✅ Settings > Tipos > Novo button works
   - ✅ Agenda shows all professionals

2. **Secretary**:
   - ✅ Login → Dashboard loads
   - ✅ Estatísticas sidebar item HIDDEN
   - ✅ Configurações accessible
   - ✅ Settings > Tipos > Novo button works
   - ✅ Pedidos accessible

3. **Doctor**:
   - ✅ Login → redirected to Agenda
   - ✅ Pedidos sidebar item HIDDEN
   - ✅ Configurações sidebar item HIDDEN
   - ✅ Agenda shows ONLY own appointments
   - ✅ Sala de Espera shows ONLY own patients
   - ✅ Cannot access /admin/configuracoes (redirected)

---

## Known Limitations

### L1: Doctor Professional Mapping Required
**Impact**: Doctors must have `professionals.user_id` set, otherwise they see empty agendas  
**Workaround**: Manually link via SQL after creating doctor account

### L2: Professional Selector Hidden for Doctors
**Impact**: Doctors cannot switch views (by design)  
**Status**: Intentional restriction per RBAC rules

### L3: Settings "Tipos" Button for Secretary
**Status**: Secretary CAN manage consultation types (business decision)  
**Rationale**: Secretary needs to manage clinic operations including types

---

## SQL Diagnostic Queries

**Check user roles**:
```sql
SELECT u.email, ur.role 
FROM auth.users u 
JOIN user_roles ur ON u.id = ur.user_id 
ORDER BY ur.role, u.email;
```

**Check professional-user mappings**:
```sql
SELECT p.id, p.name, p.user_id, u.email 
FROM professionals p 
LEFT JOIN auth.users u ON p.user_id = u.id 
ORDER BY p.name;
```

**Verify doctor's appointments visible**:
```sql
-- Replace with actual doctor user_id
SELECT a.id, a.date, a.time, a.status, p.name AS professional_name
FROM appointments a
JOIN professionals p ON a.professional_id = p.id
WHERE p.user_id = '<doctor_user_id>'
AND a.date >= CURRENT_DATE
ORDER BY a.date, a.time;
```

---

**End of Checklist**
