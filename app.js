/* ===================================================
   APP.JS - LMS & CBT SMAN 1 TARAJU (WITH PRINT CARDS & MULTI-CLASS)
   =================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let userSession = null;
const storedUser = sessionStorage.getItem("userLoggedIn") || localStorage.getItem("cbt_current_user");

if (!storedUser) {
  window.location.href = "login.html";
} else {
  userSession = JSON.parse(storedUser);
}

let daftarUjian = [];
let daftarSiswa = [];
let hasilUjian = [];
let daftarPengguna = [];
let daftarKelas = [];
let activeUjianId = null;

document.addEventListener("DOMContentLoaded", () => {
  if (!userSession) return;
  renderUserInfoNav();

  // 1. Load Realtime Data Kelas
  onValue(ref(db, "daftarKelas"), (snapshot) => {
    const data = snapshot.val();
    daftarKelas = data ? Object.values(data) : [];
    renderListKelasModal();
    updateAllClassDropdowns();
  });

  // 2. Load Realtime Data Ujian
  onValue(ref(db, "daftarUjian"), (snapshot) => {
    const data = snapshot.val();
    const rawList = data ? Object.values(data) : [];

    if (userSession.role === "guru" && userSession.mapel) {
      daftarUjian = rawList.filter(u => u.mapel && u.mapel.toLowerCase().trim() === userSession.mapel.toLowerCase().trim());
    } else {
      daftarUjian = rawList;
    }

    renderStats();
    renderTabelUjian();
    updateFilterUjianDropdown();

    if (activeUjianId) {
      const activeUjian = daftarUjian.find(u => u.id === activeUjianId);
      if (activeUjian) renderDaftarSoal(activeUjian);
    }
  });

  // 3. Load Realtime Data Siswa
  onValue(ref(db, "daftarSiswa"), (snapshot) => {
    const data = snapshot.val();
    daftarSiswa = data ? Object.values(data) : [];
    renderStats();
    window.filterDataSiswa();
  });

  // 4. Load Realtime Hasil Ujian
  onValue(ref(db, "hasilUjian"), (snapshot) => {
    const data = snapshot.val();
    const rawHasil = data ? Object.entries(data).map(([key, val]) => ({ id: key, ...val })) : [];
     
    if (userSession.role === "guru" && userSession.mapel) {
      hasilUjian = rawHasil.filter(h => h.mapel && h.mapel.toLowerCase().trim() === userSession.mapel.toLowerCase().trim());
    } else {
      hasilUjian = rawHasil;
    }

    window.filterRekapNilai();
     if (typeof updateFilterUjianDropdown === "function") {
      updateFilterUjianDropdown();
    }
  });

  // 5. Load Pengguna (Admin Only)
  if (userSession.role === "admin") {
    onValue(ref(db, "pengguna"), (snapshot) => {
      const data = snapshot.val();
      daftarPengguna = data ? Object.values(data) : [];
      renderTabelPengguna();
    });
  } else {
    const navGuruTab = document.getElementById("navGuruTab");
    if (navGuruTab) navGuruTab.style.display = "none";
  }
// Fungsi penanganan form tambah soal
function handleTambahSoal(e) {
  if (e) e.preventDefault();
  
  // Ambil data dari form tambah soal dan simpan ke database Firebase
  const soalTeks = document.getElementById("soalTeks")?.value;
  // ... logika penyimpanan soal ke node daftarUjian/${activeUjianId}/soal ...
}
  // Event Listeners Form & Input
  document.getElementById("formUjian")?.addEventListener("submit", handleSimpanUjian);
  document.getElementById("formTambahSoal")?.addEventListener("submit", handleTambahSoal);
  document.getElementById("formSiswa")?.addEventListener("submit", handleSimpanSiswa);
  document.getElementById("formTambahGuru")?.addEventListener("submit", handleTambahGuru);
  document.getElementById("formEditGuru")?.addEventListener("submit", handleSimpanEditGuru);
  document.getElementById("formTambahKelas")?.addEventListener("submit", handleTambahKelas);
  document.getElementById("fileExcelSiswa")?.addEventListener("change", importSiswaExcel);
  document.getElementById("fileExcelSoal")?.addEventListener("change", importExcelSoal);

  // Event Listeners Filter Rekap Nilai
  document.getElementById("selectFilterKelas")?.addEventListener("change", () => window.filterRekapNilai());
  document.getElementById("selectFilterUjian")?.addEventListener("change", () => window.filterRekapNilai());

  document.getElementById("soalTipe")?.addEventListener("change", (e) => {
    window.switchTipeSoal(e.target.value);
  });

  document.getElementById("btnExportRekap")?.addEventListener("click", () => {
    const kelas = document.getElementById("selectFilterKelas")?.value || "";
    const ujianId = document.getElementById("selectFilterUjian")?.value || "";
    window.downloadRekapNilaiPerKelas(kelas, ujianId);
  });
});

function renderUserInfoNav() {
  const userDisplayName = document.getElementById("userDisplayName");
  if (userDisplayName && userSession) {
    userDisplayName.innerHTML = `<i class="bi bi-person-circle me-1"></i> ${userSession.nama || userSession.email} (${userSession.role === 'admin' ? 'ADMIN' : 'Guru ' + (userSession.mapel || '')})`;
  }
}

window.logout = () => {
  signOut(auth).then(() => {
    sessionStorage.removeItem("userLoggedIn");
    localStorage.removeItem("cbt_current_user");
    window.location.href = "login.html";
  }).catch(() => {
    sessionStorage.removeItem("userLoggedIn");
    localStorage.removeItem("cbt_current_user");
    window.location.href = "login.html";
  });
};

function simpanSoalUjianAktif(ujianId, listSoal) {
  return set(ref(db, `daftarUjian/${ujianId}/soal`), listSoal);
}

function renderStats() {
  const statSiswa = document.getElementById("statTotalSiswa");
  const statUjian = document.getElementById("statTotalUjian");
  if (statSiswa) statSiswa.innerText = daftarSiswa.length;
  if (statUjian) statUjian.innerText = daftarUjian.length;
}

/* ===================================================
   KELOLA KELAS DINAMIS
   =================================================== */
window.openModalKelolaKelas = () => {
  const modalEl = document.getElementById("modalKelolaKelas");
  if (modalEl && window.bootstrap) bootstrap.Modal.getOrCreateInstance(modalEl).show();
};

