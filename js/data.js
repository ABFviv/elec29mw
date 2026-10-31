// ================================================
//  29MW Plant EMS — Core Data Layer
//  All data operations go through this module.
//  Designed to be easily replaced with API calls.
// ================================================

const DB = (() => {

  // ---- Keys ----
  const KEYS = {
    users: 'pc_users',
    dailyTemplate: 'pc_daily_template',
    dailyRecords: 'pc_daily_records',
    correctiveMaint: 'pc_corrective',
    preventiveMaint: 'pc_preventive',
    spareParts: 'pc_spare_parts',
    partsToOrder: 'pc_parts_order',
    trainingRecords: 'pc_training',
  };

  // ---- Helpers ----
  const load = (key, def = []) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? def; }
    catch { return def; }
  };

  const save = (key, val) => {
    localStorage.setItem(key, JSON.stringify(val));
  };

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now = () => new Date().toISOString();
  const today = () => new Date().toISOString().split('T')[0];

  // ---- Firebase Cloud Sync Helpers ----
  const fbSave = (coll, id, data) => {
    try {
      if (typeof window !== 'undefined' && window.FirebaseDB?.saveDoc) {
        window.FirebaseDB.saveDoc(coll, id, data);
      }
    } catch (e) {
      console.warn('[Firebase] Non-blocking save notice:', e);
    }
  };

  const fbDelete = (coll, id) => {
    try {
      if (typeof window !== 'undefined' && window.FirebaseDB?.deleteDoc) {
        window.FirebaseDB.deleteDoc(coll, id);
      }
    } catch (e) {
      console.warn('[Firebase] Non-blocking delete notice:', e);
    }
  };

  // ---- SEED default data ----
  // Version bump forces a re-seed of users when the team changes.
  const SEED_VERSION = '2';
  const seed = () => {
    // Force re-seed users if version changed
    if (localStorage.getItem('pc_seed_v') !== SEED_VERSION) {
      localStorage.removeItem(KEYS.users);
      localStorage.setItem('pc_seed_v', SEED_VERSION);
    }

    if (!load(KEYS.users).length) {
      save(KEYS.users, [
        // System admin (login only)
        { id: 'u0', username: 'admin', password: '1234', name: 'Administrator', role: 'System Administrator', initials: 'AD', dept: 'Management', active: true },
        // Fixed-hours team
        { id: 'u1', username: 'hameed', password: '1234', name: 'Hameed Tahsin', role: 'Electrical Supervisor', initials: 'HT', dept: 'Electrical', active: true },
        { id: 'u2', username: 'namo', password: '1234', name: 'Namo Hoshyar', role: 'Electrical Engineer', initials: 'NH', dept: 'Electrical', active: true },
        // Rotating-shift engineers
        { id: 'u3', username: 'baqi', password: '1234', name: 'Mohammed Baqi', role: 'Electrical Engineer', initials: 'MB', dept: 'Electrical', active: true },
        { id: 'u4', username: 'shwan', password: '1234', name: 'Mohammed Shwan', role: 'Electrical Engineer', initials: 'MS', dept: 'Electrical', active: true },
        { id: 'u5', username: 'zamwa', password: '1234', name: 'Zamwa Pshtiwan', role: 'Electrical Engineer', initials: 'ZP', dept: 'Electrical', active: true },
      ]);
    }

    // Seed daily check template
    if (!load(KEYS.dailyTemplate).length) {
      save(KEYS.dailyTemplate, [
        { id: 't1', category: 'Generator', name: 'Check generator oil level', description: 'Verify oil level is within normal operating range', critical: true },
        { id: 't2', category: 'Generator', name: 'Check generator cooling system', description: 'Inspect coolant level and look for leaks', critical: true },
        { id: 't3', category: 'Generator', name: 'Check generator vibration & noise', description: 'Listen for abnormal sounds, check vibration indicators', critical: false },
        { id: 't4', category: 'Transformer', name: 'Check transformer oil level & temperature', description: 'Verify oil level in sight glass, read thermometer', critical: true },
        { id: 't5', category: 'Transformer', name: 'Check transformer Buchholz relay', description: 'Inspect Buchholz relay for gas accumulation', critical: true },
        { id: 't6', category: 'Switchgear', name: 'Inspect MV switchgear panels', description: 'Visual inspection of panels, check indicator lights', critical: false },
        { id: 't7', category: 'Switchgear', name: 'Check bus bar temperature', description: 'Verify bus bar temperature using IR thermometer', critical: true },
        { id: 't8', category: 'Protection', name: 'Check protection relay status', description: 'Verify no relay trips or alarms are active', critical: true },
        { id: 't9', category: 'Battery', name: 'Check UPS battery status', description: 'Check UPS battery charge level and indicators', critical: false },
        { id: 't10', category: 'Battery', name: 'Check DC system voltage', description: 'Verify DC system voltage is within ±5% of nominal', critical: true },
        { id: 't11', category: 'Earthing', name: 'Inspect earthing connections', description: 'Visual check of main earthing connections and busbar', critical: false },
        { id: 't12', category: 'Safety', name: 'Verify fire suppression system', description: 'Check status indicators on fire suppression panels', critical: true },
        { id: 't13', category: 'Safety', name: 'Inspect emergency stop buttons', description: 'Verify all E-Stop buttons are accessible and labeled', critical: false },
        { id: 't14', category: 'Metering', name: 'Record active power output (MW)', description: 'Log current MW output from main power meter', critical: false },
        { id: 't15', category: 'Metering', name: 'Record power factor reading', description: 'Log power factor from metering panel', critical: false },
      ]);
    }
  };

  // ============ USERS ============
  const Users = {
    getAll: () => load(KEYS.users),
    getActive: () => load(KEYS.users).filter(u => u.active),
    getById: (id) => load(KEYS.users).find(u => u.id === id) || null,
    getByUsername: (username) => load(KEYS.users).find(u => u.username === username) || null,
    add: (data) => {
      const users = load(KEYS.users);
      const user = { id: uid(), ...data, createdAt: now() };
      users.push(user);
      save(KEYS.users, users);
      fbSave('users', user.id, user);
      return user;
    },
    update: (id, data) => {
      const users = load(KEYS.users).map(u => u.id === id ? { ...u, ...data, updatedAt: now() } : u);
      save(KEYS.users, users);
      const updated = users.find(u => u.id === id);
      if (updated) fbSave('users', id, updated);
    },
    deactivate: (id) => {
      const users = load(KEYS.users).map(u => u.id === id ? { ...u, active: false } : u);
      save(KEYS.users, users);
      const updated = users.find(u => u.id === id);
      if (updated) fbSave('users', id, updated);
    },
    changePassword: (usernameOrId, oldPassword, newPassword) => {
      const users = load(KEYS.users);
      const user = users.find(u =>
        (u.id === usernameOrId || u.username.toLowerCase() === String(usernameOrId).toLowerCase())
      );
      if (!user) {
        return { success: false, message: 'User not found.' };
      }
      if (user.password !== oldPassword) {
        return { success: false, message: 'Current (old) password is incorrect.' };
      }
      if (!newPassword || newPassword.trim().length < 3) {
        return { success: false, message: 'New password must be at least 3 characters long.' };
      }
      user.password = newPassword.trim();
      user.updatedAt = now();
      save(KEYS.users, users);
      fbSave('users', user.id, user);
      console.log(`[Firebase] ⚡ Password updated in database for user: ${user.username}`);
      return { success: true, message: 'Password updated successfully!' };
    },
  };

  // ============ DAILY CHECK TEMPLATE ============
  const DailyTemplate = {
    getAll: () => load(KEYS.dailyTemplate),
    add: (item) => {
      const items = load(KEYS.dailyTemplate);
      const newItem = { id: uid(), ...item };
      items.push(newItem);
      save(KEYS.dailyTemplate, items);
      fbSave('dailyTemplate', newItem.id, newItem);
      return newItem;
    },
    update: (id, data) => {
      const items = load(KEYS.dailyTemplate).map(i => i.id === id ? { ...i, ...data } : i);
      save(KEYS.dailyTemplate, items);
      const updated = items.find(i => i.id === id);
      if (updated) fbSave('dailyTemplate', id, updated);
    },
    remove: (id) => {
      save(KEYS.dailyTemplate, load(KEYS.dailyTemplate).filter(i => i.id !== id));
      fbDelete('dailyTemplate', id);
    },
  };

  // ============ DAILY CHECK RECORDS ============
  const DailyRecords = {
    getForDate: (date) => {
      const all = load(KEYS.dailyRecords, {});
      return all[date] || null;
    },
    getAllDates: () => Object.keys(load(KEYS.dailyRecords, {})).sort().reverse(),
    initForDate: (date) => {
      const all = load(KEYS.dailyRecords, {});
      if (!all[date]) {
        const template = load(KEYS.dailyTemplate);
        all[date] = {
          date,
          items: template.map(t => ({ ...t, done: false, doneBy: '', doneAt: null, notes: '' })),
          createdAt: now(),
        };
        save(KEYS.dailyRecords, all);
        fbSave('dailyRecords', date, all[date]);
      }
      return all[date];
    },
    updateItem: (date, itemId, updates) => {
      const all = load(KEYS.dailyRecords, {});
      if (!all[date]) return;
      all[date].items = all[date].items.map(i => i.id === itemId ? { ...i, ...updates } : i);
      all[date].updatedAt = now();
      save(KEYS.dailyRecords, all);
      fbSave('dailyRecords', date, all[date]);
    },
    getRecentDays: (n = 30) => {
      const all = load(KEYS.dailyRecords, {});
      return Object.entries(all)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, n)
        .map(([date, rec]) => ({
          date,
          total: rec.items.length,
          done: rec.items.filter(i => i.done).length,
        }));
    },
  };

  // ============ CORRECTIVE MAINTENANCE ============
  const Corrective = {
    getAll: () => load(KEYS.correctiveMaint).sort((a, b) => b.createdAt?.localeCompare(a.createdAt)),
    getById: (id) => load(KEYS.correctiveMaint).find(r => r.id === id) || null,
    add: (data) => {
      const records = load(KEYS.correctiveMaint);
      const record = { id: uid(), ...data, createdAt: now() };
      records.push(record);
      save(KEYS.correctiveMaint, records);
      fbSave('correctiveMaint', record.id, record);
      return record;
    },
    update: (id, data) => {
      const records = load(KEYS.correctiveMaint).map(r => r.id === id ? { ...r, ...data, updatedAt: now() } : r);
      save(KEYS.correctiveMaint, records);
      const updated = records.find(r => r.id === id);
      if (updated) fbSave('correctiveMaint', id, updated);
    },
    remove: (id) => {
      save(KEYS.correctiveMaint, load(KEYS.correctiveMaint).filter(r => r.id !== id));
      fbDelete('correctiveMaint', id);
    },
    getStats: () => {
      const all = load(KEYS.correctiveMaint);
      return {
        total: all.length,
        open: all.filter(r => r.status === 'open').length,
        inProgress: all.filter(r => r.status === 'in-progress').length,
        closed: all.filter(r => r.status === 'closed').length,
      };
    },
  };

  // ============ PREVENTIVE MAINTENANCE ============
  const Preventive = {
    getAll: () => load(KEYS.preventiveMaint).sort((a, b) => a.scheduledDate?.localeCompare(b.scheduledDate)),
    getById: (id) => load(KEYS.preventiveMaint).find(r => r.id === id) || null,
    add: (data) => {
      const records = load(KEYS.preventiveMaint);
      const record = { id: uid(), ...data, createdAt: now() };
      records.push(record);
      save(KEYS.preventiveMaint, records);
      fbSave('preventiveMaint', record.id, record);
      return record;
    },
    update: (id, data) => {
      const records = load(KEYS.preventiveMaint).map(r => r.id === id ? { ...r, ...data, updatedAt: now() } : r);
      save(KEYS.preventiveMaint, records);
      const updated = records.find(r => r.id === id);
      if (updated) fbSave('preventiveMaint', id, updated);
    },
    remove: (id) => {
      save(KEYS.preventiveMaint, load(KEYS.preventiveMaint).filter(r => r.id !== id));
      fbDelete('preventiveMaint', id);
    },
    getStats: () => {
      const all = load(KEYS.preventiveMaint);
      const nowDate = today();
      return {
        total: all.length,
        upcoming: all.filter(r => r.status === 'planned' && r.scheduledDate >= nowDate).length,
        overdue: all.filter(r => r.status === 'planned' && r.scheduledDate < nowDate).length,
        done: all.filter(r => r.status === 'completed').length,
      };
    },
  };

  // ============ SPARE PARTS — STORAGE ============
  const SpareParts = {
    getAll: () => load(KEYS.spareParts).sort((a, b) => a.partName?.localeCompare(b.partName)),
    getById: (id) => load(KEYS.spareParts).find(p => p.id === id) || null,
    add: (data) => {
      const parts = load(KEYS.spareParts);
      const part = { id: uid(), ...data, addedAt: now() };
      parts.push(part);
      save(KEYS.spareParts, parts);
      fbSave('spareParts', part.id, part);
      return part;
    },
    update: (id, data) => {
      const parts = load(KEYS.spareParts).map(p => p.id === id ? { ...p, ...data, updatedAt: now() } : p);
      save(KEYS.spareParts, parts);
      const updated = parts.find(p => p.id === id);
      if (updated) fbSave('spareParts', id, updated);
    },
    remove: (id) => {
      save(KEYS.spareParts, load(KEYS.spareParts).filter(p => p.id !== id));
      fbDelete('spareParts', id);
    },
    getLowStock: () => load(KEYS.spareParts).filter(p => p.quantity <= p.minStock),
    getStats: () => {
      const all = load(KEYS.spareParts);
      return {
        total: all.length,
        totalItems: all.reduce((s, p) => s + Number(p.quantity), 0),
        lowStock: all.filter(p => p.quantity <= p.minStock).length,
      };
    },
  };

  // ============ SPARE PARTS — TO ORDER ============
  const PartsToOrder = {
    getAll: () => load(KEYS.partsToOrder).sort((a, b) => b.requestedAt?.localeCompare(a.requestedAt)),
    add: (data) => {
      const orders = load(KEYS.partsToOrder);
      const order = { id: uid(), ...data, requestedAt: now(), status: 'pending' };
      orders.push(order);
      save(KEYS.partsToOrder, orders);
      fbSave('partsToOrder', order.id, order);
      return order;
    },
    update: (id, data) => {
      const orders = load(KEYS.partsToOrder).map(o => o.id === id ? { ...o, ...data, updatedAt: now() } : o);
      save(KEYS.partsToOrder, orders);
      const updated = orders.find(o => o.id === id);
      if (updated) fbSave('partsToOrder', id, updated);
    },
    remove: (id) => {
      save(KEYS.partsToOrder, load(KEYS.partsToOrder).filter(o => o.id !== id));
      fbDelete('partsToOrder', id);
    },
  };

  // ============ MONTHLY SCHEDULE (Shift-Based Daily Checks) ============
  const MonthlySchedule = {
    _key: (year, month) => `pc_sched_${year}_${String(month).padStart(2, '0')}`,
    save: (data) => {
      localStorage.setItem(MonthlySchedule._key(data.year, data.month), JSON.stringify(data));
      if (data && data.year && data.month) {
        fbSave('monthlySchedules', `${data.year}_${String(data.month).padStart(2, '0')}`, data);
      }
      return data;
    },
    load: (year, month) => {
      try { const r = localStorage.getItem(MonthlySchedule._key(year, month)); return r ? JSON.parse(r) : null; }
      catch { return null; }
    },
    exists: (year, month) => !!localStorage.getItem(MonthlySchedule._key(year, month)),
    getForDate: (dateStr) => {
      const [y, m] = dateStr.split('-').map(Number);
      const s = MonthlySchedule.load(y, m);
      return s ? (s.days.find(d => d.date === dateStr) || null) : null;
    },
    markShift: (dateStr, slotKey, status, employee, notes) => {
      // slotKey: '1a' | '1b' | '2a' | '2b' | '3a' | '3b'
      const [y, m] = dateStr.split('-').map(Number);
      const sched = MonthlySchedule.load(y, m);
      if (!sched) return false;
      const day = sched.days.find(d => d.date === dateStr);
      if (!day) return false;
      day[`status${slotKey}`] = status;
      day[`doneBy${slotKey}`] = employee;
      day[`doneAt${slotKey}`] = now();
      day[`notes${slotKey}`] = notes || '';
      MonthlySchedule.save(sched);
      return true;
    },
    unmarkShift: (dateStr, slotKey) => {
      const [y, m] = dateStr.split('-').map(Number);
      const sched = MonthlySchedule.load(y, m);
      if (!sched) return false;
      const day = sched.days.find(d => d.date === dateStr);
      if (!day) return false;
      day[`status${slotKey}`] = 'pending'; day[`doneBy${slotKey}`] = null;
      day[`doneAt${slotKey}`] = null; day[`notes${slotKey}`] = '';
      MonthlySchedule.save(sched);
      return true;
    },
    getStats: (year, month) => {
      const sched = MonthlySchedule.load(year, month);
      if (!sched) return { exists: false, done: 0, pending: 0, total: 0, todayDone: 0, todayTotal: 6 };
      let done = 0, skipped = 0, pending = 0;
      sched.days.forEach(d => {
        ['status1a', 'status1b', 'status2a', 'status2b', 'status3a', 'status3b'].forEach(k => {
          const s = d[k];
          if (s === 'done') done++; else if (s === 'skipped') skipped++; else pending++;
        });
      });
      const todayStr = new Date().toISOString().split('T')[0];
      const td = sched.days.find(d => d.date === todayStr);
      const todayDone = td
        ? ['status1a', 'status1b', 'status2a', 'status2b', 'status3a', 'status3b'].filter(k => td[k] === 'done').length
        : 0;
      return {
        exists: true, done, skipped, pending, total: sched.totalSlots,
        todayDone, todayTotal: 6,
      };
    },
  };

  // ============ TRAINING ============
  const Training = {
    getAll: () => load(KEYS.trainingRecords).sort((a, b) => b.date?.localeCompare(a.date)),
    getById: (id) => load(KEYS.trainingRecords).find(r => r.id === id) || null,
    add: (data) => {
      const records = load(KEYS.trainingRecords);
      const record = { id: uid(), ...data, addedAt: now() };
      records.push(record);
      save(KEYS.trainingRecords, records);
      fbSave('trainingRecords', record.id, record);
      return record;
    },
    update: (id, data) => {
      const records = load(KEYS.trainingRecords).map(r => r.id === id ? { ...r, ...data } : r);
      save(KEYS.trainingRecords, records);
      const updated = records.find(r => r.id === id);
      if (updated) fbSave('trainingRecords', id, updated);
    },
    remove: (id) => {
      save(KEYS.trainingRecords, load(KEYS.trainingRecords).filter(r => r.id !== id));
      fbDelete('trainingRecords', id);
    },
    getByEmployee: (name) => load(KEYS.trainingRecords).filter(r => r.employeeName === name),
    getStats: () => {
      const all = load(KEYS.trainingRecords);
      const employees = [...new Set(all.map(r => r.employeeName))];
      return { total: all.length, employees: employees.length };
    },
  };

  // ============ HISTORY (cross-module) ============
  const History = {
    getAll: () => {
      const items = [];

      // Daily check completions
      const records = load(KEYS.dailyRecords, {});
      Object.entries(records).forEach(([date, rec]) => {
        rec.items.filter(i => i.done).forEach(item => {
          items.push({
            type: 'daily-check', date, title: item.name,
            detail: `Daily check item completed`, person: item.doneBy,
            category: item.category, module: 'Daily Check',
          });
        });
      });

      // CM
      load(KEYS.correctiveMaint).forEach(r => {
        items.push({
          type: 'corrective', date: r.date || r.createdAt?.split('T')[0],
          title: r.equipment, detail: r.problemDescription,
          person: r.technician, category: r.status, module: 'Corrective Maintenance',
          id: r.id,
        });
      });

      // PM
      load(KEYS.preventiveMaint).forEach(r => {
        items.push({
          type: 'preventive', date: r.scheduledDate,
          title: r.equipment, detail: r.task,
          person: r.assignedTo, category: r.status, module: 'Preventive Maintenance',
          id: r.id,
        });
      });

      // Spare parts
      load(KEYS.spareParts).forEach(r => {
        items.push({
          type: 'spare-part', date: r.addedAt?.split('T')[0],
          title: r.partName, detail: `Qty: ${r.quantity} ${r.unit || 'pcs'} — ${r.location || ''}`,
          person: '', category: 'inventory', module: 'Spare Parts',
          id: r.id,
        });
      });

      // Training
      load(KEYS.trainingRecords).forEach(r => {
        items.push({
          type: 'training', date: r.date,
          title: r.seminarTitle, detail: r.topic,
          person: r.employeeName, category: 'training', module: 'Training',
          id: r.id,
        });
      });

      return items.filter(i => i.date).sort((a, b) => b.date.localeCompare(a.date));
    },
  };

  // ---- Session helpers ----
  const Session = {
    get: () => JSON.parse(localStorage.getItem('pcSession') || sessionStorage.getItem('pcSession') || 'null'),
    require: () => {
      const s = Session.get();
      if (!s?.user) { window.location.href = '../index.html'; return null; }
      return s;
    },
    logout: () => {
      localStorage.removeItem('pcSession');
      sessionStorage.removeItem('pcSession');
      window.location.href = '../index.html';
    },
  };

  // ---- Format helpers ----
  const fmt = {
    date: (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
    dateShort: (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—',
    datetime: (d) => d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—',
    today: () => today(),
  };

  // Auto-sync real-time data from Firebase in background via single lightweight beacon (Zero excessive reads)
  const initCloudSync = async () => {
    if (typeof window === 'undefined' || !window.FirebaseDB) return;

    try {
      // Listen to the single _system/sync doc (1 read only)
      // When ANY user writes from any PC or mobile, _system/sync changes and notifies this browser
      if (typeof window.firebase !== 'undefined' && window.firebase.firestore) {
        const db = window.firebase.firestore();
        db.collection('_system').doc('sync').onSnapshot(snap => {
          if (!snap.exists) return;
          const data = snap.data();
          const lastUpdated = data?.lastUpdated;
          const localUpdated = localStorage.getItem('pc_last_cloud_updated');

          if (lastUpdated && lastUpdated !== localUpdated) {
            localStorage.setItem('pc_last_cloud_updated', lastUpdated);
            // Refresh with smart sync for only the affected collection
            if (window.FirebaseDB.pullCloudData) {
              window.FirebaseDB.pullCloudData(true);
            }
          }
        }, err => {
          // Gracefully handle permission or network note
        });
      }
    } catch (e) {}
  };

  // Init seed on load
  seed();
  initCloudSync();

  return {
    Users,
    DailyTemplate,
    DailyRecords,
    Corrective,
    Preventive,
    SpareParts,
    PartsToOrder,
    MonthlySchedule,
    Training,
    History,
    Session,
    fmt,
    uid,
    now,
    today
  };
})();

