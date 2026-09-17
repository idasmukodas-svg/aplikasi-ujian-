/* ===================================================
   APP.JS - DASHBOARD ADMIN & GURU CBT SMP PLUS ANNUUR
   =================================================== */

let daftarUjian = [];
let daftarSiswa = [];
let daftarNilai = [];
let daftarGuru = [];
let currentUser = null;

// Jalankan saat dokumen siap
document.addEventListener("DOMContentLoaded", () => {
  cekSesiLogin();
  setupEventListeners();
});

/* ===================================================
   1. AUTENTIKASI & SESI LOGIN
   =================================================== */
function cekSesiLogin() {
  let savedUser = localStorage.getItem("cbt_current_user");
  
  // Jika belum ada user yang login, buatkan akun admin default otomatis
  if (!savedUser) {
    const defaultAdmin = {
      id: "admin_default",
      nama: "Administrator",
      email: "admin@smpannuur.sch.id",
      role: "admin"
    };
    localStorage.setItem("cbt_current_user", JSON.stringify(defaultAdmin));
    savedUser = JSON.stringify(defaultAdmin);
  }

  currentUser = JSON.parse(savedUser);
  
  const nameEl = document.getElementById("userDisplayName");
  if (nameEl) {
    nameEl.textContent = `${currentUser.nama} (${currentUser.role.toUpperCase()})`;
  }

  // Jika guru biasa, sembunyikan tab kelola akun guru
  if (currentUser.role !== "admin") {
    const navGuruTab = document.getElementById("navGuruTab");
    if (navGuruTab) navGuruTab.style.display = "none";
  }

  loadDataDashboard();
}

function logout() {
  localStorage.removeItem("cbt_current_user");
  window.location.reload();
}

/* ===================================================
   2. EVENT LISTENERS & INISIALISASI FORM
   =================================================== */
function setupEventListeners() {
  const formUjian = document.getElementById("formUjian");
  if (formUjian) {
    formUjian.addEventListener("submit", (e) => {
      e.preventDefault();
      simpanUjian();
    });
  }

  const formSiswa = document.getElementById("formSiswa");
  if (formSiswa) {
    formSiswa.addEventListener("submit", (e) => {
      e.preventDefault();
      simpanSiswa();
    });
  }
}

/* ===================================================
   3. KELOLA UJIAN & BANK SOAL
   =================================================== */
function loadDataDashboard() {
  renderTabelUjian();
  renderTabelSiswa();
  renderTabelNilai();
}

