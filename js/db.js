/*** ============================================================
 *  IndexedDB — เก็บข้อมูล offline
 *  ============================================================ */

const DB_NAME = 'GuardTourDB';
const DB_VERSION = 1;
const STORE_SCANS = 'scans';   // การสแกนที่รอ sync
const STORE_META = 'meta';     // ข้อมูลอื่นๆ

let _db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) { resolve(_db); return; }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      // Store: scans (queue)
      if (!db.objectStoreNames.contains(STORE_SCANS)) {
        const store = db.createObjectStore(STORE_SCANS, {
          keyPath: 'id', autoIncrement: true
        });
        store.createIndex('ts', 'ts', { unique: false });
        store.createIndex('guard', 'name', { unique: false });
      }

      // Store: meta (config, last sync ฯลฯ)
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };

    req.onsuccess = (e) => {
      _db = e.target.result;
      resolve(_db);
    };

    req.onerror = (e) => reject(e.target.error);
  });
}

/*** ---------- SCANS ---------- ***/

// เพิ่มรายการสแกนลง queue
async function addScanToQueue(scanData) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SCANS, 'readwrite');
    const store = tx.objectStore(STORE_SCANS);
    const item = {
      ...scanData,
      ts: scanData.ts || Date.now(),
      createdAt: Date.now()
    };
    const req = store.add(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

// ดึงทั้งหมด
async function getAllQueuedScans() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SCANS, 'readonly');
    const store = tx.objectStore(STORE_SCANS);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

// นับ
async function countQueuedScans() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SCANS, 'readonly');
    const store = tx.objectStore(STORE_SCANS);
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

// ลบ 1 รายการ (หลัง sync สำเร็จ)
async function deleteQueuedScan(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SCANS, 'readwrite');
    const store = tx.objectStore(STORE_SCANS);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

// ลบทั้งหมด
async function clearQueuedScans() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SCANS, 'readwrite');
    const store = tx.objectStore(STORE_SCANS);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

// ดึงเฉพาะของ รปภ. คนหนึ่ง
async function getQueuedByGuard(name) {
  const all = await getAllQueuedScans();
  return all.filter(s => s.name === name);
}

/*** ---------- META ---------- ***/

async function setMeta(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readwrite');
    const store = tx.objectStore(STORE_META);
    const req = store.put({ key, value, updatedAt: Date.now() });
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

async function getMeta(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const store = tx.objectStore(STORE_META);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = (e) => reject(e.target.error);
  });
}

/*** ---------- EXPORT FOR DEBUG ---------- ***/

window.GTDB = {
  openDB,
  addScanToQueue,
  getAllQueuedScans,
  countQueuedScans,
  deleteQueuedScan,
  clearQueuedScans,
  getQueuedByGuard,
  setMeta,
  getMeta
};

console.log('✅ DB module loaded');
