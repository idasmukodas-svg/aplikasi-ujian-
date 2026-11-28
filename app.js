/* ===================================================
   APP.JS - LMS & CBT SMAN 1 TARAJU (MURNI CLOUD FIRESTORE)
   =================================================== */

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBCWVQE9zWCgGJy_MYp47U4dp-gDsWFRE8",
  authDomain: "aplikasi-ujian-8e501.firebaseapp.com",
  projectId: "aplikasi-ujian-8e501",
  storageBucket: "aplikasi-ujian-8e501.firebasestorage.app",
  messagingSenderId: "945781407027",
  appId: "1:945781407027:web:4672d4c894e143c9b05246",
  measurementId: "G-CBH4C0BVXD"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestoreDb = getFirestore(app);
window.firestoreDb = firestoreDb;

const USE_FIRESTORE = true;
window.USE_FIRESTORE = USE_FIRESTORE;
const CACHE_TTL_MS = 30 * 60 * 1000;

const MODE_UJIAN_STORAGE_KEY = "cbt_mode_ujian_aktif_cache";
window.modeUjianAktif = false;

function terapkanStatusModeUjianUI(aktif) {
  window.modeUjianAktif = Boolean(aktif);

  const session = window.userSession || (typeof userSession !== "undefined" ? userSession : {}) || {};
  const isGuru = session.role === "guru";
  const isAdmin = session.role === "admin" || session.role === "superadmin";

  // Sinkronkan tombol/toggle sakelar jika tersedia di halaman admin
  const toggleAdmin = document.getElementById("toggleModeUjianAktif");
  if (toggleAdmin) {
    toggleAdmin.checked = window.modeUjianAktif;
  }

  const badgeMode = document.getElementById("statusBadgeModeUjian");
  if (badgeMode) {
    badgeMode.textContent = window.modeUjianAktif ? "MODE UJIAN AKTIF (GURU DIKUNCI)" : "MODE NORMAL (GURU AKTIF)";
    badgeMode.className = window.modeUjianAktif
      ? "badge bg-danger fw-bold"
      : "badge bg-success fw-bold";
  }

  const panelSakelar = document.getElementById("panelSakelarModeUjian");
  if (panelSakelar && !isAdmin) {
    panelSakelar.classList.add("d-none");
  }

  // Jika login sebagai guru dan mode ujian aktif, batasi akses monitoring/kelola
  let bannerGuru = document.getElementById("bannerModeUjianGuru");
  if (isGuru && window.modeUjianAktif) {
    if (typeof unsubMonitoring === "function") {
      try { unsubMonitoring(); } catch (e) {}
      unsubMonitoring = null;
    }

    const tabMonitoring = document.querySelector('[data-bs-target="#contentMonitoring"], #tabMonitoring, [href="#contentMonitoring"]');
    if (tabMonitoring) {
      tabMonitoring.classList.add("d-none");
    }

    const contentMonitoring = document.getElementById("contentMonitoring");
    if (contentMonitoring && contentMonitoring.classList.contains("active")) {
      contentMonitoring.classList.remove("show", "active");
    }

    if (!bannerGuru) {
      bannerGuru = document.createElement("div");
      bannerGuru.id = "bannerModeUjianGuru";
      bannerGuru.className = "alert alert-warning border-warning shadow-sm my-3";
      bannerGuru.innerHTML = `
        <div class="fw-bold mb-1">Sesi Ujian Sedang Berlangsung — Akses Guru Dibatasi Sementara</div>
        <div class="small mb-0">
          Untuk menjaga stabilitas kuota dan kelancaran ujian, pemantauan serta penanganan kendala peserta dipusatkan ke Admin/Proktor.
          Akses guru akan otomatis terbuka kembali setelah mode ujian dinonaktifkan oleh Admin.
        </div>
      `;
      const mainContainer = document.querySelector(".container, .container-fluid, main") || document.body;
      mainContainer.prepend(bannerGuru);
    } else {
      bannerGuru.classList.remove("d-none");
    }
  } else {
    if (bannerGuru) {
      bannerGuru.classList.add("d-none");
    }
    const tabMonitoring = document.querySelector('[data-bs-target="#contentMonitoring"], #tabMonitoring, [href="#contentMonitoring"]');
    if (tabMonitoring) {
      tabMonitoring.classList.remove("d-none");
    }
  }
}

window.muatModeUjianAktif = async function(forceReload = false) {
  if (!forceReload) {
    try {
      const rawCache = sessionStorage.getItem(MODE_UJIAN_STORAGE_KEY);
      if (rawCache !== null) {
        const parsed = JSON.parse(rawCache);
        if (typeof parsed?.aktif === "boolean") {
          terapkanStatusModeUjianUI(parsed.aktif);
          return parsed.aktif;
        }
      }
    } catch (e) {}
  }

  try {
    const refConfig = doc(firestoreDb, "config", "mode_ujian");
    const snap = await getDoc(refConfig);
    const aktif = snap.exists() ? Boolean(snap.data()?.aktif) : false;

    try {
      sessionStorage.setItem(MODE_UJIAN_STORAGE_KEY, JSON.stringify({
        aktif,
        savedAt: Date.now()
      }));
    } catch (e) {}

    terapkanStatusModeUjianUI(aktif);
    return aktif;
  } catch (err) {
    console.error("Gagal memuat status modeUjianAktif:", err);
    terapkanStatusModeUjianUI(false);
    return false;
  }
};

window.setModeUjianAktif = async function(aktifBaru) {
  const session = window.userSession || (typeof userSession !== "undefined" ? userSession : {}) || {};
  const isAdmin = session.role === "admin" || session.role === "superadmin";
  if (!isAdmin) {
    alert("Hanya Admin yang dapat mengubah status Mode Ujian.");
    return false;
  }

  const statusBool = Boolean(aktifBaru);

  try {
    const refConfig = doc(firestoreDb, "config", "mode_ujian");
    await setDoc(refConfig, {
      aktif: statusBool,
      updatedAt: new Date().toISOString(),
      updatedBy: session.email || session.nama || "admin"
    }, { merge: true });

    try {
      sessionStorage.setItem(MODE_UJIAN_STORAGE_KEY, JSON.stringify({
        aktif: statusBool,
        savedAt: Date.now()
      }));
    } catch (e) {}

    terapkanStatusModeUjianUI(statusBool);
    alert(statusBool
      ? "Mode Ujian AKTIF: Akses guru dibatasi sementara selama sesi ujian."
      : "Mode Ujian NONAKTIF: Akses guru telah dibuka kembali.");
    return true;
  } catch (err) {
    console.error("Gagal memperbarui modeUjianAktif:", err);
    alert("Gagal menyimpan status Mode Ujian ke Firestore.");
    return false;
  }
};

function readSessionCache(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeSessionCache(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // Abaikan jika penyimpanan penuh
  }
}

function removeSessionCache(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {}
}

function clearMasterCache() {
  Object.keys(sessionStorage).forEach((k) => {
    if (
      k.startsWith("cbt_master_") ||
      k.startsWith("cbt_siswa_kelas_") ||
      k.startsWith("cbt_soal_")
    ) {
      try { sessionStorage.removeItem(k); } catch {}
    }
  });
}

let userSession = null;
const storedUser =
  sessionStorage.getItem("userLoggedIn") ||
  localStorage.getItem("cbt_current_user") ||
  localStorage.getItem("userSession");

if (!storedUser) {
  window.location.href = "login.html";
} else {
  try {
    userSession = JSON.parse(storedUser);
    window.userSession = userSession;
  } catch (err) {
    console.error("Session tidak valid:", err);
    sessionStorage.removeItem("userLoggedIn");
    localStorage.removeItem("cbt_current_user");
    localStorage.removeItem("userSession");
    window.location.href = "login.html";
  }
}

