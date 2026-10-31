// ================================================================
//  29MW Plant EMS — Direct Firebase Real-Time Database Engine
//  Instant automatic write on add/edit/delete (Zero manual upload)
// ================================================================

const firebaseConfig = {
  apiKey: "AIzaSyB5x7pa-ZpogtEo-Ph2TLd4V-JHMs82sME",
  authDomain: "mw-43146.firebaseapp.com",
  projectId: "mw-43146",
  storageBucket: "mw-43146.firebasestorage.app",
  messagingSenderId: "729106073977",
  appId: "1:729106073977:web:4044ad107235bc527b87a8",
  measurementId: "G-JRC708PNCG"
};

const FirebaseDB = (() => {
  let app = null;
  let db = null;       // Cloud Firestore
  let rtdb = null;     // Realtime Database
  let isInitialized = false;
  const pendingWrites = [];

  // Initialize immediately
  const init = () => {
    try {
      if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) {
          app = firebase.initializeApp(firebaseConfig);
        } else {
          app = firebase.app();
        }

        if (typeof firebase.firestore === 'function') {
          db = firebase.firestore();
          try {
            db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
          } catch (e) {}
        }

        if (typeof firebase.database === 'function') {
          try { rtdb = firebase.database(); } catch (e) {}
        }

        isInitialized = true;
        console.log('⚡ Firebase Cloud Firestore connected & ready for immediate writes (Project: mw-43146)');

        // Flush any writes that happened while loading
        while (pendingWrites.length > 0) {
          const item = pendingWrites.shift();
          saveDoc(item.coll, item.id, item.data);
        }

        updateUIStatus(true);
      } else {
        console.warn('Firebase SDK script not ready yet.');
        updateUIStatus(false);
      }
    } catch (err) {
      console.error('Firebase initialization error:', err);
      updateUIStatus(false);
    }
  };

  const updateUIStatus = (online) => {
    const indicators = document.querySelectorAll('.firebase-status-indicator, #firebaseStatusBadge');
    indicators.forEach(el => {
      const dot = el.querySelector('.status-dot');
      const text = el.querySelector('.status-text');
      if (dot) {
        dot.style.background = online ? '#00e676' : '#f0a500';
        dot.style.boxShadow = online ? '0 0 8px #00e676' : '0 0 6px #f0a500';
      }
      if (text) {
        text.textContent = online ? 'Database Live' : 'Connecting...';
      }
    });
  };

  // ---- INSTANT WRITE TO FIRESTORE (Adds/updates to database right away) ----
  const saveDoc = async (collectionName, docId, data) => {
    if (!db) {
      pendingWrites.push({ coll: collectionName, id: docId, data });
      return false;
    }
    try {
      // Clean undefined or non-serializable values for Firestore
      const cleanData = JSON.parse(JSON.stringify(data));
      cleanData._lastUpdated = new Date().toISOString();

      await db.collection(collectionName).doc(String(docId)).set(cleanData, { merge: true });
      console.log(`[Firebase] ⚡ Saved directly to Firestore: ${collectionName}/${docId}`);
      return true;
    } catch (err) {
      console.error(`[Firebase] Write failed for ${collectionName}/${docId}:`, err);
      return false;
    }
  };

  // ---- INSTANT DELETE FROM FIRESTORE ----
  const deleteDoc = async (collectionName, docId) => {
    if (!db) return false;
    try {
      await db.collection(collectionName).doc(String(docId)).delete();
      console.log(`[Firebase] 🗑️ Deleted from Firestore: ${collectionName}/${docId}`);
      return true;
    } catch (err) {
      console.error(`[Firebase] Delete failed for ${collectionName}/${docId}:`, err);
      return false;
    }
  };

  const getDoc = async (collectionName, docId) => {
    if (!db) return null;
    try {
      const snap = await db.collection(collectionName).doc(String(docId)).get();
      return snap.exists ? snap.data() : null;
    } catch (err) {
      return null;
    }
  };

  const getAllDocs = async (collectionName) => {
    if (!db) return [];
    try {
      const snap = await db.collection(collectionName).get();
      const list = [];
      snap.forEach(d => list.push(d.data()));
      return list;
    } catch (err) {
      return [];
    }
  };

  // ---- REALTIME LISTENER FOR INSTANT LIVE SYNC ACROSS DEVICES ----
  const listenCollection = (collectionName, callback) => {
    if (!db) return () => {};
    return db.collection(collectionName).onSnapshot(
      snapshot => {
        const list = [];
        snapshot.forEach(d => list.push(d.data()));
        if (typeof callback === 'function') callback(list);
      },
      err => {
        console.warn(`[Firebase] Snapshot listen error for ${collectionName}:`, err);
      }
    );
  };

  // ---- AUTOMATIC SEED & FULL PUSH/PULL (HANDLED AUTOMATICALLY ON BOOT) ----
  const autoSeedIfEmpty = async () => {
    if (!db) return;
    try {
      const usersSnap = await db.collection('users').limit(1).get();
      if (usersSnap.empty) {
        console.log('⚡ Firebase Database is empty — auto-populating initial plant database...');
        
        // Push initial users
        const usersRaw = localStorage.getItem('pc_users');
        if (usersRaw) {
          const users = JSON.parse(usersRaw);
          for (const u of users) {
            await db.collection('users').doc(String(u.id)).set(u);
          }
        }

        // Push initial template
        const templateRaw = localStorage.getItem('pc_daily_template');
        if (templateRaw) {
          const templates = JSON.parse(templateRaw);
          for (const t of templates) {
            await db.collection('dailyTemplate').doc(String(t.id)).set(t);
          }
        }
        console.log('✅ Initial database setup complete in Firestore!');
      }
    } catch (e) {
      console.warn('[Firebase] Auto-seed check note:', e);
    }
  };

  // Pull latest data from Firestore to keep local storage in sync
  const pullCloudData = async () => {
    if (!db) return;
    try {
      const collections = [
        { coll: 'users', key: 'pc_users' },
        { coll: 'dailyTemplate', key: 'pc_daily_template' },
        { coll: 'correctiveMaint', key: 'pc_corrective' },
        { coll: 'preventiveMaint', key: 'pc_preventive' },
        { coll: 'spareParts', key: 'pc_spare_parts' },
        { coll: 'partsToOrder', key: 'pc_parts_order' },
        { coll: 'trainingRecords', key: 'pc_training' },
      ];

      for (const item of collections) {
        const docs = await getAllDocs(item.coll);
        if (docs && docs.length > 0) {
          localStorage.setItem(item.key, JSON.stringify(docs));
        }
      }

      // Daily check records
      const dailyDocs = await getAllDocs('dailyRecords');
      if (dailyDocs && dailyDocs.length > 0) {
        const existing = JSON.parse(localStorage.getItem('pc_daily_records') || '{}');
        dailyDocs.forEach(d => {
          if (d.date) existing[d.date] = d;
        });
        localStorage.setItem('pc_daily_records', JSON.stringify(existing));
      }

      // Monthly schedules
      const schedDocs = await getAllDocs('monthlySchedules');
      if (schedDocs && schedDocs.length > 0) {
        schedDocs.forEach(s => {
          if (s.year && s.month) {
            const key = `pc_sched_${s.year}_${String(s.month).padStart(2,'0')}`;
            localStorage.setItem(key, JSON.stringify(s));
          }
        });
      }
    } catch (err) {
      console.warn('[Firebase] Background sync note:', err);
    }
  };

  // Immediate init
  init();

  // If DOM already loaded or when it loads, run auto-seed & live listeners
  const onReady = () => {
    if (!isInitialized) init();
    autoSeedIfEmpty().then(() => pullCloudData());
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }

  return {
    config: firebaseConfig,
    init,
    get app() { return app; },
    get db() { return db; },
    get rtdb() { return rtdb; },
    get isReady() { return isInitialized && db !== null; },
    saveDoc,
    getDoc,
    deleteDoc,
    getAllDocs,
    listenCollection
  };
})();

// Expose globally
if (typeof window !== 'undefined') {
  window.FirebaseDB = FirebaseDB;
  window.firebaseConfig = firebaseConfig;
}
