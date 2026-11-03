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
        setupRealtimeListeners();
      } else {
        console.warn('Firebase SDK script not ready yet.');
        updateUIStatus(false);
      }
    } catch (err) {
      console.error('Firebase initialization error:', err);
      updateUIStatus(false);
    }
  };

  const setupRealtimeListeners = () => {
    if (!db) return;

    // 1. Instant snapshot listener on monthlySchedules (so all shifts update live across devices)
    try {
      db.collection('monthlySchedules').onSnapshot(snap => {
        if (!snap) return;
        let updated = false;
        snap.forEach(docSnap => {
          const data = docSnap.data();
          if (data && data.year && data.month) {
            const key = `pc_sched_${data.year}_${String(data.month).padStart(2, '0')}`;
            localStorage.setItem(key, JSON.stringify(data));
            updated = true;
          }
        });
        if (updated && typeof window !== 'undefined') {
          console.log('⚡ [Firebase] Real-time monthly schedule synced to device');
          window.dispatchEvent(new CustomEvent('cloudDataUpdated', {
            detail: { collection: 'monthlySchedules', timestamp: Date.now() }
          }));
        }
      }, err => {
        console.warn('[Firebase] monthlySchedules snapshot warning:', err);
      });
    } catch (e) {}

    // 2. Real-time listener on system sync beacon for general updates
    try {
      db.collection('_system').doc('sync').onSnapshot(snap => {
        if (!snap || !snap.exists) return;
        const meta = snap.data();
        const lastUpdatedStr = meta?.lastUpdated;
        const localUpdatedStr = localStorage.getItem('pc_last_cloud_updated');
        if (lastUpdatedStr && lastUpdatedStr !== localUpdatedStr) {
          console.log('⚡ [Firebase] Real-time sync beacon fired! Detected change in:', meta?.collection);
          pullCloudData(true);
        }
      }, err => {
        console.warn('[Firebase] Sync beacon snapshot warning:', err);
      });
    } catch (e) {}
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
      if (err?.code === 'permission-denied') {
        if (typeof showToast === 'function') {
          showToast('⚠️ Firebase Rules Locked! Go to Firebase Console -> Rules and set allow read, write: if true;', 'error');
        } else {
          console.warn('⚠️ FIRESTORE RULES LOCKED: Set "allow read, write: if true;" in Firebase Console > Firestore > Rules');
        }
      }
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
        // Push initial training records
        const trRaw = localStorage.getItem('pc_training');
        if (trRaw) {
          const trs = JSON.parse(trRaw);
          for (const t of trs) {
            if (t && t.id) await db.collection('trainingRecords').doc(String(t.id)).set(t);
          }
        }
        // Push initial engine fans
        const fansRaw = localStorage.getItem('pc_engine_fans');
        if (fansRaw) {
          const fans = JSON.parse(fansRaw);
          for (const f of fans) {
            if (f && f.id) await db.collection('engineFans').doc(String(f.id)).set(f);
          }
        }
        // Push initial spare parts
        const spareRaw = localStorage.getItem('pc_spare_parts');
        if (spareRaw) {
          const parts = JSON.parse(spareRaw);
          for (const p of parts) {
            if (p && p.id) await db.collection('spareParts').doc(String(p.id)).set(p);
          }
        }
        // Push initial parts to order
        const ordersRaw = localStorage.getItem('pc_parts_order');
        if (ordersRaw) {
          const orders = JSON.parse(ordersRaw);
          for (const o of orders) {
            if (o && o.id) await db.collection('partsToOrder').doc(String(o.id)).set(o);
          }
        }
        // Push initial preventive maintenance
        const pmRaw = localStorage.getItem('pc_preventive');
        if (pmRaw) {
          const pms = JSON.parse(pmRaw);
          for (const pm of pms) {
            if (pm && pm.id) await db.collection('preventiveMaint').doc(String(pm.id)).set(pm);
          }
        }
        // Push initial corrective maintenance
        const cmRaw = localStorage.getItem('pc_corrective');
        if (cmRaw) {
          const cms = JSON.parse(cmRaw);
          for (const cm of cms) {
            if (cm && cm.id) await db.collection('correctiveMaint').doc(String(cm.id)).set(cm);
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
  // Checks lightweight sync beacon before pulling and pulls only modified collections
  const pullCloudData = async (force = false) => {
    if (!db) return;
    const nowMs = Date.now();
    const lastPullMs = Number(localStorage.getItem('pc_last_cloud_pull') || 0);

    // Fast check: if pulled within 1.5 seconds without force, skip
    if (!force && (nowMs - lastPullMs < 1500)) {
      return;
    }

    try {
      let needsPull = true;
      let targetColl = null;

      // Check current month schedule existence locally
      const curY = new Date().getFullYear();
      const curM = String(new Date().getMonth() + 1).padStart(2, '0');
      const missingCurrentSched = !localStorage.getItem(`pc_sched_${curY}_${curM}`);

      // 1 single document read to check if ANY cloud data actually changed
      try {
        const metaDoc = await db.collection('_system').doc('sync').get();
        if (metaDoc && metaDoc.exists) {
          const meta = metaDoc.data();
          const lastUpdatedStr = meta?.lastUpdated;
          const localUpdatedStr = localStorage.getItem('pc_last_cloud_updated');

          if (lastUpdatedStr && localUpdatedStr && lastUpdatedStr <= localUpdatedStr && !missingCurrentSched && !force) {
            needsPull = false;
            console.log('⚡ [Firebase] Cloud data is identical to local cache. 0 collection reads.');
          } else {
            targetColl = meta?.collection || null;
            if (lastUpdatedStr) localStorage.setItem('pc_last_cloud_updated', lastUpdatedStr);
          }
        }
      } catch (e) {}

      localStorage.setItem('pc_last_cloud_pull', String(nowMs));
      if (!needsPull && !force) return;

      const collections = [
        { coll: 'users', key: 'pc_users' },
        { coll: 'dailyTemplate', key: 'pc_daily_template' },
        { coll: 'correctiveMaint', key: 'pc_corrective' },
        { coll: 'preventiveMaint', key: 'pc_preventive' },
        { coll: 'spareParts', key: 'pc_spare_parts' },
        { coll: 'partsToOrder', key: 'pc_parts_order' },
        { coll: 'trainingRecords', key: 'pc_training' },
        { coll: 'engineFilters', key: 'pc_engine_filters' },
        { coll: 'engineFans', key: 'pc_engine_fans' },
      ];

      for (const item of collections) {
        const docs = await getAllDocs(item.coll);
        if (item.coll === 'engineFilters') {
          // Permanently purge legacy seed records (ef-1 .. ef-4) from cloud and local
          const valid = (docs || []).filter(f => {
            if (['ef-1', 'ef-2', 'ef-3', 'ef-4'].includes(f.id)) {
              deleteDoc('engineFilters', f.id);
              return false;
            }
            return true;
          });
          localStorage.setItem(item.key, JSON.stringify(valid));
        } else if (docs && docs.length > 0) {
          if (item.coll === 'engineFans') {
            // Merge cloud fans into existing local cache so we never lose fans
            const existing = JSON.parse(localStorage.getItem(item.key) || '[]');
            const map = {};
            existing.forEach(f => { if (f && f.id) map[f.id] = f; });
            docs.forEach(f => { if (f && f.id) map[f.id] = f; });
            localStorage.setItem(item.key, JSON.stringify(Object.values(map)));
          } else {
            localStorage.setItem(item.key, JSON.stringify(docs));
          }
        }
      }

      // Always pull all monthly schedules into local storage
      const schedDocs = await getAllDocs('monthlySchedules');
      if (schedDocs && schedDocs.length > 0) {
        schedDocs.forEach(sched => {
          if (sched && sched.year && sched.month) {
            const key = `pc_sched_${sched.year}_${String(sched.month).padStart(2, '0')}`;
            localStorage.setItem(key, JSON.stringify(sched));
          }
        });
      }

      // ONLY pull today's record if needed — NEVER all historical daily checks
      const todayStr = new Date().toISOString().split('T')[0];
      const todayDoc = await getDoc('dailyRecords', todayStr);
      if (todayDoc) {
        const existing = JSON.parse(localStorage.getItem('pc_daily_records') || '{}');
        existing[todayStr] = todayDoc;
        localStorage.setItem('pc_daily_records', JSON.stringify(existing));
      }

      // Broadcast live cloud update event so active views re-render immediately
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cloudDataUpdated', {
          detail: { collection: targetColl || 'all', timestamp: nowMs }
        }));
      }
    } catch (err) {
      console.warn('[Firebase] Smart sync note:', err);
    }
  };

  // ---- PUSH ALL LOCAL DATA TO FIRESTORE ----
  const pushAllToCloud = async () => {
    if (!db) {
      console.warn('[Firebase] Database not ready yet.');
      return false;
    }
    const collMap = {
      users: 'pc_users',
      dailyTemplate: 'pc_daily_template',
      correctiveMaint: 'pc_corrective',
      preventiveMaint: 'pc_preventive',
      spareParts: 'pc_spare_parts',
      partsToOrder: 'pc_parts_order',
      trainingRecords: 'pc_training',
      engineFilters: 'pc_engine_filters',
      engineFans: 'pc_engine_fans',
    };
    let count = 0;
    try {
      for (const [coll, key] of Object.entries(collMap)) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              for (const item of list) {
                if (item && item.id) {
                  await db.collection(coll).doc(String(item.id)).set(item, { merge: true });
                  count++;
                }
              }
            }
          } catch (e) {}
        }
      }
      await updateSyncMeta('all');
      console.log(`[Firebase] ⚡ Successfully pushed ${count} items to Firestore!`);
      if (typeof showToast === 'function') {
        showToast(`✅ Synced ${count} records directly to Firestore!`, 'success');
      }
      return true;
    } catch (err) {
      console.error('[Firebase] Push all error:', err);
      if (err?.code === 'permission-denied') {
        if (typeof showToast === 'function') {
          showToast('⚠️ Firestore Rules Locked! In Firebase Console, go to Rules and set allow read, write: if true;', 'error');
        }
      }
      return false;
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
    listenCollection,
    pullCloudData,
    pushAllToCloud
  };
})();

// Expose globally
if (typeof window !== 'undefined') {
  window.FirebaseDB = FirebaseDB;
  window.firebaseConfig = firebaseConfig;
}
