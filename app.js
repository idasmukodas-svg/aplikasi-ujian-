/* ===================================================
   APP.JS - LMS & CBT SMAN 1 TARAJU (WITH PRINT CARDS & MULTI-CLASS)
   =================================================== */

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, remove, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
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
const storedUser = sessionStorage.getItem("userLoggedIn") || localStorage.getItem("cbt_current_user") || localStorage.getItem("userSession");

if (!storedUser) {
  window.location.href = "login.html";
} else {
  userSession = JSON.parse(storedUser);
  window.userSession = userSession; // Set global langsung agar bisa diakses modul lain
}

let daftarUjian = [];
let daftarSiswa = [];
let hasilUjian = [];
let daftarPengguna = [];
let daftarKelas = [];
let activeUjianId = null;

document.addEventListener("DOMContentLoaded", async () => {
  if (!userSession) return;

  // Sinkronkan ulang profil terbaru dari Firebase jika user adalah guru
  // Gunakan userSession.uid atau userSession.id (sesuaikan dengan database Anda)
  const userId = userSession.uid || userSession.id;
  if (userSession.role === "guru" && userId) {
    try {
      const snapUser = await get(ref(db, "pengguna/" + userId));
      if (snapUser.exists()) {
        userSession = { ...userSession, ...snapUser.val() };
        window.userSession = userSession;
        sessionStorage.setItem("userLoggedIn", JSON.stringify(userSession));
      }
    } catch (err) {
      console.error("Gagal menyinkronkan profil guru:", err);
    }
  }

  if (typeof renderUserInfoNav === "function") {
    renderUserInfoNav();
  }
});

// 2. Load Realtime Data Ujian (Aman untuk Admin & Guru)
  onValue(ref(db, "daftarUjian"), (snapshot) => {
    const data = snapshot.val();
    const rawList = data ? Object.entries(data).map(([key, val]) => ({ id: key, ...val })) : [];

    const session = window.userSession || (typeof userSession !== 'undefined' ? userSession : {});

    // Jika Admin, tampilkan seluruh ujian tanpa filter
    if (!session || session.role === "admin") {
      daftarUjian = rawList;
    } else {
      // Jika Guru, filter ketat berdasarkan Mapel DAN Kelas yang Diampu
      const mapelGuru = (session.mapel || session.mataPelajaran || "").toLowerCase().trim();
      const kelasDiampu = Array.isArray(session.kelasDiampu) ? session.kelasDiampu : [];
      const namaGuru = (session.nama || "").toLowerCase().trim();
      const usernameGuru = (session.username || "").toLowerCase().trim();

      daftarUjian = rawList.filter(u => {
        const mapelUjian = (u.mapel || "").toLowerCase().trim();
        const targetKelas = Array.isArray(u.kelasTarget) ? u.kelasTarget : [];
        const pembuatUjian = (u.createdBy || u.pembuatUsername || "").toLowerCase().trim();

        // 1. Cek apakah dibuat sendiri oleh guru tersebut
        const dibuatSendiri = (namaGuru && pembuatUjian.includes(namaGuru)) || 
                              (usernameGuru && pembuatUjian.includes(usernameGuru));
        if (dibuatSendiri) return true;

        // 2. Cek kecocokan Mata Pelajaran
        const cocokMapel = !mapelGuru || mapelUjian === mapelGuru || mapelUjian.includes(mapelGuru) || mapelGuru.includes(mapelUjian);

        // 3. Cek kecocokan Kelas Target dengan Kelas yang Diampu guru
        const cocokKelas = kelasDiampu.length === 0 || 
                           targetKelas.includes("Semua") || 
                           targetKelas.some(k => kelasDiampu.includes(k));

        // Ujian hanya lolos jika Mapel cocok DAN Kelas target masuk dalam daftar kelas diampu
        return cocokMapel && cocokKelas;
      });
    }

    window.daftarUjian = daftarUjian;

    if (typeof renderStats === "function") renderStats();
    if (typeof window.renderTabelUjian === "function") window.renderTabelUjian();
    if (typeof window.updateFilterUjianDropdown === "function") window.updateFilterUjianDropdown();

    const activeId = window.currentUjianActiveKey || (typeof activeUjianId !== "undefined" ? activeUjianId : "");
    if (activeId) {
      const activeUjian = daftarUjian.find(u => u.id === activeId);
      if (activeUjian) {
        window.currentUjianActive = activeUjian;
        if (typeof window.renderDaftarSoalInteraktif === "function") {
          window.renderDaftarSoalInteraktif(activeUjian.soal || []);
        }
      }
    }
  });
  // 2. Load Realtime Data Ujian (Aman untuk Admin & Guru)
  onValue(ref(db, "daftarUjian"), (snapshot) => {
    const data = snapshot.val();
    const rawList = data ? Object.entries(data).map(([key, val]) => ({ id: key, ...val })) : [];

    const session = window.userSession || (typeof userSession !== 'undefined' ? userSession : {});

    // Jika Admin, tampilkan seluruh ujian tanpa filter
    if (!session || session.role === "admin") {
      daftarUjian = rawList;
    } else {
      // Jika Guru, filter ketat berdasarkan Mapel DAN Kelas yang Diampu
      const mapelGuru = (session.mapel || session.mataPelajaran || "").toLowerCase().trim();
      const kelasDiampu = Array.isArray(session.kelasDiampu) ? session.kelasDiampu : [];
      const namaGuru = (session.nama || "").toLowerCase().trim();
      const usernameGuru = (session.username || "").toLowerCase().trim();

      daftarUjian = rawList.filter(u => {
        const mapelUjian = (u.mapel || "").toLowerCase().trim();
        const targetKelas = Array.isArray(u.kelasTarget) ? u.kelasTarget : [];
        const pembuatUjian = (u.createdBy || u.pembuatUsername || "").toLowerCase().trim();

        // 1. Cek apakah dibuat sendiri oleh guru tersebut
        const dibuatSendiri = (namaGuru && pembuatUjian.includes(namaGuru)) || 
                              (usernameGuru && pembuatUjian.includes(usernameGuru));
        if (dibuatSendiri) return true;

        // 2. Cek kecocokan Mata Pelajaran
        const cocokMapel = !mapelGuru || mapelUjian === mapelGuru || mapelUjian.includes(mapelGuru) || mapelGuru.includes(mapelUjian);

        // 3. Cek kecocokan Kelas Target dengan Kelas yang Diampu guru
        const cocokKelas = kelasDiampu.length === 0 || 
                           targetKelas.includes("Semua") || 
                           targetKelas.some(k => kelasDiampu.includes(k));

        // Ujian hanya lolos jika Mapel cocok DAN Kelas target masuk dalam daftar kelas diampu
        return cocokMapel && cocokKelas;
      });
    }

    window.daftarUjian = daftarUjian;

    if (typeof renderStats === "function") renderStats();
    if (typeof window.renderTabelUjian === "function") window.renderTabelUjian();
    if (typeof window.updateFilterUjianDropdown === "function") window.updateFilterUjianDropdown();

    const activeId = window.currentUjianActiveKey || (typeof activeUjianId !== "undefined" ? activeUjianId : "");
    if (activeId) {
      const activeUjian = daftarUjian.find(u => u.id === activeId);
      if (activeUjian) {
        window.currentUjianActive = activeUjian;
        if (typeof window.renderDaftarSoalInteraktif === "function") {
          window.renderDaftarSoalInteraktif(activeUjian.soal || []);
        }
      }
    }
  });