let daftarUjian = [];
let daftarSiswa = [];
let hasilUjian = [];
let daftarPengguna = [];
let daftarKelas = [];
let activeUjianId = null;
let unsubMonitoring = null;
let sedangProsesMassalMonitoring = false;
let rekapTerpilihIds = new Set();
let sedangHapusRekap = false;
let lastLoadedRekapUjianId = null;
let currentEditGuruUid = "";

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeFirestoreId(raw) {
  return String(raw ?? "").trim().replace(/[.#$\[\]\/]/g, "_") || "default";
}

function isUserAdmin(sessionObj) {
  const s = sessionObj || window.userSession || userSession || {};
  const role = String(s.role || "").toLowerCase().trim();
  return role === "admin" || role === "superadmin" || role === "kepsek";
}

function getKelasDiampuGuru(sessionObj) {
  const s = sessionObj || window.userSession || userSession || {};
  const detail = normalisasiDetailAmpuan(s);
  const dariDetail = Object.values(detail).flat();
  const dariField = Array.isArray(s.kelasDiampu)
    ? s.kelasDiampu
    : (typeof s.kelasDiampu === "string" ? s.kelasDiampu.split(",") : []);

  const gabungan = [...dariField, ...dariDetail]
    .map((k) => String(k || "").trim())
    .filter(Boolean);

  return Array.from(new Set(gabungan));
}

function isKelasDiizinkanUntukUser(namaKelas, sessionObj) {
  const cleanKelas = String(namaKelas || "").trim();
  if (!cleanKelas) return false;
  if (isUserAdmin(sessionObj)) return true;

  const allowed = getKelasDiampuGuru(sessionObj).map((k) => k.toLowerCase());
  return allowed.includes(cleanKelas.toLowerCase());
}

function getStatusPesertaDocId(ujianId, nisn) {
  return `${sanitizeFirestoreId(ujianId)}__${sanitizeFirestoreId(nisn)}`;
}

function formatWaktuRekap(raw) {
  if (!raw) return "-";
  if (typeof raw === "object" && typeof raw.toDate === "function") {
    return raw.toDate().toLocaleString("id-ID");
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? String(raw) : d.toLocaleString("id-ID");
}

function normalisasiLinkGambarInput(rawUrl) {
  const val = String(rawUrl ?? "").trim();
  if (!val || val.startsWith("data:image")) return "";
  const matchDrive = val.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || val.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchDrive && val.includes("drive.google.com")) {
    return `https://lh3.googleusercontent.com/d/${matchDrive[1]}`;
  }
  return /^https?:\/\//i.test(val) ? val : "";
}

function sanitizeGambarUrl(rawUrl) {
  return normalisasiLinkGambarInput(rawUrl);
}

function normalisasiArraySoal(rawSoal) {
  if (!rawSoal) return [];
  const items = Array.isArray(rawSoal)
    ? rawSoal.filter(Boolean)
    : (typeof rawSoal === "object" ? Object.entries(rawSoal).map(([k, v]) => ({ id: k, ...(v || {}) })) : []);

  const hasil = items.map((item, idx) => {
    const soalBersih = {
      id: String(item.id || `SOAL-${idx + 1}`),
      tipe: String(item.tipe || "pg"),
      pertanyaan: String(item.pertanyaan || ""),
      gambarUrl: sanitizeGambarUrl(item.gambarUrl),
      opsi: item.opsi && typeof item.opsi === "object" ? { ...item.opsi } : {},
      kunci: item.kunci !== undefined && item.kunci !== null ? item.kunci : ""
    };

    if (Array.isArray(item.pasangan)) {
      soalBersih.pasangan = item.pasangan;
    }

    return soalBersih;
  });

  return JSON.parse(JSON.stringify(hasil));
}

async function ambilSoalFirestore(kodeUjian = "ujian_1") {
  const cleanId = sanitizeFirestoreId(kodeUjian);
  const cacheKey = `cbt_soal_${cleanId}`;
  const cached = readSessionCache(cacheKey);
  if (Array.isArray(cached)) return cached;

  const snap = await getDoc(doc(firestoreDb, "soal", cleanId));
  if (!snap.exists()) return [];
  const data = snap.data() || {};
  const normalized = normalisasiArraySoal(data.daftarSoal || data.soal || []);
  writeSessionCache(cacheKey, normalized);
  return normalized;
}

async function simpanSoalFirestore(kodeUjian = "ujian_1", listSoal = [], metaTambahan = {}) {
  const cleanId = sanitizeFirestoreId(kodeUjian);
  const normalizedSoal = normalisasiArraySoal(listSoal);
  const cacheKey = `cbt_soal_${cleanId}`;

  const metaBersih = {};
  if (metaTambahan && typeof metaTambahan === "object") {
    Object.entries(metaTambahan).forEach(([k, v]) => {
      if (v !== undefined) metaBersih[k] = v;
    });
  }

  const payload = JSON.parse(
    JSON.stringify({
      ...metaBersih,
      kodeUjian: cleanId,
      status: metaBersih.status || "aktif",
      totalSoal: normalizedSoal.length,
      daftarSoal: normalizedSoal
    })
  );

  await Promise.all([
    setDoc(
      doc(firestoreDb, "soal", cleanId),
      {
        ...payload,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    ),
    updateDoc(doc(firestoreDb, "ujian", cleanId), {
      totalSoal: normalizedSoal.length,
      updatedAt: serverTimestamp()
    }).catch(() => {})
  ]);

  writeSessionCache(cacheKey, normalizedSoal);

  if (Array.isArray(window.daftarUjian)) {
    const ujianTarget = window.daftarUjian.find(item => item.id === cleanId || sanitizeFirestoreId(item.id) === cleanId);
    if (ujianTarget) ujianTarget.soal = normalizedSoal;
  }

  return normalizedSoal;
}

async function simpanJawabanFirestore(kodeUjian, nisn, jawabanObj = {}, meta = {}) {
  const cleanUjian = sanitizeFirestoreId(kodeUjian || "ujian_1");
  const cleanNisn = sanitizeFirestoreId(nisn);
  if (!cleanNisn) throw new Error("NISN siswa tidak valid.");

  const docId = `${cleanNisn}_${cleanUjian}`;
  await setDoc(
    doc(firestoreDb, "jawaban_siswa", docId),
    {
      ujianId: cleanUjian,
      kodeUjian: cleanUjian,
      nisn: String(nisn),
      answers: jawabanObj,
      updatedAt: serverTimestamp(),
      ...meta
    },
    { merge: true }
  );
}

async function ambilSemuaJawabanFirestore(kodeUjian = "") {
  const colRef = collection(firestoreDb, "jawaban_siswa");
  const rows = [];

  if (kodeUjian) {
    const q1 = query(colRef, where("ujianId", "==", kodeUjian));
    const q2 = query(colRef, where("kodeUjian", "==", kodeUjian));
    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const mapDocs = new Map();

    snap1.forEach((docSnap) => mapDocs.set(docSnap.id, { id: docSnap.id, ...(docSnap.data() || {}) }));
    snap2.forEach((docSnap) => mapDocs.set(docSnap.id, { id: docSnap.id, ...(docSnap.data() || {}) }));
    mapDocs.forEach((val) => rows.push(val));
    return rows;
  }

  const snap = await getDocs(colRef);
  snap.forEach((docSnap) => {
    const val = docSnap.data() || {};
    rows.push({ id: docSnap.id, ...val });
  });
  return rows;
}

window.imporBackupJsonKeFirestore = async function () {
  const pesan = "Migrasi ke Firestore sudah selesai dan file backup sudah dihapus.";
  console.info(pesan);
  alert(pesan);
  return { skipped: true };
};

function normalisasiDetailAmpuan(guruObj) {
  const detail = {};
  if (!guruObj) return detail;

  if (guruObj.detailAmpuan && typeof guruObj.detailAmpuan === "object") {
    Object.entries(guruObj.detailAmpuan).forEach(([m, kArr]) => {
      const cleanMapel = String(m || "").trim();
      if (!cleanMapel) return;
      detail[cleanMapel] = Array.isArray(kArr)
        ? kArr.map(k => String(k).trim()).filter(Boolean)
        : [];
    });
    return detail;
  }

  const mapelArr = Array.isArray(guruObj.mapelDiampu) && guruObj.mapelDiampu.length > 0
    ? guruObj.mapelDiampu
    : (guruObj.mapel ? [guruObj.mapel] : []);

  const kelasArr = Array.isArray(guruObj.kelasDiampu)
    ? guruObj.kelasDiampu
    : (typeof guruObj.kelasDiampu === "string" && guruObj.kelasDiampu.trim()
        ? guruObj.kelasDiampu.split(",").map(k => k.trim()).filter(Boolean)
        : []);

  mapelArr.forEach(m => {
    const cleanMapel = String(m || "").trim();
    if (cleanMapel) detail[cleanMapel] = [...kelasArr];
  });

  return detail;
}

function apakahUjianSesuaiHakGuru(u, session) {
  if (!session || isUserAdmin(session)) return true;

  const detail = normalisasiDetailAmpuan(session);
  const mapelKeys = Object.keys(detail);

  let mapelGuruArray = [];
  if (mapelKeys.length > 0) {
    mapelGuruArray = mapelKeys.map(m => m.toLowerCase().trim());
  } else if (Array.isArray(session.mapelDiampu) && session.mapelDiampu.length > 0) {
    mapelGuruArray = session.mapelDiampu.map(m => m.toLowerCase().trim());
  } else if (session.mapel) {
    mapelGuruArray = [session.mapel.toLowerCase().trim()];
  }

  const kelasDiampuArray = getKelasDiampuGuru(session);

  const mapelUjian = (u.mapel || "").toLowerCase().trim();
  const targetKelas = Array.isArray(u.kelasTarget)
    ? u.kelasTarget.map(k => String(k).trim())
    : (u.kelasTarget ? [String(u.kelasTarget).trim()] : []);

  const cocokMapel = mapelGuruArray.length > 0 && mapelGuruArray.includes(mapelUjian);
  if (!cocokMapel) return false;

  if (mapelKeys.length > 0) {
    const matchedMapelKey = mapelKeys.find(mk => mk.toLowerCase().trim() === mapelUjian);
    const kelasUntukMapel = matchedMapelKey ? detail[matchedMapelKey] : [];
    if (kelasUntukMapel && kelasUntukMapel.length > 0) {
      return targetKelas.includes("Semua") || targetKelas.some(k => kelasUntukMapel.includes(k));
    }
  }

  if (kelasDiampuArray.length > 0) {
    return targetKelas.includes("Semua") || targetKelas.some(k => kelasDiampuArray.includes(k));
  }

  return false;
}

function ekstrakMappingDariContainer(containerEl) {
  const detailAmpuan = {};
  const mapelDiampu = [];
  const kelasSet = new Set();

  if (!containerEl) return { mapelDiampu, kelasDiampu: [], detailAmpuan };

  containerEl.querySelectorAll("input.mapel-toggle:checked").forEach(cbMapel => {
    const mapel = cbMapel.value.trim();
    if (!mapel) return;
    const boxId = cbMapel.getAttribute("data-box");
    const boxEl = boxId ? document.getElementById(boxId) : null;
    const kelasDipilih = boxEl
      ? Array.from(boxEl.querySelectorAll("input.kelas-item:checked")).map(k => k.value.trim()).filter(Boolean)
      : [];

    mapelDiampu.push(mapel);
    detailAmpuan[mapel] = kelasDipilih;
    kelasDipilih.forEach(k => kelasSet.add(k));
  });

  return {
    mapelDiampu,
    kelasDiampu: Array.from(kelasSet),
    detailAmpuan
  };
}

function renderMappingMapelKelas(containerEl, mapelList, kelasList, existingDetail = {}) {
  if (!containerEl) return;
  containerEl.innerHTML = "";

  if (!mapelList || mapelList.length === 0) {
    containerEl.innerHTML = `<small class="text-danger">Belum ada mata pelajaran terdaftar.</small>`;
    return;
  }

  mapelList.forEach((mItem, idx) => {
    const mapelNama = typeof mItem === "string" ? mItem.trim() : String(mItem.nama || "").trim();
    if (!mapelNama) return;

    const isMapelChecked = Object.prototype.hasOwnProperty.call(existingDetail, mapelNama);
    const kelasDipilih = isMapelChecked && Array.isArray(existingDetail[mapelNama])
      ? existingDetail[mapelNama]
      : [];

    const mapelCbId = `cb_mapel_${containerEl.id}_${idx}`;
    const boxId = `box_kelas_${containerEl.id}_${idx}`;

    const card = document.createElement("div");
    card.className = "border rounded bg-white p-2 mb-2";

    const kelasHtml = (kelasList && kelasList.length > 0)
      ? kelasList.map((kItem, kIdx) => {
          const namaKelas = typeof kItem === "string" ? kItem.trim() : String(kItem.nama || "").trim();
          if (!namaKelas) return "";
          const kId = `cb_kelas_${containerEl.id}_${idx}_${kIdx}`;
          const checked = kelasDipilih.includes(namaKelas) ? "checked" : "";
          return `
            <div class="form-check form-check-inline mb-1">
              <input class="form-check-input kelas-item" type="checkbox" id="${kId}" value="${escapeHtml(namaKelas)}" ${checked}>
              <label class="form-check-label small" for="${kId}">${escapeHtml(namaKelas)}</label>
            </div>
          `;
        }).join("")
      : `<small class="text-muted">Belum ada data kelas terdaftar.</small>`;

    card.innerHTML = `
      <div class="form-check">
        <input class="form-check-input mapel-toggle" type="checkbox" id="${mapelCbId}" data-box="${boxId}" value="${escapeHtml(mapelNama)}" ${isMapelChecked ? "checked" : ""}>
        <label class="form-check-label fw-bold" for="${mapelCbId}">${escapeHtml(mapelNama)}</label>
      </div>
      <div id="${boxId}" class="mt-2 ps-4 pt-2 border-top ${isMapelChecked ? "" : "d-none"}">
        <div class="small text-muted mb-1">Target kelas untuk <strong>${escapeHtml(mapelNama)}</strong>:</div>
        ${kelasHtml}
      </div>
    `;

    const mapelCb = card.querySelector(`#${mapelCbId}`);
    const boxEl = card.querySelector(`#${boxId}`);

    mapelCb?.addEventListener("change", () => {
      if (!boxEl) return;
      if (mapelCb.checked) {
        boxEl.classList.remove("d-none");
      } else {
        boxEl.classList.add("d-none");
        boxEl.querySelectorAll("input.kelas-item").forEach(cb => { cb.checked = false; });
      }
    });

    containerEl.appendChild(card);
  });
}

function getCacheKeyRekapUjian(kodeUjian) {
  return `cbt_rekap_ujian_${sanitizeFirestoreId(kodeUjian)}`;
}

function terapkanFilterHasilUjian(rawList) {
  const session = window.userSession || (typeof userSession !== "undefined" ? userSession : {});
  const ujianSelected = String(document.getElementById("selectFilterUjian")?.value || "").trim();

  if (!ujianSelected) {
    hasilUjian = [];
    window.hasilUjian = [];
    rekapTerpilihIds.clear();
    if (typeof window.filterRekapNilai === "function") window.filterRekapNilai();
    if (typeof window.updateFilterUjianDropdown === "function") window.updateFilterUjianDropdown();
    return;
  }

  let listTersaring = Array.isArray(rawList) ? rawList : [];

  if (session && !isUserAdmin(session)) {
    const sumberUjian = Array.isArray(window.daftarUjian) ? window.daftarUjian : [];
    const ujianObj = sumberUjian.find(
      u => u.id === ujianSelected || sanitizeFirestoreId(u.id) === sanitizeFirestoreId(ujianSelected)
    );

    if (!ujianObj || !apakahUjianSesuaiHakGuru(ujianObj, session)) {
      hasilUjian = [];
      window.hasilUjian = [];
      rekapTerpilihIds.clear();
      if (typeof window.filterRekapNilai === "function") window.filterRekapNilai();
      if (typeof window.updateFilterUjianDropdown === "function") window.updateFilterUjianDropdown();
      return;
    }

    const detail = normalisasiDetailAmpuan(session);
    const mapelKeys = Object.keys(detail);
    const mapelGuruArray = mapelKeys.length > 0
      ? mapelKeys.map(m => m.toLowerCase().trim())
      : (Array.isArray(session.mapelDiampu) && session.mapelDiampu.length > 0
          ? session.mapelDiampu.map(m => m.toLowerCase().trim())
          : (session.mapel ? [session.mapel.toLowerCase().trim()] : []));

    const kelasDiampu = getKelasDiampuGuru(session);

    listTersaring = listTersaring.filter(h => {
      const mapelHasil = (h.mapel || ujianObj.mapel || "").toLowerCase().trim();
      const kelasSiswa = (h.kelas || "").trim();
      const kelasSiswaLower = kelasSiswa.toLowerCase();

      const cocokMapel = mapelGuruArray.length > 0 && mapelGuruArray.includes(mapelHasil);
      if (!cocokMapel) return false;

      if (mapelKeys.length > 0) {
        const matchedMapelKey = mapelKeys.find(mk => mk.toLowerCase().trim() === mapelHasil);
        const kelasUntukMapel = matchedMapelKey ? detail[matchedMapelKey] : [];
        if (kelasUntukMapel && kelasUntukMapel.length > 0) {
          return kelasUntukMapel.includes(kelasSiswa) || kelasUntukMapel.some(k => k.toLowerCase() === kelasSiswaLower);
        }
      }

      return kelasDiampu.length > 0 && kelasDiampu.some(k => k.toLowerCase().trim() === kelasSiswaLower);
    });
  }

  hasilUjian = listTersaring;
  window.hasilUjian = hasilUjian;

  const activeIdSet = new Set(hasilUjian.map(item => item.id));
  Array.from(rekapTerpilihIds).forEach((id) => {
    if (!activeIdSet.has(id)) rekapTerpilihIds.delete(id);
  });

  if (typeof window.filterRekapNilai === "function") window.filterRekapNilai();
  if (typeof window.updateFilterUjianDropdown === "function") window.updateFilterUjianDropdown();
}

async function muatHasilUjianSekali(kodeUjianFilter = "", forceReload = false) {
  const targetUjian = String(kodeUjianFilter || document.getElementById("selectFilterUjian")?.value || "").trim();
  const session = window.userSession || (typeof userSession !== "undefined" ? userSession : {});

  if (!targetUjian) {
    hasilUjian = [];
    window.hasilUjian = [];
    lastLoadedRekapUjianId = null;
    rekapTerpilihIds.clear();
    if (typeof window.filterRekapNilai === "function") window.filterRekapNilai();
    return [];
  }

  if (session && !isUserAdmin(session)) {
    const sumberUjian = Array.isArray(window.daftarUjian) ? window.daftarUjian : [];
    const ujianObj = sumberUjian.find(
      u => u.id === targetUjian || sanitizeFirestoreId(u.id) === sanitizeFirestoreId(targetUjian)
    );
    if (!ujianObj || !apakahUjianSesuaiHakGuru(ujianObj, session)) {
      hasilUjian = [];
      window.hasilUjian = [];
      lastLoadedRekapUjianId = null;
      rekapTerpilihIds.clear();
      if (typeof window.filterRekapNilai === "function") window.filterRekapNilai();
      return [];
    }
  }

  const cacheKey = getCacheKeyRekapUjian(targetUjian);
  if (!forceReload) {
    const cached = readSessionCache(cacheKey);
    if (Array.isArray(cached)) {
      lastLoadedRekapUjianId = targetUjian;
      terapkanFilterHasilUjian(cached);
      return hasilUjian;
    }
  }

  if (!forceReload && lastLoadedRekapUjianId === targetUjian && hasilUjian.length > 0) {
    terapkanFilterHasilUjian(hasilUjian);
    return hasilUjian;
  }

  try {
    const rowsFs = await ambilSemuaJawabanFirestore(targetUjian);
    const rawHasilFs = rowsFs.map((item) => ({
      ...item,
      id: item.id,
      ujianId: item.ujianId || item.kodeUjian || "",
      waktuSelesai: item.waktuSelesai || formatWaktuRekap(item.updatedAt)
    }));
    writeSessionCache(cacheKey, rawHasilFs);
    lastLoadedRekapUjianId = targetUjian;
    terapkanFilterHasilUjian(rawHasilFs);
    return hasilUjian;
  } catch (err) {
    console.error("Gagal memuat rekap nilai Firestore:", err);
    return [];
  }
}

/* ===================================================
   PEMUATAN DATA MASTER DARI CLOUD FIRESTORE (HEMAT READS)
   =================================================== */
async function muatKelasFirestore(forceReload = false) {
  if (!forceReload) {
    const cached = readSessionCache("cbt_master_kelas");
    if (Array.isArray(cached)) {
      daftarKelas = cached;
      window.daftarKelas = daftarKelas;
      renderListKelasModal();
      updateAllClassDropdowns();
      return;
    }
  }

  const snap = await getDocs(collection(firestoreDb, "kelas"));
  daftarKelas = snap.docs
    .map(d => ({ id: d.id, ...(d.data() || {}) }))
    .filter(k => k.nama)
    .sort((a, b) => String(a.nama).localeCompare(String(b.nama)));
  window.daftarKelas = daftarKelas;
  writeSessionCache("cbt_master_kelas", daftarKelas);
  renderListKelasModal();
  updateAllClassDropdowns();
}

async function muatUjianFirestore(forceReload = false) {
  const session = window.userSession || userSession || {};
  const guruKey = sanitizeFirestoreId(session.uid || session.email || session.id || "default");
  const isAdmin = isUserAdmin(session);
  const cacheKey = isAdmin ? "cbt_master_ujian_all" : `cbt_master_ujian_${guruKey}`;

  let rawList = null;
  if (!forceReload) {
    rawList = readSessionCache(cacheKey);
  }

  if (!Array.isArray(rawList)) {
    const ujianRef = collection(firestoreDb, "ujian");

    if (isAdmin) {
      const snap = await getDocs(ujianRef);
      rawList = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
    } else {
      const detail = normalisasiDetailAmpuan(session);
      const mapelKeys = Object.keys(detail).map(m => m.trim()).filter(Boolean);
      const fallbackMapel = Array.isArray(session.mapelDiampu) && session.mapelDiampu.length > 0
        ? session.mapelDiampu.map(m => String(m).trim()).filter(Boolean)
        : (session.mapel ? [String(session.mapel).trim()] : []);

      const mapelFilterList = Array.from(new Set(mapelKeys.length > 0 ? mapelKeys : fallbackMapel));

      if (mapelFilterList.length === 0) {
        rawList = [];
      } else {
        const docMap = new Map();
        for (let i = 0; i < mapelFilterList.length; i += 10) {
          const chunkMapel = mapelFilterList.slice(i, i + 10);
          const qUjian = query(ujianRef, where("mapel", "in", chunkMapel));
          const snap = await getDocs(qUjian);
          snap.forEach(d => docMap.set(d.id, { id: d.id, ...(d.data() || {}) }));
        }
        rawList = Array.from(docMap.values());
      }
    }

    writeSessionCache(cacheKey, rawList);
  }

  daftarUjian = rawList.filter(u => apakahUjianSesuaiHakGuru(u, session));
  window.daftarUjian = daftarUjian;

  renderStats();
  window.filterDataUjian();
  window.updateFilterUjianDropdown();
  if (typeof window.loadDaftarUjianMonitoring === "function") {
    window.loadDaftarUjianMonitoring();
  }
}

async function muatPenggunaFirestore(forceReload = false) {
  const session = window.userSession || (typeof userSession !== "undefined" ? userSession : {}) || {};
  const isAdmin = typeof isUserAdmin === "function"
    ? isUserAdmin(session)
    : ["admin", "superadmin", "kepsek"].includes(String(session.role || "").toLowerCase().trim());

  if (!isAdmin) {
    daftarPengguna = [];
    window.daftarPengguna = [];
    return [];
  }

  const cacheKey = "cbt_master_guru";
  if (!forceReload) {
    const cached = readSessionCache(cacheKey);
    if (Array.isArray(cached)) {
      daftarPengguna = cached;
      window.daftarPengguna = daftarPengguna;
      if (typeof window.filterDataGuru === "function") window.filterDataGuru();
      if (typeof updateGuruDropdown === "function") updateGuruDropdown();
      return daftarPengguna;
    }
  }

  const qGuru = query(collection(firestoreDb, "pengguna"), where("role", "==", "guru"));
  const snap = await getDocs(qGuru);
  daftarPengguna = snap.docs.map(d => ({ uid: d.id, ...(d.data() || {}) })).filter(Boolean);
  window.daftarPengguna = daftarPengguna;
  writeSessionCache(cacheKey, daftarPengguna);
  if (typeof window.filterDataGuru === "function") window.filterDataGuru();
  if (typeof updateGuruDropdown === "function") updateGuruDropdown();
  return daftarPengguna;
}

async function muatMapelFirestore(forceReload = false) {
  let mapelArray = null;
  if (!forceReload) {
    mapelArray = readSessionCache("cbt_master_mapel");
  }

  if (!Array.isArray(mapelArray)) {
    const snap = await getDocs(collection(firestoreDb, "mapel"));
    mapelArray = snap.docs
      .map(d => {
        const val = d.data() || {};
        return { id: d.id, nama: String(val.nama || "").trim() };
      })
      .filter(m => m.nama)
      .sort((a, b) => a.nama.localeCompare(b.nama));
    writeSessionCache("cbt_master_mapel", mapelArray);
  }

  window.daftarMapel = mapelArray;
  window.daftarMapelMaster = mapelArray;

  const listMapelAdmin = document.getElementById("listMapelAdmin");
  if (listMapelAdmin) {
    listMapelAdmin.innerHTML = "";
    if (mapelArray.length === 0) {
      listMapelAdmin.innerHTML = `<li class="list-group-item text-muted text-center">Belum ada mata pelajaran.</li>`;
    } else {
      mapelArray.forEach(m => {
        const li = document.createElement("li");
        li.className = "list-group-item d-flex justify-content-between align-items-center";
        li.innerHTML = `
          <span>${escapeHtml(m.nama)}</span>
          <button class="btn btn-sm btn-danger" onclick="hapusMapel('${escapeHtml(m.id)}')">
            <i class="bi bi-trash"></i> Hapus
          </button>
        `;
        listMapelAdmin.appendChild(li);
      });
    }
  }

  const containerMappingTambah = document.getElementById("containerMappingMapelKelasTambah");
  if (containerMappingTambah && typeof renderMappingMapelKelas === "function") {
    renderMappingMapelKelas(
      containerMappingTambah,
      mapelArray,
      window.daftarKelas || (typeof daftarKelas !== "undefined" ? daftarKelas : []),
      {}
    );
  }

  if (typeof window.updateFilterMapelDropdown === "function") {
    window.updateFilterMapelDropdown();
  }

  return mapelArray;
}

async function muatSemuaMasterFirestore(forceReload = false) {
  await Promise.all([
    muatKelasFirestore(forceReload),
    muatMapelFirestore(forceReload),
    muatPenggunaFirestore(forceReload),
    muatUjianFirestore(forceReload)
  ]);

  // Tidak menarik seluruh data siswa saat load awal agar hemat reads;
  // data siswa hanya ditarik ketika admin/guru memilih spesifik satu kelas.
  daftarSiswa = [];
  window.daftarSiswa = [];
  renderStats();
  if (typeof window.filterDataSiswa === "function") {
    window.filterDataSiswa();
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!userSession) return;

  renderUserInfoNav();
  await window.muatModeUjianAktif(false);

  await muatSemuaMasterFirestore(false).catch((err) => {
    console.error("Gagal memuat master data Firestore:", err);
  });

  document.getElementById("searchUjian")?.addEventListener("input", () => window.filterDataUjian());
  document.getElementById("filterStatusUjian")?.addEventListener("change", () => window.filterDataUjian());
  document.getElementById("searchGuru")?.addEventListener("input", () => window.filterDataGuru());

  document.getElementById("filterKelasSiswa")?.addEventListener("change", () => window.filterDataSiswa());
  document.getElementById("searchSiswa")?.addEventListener("input", () => window.filterDataSiswa());

  document.getElementById("tabNilai")?.addEventListener("click", () => {
    const ujianTerpilih = document.getElementById("selectFilterUjian")?.value || "";
    muatHasilUjianSekali(ujianTerpilih, false);
  });

  document.getElementById("tabMonitoring")?.addEventListener("click", () => {
    window.loadDaftarUjianMonitoring();
    if (document.getElementById("selectUjianMonitoring")?.value) {
      window.loadDataMonitoring();
    }
  });

  const inputUrlGambar = document.getElementById("soalGambarUrl");
  inputUrlGambar?.addEventListener("input", () => {
    const cleanUrl = normalisasiLinkGambarInput(inputUrlGambar.value);
    const previewContainer = document.getElementById("previewGambarContainer");
    const previewImg = document.getElementById("previewGambar");

    if (!cleanUrl) {
      previewContainer?.classList.add("d-none");
      if (previewImg) previewImg.src = "";
      return;
    }

    if (previewImg && previewContainer) {
      previewImg.onerror = () => previewContainer.classList.add("d-none");
      previewImg.onload = () => previewContainer.classList.remove("d-none");
      previewImg.src = cleanUrl;
    }
  });

  document.getElementById("formTambahMapel")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const inputMapel = document.getElementById("inputNamaMapel");
    const namaMapel = inputMapel?.value.trim();
    if (!namaMapel) return;

    try {
      const cleanId = sanitizeFirestoreId(namaMapel);
      await setDoc(doc(firestoreDb, "mapel", cleanId), {
        nama: namaMapel,
        updatedAt: serverTimestamp()
      }, { merge: true });
      inputMapel.value = "";
      await muatMapelFirestore(true);
      alert("Mata pelajaran berhasil ditambahkan!");
    } catch (err) {
      console.error("Gagal menambah mapel:", err);
      alert("Terjadi kesalahan saat menyimpan mapel.");
    }
  });

  document.getElementById("formUjian")?.addEventListener("submit", handleSimpanUjian);
  document.getElementById("formEditUjian")?.addEventListener("submit", window.simpanPerubahanUjian);
  document.getElementById("formSiswa")?.addEventListener("submit", handleSimpanSiswa);
  document.getElementById("formTambahGuru")?.addEventListener("submit", handleTambahGuru);
  document.getElementById("formEditGuru")?.addEventListener("submit", handleSimpanEditGuru);
  document.getElementById("formTambahKelas")?.addEventListener("submit", window.handleSimpanKelas);
  document.getElementById("fileExcelSiswa")?.addEventListener("change", importSiswaExcel);
  document.getElementById("fileExcelSoal")?.addEventListener("change", importExcelSoal);

  document.getElementById("selectFilterKelas")?.addEventListener("change", () => window.filterRekapNilai());
  document.getElementById("selectFilterUjian")?.addEventListener("change", async (e) => {
    const ujianId = e.target.value || "";
    if (ujianId) {
      await muatHasilUjianSekali(ujianId, false);
    } else {
      window.filterRekapNilai();
    }
  });
  document.getElementById("checkSemuaRekap")?.addEventListener("change", (e) => window.togglePilihSemuaRekap(e.target.checked));
  document.getElementById("btnHapusTerpilihRekap")?.addEventListener("click", () => window.hapusRekapTerpilih());

  document.getElementById("soalTipe")?.addEventListener("change", (e) => {
    window.switchTipeSoal(e.target.value);
  });

  document.getElementById("btnExportRekap")?.addEventListener("click", async () => {
    const kelas = document.getElementById("selectFilterKelas")?.value || "";
    const ujianId = document.getElementById("selectFilterUjian")?.value || "";
    await muatHasilUjianSekali(ujianId, true);
    window.downloadRekapNilaiPerKelas(kelas, ujianId);
  });

  if (userSession.role === "guru") {
    document.querySelectorAll("button, a").forEach(el => {
      const text = el.textContent.trim();
      if (text.includes("Tambah Guru") || text.includes("Kelola Kelas") || text.includes("Kelola Mata Pelajaran") || text.includes("Kelola Akun Guru")) {
        const container = el.closest(".btn, button, a, li");
        if (container) container.style.display = "none";
      }
    });

    const btnCetak = document.querySelector('button[onclick*="cetakKartuUjianSiswa"]');
    if (btnCetak) btnCetak.style.display = "none";

    const btnTemplate = document.querySelector('button[onclick*="downloadTemplateSiswa"]');
    if (btnTemplate) btnTemplate.style.display = "none";

    const labelImport = document.querySelector('label[for="fileExcelSiswa"]') || document.getElementById("fileExcelSiswa")?.closest("label");
    if (labelImport) labelImport.style.display = "none";

    const btnTambahSiswa = document.querySelector('button[onclick*="openModalTambahSiswa"]');
    if (btnTambahSiswa) btnTambahSiswa.style.display = "none";
  }

  sinkronkanTombolRekapTerpilih();
});

