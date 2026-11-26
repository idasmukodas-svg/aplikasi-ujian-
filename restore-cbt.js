const fs = require("fs");
const admin = require("firebase-admin");

const serviceAccount = require("./serviceAccountKey.json");
const backup = JSON.parse(fs.readFileSync("./backup-bersih.json", "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const BATCH_SIZE = 400;

const toKelasTargetArray = (val) => {
  if (!val) return [];
  return Array.isArray(val) ? val.map((v) => String(v).trim()).filter(Boolean) : [String(val).trim()];
};

const sanitizeId = (id, fallback) => {
  const clean = String(id ?? fallback ?? "").trim().replace(/\//g, "_");
  return clean || fallback;
};

async function writeInBatches(collectionName, entries) {
  let count = 0;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const slice = entries.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const { docId, data } of slice) {
      const ref = db.collection(collectionName).doc(docId);
      batch.set(ref, data, { merge: true });
    }

    await batch.commit();
    count += slice.length;
  }
  console.log(`[${collectionName}] Tersimpan ${count} dokumen.`);
}

async function restoreAll() {
  // 1. daftarKelas
  const kelasEntries = [];
  const rawKelas = backup.daftarKelas || {};
  if (Array.isArray(rawKelas)) {
    rawKelas.forEach((item, idx) => {
      if (!item) return;
      const nama = typeof item === "string" ? item : (item.nama || item.kode || `Kelas ${idx + 1}`);
      const docId = sanitizeId(typeof item === "string" ? item : (item.id || item.kode || nama), `kelas_${idx + 1}`);
      kelasEntries.push({
        docId,
        data: typeof item === "object" ? { ...item, nama } : { id: docId, nama },
      });
    });
  } else {
    Object.entries(rawKelas).forEach(([key, val]) => {
      const docId = sanitizeId(key, "kelas");
      kelasEntries.push({
        docId,
        data: typeof val === "object" && val !== null ? { ...val, id: val.id || docId } : { id: docId, nama: String(val) },
      });
    });
  }

  // 2. daftarMapel
  const mapelEntries = [];
  const rawMapel = backup.daftarMapel || {};
  if (Array.isArray(rawMapel)) {
    rawMapel.forEach((item, idx) => {
      if (!item) return;
      const nama = typeof item === "string" ? item : (item.nama || item.mapel || `Mapel ${idx + 1}`);
      const docId = sanitizeId(typeof item === "string" ? item : (item.id || item.kode || nama), `mapel_${idx + 1}`);
      mapelEntries.push({
        docId,
        data: typeof item === "object" ? { ...item, nama } : { id: docId, nama },
      });
    });
  } else {
    Object.entries(rawMapel).forEach(([key, val]) => {
      const docId = sanitizeId(key, "mapel");
      mapelEntries.push({
        docId,
        data: typeof val === "object" && val !== null ? { ...val, id: val.id || docId } : { id: docId, nama: String(val) },
      });
    });
  }

  // 3. daftarSiswa (lewati NISN uji coba 0000000001 - 0000000010)
  const siswaEntries = [];
  const rawSiswa = backup.daftarSiswa || {};
  const dummySet = new Set(Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(10, "0")));

  Object.entries(rawSiswa).forEach(([key, s]) => {
    if (!s || typeof s !== "object") return;
    const nisn = String(s.nisn || key).trim();
    if (!nisn || dummySet.has(nisn)) return;
    const docId = sanitizeId(nisn, key);
    siswaEntries.push({
      docId,
      data: {
        ...s,
        nisn,
        nama: String(s.nama || "").trim(),
        kelas: String(s.kelas || "").trim(),
      },
    });
  });

  // 4. daftarUjian
  const ujianEntries = [];
  const rawUjian = backup.daftarUjian || {};
  Object.entries(rawUjian).forEach(([key, u]) => {
    if (!u || typeof u !== "object") return;
    const docId = sanitizeId(u.id || key, key);
    ujianEntries.push({
      docId,
      data: {
        ...u,
        id: docId,
        kelasTarget: toKelasTargetArray(u.kelasTarget),
        soal: Array.isArray(u.soal) ? u.soal : [],
      },
    });
  });

  await writeInBatches("daftarKelas", kelasEntries);
  await writeInBatches("daftarMapel", mapelEntries);
  await writeInBatches("daftarSiswa", siswaEntries);
  await writeInBatches("daftarUjian", ujianEntries);
  console.log("Pemulihan 4 koleksi utama selesai.");
}

restoreAll().catch((err) => {
  console.error("Error saat restore:", err);
  process.exit(1);
});