function handleTambahKelas(e) {
  e.preventDefault();
  const namaKelas = document.getElementById("inputNamaKelas").value.trim();
  if (!namaKelas) return;

  const cleanKey = namaKelas.replace(/[.#$\[\]]/g, "_");
  set(ref(db, "daftarKelas/" + cleanKey), { nama: namaKelas })
    .then(() => {
      document.getElementById("formTambahKelas").reset();
    })
    .catch(err => alert("Gagal menambah kelas: " + err.message));
}

window.hapusKelas = (namaKelas) => {
  if (confirm(`Hapus kelas ${namaKelas}?`)) {
    const cleanKey = namaKelas.replace(/[.#$\[\]]/g, "_");
    remove(ref(db, "daftarKelas/" + cleanKey));
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
      <span class="fw-semibold">${k.nama}</span>
      <button class="btn btn-sm btn-outline-danger" onclick="hapusKelas('${k.nama}')">
        <i class="bi bi-trash"></i>
      </button>
    `;
    listEl.appendChild(li);
  });
}

function updateAllClassDropdowns() {
  const filterSiswa = document.getElementById("filterKelasSiswa");
  if (filterSiswa) {
    const currVal = filterSiswa.value;
    filterSiswa.innerHTML = '<option value="">-- Semua Kelas --</option>';
    daftarKelas.forEach(k => {
      const opt = document.createElement("option");
      opt.value = k.nama;
      opt.textContent = k.nama;
      filterSiswa.appendChild(opt);
    });
    filterSiswa.value = currVal;
  }

  const filterNilai = document.getElementById("selectFilterKelas");
  if (filterNilai) {
    const currVal = filterNilai.value;
    filterNilai.innerHTML = '<option value="">-- Semua Kelas --</option>';
    daftarKelas.forEach(k => {
      const opt = document.createElement("option");
      opt.value = k.nama;
      opt.textContent = k.nama;
      filterNilai.appendChild(opt);
    });
    filterNilai.value = currVal;
  }

  // RENDER CHECKBOX MULTI-SELECT KELAS UJIAN
  const containerCheck = document.getElementById("containerCheckboxKelas");
  if (containerCheck) {
    containerCheck.innerHTML = "";
    daftarKelas.forEach(k => {
      const div = document.createElement("div");
      div.className = "form-check mb-1";
      div.innerHTML = `
        <input class="form-check-input check-kelas-item" type="checkbox" value="${k.nama}" id="checkKelas_${k.nama}">
        <label class="form-check-label" for="checkKelas_${k.nama}">${k.nama}</label>
      `;
      containerCheck.appendChild(div);
    });
  }

  const selectSiswa = document.getElementById("siswaKelas");
  if (selectSiswa) {
    const currVal = selectSiswa.value;
    selectSiswa.innerHTML = '<option value="">-- Pilih Kelas --</option>';
    daftarKelas.forEach(k => {
      const opt = document.createElement("option");
      opt.value = k.nama;
      opt.textContent = k.nama;
      selectSiswa.appendChild(opt);
    });
    selectSiswa.value = currVal;
  }
}

/* ===================================================
   1. KELOLA UJIAN & BANK SOAL (MULTI KELAS TARGET)
   =================================================== */
function renderTabelUjian() {
  const tbody = document.getElementById("tbodyUjian");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (daftarUjian.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-3">Belum ada jadwal ujian/bank soal di Database.</td></tr>`;
    return;
  }

  daftarUjian.forEach((u, i) => {
    const jmlSoal = u.soal ? u.soal.length : 0;
    const isAktif = u.status === "aktif";
    const statusBadge = isAktif  
      ? `<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Aktif</span>`  
      : `<span class="badge bg-secondary"><i class="bi bi-x-circle me-1"></i>Nonaktif</span>`;

    const displayKelas = Array.isArray(u.kelasTarget) ? u.kelasTarget.join(", ") : (u.kelasTarget || 'Semua');

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><span class="badge bg-secondary">${u.mapel || '-'}</span></td>
      <td><span class="badge bg-dark">${displayKelas}</span></td>
      <td class="fw-bold">${u.judul || '-'}</td>
      <td>${u.durasi || 0} Mns</td>
      <td><span class="badge bg-info text-dark font-monospace">${u.token || '-'}</span></td>
      <td>
        <div class="form-check form-switch cursor-pointer" title="Klik untuk mengubah status">
          <input class="form-check-input" type="checkbox" role="switch" id="switch-${u.id}" ${isAktif ? 'checked' : ''} onchange="toggleStatusUjian('${u.id}', '${u.status || 'nonaktif'}')">
          <label class="form-check-label" for="switch-${u.id}">${statusBadge}</label>
        </div>
      </td>
      <td><span class="badge bg-primary">${jmlSoal} Soal</span></td>
      <td>
        <div class="btn-group btn-group-sm" role="group">
          <button class="btn btn-outline-primary" onclick="openModalSoal('${u.id}')" title="Kelola Soal">
            <i class="bi bi-gear-fill"></i> Soal
          </button>
          <button class="btn btn-outline-warning" onclick="window.bukaModalEditUjian('${u.id}')" title="Edit Ujian">
           <i class="bi bi-pencil-square"></i>
          </button>
          <button class="btn btn-outline-success" onclick="downloadArsipSoalById('${u.id}')" title="Download Arsip Soal">
            <i class="bi bi-file-earmark-excel"></i>
          </button>
          <button class="btn btn-outline-danger" onclick="hapusUjian('${u.id}')" title="Hapus Ujian">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.toggleStatusUjian = (id, currentStatus) => {
  const newStatus = (currentStatus === "aktif") ? "nonaktif" : "aktif";
  update(ref(db, `daftarUjian/${id}`), { status: newStatus })
    .catch((err) => alert("Gagal mengubah status ujian: " + err.message));
};

function handleSimpanUjian(e) {
  e.preventDefault();
  const mapelInput = document.getElementById("ujianMapel").value.trim();
  const judul = document.getElementById("ujianJudul").value.trim();
  const durasi = document.getElementById("ujianDurasi").value;
  const token = document.getElementById("ujianToken").value.trim();
  const status = document.getElementById("ujianStatus").value;
  const pembuatInput = document.getElementById("ujianPembuat").value; // <--- Ambil pilihan guru

  // Validasi pilihan guru pembuat
  if (!pembuatInput) {
    return alert("Silakan pilih guru pembuat soal terlebih dahulu!");
  }

  // AMBIL MULTI-SELECT CHECKBOX KELAS
  let selectedKelas = [];
  const checkSemua = document.getElementById("checkKelasSemua");
  if (checkSemua && checkSemua.checked) {
    selectedKelas = ["Semua"];
  } else {
    document.querySelectorAll(".check-kelas-item:checked").forEach(cb => {
      selectedKelas.push(cb.value);
    });
  }

  if (selectedKelas.length === 0) {
    return alert("Pilih minimal satu target kelas!");
  }

  const id = "UJN-" + Date.now();
  const newUjian = {
    id, 
    mapel: mapelInput, 
    kelasTarget: selectedKelas, 
    judul, 
    durasi: parseInt(durasi), 
    token, 
    status, 
    soal: [],
    createdBy: pembuatInput // <--- Menyimpan nama/ID guru yang dipilih
  };

  set(ref(db, "daftarUjian/" + id), newUjian)
    .then(() => {
      alert("Ujian Berhasil Disimpan!");
      const modalEl = document.getElementById("modalUjian");
      if (modalEl && window.bootstrap) bootstrap.Modal.getInstance(modalEl)?.hide();
    })
    .catch((err) => alert("Gagal menyimpan: " + err.message));
}
function renderDaftarSoal(ujian) {
  const container = document.getElementById("listSoalUjian");
  if (!container) return;
  container.innerHTML = "";

  if (!ujian.soal || ujian.soal.length === 0) {
    container.innerHTML = `<p class="text-muted small">Belum ada soal ditambahkan.</p>`;
    return;
  }

  ujian.soal.forEach((s, idx) => {
    const item = document.createElement("div");
    item.className = "card mb-2 border-0 bg-light";
    item.innerHTML = `
      <div class="card-body p-2 d-flex justify-content-between align-items-center">
        <div>
          <span class="badge bg-secondary me-1">${idx + 1}. ${(s.tipe || 'pg').toUpperCase()}</span>
          <span class="fw-bold text-dark">${(s.pertanyaan || '').substring(0, 60)}${s.pertanyaan && s.pertanyaan.length > 60 ? '...' : ''}</span>
        </div>
        <button class="btn btn-sm btn-outline-danger" onclick="hapusSoal('${s.id}')">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    `;
    container.appendChild(item);
  });
}

window.hapusSoal = (soalId) => {
  const u = daftarUjian.find(item => item.id === activeUjianId);
  if (!u || !u.soal) return;

  if (confirm("Hapus soal ini?")) {
    const listSoalBaru = u.soal.filter(s => s.id !== soalId);
    simpanSoalUjianAktif(activeUjianId, listSoalBaru);
  }
};

/* ===================================================
   2. KELOLA AKUN GURU & EDIT/RESET PASSWORD (ADMIN ONLY)
   =================================================== */
async function handleTambahGuru(e) {
  e.preventDefault();
  const nama = document.getElementById("guruNama").value.trim();
  const email = document.getElementById("guruEmail").value.trim();
  const password = document.getElementById("guruPassword").value;
  const mapel = document.getElementById("guruMapel").value.trim();

  try {
    const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
    const secondaryAuth = getAuth(secondaryApp);

    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = cred.user.uid;

    const dataPengguna = { uid, nama, email, mapel, role: "guru" };
    await set(ref(db, "pengguna/" + uid), dataPengguna);
    await secondaryAuth.signOut();

    alert(`Akun Guru ${nama} berhasil dibuat!`);
    document.getElementById("formTambahGuru").reset();
    const modalEl = document.getElementById("modalTambahGuru");
    if (modalEl && window.bootstrap) bootstrap.Modal.getInstance(modalEl)?.hide();

  } catch (err) {
    console.error("Gagal buat guru:", err);
    alert("Gagal membuat akun guru: " + err.message);
  }
}

window.openModalEditGuru = (uid) => {
  const g = daftarPengguna.find(p => p.uid === uid);
  if (!g) return;

  document.getElementById("editGuruUid").value = g.uid;
  document.getElementById("editGuruNama").value = g.nama || "";
  document.getElementById("editGuruEmail").value = g.email || "";
  document.getElementById("editGuruMapel").value = g.mapel || "";
  document.getElementById("editGuruPassword").value = "";

  const modalEl = document.getElementById("modalEditGuru");
  if (modalEl && window.bootstrap) bootstrap.Modal.getOrCreateInstance(modalEl).show();
};

async function handleSimpanEditGuru(e) {
  e.preventDefault();
  const uid = document.getElementById("editGuruUid").value;
  const nama = document.getElementById("editGuruNama").value.trim();
  const mapel = document.getElementById("editGuruMapel").value.trim();
  const newPassword = document.getElementById("editGuruPassword").value.trim();

  try {
    await update(ref(db, "pengguna/" + uid), { nama, mapel });

    if (newPassword) {
      alert(`Profil Guru ${nama} berhasil diperbarui!\n\nCatatan: Untuk penyetelan password baru (${newPassword}), silakan beritahukan kepada guru untuk login menggunakan password tersebut.`);
    } else {
      alert(`Profil Guru ${nama} berhasil diperbarui!`);
    }

    const modalEl = document.getElementById("modalEditGuru");
    if (modalEl && window.bootstrap) bootstrap.Modal.getInstance(modalEl)?.hide();

  } catch (err) {
    alert("Gagal memperbarui data guru: " + err.message);
  }
}

window.hapusGuru = (uid, nama) => {
  if (confirm(`Apakah Anda yakin ingin menghapus akun Guru "${nama}"?`)) {
    remove(ref(db, "pengguna/" + uid))
      .then(() => alert(`Akun Guru "${nama}" berhasil dihapus!`))
      .catch(err => alert("Gagal menghapus: " + err.message));
  }
};

function renderTabelPengguna() {
  const tbody = document.getElementById("tbodyPengguna");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (daftarPengguna.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">Belum ada akun guru terdaftar di Database.</td></tr>`;
    return;
  }

  daftarPengguna.forEach((p, i) => {
    const isSelfAdmin = (p.role === 'admin');
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="fw-bold">${p.nama || '-'}</td>
      <td>${p.email || '-'}</td>
      <td><span class="badge bg-info text-dark">${p.mapel || 'Semua Mapel'}</span></td>
      <td><span class="badge ${isSelfAdmin ? 'bg-danger' : 'bg-primary'}">${(p.role || 'guru').toUpperCase()}</span></td>
      <td>
        ${!isSelfAdmin ? `
          <button class="btn btn-sm btn-outline-warning me-1" onclick="openModalEditGuru('${p.uid}')" title="Edit / Reset Password">
            <i class="bi bi-pencil-square"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="hapusGuru('${p.uid}', '${p.nama}')" title="Hapus Akun">
            <i class="bi bi-trash"></i>
          </button>
        ` : `<span class="badge bg-light text-muted border">Utama</span>`}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ===================================================
   3. DATA SISWA, CETAK KARTU, FILTER & REKAP NILAI
   =================================================== */
function handleSimpanSiswa(e) {
  e.preventDefault();
  const nisn = document.getElementById("siswaNisn").value.trim();
  const nama = document.getElementById("siswaNama").value.trim();
  const kelas = document.getElementById("siswaKelas").value.trim();
  const cleanKey = nisn.replace(/[.#$\[\]]/g, "_");

  set(ref(db, "daftarSiswa/" + cleanKey), { nisn, nama, kelas })
    .then(() => {
      alert("Data siswa berhasil disimpan!");
      document.getElementById("formSiswa").reset();
      const modalEl = document.getElementById("modalSiswa");
      if (modalEl && window.bootstrap) bootstrap.Modal.getInstance(modalEl)?.hide();
    })
    .catch((err) => alert("Gagal menyimpan siswa: " + err.message));
}

window.cetakKartuUjianSiswa = () => {
  const filterKelas = document.getElementById("filterKelasSiswa")?.value.toLowerCase().trim() || "";
  const container = document.getElementById("containerKartuUjian");
  if (!container) return;

  const siswaFiltered = daftarSiswa.filter(s => {
    const k = (s.kelas || "").toLowerCase().trim();
    return filterKelas ? (k === filterKelas) : true;
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
              <tr><td width="30%" class="py-1">NISN</td><td class="py-1">: <strong>${s.nisn}</strong></td></tr>
              <tr><td class="py-1">Nama</td><td class="py-1">: <strong>${s.nama}</strong></td></tr>
              <tr><td class="py-1">Kelas</td><td class="py-1">: <strong>${s.kelas || '-'}</strong></td></tr>
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

  // Render QR code secara lokal untuk setiap kartu yang dicetak
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

  // Berikan jeda 300ms agar QR code selesai dirender oleh script lokal sebelum dialog print muncul
  setTimeout(() => {
    window.print();
  }, 300);
};

function importSiswaExcel(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const workbook = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
    const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    let countAdded = 0;
    json.forEach(row => {
      const nisn = String(row.NISN || row.nisn || "").trim();
      const nama = String(row.NAMA || row.Nama || row.nama || "").trim();
      const kelas = String(row.KELAS || row.Kelas || row.kelas || "").trim();
      if (nisn && nama) {
        const cleanKey = nisn.replace(/[.#$\[\]]/g, "_");
        set(ref(db, "daftarSiswa/" + cleanKey), { nisn, nama, kelas });
        countAdded++;
      }
    });
    alert(`Berhasil mengimpor ${countAdded} data siswa!`);
    event.target.value = "";
  };
  reader.readAsArrayBuffer(file);
}

function importExcelSoal(event) {
  const file = event.target.files[0];
  if (!file || !activeUjianId) return;

  const u = daftarUjian.find(item => item.id === activeUjianId);
  if (!u) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const workbook = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
    const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    let countAdded = 0;
    const soalBaruList = u.soal ? [...u.soal] : [];

    json.forEach(row => {
      const tipe = String(row.Tipe || row.tipe || "pg").trim().toLowerCase();
      const pertanyaan = String(row.Pertanyaan || row.pertanyaan || "").trim();
      const gambarUrl = String(row.GambarURL || row.gambarUrl || row.Gambar || "").trim();

      if (!pertanyaan) return;

      let itemSoal = {
        id: "SOAL-" + Date.now() + Math.random().toString(36).substr(2, 4),
        tipe, pertanyaan, gambarUrl
      };

      if (tipe === "pg") {
        itemSoal.opsi = {
          A: String(row.A || ""), B: String(row.B || ""), C: String(row.C || ""), D: String(row.D || ""), E: String(row.E || "")
        };
        itemSoal.kunci = String(row.Kunci || "A").toUpperCase().trim();
      } else if (tipe === "pg_kompleks") {
        itemSoal.opsi = {
          A: String(row.A || ""), B: String(row.B || ""), C: String(row.C || ""), D: String(row.D || ""), E: String(row.E || "")
        };
        itemSoal.kunci = String(row.Kunci || "").split(",").map(k => k.toUpperCase().trim()).filter(k => k);
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

    simpanSoalUjianAktif(activeUjianId, soalBaruList)
      .then(() => {
        alert(`Berhasil mengimpor ${countAdded} soal!`);
        event.target.value = "";
      })
      .catch(err => alert("Gagal mengimpor soal ke Firebase: " + err.message));
  };
  reader.readAsArrayBuffer(file);
}

window.filterDataSiswa = () => {
  const filterKelas = document.getElementById("filterKelasSiswa")?.value.toLowerCase().trim() || "";
  const keyword = document.getElementById("searchSiswa")?.value.toLowerCase().trim() || "";

  const hasilFiltered = daftarSiswa.filter(s => {
    const k = (s.kelas || "").toLowerCase().trim();
    const nama = (s.nama || "").toLowerCase();
    const nisn = (s.nisn || "").toLowerCase();

    let matchKelas = filterKelas ? (k === filterKelas) : true;
    let matchSearch = keyword ? (nama.includes(keyword) || nisn.includes(keyword)) : true;

    return matchKelas && matchSearch;
  });

  renderTabelSiswaFiltered(hasilFiltered);
};

function renderTabelSiswaFiltered(listSiswa) {
  const tbody = document.getElementById("tbodySiswa");
  const totalBadge = document.getElementById("totalSiswaTampil");
  if (!tbody) return;
  
  if (totalBadge) totalBadge.innerText = `${listSiswa.length} Siswa`;
  tbody.innerHTML = "";

  if (listSiswa.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">Data siswa tidak ditemukan.</td></tr>`;
    return;
  }

  listSiswa.forEach((s, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="font-monospace">${s.nisn || '-'}</td>
      <td class="fw-bold">${s.nama || '-'}</td>
      <td><span class="badge bg-secondary">${s.kelas || '-'}</span></td>
      <td>
        <button class="btn btn-sm btn-outline-danger" onclick="hapusSiswa('${s.nisn}')">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* FILTER & RENDER REKAP NILAI */
window.filterRekapNilai = () => {
  const kelasSelected = document.getElementById("selectFilterKelas")?.value.toLowerCase().trim() || "";
  const ujianSelected = document.getElementById("selectFilterUjian")?.value || "";

  const filteredHasil = hasilUjian.filter(h => {
    const kelasSiswa = (h.kelas || "").toLowerCase().trim();
    const ujianId = h.ujianId || "";

    let matchKelas = kelasSelected ? (kelasSiswa === kelasSelected) : true;
    let matchUjian = ujianSelected ? (ujianId === ujianSelected) : true;

    return matchKelas && matchUjian;
  });

  renderTabelNilai(filteredHasil);
};

function renderTabelNilai(listHasil = hasilUjian) {
  const tbody = document.getElementById("tbodyNilai");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (listHasil.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-3">Tidak ada hasil ujian yang sesuai dengan filter.</td></tr>`;
    return;
  }

  listHasil.forEach((h, i) => {
    // h.id atau key unik dari Firebase hasil ujian
    const resultId = h.id;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="font-monospace">${h.nisn || '-'}</td>
      <td class="fw-bold">${h.nama || '-'} <span class="badge bg-light text-dark border ms-1">${h.kelas || '-'}</span></td>
      <td>${h.mapel || '-'} - ${h.judul || '-'}</td>
      <td><span class="badge bg-success fs-6">${h.nilai || 0}</span></td>
      <td class="small text-muted">${h.waktuSelesai || '-'}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-danger fw-bold" onclick="hapusHasilUjian('${resultId}')">
          <i class="bi bi-trash-fill me-1"></i>Hapus
        </button>
      </td>
    `;
    
    tbody.appendChild(tr);
  });

function updateFilterUjianDropdown() {
  const selectUjian = document.getElementById("selectFilterUjian");
  if (!selectUjian) return;
  
  // Ambil daftar unik ujian dari data yang ada
  const daftarUjian = [...new Set(hasilUjian.map(h => h.judul))];
  selectUjian.innerHTML = `<option value="">-- Semua Ujian --</option>`;
  
  daftarUjian.forEach(judul => {
    if (judul) {
      const opt = document.createElement("option");
      opt.value = judul;
      opt.textContent = judul;
      selectUjian.appendChild(opt);
    }
  });
}

/* EXPOSE GLOBALS TO WINDOW */
window.openModalTambahUjian = () => {
  document.getElementById("formUjian")?.reset();
  const tokenEl = document.getElementById("ujianToken");
  if (tokenEl) tokenEl.value = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  // Panggil fungsi updateGuruDropdown agar daftar guru langsung terisi saat modal dibuka
  updateGuruDropdown();

  const modalEl = document.getElementById("modalUjian");
  if (modalEl && window.bootstrap) bootstrap.Modal.getOrCreateInstance(modalEl).show();
};

window.openModalTambahSiswa = () => {
  document.getElementById("formSiswa")?.reset();
  const modalEl = document.getElementById("modalSiswa");
  if (modalEl && window.bootstrap) bootstrap.Modal.getOrCreateInstance(modalEl).show();
};

window.hapusUjian = (id) => {
  if (confirm("Hapus ujian beserta seluruh soalnya?")) remove(ref(db, "daftarUjian/" + id));
};

window.openModalSoal = (ujianId) => {
  activeUjianId = ujianId;
  const u = daftarUjian.find(item => item.id === ujianId);
  if (!u) return;

  const displayKelas = Array.isArray(u.kelasTarget) ? u.kelasTarget.join(", ") : (u.kelasTarget || 'Semua');
  const titleEl = document.getElementById("judulUjianSoal");
  if (titleEl) titleEl.innerText = `${u.mapel} [${displayKelas}] - ${u.judul}`;
  document.getElementById("formTambahSoal")?.reset();
  if (window.switchTipeSoal) window.switchTipeSoal("pg");

  renderDaftarSoal(u);

  const modalEl = document.getElementById("modalKelolaSoal");
  if (modalEl && window.bootstrap) bootstrap.Modal.getOrCreateInstance(modalEl).show();
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
window.hapusSiswa = (nisn) => {
  if (confirm("Hapus siswa ini?")) {
    const cleanKey = String(nisn).replace(/[.#$\[\]]/g, "_");
    remove(ref(db, "daftarSiswa/" + cleanKey));
  }
};

window.downloadTemplateSiswa = () => {
  const data = [
    { NISN: "0081234561", NAMA: "Ahmad Rizky", KELAS: "X IPA 1" },
    { NISN: "0081234562", NAMA: "Siti Nurhaliza", KELAS: "XI IPS 1" }
  ];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template Siswa");
  XLSX.writeFile(wb, "Template_Data_Siswa.xlsx");
};

window.downloadTemplateSoal = () => {
  const data = [
    { Tipe: "pg", Pertanyaan: "Perhatikan gambar berikut, perangkat ini adalah?", GambarURL: "https://via.placeholder.com/300", A: "Keyboard", B: "Mouse", C: "Monitor", D: "Printer", E: "Scanner", Kunci: "B", Pasangan: "" },
    { Tipe: "pg_kompleks", Pertanyaan: "Manakah yang merupakan OS?", GambarURL: "", A: "Windows", B: "Linux", C: "Word", D: "Excel", E: "MacOS", Kunci: "A,B,E", Pasangan: "" },
    { Tipe: "mencocokkan", Pertanyaan: "Jodohkan istilah berikut!", GambarURL: "", A: "", B: "", C: "", D: "", E: "", Kunci: "", Pasangan: "CPU=Otak Komputer;RAM=Memori Sementara" }
  ];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template Soal");
  XLSX.writeFile(wb, "Template_Soal_Lengkap.xlsx");
};

window.downloadRekapNilaiPerKelas = (kelasFilter, ujianIdFilter) => {
  if (hasilUjian.length === 0) return alert("Belum ada data nilai!");

  let dataFiltered = hasilUjian.filter(item => {
    let matchKelas = true, matchUjian = true;
    if (kelasFilter) matchKelas = (item.kelas && item.kelas.trim().toLowerCase() === kelasFilter.trim().toLowerCase());
    if (ujianIdFilter) matchUjian = (item.ujianId === ujianIdFilter);
    return matchKelas && matchUjian;
  });

  if (dataFiltered.length === 0) return alert("Data nilai tidak ditemukan!");

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
  XLSX.writeFile(wb, `Rekap_Nilai_CBT_${kelasFilter || 'Semua'}.xlsx`);
};
/* ===================================================
   TAMBAHAN FITUR: MODAL KELOLA, LIHAT, & EDIT SOAL
   =================================================== */

let currentUjianActive = null;
let currentUjianActiveKey = null;
let currentEditSoalIndex = null; // Penanda jika sedang mode edit soal

// Buka Modal Kelola Soal Berdasarkan ID Ujian
window.openModalSoal = (ujianId) => {
  const u = daftarUjian.find(item => item.id === ujianId);
  if (!u) return alert("Ujian tidak ditemukan!");

  currentUjianActive = u;
  currentUjianActiveKey = u.id;
  currentEditSoalIndex = null; // Reset mode edit

  // Set Judul di Header Modal
  const judulModal = document.getElementById("judulUjianSoal");
  if (judulModal) {
    judulModal.innerHTML = `<i class="bi bi-gear-fill me-2"></i>Kelola Soal: ${u.mapel} - ${u.judul}`;
  }

  // Reset form tambah/edit soal jika ada
  const formSoal = document.getElementById("formTambahSoal");
  if (formSoal) {
    formSoal.reset();
    const btnSubmit = formSoal.querySelector('button[type="submit"]');
    if (btnSubmit) {
      btnSubmit.innerHTML = `<i class="bi bi-plus-circle me-1"></i>Tambahkan Soal`;
      btnSubmit.className = "btn btn-primary w-100";
    }
  }

  // Render daftar soal yang sudah ada
  window.renderDaftarSoalInteraktif(u.soal || []);

  // Tampilkan Modal menggunakan Bootstrap
  const modalEl = document.getElementById("modalKelolaSoal");
  if (modalEl && window.bootstrap) {
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }
};

// Render Daftar Soal dengan Tampilan Kartu Interaktif, Badge, Opsi, & Tombol Edit/Hapus
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
    // Badge Tipe Soal
    let badgeTipe = '<span class="badge bg-primary me-1">PG</span>';
    if (soal.tipe === "pg_kompleks") {
      badgeTipe = '<span class="badge bg-info text-dark me-1">PG Kompleks</span>';
    } else if (soal.tipe === "mencocokkan") {
      badgeTipe = '<span class="badge text-white me-1" style="background-color: #6f42c1;">Menjodohkan</span>';
    }

    // Detail Opsi Pilihan A-E atau Pasangan Menjodohkan
    let detailOpsi = "";
    if ((soal.tipe === "pg" || soal.tipe === "pg_kompleks" || !soal.tipe) && soal.opsi) {
      detailOpsi = `
        <ul class="list-unstyled mb-2 text-secondary small ps-1">
          ${soal.opsi.A ? `<li>• A. ${soal.opsi.A}</li>` : ""}
          ${soal.opsi.B ? `<li>• B. ${soal.opsi.B}</li>` : ""}
          ${soal.opsi.C ? `<li>• C. ${soal.opsi.C}</li>` : ""}
          ${soal.opsi.D ? `<li>• D. ${soal.opsi.D}</li>` : ""}
          ${soal.opsi.E ? `<li>• E. ${soal.opsi.E}</li>` : ""}
        </ul>`;
    } else if (soal.tipe === "mencocokkan" && soal.pasangan) {
      detailOpsi = `
        <div class="bg-light p-2 rounded mb-2 border small">
          <strong>Pasangan:</strong>
          ${soal.pasangan.map(p => `<div>• ${p.kiri} <i class="bi bi-arrow-right"></i> ${p.kanan}</div>`).join("")}
        </div>`;
    }

    // Format Kunci Jawaban
    let kunciText = Array.isArray(soal.kunci) ? soal.kunci.join(", ") : (soal.kunci || "-");

    html += `
      <div class="card mb-3 border shadow-sm">
        <div class="card-body p-3">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <div>
              <span class="badge bg-dark me-1">Soal ke-${index + 1}</span>
              ${badgeTipe}
            </div>
            <div class="btn-group btn-group-sm" role="group">
              <button class="btn btn-outline-warning text-dark px-2" onclick="isiFormEditSoal(${index})" title="Edit Soal">
                <i class="bi bi-pencil me-1"></i>Edit
              </button>
              <button class="btn btn-outline-danger px-2" onclick="hapusSoalIndeks(${index})" title="Hapus Soal">
                <i class="bi bi-trash me-1"></i>Hapus
              </button>
            </div>
          </div>
          
          <p class="fw-semibold text-dark mb-2">${soal.pertanyaan}</p>
          ${soal.gambarUrl ? `<img src="${soal.gambarUrl}" class="img-fluid rounded mb-2" style="max-height: 150px;">` : ""}
          
          ${detailOpsi}
          
          <div>
            <span class="badge bg-success">Kunci: ${kunciText}</span>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
};

// Fungsi Mengisi Form Saat Tombol Edit Soal Ditekan
window.isiFormEditSoal = (index) => {
  if (!currentUjianActive || !currentUjianActive.soal || !currentUjianActive.soal[index]) return;

  const soal = currentUjianActive.soal[index];
  currentEditSoalIndex = index;

  // Set Tipe Soal
  const selectTipe = document.getElementById("soalTipe");
  if (selectTipe) {
    selectTipe.value = soal.tipe || "pg";
    if (typeof window.switchTipeSoal === "function") {
      window.switchTipeSoal(soal.tipe || "pg");
    }
  }

  // Isi Pertanyaan & Gambar
  document.getElementById("soalPertanyaan").value = soal.pertanyaan || "";
  document.getElementById("soalGambarUrl").value = soal.gambarUrl || "";

  // Isi Opsi PG / PG Kompleks
  if (soal.opsi) {
    if (document.getElementById("soalA")) document.getElementById("soalA").value = soal.opsi.A || "";
    if (document.getElementById("soalB")) document.getElementById("soalB").value = soal.opsi.B || "";
    if (document.getElementById("soalC")) document.getElementById("soalC").value = soal.opsi.C || "";
    if (document.getElementById("soalD")) document.getElementById("soalD").value = soal.opsi.D || "";
    if (document.getElementById("soalE")) document.getElementById("soalE").value = soal.opsi.E || "";
  }

  // Isi Kunci Jawaban
  if (soal.tipe === "pg" || !soal.tipe) {
    if (document.getElementById("soalKunciPG")) document.getElementById("soalKunciPG").value = soal.kunci || "A";
  } else if (soal.tipe === "pg_kompleks") {
    ["A", "B", "C", "D", "E"].forEach(opt => {
      const chk = document.getElementById(`kunciKompleks${opt}`);
      if (chk) {
        chk.checked = Array.isArray(soal.kunci) ? soal.kunci.includes(opt) : (soal.kunci === opt);
      }
    });
  }

  // Ubah Teks Tombol Submit Form Menjadi Simpan Perubahan
  const btnSubmit = document.querySelector('#formTambahSoal button[type="submit"]');
  if (btnSubmit) {
    btnSubmit.innerHTML = `<i class="bi bi-check-circle me-1"></i>Simpan Perubahan Soal`;
    btnSubmit.className = "btn btn-warning w-100 fw-bold";
  }
};

// Hapus Soal Berdasarkan Indeks
window.hapusSoalIndeks = (index) => {
  if (!currentUjianActive || !currentUjianActive.soal) return;

  if (confirm("Apakah Anda yakin ingin menghapus soal ini?")) {
    let listSoal = [...currentUjianActive.soal];
    listSoal.splice(index, 1);

    simpanSoalUjianAktif(currentUjianActiveKey, listSoal)
      .then(() => {
        currentUjianActive.soal = listSoal;
        window.renderDaftarSoalInteraktif(listSoal);
        alert("Soal berhasil dihapus!");
      })
      .catch(err => alert("Gagal menghapus soal: " + err.message));
  }
};

// Modifikasi Listener Submit Form Soal (Mendukung Tambah & Edit Sekaligus)
const formTambahSoalEl = document.getElementById("formTambahSoal");
if (formTambahSoalEl) {
  formTambahSoalEl.onsubmit = (e) => {
    e.preventDefault();
    if (!currentUjianActiveKey) return alert("Pilih ujian terlebih dahulu!");

    const tipe = document.getElementById("soalTipe").value;
    const pertanyaan = document.getElementById("soalPertanyaan").value.trim();
    const gambarUrl = document.getElementById("soalGambarUrl")?.value.trim() || "";

    let itemSoal = {
      id: currentEditSoalIndex !== null && currentUjianActive.soal[currentEditSoalIndex]
        ? currentUjianActive.soal[currentEditSoalIndex].id
        : "SOAL-" + Date.now(),
      tipe, 
      pertanyaan, 
      gambarUrl
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
      ['A', 'B', 'C', 'D', 'E'].forEach(opt => {
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

    let listSoal = currentUjianActive.soal ? [...currentUjianActive.soal] : [];

    // Variabel penyimpan indeks edit sementara sebelum di-reset
    const isEditMode = currentEditSoalIndex !== null;

    if (isEditMode) {
      // Mode Edit: Timpa soal pada indeks tersebut
      listSoal[currentEditSoalIndex] = itemSoal;
      currentEditSoalIndex = null;
    } else {
      // Mode Tambah Baru: Masukkan ke array
      listSoal.push(itemSoal);
    }

    simpanSoalUjianAktif(currentUjianActiveKey, listSoal)
      .then(() => {
        alert(isEditMode ? "Perubahan soal berhasil disimpan!" : "Soal berhasil ditambahkan!");
        e.target.reset();
        if (window.switchTipeSoal) window.switchTipeSoal("pg");

        // Kembalikan tombol ke mode tambah
        const btnSubmit = e.target.querySelector('button[type="submit"]');
        if (btnSubmit) {
          btnSubmit.innerHTML = `<i class="bi bi-plus-circle me-1"></i>Tambahkan Soal`;
          btnSubmit.className = "btn btn-primary w-100";
        }

        currentUjianActive.soal = listSoal;
        window.renderDaftarSoalInteraktif(listSoal);
      })
      .catch((err) => alert("Gagal menyimpan soal: " + err.message));
  };
} 

/* ===================================================
   FITUR TAMBAHAN: DOWNLOAD ARSIP SOAL KE EXCEL
   =================================================== */
window.downloadArsipSoal = () => {
  if (!currentUjianActive || !currentUjianActive.soal || currentUjianActive.soal.length === 0) {
    return alert("Tidak ada soal dalam ujian ini untuk diunduh!");
  }

  const excelData = currentUjianActive.soal.map((s, index) => {
    let kunciFormatted = "";
    if (Array.isArray(s.kunci)) {
      kunciFormatted = s.kunci.join(", ");
    } else {
      kunciFormatted = s.kunci || "";
    }

    let pasanganFormatted = "";
    if (s.tipe === "mencocokkan" && s.pasangan) {
      pasanganFormatted = s.pasangan.map(p => `${p.kiri}=${p.kanan}`).join("; ");
    }

    return {
      "No": index + 1,
      "Tipe": (s.tipe || "pg").toUpperCase(),
      "Pertanyaan": s.pertanyaan || "",
      "GambarURL": s.gambarUrl || "",
      "A": s.opsi ? (s.opsi.A || "") : "",
      "B": s.opsi ? (s.opsi.B || "") : "",
      "C": s.opsi ? (s.opsi.C || "") : "",
      "D": s.opsi ? (s.opsi.D || "") : "",
      "E": s.opsi ? (s.opsi.E || "") : "",
      "Kunci": kunciFormatted,
      "Pasangan": pasanganFormatted
    };
  });

  const ws = XLSX.utils.json_to_sheet(excelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Arsip Soal");
  
  const namaFileClean = (currentUjianActive.judul || "Ujian").replace(/[^a-zA-Z0-9]/g, "_");
  XLSX.writeFile(wb, `Arsip_Soal_${namaFileClean}.xlsx`);
};

// FUNGSI DOWNLOAD ARSIP SOAL BERDASARKAN ID DARI TABEL UTAMA
window.downloadArsipSoalById = (ujianId) => {
  const u = daftarUjian.find(item => item.id === ujianId);
  if (!u || !u.soal || u.soal.length === 0) {
    return alert("Ujian ini belum memiliki soal untuk diunduh!");
  }

  const excelData = u.soal.map((s, index) => {
    let kunciFormatted = "";
    if (Array.isArray(s.kunci)) {
      kunciFormatted = s.kunci.join(", ");
    } else {
      kunciFormatted = s.kunci || "";
    }

    let pasanganFormatted = "";
    if (s.tipe === "mencocokkan" && s.pasangan) {
      pasanganFormatted = s.pasangan.map(p => `${p.kiri}=${p.kanan}`).join("; ");
    }

    return {
      "No": index + 1,
      "Tipe": (s.tipe || "pg").toUpperCase(),
      "Pertanyaan": s.pertanyaan || "",
      "GambarURL": s.gambarUrl || "",
      "A": s.opsi ? (s.opsi.A || "") : "",
      "B": s.opsi ? (s.opsi.B || "") : "",
      "C": s.opsi ? (s.opsi.C || "") : "",
      "D": s.opsi ? (s.opsi.D || "") : "",
      "E": s.opsi ? (s.opsi.E || "") : "",
      "Kunci": kunciFormatted,
      "Pasangan": pasanganFormatted
    };
  });

  const ws = XLSX.utils.json_to_sheet(excelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Arsip Soal");
  
  const namaFileClean = (u.judul || "Ujian").replace(/[^a-zA-Z0-9]/g, "_");
  XLSX.writeFile(wb, `Arsip_Soal_${u.mapel}_${namaFileClean}.xlsx`);
};

// ===================================================
// FUNGSI PENGISIAN DROPDOWN GURU PEMBUAT SOAL (FILTERED)
// ===================================================
function updateGuruDropdown(mapelUjian = "") {
  const selectPembuat = document.getElementById("ujianPembuat");
  if (!selectPembuat) return;

  const currVal = selectPembuat.value;
  selectPembuat.innerHTML = '<option value="">-- Pilih Guru Pengampu --</option>';

  const addedNames = new Set();

  if (daftarPengguna && daftarPengguna.length > 0) {
    daftarPengguna.forEach(p => {
      // Pastikan hanya mengambil user yang rolenya benar-benar 'guru'
      const isGuru = p.role && p.role.toLowerCase() === "guru";
      
      // Jika mapel ujian dipilih, kita bisa sesuaikan atau tampilkan semua guru yang aktif
      if (isGuru && p.nama && !addedNames.has(p.nama)) {
        addedNames.add(p.nama);
        const opt = document.createElement("option");
        opt.value = p.nama; // Nilai yang disimpan adalah nama guru
        opt.textContent = `${p.nama} - ${p.mapel || 'Guru Pengampu'}`;
        selectPembuat.appendChild(opt);
      }
    });
  }
} // <-- INI TANDA TUTUP YANG SEBELUMNYA KURANG UNTUK FUNGSI updateGuruDropdown


// ==========================================
// FUNGSI EDIT UJIAN OLEH GURU / ADMIN
// ==========================================
window.bukaModalEditUjian = (ujianId) => {
  const ujianRef = ref(db, `daftarUjian/${ujianId}`);
  get(ujianRef).then((snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      document.getElementById("editUjianId").value = ujianId;
      document.getElementById("editJudulUjian").value = data.judul || "";
      document.getElementById("editDurasiUjian").value = data.durasi || "";
      
      const modalEl = document.getElementById("modalEditUjian");
      if (modalEl && window.bootstrap) {
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
      }
    } else {
      alert("Data ujian tidak ditemukan!");
    }
  }).catch((error) => {
    alert("Gagal memuat data ujian: " + error.message);
  });
};
window.simpanPerubahanUjian = (e) => {
  if (e) e.preventDefault();
  
  const ujianId = document.getElementById("editUjianId").value;
  const judulBaru = document.getElementById("editJudulUjian").value.trim();
  const durasiBaru = document.getElementById("editDurasiUjian").value.trim();

  if (!ujianId || !judulBaru || !durasiBaru) {
    alert("Mohon lengkapi semua data!");
    return;
  }

  update(ref(db, `daftarUjian/${ujianId}`), {
    judul: judulBaru,
    durasi: durasiBaru
  }).then(() => {
    alert("Ujian berhasil diperbarui!");
    const modalEl = document.getElementById("modalEditUjian");
    if (modalEl && window.bootstrap) {
      bootstrap.Modal.getInstance(modalEl)?.hide();
    }
    if (typeof renderTabelUjian === 'function') renderTabelUjian();
  }).catch((error) => {
    alert("Gagal memperbarui ujian: " + error.message);
  });
};

document.addEventListener("DOMContentLoaded", () => {
  const formEdit = document.getElementById("formEditUjian");
  if (formEdit) {
    formEdit.addEventListener("submit", window.simpanPerubahanUjian);
  }
});
// ==========================================
// FUNGSI RESET STATUS PESERTA OLEH ADMIN
// ==========================================
window.resetStatusPeserta = async (ujianId, nisn) => {
  if (confirm(`Yakin ingin mereset status siswa dengan NISN ${nisn}? Siswa akan diizinkan masuk kembali menggunakan token ujian.`)) {
    try {
      await remove(ref(db, `statusPeserta/${ujianId}/${nisn}`));
      alert("Status peserta berhasil direset! Siswa kini dapat login kembali.");
      if (typeof renderTabelMonitoring === 'function') renderTabelMonitoring();
    } catch (error) {
      alert("Gagal mereset status: " + error.message);
    }
  }
};
// --- LOAD PILIHAN UJIAN DI MENU MONITORING ---
window.loadDaftarUjianMonitoring = () => {
  const selectUjian = document.getElementById("selectUjianMonitoring");
  if (!selectUjian) return;

  onValue(ref(db, "daftarUjian"), (snapshot) => {
    selectUjian.innerHTML = `<option value="">-- Pilih Mata Pelajaran / Ujian --</option>`;
    if (snapshot.exists()) {
      snapshot.forEach((childSnap) => {
        const ujianId = childSnap.key;
        const data = childSnap.val();
        selectUjian.innerHTML += `<option value="${ujianId}">${data.mapel || 'Mapel'} - ${data.judul || 'Ujian'} (Token: ${data.token || '-'})</option>`;
      });
    }
  });
};

// --- LOAD PILIHAN UJIAN DI MENU MONITORING ---
window.loadDaftarUjianMonitoring = () => {
  const selectUjian = document.getElementById("selectUjianMonitoring");
  if (!selectUjian) return;

  onValue(ref(db, "daftarUjian"), (snapshot) => {
    selectUjian.innerHTML = `<option value="">-- Pilih Mata Pelajaran / Ujian --</option>`;
    if (snapshot.exists()) {
      snapshot.forEach((childSnap) => {
        const ujianId = childSnap.key;
        const data = childSnap.val();
        selectUjian.innerHTML += `<option value="${ujianId}">${data.mapel || 'Mapel'} - ${data.judul || 'Ujian'} (Token: ${data.token || '-'})</option>`;
      });
    }
  });
};

// --- LOAD DATA STATUS PESERTA SECARA REAL-TIME ---
window.loadDataMonitoring = () => {
  const ujianId = document.getElementById("selectUjianMonitoring").value;
  const tbody = document.getElementById("tabelMonitoringBody");
  
  if (!ujianId) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">Silakan pilih jadwal ujian terlebih dahulu di atas.</td></tr>`;
    return;
  }

  onValue(ref(db, `statusPeserta/${ujianId}`), (snapshot) => {
    tbody.innerHTML = "";
    if (!snapshot.exists()) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">Belum ada siswa yang login/mengerjakan ujian ini.</td></tr>`;
      return;
    }

    let no = 1;
    snapshot.forEach((childSnap) => {
      const nisn = childSnap.key;
      const s = childSnap.val();

      let badgeStatus = "";
      if (s.status === "sedang_mengerjakan") {
        badgeStatus = `<span class="badge bg-warning text-dark"><i class="bi bi-clock-history me-1"></i>Sedang Mengerjakan</span>`;
      } else if (s.status === "terlempar") {
        badgeStatus = `<span class="badge bg-danger"><i class="bi bi-exclamation-triangle-fill me-1"></i>Terlempar / Terkunci</span>`;
      } else if (s.status === "selesai") {
        badgeStatus = `<span class="badge bg-success"><i class="bi bi-check-circle-fill me-1"></i>Selesai</span>`;
      } else {
        badgeStatus = `<span class="badge bg-secondary">${s.status}</span>`;
      }

      let tombolAksi = `
        <button class="btn btn-sm btn-danger fw-bold" onclick="resetStatusPeserta('${ujianId}', '${nisn}')">
          <i class="bi bi-arrow-clockwise me-1"></i>Reset Peserta
        </button>
      `;

      tbody.innerHTML += `
        <tr>
          <td>${no++}</td>
          <td>${s.nisn}</td>
          <td class="fw-bold">${s.nama}</td>
          <td>${s.kelas}</td>
          <td>${badgeStatus}</td>
          <td>${s.waktuMulai || '-'}</td>
          <td class="text-center">${tombolAksi}</td>
        </tr>
      `;
    });
  });
};

// Panggil otomatis saat tab Monitoring diklik
document.addEventListener("DOMContentLoaded", () => {
  const tabMonitoring = document.getElementById("tabMonitoring");
  if (tabMonitoring) {
    tabMonitoring.addEventListener("click", () => {
      window.loadDaftarUjianMonitoring();
    });
  }
});
// --- FUNGSI HAPUS HASIL UJIAN SISWA ---
window.hapusHasilUjian = async (resultId) => {
  if (confirm("Apakah Anda yakin ingin menghapus data hasil ujian siswa ini?")) {
    try {
      // Sesuaikan path database hasil ujian Anda, contoh: "hasilUjian/{resultId}"
      await remove(ref(db, `hasilUjian/${resultId}`));
      alert("Data hasil ujian berhasil dihapus.");
      // Panggil ulang fungsi pemuat data rekap jika ada
      if (typeof loadRekapNilai === "function") {
        loadRekapNilai();
      }
    } catch (error) {
      console.error("Gagal menghapus data:", error);
      alert("Terjadi kesalahan saat menghapus data.");
    }
  }
};
};