// 3. Load Realtime Data Siswa (Aman untuk Admin & Guru)
  onValue(ref(db, "daftarSiswa"), (snapshot) => {
    const data = snapshot.val();
    
    // Ubah data Firebase (baik format array maupun objek key-value) menjadi array murni
    let rawSiswa = [];
    if (data) {
      if (Array.isArray(data)) {
        rawSiswa = data.filter(Boolean); // Bersihkan dari elemen null jika ada
      } else {
        rawSiswa = Object.values(data);
      }
    }

    const session = window.userSession || (typeof userSession !== 'undefined' ? userSession : {});

    // Jika Admin, tampilkan seluruh siswa tanpa filter
    if (!session || session.role === "admin") {
      daftarSiswa = rawSiswa;
    } else {
      // Jika Guru, filter hanya siswa yang berada di kelas yang diampu (kelasDiampu)
      const kelasDiampu = Array.isArray(session.kelasDiampu) ? session.kelasDiampu : [];
      
      if (kelasDiampu.length > 0) {
        daftarSiswa = rawSiswa.filter((s) => {
          const kelasSiswa = (s.kelas || "").toString().trim();
          // Cocokkan apakah kelas siswa ada di dalam daftar kelas yang diampu guru
          return kelasDiampu.includes(kelasSiswa);
        });
      } else {
        // Jika guru belum mengatur kelas diampu, jangan tampilkan semua (atau kosongkan agar aman)
        daftarSiswa = [];
      }
    }

    window.daftarSiswa = daftarSiswa;

    // Perbarui statistik dan tampilan tabel siswa
    if (typeof renderStats === "function") renderStats();
    if (typeof window.filterDataSiswa === "function") {
      window.filterDataSiswa();
    } else if (typeof renderTabelSiswa === "function") {
      renderTabelSiswa(daftarSiswa);
    }
  });

