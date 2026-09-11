const APP_BASE = `${window.location.origin}/logbook-bmkg/`;
const api = async (url, options = {}) => {
  const isFormData = options.body instanceof FormData;
  const headers = { ...(options.headers || {}) };
  if (!isFormData && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const response = await fetch(new URL(url, APP_BASE), { ...options, headers });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); }
  catch {
    throw new Error(`API XAMPP mengirim respons HTML dari ${response.url}. Buka http://localhost/logbook-bmkg/ dan pastikan folder aplikasi berada di htdocs.`);
  }
  if (!response.ok) throw new Error(data.error || 'Terjadi kesalahan pada server.');
  return data;
};

const overlay = document.getElementById('loginOverlay');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logList = document.getElementById('logList');
const logForm = document.getElementById('logForm');
const activityAtInput = document.getElementById('activityAt');
const unitSelect = document.getElementById('category');
const officerSelect = document.getElementById('officer');
const titleSelect = document.getElementById('title');
const darkMode = document.getElementById('darkMode');
const notifications = document.getElementById('notifications');
let activeUnit = 'Semua';
let currentUser = null;
let latestLogs = [];
const dailyQuotes = [
  ['Kesuksesan adalah hasil dari usaha kecil yang dilakukan berulang setiap hari.', 'Robert Collier'],
  ['Mulailah dari tempatmu berada. Gunakan apa yang kamu punya. Lakukan apa yang kamu bisa.', 'Arthur Ashe'],
  ['Keunggulan bukanlah sebuah tindakan, melainkan sebuah kebiasaan.', 'Aristoteles'],
  ['Satu-satunya cara untuk melakukan pekerjaan hebat adalah mencintai apa yang kamu kerjakan.', 'Steve Jobs'],
  ['Jangan menunggu kesempatan. Ciptakan kesempatanmu sendiri.', 'George Bernard Shaw'],
  ['Kemajuan kecil tetaplah kemajuan.', 'Anonim']
];
function setDailyQuote() {
  const dateText = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const date = new Date(`${dateText}T00:00:00Z`);
  const dayNumber = Math.floor(date.getTime() / 86400000);
  const quote = dailyQuotes[((dayNumber % dailyQuotes.length) + dailyQuotes.length) % dailyQuotes.length];
  document.getElementById('dailyQuote').textContent = quote[0];
  document.getElementById('dailyQuoteAuthor').textContent = `— ${quote[1]}`;
}
setDailyQuote();
setInterval(setDailyQuote, 60000);
function populateActivityTitles(activities) {
  titleSelect.innerHTML = '<option value="">-- Pilih aktivitas --</option>' + activities.map((activity) => `<option value="${escapeHtml(activity.title)}">${escapeHtml(activity.title)}</option>`).join('');
}
async function loadActivities() {
  const data = await api('api.php?action=activities');
  populateActivityTitles(data.activities);
}
const notificationButton = document.querySelector('[aria-label="Notifikasi"]');
const notificationItems = [];

