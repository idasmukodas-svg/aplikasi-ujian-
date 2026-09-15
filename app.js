/* ===================================================
   APP.JS - LMS & CBT INFORMATIKA (FIREBASE INTEGRATED)
   =================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBCWVQE9zWCgGJy_MYp47U4dp-gDsWFRE8",
  authDomain: "aplikasi-ujian-8e501.firebaseapp.com",
  databaseURL: "https://aplikasi-ujian-8e501-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "aplikasi-ujian-8e501",
  storageBucket: "aplikasi-ujian-8e501.firebasestorage.app",
  messagingSenderId: "945781407027",
  appId: "1:945781407027:web:4672d4c894e143c9b05246",
  measurementId: "G-CBH4C0BVXD"
};

// --- INISIALISASI FIREBASE ---
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Variabel penampung data lokal di memori
let daftarUjian = [];
let daftarSiswa = [];
let hasilUjian = [];
let activeUjianId = null;

// --- SINKRONISASI REALTIME DARI FIREBASE ---
document.addEventListener("DOMContentLoaded", () => {
  // Listen Data Ujian
  onValue(ref(db, "daftarUjian"), (snapshot) => {
    const data = snapshot.val();
    daftarUjian = data ? Object.values(data) : [];
    renderStats();
    renderTabelUjian();
    updateFilterUjianDropdown();
  });

  // Listen Data Siswa
  onValue(ref(db, "daftarSiswa"), (snapshot) => {
    const data = snapshot.val();
    daftarSiswa = data ? Object.values(data) : [];
    renderStats();
    renderTabelSiswa();
  });

  // Listen Hasil Ujian
  onValue(ref(db, "hasilUjian"), (snapshot) => {
    const data = snapshot.val();
    hasilUjian = data ? Object.values(data) : [];
    renderTabelNilai();
  });

  // Event Listener Forms & Inputs
  const formUjian = document.getElementById("formUjian");
  if (formUjian) formUjian.addEventListener("submit", handleSimpanUjian);

  const formSoal = document.getElementById("formTambahSoal");
  if (formSoal) formSoal.addEventListener("submit", handleTambahSoal);

  const formSiswa = document.getElementById("formSiswa");
  if (formSiswa) formSiswa.addEventListener("submit", handleSimpanSiswa);

  const fileInputSiswa = document.getElementById("fileExcelSiswa");
  if (fileInputSiswa) fileInputSiswa.addEventListener("change", importSiswaExcel);

  const fileInputSoal = document.getElementById("fileExcelSoal");
  if (fileInputSoal) fileInputSoal.addEventListener("change", importExcelSoal);
});

// --- HELPER UNTUK SIMPAN DATA KE FIREBASE ---
function simpanDataUjian() {
  const dataObj = {};
  daftarUjian.forEach(u => dataObj[u.id] = u);
  set(ref(db, "daftarUjian"), dataObj);
}

function simpanDataSiswa() {
  const dataObj = {};
  daftarSiswa.forEach(s => dataObj[s.nisn] = s);
  set(ref(db, "daftarSiswa"), dataObj);
}

function renderStats() {
  const statSiswa = document.getElementById("statTotalSiswa");
  const statUjian = document.getElementById("statTotalUjian");
  if (statSiswa) statSiswa.innerText = daftarSiswa.length;
  if (statUjian) statUjian.innerText = daftarUjian.length;
}

/* ===================================================
   1. KELOLA UJIAN & SOAL
   =================================================== */
