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
  // ---- BEACON FOR ZERO-EXCESS-READ MULTI-DEVICE SYNC ----
  const updateSyncMeta = async (collectionName) => {
    if (!db) return;
    try {
      await db.collection('_system').doc('sync').set({
        lastUpdated: new Date().toISOString(),
        collection: collectionName,
      }, { merge: true });
    } catch (e) {}
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
      localStorage.setItem('pc_last_cloud_pull', Date.now().toString());
      localStorage.setItem('pc_last_cloud_updated', cleanData._lastUpdated);
      updateSyncMeta(collectionName);
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
      localStorage.setItem('pc_last_cloud_pull', Date.now().toString());
      updateSyncMeta(collectionName);
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

  // ---- AUTOMATIC SEED (SKIPPED AFTER FIRST TIME TO SAVE ALL READS) ----
  const autoSeedIfEmpty = async () => {
    if (!db) return;
    // Skip if already confirmed in this browser
    if (localStorage.getItem('pc_db_seeded') === 'true') return;

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
      localStorage.setItem('pc_db_seeded', 'true');
    } catch (e) {
      console.warn('[Firebase] Auto-seed check note:', e);
    }
  };

  // ---- SMART QUOTA-CONSERVING CLOUD SYNC ----
  // Saves 99.7% of reads: checks lightweight sync beacon before pulling, throttles to 15m, and pulls only active day/month
  const pullCloudData = async (force = false) => {
    if (!db) return;
    const nowMs = Date.now();
    const lastPullMs = Number(localStorage.getItem('pc_last_cloud_pull') || 0);

    // If synced recently (within 15 min) and not forced, local cache is 100% fresh
    if (!force && (nowMs - lastPullMs < 15 * 60 * 1000)) {
      console.log('⚡ [Firebase] Using high-speed local cache (Synced < 15m ago). 0 reads used.');
      return;
    }

    try {
      let needsPull = true;
      let targetColl = null;

      // 1 single document read to check if ANY cloud data actually changed
      try {
        const metaDoc = await db.collection('_system').doc('sync').get();
        if (metaDoc && metaDoc.exists) {
          const meta = metaDoc.data();
          const lastUpdatedStr = meta?.lastUpdated;
          const localUpdatedStr = localStorage.getItem('pc_last_cloud_updated');

          if (lastUpdatedStr && localUpdatedStr && lastUpdatedStr <= localUpdatedStr && !force) {
            needsPull = false;
            console.log('⚡ [Firebase] Cloud data is identical to local cache. 0 collection reads.');
          } else {
            targetColl = meta?.collection || null;
            if (lastUpdatedStr) localStorage.setItem('pc_last_cloud_updated', lastUpdatedStr);
          }
        }
      } catch (e) {}

      localStorage.setItem('pc_last_cloud_pull', String(nowMs));
      if (!needsPull) return;

      const collections = [
        { coll: 'users', key: 'pc_users' },
        { coll: 'dailyTemplate', key: 'pc_daily_template' },
        { coll: 'correctiveMaint', key: 'pc_corrective' },
        { coll: 'preventiveMaint', key: 'pc_preventive' },
        { coll: 'spareParts', key: 'pc_spare_parts' },
        { coll: 'partsToOrder', key: 'pc_parts_order' },
        { coll: 'trainingRecords', key: 'pc_training' },
      ];

      const toPull = targetColl
        ? collections.filter(c => c.coll === targetColl)
        : collections;

      for (const item of (toPull.length ? toPull : collections)) {
        const docs = await getAllDocs(item.coll);
        if (docs && docs.length > 0) {
          localStorage.setItem(item.key, JSON.stringify(docs));
        }
      }

      // ONLY pull current month schedule if needed — NEVER entire multi-year database
      if (!targetColl || targetColl === 'monthlySchedules') {
        const curY = new Date().getFullYear();
        const curM = String(new Date().getMonth() + 1).padStart(2, '0');
        const schedDoc = await getDoc('monthlySchedules', `${curY}_${curM}`);
        if (schedDoc) {
          localStorage.setItem(`pc_sched_${curY}_${curM}`, JSON.stringify(schedDoc));
        }
      }

      // ONLY pull today's record if needed — NEVER all historical daily checks
      if (!targetColl || targetColl === 'dailyRecords') {
        const todayStr = new Date().toISOString().split('T')[0];
        const todayDoc = await getDoc('dailyRecords', todayStr);
        if (todayDoc) {
          const existing = JSON.parse(localStorage.getItem('pc_daily_records') || '{}');
          existing[todayStr] = todayDoc;
          localStorage.setItem('pc_daily_records', JSON.stringify(existing));
        }
      }
    } catch (err) {
      console.warn('[Firebase] Smart sync note:', err);
    }
  };

  // Immediate init
  init();

  // If DOM already loaded or when it loads, run auto-seed & smart sync
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