// ---- Global Change Password Modal for Logged-In Users ----
if (typeof window !== 'undefined') {
  window.openAppChangePasswordModal = function () {
    const session = DB.Session.get();
    if (!session?.user) return;

    let modal = document.getElementById('appChangePassModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'appChangePassModal';
      modal.className = 'modal-overlay';
      modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:9999;align-items:center;justify-content:center;padding:16px;';
      modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

      modal.innerHTML = `
        <div class="modal" style="max-width:440px;width:100%;background:#0e1726;border:1px solid rgba(255,255,255,0.12);border-radius:18px;color:#fff;box-shadow:0 24px 60px rgba(0,0,0,0.6);overflow:hidden;">
          <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.02);">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,rgba(0,212,255,0.2),rgba(0,102,255,0.2));display:flex;align-items:center;justify-content:center;color:#00d4ff;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div>
                <h3 style="margin:0;font-size:16px;font-weight:600;">Change Password</h3>
                <span style="font-size:12px;color:#8e9bb0;">User: <strong id="acp_user_label" style="color:#00d4ff;"></strong></span>
              </div>
            </div>
            <button class="modal-close" type="button" onclick="document.getElementById('appChangePassModal').style.display='none'" style="background:none;border:none;color:#8e9bb0;font-size:24px;cursor:pointer;line-height:1;">&times;</button>
          </div>

          <form id="appChangePassForm" style="padding:22px;display:flex;flex-direction:column;gap:14px;">
            <div class="form-group" style="display:flex;flex-direction:column;gap:6px;">
              <label style="font-size:12px;color:#8e9bb0;font-weight:500;">Current (Old) Password</label>
              <input type="password" id="acp_old_pass" placeholder="Enter your current password" required
                style="width:100%;box-sizing:border-box;background:#152238;border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#fff;padding:10px 14px;font-size:13.5px;outline:none;" />
            </div>

            <div class="form-group" style="display:flex;flex-direction:column;gap:6px;">
              <label style="font-size:12px;color:#8e9bb0;font-weight:500;">New Password</label>
              <input type="password" id="acp_new_pass" placeholder="Enter new password (min 3 chars)" required
                style="width:100%;box-sizing:border-box;background:#152238;border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#fff;padding:10px 14px;font-size:13.5px;outline:none;" />
            </div>

            <div class="form-group" style="display:flex;flex-direction:column;gap:6px;">
              <label style="font-size:12px;color:#8e9bb0;font-weight:500;">Confirm New Password</label>
              <input type="password" id="acp_confirm_pass" placeholder="Re-type new password" required
                style="width:100%;box-sizing:border-box;background:#152238;border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#fff;padding:10px 14px;font-size:13.5px;outline:none;" />
            </div>

            <div id="acp_msg" style="display:none;padding:10px 14px;border-radius:8px;font-size:12.5px;"></div>

            <div style="display:flex;gap:10px;margin-top:6px;">
              <button type="button" class="btn-secondary" onclick="document.getElementById('appChangePassModal').style.display='none'"
                style="flex:1;justify-content:center;padding:11px;border-radius:8px;cursor:pointer;background:rgba(255,255,255,0.06);color:#fff;border:1px solid rgba(255,255,255,0.12);font-weight:500;">Cancel</button>
              <button type="submit" class="btn-primary"
                style="flex:1.5;justify-content:center;padding:11px;border-radius:8px;cursor:pointer;background:linear-gradient(135deg,#00d4ff,#0066ff);color:#fff;border:none;font-weight:600;">Update Password</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById('appChangePassForm').onsubmit = function (e) {
        e.preventDefault();
        const curSession = DB.Session.get();
        if (!curSession?.user) return;
        const oldPass = document.getElementById('acp_old_pass').value;
        const newPass = document.getElementById('acp_new_pass').value;
        const confirmPass = document.getElementById('acp_confirm_pass').value;

        if (!oldPass) {
          setAcpMsg('Please enter your current (old) password.', 'error');
          return;
        }
        if (!newPass || newPass.length < 3) {
          setAcpMsg('New password must be at least 3 characters long.', 'error');
          return;
        }
        if (newPass !== confirmPass) {
          setAcpMsg('New passwords do not match.', 'error');
          return;
        }
        if (oldPass === newPass) {
          setAcpMsg('New password must be different from current password.', 'error');
          return;
        }

        const res = DB.Users.changePassword(curSession.user.id, oldPass, newPass);
        if (res.success) {
          setAcpMsg('✅ ' + res.message, 'success');
          setTimeout(() => {
            modal.style.display = 'none';
          }, 1400);
        } else {
          setAcpMsg('❌ ' + res.message, 'error');
        }
      };
    }

    function setAcpMsg(text, type) {
      const msgEl = document.getElementById('acp_msg');
      if (!msgEl) return;
      msgEl.style.display = 'block';
      msgEl.style.color = type === 'success' ? '#00e676' : '#ff4757';
      msgEl.style.background = type === 'success' ? 'rgba(0, 230, 118, 0.12)' : 'rgba(255, 71, 87, 0.12)';
      msgEl.style.border = type === 'success' ? '1px solid rgba(0, 230, 118, 0.3)' : '1px solid rgba(255, 71, 87, 0.3)';
      msgEl.textContent = text;
    }

    document.getElementById('acp_user_label').textContent = session.user.name + ' (@' + session.user.username + ')';
    document.getElementById('acp_old_pass').value = '';
    document.getElementById('acp_new_pass').value = '';
    document.getElementById('acp_confirm_pass').value = '';
    const msgEl = document.getElementById('acp_msg');
    if (msgEl) msgEl.style.display = 'none';

    modal.style.display = 'flex';
  };
}