document.querySelector('.header-actions').insertAdjacentHTML('beforeend', '<div class="notification-popover" id="notificationPopover" hidden><div class="notification-title"><b>Notifikasi</b><button type="button" id="markNotificationsRead">Tandai dibaca</button></div><div id="notificationList" class="notification-list"></div></div>');
function renderNotifications() {
  const list = document.getElementById('notificationList');
  list.innerHTML = notificationItems.length ? notificationItems.map((item) => `<article><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.message)}</span></article>`).join('') : '<p>Belum ada notifikasi baru.</p>';
  notificationButton.querySelector('i').hidden = notificationItems.length === 0;
}
function addNotification(title, message) {
  notificationItems.unshift({ title, message });
  renderNotifications();
}
function closeNotifications() {
  const popover = document.getElementById('notificationPopover');
  popover.hidden = true;
  notificationButton.setAttribute('aria-expanded', 'false');
}
notificationButton.setAttribute('aria-expanded', 'false');
notificationButton.addEventListener('click', (event) => {
  event.stopPropagation();
  const popover = document.getElementById('notificationPopover');
  const willOpen = popover.hidden;
  popover.hidden = !willOpen;
  notificationButton.setAttribute('aria-expanded', String(willOpen));
  if (willOpen) renderNotifications();
});
document.getElementById('markNotificationsRead').addEventListener('click', () => { notificationItems.length = 0; renderNotifications(); });
document.addEventListener('click', (event) => { if (!event.target.closest('.header-actions')) closeNotifications(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeNotifications(); });

function currentGreeting() {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', hour: 'numeric', hour12: false }).format(new Date()));
  if (hour >= 4 && hour < 11) return 'pagi';
  if (hour >= 11 && hour < 15) return 'siang';
  if (hour >= 15 && hour < 18) return 'sore';
  return 'malam';
}
function updateGreeting() {
  if (!currentUser) return;
  const greeting = document.querySelector('.welcome p');
  greeting.childNodes[0].nodeValue = `Selamat ${currentGreeting()}, ${currentUser.username}! `;
}
setInterval(updateGreeting, 60000);

function wibDateTimeLocal() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type)?.value || '00';
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}`;
}
activityAtInput.value = wibDateTimeLocal();
const savedSettings = JSON.parse(localStorage.getItem('logera-settings') || '{}');
darkMode.checked = Boolean(savedSettings.darkMode);
notifications.checked = savedSettings.notifications !== false;
document.body.classList.toggle('dark-mode', darkMode.checked);

function escapeHtml(value) { const node = document.createElement('span'); node.textContent = value; return node.innerHTML; }
function unitClass(unit) { return { Teknisi: 'unit-teknisi', Observasi: 'unit-observasi', Datin: 'unit-datin' }[unit] || ''; }
function formatDate(value) { const date = new Date(`${value}T00:00:00`); return { day: String(date.getDate()).padStart(2, '0'), month: date.toLocaleString('id-ID', { month: 'short' }).toUpperCase(), year: date.getFullYear() }; }
function renderLogs(logs) {
  logList.innerHTML = '';
  const visibleLogs = logs.filter((log) => log.unit === activeUnit);
  const emptyLog = document.getElementById('emptyLog');
  emptyLog.hidden = visibleLogs.length > 0;
  if (!visibleLogs.length) return;
  visibleLogs.forEach((log) => {
    const date = formatDate(log.activity_date);
    const row = document.createElement('tr');
    row.className = 'log-table-row';
    row.dataset.unit = log.unit;
    const time = `${date.day} ${date.month} ${date.year} ${log.activity_time || '-'}`;
    const documentLink = Number(log.has_document) ? `<a class="document-link" href="api.php?action=document&id=${encodeURIComponent(log.id)}" target="_blank" rel="noopener">Lihat PDF</a>` : '<span class="no-document">—</span>';
    const statusClass = `status-${String(log.status).toLowerCase().replaceAll(' ', '-')}`;
    row.innerHTML = `<td>${time}</td><td><b>${escapeHtml(log.officer_name)}</b><small>Unit ${escapeHtml(log.unit)}</small></td><td>${escapeHtml(log.title)}<small>${Number(log.hours).toFixed(1)} jam</small></td><td><span class="log-status ${statusClass}">${escapeHtml(log.status)}</span></td><td class="log-notes">${escapeHtml(log.details || '-')}</td><td>${documentLink}</td>`;
    logList.append(row);
  });
}
async function loadLogs() {
  const data = await api('api.php?action=logs');
  latestLogs = data.logs;
  renderLogs(data.logs);
  document.getElementById('totalLog').textContent = data.summary.total_logs;
  document.getElementById('doneLog').textContent = data.summary.total_logs;
  document.getElementById('totalHours').textContent = Number(data.summary.total_hours).toFixed(1);
}
async function loadOfficers() {
  const data = await api('api.php?action=officers');
  officerSelect.innerHTML = '<option value="">Pilih petugas yang berdinas</option>';
  data.officers.forEach((officer) => {
    const option = document.createElement('option'); option.value = officer.id; option.textContent = officer.name; officerSelect.append(option);
  });
  officerSelect.disabled = data.officers.length === 0;
}
function setUser(user) {
  currentUser = user;
  activeUnit = user.unit;
  updateGreeting();
  document.querySelector('.profile-card strong').textContent = user.username;
  document.querySelector('.profile-card small').textContent = `Unit ${user.unit}`;
  document.querySelector('.avatar').textContent = user.username.slice(0, 2).toUpperCase();
  document.querySelector('.user-avatar').textContent = user.username.slice(0, 2).toUpperCase();
  unitSelect.value = user.unit;
  unitSelect.disabled = true;
  document.getElementById('logbookTitle').textContent = `Daftar Logbook Unit ${user.unit}`;
  document.getElementById('logbookSubtitle').textContent = `Hanya aktivitas Unit ${user.unit} yang ditampilkan.`;
  document.getElementById('activeUnitLabel').textContent = `Unit aktif: ${user.unit}`;
}
async function startSession(user) { setUser(user); overlay.classList.add('hidden'); await loadActivities(); await loadOfficers(); await loadLogs(); }

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault(); loginError.textContent = '';
  const submit = loginForm.querySelector('button'); submit.disabled = true; submit.textContent = 'Memverifikasi...';
  try { const data = await api('api.php?action=login', { method: 'POST', body: JSON.stringify({ username: document.getElementById('loginUsername').value, password: document.getElementById('loginPassword').value }) }); await startSession(data.user); }
  catch (error) { loginError.textContent = error.message; }
  finally { submit.disabled = false; submit.textContent = 'Masuk ke Dashboard'; }
});

logForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const formData = new FormData();
    formData.append('title', document.getElementById('title').value);
    formData.append('details', document.getElementById('details').value);
    formData.append('status', document.getElementById('status').value);
    formData.append('hours', document.getElementById('hours').value);
    formData.append('activity_at', activityAtInput.value);
    formData.append('officer_id', officerSelect.value);
    const documentFile = document.getElementById('document').files[0];
    if (documentFile) formData.append('document', documentFile);
    await api('api.php?action=logs', { method: 'POST', headers: {}, body: formData });
    logForm.reset(); activityAtInput.value = wibDateTimeLocal(); unitSelect.value = currentUser.unit; await loadOfficers();
    await loadLogs();
    const toast = document.getElementById('toast'); toast.textContent = 'Logbook berhasil disimpan'; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2600);
    addNotification('Logbook tersimpan', 'Catatan aktivitas Anda berhasil ditambahkan.');
  } catch (error) { alert(error.message); }
});

document.getElementById('logoutButton').addEventListener('click', async () => {
  await fetch(new URL('api.php?action=logout', APP_BASE), { method: 'POST' });
  logList.innerHTML = '';
  loginForm.reset();
  overlay.classList.remove('hidden');
});

const settingsModal = document.getElementById('settingsModal');
document.getElementById('settingsTab').addEventListener('click', (event) => { event.preventDefault(); settingsModal.classList.add('open'); });
document.getElementById('closeSettings').addEventListener('click', () => settingsModal.classList.remove('open'));
settingsModal.addEventListener('click', (event) => { if (event.target === settingsModal) settingsModal.classList.remove('open'); });
document.getElementById('settingsForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const settings = {
    darkMode: darkMode.checked,
    notifications: notifications.checked,
  };
  localStorage.setItem('logera-settings', JSON.stringify(settings));
  document.body.classList.toggle('dark-mode', settings.darkMode);
  settingsModal.classList.remove('open');
  const toast = document.getElementById('toast');
  toast.textContent = 'Pengaturan berhasil disimpan';
  toast.classList.add('show');
  setTimeout(() => { toast.classList.remove('show'); toast.textContent = 'Logbook berhasil disimpan'; }, 2600);
});

document.body.insertAdjacentHTML('beforeend', `
  <div class="reports-modal" id="reportsModal" aria-hidden="true">
    <section class="reports-dialog" role="dialog" aria-modal="true" aria-labelledby="reportsTitle">
      <div class="reports-header"><div><h2 id="reportsTitle">Laporan Logbook</h2><p id="reportsSubtitle">Ringkasan aktivitas unit.</p></div><button class="close-reports" id="closeReports" aria-label="Tutup laporan">×</button></div>
      <div class="report-summary" id="reportSummary"></div>
      <div class="report-table-wrap"><table class="report-table"><thead><tr><th>Waktu</th><th>Kegiatan</th><th>Petugas</th><th>Status</th><th>Durasi</th></tr></thead><tbody id="reportRows"></tbody></table><p class="empty-report" id="emptyReport" hidden>Belum ada data untuk dilaporkan.</p></div>
      <div class="report-actions"><button class="primary-button" id="exportReport" type="button">Unduh CSV</button></div>
    </section>
  </div>`);

function csvValue(value) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }
function openReports() {
  const logs = latestLogs.filter((log) => log.unit === activeUnit);
  const totalHours = logs.reduce((total, log) => total + Number(log.hours), 0);
  document.getElementById('reportsSubtitle').textContent = `Unit ${activeUnit} · ${logs.length} aktivitas tercatat`;
  document.getElementById('reportSummary').innerHTML = `<div><small>Total aktivitas</small><strong>${logs.length}</strong></div><div><small>Total durasi</small><strong>${totalHours.toFixed(1)} jam</strong></div><div><small>Dokumen PDF</small><strong>${logs.filter((log) => Number(log.has_document)).length}</strong></div>`;
  const reportRows = document.getElementById('reportRows');
  reportRows.innerHTML = logs.map((log) => `<tr><td>${escapeHtml(log.activity_date)} ${escapeHtml(log.activity_time || '')}</td><td>${escapeHtml(log.title)}</td><td>${escapeHtml(log.officer_name)}</td><td>${escapeHtml(log.status)}</td><td>${Number(log.hours).toFixed(1)} jam</td></tr>`).join('');
  document.getElementById('emptyReport').hidden = logs.length > 0;
  const modal = document.getElementById('reportsModal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}
function closeReports() {
  const modal = document.getElementById('reportsModal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}
document.querySelector('a[href="#laporan"]').addEventListener('click', (event) => { event.preventDefault(); openReports(); });
document.getElementById('closeReports').addEventListener('click', closeReports);
document.getElementById('reportsModal').addEventListener('click', (event) => { if (event.target.id === 'reportsModal') closeReports(); });
document.getElementById('exportReport').addEventListener('click', () => {
  const rows = latestLogs.filter((log) => log.unit === activeUnit);
  const csv = [['Waktu', 'Unit', 'Kegiatan', 'Petugas', 'Status', 'Catatan', 'Durasi (jam)', 'Dokumen'], ...rows.map((log) => [`${log.activity_date} ${log.activity_time || ''}`, log.unit, log.title, log.officer_name, log.status, log.details || '', log.hours, Number(log.has_document) ? 'Ada PDF' : 'Tidak ada'])].map((row) => row.map(csvValue).join(',')).join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  link.download = `laporan-logbook-${activeUnit.toLowerCase()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
});