function renderTabelUjian() {
  const tbody = document.getElementById("tbodyUjian");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (daftarUjian.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-3">Belum ada jadwal ujian.</td></tr>`;
    return;
  }

  daftarUjian.forEach((u, i) => {
    const jmlSoal = u.soal ? u.soal.length : 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><span class="badge bg-secondary">${u.mapel}</span></td>
      <td class="fw-bold">${u.judul}</td>
      <td>${u.durasi} Menit</td>
      <td><span class="badge bg-info text-dark font-monospace">${u.token}</span></td>
      <td><span class="badge bg-primary">${jmlSoal} Soal</span></td>
      <td>
        <button class="btn btn-sm btn-outline-primary me-1" onclick="openModalSoal('${u.id}')">
          <i class="bi bi-gear-fill"></i> Soal
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="hapusUjian('${u.id}')">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.openModalTambahUjian = function() {
  document.getElementById("formUjian").reset();
  document.getElementById("ujianId").value = "";
  document.getElementById("ujianToken").value = Math.random().toString(36).substring(2, 7).toUpperCase();
  const modal = new bootstrap.Modal(document.getElementById("modalUjian"));
  modal.show();
};

function handleSimpanUjian(e) {
  e.preventDefault();
  const mapel  = document.getElementById("ujianMapel").value;
  const judul  = document.getElementById("ujianJudul").value;
  const durasi = document.getElementById("ujianDurasi").value;
  const token  = document.getElementById("ujianToken").value;

  const id = "UJN-" + Date.now();
  const newUjian = {
    id,
    mapel,
    judul,
    durasi,
    token,
    soal: []
  };

  set(ref(db, "daftarUjian/" + id), newUjian)
    .then(() => {
      const modalEl = document.getElementById("modalUjian");
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    });
}

window.hapusUjian = function(id) {
  if (confirm("Apakah Anda yakin ingin menghapus ujian ini beserta seluruh soalnya?")) {
    remove(ref(db, "daftarUjian/" + id));
  }
};

// --- MODAL KELOLA SOAL ---
window.openModalSoal = function(ujianId) {
  activeUjianId = ujianId;
  const u = daftarUjian.find(item => item.id === ujianId);
  if (!u) return;

  document.getElementById("judulUjianSoal").innerText = `${u.mapel} - ${u.judul}`;
  document.getElementById("formTambahSoal").reset();
  switchTipeSoal("pg");

  const modal = new bootstrap.Modal(document.getElementById("modalKelolaSoal"));
  modal.show();
};

window.switchTipeSoal = function(tipe) {
  const containerPG = document.getElementById("containerPG");
  const containerMencocokkan = document.getElementById("containerMencocokkan");
  const boxKunciPG = document.getElementById("boxKunciPG");
  const boxKunciKompleks = document.getElementById("boxKunciKompleks");

  if (!containerPG || !containerMencocokkan) return;

  if (tipe === "pg") {
    containerPG.classList.remove("d-none");
    containerMencocokkan.classList.add("d-none");
    if (boxKunciPG) boxKunciPG.classList.remove("d-none");
    if (boxKunciKompleks) boxKunciKompleks.classList.add("d-none");
  } else if (tipe === "pg_kompleks") {
    containerPG.classList.remove("d-none");
    containerMencocokkan.classList.add("d-none");
    if (boxKunciPG) boxKunciPG.classList.add("d-none");
    if (boxKunciKompleks) boxKunciKompleks.classList.remove("d-none");
  } else if (tipe === "mencocokkan") {
    containerPG.classList.add("d-none");
    containerMencocokkan.classList.remove("d-none");
  }
};

function handleTambahSoal(e) {
  e.preventDefault();
  const u = daftarUjian.find(item => item.id === activeUjianId);
  if (!u) return;

  const tipe = document.getElementById("soalTipe").value;
  const pertanyaan = document.getElementById("soalPertanyaan").value;

  let newSoal = {
    id: "SOAL-" + Date.now(),
    tipe: tipe,
    pertanyaan: pertanyaan
  };

  if (tipe === "pg") {
    newSoal.opsi = {
      A: document.getElementById("soalA").value,
      B: document.getElementById("soalB").value,
      C: document.getElementById("soalC").value,
      D: document.getElementById("soalD").value
    };
    newSoal.kunci = document.getElementById("soalKunciPG").value;
  } else if (tipe === "pg_kompleks") {
    newSoal.opsi = {
      A: document.getElementById("soalA").value,
      B: document.getElementById("soalB").value,
      C: document.getElementById("soalC").value,
      D: document.getElementById("soalD").value
    };
    const checkedKunci = [];
    ['A', 'B', 'C', 'D'].forEach(opt => {
      const el = document.getElementById("kunciKompleks" + opt);
      if (el && el.checked) checkedKunci.push(opt);
    });
    newSoal.kunci = checkedKunci;
  } else if (tipe === "mencocokkan") {
    const pasangan = [];
    for (let i = 1; i <= 3; i++) {
      const elKiri = document.getElementById(`matchKiri${i}`);
      const elKanan = document.getElementById(`matchKanan${i}`);
      if (elKiri && elKanan && elKiri.value && elKanan.value) {
        pasangan.push({ kiri: elKiri.value, kanan: elKanan.value });
      }
    }
    newSoal.pasangan = pasangan;
  }

  if (!u.soal) u.soal = [];
  u.soal.push(newSoal);
  
  simpanDataUjian();
  alert("Soal berhasil ditambahkan!");
  document.getElementById("formTambahSoal").reset();
  switchTipeSoal("pg");
}

/* ===================================================
   2. DATA SISWA & IMPORT/EXPORT EXCEL
   =================================================== */
function renderTabelSiswa() {
  const tbody = document.getElementById("tbodySiswa");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (daftarSiswa.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">Belum ada data siswa.</td></tr>`;
    return;
  }

  daftarSiswa.forEach((s, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="font-monospace">${s.nisn}</td>
      <td class="fw-bold">${s.nama}</td>
      <td><span class="badge bg-secondary">${s.kelas}</span></td>
      <td>
        <button class="btn btn-sm btn-outline-danger" onclick="hapusSiswa('${s.nisn}')">
          <i class="bi bi-trash"></i> Hapus
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.openModalTambahSiswa = function() {
  document.getElementById("formSiswa").reset();
  const modal = new bootstrap.Modal(document.getElementById("modalSiswa"));
  modal.show();
};

function handleSimpanSiswa(e) {
  e.preventDefault();
  const nisn = document.getElementById("siswaNisn").value.trim();
  const nama = document.getElementById("siswaNama").value.trim();
  const kelas = document.getElementById("siswaKelas").value.trim();

  if (daftarSiswa.some(s => s.nisn === nisn)) {
    alert("NISN sudah terdaftar!");
    return;
  }

  const newSiswa = { nisn, nama, kelas };
  set(ref(db, "daftarSiswa/" + nisn), newSiswa)
    .then(() => {
      const modalEl = document.getElementById("modalSiswa");
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    });
}

window.hapusSiswa = function(nisn) {
  if (confirm("Hapus data siswa ini?")) {
    remove(ref(db, "daftarSiswa/" + nisn));
  }
};

// Download Template Excel Siswa
window.downloadTemplateSiswa = function() {
  const data = [
    { NISN: "0081234561", NAMA: "Ahmad Rizky", KELAS: "IX A" },
    { NISN: "0081234562", NAMA: "Siti Nurhaliza", KELAS: "IX B" }
  ];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template Siswa");
  XLSX.writeFile(wb, "Template_Data_Siswa.xlsx");
};

// Import Excel Siswa
function importSiswaExcel(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet);

    let countAdded = 0;
    json.forEach(row => {
      const nisn = String(row.NISN || row.nisn || "").trim();
      const nama = String(row.NAMA || row.Nama || row.nama || "").trim();
      const kelas = String(row.KELAS || row.Kelas || row.kelas || "").trim();

      if (nisn && nama && !daftarSiswa.some(s => s.nisn === nisn)) {
        daftarSiswa.push({ nisn, nama, kelas });
        countAdded++;
      }
    });

    simpanDataSiswa();
    alert(`Berhasil mengimpor ${countAdded} data siswa!`);
    event.target.value = "";
  };
  reader.readAsArrayBuffer(file);
}

// Export Data Siswa Ke Excel
window.exportSiswaExcel = function() {
  if (daftarSiswa.length === 0) {
    alert("Tidak ada data siswa untuk diekspor.");
    return;
  }
  const ws = XLSX.utils.json_to_sheet(daftarSiswa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data Siswa");
  XLSX.writeFile(wb, "Data_Siswa_CBT.xlsx");
};

// Download Template Soal Excel
window.downloadTemplateSoal = function() {
  const data = [
    { Tipe: "pg", Pertanyaan: "Perangkat keras input komputer adalah?", A: "Keyboard", B: "Printer", C: "Speaker", D: "Proyektor", Kunci: "A", Pasangan: "" },
    { Tipe: "pg_kompleks", Pertanyaan: "Pilih yang termasuk perangkat lunak sistem operasi!", A: "Windows", B: "Linux", C: "Microsoft Word", D: "Google Chrome", Kunci: "A,B", Pasangan: "" },
    { Tipe: "mencocokkan", Pertanyaan: "Jodohkan istilah berikut!", A: "", B: "", C: "", D: "", Kunci: "", Pasangan: "CPU=Otak Komputer; RAM=Memori Utama; HDD=Penyimpanan" }
  ];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template Soal");
  XLSX.writeFile(wb, "Template_Soal_3_Tipe.xlsx");
};

// Import Soal dari Excel
function importExcelSoal(event) {
  const file = event.target.files[0];
  if (!file || !activeUjianId) return;

  const u = daftarUjian.find(item => item.id === activeUjianId);
  if (!u) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet);

    let countAdded = 0;
    json.forEach(row => {
      const tipe = String(row.Tipe || row.tipe || "pg").trim().toLowerCase();
      const pertanyaan = row.Pertanyaan || row.pertanyaan;

      if (!pertanyaan) return;

      let itemSoal = {
        id: "SOAL-" + Date.now() + Math.random().toString(36).substr(2, 4),
        tipe: tipe,
        pertanyaan: pertanyaan
      };

      if (tipe === "pg") {
        itemSoal.opsi = {
          A: row.A || row.a || "",
          B: row.B || row.b || "",
          C: row.C || row.c || "",
          D: row.D || row.d || ""
        };
        itemSoal.kunci = String(row.Kunci || row.kunci || "").toUpperCase().trim();
        countAdded++;
      } else if (tipe === "pg_kompleks") {
        itemSoal.opsi = {
          A: row.A || row.a || "",
          B: row.B || row.b || "",
          C: row.C || row.c || "",
          D: row.D || row.d || ""
        };
        const rawKunci = String(row.Kunci || row.kunci || "");
        itemSoal.kunci = rawKunci.split(",").map(k => k.toUpperCase().trim()).filter(k => k);
        countAdded++;
      } else if (tipe === "mencocokkan") {
        const rawPasangan = String(row.Pasangan || row.pasangan || "");
        const listPasangan = [];
        rawPasangan.split(";").forEach(pair => {
          const [kiri, kanan] = pair.split("=");
          if (kiri && kanan) {
            listPasangan.push({ kiri: kiri.trim(), kanan: kanan.trim() });
          }
        });
        itemSoal.pasangan = listPasangan;
        countAdded++;
      }

      if (!u.soal) u.soal = [];
      u.soal.push(itemSoal);
    });

    simpanDataUjian();
    alert(`Berhasil mengimpor ${countAdded} soal!`);
    event.target.value = "";
  };
  reader.readAsArrayBuffer(file);
}

/* ===================================================
   3. REKAP NILAI & FILTER DOWNLOAD PER KELAS
   =================================================== */
function renderTabelNilai() {
  const tbody = document.getElementById("tbodyNilai");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (hasilUjian.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">Belum ada hasil ujian yang tersimpan.</td></tr>`;
    return;
  }

  hasilUjian.forEach((h, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="font-monospace">${h.nisn}</td>
      <td class="fw-bold">${h.nama} <span class="badge bg-light text-dark border ms-1">${h.kelas || '-'}</span></td>
      <td>${h.mapel} - ${h.judul}</td>
      <td><span class="badge bg-success fs-6">${h.nilai}</span></td>
      <td class="small text-muted">${h.waktuSelesai || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function updateFilterUjianDropdown() {
  const selectUjian = document.getElementById("selectFilterUjian");
  if (!selectUjian) return;
  selectUjian.innerHTML = '<option value="">-- Semua Ujian --</option>';
  daftarUjian.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u.id;
    opt.textContent = `${u.mapel} - ${u.judul}`;
    selectUjian.appendChild(opt);
  });
}

window.downloadRekapNilaiPerKelas = function(kelasFilter, ujianIdFilter) {
  if (hasilUjian.length === 0) {
    alert("Belum ada data nilai yang tersimpan untuk diunduh!");
    return;
  }

  let dataFiltered = hasilUjian.filter(item => {
    let matchKelas = true;
    let matchUjian = true;

    if (kelasFilter) {
      matchKelas = (item.kelas && item.kelas.trim().toLowerCase() === kelasFilter.trim().toLowerCase());
    }
    if (ujianIdFilter) {
      matchUjian = (item.ujianId === ujianIdFilter);
    }

    return matchKelas && matchUjian;
  });

  if (dataFiltered.length === 0) {
    alert("Tidak ditemukan data nilai sesuai filter kelas / ujian yang dipilih!");
    return;
  }

  const excelData = dataFiltered.map((item, index) => ({
    "No": index + 1,
    "NISN": item.nisn,
    "Nama Siswa": item.nama,
    "Kelas": item.kelas || "-",
    "Mata Pelajaran": item.mapel,
    "Judul Ujian": item.judul,
    "Nilai": item.nilai,
    "Waktu Selesai": item.waktuSelesai || "-"
  }));

  const ws = XLSX.utils.json_to_sheet(excelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rekap Nilai");

  let fileName = "Rekap_Nilai";
  if (kelasFilter) fileName += `_${kelasFilter.replace(/\s+/g, "_")}`;
  if (ujianIdFilter) fileName += `_Ujian`;
  fileName += ".xlsx";

  XLSX.writeFile(wb, fileName);
};
