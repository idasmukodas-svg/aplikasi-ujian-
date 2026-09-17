/* ===================================================
   APP.JS - DASHBOARD ADMIN & GURU CBT SMP PLUS ANNUUR
   =================================================== */

// Import Firebase (Sesuaikan dengan konfigurasi proyek Anda jika menggunakan modular SDK)
// Jika menggunakan CDN Firebase Namespaced, pastikan variabel global terhubung.

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
   2. AUTentikasi & SESI LOGIN
   =================================================== */
function cekSesiLogin() {
  const savedUser = localStorage.getItem("cbt_current_user");
  if (!savedUser) {
    // Jika belum login, arahkan ke halaman login atau tampilkan form login
    window.location.href = "login.html"; // Sesuaikan jika halaman login terpisah
    return;
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

  // Muat data awal dashboard
  loadDataDashboard();
}

function logout() {
  localStorage.removeItem("cbt_current_user");
  window.location.href = "login.html";
}

/* ===================================================
   3. EVENT LISTENERS & INISIALISASI FORM
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
   4. KELOLA UJIAN & BANK SOAL (DENGAN SAKLAR AKTIF/NONAKTIF)
   =================================================== */
function loadDataDashboard() {
  // Simulasi pemuatan data dari localStorage / Firebase
  // Di sini diasumsikan data diambil dari state global atau database
  renderTabelUjian();
  renderTabelSiswa();
  renderTabelNilai();
}

function renderTabelUjian() {
  const tbody = document.getElementById("tbodyUjian");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!daftarUjian || daftarUjian.length === 0) {
    // Data dummy untuk contoh jika kosong agar tabel langsung terlihat
    daftarUjian = [
      {
        id: "ujian_1",
        mapel: "Informatika",
        kelasTarget: "IX",
        judul: "Ulanng Uji Coba",
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

  document.getElementById("statTotalUjian").textContent = daftarUjian.length;

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

// Fungsi untuk mengubah status Aktif / Nonaktif ujian via saklar toggle
window.toggleStatusUjian = function(id) {
  const ujian = daftarUjian.find(u => u.id === id);
  if (ujian) {
    ujian.status = ujian.status === "aktif" ? "nonaktif" : "aktif";
    renderTabelUjian();
  }
};

/* ===================================================
   5. BANTUAN FORMAT TANGGAL & WAKTU
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
   6. PLACEHOLDER FUNGSI LAIN (Siswa, Guru, Soal)
   =================================================== */
function renderTabelSiswa() {
  const tbodySiswa = document.getElementById("tbodySiswa");
  if (tbodySiswa) {
    document.getElementById("statTotalSiswa").textContent = "1";
    document.getElementById("totalSiswaTampil").textContent = "1 Siswa";
  }
}

function renderTabelNilai() {}
function openModalTambahUjian() {
  const modal = new bootstrap.Modal(document.getElementById("modalUjian"));
  modal.show();
}
function openModalSoal(id) {
  const modal = new bootstrap.Modal(document.getElementById("modalKelolaSoal"));
  modal.show();
}
window.hapusUjian = function(id) {
  if (confirm("Yakin ingin menghapus jadwal ujian ini?")) {
    daftarUjian = daftarUjian.filter(u => u.id !== id);
    renderTabelUjian();
  }
};