document.body.insertAdjacentHTML('beforeend', `<div class="calendar-modal" id="calendarModal" aria-hidden="true"><section class="calendar-dialog" role="dialog" aria-modal="true" aria-labelledby="calendarTitle"><div class="calendar-header"><div><h2 id="calendarTitle">Kalender Aktivitas</h2><p id="calendarSubtitle">Jadwal logbook unit Anda.</p></div><button class="close-calendar" id="closeCalendar" aria-label="Tutup kalender">×</button></div><div class="calendar-toolbar"><button type="button" id="previousMonth" aria-label="Bulan sebelumnya">‹</button><strong id="calendarMonth"></strong><button type="button" id="nextMonth" aria-label="Bulan berikutnya">›</button></div><div class="calendar-weekdays"><span>Min</span><span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span></div><div class="calendar-grid" id="calendarGrid"></div></section></div>`);
let calendarDate = new Date();
function renderCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  document.getElementById('calendarMonth').textContent = calendarDate.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const logsByDay = {};
  latestLogs.filter((log) => log.unit === activeUnit).forEach((log) => { if (log.activity_date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)) { const day = Number(log.activity_date.slice(-2)); (logsByDay[day] ||= []).push(log); } });
  const cells = [];
  for (let i = 0; i < firstDay; i += 1) cells.push('<span class="calendar-day empty"></span>');
  for (let day = 1; day <= daysInMonth; day += 1) {
    const items = logsByDay[day] || [];
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
    cells.push(`<span class="calendar-day${isToday ? ' today' : ''}${items.length ? ' has-activity' : ''}" title="${items.map((item) => escapeHtml(item.title)).join(', ')}"><b>${day}</b>${items.length ? `<i>${items.length}</i>` : ''}</span>`);
  }
  document.getElementById('calendarGrid').innerHTML = cells.join('');
}
function openCalendar() { document.getElementById('calendarSubtitle').textContent = `Unit ${activeUnit} · tanggal dengan titik memiliki aktivitas`; renderCalendar(); const modal = document.getElementById('calendarModal'); modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); }
function closeCalendar() { const modal = document.getElementById('calendarModal'); modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
document.querySelector('a[href="#kalender"]').addEventListener('click', (event) => { event.preventDefault(); openCalendar(); });
document.getElementById('closeCalendar').addEventListener('click', closeCalendar);
document.getElementById('previousMonth').addEventListener('click', () => { calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1); renderCalendar(); });
document.getElementById('nextMonth').addEventListener('click', () => { calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1); renderCalendar(); });
document.getElementById('calendarModal').addEventListener('click', (event) => { if (event.target.id === 'calendarModal') closeCalendar(); });

api('api.php?action=me').then((data) => startSession(data.user)).catch(() => overlay.classList.remove('hidden'));
