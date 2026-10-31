// ========================================
//  29MW Plant EMS — Dashboard Logic
//  Pulls real data from DB (data.js)
//  Uses Schedule engine (schedule.js)
// ========================================

// ---- Avatar colours per person ----
const AVATAR_COLORS = {
  'Hameed Tahsin':    'linear-gradient(135deg,#f0a500,#ff6b00)',
  'Namo Hoshyar':     'linear-gradient(135deg,#00d4ff,#0066ff)',
  'Mohammed Baqi':    'linear-gradient(135deg,#00e676,#00bcd4)',
  'Mohammed Shwan':   'linear-gradient(135deg,#a78bfa,#7c3aed)',
  'Zamwa Pshtiwan':   'linear-gradient(135deg,#fb7185,#f43f5e)',
};

// ---- Shift dot colours ----
const SHIFT_DOT_COLORS = {
  morning:   '#00d4ff',
  afternoon: '#f0a500',
  night:     '#a78bfa',
};


function getSession() {
  return JSON.parse(localStorage.getItem('pcSession') || sessionStorage.getItem('pcSession') || 'null');
}

function requireAuth() {
  const s = getSession();
  if (!s?.user) { window.location.href = 'index.html'; return null; }
  return s;
}

function logout() {
  localStorage.removeItem('pcSession');
  sessionStorage.removeItem('pcSession');
  window.location.href = 'index.html';
}

// ---- User info ----
function populateUser(session) {
  const u = session.user;
  const av  = document.getElementById('userAvatar');
  const nm  = document.getElementById('userName');
  const rl  = document.getElementById('userRole');
  if (av) av.textContent  = u.initials || u.name.slice(0,2).toUpperCase();
  if (nm) nm.textContent  = u.name;
  if (rl) rl.textContent  = u.role;
}

// ---- Greeting ----
function setGreeting(session) {
  const el = document.getElementById('dashGreeting');
  if (!el) return;
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  el.textContent = `${greet}, ${session.user.name}`;
}

// ---- Clock & Live Auto-Update ----
function startClock() {
  let lastMinute = -1;
  function tick() {
    const n = new Date(), p = x => String(x).padStart(2,'0');
    const el = document.getElementById('dashClock');
    if (el) el.textContent = `${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`;

    if (lastMinute !== n.getMinutes()) {
      lastMinute = n.getMinutes();
      renderTeamStatus();
    }
  }
  tick();
  setInterval(tick, 1000);
}

// ---- User dropdown ----
function setupUserMenu() {
  const btn = document.getElementById('userMenuBtn');
  const dd  = document.getElementById('userDropdown');
  if (!btn || !dd) return;

  btn.addEventListener('click', e => {
    e.stopPropagation();
    dd.classList.toggle('open');
    const chev = btn.querySelector('.user-chevron svg');
    if (chev) chev.style.transform = dd.classList.contains('open') ? 'rotate(180deg)' : '';
  });

  document.addEventListener('click', () => {
    dd.classList.remove('open');
    const chev = btn?.querySelector('.user-chevron svg');
    if (chev) chev.style.transform = '';
  });
}

// ---- Status Banner ----
function renderStatusBanner() {
  const today   = DB.fmt.today();
  const todayRec = DB.DailyRecords.getForDate(today);
  const cmStats  = DB.Corrective.getStats();
  const pmStats  = DB.Preventive.getStats();
  const spStats  = DB.SpareParts.getStats();

  const checkPct = todayRec
    ? Math.round((todayRec.items.filter(i=>i.done).length / (todayRec.items.length||1)) * 100)
    : null;

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  document.getElementById('statusBanner').innerHTML = `
    <div class="status-items">
      <div class="status-item">
        <div class="status-dot ${checkPct === 100 ? 'ok' : checkPct === null ? 'warn' : 'warn'}"></div>
        <span class="status-label">Today's Checks</span>
        <span class="status-val">${checkPct !== null ? checkPct + '% done' : 'Not started'}</span>
      </div>
      <div class="status-item">
        <div class="status-dot ${cmStats.open === 0 ? 'ok' : 'alert'}"></div>
        <span class="status-label">Open Work Orders</span>
        <span class="status-val">${cmStats.open} open</span>
      </div>
      <div class="status-item">
        <div class="status-dot ${pmStats.total > 0 ? 'warn' : 'ok'}"></div>
        <span class="status-label">PM Watchlist</span>
        <span class="status-val">${pmStats.total} items</span>
      </div>
      <div class="status-item">
        <div class="status-dot ${spStats.lowStock === 0 ? 'ok' : 'warn'}"></div>
        <span class="status-label">Low Stock Alerts</span>
        <span class="status-val">${spStats.lowStock} parts</span>
      </div>
    </div>
    <div class="status-time">${dateStr}</div>
  `;
}

