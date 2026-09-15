const firebaseConfig = {
  apiKey: "AIzaSyBCWVQE9zWCgGJy_MYp47U4dp-gDsWFRE8",
  authDomain: "aplikasi-ujian-8e501.firebaseapp.com",
  projectId: "aplikasi-ujian-8e501",
  storageBucket: "aplikasi-ujian-8e501.firebasestorage.app",
  messagingSenderId: "945781407027",
  appId: "1:945781407027:web:4672d4c894e143c9b05246",
  measurementId: "G-CBH4C0BVXD"
};
/* ===================================================
   APP.JS - LMS & CBT INFORMATIKA
   =================================================== */

// --- INISIALISASI DATA LOCALSTORAGE ---
let daftarUjian = JSON.parse(localStorage.getItem("daftarUjian")) || [];
let daftarSiswa = JSON.parse(localStorage.getItem("daftarSiswa")) || [];
let hasilUjian  = JSON.parse(localStorage.getItem("hasilUjian"))  || [];
let activeUjianId = null;

document.addEventListener("DOMContentLoaded", () => {
  renderStats();
  renderTabelUjian();
  renderTabelSiswa();
  renderTabelNilai();
  updateFilterUjianDropdown();
});

// --- HELPER UNTUK SIMPAN DATA ---
function simpanData() {
  localStorage.setItem("daftarUjian", JSON.stringify(daftarUjian));
  localStorage.setItem("daftarSiswa", JSON.stringify(daftarSiswa));
  localStorage.setItem("hasilUjian", JSON.stringify(hasilUjian));
  renderStats();
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

function openModalTambahUjian() {
  document.getElementById("formUjian").reset();
  document.getElementById("ujianId").value = "";
  // Generate Random Token 5 Karakter
  document.getElementById("ujianToken").value = Math.random().toString(36).substring(2, 7).toUpperCase();
  const modal = new bootstrap.Modal(document.getElementById("modalUjian"));
  modal.show();
}

function handleSimpanUjian(e) {
  e.preventDefault();
  const mapel  = document.getElementById("ujianMapel").value;
  const judul  = document.getElementById("ujianJudul").value;
  const durasi = document.getElementById("ujianDurasi").value;
  const token  = document.getElementById("ujianToken").value;

  const newUjian = {
    id: "UJN-" + Date.now(),
    mapel,
    judul,
    durasi,
    token,
    soal: []
  };

  daftarUjian.push(newUjian);
  simpanData();
  renderTabelUjian();
  updateFilterUjianDropdown();

  bootstrap.Modal.getInstance(document.getElementById("modalUjian")).hide();
}

function hapusUjian(id) {
  if (confirm("Apakah Anda yakin ingin menghapus ujian ini beserta seluruh soalnya?")) {
    daftarUjian = daftarUjian.filter(u => u.id !== id);
    simpanData();
    renderTabelUjian();
    updateFilterUjianDropdown();
  }
}

// --- MODAL KELOLA SOAL (3 TIPE) ---
function openModalSoal(ujianId) {
  activeUjianId = ujianId;
  const u = daftarUjian.find(item => item.id === ujianId);
  if (!u) return;

  document.getElementById("judulUjianSoal").innerText = `${u.mapel} - ${u.judul}`;
  document.getElementById("formTambahSoal").reset();
  switchTipeSoal("pg");

  const modal = new bootstrap.Modal(document.getElementById("modalKelolaSoal"));
  modal.show();
}

function switchTipeSoal(tipe) {
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
}

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
  simpanData();
  renderTabelUjian();

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

function openModalTambahSiswa() {
  document.getElementById("formSiswa").reset();
  const modal = new bootstrap.Modal(document.getElementById("modalSiswa"));
  modal.show();
}

function handleSimpanSiswa(e) {
  e.preventDefault();
  const nisn = document.getElementById("siswaNisn").value.trim();
  const nama = document.getElementById("siswaNama").value.trim();
  const kelas = document.getElementById("siswaKelas").value.trim();

  if (daftarSiswa.some(s => s.nisn === nisn)) {
    alert("NISN sudah terdaftar!");
    return;
  }

  daftarSiswa.push({ nisn, nama, kelas });
  simpanData();
  renderTabelSiswa();
  bootstrap.Modal.getInstance(document.getElementById("modalSiswa")).hide();
}

function hapusSiswa(nisn) {
  if (confirm("Hapus data siswa ini?")) {
    daftarSiswa = daftarSiswa.filter(s => s.nisn !== nisn);
    simpanData();
    renderTabelSiswa();
  }
}

// Download Template Excel Siswa
function downloadTemplateSiswa() {
  const data = [
    { NISN: "0081234561", NAMA: "Ahmad Rizky", KELAS: "IX A" },
    { NISN: "0081234562", NAMA: "Siti Nurhaliza", KELAS: "IX B" }
  ];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template Siswa");
  XLSX.writeFile(wb, "Template_Data_Siswa.xlsx");
}

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

    simpanData();
    renderTabelSiswa();
    alert(`Berhasil mengimpor ${countAdded} data siswa!`);
    event.target.value = "";
  };
  reader.readAsArrayBuffer(file);
}

// Export Data Siswa Ke Excel
function exportSiswaExcel() {
  if (daftarSiswa.length === 0) {
    alert("Tidak ada data siswa untuk diekspor.");
    return;
  }
  const ws = XLSX.utils.json_to_sheet(daftarSiswa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data Siswa");
  XLSX.writeFile(wb, "Data_Siswa_CBT.xlsx");
}

// Download Template Soal Excel (Mendukung 3 Tipe Soal)
function downloadTemplateSoal() {
  const data = [
    { Tipe: "pg", Pertanyaan: "Perangkat keras input komputer adalah?", A: "Keyboard", B: "Printer", C: "Speaker", D: "Proyektor", Kunci: "A", Pasangan: "" },
    { Tipe: "pg_kompleks", Pertanyaan: "Pilih yang termasuk perangkat lunak sistem operasi!", A: "Windows", B: "Linux", C: "Microsoft Word", D: "Google Chrome", Kunci: "A,B", Pasangan: "" },
    { Tipe: "mencocokkan", Pertanyaan: "Jodohkan istilah berikut!", A: "", B: "", C: "", D: "", Kunci: "", Pasangan: "CPU=Otak Komputer; RAM=Memori Utama; HDD=Penyimpanan" }
  ];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template Soal");
  XLSX.writeFile(wb, "Template_Soal_3_Tipe.xlsx");
}

// Import Soal dari Excel (Multi-Tipe: PG, PG Kompleks, Mencocokkan)
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

    simpanData();
    renderTabelUjian();
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

// FUNGSI UTAMA DOWNLOAD REKAP NILAI (DENGAN FILTER KELAS & UJIAN)
function downloadRekapNilaiPerKelas(kelasFilter, ujianIdFilter) {
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
}
