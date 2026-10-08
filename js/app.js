/*** ============================================================
 *  Guard Tour PWA — Main App
 *  ============================================================ */

// ⚠️ แก้ URL นี้เป็น Apps Script Web App URL ของคุณ
const API_URL = 'https://script.google.com/macros/s/AKfycbxrz9sfLjPjdWFSvzUBhkYDe54-BG-bWOUUnmw6XKRDajoTbSVhUdHg3C12ZcwZXQLXDQ/exec';

// ================= STATE =================
let isConfirmMode = false;
let pendingData = null;
let currentCp = null;

// ================= INIT =================
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initShiftBadge();
  initConnectionStatus();
  initFormListeners();
  loadLastGuardName();
  parseUrlParams();
  updateQueueBadge();
  setTimeout(syncQueue, 2000);
  setInterval(syncQueue, 60000);
  setInterval(updateQueueBadge, 10000);
});

// ================= URL PARAMS =================
function parseUrlParams() {
  const params = new URLSearchParams(window.location.search);
  currentCp = (params.get('cp') || 'CP01').toUpperCase();

  // แสดง checkpoint
  document.getElementById('cpCode').innerText = currentCp;

  // ตั้งค่า CP name (จาก cache)
  setCpName(currentCp);
}

async function setCpName(cp) {
  const cpMap = await GTDB.getMeta('cpMap') || {};
  document.getElementById('cpName').innerText = cpMap[cp] || cp;
}

// ================= CLOCK =================
function initClock() {
  const tick = () => {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    document.getElementById('clock').innerText =
      pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  };
  tick();
  setInterval(tick, 1000);
}

// ================= SHIFT BADGE =================
function initShiftBadge() {
  const update = () => {
    const d = new Date();
    const m = d.getHours() * 60 + d.getMinutes();
    const inWindow = m >= 900 || m < 540;   // 15:00-09:00
    let shiftName = 'ระหว่างกะ';
    if (m >= 0 && m < 510) shiftName = '🌙 กะที่ 1 (00:00-08:30)';
    else if (m >= 930) shiftName = '🌆 กะที่ 2 (15:30-24:00)';

    const badge = document.getElementById('shiftBadge');
    const text = document.getElementById('shiftText');
    if (inWindow) {
      badge.classList.remove('warn');
      text.innerHTML = '<b>' + shiftName + '</b> · อยู่ในเวลาสแกน';
    } else {
      badge.classList.add('warn');
      text.innerHTML = '<b>' + shiftName + '</b> · นอกเวลาสแกน';
    }
  };
  update();
  setInterval(update, 30000);
}

// ================= CONNECTION STATUS =================
function initConnectionStatus() {
  const update = () => {
    const status = document.getElementById('connStatus');
    const text = document.getElementById('connText');
    if (navigator.onLine) {
      status.classList.remove('offline');
      text.innerText = 'ออนไลน์';
    } else {
      status.classList.add('offline');
      text.innerText = 'ออฟไลน์';
    }
  };
  window.addEventListener('online', () => {
    update();
    setStatus('🌐 เน็ตกลับมาแล้ว กำลัง sync...', 'info');
    setTimeout(syncQueue, 1000);
  });
  window.addEventListener('offline', update);
  update();
}

// ================= FORM LISTENERS =================
function initFormListeners() {
  const nameInput = document.getElementById('name');
  const pinInput = document.getElementById('pin');

  nameInput.addEventListener('input', () => {
    localStorage.setItem('guardTour_lastName', nameInput.value);
  });

  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') pinInput.focus();
  });

  pinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveScan(false);
  });
}

function loadLastGuardName() {
  const saved = localStorage.getItem('guardTour_lastName');
  if (saved) document.getElementById('name').value = saved;
}

// ================= GPS =================
function setGpsStatus(state, text) {
  const bar = document.getElementById('gpsBar');
  const spinner = document.getElementById('gpsSpinner');
  bar.classList.remove('ok', 'warn', 'bad');
  if (state === 'loading') {
    spinner.style.display = 'inline-block';
  } else {
    spinner.style.display = 'none';
    if (state === 'ok') bar.classList.add('ok');
    else if (state === 'warn') bar.classList.add('warn');
    else if (state === 'bad') bar.classList.add('bad');
  }
  document.getElementById('gpsText').innerText = text;
}

function getGpsQuality(acc) {
  if (acc <= 30) return { state: 'ok', text: '±' + acc + ' ม. · แม่นยำสูง' };
  if (acc <= 100) return { state: 'warn', text: '±' + acc + ' ม. · พอใช้' };
  return { state: 'bad', text: '±' + acc + ' ม. · คลาดเคลื่อนสูง' };
}

// ================= STATUS =================
function setStatus(msg, cls) {
  const s = document.getElementById('status');
  s.innerText = msg;
  s.className = 'show ' + (cls || 'info');
}