window.hapusMapel = async (idMapel) => {
  if (!confirm("Yakin ingin menghapus mata pelajaran ini?")) return;
  try {
    await deleteDoc(doc(firestoreDb, "mapel", sanitizeFirestoreId(idMapel)));
    await muatMapelFirestore(true);
    alert("Mata pelajaran berhasil dihapus!");
  } catch (err) {
    console.error("Gagal menghapus mapel:", err);
    alert("Gagal menghapus mata pelajaran.");
  }
};

function renderUserInfoNav() {
  const userDisplayName = document.getElementById("userDisplayName");
  if (userDisplayName && userSession) {
    const listMapel = Array.isArray(userSession.mapelDiampu) ? userSession.mapelDiampu.join(", ") : (userSession.mapel || "");
    const labelRole = isUserAdmin(userSession) ? "ADMIN" : `Guru ${listMapel}`;
    userDisplayName.innerHTML = `<i class="bi bi-person-circle me-1"></i> ${escapeHtml(userSession.nama || userSession.email)} (${escapeHtml(labelRole)})`;
  }
}

window.logout = () => {
  if (typeof unsubMonitoring === "function") {
    unsubMonitoring();
    unsubMonitoring = null;
  }
  nisnTerpilihMonitoring.clear();
  rekapTerpilihIds.clear();
  dataMonitoringPeserta = [];

  const bersihkanSession = () => {
    clearMasterCache();
    sessionStorage.removeItem("userLoggedIn");
    localStorage.removeItem("cbt_current_user");
    localStorage.removeItem("userSession");
    window.location.href = "login.html";
  };

  signOut(auth).then(bersihkanSession).catch(bersihkanSession);
};

async function simpanSoalUjianAktif(ujianId, listSoal) {
  const normalized = normalisasiArraySoal(listSoal);
  await simpanSoalFirestore(ujianId, normalized);
  const idx = daftarUjian.findIndex(u => u.id === ujianId);
  if (idx >= 0) {
    daftarUjian[idx].soal = normalized;
    daftarUjian[idx].totalSoal = normalized.length;
  }
  const session = window.userSession || userSession || {};
  const guruKey = sanitizeFirestoreId(session.uid || session.email || session.id || "default");
  const cacheKey = isUserAdmin(session) ? "cbt_master_ujian_all" : `cbt_master_ujian_${guruKey}`;
  writeSessionCache(cacheKey, daftarUjian);
  window.filterDataUjian();
}

window.muatSoalDenganSakelar = async function(kodeUjian = "ujian_1", fallbackSoal = []) {
  const soalFs = await ambilSoalFirestore(kodeUjian);
  if (soalFs.length > 0) return soalFs;
  return normalisasiArraySoal(fallbackSoal);
};

window.simpanJawabanDenganSakelar = async function(kodeUjian, nisn, jawabanMap = {}, meta = {}) {
  await simpanJawabanFirestore(kodeUjian, nisn, jawabanMap, meta);
};

function renderStats() {
  const statSiswa = document.getElementById("statTotalSiswa");
  const statUjian = document.getElementById("statTotalUjian");
  if (statSiswa) {
    const kelasAktif = document.getElementById("filterKelasSiswa")?.value.trim() || "";
    statSiswa.innerText = kelasAktif ? String(daftarSiswa.length) : "0";
  }
  if (statUjian) statUjian.innerText = daftarUjian.length;
}

window.openModalKelolaKelas = () => {
  const modalEl = document.getElementById("modalKelolaKelas");
  if (modalEl && window.bootstrap) bootstrap.Modal.getOrCreateInstance(modalEl).show();
};