// Event Listeners Form & Input
document.addEventListener("DOMContentLoaded", () => {
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
    if (typeof window.switchTipeSoal === "function") window.switchTipeSoal(e.target.value);
  });

  document.getElementById("btnExportRekap")?.addEventListener("click", () => {
    const kelas = document.getElementById("selectFilterKelas")?.value || "";
    const ujianId = document.getElementById("selectFilterUjian")?.value || "";
    if (typeof window.downloadRekapNilaiPerKelas === "function") {
      window.downloadRekapNilaiPerKelas(kelas, ujianId);
    }
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

function updateFilterUjianDropdown() {
  const selectUjian = document.getElementById("selectFilterUjian");
  if (!selectUjian) return;
  
  selectUjian.innerHTML = '<option value="">-- Pilih Mata Pelajaran / Ujian --</option>';
  const sumberUjian = window.daftarUjian || [];
  
  sumberUjian.forEach(ujian => {
    const namaUjian = ujian.judul || ujian.mapel || ujian.namaUjian;
    if (namaUjian) {
      const opt = document.createElement("option");
      opt.value = namaUjian;
      opt.textContent = namaUjian;
      selectUjian.appendChild(opt);
    }
  });
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
   1. KELOLA UJIAN & BANK SOAL
   =================================================== */
window.renderTabelUjian = function() {
  const tbody = document.getElementById("tbodyUjian");
  if (!tbody) return;
  tbody.innerHTML = "";

  // Ambil sumber data dengan aman
  const dataSumber = Array.isArray(window.daftarUjian)
    ? window.daftarUjian
    : (typeof daftarUjian !== "undefined" && Array.isArray(daftarUjian) ? daftarUjian : []);

  // Fungsi bantuan untuk memperbarui angka keterangan di atas tabel/dashboard
  const updateKeteranganUjian = (listUjian) => {
    const totalUjian = listUjian.length;
    const totalSoal = listUjian.reduce((sum, item) => sum + (Array.isArray(item.soal) ? item.soal.length : 0), 0);

    // Perbarui elemen keterangan jika ID-nya ada di index.html
    ["statTotalUjian", "totalUjian", "infoJumlahUjian", "countUjian"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = totalUjian;
    });

    ["statTotalSoal", "totalSoal", "infoJumlahSoal", "countSoal"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = totalSoal;
    });

    const elKet = document.getElementById("keteranganDaftarUjian");
    if (elKet) {
      elKet.textContent = `Menampilkan ${totalUjian} ujian (${totalSoal} soal) sesuai kelas yang Anda ampu`;
    }
  };

  if (dataSumber.length === 0) {
    updateKeteranganUjian([]);
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-3">Belum ada jadwal ujian/bank soal di Database.</td></tr>`;
    return;
  }

  // Filter data berdasarkan guru yang login & kelas yang diampu
  let dataTampil = dataSumber;
  if (window.userSession && window.userSession.role !== "admin") {
    const session = window.userSession;
    const namaLogin = (session.nama || "").toLowerCase().trim();
    const usernameLogin = (session.username || "").toLowerCase().trim();
    const mapelGuru = (session.mapel || session.mataPelajaran || "").toLowerCase().trim();
    const kelasDiampu = Array.isArray(session.kelasDiampu) ? session.kelasDiampu : [];

    dataTampil = dataSumber.filter(u => {
      const pembuat = (u.createdBy || "").toLowerCase().trim();
      const usernamePembuat = (u.pembuatUsername || "").toLowerCase().trim();
      const mapelUjian = (u.mapel || "").toLowerCase().trim();
      const targetUjian = Array.isArray(u.kelasTarget) ? u.kelasTarget : [];

      // 1. Cek apakah dibuat langsung oleh guru ini
      const isPembuat =
        (namaLogin && (pembuat === namaLogin || usernamePembuat === namaLogin)) ||
        (usernameLogin && (pembuat === usernameLogin || usernamePembuat === usernameLogin));

      // 2. Cek kecocokan kelas yang diampu jika guru memiliki daftar kelasDiampu
      const cocokKelas =
        kelasDiampu.length === 0 ||
        targetUjian.includes("Semua") ||
        targetUjian.some(k => kelasDiampu.includes(k));

      if (isPembuat) return cocokKelas;

      // 3. Jika ujian kolaborasi/mapel yang sama, wajib cocok mapel DAN kelas yang diampu
      if (mapelGuru && mapelUjian === mapelGuru && kelasDiampu.length > 0) {
        return cocokKelas;
      }

      return false;
    });
  }

  // Sinkronkan keterangan angka berdasarkan dataTampil yang sudah terfilter
  updateKeteranganUjian(dataTampil);

  if (dataTampil.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-3">Belum ada jadwal ujian/bank soal untuk kelas yang Anda ampu.</td></tr>`;
    return;
  }

  dataTampil.forEach((u, i) => {
    const jmlSoal = u.soal ? u.soal.length : 0;
    const isAktif = u.status === "aktif";
    const statusBadge = isAktif
      ? `<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Aktif</span>`
      : `<span class="badge bg-secondary"><i class="bi bi-x-circle me-1"></i>Nonaktif</span>`;

    const displayKelas = Array.isArray(u.kelasTarget) ? u.kelasTarget.join(", ") : (u.kelasTarget || "Semua");

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><span class="badge bg-secondary">${u.mapel || "-"}</span></td>
      <td><span class="badge bg-dark">${displayKelas}</span></td>
      <td>
        <div class="fw-bold">${u.judul || "-"}</div>
        <small class="text-muted font-monospace" style="font-size: 11px;">ID: ${u.id}</small>
      </td>
      <td>${u.durasi || 0} Mns</td>
      <td><span class="badge bg-info text-dark font-monospace">${u.token || "-"}</span></td>
      <td>
        <div class="form-check form-switch cursor-pointer" title="Klik untuk mengubah status">
          <input class="form-check-input" type="checkbox" role="switch" id="switch-${u.id}" ${isAktif ? "checked" : ""} onchange="toggleStatusUjian('${u.id}', '${u.status || "nonaktif"}')">
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
};

function handleSimpanUjian(e) {
  e.preventDefault();
  
  // Tentukan pembuat dan mata pelajaran berdasarkan sesi login
  let pembuatInput = "";
  let usernamePembuat = "";
  let idGuruAktif = "";
  let mapelInput = "";

  if (window.userSession && window.userSession.role !== "admin") {
    pembuatInput = window.userSession.nama || window.userSession.username || "Guru";
    usernamePembuat = window.userSession.username || window.userSession.nama || "";
    idGuruAktif = window.userSession.uid || "";
    // Otomatis ambil mapel dari profil guru yang login (terkunci)
    mapelInput = window.userSession.mapel || window.userSession.mataPelajaran || "";
  } else {
    const selectPembuat = document.getElementById("ujianPembuat");
    pembuatInput = selectPembuat ? selectPembuat.value : "Admin";
    usernamePembuat = pembuatInput;
    idGuruAktif = "admin_" + Date.now();
    // Jika admin yang membuat, ambil dari input form
    const inputMapelEl = document.getElementById("ujianMapel");
    mapelInput = inputMapelEl ? inputMapelEl.value.trim() : "";
  }

  if (!pembuatInput) {
    return alert("Identitas pembuat ujian tidak valid!");
  }

  if (!mapelInput) {
    return alert("Mata pelajaran tidak boleh kosong!");
  }

  const judul = document.getElementById("ujianJudul").value.trim();
  const durasi = document.getElementById("ujianDurasi").value;
  const token = document.getElementById("ujianToken").value.trim();
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

  if (selectedKelas.length === 0) {
    return alert("Pilih minimal satu target kelas!");
  }

  // KUNCI UTAMA: Buat ID unik berbasis ID Guru agar tidak saling menimpa antar guru
  const id = "ujian_" + idGuruAktif + "_" + Date.now();
  
  const newUjian = {
    id, 
    idGuru: idGuruAktif,
    mapel: mapelInput, 
    kelasTarget: selectedKelas, 
    judul, 
    durasi: parseInt(durasi), 
    token, 
    status, 
    soal: [],
    createdBy: pembuatInput,
    pembuatUsername: usernamePembuat,
    createdAt: Date.now()
  };

  set(ref(db, "daftarUjian/" + id), newUjian)
    .then(() => {
      alert("Ujian Berhasil Disimpan & Diamankan untuk Mapel Anda!");
      const modalEl = document.getElementById("modalUjian");
      if (modalEl && window.bootstrap) {
        bootstrap.Modal.getInstance(modalEl)?.hide();
      }
      document.getElementById("formUjian")?.reset();

      // Masukkan data secara instan ke array lokal agar langsung tampil di tabel
      if (Array.isArray(window.daftarUjian)) {
        window.daftarUjian.push(newUjian);
      } else if (typeof daftarUjian !== 'undefined' && Array.isArray(daftarUjian)) {
        daftarUjian.push(newUjian);
      }

      // Segarkan tampilan tabel
      if (typeof window.renderTabelUjian === "function") {
        window.renderTabelUjian();
      }
    })
    .catch((err) => {
      console.error("Gagal menyimpan ujian:", err);
      alert("Gagal menyimpan: " + err.message);
    });
}

window.toggleStatusUjian = (id, currentStatus) => {
  const newStatus = (currentStatus === "aktif") ? "nonaktif" : "aktif";
  update(ref(db, `daftarUjian/${id}`), { status: newStatus })
    .catch((err) => {
      alert("Gagal mengubah status ujian: " + err.message);
    });
};

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
   2. KELOLA AKUN GURU & EDIT/RESET PASSWORD
   =================================================== */
async function handleTambahGuru(e) {
  e.preventDefault();
  const nama = document.getElementById("guruNama").value.trim();
  const email = document.getElementById("guruEmail").value.trim();
  const password = document.getElementById("guruPassword").value;
  const mapel = document.getElementById("guruMapel").value.trim();
  
  // Ambil data kelas yang diampu dari checkbox di form tambah guru
  const kelasDiampu = [];
  document.querySelectorAll('.guruKelasCheckbox:checked').forEach((checkbox) => {
      kelasDiampu.push(checkbox.value);
  });

  if (kelasDiampu.length === 0) {
      alert("Pilih minimal satu kelas yang diampu oleh guru ini!");
      return;
  }

  try {
    const secondaryApp = getApps().find(app => app.name === "SecondaryApp") 
      ? getApp("SecondaryApp") 
      : initializeApp(firebaseConfig, "SecondaryApp");
      
    const secondaryAuth = getAuth(secondaryApp);

    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = cred.user.uid;

    const dataPengguna = { uid, nama, email, mapel, kelasDiampu, role: "guru" };
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

async function handleSimpanEditGuru(e) {
  e.preventDefault();
  const uid = document.getElementById("editGuruUid").value;
  const nama = document.getElementById("editGuruNama").value.trim();
  const mapel = document.getElementById("editGuruMapel").value.trim();
  const newPassword = document.getElementById("editGuruPassword").value.trim();

  // Ambil pembaruan kelas yang diampu dari form edit
  const kelasDiampu = [];
  document.querySelectorAll('.editGuruKelasCheckbox:checked').forEach((checkbox) => {
      kelasDiampu.push(checkbox.value);
  });

  try {
    // Update data di database termasuk kelasDiampu
    await update(ref(db, "pengguna/" + uid), { 
      nama, 
      mapel, 
      kelasDiampu 
    });

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

window.renderTabelPengguna = function() {
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
};

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
}

/* EXPOSE GLOBALS TO WINDOW */
window.openModalTambahUjian = async () => {
  document.getElementById("formUjian")?.reset();
  
  const tokenEl = document.getElementById("ujianToken");
  if (tokenEl) tokenEl.value = Math.random().toString(36).substring(2, 8).toUpperCase();

  const selectPembuat = document.getElementById("ujianPembuat");
  const mapelInput = document.getElementById("ujianMapel");

  let namaGuru = "";
  let mapelGuru = "";
  let kelasDiampuGuru = [];

  if (window.userSession) {
    namaGuru = window.userSession.nama || window.userSession.username || "";
    mapelGuru = window.userSession.mapel || window.userSession.mataPelajaran || "";
    kelasDiampuGuru = window.userSession.kelasDiampu || [];
  }

  // Jika yang login adalah GURU (bukan admin)
  if (window.userSession && window.userSession.role !== "admin") {
    if (selectPembuat) {
      let opsiAda = Array.from(selectPembuat.options).some(opt => opt.value.toLowerCase() === namaGuru.toLowerCase());
      if (!opsiAda && namaGuru) {
        const opt = document.createElement("option");
        opt.value = namaGuru;
        opt.textContent = namaGuru;
        selectPembuat.appendChild(opt);
      }
      if (namaGuru) selectPembuat.value = namaGuru;
      selectPembuat.disabled = true;
    }

    if (mapelInput) {
      mapelInput.value = mapelGuru;
      mapelInput.disabled = true;
    }
  } else {
    if (selectPembuat) {
      selectPembuat.disabled = false;
      if (typeof updateGuruDropdown === "function") updateGuruDropdown();
    }
    if (mapelInput) {
      mapelInput.value = "";
      mapelInput.disabled = false;
    }
  }

  // RENDER TARGET KELAS BERDASARKAN HAK AMPU
  const containerCheck = document.getElementById("containerCheckboxKelas");
  if (containerCheck) {
    containerCheck.innerHTML = `<small class="text-muted">Memuat kelas...</small>`;

    let listKelasAktif = window.daftarKelas || [];
    if (listKelasAktif.length === 0) {
      try {
        const snapshot = await get(ref(db, "daftarKelas"));
        if (snapshot.exists()) {
          listKelasAktif = Object.values(snapshot.val());
          window.daftarKelas = listKelasAktif;
        }
      } catch (err) {
        console.error("Gagal memuat kelas:", err);
      }
    }

    // Jika guru, filter hanya kelas yang diampu di profilnya
    if (window.userSession && window.userSession.role !== "admin") {
      listKelasAktif = listKelasAktif.filter(k => kelasDiampuGuru.includes(k.nama));
    }

    containerCheck.innerHTML = "";
    if (listKelasAktif.length === 0) {
      containerCheck.innerHTML = `<small class="text-danger">Tidak ada kelas hak ampu yang terdaftar. Silakan hubungi Admin untuk mencentang kelas ampu Anda di menu Kelola Akun Guru.</small>`;
    } else {
      listKelasAktif.forEach(k => {
        const div = document.createElement("div");
        div.className = "form-check mb-1";
        div.innerHTML = `
          <input class="form-check-input check-kelas-item" type="checkbox" value="${k.nama}" id="checkKelas_${k.nama}">
          <label class="form-check-label" for="checkKelas_${k.nama}">${k.nama}</label>
        `;
        containerCheck.appendChild(div);
      });
    }
  }

  const modalEl = document.getElementById("modalUjian");
  if (modalEl && window.bootstrap) bootstrap.Modal.getOrCreateInstance(modalEl).show();
};

// Deklarasikan variabel global di atas window.openModalSoal
window.currentUjianActive = null;
window.currentUjianActiveKey = "";
window.activeUjianId = "";

window.openModalSoal = (idUjian) => {
  // Pastikan daftarUjian tersedia dari global atau lokal
  const sumberUjian = Array.isArray(window.daftarUjian) 
    ? window.daftarUjian 
    : (typeof daftarUjian !== 'undefined' ? daftarUjian : null);

  if (!sumberUjian) {
    return alert("Data ujian belum dimuat, silakan refresh halaman.");
  }
  
  const u = sumberUjian.find(item => item.id === idUjian);
  if (!u) return alert("Ujian tidak ditemukan!");

  // Simpan referensi ujian aktif ke variabel global (window)
  window.currentUjianActive = u;
  window.currentUjianActiveKey = idUjian;
  window.activeUjianId = idUjian;

  // Render daftar soal ke dalam modal
  if (typeof window.renderDaftarSoalInteraktif === "function") {
    window.renderDaftarSoalInteraktif(u.soal || []);
  }

  // Buka modal kelola soal
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

window.hapusUjian = (id) => {
  if (confirm("Hapus ujian beserta seluruh soalnya?")) remove(ref(db, "daftarUjian/" + id));
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

window.openModalEditGuru = async (uid) => {
  const g = daftarPengguna.find(p => p.uid === uid);
  if (!g) return alert("Data guru tidak ditemukan!");

  document.getElementById("editGuruUid").value = g.uid;
  document.getElementById("editGuruNama").value = g.nama || "";
  document.getElementById("editGuruEmail").value = g.email || "";
  document.getElementById("editGuruMapel").value = g.mapel || "";
  document.getElementById("editGuruPassword").value = "";

  const container = document.getElementById("containerEditKelasGuru");
  if (container) {
    container.innerHTML = `<small class="text-muted">Memuat data kelas...</small>`;
    
    // Ambil data kelas terbaru jika variabel global masih kosong
    let listKelasAktif = window.daftarKelas || [];
    if (listKelasAktif.length === 0) {
      try {
        const snapshot = await get(ref(db, "daftarKelas"));
        if (snapshot.exists()) {
          const data = snapshot.val();
          listKelasAktif = Object.values(data);
          window.daftarKelas = listKelasAktif;
        }
      } catch (err) {
        console.error("Gagal memuat kelas:", err);
      }
    }

    container.innerHTML = "";
    const kelasDiampuDb = g.kelasDiampu || [];

    if (listKelasAktif.length > 0) {
      listKelasAktif.forEach(k => {
        const isChecked = kelasDiampuDb.includes(k.nama) ? "checked" : "";
        container.innerHTML += `
          <div class="form-check">
            <input class="form-check-input editGuruKelasCheckbox" type="checkbox" value="${k.nama}" id="editKls_${k.nama}" ${isChecked}>
            <label class="form-check-label" for="editKls_${k.nama}">${k.nama}</label>
          </div>
        `;
      });
    } else {
      container.innerHTML = `<small class="text-danger">Belum ada kelas terdaftar di menu Kelola Kelas.</small>`;
    }
  }

  const modalEl = document.getElementById("modalEditGuru");
  if (modalEl && window.bootstrap) {
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }
};

window.openModalTambahGuru = async () => {
  const formEl = document.getElementById("formTambahGuru");
  if (formEl) formEl.reset();
  
  const container = document.getElementById("containerTambahKelasGuru");
  if (container) {
    container.innerHTML = `<small class="text-muted">Memuat data kelas...</small>`;
    
    // Pastikan mengambil data kelas terbaru jika variabel global belum terisi
    let listKelasAktif = window.daftarKelas || [];
    if (listKelasAktif.length === 0) {
      try {
        const snapshot = await get(ref(db, "daftarKelas"));
        if (snapshot.exists()) {
          const data = snapshot.val();
          listKelasAktif = Object.values(data);
          window.daftarKelas = listKelasAktif; // Simpan ke global
        }
      } catch (err) {
        console.error("Gagal memuat kelas:", err);
      }
    }

    container.innerHTML = "";
    if (listKelasAktif.length > 0) {
      listKelasAktif.forEach(k => {
        container.innerHTML += `
          <div class="form-check">
            <input class="form-check-input guruKelasCheckbox" type="checkbox" value="${k.nama}" id="tambahKls_${k.nama}">
            <label class="form-check-label" for="tambahKls_${k.nama}">${k.nama}</label>
          </div>
        `;
      });
    } else {
      container.innerHTML = `<small class="text-danger">Belum ada kelas terdaftar di menu Kelola Kelas.</small>`;
    }
  }

  const modalEl = document.getElementById("modalTambahGuru");
  if (modalEl && window.bootstrap) {
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }
};

// Pastikan state global terinisialisasi dengan aman
window.currentUjianActive = window.currentUjianActive || null;
window.currentUjianActiveKey = window.currentUjianActiveKey || "";
window.currentEditSoalIndex = null; // Gunakan null secara konsisten untuk mode tambah baru

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
          
          <p class="fw-semibold text-dark mb-2">${soal.pertanyaan}</p>
          ${soal.gambarUrl ? `<img src="${soal.gambarUrl}" class="img-fluid rounded mb-2" style="max-height: 150px;">` : ""}
          ${detailOpsi}
          <div><span class="badge bg-success">Kunci: ${kunciText}</span></div>
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

  const selectTipe = document.getElementById("soalTipe");
  if (selectTipe) {
    selectTipe.value = soal.tipe || "pg";
    if (typeof window.switchTipeSoal === "function") {
      window.switchTipeSoal(soal.tipe || "pg");
    }
  }

  const elPertanyaan = document.getElementById("soalPertanyaan");
  const elGambar = document.getElementById("soalGambarUrl");
  if (elPertanyaan) elPertanyaan.value = soal.pertanyaan || "";
  if (elGambar) elGambar.value = soal.gambarUrl || "";

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

window.hapusSoalIndeks = (index) => {
  if (!window.currentUjianActive || !window.currentUjianActive.soal) return;

  if (confirm("Apakah Anda yakin ingin menghapus soal ini?")) {
    const listSoal = [...window.currentUjianActive.soal];
    listSoal.splice(index, 1);

    simpanSoalUjianAktif(window.currentUjianActiveKey, listSoal)
      .then(() => {
        window.currentUjianActive.soal = listSoal;
        window.renderDaftarSoalInteraktif(listSoal);
        alert("Soal berhasil dihapus!");
      })
      .catch(err => alert("Gagal menghapus soal: " + err.message));
  }
};

const formTambahSoalEl = document.getElementById("formTambahSoal");
if (formTambahSoalEl) {
  formTambahSoalEl.onsubmit = (e) => {
    e.preventDefault();
    if (!window.currentUjianActiveKey || !window.currentUjianActive) {
      return alert("Pilih ujian terlebih dahulu!");
    }

    const tipe = document.getElementById("soalTipe").value;
    const pertanyaan = document.getElementById("soalPertanyaan").value.trim();
    const gambarUrl = document.getElementById("soalGambarUrl")?.value.trim() || "";

    const listSoal = Array.isArray(window.currentUjianActive.soal)
      ? [...window.currentUjianActive.soal]
      : [];

    const isEditMode = window.currentEditSoalIndex !== null && window.currentEditSoalIndex >= 0;

    const itemSoal = {
      id: isEditMode && listSoal[window.currentEditSoalIndex]
        ? listSoal[window.currentEditSoalIndex].id
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
      window.currentEditSoalIndex = null;
    } else {
      listSoal.push(itemSoal);
    }

    simpanSoalUjianAktif(window.currentUjianActiveKey, listSoal)
      .then(() => {
        alert(isEditMode ? "Perubahan soal berhasil disimpan!" : "Soal berhasil ditambahkan!");
        e.target.reset();
        if (typeof window.switchTipeSoal === "function") window.switchTipeSoal("pg");

        const btnSubmit = e.target.querySelector('button[type="submit"]');
        if (btnSubmit) {
          btnSubmit.innerHTML = `<i class="bi bi-plus-circle me-1"></i>Tambahkan Soal`;
          btnSubmit.className = "btn btn-primary w-100";
        }

        window.currentUjianActive.soal = listSoal;
        window.renderDaftarSoalInteraktif(listSoal);
      })
      .catch((err) => alert("Gagal menyimpan soal: " + err.message));
  };
}

window.downloadArsipSoal = () => {
  if (!window.currentUjianActive || !window.currentUjianActive.soal || window.currentUjianActive.soal.length === 0) {
    return alert("Tidak ada soal dalam ujian ini untuk diunduh!");
  }

  const excelData = window.currentUjianActive.soal.map((s, index) => {
    const kunciFormatted = Array.isArray(s.kunci) ? s.kunci.join(", ") : (s.kunci || "");
    const pasanganFormatted = (s.tipe === "mencocokkan" && s.pasangan) ? s.pasangan.map(p => `${p.kiri}=${p.kanan}`).join("; ") : "";

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
  
  const namaFileClean = (window.currentUjianActive.judul || "Ujian").replace(/[^a-zA-Z0-9]/g, "_");
  XLSX.writeFile(wb, `Arsip_Soal_${namaFileClean}.xlsx`);
};

window.downloadArsipSoalById = (ujianId) => {
  const sumberUjian = Array.isArray(window.daftarUjian)
    ? window.daftarUjian
    : (typeof daftarUjian !== "undefined" ? daftarUjian : []);

  const u = sumberUjian.find(item => item.id === ujianId);
  if (!u || !u.soal || u.soal.length === 0) {
    return alert("Ujian ini belum memiliki soal untuk diunduh!");
  }

  const excelData = u.soal.map((s, index) => {
    const kunciFormatted = Array.isArray(s.kunci) ? s.kunci.join(", ") : (s.kunci || "");
    const pasanganFormatted = (s.tipe === "mencocokkan" && s.pasangan) ? s.pasangan.map(p => `${p.kiri}=${p.kanan}`).join("; ") : "";

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
function updateGuruDropdown() {
  const selectPembuat = document.getElementById("ujianPembuat");
  if (!selectPembuat) return;

  const currVal = selectPembuat.value;
  selectPembuat.innerHTML = '<option value="">-- Pilih Guru Pengampu --</option>';
  const addedNames = new Set();

  if (daftarPengguna && daftarPengguna.length > 0) {
    daftarPengguna.forEach(p => {
      const isGuru = p.role && p.role.toLowerCase() === "guru";
      if (isGuru && p.nama && !addedNames.has(p.nama)) {
        addedNames.add(p.nama);
        const opt = document.createElement("option");
        opt.value = p.nama;
        opt.textContent = `${p.nama} - ${p.mapel || 'Guru Pengampu'}`;
        selectPembuat.appendChild(opt);
      }
    });
  }
}

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

document.addEventListener("DOMContentLoaded", () => {
  const tabMonitoring = document.getElementById("tabMonitoring");
  if (tabMonitoring) {
    tabMonitoring.addEventListener("click", () => {
      window.loadDaftarUjianMonitoring();
    });
  }
});

window.hapusHasilUjian = async (resultId) => {
  if (confirm("Apakah Anda yakin ingin menghapus data hasil ujian siswa ini?")) {
    try {
      await remove(ref(db, `hasilUjian/${resultId}`));
      alert("Data hasil ujian berhasil dihapus.");
      if (typeof loadRekapNilai === "function") {
        loadRekapNilai();
      }
    } catch (error) {
      console.error("Gagal menghapus data:", error);
      alert("Terjadi kesalahan saat menghapus data.");
    }
  }
};

window.updateFilterUjianDropdown = function() {
  const selectUjian = document.getElementById("selectFilterUjian");
  if (!selectUjian) return;
  
  selectUjian.innerHTML = '<option value="">-- Pilih Mata Pelajaran / Ujian --</option>';
  const sumberUjian = window.daftarUjian || [];
  
  sumberUjian.forEach(ujian => {
    const namaUjian = ujian.judul || ujian.mapel || ujian.namaUjian;
    if (namaUjian) {
      const opt = document.createElement("option");
      opt.value = namaUjian;
      opt.textContent = namaUjian;
      selectUjian.appendChild(opt);
    }
  });
};
function handleTambahSoal(e) {
  if (e) e.preventDefault();
  // Fungsi penanganan form tambah soal interaktif
}

document.addEventListener("click", function(event) {
  const target = event.target.closest("button, a, div");
  if (target && target.textContent && target.textContent.includes("Monitoring Ujian")) {
    setTimeout(window.updateFilterUjianDropdown, 200);
  }
});