// ================= SAVE SCAN =================
async function saveScan(isConfirmed) {
  if (isConfirmMode && !isConfirmed) {
    isConfirmMode = false;
    pendingData = null;
    const b = document.getElementById('btn');
    b.className = 'btn-submit';
    b.innerHTML = '✅ บันทึกการตรวจ';
    b.onclick = () => saveScan(false);
    setStatus('ยกเลิกการยืนยันแล้ว', 'info');
    return;
  }

  const name = document.getElementById('name').value.trim();
  const pin = document.getElementById('pin').value.trim();
  const btn = document.getElementById('btn');

  if (!name) { setStatus('⚠️ กรุณากรอกชื่อ', 'err'); return; }
  if (!pin) { setStatus('⚠️ กรุณากรอก PIN', 'err'); return; }
  if (!navigator.geolocation) { setStatus('❌ อุปกรณ์ไม่รองรับ GPS', 'err'); return; }

  btn.disabled = true;
  setGpsStatus('loading', 'กำลังระบุตำแหน่ง...');

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const acc = Math.round(pos.coords.accuracy);
      const quality = getGpsQuality(acc);
      setGpsStatus(quality.state, quality.text);

      const scanData = {
        cp: currentCp,
        name: name,
        pin: pin,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        acc: pos.coords.accuracy,
        ts: Date.now(),
        confirmed: isConfirmed
      };

      // เก็บลง IndexedDB ก่อนเสมอ
      await GTDB.addScanToQueue(scanData);
      updateQueueBadge();

      setStatus('📦 บันทึกไว้ในเครื่องแล้ว\nจะ sync อัตโนมัติ', 'ok');

      // ถ้าออนไลน์ → sync ทันที
      if (navigator.onLine) {
        setTimeout(syncQueue, 500);
      }

      document.getElementById('pin').value = '';
      isConfirmMode = false;
      pendingData = null;
      btn.className = 'btn-submit';
      btn.innerHTML = '✅ บันทึกการตรวจ';
      btn.onclick = () => saveScan(false);
      setTimeout(() => { btn.disabled = false; }, 2000);
    },
    (err) => {
      let msg = 'ไม่สามารถระบุตำแหน่งได้';
      if (err.code === 1) msg = 'คุณไม่อนุญาตให้เข้าถึงตำแหน่ง';
      else if (err.code === 2) msg = 'หาตำแหน่งไม่ได้ ลองออกที่โล่ง';
      else if (err.code === 3) msg = 'หมดเวลาหาตำแหน่ง';
      setStatus('❌ ' + msg, 'err');
      setGpsStatus('bad', 'ไม่สามารถระบุตำแหน่ง');
      btn.disabled = false;
    },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
  );
}

// ================= SYNC QUEUE =================
let _syncing = false;

async function syncQueue() {
  if (_syncing) return;
  if (!navigator.onLine) return;

  const queue = await GTDB.getAllQueuedScans();
  if (queue.length === 0) return;

  _syncing = true;
  console.log('Syncing ' + queue.length + ' items...');
  updateQueueBadge();

  let done = 0, failed = 0;

  for (const item of queue) {
    try {
      await postToAPI('addScan', item);
      // ✅ ด้วย no-cors เราไม่เห็น response → ถือว่าส่งสำเร็จ
      // → เก็บ history + ลบออกจาก queue
      await GTDB.addToHistory(item);
      await GTDB.deleteQueuedScan(item.id);
      done++;
    } catch (err) {
      // ✅ Network error เท่านั้น (ไม่ใช่ reject) → เก็บไว้ลองใหม่
      console.error('Sync error:', err);
      failed++;
    }
  }

  _syncing = false;
  await updateQueueBadge();

  if (done > 0) setStatus('✅ Sync ' + done + ' รายการสำเร็จ', 'ok');
  if (failed > 0) setStatus('⚠️ Sync ล้มเหลว ' + failed + ' รายการ', 'warn');
}
async function manualSync() {
  if (!navigator.onLine) {
    setStatus('📵 ยังไม่มีเน็ต', 'warn');
    return;
  }
  setStatus('⏳ กำลัง sync...', 'info');
  await syncQueue();
}

// ================= UPDATE BADGE =================
async function updateQueueBadge() {
  const count = await GTDB.countQueuedScans();
  const badge = document.getElementById('queueBadge');
  if (!badge) return;
  if (count > 0) {
    badge.innerHTML =
      '<div>📦 มีรายการค้างส่ง <b>' + count + '</b> รายการ</div>' +
      '<button onclick="manualSync()">ลอง sync ทันที</button>';
    badge.style.display = 'block';
  } else {
    badge.style.display = 'none';
  }
}

// ================= API CALL =================
async function postToAPI(action, data) {
  const res = await fetch(API_URL, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, data })
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return await res.json();
}

console.log('✅ App module loaded');