// ---- Quick Stats ----
function renderQuickStats() {
  const today    = DB.fmt.today();
  const todayRec = DB.DailyRecords.getForDate(today);
  const cmStats  = DB.Corrective.getStats();
  const pmStats  = DB.Preventive.getStats();
  const trStats  = DB.Training.getStats();

  const checkDone  = todayRec ? todayRec.items.filter(i=>i.done).length : 0;
  const checkTotal = todayRec ? todayRec.items.length : 0;

  document.getElementById('quickStats').innerHTML = `
    <div class="qstat">
      <div class="qstat-icon" style="background:rgba(0,240,255,0.12);border:1px solid rgba(0,240,255,0.25);">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="1.8" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      </div>
      <div class="qstat-info">
        <div class="qstat-val" style="color:#00f0ff;">${checkDone}/${checkTotal}</div>
        <div class="qstat-lbl">Today's Check Items</div>
      </div>
      <span class="qstat-trend ${checkDone===checkTotal&&checkTotal>0?'trend-up':'trend-warn'}">${checkTotal===0?'No template':checkDone===checkTotal?'✓ Done':'Pending'}</span>
    </div>

    <div class="qstat">
      <div class="qstat-icon" style="background:rgba(255,51,102,0.12);border:1px solid rgba(255,51,102,0.25);">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff3366" stroke-width="1.8" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
      </div>
      <div class="qstat-info">
        <div class="qstat-val" style="color:#ff3366;">${cmStats.open}</div>
        <div class="qstat-lbl">Open CM Work Orders</div>
      </div>
      <span class="qstat-trend ${cmStats.open===0?'trend-up':'trend-red'}">${cmStats.open===0?'All clear':'Needs attention'}</span>
    </div>

    <div class="qstat">
      <div class="qstat-icon" style="background:rgba(255,179,0,0.12);border:1px solid rgba(255,179,0,0.25);">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffb300" stroke-width="1.8" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
      <div class="qstat-info">
        <div class="qstat-val" style="color:#ffb300;">${pmStats.total}</div>
        <div class="qstat-lbl">Equipment on Watch</div>
      </div>
      <span class="qstat-trend ${pmStats.total>0?'trend-warn':'trend-up'}">${pmStats.total>0?'Monitoring':'All clear'}</span>
    </div>

    <div class="qstat">
      <div class="qstat-icon" style="background:rgba(244,63,94,0.1);border:1px solid rgba(244,63,94,0.2);">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fb7185" stroke-width="1.8" stroke-linecap="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
      </div>
      <div class="qstat-info">
        <div class="qstat-val" style="color:#fb7185;">${trStats.total}</div>
        <div class="qstat-lbl">Training Sessions</div>
      </div>
      <span class="qstat-trend trend-up">${trStats.employees} trained</span>
    </div>
  `;
}