function renderTabelUjian() {
  const tbody = document.getElementById("tbodyUjian");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!daftarUjian || daftarUjian.length === 0) {
    daftarUjian = [
      {
        id: "ujian_1",
        mapel: "Informatika",
        kelasTarget: "IX",
        judul: "Ulang Uji Coba",
        waktuMulai: "2026-09-17T08:00",
        waktuSelesai: "2026-09-17T10:00",
        durasi: 60,
        token: "UKPLCL",
        status: "aktif",
        soal: [1, 2, 3, 4, 5]
      },
      {
        id: "ujian_2",
        mapel: "IPS",
        kelasTarget: "IX",
        judul: "NENEK MOYANG INDONESIA",
        waktuMulai: "2026-09-18T08:00",
        waktuSelesai: "2026-09-18T10:00",
        durasi: 60,
        token: "2BKCM9",
        status: "aktif",
        soal: Array(10)
      }
    ];
  }

  const statUjian = document.getElementById("statTotalUjian");
  if (statUjian) statUjian.textContent = daftarUjian.length;

  daftarUjian.forEach((u, i) => {
    const jmlSoal = u.soal ? u.soal.length : 0;
    const isAktif = u.status === "aktif";
    const statusBadge = isAktif 
      ? `<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Aktif</span>` 
      : `<span class="badge bg-secondary"><i class="bi bi-x-circle me-1"></i>Nonaktif</span>`;
    
    const jadwalText = `<div class="small fw-bold text-primary">${formatDateTimeDisplay(u.waktuMulai)}</div>
                        <div class="small text-muted">s.d. ${formatDateTimeDisplay(u.waktuSelesai)}</div>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><span class="badge bg-secondary">${u.mapel || '-'}</span></td>
      <td><span class="badge bg-dark">${u.kelasTarget || 'Semua'}</span></td>
      <td class="fw-bold">${u.judul || '-'}</td>
      <td>${jadwalText}</td>
      <td>${u.durasi || 0} Menit</td>
      <td><span class="badge bg-info text-dark font-monospace">${u.token || '-'}</span></td>
      <td>
        <div class="form-check form-switch cursor-pointer" title="Klik untuk mengubah status ujian">
          <input class="form-check-input" type="checkbox" role="switch" id="switch-${u.id}" ${isAktif ? 'checked' : ''} onchange="toggleStatusUjian('${u.id}')">
          <label class="form-check-label" for="switch-${u.id}">${statusBadge}</label>
        </div>
      </td>
      <td><span class="badge bg-primary">${jmlSoal} Soal</span></td>
      <td>
        <button class="btn btn-sm btn-outline-primary me-1" onclick="openModalSoal('${u.id}')">
          <i class="bi bi-gear-fill me-1"></i> Soal
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="hapusUjian('${u.id}')">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.toggleStatusUjian = function(id) {
  const ujian = daftarUjian.find(u => u.id === id);
  if (ujian) {
    ujian.status = ujian.status === "aktif" ? "nonaktif" : "aktif";
    renderTabelUjian();
  }
};

/* ===================================================
   4. FORMAT TANGGAL & WAKTU
   =================================================== */
function formatDateTimeDisplay(dateTimeStr) {
  if (!dateTimeStr) return '-';
  const date = new Date(dateTimeStr);
  if (isNaN(date)) return dateTimeStr;
  return date.toLocaleString('id-ID', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

/* ===================================================
   5. MODAL & AKSI FORM
   =================================================== */
function renderTabelSiswa() {
  const statSiswa = document.getElementById("statTotalSiswa");
  const totalTampil = document.getElementById("totalSiswaTampil");
  if (statSiswa) statSiswa.textContent = "1";
  if (totalTampil) totalTampil.textContent = "1 Siswa";
}

function renderTabelNilai() {}

function openModalTambahUjian() {
  const modalEl = document.getElementById("modalUjian");
  if (modalEl) {
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }
}

function openModalSoal(id) {
  const modalEl = document.getElementById("modalKelolaSoal");
  if (modalEl) {
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }
}

function simpanUjian() {
  const mapel = document.getElementById("ujianMapel").value;
  const kelasTarget = document.getElementById("ujianKelasTarget").value;
  const judul = document.getElementById("ujianJudul").value;
  const waktuMulai = document.getElementById("ujianWaktuMulai").value;
  const waktuSelesai = document.getElementById("ujianWaktuSelesai").value;
  const durasi = document.getElementById("ujianDurasi").value;
  const token = document.getElementById("ujianToken").value;
  const status = document.getElementById("ujianStatus").value;

  const newUjian = {
    id: "ujian_" + Date.now(),
    mapel,
    kelasTarget,
    judul,
    waktuMulai,
    waktuSelesai,
    durasi,
    token,
    status,
    soal: []
  };

  daftarUjian.push(newUjian);
  renderTabelUjian();

  const modalEl = document.getElementById("modalUjian");
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) modal.hide();
  document.getElementById("formUjian").reset();
}

function simpanSiswa() {
  const modalEl = document.getElementById("modalSiswa");
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) modal.hide();
  document.getElementById("formSiswa").reset();
}

window.hapusUjian = function(id) {
  if (confirm("Yakin ingin menghapus jadwal ujian ini?")) {
    daftarUjian = daftarUjian.filter(u => u.id !== id);
    renderTabelUjian();
  }
};