window.handleSimpanKelas = async function(event) {
  if (event) event.preventDefault();

  const inputNama = document.getElementById("inputNamaKelas");
  const namaKelas = inputNama ? inputNama.value.trim() : "";

  if (!namaKelas) {
    alert("Nama kelas tidak boleh kosong!");
    return;
  }

  try {
    const cleanKey = sanitizeFirestoreId(namaKelas);
    await setDoc(doc(firestoreDb, "kelas", cleanKey), {
      nama: namaKelas,
      dibuatPada: new Date().toISOString(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    if (inputNama) inputNama.value = "";
    await muatKelasFirestore(true);
    alert("Kelas berhasil ditambahkan!");
  } catch (error) {
    console.error("Gagal menyimpan kelas:", error);
    alert("Gagal menyimpan kelas: " + error.message);
  }
};

window.hapusKelas = async (namaKelas) => {
  if (!confirm(`Hapus kelas ${namaKelas}?`)) return;
  try {
    const cleanKey = sanitizeFirestoreId(namaKelas);
    await deleteDoc(doc(firestoreDb, "kelas", cleanKey));
    await muatKelasFirestore(true);
  } catch (err) {
    alert("Gagal menghapus kelas: " + err.message);
  }
};

function renderListKelasModal() {
  const listEl = document.getElementById("listDaftarKelas");
  if (!listEl) return;
  listEl.innerHTML = "";

  if (daftarKelas.length === 0) {
    listEl.innerHTML = `<li class="list-group-item text-center text-muted small">Belum ada kelas terdaftar.</li>`;
    return;
  }

  daftarKelas.forEach(k => {
    const li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between align-items-center py-2";
    li.innerHTML = `
      <span class="fw-semibold">${escapeHtml(k.nama)}</span>
      <button class="btn btn-sm btn-outline-danger" onclick="hapusKelas('${escapeHtml(k.nama)}')">
        <i class="bi bi-trash"></i>
      </button>
    `;
    listEl.appendChild(li);
  });
}

function updateAllClassDropdowns() {
  const session = window.userSession || userSession || {};
  const isGuru = session && session.role === "guru";
  const kelasDiampuGuru = getKelasDiampuGuru(session);

  let kelasTampil = daftarKelas;
  if (isGuru) {
    const allowedSet = new Set(kelasDiampuGuru.map(k => k.toLowerCase()));
    const dariMaster = daftarKelas.filter(k => allowedSet.has(String(k.nama || "").trim().toLowerCase()));
    kelasTampil = dariMaster.length > 0
      ? dariMaster
      : kelasDiampuGuru.map((nama, idx) => ({ id: `ampu_${idx}`, nama }));
  }

  const filterSiswa = document.getElementById("filterKelasSiswa");
  if (filterSiswa) {
    const currVal = filterSiswa.value;
    filterSiswa.innerHTML = isGuru
      ? '<option value="">-- Pilih Kelas Ampuan --</option>'
      : '<option value="">-- Pilih Kelas --</option>';

    kelasTampil.forEach(k => {
      const opt = document.createElement("option");
      opt.value = k.nama;
      opt.textContent = k.nama;
      filterSiswa.appendChild(opt);
    });

    const masihValid = Array.from(filterSiswa.options).some(o => o.value === currVal);
    filterSiswa.value = masihValid ? currVal : "";
  }

  const filterNilai = document.getElementById("selectFilterKelas");
  if (filterNilai) {
    const currVal = filterNilai.value;
    filterNilai.innerHTML = isGuru ? '<option value="">-- Pilih Kelas Ampuan --</option>' : '<option value="">-- Semua Kelas --</option>';

    kelasTampil.forEach(k => {
      const opt = document.createElement("option");
      opt.value = k.nama;
      opt.textContent = k.nama;
      filterNilai.appendChild(opt);
    });
    filterNilai.value = currVal;
  }

  const containerCheck = document.getElementById("containerCheckboxKelas");
  if (containerCheck) {
    containerCheck.innerHTML = "";
    kelasTampil.forEach((k, idx) => {
      const idEl = `checkKelas_${idx}`;
      const div = document.createElement("div");
      div.className = "form-check mb-1";
      div.innerHTML = `
        <input class="form-check-input check-kelas-item" type="checkbox" value="${escapeHtml(k.nama)}" id="${idEl}">
        <label class="form-check-label" for="${idEl}">${escapeHtml(k.nama)}</label>
      `;
      containerCheck.appendChild(div);
    });
  }

  const selectSiswa = document.getElementById("siswaKelas");
  if (selectSiswa) {
    const currVal = selectSiswa.value;
    selectSiswa.innerHTML = '<option value="">-- Pilih Kelas --</option>';
    kelasTampil.forEach(k => {
      const opt = document.createElement("option");
      opt.value = k.nama;
      opt.textContent = k.nama;
      selectSiswa.appendChild(opt);
    });
    selectSiswa.value = currVal;
  }
}

/* ===================================================
   SELEKSI MASSAL UJIAN & RENDER TABEL UJIAN (#tbodyUjian)
   =================================================== */
window.selectedUjianIds = window.selectedUjianIds || new Set();

window.updateSeleksiUjian = function () {
  const checkboxes = Array.from(document.querySelectorAll("#tbodyUjian .check-item-ujian"));
  const checkedBoxes = checkboxes.filter((cb) => cb.checked);

  window.selectedUjianIds.clear();
  checkedBoxes.forEach((cb) => window.selectedUjianIds.add(String(cb.value)));

  const jumlah = window.selectedUjianIds.size;
  const badge = document.getElementById("infoUjianTerpilih");
  if (badge) badge.textContent = `${jumlah} Dipilih`;

  const btnNonaktif = document.getElementById("btnMassalNonaktifkanUjian");
  const btnAktif = document.getElementById("btnMassalAktifkanUjian");
  if (btnNonaktif) btnNonaktif.disabled = jumlah === 0;
  if (btnAktif) btnAktif.disabled = jumlah === 0;

  const checkAll = document.getElementById("checkSemuaUjian");
  if (checkAll) {
    if (checkboxes.length === 0) {
      checkAll.checked = false;
      checkAll.indeterminate = false;
    } else {
      checkAll.checked = checkedBoxes.length === checkboxes.length;
      checkAll.indeterminate = checkedBoxes.length > 0 && checkedBoxes.length < checkboxes.length;
    }
  }
};

window.togglePilihSemuaUjian = function (checked) {
  const checkboxes = document.querySelectorAll("#tbodyUjian .check-item-ujian");
  checkboxes.forEach((cb) => {
    cb.checked = Boolean(checked);
  });
  window.updateSeleksiUjian();
};

window.aksiMassalStatusUjian = async function (statusTarget) {
  const ids = Array.from(window.selectedUjianIds || []);
  if (ids.length === 0) return;

  const labelAksi = statusTarget === "nonaktif" ? "MENONAKTIFKAN" : "MENGAKTIFKAN";
  const yakin = confirm(`Yakin ingin ${labelAksi} ${ids.length} ujian terpilih sekaligus?`);
  if (!yakin) return;

  try {
    const CHUNK_SIZE = 200;
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(firestoreDb);
      chunk.forEach((id) => {
        const cleanId = sanitizeFirestoreId(id);
        batch.set(doc(firestoreDb, "ujian", cleanId), {
          status: statusTarget,
          updatedAt: serverTimestamp()
        }, { merge: true });
        batch.set(doc(firestoreDb, "soal", cleanId), {
          status: statusTarget,
          updatedAt: serverTimestamp()
        }, { merge: true });
      });
      await batch.commit();
    }

    const idSet = new Set(ids);
    if (Array.isArray(window.daftarUjian)) {
      window.daftarUjian.forEach((u) => {
        if (idSet.has(String(u.id))) {
          u.status = statusTarget;
        }
      });
    }

    const session = window.userSession || userSession || {};
    const guruKey = sanitizeFirestoreId(session.uid || session.email || session.id || "default");
    const cacheKey = isUserAdmin(session) ? "cbt_master_ujian_all" : `cbt_master_ujian_${guruKey}`;
    writeSessionCache(cacheKey, daftarUjian);

    window.selectedUjianIds.clear();
    window.filterDataUjian();
    if (typeof window.loadDaftarUjianMonitoring === "function") {
      window.loadDaftarUjianMonitoring();
    }
    window.updateSeleksiUjian();
    alert(`Berhasil memperbarui status ${ids.length} ujian menjadi "${statusTarget}".`);
  } catch (err) {
    console.error("Gagal update massal status ujian:", err);
    alert("Terjadi kesalahan saat memperbarui status ujian terpilih: " + err.message);
  }
};

window.filterDataUjian = () => {
  const dataSumber = Array.isArray(window.daftarUjian) ? window.daftarUjian : [];
  const keyword = (document.getElementById("searchUjian")?.value || "").toLowerCase().trim();
  const statusFilter = (document.getElementById("filterStatusUjian")?.value || "").toLowerCase().trim();

  const hasilFiltered = dataSumber.filter(u => {
    const mapel = (u.mapel || "").toLowerCase();
    const judul = (u.judul || "").toLowerCase();
    const token = (u.token || "").toLowerCase();
    const kelasText = (Array.isArray(u.kelasTarget) ? u.kelasTarget.join(" ") : (u.kelasTarget || "")).toLowerCase();
    const statusUjian = (u.status || "nonaktif").toLowerCase().trim();

    const matchStatus = statusFilter ? (statusUjian === statusFilter) : true;
    const matchSearch = keyword
      ? (mapel.includes(keyword) || judul.includes(keyword) || token.includes(keyword) || kelasText.includes(keyword))
      : true;

    return matchStatus && matchSearch;
  });

  window.renderTabelUjian(hasilFiltered);
};

window.renderTabelUjian = function(listUjian = window.daftarUjian) {
  const tbody = document.getElementById("tbodyUjian");
  const totalBadge = document.getElementById("totalUjianTampil");
  if (!tbody) return;

  const dataSumber = Array.isArray(listUjian) ? listUjian : [];
  if (totalBadge) totalBadge.innerText = `${dataSumber.length} Ujian`;

  tbody.innerHTML = "";

  if (dataSumber.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted py-3">Data ujian tidak ditemukan.</td></tr>`;
    window.updateSeleksiUjian();
    return;
  }

  dataSumber.forEach((u, i) => {
    const jmlSoal = typeof u.totalSoal === "number"
      ? u.totalSoal
      : (Array.isArray(u.soal) ? u.soal.length : 0);
    const isAktif = u.status === "aktif";
    const statusBadge = isAktif
      ? `<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Aktif</span>`
      : `<span class="badge bg-secondary"><i class="bi bi-x-circle me-1"></i>Nonaktif</span>`;

    const displayKelas = Array.isArray(u.kelasTarget) ? u.kelasTarget.join(", ") : (u.kelasTarget || "Semua");
    const safeId = escapeHtml(u.id);
    const safeStatus = escapeHtml(u.status || "nonaktif");
    const isChecked = window.selectedUjianIds && window.selectedUjianIds.has(String(u.id)) ? "checked" : "";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="text-center">
        <input type="checkbox" class="form-check-input check-item-ujian" value="${safeId}" ${isChecked} onchange="window.updateSeleksiUjian()">
      </td>
      <td>${i + 1}</td>
      <td><span class="badge bg-secondary">${escapeHtml(u.mapel || "-")}</span></td>
      <td><span class="badge bg-dark">${escapeHtml(displayKelas)}</span></td>
      <td class="fw-bold">${escapeHtml(u.judul || "-")}</td>
      <td>${Number(u.durasi) || 0} Mns</td>
      <td><span class="badge bg-info text-dark font-monospace">${escapeHtml(u.token || "-")}</span></td>
      <td>
        <div class="form-check form-switch cursor-pointer" title="Klik untuk mengubah status">
          <input class="form-check-input" type="checkbox" role="switch" id="switch-${safeId}" ${isAktif ? "checked" : ""} onchange="toggleStatusUjian('${safeId}', '${safeStatus}')">
          <label class="form-check-label" for="switch-${safeId}">${statusBadge}</label>
        </div>
      </td>
      <td><span class="badge bg-primary">${jmlSoal} Soal</span></td>
      <td>
        <div class="btn-group btn-group-sm" role="group">
          <button class="btn btn-outline-primary" onclick="openModalSoal('${safeId}')" title="Kelola Soal">
            <i class="bi bi-gear-fill"></i> Soal
          </button>
          <button class="btn btn-outline-warning" onclick="window.bukaModalEditUjian('${safeId}')" title="Edit Ujian">
            <i class="bi bi-pencil-square"></i>
          </button>
          <button class="btn btn-outline-success" onclick="downloadArsipSoalById('${safeId}')" title="Download Arsip Soal">
            <i class="bi bi-file-earmark-excel"></i>
          </button>
          <button class="btn btn-outline-danger" onclick="hapusUjian('${safeId}')" title="Hapus Ujian">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  window.updateSeleksiUjian();
};

async function handleSimpanUjian(e) {
  e.preventDefault();

  let pembuatInput = "";
  let usernamePembuat = "";
  let idGuruAktif = "";
  let mapelInput = "";

  if (window.userSession && window.userSession.role !== "admin") {
    pembuatInput = window.userSession.nama || window.userSession.username || "Guru";
    usernamePembuat = window.userSession.username || window.userSession.nama || "";
    idGuruAktif = window.userSession.uid || window.userSession.id || "";

    const selectMapelUjian = document.getElementById("ujianMapel");
    mapelInput = selectMapelUjian ? selectMapelUjian.value.trim() : (Array.isArray(window.userSession.mapelDiampu) ? window.userSession.mapelDiampu[0] : window.userSession.mapel);
  } else {
    const selectPembuat = document.getElementById("ujianPembuat");
    pembuatInput = selectPembuat ? selectPembuat.value : "Admin";
    usernamePembuat = pembuatInput;
    idGuruAktif = "admin_" + Date.now();
    const inputMapelEl = document.getElementById("ujianMapel");
    mapelInput = inputMapelEl ? inputMapelEl.value.trim() : "";
  }

  if (!pembuatInput) return alert("Identitas pembuat ujian tidak valid!");
  if (!mapelInput) return alert("Mata pelajaran tidak boleh kosong!");

  const judul = document.getElementById("ujianJudul").value.trim();
  const durasi = parseInt(document.getElementById("ujianDurasi").value, 10) || 60;
  const token = document.getElementById("ujianToken").value.trim().toUpperCase();
  const status = document.getElementById("ujianStatus").value;

  let selectedKelas = [];
  const checkSemua = document.getElementById("checkKelasSemua");
  if (checkSemua && checkSemua.checked) {
    selectedKelas = ["Semua"];
  } else {
    document.querySelectorAll(".check-kelas-item:checked").forEach(cb => {
      selectedKelas.push(cb.value);
    });
  }

  if (selectedKelas.length === 0) return alert("Pilih minimal satu target kelas!");

  const id = sanitizeFirestoreId("ujian_" + idGuruAktif + "_" + Date.now());

  const newUjian = {
    id,
    idGuru: idGuruAktif,
    mapel: mapelInput,
    kelasTarget: selectedKelas,
    judul,
    durasi,
    token,
    status,
    totalSoal: 0,
    createdBy: pembuatInput,
    pembuatUsername: usernamePembuat,
    createdAt: Date.now()
  };

  try {
    await Promise.all([
      setDoc(doc(firestoreDb, "ujian", id), { ...newUjian, updatedAt: serverTimestamp() }),
      simpanSoalFirestore(id, [], { mapel: mapelInput, judul, status })
    ]);

    alert("Ujian Berhasil Disimpan ke Cloud Firestore!");
    const modalEl = document.getElementById("modalUjian");
    if (modalEl && window.bootstrap) {
      bootstrap.Modal.getInstance(modalEl)?.hide();
    }
    document.getElementById("formUjian")?.reset();
    await muatUjianFirestore(true);
  } catch (err) {
    alert("Gagal menyimpan: " + err.message);
  }
}

window.toggleStatusUjian = async (id, currentStatus) => {
  const newStatus = (currentStatus === "aktif") ? "nonaktif" : "aktif";
  const cleanId = sanitizeFirestoreId(id);
  try {
    await Promise.all([
      updateDoc(doc(firestoreDb, "ujian", cleanId), { status: newStatus, updatedAt: serverTimestamp() }),
      setDoc(doc(firestoreDb, "soal", cleanId), { status: newStatus, updatedAt: serverTimestamp() }, { merge: true })
    ]);
    const idx = daftarUjian.findIndex(u => u.id === id);
    if (idx >= 0) daftarUjian[idx].status = newStatus;
    const session = window.userSession || userSession || {};
    const guruKey = sanitizeFirestoreId(session.uid || session.email || session.id || "default");
    const cacheKey = isUserAdmin(session) ? "cbt_master_ujian_all" : `cbt_master_ujian_${guruKey}`;
    writeSessionCache(cacheKey, daftarUjian);
    window.filterDataUjian();
    if (typeof window.loadDaftarUjianMonitoring === "function") {
      window.loadDaftarUjianMonitoring();
    }
  } catch (err) {
    alert("Gagal mengubah status ujian: " + err.message);
  }
};

window.handleTambahGuru = async (e) => {
  e.preventDefault();
  const nama = document.getElementById("guruNama").value.trim();
  const email = document.getElementById("guruEmail").value.trim();
  const password = document.getElementById("guruPassword").value;

  const containerMapping = document.getElementById("containerMappingMapelKelasTambah");
  const { mapelDiampu, kelasDiampu, detailAmpuan } = ekstrakMappingDariContainer(containerMapping);

  if (mapelDiampu.length === 0) {
    alert("Pilih minimal satu mata pelajaran yang diampu!");
    return;
  }

  try {
    const secondaryApp = getApps().find(appItem => appItem.name === "SecondaryApp")
      ? getApp("SecondaryApp")
      : initializeApp(firebaseConfig, "SecondaryApp");

    const secondaryAuth = getAuth(secondaryApp);

    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = cred.user.uid;

    const dataPengguna = {
      uid,
      nama,
      email,
      mapelDiampu,
      mapel: mapelDiampu[0],
      kelasDiampu,
      detailAmpuan,
      role: "guru",
      updatedAt: serverTimestamp()
    };
    await setDoc(doc(firestoreDb, "pengguna", sanitizeFirestoreId(uid)), dataPengguna, { merge: true });
    await secondaryAuth.signOut();

    alert(`Akun Guru ${nama} berhasil dibuat!`);
    document.getElementById("formTambahGuru").reset();
    const modalEl = document.getElementById("modalTambahGuru");
    if (modalEl && window.bootstrap) bootstrap.Modal.getInstance(modalEl)?.hide();
    await muatPenggunaFirestore(true);
  } catch (err) {
    console.error("Gagal buat guru:", err);
    alert("Gagal membuat akun guru: " + err.message);
  }
};

async function handleSimpanEditGuru(e) {
  e.preventDefault();
  const rawUid = (document.getElementById("editGuruUid")?.value || currentEditGuruUid || "").trim();
  const docId = sanitizeFirestoreId(rawUid);
  if (!rawUid || !docId || docId === "default") {
    alert("UID guru tidak ditemukan. Tutup modal lalu klik tombol Edit ulang.");
    return;
  }
  const uid = rawUid;
  const nama = document.getElementById("editGuruNama").value.trim();

  const containerMapping = document.getElementById("containerMappingMapelKelasEdit");
  const { mapelDiampu, kelasDiampu, detailAmpuan } = ekstrakMappingDariContainer(containerMapping);

  if (mapelDiampu.length === 0) {
    alert("Pilih minimal satu mata pelajaran!");
    return;
  }

  try {
    await updateDoc(doc(firestoreDb, "pengguna", sanitizeFirestoreId(uid)), {
      nama,
      mapelDiampu,
      mapel: mapelDiampu[0],
      kelasDiampu,
      detailAmpuan,
      updatedAt: serverTimestamp()
    });

    alert(`Profil Guru ${nama} berhasil diperbarui!`);
    const modalEl = document.getElementById("modalEditGuru");
    if (modalEl && window.bootstrap) bootstrap.Modal.getInstance(modalEl)?.hide();
    await muatPenggunaFirestore(true);
  } catch (err) {
    alert("Gagal memperbarui data guru: " + err.message);
  }
}

window.hapusGuru = async (uid, nama) => {
  if (!confirm(`Apakah Anda yakin ingin menghapus akun Guru "${nama}"?`)) return;
  try {
    await deleteDoc(doc(firestoreDb, "pengguna", sanitizeFirestoreId(uid)));
    await muatPenggunaFirestore(true);
    alert(`Akun Guru "${nama}" berhasil dihapus!`);
  } catch (err) {
    alert("Gagal menghapus: " + err.message);
  }
};

window.filterDataGuru = () => {
  const keyword = (document.getElementById("searchGuru")?.value || "").toLowerCase().trim();

  if (!keyword) {
    renderTabelPengguna(daftarPengguna);
    return;
  }

  const hasilFiltered = daftarPengguna.filter(p => {
    const nama = (p.nama || "").toLowerCase();
    const email = (p.email || "").toLowerCase();
    const role = (p.role || "").toLowerCase();
    const detail = normalisasiDetailAmpuan(p);
    const detailText = Object.entries(detail)
      .map(([m, kArr]) => `${m} ${(Array.isArray(kArr) ? kArr.join(" ") : "")}`)
      .join(" ")
      .toLowerCase();
    const mapelFallback = Array.isArray(p.mapelDiampu)
      ? p.mapelDiampu.join(" ").toLowerCase()
      : (p.mapel || "").toLowerCase();
    const kelasFallback = Array.isArray(p.kelasDiampu)
      ? p.kelasDiampu.join(" ").toLowerCase()
      : (p.kelasDiampu || "").toString().toLowerCase();

    return (
      nama.includes(keyword) ||
      email.includes(keyword) ||
      role.includes(keyword) ||
      detailText.includes(keyword) ||
      mapelFallback.includes(keyword) ||
      kelasFallback.includes(keyword)
    );
  });

  renderTabelPengguna(hasilFiltered);
};

window.renderTabelPengguna = function(listPengguna = daftarPengguna) {
  const tbody = document.getElementById("tbodyPengguna");
  const totalBadge = document.getElementById("totalGuruTampil");
  if (!tbody) return;

  const sumber = Array.isArray(listPengguna) ? listPengguna : daftarPengguna;
  if (totalBadge) {
    const jumlahGuru = sumber.filter(p => (p.role || "guru").toLowerCase() !== "admin").length;
    totalBadge.innerText = `${jumlahGuru} Guru`;
  }

  tbody.innerHTML = "";

  if (sumber.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">Data guru tidak ditemukan.</td></tr>`;
    return;
  }

  sumber.forEach((p, i) => {
    const isSelfAdmin = (p.role === "admin");
    const detail = normalisasiDetailAmpuan(p);
    const entries = Object.entries(detail);

    const ringkasanAmpu = entries.length > 0
      ? entries.map(([m, kArr]) => {
          const kLabel = Array.isArray(kArr) && kArr.length > 0 ? kArr.join(", ") : "Belum pilih kelas";
          return `<div class="mb-1"><span class="badge bg-info text-dark">${escapeHtml(m)}</span> <small class="text-muted">→ ${escapeHtml(kLabel)}</small></div>`;
        }).join("")
      : `<span class="badge bg-secondary">${escapeHtml(p.mapel || "Semua Mapel")}</span>`;

    const safeUid = escapeHtml(p.uid);
    const safeNama = escapeHtml(p.nama);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="fw-bold">${safeNama || "-"}</td>
      <td>${escapeHtml(p.email || "-")}</td>
      <td>${ringkasanAmpu}</td>
      <td><span class="badge ${isSelfAdmin ? "bg-danger" : "bg-primary"}">${escapeHtml((p.role || "guru").toUpperCase())}</span></td>
      <td>
        ${!isSelfAdmin ? `
          <button class="btn btn-sm btn-outline-warning me-1" onclick="openModalEditGuru('${safeUid}')" title="Edit / Reset Password">
            <i class="bi bi-pencil-square"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="hapusGuru('${safeUid}', '${safeNama}')" title="Hapus Akun">
            <i class="bi bi-trash"></i>
          </button>
        ` : `<span class="badge bg-light text-muted border">Utama</span>`}
      </td>
    `;
    tbody.appendChild(tr);
  });
};

async function handleSimpanSiswa(e) {
  e.preventDefault();
  const nisn = document.getElementById("siswaNisn").value.trim();
  const nama = document.getElementById("siswaNama").value.trim();
  const kelas = document.getElementById("siswaKelas").value.trim();
  const cleanKey = sanitizeFirestoreId(nisn);

  if (!cleanKey || !nama || !kelas) return alert("NISN, Nama siswa, dan Kelas wajib diisi!");

  try {
    await setDoc(doc(firestoreDb, "siswa", cleanKey), {
      nisn,
      nama,
      kelas,
      updatedAt: serverTimestamp()
    }, { merge: true });

    alert("Data siswa berhasil disimpan!");
    document.getElementById("formSiswa").reset();
    const modalEl = document.getElementById("modalSiswa");
    if (modalEl && window.bootstrap) bootstrap.Modal.getOrCreateInstance(modalEl)?.hide();

    removeSessionCache(`cbt_siswa_kelas_${sanitizeFirestoreId(kelas)}`);
    const filterKelasEl = document.getElementById("filterKelasSiswa");
    if (filterKelasEl && filterKelasEl.value.trim().toLowerCase() === kelas.toLowerCase()) {
      await muatSiswaFirestore(kelas, true);
    }
  } catch (err) {
    alert("Gagal menyimpan siswa: " + err.message);
  }
}

window.cetakKartuUjianSiswa = () => {
  const filterKelas = document.getElementById("filterKelasSiswa")?.value.trim() || "";
  const container = document.getElementById("containerKartuUjian");
  if (!container) return;

  if (!filterKelas) {
    return alert("Pilih kelas terlebih dahulu untuk mencetak kartu ujian!");
  }

  const siswaFiltered = daftarSiswa.filter(s => {
    const k = (s.kelas || "").toLowerCase().trim();
    return k === filterKelas.toLowerCase();
  });

  if (siswaFiltered.length === 0) {
    return alert("Tidak ada data siswa untuk dicetak!");
  }

  const baseUrl = window.location.origin + "/ujian-siswa.html";

  container.innerHTML = "";
  siswaFiltered.forEach((s, index) => {
    const col = document.createElement("div");
    col.className = "col-6";
    col.innerHTML = `
      <div class="card card-ujian-box p-3 mb-2" style="font-size: 11px;">
        <div class="text-center border-bottom pb-1 mb-2">
          <h6 class="fw-bold mb-0" style="font-size: 12px;">KARTU PESERTA UJIAN CBT</h6>
          <small class="fw-semibold text-uppercase text-secondary">SMAN 1 TARAJU</small>
        </div>
        <div class="row align-items-center">
          <div class="col-8">
            <table class="table table-sm table-borderless mb-1">
              <tr><td width="30%" class="py-1">NISN</td><td class="py-1">: <strong>${escapeHtml(s.nisn)}</strong></td></tr>
              <tr><td class="py-1">Nama</td><td class="py-1">: <strong>${escapeHtml(s.nama)}</strong></td></tr>
              <tr><td class="py-1">Kelas</td><td class="py-1">: <strong>${escapeHtml(s.kelas || "-")}</strong></td></tr>
            </table>
          </div>
          <div class="col-4 text-center d-flex justify-content-center">
            <div id="qrcode-${index}" class="p-1 bg-white border"></div>
          </div>
        </div>
        <div class="d-flex justify-content-between align-items-end pt-2 border-top mt-1">
          <span class="text-muted" style="font-size: 9px;">Scan untuk buka ujian</span>
          <div class="text-center" style="font-size: 9px;">
            <span>Panitia Ujian</span>
            <div style="height: 18px;"></div>
            <span>(........................)</span>
          </div>
        </div>
      </div>
    `;
    container.appendChild(col);
  });

  siswaFiltered.forEach((s, index) => {
    const qrContainer = document.getElementById(`qrcode-${index}`);
    if (qrContainer && window.QRCode) {
      new QRCode(qrContainer, {
        text: baseUrl,
        width: 65,
        height: 65,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  });

  setTimeout(() => {
    window.print();
  }, 300);
};

async function muatSiswaFirestore(kelasTarget = "", forceReload = false) {
  const session = window.userSession || (typeof userSession !== "undefined" ? userSession : {}) || {};
  const cleanKelas = String(kelasTarget || "").trim();

  // Wajib memilih spesifik satu kelas untuk memuat data siswa (hemat reads)
  if (!cleanKelas) {
    daftarSiswa = [];
    window.daftarSiswa = [];
    renderStats();
    renderTabelSiswaPrompt(
      isUserAdmin(session)
        ? "Silakan pilih kelas terlebih dahulu untuk menampilkan data siswa."
        : "Silakan pilih kelas ampu Anda terlebih dahulu untuk menampilkan data siswa."
    );
    return [];
  }

  // Guru hanya boleh mengakses kelas yang diampunya
  if (!isKelasDiizinkanUntukUser(cleanKelas, session)) {
    daftarSiswa = [];
    window.daftarSiswa = [];
    renderStats();
    renderTabelSiswaPrompt("Kelas yang dipilih berada di luar hak ampu Anda.");
    return [];
  }

  const cacheKey = `cbt_siswa_kelas_${sanitizeFirestoreId(cleanKelas.toLowerCase())}`;

  if (!forceReload) {
    const cached = readSessionCache(cacheKey);
    if (Array.isArray(cached)) {
      daftarSiswa = cached;
      window.daftarSiswa = daftarSiswa;
      renderStats();
      terapkanFilterPencarianSiswa(cleanKelas);
      return daftarSiswa;
    }
  }

  const qSiswa = query(collection(firestoreDb, "siswa"), where("kelas", "==", cleanKelas));
  const snap = await getDocs(qSiswa);
  const hasilSiswa = snap.docs
    .map(d => ({ id: d.id, ...(d.data() || {}) }))
    .sort((a, b) => String(a.nama || "").localeCompare(String(b.nama || "")));

  daftarSiswa = hasilSiswa;
  window.daftarSiswa = daftarSiswa;
  writeSessionCache(cacheKey, daftarSiswa);

  renderStats();
  terapkanFilterPencarianSiswa(cleanKelas);

  return daftarSiswa;
}

function renderTabelSiswaPrompt(pesan) {
  const tbody = document.getElementById("tbodySiswa");
  const totalBadge = document.getElementById("totalSiswaTampil");
  const session = window.userSession || userSession || {};
  const isGuru = session && session.role === "guru";
  const colspanNum = isGuru ? 4 : 5;

  if (totalBadge) totalBadge.innerText = "0 Siswa";
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="${colspanNum}" class="text-center text-muted py-4">${escapeHtml(pesan)}</td></tr>`;
}

function terapkanFilterPencarianSiswa(kelasAktif) {
  const keyword = (document.getElementById("searchSiswa")?.value || "").toLowerCase().trim();
  const kelasLower = String(kelasAktif || "").toLowerCase().trim();

  const hasilFiltered = daftarSiswa.filter(s => {
    const k = (s.kelas || "").toLowerCase().trim();
    const nama = (s.nama || "").toLowerCase();
    const nisn = (s.nisn || "").toLowerCase();

    const matchKelas = kelasLower ? (k === kelasLower) : false;
    const matchSearch = keyword ? (nama.includes(keyword) || nisn.includes(keyword)) : true;

    return matchKelas && matchSearch;
  });

  renderTabelSiswaFiltered(hasilFiltered);
}

function importSiswaExcel(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const workbook = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
      const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

      const itemsValid = [];
      const kelasTerdampak = new Set();

      json.forEach(row => {
        const nisn = String(row.NISN || row.nisn || "").trim();
        const nama = String(row.NAMA || row.Nama || row.nama || "").trim();
        const kelas = String(row.KELAS || row.Kelas || row.kelas || "").trim();
        if (nisn && nama) {
          itemsValid.push({ nisn, nama, kelas });
          if (kelas) kelasTerdampak.add(sanitizeFirestoreId(kelas.toLowerCase()));
        }
      });

      const CHUNK_SIZE = 400;
      for (let i = 0; i < itemsValid.length; i += CHUNK_SIZE) {
        const chunk = itemsValid.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(firestoreDb);
        chunk.forEach(item => {
          const cleanKey = sanitizeFirestoreId(item.nisn);
          batch.set(doc(firestoreDb, "siswa", cleanKey), {
            nisn: item.nisn,
            nama: item.nama,
            kelas: item.kelas,
            updatedAt: serverTimestamp()
          }, { merge: true });
        });
        await batch.commit();
      }

      kelasTerdampak.forEach(kKey => removeSessionCache(`cbt_siswa_kelas_${kKey}`));
      const kelasAktif = document.getElementById("filterKelasSiswa")?.value.trim() || "";
      if (kelasAktif) {
        await muatSiswaFirestore(kelasAktif, true);
      }

      alert(`Berhasil mengimpor ${itemsValid.length} data siswa ke Firestore!`);
    } catch (err) {
      console.error("Gagal impor siswa:", err);
      alert("Gagal mengimpor data siswa: " + err.message);
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsArrayBuffer(file);
}

function importExcelSoal(event) {
  const file = event.target.files[0];
  if (!file || !window.activeUjianId) return;

  const sumberUjian = Array.isArray(window.daftarUjian) ? window.daftarUjian : [];
  const u = sumberUjian.find(item => item.id === window.activeUjianId);
  if (!u) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const workbook = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
      const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

      let countAdded = 0;
      const soalBaruList = Array.isArray(u.soal) && u.soal.length > 0
        ? [...u.soal]
        : await ambilSoalFirestore(window.activeUjianId);

      json.forEach(row => {
        const tipe = String(row.Tipe || row.tipe || "pg").trim().toLowerCase();
        const pertanyaan = String(row.Pertanyaan || row.pertanyaan || "").trim();
        const gambarUrl = normalisasiLinkGambarInput(row.GambarURL || row.gambarUrl || row.Gambar || "");

        if (!pertanyaan) return;

        const itemSoal = {
          id: "SOAL-" + Date.now() + Math.random().toString(36).substr(2, 4),
          tipe,
          pertanyaan,
          gambarUrl
        };

        if (tipe === "pg") {
          itemSoal.opsi = {
            A: String(row.A || ""),
            B: String(row.B || ""),
            C: String(row.C || ""),
            D: String(row.D || ""),
            E: String(row.E || "")
          };
          itemSoal.kunci = String(row.Kunci || "A").toUpperCase().trim();
        } else if (tipe === "pg_kompleks") {
          itemSoal.opsi = {
            A: String(row.A || ""),
            B: String(row.B || ""),
            C: String(row.C || ""),
            D: String(row.D || ""),
            E: String(row.E || "")
          };
          itemSoal.kunci = String(row.Kunci || "").split(",").map(k => k.toUpperCase().trim()).filter(Boolean);
        } else if (tipe === "mencocokkan") {
          const rawPasangan = String(row.Pasangan || "");
          const listPasangan = [];
          rawPasangan.split(";").forEach(pair => {
            const [kiri, kanan] = pair.split("=");
            if (kiri && kanan) listPasangan.push({ kiri: kiri.trim(), kanan: kanan.trim() });
          });
          itemSoal.pasangan = listPasangan;
        }

        soalBaruList.push(itemSoal);
        countAdded++;
      });

      await simpanSoalUjianAktif(window.activeUjianId, soalBaruList);
      u.soal = soalBaruList;
      window.renderDaftarSoalInteraktif(soalBaruList);
      alert(`Berhasil mengimpor ${countAdded} soal ke Firestore!`);
    } catch (err) {
      alert("Gagal mengimpor file Excel soal: " + err.message);
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsArrayBuffer(file);
}

window.filterDataSiswa = async (forceReload = false) => {
  const session = window.userSession || userSession || {};
  const selectKelasEl = document.getElementById("filterKelasSiswa");
  const filterKelas = selectKelasEl ? selectKelasEl.value.trim() : "";

  if (!filterKelas) {
    daftarSiswa = [];
    window.daftarSiswa = [];
    renderStats();
    renderTabelSiswaPrompt(
      isUserAdmin(session)
        ? "Silakan pilih kelas terlebih dahulu untuk menampilkan data siswa."
        : "Silakan pilih kelas ampu Anda terlebih dahulu untuk menampilkan data siswa."
    );
    return;
  }

  if (!isKelasDiizinkanUntukUser(filterKelas, session)) {
    if (selectKelasEl) selectKelasEl.value = "";
    daftarSiswa = [];
    window.daftarSiswa = [];
    renderStats();
    renderTabelSiswaPrompt("Anda hanya dapat melihat data siswa di kelas yang Anda ampu.");
    return;
  }

  const cacheKey = `cbt_siswa_kelas_${sanitizeFirestoreId(filterKelas.toLowerCase())}`;
  const cached = !forceReload ? readSessionCache(cacheKey) : null;

  if (Array.isArray(cached) && cached.length > 0 && cached[0] && String(cached[0].kelas || "").toLowerCase() === filterKelas.toLowerCase()) {
    daftarSiswa = cached;
    window.daftarSiswa = daftarSiswa;
    renderStats();
    terapkanFilterPencarianSiswa(filterKelas);
    return;
  }

  await muatSiswaFirestore(filterKelas, forceReload);
};

function renderTabelSiswaFiltered(listSiswa) {
  const tbody = document.getElementById("tbodySiswa");
  const totalBadge = document.getElementById("totalSiswaTampil");
  if (!tbody) return;

  const session = window.userSession || userSession || {};
  const isGuru = session && session.role === "guru";
  const colspanNum = isGuru ? 4 : 5;

  if (totalBadge) totalBadge.innerText = `${listSiswa.length} Siswa`;
  tbody.innerHTML = "";

  if (listSiswa.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${colspanNum}" class="text-center text-muted py-3">Data siswa tidak ditemukan pada kelas ini.</td></tr>`;
    return;
  }

  listSiswa.forEach((s, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="font-monospace">${escapeHtml(s.nisn || "-")}</td>
      <td class="fw-bold">${escapeHtml(s.nama || "-")}</td>
      <td><span class="badge bg-secondary">${escapeHtml(s.kelas || "-")}</span></td>
      ${!isGuru ? `
      <td>
        <button class="btn btn-sm btn-outline-danger" onclick="hapusSiswa('${escapeHtml(s.nisn)}', '${escapeHtml(s.kelas || "")}')">
          <i class="bi bi-trash"></i>
        </button>
      </td>` : ""}
    `;
    tbody.appendChild(tr);
  });
}

function sinkronkanTombolRekapTerpilih() {
  const jumlah = rekapTerpilihIds.size;
  const btnHapusMassal = document.getElementById("btnHapusTerpilihRekap");
  const checkAll = document.getElementById("checkSemuaRekap");

  if (btnHapusMassal) {
    btnHapusMassal.disabled = sedangHapusRekap || jumlah === 0;
    btnHapusMassal.innerHTML = `<i class="bi bi-trash-fill me-1"></i>Hapus Terpilih (${jumlah})`;
  }

  const visibleBoxes = Array.from(document.querySelectorAll(".check-item-rekap"));
  if (checkAll) {
    if (visibleBoxes.length === 0) {
      checkAll.checked = false;
      checkAll.indeterminate = false;
    } else {
      const checkedCount = visibleBoxes.filter((cb) => cb.checked).length;
      checkAll.checked = checkedCount === visibleBoxes.length;
      checkAll.indeterminate = checkedCount > 0 && checkedCount < visibleBoxes.length;
    }
  }
}

window.togglePilihSemuaRekap = (checked) => {
  document.querySelectorAll(".check-item-rekap").forEach((cb) => {
    cb.checked = checked;
    const docId = cb.getAttribute("data-id");
    if (!docId) return;
    if (checked) rekapTerpilihIds.add(docId);
    else rekapTerpilihIds.delete(docId);
  });
  sinkronkanTombolRekapTerpilih();
};

window.togglePilihSatuRekap = (docId, checked) => {
  if (!docId) return;
  if (checked) rekapTerpilihIds.add(docId);
  else rekapTerpilihIds.delete(docId);
  sinkronkanTombolRekapTerpilih();
};

async function hapusSatuRekapInternal(resultId) {
  if (!resultId) return;
  await deleteDoc(doc(firestoreDb, "jawaban_siswa", sanitizeFirestoreId(resultId))).catch(() => {});
}

window.hapusRekapTerpilih = async () => {
  if (sedangHapusRekap) return;
  const ids = Array.from(rekapTerpilihIds);
  if (ids.length === 0) {
    return alert("Pilih minimal satu data nilai terlebih dahulu!");
  }

  if (!confirm(`Yakin ingin menghapus permanen ${ids.length} data hasil ujian terpilih?`)) {
    return;
  }

  sedangHapusRekap = true;
  sinkronkanTombolRekapTerpilih();

  try {
    await Promise.all(ids.map((id) => hapusSatuRekapInternal(id)));

    const idSet = new Set(ids);
    hasilUjian = hasilUjian.filter((item) => !idSet.has(item.id));
    window.hasilUjian = hasilUjian;
    ids.forEach((id) => rekapTerpilihIds.delete(id));

    window.filterRekapNilai();
    alert(`Berhasil menghapus ${ids.length} data hasil ujian.`);
  } catch (err) {
    console.error("Gagal menghapus rekap terpilih:", err);
    alert("Terjadi kesalahan saat menghapus data terpilih: " + err.message);
  } finally {
    sedangHapusRekap = false;
    sinkronkanTombolRekapTerpilih();
  }
};

window.filterRekapNilai = () => {
  const kelasSelected = document.getElementById("selectFilterKelas")?.value.toLowerCase().trim() || "";
  const ujianSelected = document.getElementById("selectFilterUjian")?.value || "";

  const filteredHasil = hasilUjian.filter(h => {
    const kelasSiswa = (h.kelas || "").toLowerCase().trim();
    const ujianId = h.ujianId || h.kodeUjian || "";

    const matchKelas = kelasSelected ? (kelasSiswa === kelasSelected) : true;
    const matchUjian = ujianSelected ? (ujianId === ujianSelected) : true;

    return matchKelas && matchUjian;
  });

  renderTabelNilai(filteredHasil);
};

function renderTabelNilai(listHasil = hasilUjian) {
  const tbody = document.getElementById("tbodyNilai");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (listHasil.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-3">Tidak ada hasil ujian yang sesuai dengan filter.</td></tr>`;
    sinkronkanTombolRekapTerpilih();
    return;
  }

  listHasil.forEach((h, i) => {
    const resultId = escapeHtml(h.id);
    const checkedAttr = rekapTerpilihIds.has(h.id) ? "checked" : "";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="text-center">
        <input type="checkbox" class="form-check-input check-item-rekap" data-id="${resultId}" ${checkedAttr} onchange="togglePilihSatuRekap('${resultId}', this.checked)">
      </td>
      <td>${i + 1}</td>
      <td class="font-monospace">${escapeHtml(h.nisn || "-")}</td>
      <td class="fw-bold">${escapeHtml(h.nama || "-")} <span class="badge bg-light text-dark border ms-1">${escapeHtml(h.kelas || "-")}</span></td>
      <td>${escapeHtml(h.mapel || "-")} - ${escapeHtml(h.judul || "-")}</td>
      <td><span class="badge bg-success fs-6">${Number(h.nilai) || 0}</span></td>
      <td class="small text-muted">${escapeHtml(h.waktuSelesai || "-")}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-danger fw-bold" onclick="hapusHasilUjian('${resultId}')">
          <i class="bi bi-trash-fill me-1"></i>Hapus
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  sinkronkanTombolRekapTerpilih();
}

window.openModalTambahUjian = async () => {
  document.getElementById("formUjian")?.reset();

  const tokenEl = document.getElementById("ujianToken");
  if (tokenEl) tokenEl.value = Math.random().toString(36).substring(2, 8).toUpperCase();

  const selectPembuat = document.getElementById("ujianPembuat");
  const selectMapelUjian = document.getElementById("ujianMapel");

  let namaGuru = "";
  let mapelGuruList = [];
  let kelasDiampuGuru = [];

  if (window.userSession) {
    namaGuru = window.userSession.nama || window.userSession.username || "";
    mapelGuruList = window.userSession.mapelDiampu || (window.userSession.mapel ? [window.userSession.mapel] : []);
    kelasDiampuGuru = getKelasDiampuGuru(window.userSession);
  }

  if (window.userSession && window.userSession.role !== "admin") {
    if (selectPembuat) {
      const opsiAda = Array.from(selectPembuat.options).some(opt => opt.value.toLowerCase() === namaGuru.toLowerCase());
      if (!opsiAda && namaGuru) {
        const opt = document.createElement("option");
        opt.value = namaGuru;
        opt.textContent = namaGuru;
        selectPembuat.appendChild(opt);
      }
      if (namaGuru) selectPembuat.value = namaGuru;
      selectPembuat.disabled = true;
    }

    if (selectMapelUjian) {
      selectMapelUjian.innerHTML = "";
      mapelGuruList.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        selectMapelUjian.appendChild(opt);
      });
      selectMapelUjian.disabled = false;
    }
  } else {
    if (selectPembuat) {
      selectPembuat.disabled = false;
      updateGuruDropdown();
    }
    if (selectMapelUjian) {
      selectMapelUjian.disabled = false;
      if (window.daftarMapelMaster) {
        selectMapelUjian.innerHTML = '<option value="">-- Pilih Mata Pelajaran --</option>';
        window.daftarMapelMaster.forEach(m => {
          selectMapelUjian.innerHTML += `<option value="${escapeHtml(m.nama)}">${escapeHtml(m.nama)}</option>`;
        });
      }
    }
  }

  const containerCheck = document.getElementById("containerCheckboxKelas");
  if (containerCheck) {
    containerCheck.innerHTML = `<small class="text-muted">Memuat kelas...</small>`;

    if ((window.daftarKelas || []).length === 0) {
      await muatKelasFirestore(false);
    }

    let listKelasAktif = window.daftarKelas || [];
    if (window.userSession && window.userSession.role !== "admin") {
      const allowedSet = new Set(kelasDiampuGuru.map(k => k.toLowerCase()));
      listKelasAktif = listKelasAktif.filter(k => allowedSet.has(String(k.nama || "").trim().toLowerCase()));
    }

    containerCheck.innerHTML = "";
    if (listKelasAktif.length === 0) {
      containerCheck.innerHTML = `<small class="text-danger">Tidak ada kelas hak ampu yang terdaftar.</small>`;
    } else {
      listKelasAktif.forEach((k, idx) => {
        const idEl = `checkKelas_${idx}`;
        const div = document.createElement("div");
        div.className = "form-check mb-1";
        div.innerHTML = `
          <input class="form-check-input check-kelas-item" type="checkbox" value="${escapeHtml(k.nama)}" id="${idEl}">
          <label class="form-check-label" for="${idEl}">${escapeHtml(k.nama)}</label>
        `;
        containerCheck.appendChild(div);
      });
    }
  }

  const modalEl = document.getElementById("modalUjian");
  if (modalEl && window.bootstrap) bootstrap.Modal.getOrCreateInstance(modalEl).show();
};

window.currentUjianActive = null;
window.currentUjianActiveKey = "";
window.activeUjianId = "";
window.currentEditSoalIndex = null;
window.currentEditGambarLama = "";

window.openModalSoal = async (idUjian) => {
  const sumberUjian = Array.isArray(window.daftarUjian) ? window.daftarUjian : [];
  const u = sumberUjian.find(item => item.id === idUjian);
  if (!u) return alert("Ujian tidak ditemukan!");

  window.currentUjianActive = u;
  window.currentUjianActiveKey = idUjian;
  window.activeUjianId = idUjian;
  window.currentEditSoalIndex = null;
  window.currentEditGambarLama = "";

  const formSoal = document.getElementById("formTambahSoal");
  if (formSoal) formSoal.reset();
  document.getElementById("previewGambarContainer")?.classList.add("d-none");

  const judulSoalEl = document.getElementById("judulUjianSoal");
  if (judulSoalEl) {
    judulSoalEl.innerHTML = `<i class="bi bi-gear-fill me-2"></i>Kelola Soal: ${escapeHtml(u.mapel || "")} - ${escapeHtml(u.judul || "")}`;
  }

  let daftarSoalTampil = Array.isArray(u.soal) ? u.soal : [];
  const paksaAmbilUlang = daftarSoalTampil.length === 0;

  if (paksaAmbilUlang) {
    try {
      const soalFs = await ambilSoalFirestore(idUjian);
      if (Array.isArray(soalFs)) {
        daftarSoalTampil = soalFs;
        u.soal = soalFs;
      }
    } catch (err) {
      console.warn("Gagal membaca soal Firestore:", err);
    }
  }

  window.renderDaftarSoalInteraktif(daftarSoalTampil);

  const modalKelola = document.getElementById("modalKelolaSoal");
  if (modalKelola && window.bootstrap) {
    bootstrap.Modal.getOrCreateInstance(modalKelola).show();
  }
};

window.openModalTambahSiswa = () => {
  document.getElementById("formSiswa")?.reset();
  const modalEl = document.getElementById("modalSiswa");
  if (modalEl && window.bootstrap) bootstrap.Modal.getOrCreateInstance(modalEl).show();
};

window.hapusUjian = async (id) => {
  if (!confirm("Hapus ujian beserta seluruh soalnya?")) return;
  const cleanId = sanitizeFirestoreId(id);
  try {
    await Promise.all([
      deleteDoc(doc(firestoreDb, "soal", cleanId)).catch(() => {}),
      deleteDoc(doc(firestoreDb, "ujian", cleanId))
    ]);

    const snapStatus = await getDocs(query(collection(firestoreDb, "status_peserta"), where("ujianId", "==", id)));
    if (!snapStatus.empty) {
      const batch = writeBatch(firestoreDb);
      snapStatus.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    if (document.getElementById("selectUjianMonitoring")?.value === id) {
      document.getElementById("selectUjianMonitoring").value = "";
      window.loadDataMonitoring();
    }
    await muatUjianFirestore(true);
  } catch (err) {
    alert("Gagal menghapus ujian: " + err.message);
  }
};

window.switchTipeSoal = (tipe) => {
  const containerPG = document.getElementById("containerPG");
  const containerMencocokkan = document.getElementById("containerMencocokkan");
  const boxKunciPG = document.getElementById("boxKunciPG");
  const boxKunciKompleks = document.getElementById("boxKunciKompleks");

  if (!containerPG || !containerMencocokkan) return;
  if (tipe === "pg") {
    containerPG.classList.remove("d-none");
    containerMencocokkan.classList.add("d-none");
    boxKunciPG?.classList.remove("d-none");
    boxKunciKompleks?.classList.add("d-none");
  } else if (tipe === "pg_kompleks") {
    containerPG.classList.remove("d-none");
    containerMencocokkan.classList.add("d-none");
    boxKunciPG?.classList.add("d-none");
    boxKunciKompleks?.classList.remove("d-none");
  } else if (tipe === "mencocokkan") {
    containerPG.classList.add("d-none");
    containerMencocokkan.classList.remove("d-none");
  }
};

window.hapusSiswa = async (nisn, kelasSiswa = "") => {
  if (!confirm("Hapus siswa ini?")) return;
  try {
    const cleanKey = sanitizeFirestoreId(nisn);
    await deleteDoc(doc(firestoreDb, "siswa", cleanKey));

    const kelasAktif = kelasSiswa || document.getElementById("filterKelasSiswa")?.value.trim() || "";
    if (kelasAktif) {
      removeSessionCache(`cbt_siswa_kelas_${sanitizeFirestoreId(kelasAktif.toLowerCase())}`);
      await muatSiswaFirestore(kelasAktif, true);
    }
  } catch (err) {
    alert("Gagal menghapus siswa: " + err.message);
  }
};

window.downloadTemplateSoal = () => {
  const sampleRows = [
    {
      Tipe: "pg",
      Pertanyaan: "Contoh soal pilihan ganda tunggal?",
      GambarURL: "",
      A: "Pilihan A",
      B: "Pilihan B",
      C: "Pilihan C",
      D: "Pilihan D",
      E: "Pilihan E",
      Kunci: "A",
      Pasangan: ""
    }
  ];
  const ws = XLSX.utils.json_to_sheet(sampleRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template Soal");
  XLSX.writeFile(wb, "Template_Soal_CBT.xlsx");
};

window.downloadTemplateSiswa = () => {
  const data = [
    { NISN: "0081234561", NAMA: "Ahmad Rizky", KELAS: "X.01" },
    { NISN: "0081234562", NAMA: "Siti Nurhaliza", KELAS: "XI.01" }
  ];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template Siswa");
  XLSX.writeFile(wb, "Template_Data_Siswa.xlsx");
};

window.openModalEditGuru = async (uid) => {
  const g = daftarPengguna.find(p => p.uid === uid || p.id === uid);
  if (!g) return alert("Data guru tidak ditemukan!");

  const resolvedUid = String(g.uid || g.id || uid || "").trim();
  currentEditGuruUid = resolvedUid;

  const elUid = document.getElementById("editGuruUid");
  if (elUid) elUid.value = resolvedUid;

  const elNama = document.getElementById("editGuruNama");
  const elEmail = document.getElementById("editGuruEmail");
  const elPass = document.getElementById("editGuruPassword");

  if (elNama) elNama.value = g.nama || "";
  if (elEmail) elEmail.value = g.email || "";
  if (elPass) elPass.value = "";

  if ((window.daftarKelas || daftarKelas || []).length === 0) {
    await muatKelasFirestore(false);
  }
  if ((window.daftarMapelMaster || []).length === 0) {
    await muatMapelFirestore(false);
  }

  const containerMapping = document.getElementById("containerMappingMapelKelasEdit");
  if (containerMapping) {
    const existingDetail = normalisasiDetailAmpuan(g);
    renderMappingMapelKelas(
      containerMapping,
      window.daftarMapelMaster || [],
      window.daftarKelas || daftarKelas || [],
      existingDetail
    );
  }

  const modalEl = document.getElementById("modalEditGuru");
  if (modalEl && window.bootstrap) {
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }
};

window.openModalTambahGuru = async () => {
  const formEl = document.getElementById("formTambahGuru");
  if (formEl) formEl.reset();

  if ((window.daftarKelas || daftarKelas || []).length === 0) {
    await muatKelasFirestore(false);
  }
  if ((window.daftarMapelMaster || []).length === 0) {
    await muatMapelFirestore(false);
  }

  const containerMapping = document.getElementById("containerMappingMapelKelasTambah");
  renderMappingMapelKelas(containerMapping, window.daftarMapelMaster || [], window.daftarKelas || daftarKelas || [], {});

  const modalEl = document.getElementById("modalTambahGuru");
  if (modalEl && window.bootstrap) {
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }
};

window.renderDaftarSoalInteraktif = function(daftarSoal) {
  const container = document.getElementById("listSoalUjian");
  if (!container) return;

  if (!daftarSoal || daftarSoal.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4 text-muted">
        <i class="bi bi-inbox fs-1 d-block mb-2"></i>
        Belum ada soal dalam ujian ini.
      </div>`;
    return;
  }

  let html = "";
  daftarSoal.forEach((soal, index) => {
    let badgeTipe = '<span class="badge bg-primary me-1">PG</span>';
    if (soal.tipe === "pg_kompleks") {
      badgeTipe = '<span class="badge bg-info text-dark me-1">PG Kompleks</span>';
    } else if (soal.tipe === "mencocokkan") {
      badgeTipe = '<span class="badge text-white me-1" style="background-color: #6f42c1;">Menjodohkan</span>';
    }

    let detailOpsi = "";
    if ((soal.tipe === "pg" || soal.tipe === "pg_kompleks" || !soal.tipe) && soal.opsi) {
      detailOpsi = `
        <ul class="list-unstyled mb-2 text-secondary small ps-1">
          ${soal.opsi.A ? `<li>• A. ${escapeHtml(soal.opsi.A)}</li>` : ""}
          ${soal.opsi.B ? `<li>• B. ${escapeHtml(soal.opsi.B)}</li>` : ""}
          ${soal.opsi.C ? `<li>• C. ${escapeHtml(soal.opsi.C)}</li>` : ""}
          ${soal.opsi.D ? `<li>• D. ${escapeHtml(soal.opsi.D)}</li>` : ""}
          ${soal.opsi.E ? `<li>• E. ${escapeHtml(soal.opsi.E)}</li>` : ""}
        </ul>`;
    } else if (soal.tipe === "mencocokkan" && soal.pasangan) {
      detailOpsi = `
        <div class="bg-light p-2 rounded mb-2 border small">
          <strong>Pasangan:</strong>
          ${soal.pasangan.map(p => `<div>• ${escapeHtml(p.kiri)} <i class="bi bi-arrow-right"></i> ${escapeHtml(p.kanan)}</div>`).join("")}
        </div>`;
    }

    const kunciText = Array.isArray(soal.kunci) ? soal.kunci.join(", ") : (soal.kunci || "-");

    html += `
      <div class="card mb-3 border shadow-sm">
        <div class="card-body p-3">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <div>
              <span class="badge bg-dark me-1">Soal ke-${index + 1}</span>
              ${badgeTipe}
            </div>
            <div class="btn-group btn-group-sm" role="group">
              <button type="button" class="btn btn-outline-warning text-dark px-2" onclick="isiFormEditSoal(${index})" title="Edit Soal">
                <i class="bi bi-pencil me-1"></i>Edit
              </button>
              <button type="button" class="btn btn-outline-danger px-2" onclick="hapusSoalIndeks(${index})" title="Hapus Soal">
                <i class="bi bi-trash me-1"></i>Hapus
              </button>
            </div>
          </div>

          <p class="fw-semibold text-dark mb-2">${escapeHtml(soal.pertanyaan)}</p>
          ${soal.gambarUrl ? `<img src="${escapeHtml(soal.gambarUrl)}" class="img-fluid rounded mb-2 border" style="max-height: 150px;" alt="Gambar Soal" onerror="this.style.display='none';">` : ""}
          ${detailOpsi}
          <div><span class="badge bg-success">Kunci: ${escapeHtml(kunciText)}</span></div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
};

window.isiFormEditSoal = (index) => {
  if (!window.currentUjianActive || !window.currentUjianActive.soal || !window.currentUjianActive.soal[index]) return;

  const soal = window.currentUjianActive.soal[index];
  window.currentEditSoalIndex = index;
  window.currentEditGambarLama = soal.gambarUrl || "";

  const selectTipe = document.getElementById("soalTipe");
  if (selectTipe) {
    selectTipe.value = soal.tipe || "pg";
    window.switchTipeSoal(soal.tipe || "pg");
  }

  const elPertanyaan = document.getElementById("soalPertanyaan");
  if (elPertanyaan) elPertanyaan.value = soal.pertanyaan || "";

  const inputUrl = document.getElementById("soalGambarUrl");
  if (inputUrl) inputUrl.value = soal.gambarUrl || "";

  const previewContainer = document.getElementById("previewGambarContainer");
  const previewImg = document.getElementById("previewGambar");
  if (soal.gambarUrl && previewImg && previewContainer) {
    previewImg.src = soal.gambarUrl;
    previewContainer.classList.remove("d-none");
  } else {
    previewContainer?.classList.add("d-none");
  }

  if (soal.opsi) {
    ["A", "B", "C", "D", "E"].forEach(opt => {
      const elOpsi = document.getElementById(`soal${opt}`);
      if (elOpsi) elOpsi.value = soal.opsi[opt] || "";
    });
  }

  if (soal.tipe === "pg" || !soal.tipe) {
    const elKunciPG = document.getElementById("soalKunciPG");
    if (elKunciPG) elKunciPG.value = soal.kunci || "A";
  } else if (soal.tipe === "pg_kompleks") {
    ["A", "B", "C", "D", "E"].forEach(opt => {
      const chk = document.getElementById(`kunciKompleks${opt}`);
      if (chk) {
        chk.checked = Array.isArray(soal.kunci) ? soal.kunci.includes(opt) : (soal.kunci === opt);
      }
    });
  } else if (soal.tipe === "mencocokkan" && Array.isArray(soal.pasangan)) {
    for (let i = 1; i <= 3; i++) {
      const p = soal.pasangan[i - 1];
      const elKiri = document.getElementById(`matchKiri${i}`);
      const elKanan = document.getElementById(`matchKanan${i}`);
      if (elKiri) elKiri.value = p ? p.kiri : "";
      if (elKanan) elKanan.value = p ? p.kanan : "";
    }
  }

  const btnSubmit = document.querySelector('#formTambahSoal button[type="submit"]');
  if (btnSubmit) {
    btnSubmit.innerHTML = `<i class="bi bi-check-circle me-1"></i>Simpan Perubahan Soal`;
    btnSubmit.className = "btn btn-warning w-100 fw-bold";
  }
};

window.hapusSoalIndeks = async (index) => {
  if (!window.currentUjianActive || !window.currentUjianActive.soal) return;

  if (!confirm("Apakah Anda yakin ingin menghapus soal ini?")) return;
  const listSoal = [...window.currentUjianActive.soal];
  listSoal.splice(index, 1);

  try {
    await simpanSoalUjianAktif(window.currentUjianActiveKey, listSoal);
    window.currentUjianActive.soal = listSoal;
    window.renderDaftarSoalInteraktif(listSoal);
    alert("Soal berhasil dihapus!");
  } catch (err) {
    alert("Gagal menghapus soal: " + err.message);
  }
};

const formTambahSoalEl = document.getElementById("formTambahSoal");
if (formTambahSoalEl) {
  formTambahSoalEl.onsubmit = async (e) => {
    e.preventDefault();
    if (!window.currentUjianActiveKey || !window.currentUjianActive) {
      return alert("Pilih ujian terlebih dahulu!");
    }

    const tipe = document.getElementById("soalTipe").value;
    const pertanyaan = document.getElementById("soalPertanyaan").value.trim();

    const inputUrlEl = document.getElementById("soalGambarUrl");
    const urlDariInput = inputUrlEl ? normalisasiLinkGambarInput(inputUrlEl.value) : "";
    let gambarUrlFinal = urlDariInput || (inputUrlEl && !inputUrlEl.value.trim() ? "" : (window.currentEditGambarLama || ""));

    const listSoal = Array.isArray(window.currentUjianActive.soal) ? [...window.currentUjianActive.soal] : [];
    const isEditMode = window.currentEditSoalIndex !== null && window.currentEditSoalIndex >= 0;

    const itemSoal = {
      id: isEditMode && listSoal[window.currentEditSoalIndex]
        ? listSoal[window.currentEditSoalIndex].id
        : "SOAL-" + Date.now(),
      tipe,
      pertanyaan,
      gambarUrl: gambarUrlFinal
    };

    if (tipe === "pg") {
      itemSoal.opsi = {
        A: document.getElementById("soalA")?.value || "",
        B: document.getElementById("soalB")?.value || "",
        C: document.getElementById("soalC")?.value || "",
        D: document.getElementById("soalD")?.value || "",
        E: document.getElementById("soalE")?.value || ""
      };
      itemSoal.kunci = document.getElementById("soalKunciPG")?.value || "A";
    } else if (tipe === "pg_kompleks") {
      itemSoal.opsi = {
        A: document.getElementById("soalA")?.value || "",
        B: document.getElementById("soalB")?.value || "",
        C: document.getElementById("soalC")?.value || "",
        D: document.getElementById("soalD")?.value || "",
        E: document.getElementById("soalE")?.value || ""
      };
      const checkedKunci = [];
      ["A", "B", "C", "D", "E"].forEach(opt => {
        if (document.getElementById("kunciKompleks" + opt)?.checked) checkedKunci.push(opt);
      });
      itemSoal.kunci = checkedKunci;
    } else if (tipe === "mencocokkan") {
      const pasangan = [];
      for (let i = 1; i <= 3; i++) {
        const elKiri = document.getElementById(`matchKiri${i}`)?.value.trim();
        const elKanan = document.getElementById(`matchKanan${i}`)?.value.trim();
        if (elKiri && elKanan) pasangan.push({ kiri: elKiri, kanan: elKanan });
      }
      itemSoal.pasangan = pasangan;
      itemSoal.kunci = "Sesuai Pasangan";
    }

    if (isEditMode) {
      listSoal[window.currentEditSoalIndex] = itemSoal;
    } else {
      listSoal.push(itemSoal);
    }

    try {
      await simpanSoalUjianAktif(window.currentUjianActiveKey, listSoal);
      alert(isEditMode ? "Perubahan soal berhasil disimpan!" : "Soal berhasil ditambahkan!");
      window.currentEditSoalIndex = null;
      window.currentEditGambarLama = "";
      e.target.reset();
      document.getElementById("previewGambarContainer")?.classList.add("d-none");
      window.switchTipeSoal("pg");

      const btnSubmit = e.target.querySelector('button[type="submit"]');
      if (btnSubmit) {
        btnSubmit.innerHTML = `<i class="bi bi-plus-circle me-1"></i>Tambahkan Soal`;
        btnSubmit.className = "btn btn-primary w-100";
      }

      window.currentUjianActive.soal = listSoal;
      window.renderDaftarSoalInteraktif(listSoal);
    } catch (err) {
      alert("Gagal menyimpan soal: " + err.message);
    }
  };
}

function sanitasiSelExcel(nilai, maxLen = 32000) {
  if (nilai === null || nilai === undefined) return "";
  if (typeof nilai === "number" || typeof nilai === "boolean") return nilai;

  const teks = typeof nilai === "object" ? JSON.stringify(nilai) : String(nilai);
  if (teks.startsWith("data:image")) {
    return "[Gambar terlampir di soal]";
  }
  if (teks.length > maxLen) {
    return teks.slice(0, maxLen) + "...";
  }
  return teks;
}

window.downloadArsipSoalById = async (ujianId) => {
  const sumberUjian = Array.isArray(window.daftarUjian) ? window.daftarUjian : [];
  const u = sumberUjian.find(item => item.id === ujianId);
  if (!u) return alert("Data ujian tidak ditemukan!");

  const soalArr = (Array.isArray(u.soal) && u.soal.length > 0)
    ? u.soal
    : await ambilSoalFirestore(ujianId);

  if (!soalArr || soalArr.length === 0) {
    return alert("Ujian ini belum memiliki soal untuk diunduh!");
  }

  try {
    const excelData = soalArr.map((s, index) => {
      const kunciFormatted = Array.isArray(s.kunci) ? s.kunci.join(", ") : (s.kunci || "");
      const pasanganFormatted = (s.tipe === "mencocokkan" && s.pasangan)
        ? s.pasangan.map(p => `${p.kiri}=${p.kanan}`).join("; ")
        : "";

      return {
        "No": index + 1,
        "Tipe": sanitasiSelExcel((s.tipe || "pg").toUpperCase(), 100),
        "Pertanyaan": sanitasiSelExcel(s.pertanyaan || ""),
        "GambarURL": sanitasiSelExcel(s.gambarUrl || ""),
        "A": sanitasiSelExcel(s.opsi ? (s.opsi.A || "") : ""),
        "B": sanitasiSelExcel(s.opsi ? (s.opsi.B || "") : ""),
        "C": sanitasiSelExcel(s.opsi ? (s.opsi.C || "") : ""),
        "D": sanitasiSelExcel(s.opsi ? (s.opsi.D || "") : ""),
        "E": sanitasiSelExcel(s.opsi ? (s.opsi.E || "") : ""),
        "Kunci": sanitasiSelExcel(kunciFormatted),
        "Pasangan": sanitasiSelExcel(pasanganFormatted)
      };
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Arsip Soal");

    const namaMapelClean = String(u.mapel || "Mapel").replace(/[^a-zA-Z0-9]/g, "_");
    const namaFileClean = (u.judul || "Ujian").replace(/[^a-zA-Z0-9]/g, "_");
    XLSX.writeFile(wb, `Arsip_Soal_${namaMapelClean}_${namaFileClean}.xlsx`);
  } catch (err) {
    console.error("Gagal mengunduh arsip soal:", err);
    alert("Gagal mengunduh arsip soal ke Excel: " + err.message);
  }
};

function updateGuruDropdown() {
  const selectPembuat = document.getElementById("ujianPembuat");
  if (!selectPembuat) return;

  selectPembuat.innerHTML = '<option value="">-- Pilih Guru Pengampu --</option>';
  const addedNames = new Set();

  if (typeof daftarPengguna !== "undefined" && Array.isArray(daftarPengguna) && daftarPengguna.length > 0) {
    daftarPengguna.forEach(p => {
      const isGuru = p.role && p.role.toLowerCase() === "guru";
      if (isGuru && p.nama && !addedNames.has(p.nama)) {
        addedNames.add(p.nama);
        const opt = document.createElement("option");
        opt.value = p.nama;
        const listMapel = Array.isArray(p.mapelDiampu) ? p.mapelDiampu.join(", ") : (p.mapel || "Guru Pengampu");
        opt.textContent = `${p.nama} - ${listMapel}`;
        selectPembuat.appendChild(opt);
      }
    });
  }
}

window.bukaModalEditUjian = async (ujianId) => {
  try {
    let data = (Array.isArray(window.daftarUjian) ? window.daftarUjian : []).find(u => u.id === ujianId);

    if (!data) {
      const snap = await getDoc(doc(firestoreDb, "ujian", sanitizeFirestoreId(ujianId)));
      if (!snap.exists()) return alert("Data ujian tidak ditemukan!");
      data = snap.data() || {};
    }

    document.getElementById("editUjianId").value = ujianId;
    document.getElementById("editJudulUjian").value = data.judul || "";
    document.getElementById("editDurasiUjian").value = data.durasi || "";

    const elToken = document.getElementById("editTokenUjian");
    if (elToken) elToken.value = data.token || "";

    const modalEl = document.getElementById("modalEditUjian");
    if (modalEl && window.bootstrap) {
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
  } catch (error) {
    alert("Gagal memuat data ujian: " + error.message);
  }
};

window.simpanPerubahanUjian = async (e) => {
  if (e) e.preventDefault();

  const ujianId = document.getElementById("editUjianId").value;
  const judulBaru = document.getElementById("editJudulUjian").value.trim();
  const durasiBaru = document.getElementById("editDurasiUjian").value.trim();
  const tokenBaru = document.getElementById("editTokenUjian")?.value.trim().toUpperCase() || "";

  if (!ujianId || !judulBaru || !durasiBaru || !tokenBaru) {
    alert("Mohon lengkapi semua data termasuk token!");
    return;
  }

  try {
    await updateDoc(doc(firestoreDb, "ujian", sanitizeFirestoreId(ujianId)), {
      judul: judulBaru,
      durasi: parseInt(durasiBaru, 10) || durasiBaru,
      token: tokenBaru,
      updatedAt: serverTimestamp()
    });
    alert("Ujian dan token berhasil diperbarui!");
    const modalEl = document.getElementById("modalEditUjian");
    if (modalEl && window.bootstrap) {
      bootstrap.Modal.getOrCreateInstance(modalEl)?.hide();
    }
    await muatUjianFirestore(true);
  } catch (error) {
    alert("Gagal memperbarui ujian: " + error.message);
  }
};

window.paksaSelesaiPeserta = async (ujianId, nisn) => {
  if (!confirm(`Yakin ingin memaksa selesai ujian siswa dengan NISN ${nisn}?`)) return;
  try {
    const statusDocRef = doc(firestoreDb, "status_peserta", getStatusPesertaDocId(ujianId, nisn));
    await setDoc(statusDocRef, {
      ujianId,
      nisn: String(nisn),
      status: "selesai",
      dipaksaSelesaiPada: new Date().toISOString(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    removeSessionCache(`cbt_monitoring_${sanitizeFirestoreId(ujianId)}`);
    await window.loadDataMonitoring(true);
    alert("Peserta berhasil ditandai selesai.");
  } catch (error) {
    alert("Gagal memaksa selesai peserta: " + error.message);
  }
};

window.resetStatusPeserta = async (ujianId, nisn) => {
  if (!confirm(`Yakin ingin mereset awal status siswa dengan NISN ${nisn}? Siswa akan dapat memulai ulang dari awal.`)) return;
  try {
    await Promise.all([
      deleteDoc(doc(firestoreDb, "jawaban_siswa", `${sanitizeFirestoreId(nisn)}_${sanitizeFirestoreId(ujianId)}`)).catch(() => {}),
      deleteDoc(doc(firestoreDb, "status_peserta", getStatusPesertaDocId(ujianId, nisn))).catch(() => {})
    ]);
    removeSessionCache(`cbt_monitoring_${sanitizeFirestoreId(ujianId)}`);
    await window.loadDataMonitoring(true);
    alert("Status peserta berhasil direset awal! Siswa kini dapat masuk kembali menggunakan token ujian.");
  } catch (error) {
    alert("Gagal mereset status: " + error.message);
  }
};

let dataMonitoringPeserta = [];
let nisnTerpilihMonitoring = new Set();

function sinkronkanTombolMassalMonitoring() {
  const jumlah = nisnTerpilihMonitoring.size;
  const infoEl = document.getElementById("infoPesertaTerpilih");
  const btnPaksa = document.getElementById("btnMassalPaksaSelesai");
  const btnReset = document.getElementById("btnMassalResetAwal");
  const checkAll = document.getElementById("checkSemuaMonitoring");

  if (infoEl) infoEl.innerText = `${jumlah} Dipilih`;
  if (btnPaksa) btnPaksa.disabled = sedangProsesMassalMonitoring || jumlah === 0;
  if (btnReset) btnReset.disabled = sedangProsesMassalMonitoring || jumlah === 0;

  const visibleCheckboxes = Array.from(document.querySelectorAll(".check-peserta-monitoring"));
  if (checkAll) {
    if (visibleCheckboxes.length === 0) {
      checkAll.checked = false;
      checkAll.indeterminate = false;
    } else {
      const checkedCount = visibleCheckboxes.filter(cb => cb.checked).length;
      checkAll.checked = checkedCount === visibleCheckboxes.length;
      checkAll.indeterminate = checkedCount > 0 && checkedCount < visibleCheckboxes.length;
    }
  }
}

window.togglePilihSemuaMonitoring = (checked) => {
  document.querySelectorAll(".check-peserta-monitoring").forEach(cb => {
    cb.checked = checked;
    const nisn = cb.getAttribute("data-nisn");
    if (nisn) {
      if (checked) nisnTerpilihMonitoring.add(nisn);
      else nisnTerpilihMonitoring.delete(nisn);
    }
  });
  sinkronkanTombolMassalMonitoring();
};

window.togglePilihSatuMonitoring = (nisn, checked) => {
  if (!nisn) return;
  if (checked) nisnTerpilihMonitoring.add(nisn);
  else nisnTerpilihMonitoring.delete(nisn);
  sinkronkanTombolMassalMonitoring();
};

window.filterTabelMonitoring = () => {
  const tbody = document.getElementById("tabelMonitoringBody");
  const ujianId = document.getElementById("selectUjianMonitoring")?.value || "";
  if (!tbody) return;

  if (!ujianId) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">Silakan pilih jadwal ujian terlebih dahulu di atas.</td></tr>`;
    sinkronkanTombolMassalMonitoring();
    return;
  }

  const keyword = (document.getElementById("searchMonitoring")?.value || "").toLowerCase().trim();
  const statusFilter = (document.getElementById("filterStatusMonitoring")?.value || "").toLowerCase().trim();

  const filtered = dataMonitoringPeserta.filter(item => {
    const nisn = String(item.nisn || "").toLowerCase();
    const nama = String(item.nama || "").toLowerCase();
    const kelas = String(item.kelas || "").toLowerCase();
    const statusRaw = String(item.status || "").toLowerCase().trim();
    const sinyal = String(item.sinyal || item.keterangan || "").toLowerCase();

    const cocokKata = !keyword || (
      nisn.includes(keyword) ||
      nama.includes(keyword) ||
      kelas.includes(keyword) ||
      statusRaw.includes(keyword) ||
      sinyal.includes(keyword)
    );

    let cocokStatus = true;
    if (statusFilter === "mengerjakan") {
      cocokStatus = statusRaw === "sedang_mengerjakan" || statusRaw === "mengerjakan" || statusRaw === "aktif";
    } else if (statusFilter === "pelanggaran") {
      cocokStatus =
        statusRaw === "terlempar" ||
        statusRaw === "pelanggaran" ||
        statusRaw.includes("terlempar") ||
        statusRaw.includes("pelanggaran") ||
        statusRaw.includes("lock") ||
        sinyal.includes("pelanggaran") ||
        sinyal.includes("terlempar");
    } else if (statusFilter === "selesai") {
      cocokStatus = statusRaw === "selesai";
    }

    return cocokKata && cocokStatus;
  });

  tbody.innerHTML = "";
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">Tidak ada peserta yang cocok dengan filter/pencarian.</td></tr>`;
    sinkronkanTombolMassalMonitoring();
    return;
  }

  const safeUjianId = escapeHtml(ujianId);

  filtered.forEach((s, idx) => {
    const nisn = s.nisn;
    const safeNisn = escapeHtml(nisn);
    const isChecked = nisnTerpilihMonitoring.has(nisn);

    let badgeStatus = "";
    if (s.status === "sedang_mengerjakan") {
      badgeStatus = `<span class="badge bg-warning text-dark"><i class="bi bi-clock-history me-1"></i>Sedang Mengerjakan</span>`;
    } else if (s.status === "terlempar") {
      badgeStatus = `<span class="badge bg-danger"><i class="bi bi-exclamation-triangle-fill me-1"></i>Terlempar / Terkunci</span>`;
    } else if (s.status === "selesai") {
      badgeStatus = `<span class="badge bg-success"><i class="bi bi-check-circle-fill me-1"></i>Selesai</span>`;
    } else {
      badgeStatus = `<span class="badge bg-secondary">${escapeHtml(s.status || "-")}</span>`;
    }

    const sinyalInfo = s.sinyal || s.keterangan || "-";

    const tombolAksi = `
      <div class="btn-group btn-group-sm" role="group">
        <button class="btn btn-warning text-dark fw-bold" onclick="paksaSelesaiPeserta('${safeUjianId}', '${safeNisn}')">
          <i class="bi bi-check2-square me-1"></i>Paksa Selesai
        </button>
        <button class="btn btn-danger fw-bold" onclick="resetStatusPeserta('${safeUjianId}', '${safeNisn}')">
          <i class="bi bi-arrow-clockwise me-1"></i>Reset Awal
        </button>
      </div>
    `;

    tbody.innerHTML += `
      <tr>
        <td class="text-center">
          <input type="checkbox" class="form-check-input check-peserta-monitoring" data-nisn="${safeNisn}" ${isChecked ? "checked" : ""} onchange="togglePilihSatuMonitoring('${safeNisn}', this.checked)">
        </td>
        <td>${idx + 1}</td>
        <td>${escapeHtml(s.nisn || nisn)}</td>
        <td class="fw-bold">${escapeHtml(s.nama || "-")}</td>
        <td>${escapeHtml(s.kelas || "-")}</td>
        <td>${badgeStatus} <div class="small text-muted mt-1">${escapeHtml(sinyalInfo)}</div></td>
        <td>${escapeHtml(s.waktuMulai || "-")}</td>
        <td class="text-center">${tombolAksi}</td>
      </tr>
    `;
  });

  sinkronkanTombolMassalMonitoring();
};

window.aksiMassalMonitoring = async (mode) => {
  if (sedangProsesMassalMonitoring) return;

  const ujianId = document.getElementById("selectUjianMonitoring")?.value || "";
  if (!ujianId) {
    alert("Pilih jadwal ujian terlebih dahulu!");
    return;
  }

  const daftarNisn = Array.from(nisnTerpilihMonitoring);
  if (daftarNisn.length === 0) {
    alert("Pilih minimal satu peserta terlebih dahulu!");
    return;
  }

  const labelMode = mode === "paksa_selesai" ? "MEMAKSA SELESAI" : "MERESET AWAL";
  if (!window.confirm(`Yakin ingin ${labelMode} ${daftarNisn.length} peserta terpilih?`)) return;

  sedangProsesMassalMonitoring = true;
  sinkronkanTombolMassalMonitoring();

  try {
    const waktuSekarang = new Date().toISOString();
    const CHUNK_SIZE = 200;

    for (let i = 0; i < daftarNisn.length; i += CHUNK_SIZE) {
      const chunk = daftarNisn.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(firestoreDb);

      chunk.forEach((nisn) => {
        const cleanNisn = sanitizeFirestoreId(nisn);
        if (!cleanNisn) return;

        const statusDocRef = doc(firestoreDb, "status_peserta", getStatusPesertaDocId(ujianId, nisn));
        if (mode === "paksa_selesai") {
          batch.set(statusDocRef, {
            ujianId,
            nisn: String(nisn),
            status: "selesai",
            dipaksaSelesaiPada: waktuSekarang,
            updatedAt: serverTimestamp()
          }, { merge: true });
        } else if (mode === "reset_awal") {
          batch.delete(statusDocRef);
          batch.delete(doc(firestoreDb, "jawaban_siswa", `${cleanNisn}_${sanitizeFirestoreId(ujianId)}`));
        }
      });

      await batch.commit();
    }

    nisnTerpilihMonitoring.clear();
    const checkAll = document.getElementById("checkSemuaMonitoring");
    if (checkAll) {
      checkAll.checked = false;
      checkAll.indeterminate = false;
    }

    removeSessionCache(`cbt_monitoring_${sanitizeFirestoreId(ujianId)}`);
    await window.loadDataMonitoring(true);

    requestAnimationFrame(() => {
      setTimeout(() => {
        window.alert(`Berhasil memproses ${daftarNisn.length} peserta.`);
      }, 30);
    });
  } catch (err) {
    console.error("Gagal aksi massal monitoring:", err);
    window.alert("Gagal memproses aksi massal: " + err.message);
  } finally {
    sedangProsesMassalMonitoring = false;
    sinkronkanTombolMassalMonitoring();
  }
};

window.filterOpsiUjianMonitoring = () => {
  const inputCari = document.getElementById("cariUjianMonitoring");
  const selectUjian = document.getElementById("selectUjianMonitoring");
  if (!selectUjian) return;

  const keyword = (inputCari?.value || "").toLowerCase().trim();
  const prevVal = selectUjian.value;
  const sumberUjian = Array.isArray(window.daftarUjianMonitoringAktif)
    ? window.daftarUjianMonitoringAktif
    : (Array.isArray(window.daftarUjian)
        ? window.daftarUjian.filter(u => String(u?.status || "").toLowerCase() === "aktif")
        : []);
  const seenIds = new Set();

  const ujianValid = sumberUjian
    .filter(u => {
      if (!u || !u.id || !(u.judul || u.mapel)) return false;
      if (String(u.status || "").toLowerCase() !== "aktif") return false;
      if (seenIds.has(u.id)) return false;
      seenIds.add(u.id);
      return true;
    })
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const cocok = ujianValid.filter(ujian => {
    if (!keyword) return true;
    const kelasStr = Array.isArray(ujian.kelasTarget)
      ? ujian.kelasTarget.join(" ")
      : (ujian.kelasTarget || "");
    const gabungan = `${ujian.mapel || ""} ${ujian.judul || ""} ${ujian.token || ""} ${kelasStr}`.toLowerCase();
    return gabungan.includes(keyword);
  });

  selectUjian.innerHTML = `<option value="">-- Pilih Mata Pelajaran / Ujian Aktif (${cocok.length}) --</option>`;
  cocok.forEach(ujian => {
    const opt = document.createElement("option");
    opt.value = ujian.id;
    opt.textContent = `${ujian.mapel || "Mapel"} - ${ujian.judul || "Ujian"} (Token: ${ujian.token || "-"})`;
    selectUjian.appendChild(opt);
  });

  if (prevVal && cocok.some(u => u.id === prevVal)) {
    selectUjian.value = prevVal;
  } else if (!prevVal) {
    selectUjian.value = "";
  }
};

window.loadDaftarUjianMonitoring = () => {
  const selectUjian = document.getElementById("selectUjianMonitoring");
  if (!selectUjian) return;

  const prevVal = selectUjian.value;
  const sumberUjian = Array.isArray(window.daftarUjian) ? window.daftarUjian : [];
  const ujianAktifSaja = sumberUjian.filter(
    u => u && u.id && (u.judul || u.mapel) && String(u.status || "").toLowerCase() === "aktif"
  );
  window.daftarUjianMonitoringAktif = ujianAktifSaja;

  const validIds = new Set(ujianAktifSaja.map(u => u.id));

  window.filterOpsiUjianMonitoring();

  if (prevVal && validIds.has(prevVal)) {
    selectUjian.value = prevVal;
  } else {
    selectUjian.value = "";
    if (typeof unsubMonitoring === "function") {
      unsubMonitoring();
      unsubMonitoring = null;
    }
    nisnTerpilihMonitoring.clear();
    dataMonitoringPeserta = [];
    const tbody = document.getElementById("tabelMonitoringBody");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">Silakan pilih jadwal ujian aktif terlebih dahulu di atas.</td></tr>`;
    }
    sinkronkanTombolMassalMonitoring();
  }
};

window.loadDataMonitoring = async (forceReload = false) => {
  if (typeof unsubMonitoring === "function") {
    unsubMonitoring();
    unsubMonitoring = null;
  }
  const currentSession = window.userSession || (typeof userSession !== "undefined" ? userSession : {}) || {};
  if (currentSession.role === "guru" && window.modeUjianAktif) {
    terapkanStatusModeUjianUI(true);
    return [];
  }

  nisnTerpilihMonitoring.clear();
  dataMonitoringPeserta = [];

  const ujianId = String(document.getElementById("selectUjianMonitoring")?.value || "").trim();
  const tbody = document.getElementById("tabelMonitoringBody");

  if (!ujianId) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">Silakan pilih jadwal ujian terlebih dahulu lalu klik Refresh.</td></tr>`;
    }
    sinkronkanTombolMassalMonitoring();
    return [];
  }

  const session = window.userSession || (typeof userSession !== "undefined" ? userSession : {}) || {};
  const isGuru = session && session.role === "guru";
  const ujianTerpilih = (window.daftarUjian || []).find(u => u.id === ujianId);
  const detailGuru = isGuru ? normalisasiDetailAmpuan(session) : {};
  const mapelUjianKey = isGuru && ujianTerpilih
    ? Object.keys(detailGuru).find(mk => mk.toLowerCase().trim() === (ujianTerpilih.mapel || "").toLowerCase().trim())
    : "";
  const kelasAmpuanMapelIni = mapelUjianKey && Array.isArray(detailGuru[mapelUjianKey]) && detailGuru[mapelUjianKey].length > 0
    ? detailGuru[mapelUjianKey]
    : getKelasDiampuGuru(session);

  const cacheKey = `cbt_monitoring_${sanitizeFirestoreId(ujianId)}`;
  let rawPeserta = null;

  if (!forceReload) {
    rawPeserta = readSessionCache(cacheKey);
  }

  if (!Array.isArray(rawPeserta)) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-3">Memuat data monitoring...</td></tr>`;
    }

    try {
      const qMonitoring = query(collection(firestoreDb, "status_peserta"), where("ujianId", "==", ujianId));
      const snapshot = await getDocs(qMonitoring);
      rawPeserta = [];
      snapshot.forEach((docSnap) => {
        const s = docSnap.data() || {};
        const nisn = String(s.nisn || docSnap.id.split("__")[1] || "").trim();
        rawPeserta.push({
          ...s,
          nisn
        });
      });
      writeSessionCache(cacheKey, rawPeserta);
    } catch (err) {
      console.error("Query monitoring Firestore error:", err);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-3">Gagal memuat data monitoring.</td></tr>`;
      }
      sinkronkanTombolMassalMonitoring();
      return [];
    }
  }

  if (rawPeserta.length === 0) {
    dataMonitoringPeserta = [];
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">Belum ada siswa yang login/mengerjakan ujian ini.</td></tr>`;
    }
    sinkronkanTombolMassalMonitoring();
    return [];
  }

  const listPeserta = rawPeserta.filter((s) => {
    if (isGuru && kelasAmpuanMapelIni.length > 0) {
      const kelasPeserta = String(s.kelas || "").trim().toLowerCase();
      return kelasAmpuanMapelIni.some(k => String(k).trim().toLowerCase() === kelasPeserta);
    }
    return true;
  });

  const nisnAktifSet = new Set(listPeserta.map(p => p.nisn));
  Array.from(nisnTerpilihMonitoring).forEach(n => {
    if (!nisnAktifSet.has(n)) nisnTerpilihMonitoring.delete(n);
  });

  dataMonitoringPeserta = listPeserta;

  if (dataMonitoringPeserta.length === 0) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">Belum ada siswa dari kelas ampu Anda yang mengerjakan ujian ini.</td></tr>`;
    }
    sinkronkanTombolMassalMonitoring();
    return [];
  }

  window.filterTabelMonitoring();
  return dataMonitoringPeserta;
};

window.refreshMonitoringManual = async () => {
  return await window.loadDataMonitoring(true);
};

window.hapusHasilUjian = async (resultId) => {
  if (!confirm("Apakah Anda yakin ingin menghapus data hasil ujian siswa ini?")) return;
  try {
    await hapusSatuRekapInternal(resultId);
    rekapTerpilihIds.delete(resultId);
    hasilUjian = hasilUjian.filter(item => item.id !== resultId);
    window.hasilUjian = hasilUjian;
    window.filterRekapNilai();
    alert("Data hasil ujian berhasil dihapus.");
  } catch (error) {
    console.error("Gagal menghapus data:", error);
    alert("Terjadi kesalahan saat menghapus data.");
  }
};

window.downloadRekapNilaiPerKelas = (kelasFilter, ujianIdFilter) => {
  if (!hasilUjian || hasilUjian.length === 0) return alert("Belum ada data nilai!");

  const dataFiltered = hasilUjian.filter(item => {
    let matchKelas = true, matchUjian = true;
    if (kelasFilter) matchKelas = (item.kelas && item.kelas.trim().toLowerCase() === kelasFilter.trim().toLowerCase());
    if (ujianIdFilter) matchUjian = (item.ujianId === ujianIdFilter || item.kodeUjian === ujianIdFilter || item.judul === ujianIdFilter || item.mapel === ujianIdFilter);
    return matchKelas && matchUjian;
  });

  if (dataFiltered.length === 0) return alert("Data nilai tidak ditemukan untuk filter tersebut!");

  try {
    const excelData = dataFiltered.map((item, index) => ({
      "No": index + 1,
      "NISN": sanitasiSelExcel(item.nisn, 100),
      "Nama Siswa": sanitasiSelExcel(item.nama, 500),
      "Kelas": sanitasiSelExcel(item.kelas || "-", 100),
      "Mata Pelajaran": sanitasiSelExcel(item.mapel, 250),
      "Judul Ujian": sanitasiSelExcel(item.judul, 500),
      "Nilai": Number(item.nilai) || 0,
      "Waktu Selesai": sanitasiSelExcel(item.waktuSelesai || "-", 200)
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Nilai");
    const safeKelasFile = String(kelasFilter || "Semua").replace(/[^a-zA-Z0-9_-]/g, "_");
    XLSX.writeFile(wb, `Rekap_Nilai_CBT_${safeKelasFile}.xlsx`);
  } catch (err) {
    console.error("Gagal export rekap nilai:", err);
    alert("Gagal mengunduh rekap nilai: " + err.message);
  }
};

window.updateFilterUjianDropdown = function() {
  const selectUjian = document.getElementById("selectFilterUjian");
  if (!selectUjian) return;

  const currVal = selectUjian.value;
  selectUjian.innerHTML = '<option value="">-- Pilih Mata Pelajaran / Ujian --</option>';
  const sumberUjian = window.daftarUjian || [];

  sumberUjian.forEach(ujian => {
    const namaUjian = ujian.judul || ujian.mapel;
    if (namaUjian) {
      const opt = document.createElement("option");
      opt.value = ujian.id;
      opt.textContent = `${ujian.mapel || ""} - ${ujian.judul || ""}`;
      selectUjian.appendChild(opt);
    }
  });
  selectUjian.value = currVal;
};
/* ===================================================
   MODUL BACKUP & RESTORE JSON (ALL COLLECTIONS + PER MENU)
   =================================================== */
const BACKUP_KOLEKSI_LIST = [
  "siswa",
  "guru",
  "ujian",
  "soal",
  "status_peserta",
  "jawaban_siswa"
];

function _tentukanDocIdBackup(koleksi, item) {
  if (item && typeof item._docId === "string" && item._docId.trim()) {
    return sanitizeFirestoreId(item._docId);
  }
  if (item && typeof item.id === "string" && item.id.trim()) {
    return sanitizeFirestoreId(item.id);
  }
  if (item && typeof item.uid === "string" && item.uid.trim()) {
    return sanitizeFirestoreId(item.uid);
  }

  switch (koleksi) {
    case "siswa":
      return sanitizeFirestoreId(item?.nisn);
    case "guru":
      return sanitizeFirestoreId(item?.uid || item?.email || item?.nama);
    case "ujian":
      return sanitizeFirestoreId(item?.ujianId || item?.kodeUjian || item?.judul);
    case "soal":
      return sanitizeFirestoreId(item?.ujianId || item?.kodeUjian || item?.idUjian);
    case "status_peserta":
      return getStatusPesertaDocId(item?.ujianId || item?.kodeUjian || "", item?.nisn || "");
    case "jawaban_siswa":
      return `${sanitizeFirestoreId(item?.nisn || "")}_${sanitizeFirestoreId(item?.ujianId || item?.kodeUjian || "")}`;
    default:
      return sanitizeFirestoreId(`${koleksi}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  }
}

function _bersihkanFieldBackup(item) {
  const salinan = { ...(item || {}) };
  delete salinan._docId;
  delete salinan.id;
  if (salinan.importedAt && typeof salinan.importedAt === "object" && typeof salinan.importedAt.toDate === "function") {
    salinan.importedAt = salinan.importedAt.toDate().toISOString();
  }
  if (salinan.updatedAt && typeof salinan.updatedAt === "object" && typeof salinan.updatedAt.toDate === "function") {
    salinan.updatedAt = salinan.updatedAt.toDate().toISOString();
  }
  return JSON.parse(JSON.stringify(salinan));
}

function _unduhJsonFile(namaFile, payloadObj) {
  const jsonText = JSON.stringify(payloadObj, null, 2);
  const blob = new Blob([jsonText], { type: "application/json;charset=utf-8" });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = namaFile.endsWith(".json") ? namaFile : `${namaFile}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
}

function _bacaJsonFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("Tidak ada file yang dipilih."));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || ""));
        resolve(parsed);
      } catch (err) {
        reject(new Error(`File JSON tidak valid: ${err.message}`));
      }
    };
    reader.onerror = () => reject(new Error("Gagal membaca file JSON."));
    reader.readAsText(file, "utf-8");
  });
}

async function _ambilRecordsKoleksiBackup(koleksi) {
  if (koleksi === "guru") {
    const qGuru = query(collection(firestoreDb, "pengguna"), where("role", "==", "guru"));
    const snapGuru = await getDocs(qGuru);
    return snapGuru.docs.map((d) => ({
      id: d.id,
      _docId: d.id,
      ...(d.data() || {})
    }));
  }

  const snap = await getDocs(collection(firestoreDb, koleksi));
  return snap.docs.map((d) => ({
    id: d.id,
    _docId: d.id,
    ...(d.data() || {})
  }));
}

async function _tulisRecordsKoleksiBackup(koleksi, records) {
  if (!Array.isArray(records)) {
    throw new Error(`Format data untuk "${koleksi}" harus berupa array.`);
  }

  const targetFsCollection = koleksi === "guru" ? "pengguna" : koleksi;
  let totalTulis = 0;
  const BATCH_LIMIT = 400;

  for (let i = 0; i < records.length; i += BATCH_LIMIT) {
    const chunk = records.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(firestoreDb);

    for (const rawItem of chunk) {
      if (!rawItem || typeof rawItem !== "object") continue;
      const docId = _tentukanDocIdBackup(koleksi, rawItem);
      const bersih = _bersihkanFieldBackup(rawItem);
      if (koleksi === "guru" && !bersih.role) {
        bersih.role = "guru";
      }
      if (koleksi === "soal" && Array.isArray(bersih.daftarSoal)) {
        bersih.daftarSoal = normalisasiArraySoal(bersih.daftarSoal);
        bersih.totalSoal = bersih.daftarSoal.length;
      }

      const ref = doc(firestoreDb, targetFsCollection, docId);
      batch.set(
        ref,
        {
          ...bersih,
          importedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
      totalTulis++;
    }

    if (totalTulis > 0) {
      await batch.commit();
    }
  }

  return totalTulis;
}

async function _sinkronkanSetelahImport(koleksiOrAll) {
  clearMasterCache();
  lastLoadedRekapUjianId = null;

  if (koleksiOrAll === "ALL" || koleksiOrAll === "siswa") {
    const kelasAktif = document.getElementById("filterKelasSiswa")?.value.trim() || "";
    if (kelasAktif) {
      await muatSiswaFirestore(kelasAktif, true);
    } else if (typeof window.filterDataSiswa === "function") {
      await window.filterDataSiswa(true);
    }
  }

  if (koleksiOrAll === "ALL" || koleksiOrAll === "guru") {
    await muatPenggunaFirestore(true);
  }

  if (koleksiOrAll === "ALL" || koleksiOrAll === "ujian" || koleksiOrAll === "soal") {
    await muatUjianFirestore(true);
  }

  if (koleksiOrAll === "ALL" || koleksiOrAll === "jawaban_siswa") {
    const ujianFilter = document.getElementById("selectFilterUjian")?.value || "";
    if (ujianFilter) {
      await muatHasilUjianSekali(ujianFilter, true);
    }
  }

  if (koleksiOrAll === "ALL" || koleksiOrAll === "status_peserta") {
    const ujianMon = document.getElementById("selectUjianMonitoring")?.value || "";
    if (ujianMon && typeof window.loadDataMonitoring === "function") {
      await window.loadDataMonitoring(true);
    }
  }
}

window.exportKoleksiJson = async function (koleksi) {
  const namaKoleksi = String(koleksi || "").trim().toLowerCase();
  if (!BACKUP_KOLEKSI_LIST.includes(namaKoleksi)) {
    alert(`Koleksi "${namaKoleksi}" tidak dikenali.`);
    return null;
  }

  try {
    const records = await _ambilRecordsKoleksiBackup(namaKoleksi);
    const tanggal = new Date().toISOString().slice(0, 10);
    const namaFile = `backup_${namaKoleksi}_${tanggal}.json`;
    _unduhJsonFile(namaFile, {
      app: "CBT-SMAN-1-TARAJU",
      version: 1,
      koleksi: namaKoleksi,
      exportedAt: new Date().toISOString(),
      total: records.length,
      data: records
    });
    alert(`Berhasil mengunduh backup ${namaKoleksi} (${records.length} data).`);
    return { koleksi: namaKoleksi, total: records.length, namaFile };
  } catch (err) {
    console.error(`Gagal export ${namaKoleksi}:`, err);
    alert(`Gagal mengunduh backup ${namaKoleksi}: ${err.message}`);
    return null;
  }
};

window.importKoleksiJsonFile = async function (koleksi, file) {
  const namaKoleksi = String(koleksi || "").trim().toLowerCase();
  if (!BACKUP_KOLEKSI_LIST.includes(namaKoleksi)) {
    alert(`Koleksi "${namaKoleksi}" tidak dikenali.`);
    return null;
  }

  try {
    const parsed = await _bacaJsonFile(file);
    let records = [];
    if (Array.isArray(parsed)) {
      records = parsed;
    } else if (parsed && Array.isArray(parsed.data)) {
      records = parsed.data;
    } else if (parsed && parsed.collections && Array.isArray(parsed.collections[namaKoleksi])) {
      records = parsed.collections[namaKoleksi];
    } else {
      throw new Error("Struktur isi JSON tidak sesuai untuk koleksi ini.");
    }

    const jumlah = await _tulisRecordsKoleksiBackup(namaKoleksi, records);
    await _sinkronkanSetelahImport(namaKoleksi);
    alert(`Berhasil mengimpor ${jumlah} data ke koleksi "${namaKoleksi}".`);
    return { koleksi: namaKoleksi, jumlah };
  } catch (err) {
    console.error(`Gagal import ${namaKoleksi}:`, err);
    alert(`Gagal mengimpor ${namaKoleksi}: ${err.message}`);
    return null;
  }
};

window.exportSemuaKoleksiJson = async function () {
  try {
    const tanggal = new Date().toISOString().slice(0, 10);
    const collectionsObj = {};
    const ringkasan = {};

    for (const koleksi of BACKUP_KOLEKSI_LIST) {
      const records = await _ambilRecordsKoleksiBackup(koleksi);
      collectionsObj[koleksi] = records;
      ringkasan[koleksi] = records.length;
    }

    const namaFile = `backup_full_cbt_${tanggal}.json`;
    _unduhJsonFile(namaFile, {
      app: "CBT-SMAN-1-TARAJU",
      version: 1,
      backupType: "FULL_DATABASE",
      exportedAt: new Date().toISOString(),
      ringkasan,
      collections: collectionsObj
    });

    alert("Berhasil mengunduh file backup lengkap seluruh menu CBT.");
    return { namaFile, ringkasan };
  } catch (err) {
    console.error("Gagal export semua koleksi:", err);
    alert(`Gagal mengunduh backup lengkap: ${err.message}`);
    return null;
  }
};

window.importSemuaKoleksiJsonFile = async function (file) {
  try {
    const parsed = await _bacaJsonFile(file);
    const sumber = parsed?.collections || parsed;
    if (!sumber || typeof sumber !== "object") {
      throw new Error("Format file backup lengkap tidak valid.");
    }

    const urutanAman = ["siswa", "guru", "ujian", "soal", "status_peserta", "jawaban_siswa"];
    const hasil = {};

    for (const koleksi of urutanAman) {
      if (Array.isArray(sumber[koleksi])) {
        hasil[koleksi] = await _tulisRecordsKoleksiBackup(koleksi, sumber[koleksi]);
      }
    }

    await _sinkronkanSetelahImport("ALL");
    alert("Berhasil memulihkan (import) seluruh data backup ke Firestore.");
    return hasil;
  } catch (err) {
    console.error("Gagal import semua koleksi:", err);
    alert(`Gagal mengimpor backup lengkap: ${err.message}`);
    return null;
  }
};

window.picuImportJsonMenu = function (koleksiTarget) {
  const target = String(koleksiTarget || "ALL").trim();
  const inputFile = document.createElement("input");
  inputFile.type = "file";
  inputFile.accept = ".json,application/json";
  inputFile.style.display = "none";

  inputFile.addEventListener("change", async () => {
    const file = inputFile.files && inputFile.files[0];
    inputFile.remove();
    if (!file) return;

    if (target.toUpperCase() === "ALL") {
      await window.importSemuaKoleksiJsonFile(file);
    } else {
      await window.importKoleksiJsonFile(target, file);
    }
  });

  document.body.appendChild(inputFile);
  inputFile.click();
};