// ---- Module Card Stats ----
function renderCardStats() {
  const today    = DB.fmt.today();
  const todayRec = DB.DailyRecords.getForDate(today);
  const checkPct = todayRec
    ? Math.round((todayRec.items.filter(i=>i.done).length / (todayRec.items.length||1)) * 100) + '%'
    : 'No record';

  const cm   = DB.Corrective.getStats();
  const pm   = DB.Preventive.getStats();
  const sp   = DB.SpareParts.getStats();
  const hist = DB.History.getAll().length;
  const tr   = DB.Training.getStats();

  const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };

  set('cs-daily', checkPct);
  set('cs-cm',    cm.open);
  set('cs-pm',    pm.total !== undefined ? pm.total : pm.upcoming);
  set('cs-sp',    sp.total);
  set('cs-an',    hist);
  set('cs-hist',  hist);
  set('cs-tr',    tr.total);

  // Update CM badge if open
  const cmBadge = document.getElementById('cm-badge');
  if (cmBadge) {
    if (cm.open > 0) { cmBadge.textContent = cm.open + ' Open'; cmBadge.style.background='rgba(255,71,87,0.15)'; cmBadge.style.color='#ff4757'; }
    else             { cmBadge.textContent = 'All Closed'; cmBadge.style.background='rgba(0,230,118,0.12)'; cmBadge.style.color='#00e676'; }
  }

  // Update spare parts badge if low stock
  const spBadge = document.getElementById('sp-badge');
  if (spBadge && sp.lowStock > 0) {
    spBadge.textContent = sp.lowStock + ' Low Stock';
    spBadge.style.background = 'rgba(255,71,87,0.15)';
    spBadge.style.color = '#ff4757';
  }
}

