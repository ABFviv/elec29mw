// ========================================
//  PowerCore EMS â€” Dashboard Logic
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
  DB.Session.logout();
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

// ---- Clock ----
function startClock() {
  function tick() {
    const n = new Date(), p = x => String(x).padStart(2,'0');
    const el = document.getElementById('dashClock');
    if (el) el.textContent = `${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`;
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
        <div class="status-dot ${pmStats.overdue === 0 ? 'ok' : 'alert'}"></div>
        <span class="status-label">Overdue PM Tasks</span>
        <span class="status-val">${pmStats.overdue} overdue</span>
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
      <div class="qstat-icon" style="background:rgba(0,212,255,0.1);border:1px solid rgba(0,212,255,0.2);">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" stroke-width="1.8" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      </div>
      <div class="qstat-info">
        <div class="qstat-val" style="color:#00d4ff;">${checkDone}/${checkTotal}</div>
        <div class="qstat-lbl">Today's Check Items</div>
      </div>
      <span class="qstat-trend ${checkDone===checkTotal&&checkTotal>0?'trend-up':'trend-warn'}">${checkTotal===0?'No template':checkDone===checkTotal?'âœ“ Done':'Pending'}</span>
    </div>

    <div class="qstat">
      <div class="qstat-icon" style="background:rgba(255,71,87,0.1);border:1px solid rgba(255,71,87,0.2);">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff4757" stroke-width="1.8" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
      </div>
      <div class="qstat-info">
        <div class="qstat-val" style="color:#ff4757;">${cmStats.open}</div>
        <div class="qstat-lbl">Open CM Work Orders</div>
      </div>
      <span class="qstat-trend ${cmStats.open===0?'trend-up':'trend-red'}">${cmStats.open===0?'All clear':'Needs attention'}</span>
    </div>

    <div class="qstat">
      <div class="qstat-icon" style="background:rgba(240,165,0,0.1);border:1px solid rgba(240,165,0,0.2);">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f0a500" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      </div>
      <div class="qstat-info">
        <div class="qstat-val" style="color:#f0a500;">${pmStats.upcoming}</div>
        <div class="qstat-lbl">Upcoming PM Tasks</div>
      </div>
      <span class="qstat-trend ${pmStats.overdue>0?'trend-red':'trend-warn'}">${pmStats.overdue>0?pmStats.overdue+' overdue':'On schedule'}</span>
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
  set('cs-pm',    pm.upcoming);
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
          <div class="act-title">${item.title || 'â€”'}</div>
          <div class="act-sub">${item.module}${item.person ? ' Â· ' + item.person : ''}</div>
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
    alerts.push({ type:'critical', icon:'ðŸ”´', title:`${cmStats.open} Open Work Order${cmStats.open>1?'s':''}`, desc:'Corrective maintenance jobs still pending resolution.' });

  const pmStats = DB.Preventive.getStats();
  if (pmStats.overdue > 0)
    alerts.push({ type:'warning', icon:'ðŸŸ¡', title:`${pmStats.overdue} Overdue PM Task${pmStats.overdue>1?'s':''}`, desc:'Scheduled preventive maintenance tasks are past their due date.' });

  const lowStock = DB.SpareParts.getLowStock();
  if (lowStock.length > 0)
    alerts.push({ type:'warning', icon:'ðŸŸ¡', title:`${lowStock.length} Part${lowStock.length>1?'s':''} Below Minimum Stock`, desc:'Reorder needed: ' + lowStock.slice(0,2).map(p=>p.partName).join(', ') + (lowStock.length>2?'â€¦':'') });

  const today    = DB.fmt.today();
  const todayRec = DB.DailyRecords.getForDate(today);
  if (!todayRec)
    alerts.push({ type:'info', icon:'ðŸ”µ', title:"Today's Check Not Started", desc:"Open Daily Check to begin today's equipment inspection." });
  else if (todayRec.items.filter(i=>i.done).length < todayRec.items.length)
    alerts.push({ type:'info', icon:'ðŸ”µ', title:'Daily Check Incomplete', desc:`${todayRec.items.filter(i=>!i.done).length} check item${todayRec.items.filter(i=>!i.done).length>1?'s':''} still pending today.` });

  if (!alerts.length) {
    el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;padding:24px 0;gap:8px;">
      <div style="font-size:28px;">âœ…</div>
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

  const h = String(now.getHours()).padStart(2,'0');
  const mn = String(now.getMinutes()).padStart(2,'0');
  const dayName = now.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' });
  const isFriday = now.getDay() === 5;

  const shiftText = { morning:'Morning Shift', afternoon:'Afternoon Shift', night:'Night Shift' };
  const DOT_COLORS = { morning:'#00d4ff', afternoon:'#f0a500', night:'#a78bfa' };
  const BADGE = { 'at-work':'? At Work', upcoming:'? Upcoming', done:'? Done', off:'— Off' };

  const cards = members.map(m => {
    const grad = AVATAR_COLORS[m.name] || 'linear-gradient(135deg,#00d4ff,#0066ff)';
    const isSupervisor = m.role === 'Electrical Supervisor';
    const parts = m.name.split(' ');
    const first = parts[0];
    const rest  = parts.slice(1).join(' ');
    return `<div class="emp-card ${m.status} ${isSupervisor?'supervisor':''}">
      <div class="emp-avatar-wrap">
        <div class="emp-avatar" style="background:${grad};">${m.initials}</div>
        <div class="emp-status-dot ${m.status}"></div>
      </div>
      <div class="emp-name">${first}<br><span style="font-weight:500;opacity:0.85;">${rest}</span></div>
      <div class="emp-role">${m.role}</div>
      <div class="emp-status-badge ${m.status}">${BADGE[m.status]||m.status}</div>
      <div class="emp-shift-label">${m.label}</div>
    </div>`;
  }).join('');

  const mkSlot = (time, person, sType) => {
    const active = sType === shiftType;
    const dot = DOT_COLORS[sType]||'#00d4ff';
    return `<div class="shift-slot ${active?'active-slot':''}">
      <div class="shift-slot-dot" style="background:${dot};"></div>
      <span class="shift-slot-time">${time}</span>
      <span class="shift-slot-name">${person||'—'}</span>
      ${active?'<span style="font-size:10px;color:var(--cyan);font-weight:700;margin-left:4px;">? NOW</span>':''}
    </div>`;
  };

  const strip = `<div class="shift-overview-strip">
    <span class="shift-strip-label">Today</span>
    ${mkSlot('07:30–15:30', todaySchedule.morning,   'morning')}
    ${mkSlot('15:30–23:30', todaySchedule.afternoon, 'afternoon')}
    ${mkSlot('23:30–07:30', todaySchedule.night,     'night')}
    ${todaySchedule.off ? `<div class="shift-slot" style="opacity:0.45;"><div class="shift-slot-dot" style="background:var(--border);"></div><span class="shift-slot-time">Off</span><span class="shift-slot-name">${todaySchedule.off}</span></div>`:''}
    ${isFriday?'<span style="margin-left:auto;font-size:11px;color:#f0a500;">? Friday — fixed team day off</span>':''}
  </div>`;

  el.innerHTML = `
    <div class="team-panel-header">
      <div class="team-panel-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" stroke-width="1.8" stroke-linecap="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        Team Status — Live
        <span class="shift-badge ${shiftType}">${shiftText[shiftType]}</span>
      </div>
      <div class="team-panel-meta">${dayName} &nbsp;·&nbsp; ${h}:${mn}</div>
    </div>
    <div class="team-members-row">${cards}</div>
    ${strip}`;
}