// ---- Recent Activity ----
function renderRecentActivity() {
  const MODULE_ICONS = {
    'Daily Check':            { color:'#00d4ff', bg:'rgba(0,212,255,0.1)',  icon:'<path d="M9 11l3 3L22 4"/>' },
    'Corrective Maintenance': { color:'#ff4757', bg:'rgba(255,71,87,0.1)', icon:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>' },
    'Preventive Maintenance': { color:'#f0a500', bg:'rgba(240,165,0,0.1)', icon:'<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="10" x2="21" y2="10"/>' },
    'Spare Parts':            { color:'#a78bfa', bg:'rgba(124,58,237,0.1)', icon:'<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>' },
    'Training':               { color:'#fb7185', bg:'rgba(244,63,94,0.1)', icon:'<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>' },
  };

  const recent = DB.History.getAll().slice(0, 8);
  const el = document.getElementById('recentActivity');

  if (!recent.length) {
    el.innerHTML = '<div style="padding:20px 0;color:var(--text-secondary);font-size:13px;">No activity yet. Start by opening a module.</div>';
    return;
  }

  el.innerHTML = '<div class="activity-list">' + recent.map(item => {
    const cfg = MODULE_ICONS[item.module] || MODULE_ICONS['Daily Check'];
    return `
      <div class="activity-item">
        <div class="act-icon" style="background:${cfg.bg};">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${cfg.color}" stroke-width="1.8" stroke-linecap="round">${cfg.icon}</svg>
        </div>
        <div class="act-body">
          <div class="act-title">${item.title || '—'}</div>
          <div class="act-sub">${item.module}${item.person ? ' · ' + item.person : ''}</div>
        </div>
        <div class="act-time">${DB.fmt.dateShort(item.date)}</div>
      </div>`;
  }).join('') + '</div>';
}

// ---- Alerts ----
function renderAlerts() {
  const el = document.getElementById('alertsPanel');
  const alerts = [];

  const cmStats = DB.Corrective.getStats();
  if (cmStats.open > 0)
    alerts.push({ type:'critical', icon:'🔴', title:`${cmStats.open} Open Work Order${cmStats.open>1?'s':''}`, desc:'Corrective maintenance jobs still pending resolution.' });

  const pmStats = DB.Preventive.getStats();
  if (pmStats.overdue > 0)
    alerts.push({ type:'warning', icon:'🟡', title:`${pmStats.overdue} Overdue PM Task${pmStats.overdue>1?'s':''}`, desc:'Scheduled preventive maintenance tasks are past their due date.' });

  const lowStock = DB.SpareParts.getLowStock();
  if (lowStock.length > 0)
    alerts.push({ type:'warning', icon:'🟡', title:`${lowStock.length} Part${lowStock.length>1?'s':''} Below Minimum Stock`, desc:'Reorder needed: ' + lowStock.slice(0,2).map(p=>p.partName).join(', ') + (lowStock.length>2?'…':'') });

  const today    = DB.fmt.today();
  const todayRec = DB.DailyRecords.getForDate(today);
  if (!todayRec)
    alerts.push({ type:'info', icon:'🔵', title:"Today's Check Not Started", desc:"Open Daily Check to begin today's equipment inspection." });
  else if (todayRec.items.filter(i=>i.done).length < todayRec.items.length)
    alerts.push({ type:'info', icon:'🔵', title:'Daily Check Incomplete', desc:`${todayRec.items.filter(i=>!i.done).length} check item${todayRec.items.filter(i=>!i.done).length>1?'s':''} still pending today.` });

  if (!alerts.length) {
    el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;padding:24px 0;gap:8px;">
      <div style="font-size:28px;">✅</div>
      <div style="font-weight:600;color:var(--green);">All Clear</div>
      <div style="font-size:12px;color:var(--text-secondary);">No alerts at this time</div>
    </div>`;
    return;
  }

  el.innerHTML = alerts.map(a => `
    <div class="alert-item ${a.type}">
      <div class="alert-icon">${a.icon}</div>
      <div class="alert-body">
        <div class="alert-title">${a.title}</div>
        <div class="alert-desc">${a.desc}</div>
      </div>
    </div>`).join('');
}

// ---- Card entrance animation ----
function animateCards() {
  document.querySelectorAll('.module-card').forEach((card, i) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    setTimeout(() => {
      card.style.transition = 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, 80 + i * 70);
  });
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  const session = requireAuth();
  if (!session) return;

  populateUser(session);
  setGreeting(session);
  startClock();
  setupUserMenu();
  renderStatusBanner();
  renderTeamStatus();
  renderQuickStats();
  renderCardStats();
  renderRecentActivity();
  renderAlerts();
  animateCards();

  // Refresh team status every 60 seconds
  setInterval(renderTeamStatus, 60000);
});

// ---- Team Status Panel ----
function renderTeamStatus() {
  const el = document.getElementById('teamStatusPanel');
  if (!el || typeof Schedule === 'undefined') return;

  const now = new Date();
  const status = Schedule.getTeamStatus(now);
  const { members, shiftType, todaySchedule } = status;

  const h = String(now.getHours()).padStart(2, '0');
  const mn = String(now.getMinutes()).padStart(2, '0');
  const dayName = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const isFriday = now.getDay() === 5;

  const shiftText = { morning: 'Morning Shift', afternoon: 'Afternoon Shift', night: 'Night Shift' };
  const DOT_COLORS = { morning: '#00d4ff', afternoon: '#f0a500', night: '#a78bfa' };
  const BADGE = { 'at-work': '● At Work', upcoming: '⏱ Upcoming', off: '— Off' };

  const atWorkCount = members.filter(m => m.status === 'at-work').length;
  const upcomingCount = members.filter(m => m.status === 'upcoming').length;
  const offCount = members.filter(m => m.status === 'off').length;

  const cards = members.map(m => {
    const grad = AVATAR_COLORS[m.name] || 'linear-gradient(135deg,#00d4ff,#0066ff)';
    const isSupervisor = m.role === 'Electrical Supervisor';
    return `<div class="emp-card ${m.status} ${isSupervisor ? 'supervisor' : ''}" onclick="openEngineerProfile('${esc(m.name)}')" title="Click to open ${esc(m.name)}'s profile & full work history" role="button" tabindex="0">
      <div class="emp-avatar-wrap">
        <div class="emp-avatar" style="background:${grad};">${m.initials}</div>
        <div class="emp-status-dot ${m.status}"></div>
      </div>
      <div class="emp-info">
        <div class="emp-name">${esc(m.name)}</div>
        <div class="emp-role">${esc(m.role)}</div>
        <div class="emp-badges-row">
          <span class="emp-status-badge ${m.status}">${BADGE[m.status] || m.status}</span>
        </div>
      </div>
      <div class="emp-card-arrow">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="team-panel-header">
      <div class="team-panel-title">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" stroke-width="1.8" stroke-linecap="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <span>Team Status • Live</span>
        <span class="shift-badge ${shiftType}">${shiftText[shiftType]}</span>
        <button type="button" class="btn-refresh-team" onclick="refreshTeamStatus(event)" title="Refresh Team Status Now"
          style="display:inline-flex;align-items:center;gap:5px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:100px;padding:3px 10px;font-size:11.5px;color:var(--text-secondary);cursor:pointer;transition:all 0.2s;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          <span>Refresh</span>
        </button>
        <div style="display:inline-flex;gap:6px;margin-left:8px;">
          <span style="font-size:10.5px;padding:2px 8px;border-radius:100px;background:rgba(0,230,118,0.12);color:#00e676;font-weight:700;">At Work: ${atWorkCount}</span>
          <span style="font-size:10.5px;padding:2px 8px;border-radius:100px;background:rgba(56,189,248,0.12);color:#38bdf8;font-weight:700;">Upcoming: ${upcomingCount}</span>
          <span style="font-size:10.5px;padding:2px 8px;border-radius:100px;background:rgba(100,116,139,0.2);color:#94a3b8;font-weight:700;">Off: ${offCount}</span>
        </div>
      </div>
      <div class="team-panel-meta">
        <span>${dayName} &nbsp;•&nbsp; ${h}:${mn}</span>
        <span style="color:var(--cyan);font-weight:600;font-size:11px;margin-left:8px;">(Click engineer to view profile)</span>
      </div>
    </div>
    <div class="team-members-row">${cards}</div>`;
}

function refreshTeamStatus(e) {
  if (e) e.stopPropagation();
  renderTeamStatus();
  renderStatusBanner();
  const btn = document.querySelector('.btn-refresh-team');
  if (btn) {
    btn.style.transform = 'rotate(180deg)';
    btn.style.transition = 'transform 0.4s ease';
    setTimeout(() => { btn.style.transform = ''; }, 450);
  }
}

// ================================================
//  ENGINEER PROFILE & WORK HISTORY LOGIC
// ================================================
let currentEngData = {
  name: '',
  allHistory: [],
  filteredHistory: [],
  currentTab: 'all',
  searchQuery: ''
};

function openEngineerProfile(name) {
  if (!name) return;
  const now = new Date();
  const teamStatus = typeof Schedule !== 'undefined' ? Schedule.getTeamStatus(now) : null;
  const member = teamStatus ? teamStatus.members.find(m => m.name.toLowerCase() === name.toLowerCase()) : null;
  const dbUser = DB.Users.getAll().find(u => u.name.toLowerCase() === name.toLowerCase());

  const initials = member?.initials || dbUser?.initials || name.split(' ').map(p => p[0]).join('').slice(0, 2);
  const role = member?.role || dbUser?.role || 'Electrical Engineer';
  const status = member?.status || 'off';
  const shiftLabel = member?.label || 'Off Duty';
  const grad = AVATAR_COLORS[name] || 'linear-gradient(135deg, #00d4ff, #0066ff)';

  // Populate Hero Header
  const avatarEl = document.getElementById('engHeroAvatar');
  if (avatarEl) {
    avatarEl.textContent = initials;
    avatarEl.style.background = grad;
  }
  const dotEl = document.getElementById('engHeroDot');
  if (dotEl) {
    dotEl.className = `eng-hero-dot ${status}`;
  }
  const nameEl = document.getElementById('engModalTitle');
  if (nameEl) nameEl.textContent = name;
  const roleEl = document.getElementById('engHeroRole');
  if (roleEl) roleEl.textContent = role;
  const shiftEl = document.getElementById('engHeroShift');
  if (shiftEl) {
    const statusText = status === 'at-work' ? `● On Shift — ${shiftLabel}` : (status === 'upcoming' ? `⏱ ${shiftLabel}` : `— ${shiftLabel}`);
    shiftEl.textContent = statusText;
    shiftEl.style.color = status === 'at-work' ? '#00e676' : (status === 'upcoming' ? '#38bdf8' : '#94a3b8');
  }

  // Aggregate Work History across all sources
  const history = [];

  // 1. Daily Checks from Monthly Schedules
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('pc_sched_')) {
      try {
        const sched = JSON.parse(localStorage.getItem(k));
        if (sched && sched.days) {
          sched.days.forEach(day => {
            ['1a', '1b', '2a', '2b', '3a', '3b'].forEach(slotKey => {
              const doneBy = day[`doneBy${slotKey}`];
              if (doneBy && doneBy.toLowerCase() === name.toLowerCase()) {
                const taskId = day[`task${slotKey}`];
                let taskName = taskId;
                if (typeof Scheduler !== 'undefined' && Scheduler.getTask) {
                  const t = Scheduler.getTask(taskId);
                  if (t) taskName = `${t.code}: ${t.name}`;
                }
                const shiftMap = {
                  '1a': 'Morning Shift (A)',
                  '1b': 'Morning Shift (B)',
                  '2a': 'Afternoon Shift (A)',
                  '2b': 'Afternoon Shift (B)',
                  '3a': 'Night Shift (A)',
                  '3b': 'Night Shift (B)'
                };
                history.push({
                  type: 'daily-check',
                  typeLabel: 'Daily Check',
                  date: day[`doneAt${slotKey}`] || `${day.date}T12:00:00`,
                  dateStr: day.date,
                  title: taskName,
                  sub: `Shift Slot: ${shiftMap[slotKey] || slotKey} · Date: ${day.date}`,
                  notes: day[`notes${slotKey}`] || '',
                  status: (day[`status${slotKey}`] || 'done').toUpperCase(),
                  statusClass: 'status-pill-done'
                });
              }
            });
          });
        }
      } catch (err) {
        console.warn('Error reading schedule key', k, err);
      }
    }
  }

  // 1b. Legacy/Template Daily Records
  try {
    const dailyDates = DB.DailyRecords.getAllDates ? DB.DailyRecords.getAllDates() : [];
    dailyDates.forEach(dStr => {
      const rec = DB.DailyRecords.getForDate(dStr);
      if (rec && rec.items) {
        rec.items.filter(item => item.done && item.doneBy && item.doneBy.toLowerCase() === name.toLowerCase()).forEach(item => {
          history.push({
            type: 'daily-check',
            typeLabel: 'Daily Check',
            date: item.doneAt || `${dStr}T10:00:00`,
            dateStr: dStr,
            title: item.name,
            sub: `Inspection Item (${item.category || 'General'})`,
            notes: item.notes || '',
            status: 'DONE',
            statusClass: 'status-pill-done'
          });
        });
      }
    });
  } catch (e) {}

  // 2. Corrective Maintenance Work Orders
  try {
    const cmList = DB.Corrective.getAll();
    cmList.forEach(cm => {
      const isTech = cm.technician && cm.technician.toLowerCase() === name.toLowerCase();
      const isRep = cm.reportedBy && cm.reportedBy.toLowerCase() === name.toLowerCase();
      if (isTech || isRep) {
        const roleInCm = isTech ? 'Assigned Technician' : 'Reported By';
        history.push({
          type: 'cm',
          typeLabel: 'Corrective Maint.',
          date: cm.date ? (cm.date.includes('T') ? cm.date : `${cm.date}T10:00:00`) : (cm.createdAt || new Date().toISOString()),
          dateStr: cm.date || '',
          title: `${cm.workOrderNumber ? cm.workOrderNumber + ' — ' : ''}${cm.equipment || 'Equipment'}: ${cm.problemDescription || 'Fault repair'}`,
          sub: `Role: ${roleInCm} · Priority: ${cm.priority || 'Normal'}`,
          notes: cm.actionTaken ? `Action Taken: ${cm.actionTaken}` : '',
          status: (cm.status || 'open').toUpperCase(),
          statusClass: cm.status === 'closed' ? 'status-pill-closed' : 'status-pill-open'
        });
      }
    });
  } catch (e) {}

  // 3. Training & Seminars
  try {
    const trList = DB.Training.getAll();
    trList.forEach(tr => {
      if (tr.employeeName && tr.employeeName.toLowerCase() === name.toLowerCase()) {
        history.push({
          type: 'training',
          typeLabel: 'Training Course',
          date: tr.date ? (tr.date.includes('T') ? tr.date : `${tr.date}T09:00:00`) : new Date().toISOString(),
          dateStr: tr.date || '',
          title: tr.seminarTitle || tr.topic || 'Plant Technical Seminar',
          sub: `Topic: ${tr.topic || 'Technical'} · Duration: ${tr.duration || 1} hrs · Trainer: ${tr.trainer || 'Plant Expert'}`,
          notes: tr.certificate ? `Certificate: ${tr.certificate}` : (tr.notes || ''),
          status: 'COMPLETED',
          statusClass: 'status-pill-cert'
        });
      }
    });
  } catch (e) {}

  // 4. Audit History (other modules)
  try {
    const histList = DB.History.getAll();
    histList.forEach(h => {
      const isUser = (h.user && h.user.toLowerCase() === name.toLowerCase()) ||
                     (h.person && h.person.toLowerCase() === name.toLowerCase());
      if (isUser && h.module !== 'Daily Check' && h.module !== 'Corrective Maintenance' && h.module !== 'Training') {
        history.push({
          type: 'history',
          typeLabel: h.module || 'System',
          date: h.date || new Date().toISOString(),
          dateStr: h.date ? h.date.split('T')[0] : '',
          title: h.title || h.action || 'Activity Logged',
          sub: `Module: ${h.module || 'System Log'}`,
          notes: h.detail || h.details || '',
          status: 'LOGGED',
          statusClass: 'status-pill-closed'
        });
      }
    });
  } catch (e) {}

  // Sort chronologically (newest first)
  history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Count KPIs
  const checksCount = history.filter(h => h.type === 'daily-check').length;
  const cmCount = history.filter(h => h.type === 'cm').length;
  const trCount = history.filter(h => h.type === 'training').length;
  const totalCount = history.length;

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('engKpiChecks', checksCount);
  setEl('engKpiCm', cmCount);
  setEl('engKpiTraining', trCount);
  setEl('engKpiTotal', totalCount);

  setEl('engBadgeAll', totalCount);
  setEl('engBadgeChecks', checksCount);
  setEl('engBadgeCm', cmCount);
  setEl('engBadgeTr', trCount);

  currentEngData = {
    name,
    allHistory: history,
    filteredHistory: history,
    currentTab: 'all',
    searchQuery: ''
  };

  const searchInput = document.getElementById('engHistorySearch');
  if (searchInput) searchInput.value = '';

  document.querySelectorAll('.eng-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === 'all');
  });

  renderEngHistoryList();
  openModal('engineerModal');
}

function switchEngTab(tab) {
  currentEngData.currentTab = tab;
  document.querySelectorAll('.eng-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  filterEngHistory();
}

function filterEngHistory() {
  const query = (document.getElementById('engHistorySearch')?.value || '').toLowerCase().trim();
  currentEngData.searchQuery = query;

  let filtered = currentEngData.allHistory;
  if (currentEngData.currentTab !== 'all') {
    filtered = filtered.filter(h => h.type === currentEngData.currentTab);
  }
  if (query) {
    filtered = filtered.filter(h =>
      (h.title && h.title.toLowerCase().includes(query)) ||
      (h.sub && h.sub.toLowerCase().includes(query)) ||
      (h.notes && h.notes.toLowerCase().includes(query)) ||
      (h.dateStr && h.dateStr.includes(query))
    );
  }
  currentEngData.filteredHistory = filtered;
  renderEngHistoryList();
}

function renderEngHistoryList() {
  const container = document.getElementById('engHistoryList');
  if (!container) return;

  const list = currentEngData.filteredHistory;
  if (!list.length) {
    container.innerHTML = `
      <div class="eng-empty-state">
        <div class="eng-empty-icon">📋</div>
        <div class="eng-empty-text">No work records found for this category.</div>
        <div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;">As maintenance work, inspections, or training are completed and signed, they will automatically appear here.</div>
      </div>`;
    return;
  }

  container.innerHTML = list.map(item => `
    <div class="eng-history-item type-${item.type}">
      <div class="eng-item-header">
        <div class="eng-item-meta">
          <span class="eng-type-tag tag-${item.type}">${esc(item.typeLabel)}</span>
          <span class="eng-item-date">${item.date ? (DB.fmt.datetime ? DB.fmt.datetime(item.date) : item.dateStr) : '—'}</span>
        </div>
        <span class="eng-item-status ${item.statusClass}">${esc(item.status)}</span>
      </div>
      <div class="eng-item-title">${esc(item.title)}</div>
      <div class="eng-item-sub">${esc(item.sub)}</div>
      ${item.notes ? `<div class="eng-item-notes">${esc(item.notes)}</div>` : ''}
    </div>
  `).join('');
}

// ---- Modal Helpers ----
function openModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.remove('open');
    document.body.style.overflow = '';
  }
}

// Close modal on backdrop click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// Escape HTML utility
function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
