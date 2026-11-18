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
  window.userSession = userSession;
}

let daftarUjian = [];
let daftarSiswa = [];
let hasilUjian = [];
let daftarPengguna = [];
let daftarKelas = [];
let activeUjianId = null;

document.addEventListener("DOMContentLoaded", async () => {
  if (!userSession) return;

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

// 1. Load Realtime Data Kelas
onValue(ref(db, "daftarKelas"), (snapshot) => {
  const data = snapshot.val();
  daftarKelas = data ? Object.values(data) : [];
  window.daftarKelas = daftarKelas;
  if (typeof renderListKelasModal === "function") renderListKelasModal();
  if (typeof updateAllClassDropdowns === "function") updateAllClassDropdowns();
});

// 2. Load Realtime Data Ujian (Aman untuk Admin & Guru)
onValue(ref(db, "daftarUjian"), (snapshot) => {
  const data = snapshot.val();
  const rawList = data ? Object.entries(data).map(([key, val]) => ({ id: key, ...val })) : [];

  const session = window.userSession || (typeof userSession !== 'undefined' ? userSession : {});

  if (!session || session.role === "admin") {
    daftarUjian = rawList;
  } else {
    let mapelGuruArray = [];
    if (Array.isArray(session.mapelDiampu) && session.mapelDiampu.length > 0) {
      mapelGuruArray = session.mapelDiampu.map(m => m.toLowerCase().trim());
    } else if (session.mapel) {
      mapelGuruArray = [session.mapel.toLowerCase().trim()];
    }

    let kelasDiampuArray = [];
    if (Array.isArray(session.kelasDiampu)) {
      kelasDiampuArray = session.kelasDiampu;
    } else if (typeof session.kelasDiampu === "string") {
      kelasDiampuArray = session.kelasDiampu.split(",").map(k => k.trim());
    }

    const namaGuru = (session.nama || "").toLowerCase().trim();
    const usernameGuru = (session.username || "").toLowerCase().trim();

    daftarUjian = rawList.filter(u => {
      const mapelUjian = (u.mapel || "").toLowerCase().trim();
      const targetKelas = Array.isArray(u.kelasTarget) ? u.kelasTarget : [];
      const pembuatUjian = (u.createdBy || u.pembuatUsername || "").toLowerCase().trim();

      const dibuatSendiri = (namaGuru && pembuatUjian.includes(namaGuru)) || 
                            (usernameGuru && pembuatUjian.includes(usernameGuru));
      if (dibuatSendiri) return true;

      const cocokMapel = mapelGuruArray.length === 0 || mapelGuruArray.includes(mapelUjian);
      const cocokKelas = kelasDiampuArray.length === 0 || 
                         targetKelas.includes("Semua") || 
                         targetKelas.some(k => kelasDiampuArray.includes(k));

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
  let rawSiswa = [];
  if (data) {
    if (Array.isArray(data)) {
      rawSiswa = data.filter(Boolean);
    } else {
      rawSiswa = Object.values(data);
    }
  }

  const session = window.userSession || (typeof userSession !== 'undefined' ? userSession : {});

  if (!session || session.role === "admin") {
    daftarSiswa = rawSiswa;
  } else {
    const kelasDiampu = Array.isArray(session.kelasDiampu) ? session.kelasDiampu : [];
    if (kelasDiampu.length > 0) {
      daftarSiswa = rawSiswa.filter((s) => {
        const kelasSiswa = (s.kelas || "").toString().trim();
        return kelasDiampu.includes(kelasSiswa);
      });
    } else {
      daftarSiswa = [];
    }
  }

  window.daftarSiswa = daftarSiswa;

  if (typeof renderStats === "function") renderStats();
  if (typeof window.filterDataSiswa === "function") {
    window.filterDataSiswa();
  } else if (typeof renderTabelSiswa === "function") {
    renderTabelSiswa(daftarSiswa);
  }
});

// 4. Load Realtime Hasil Ujian & Rekap
onValue(ref(db, "hasilUjian"), (snapshot) => {
  const data = snapshot.val();
  const rawHasil = data ? Object.entries(data).map(([key, val]) => ({ id: key, ...val })) : [];
   
  const session = window.userSession || (typeof userSession !== 'undefined' ? userSession : {});
  if (session && session.role === "guru") {
    let mapelGuruArray = [];
    if (Array.isArray(session.mapelDiampu) && session.mapelDiampu.length > 0) {
      mapelGuruArray = session.mapelDiampu.map(m => m.toLowerCase().trim());
    } else if (session.mapel) {
      mapelGuruArray = [session.mapel.toLowerCase().trim()];
    }

    const kelasDiampu = Array.isArray(session.kelasDiampu) ? session.kelasDiampu : [];

    hasilUjian = rawHasil.filter(h => {
      const mapelHasil = (h.mapel || "").toLowerCase().trim();
      const kelasSiswa = (h.kelas || "").toLowerCase().trim();
      
      const cocokMapel = mapelGuruArray.length === 0 || mapelGuruArray.includes(mapelHasil);
      const cocokKelas = kelasDiampu.length === 0 || kelasDiampu.some(k => k.toLowerCase().trim() === kelasSiswa);
      
      return cocokMapel && cocokKelas;
    });
  } else {
    hasilUjian = rawHasil;
  }

  window.hasilUjian = hasilUjian;
  if (typeof window.filterRekapNilai === "function") window.filterRekapNilai();
  if (typeof updateFilterUjianDropdown === "function") updateFilterUjianDropdown();
});

// 5. Load Pengguna & Master Mapel (Admin Only) & Render Checkbox Mapel Guru
onValue(ref(db, "pengguna"), (snapshot) => {
  const data = snapshot.val();
  daftarPengguna = data ? Object.values(data) : [];
  window.daftarPengguna = daftarPengguna;
  if (typeof renderTabelPengguna === "function") renderTabelPengguna();
  if (typeof updateGuruDropdown === "function") updateGuruDropdown();
});

onValue(ref(db, "daftarMapel"), (snapshot) => {
  const data = snapshot.val();
  const listMapelAdmin = document.getElementById("listMapelAdmin");
  
  let mapelArray = [];
  if (data) {
    mapelArray = Object.entries(data).map(([key, val]) => ({ id: key, nama: val.nama || val }));
  }
  window.daftarMapelMaster = mapelArray;

  if (listMapelAdmin) {
    listMapelAdmin.innerHTML = "";
    if (mapelArray.length === 0) {
      listMapelAdmin.innerHTML = `<li class="list-group-item text-muted text-center">Belum ada mata pelajaran.</li>`;
    } else {
      mapelArray.forEach(m => {
        const li = document.createElement("li");
        li.className = "list-group-item d-flex justify-content-between align-items-center";
        li.innerHTML = `
          <span>${m.nama}</span>
          <button class="btn btn-sm btn-danger" onclick="hapusMapel('${m.id}')">
            <i class="bi bi-trash"></i> Hapus
          </button>
        `;
        listMapelAdmin.appendChild(li);
      });
    }
  }

  // Render Checkbox untuk Form Tambah Guru
  const containerTambahMapel = document.getElementById("containerCheckboxMapel") || document.getElementById("containerTambahMapelGuru");
  if (containerTambahMapel) {
    containerTambahMapel.innerHTML = "";
    if (mapelArray.length === 0) {
      containerTambahMapel.innerHTML = `<small class="text-danger">Belum ada mata pelajaran terdaftar.</small>`;
    } else {
      mapelArray.forEach(m => {
        containerTambahMapel.innerHTML += `
          <div class="form-check mb-1">
            <input class="form-check-input guruMapelCheckbox" type="checkbox" value="${m.nama}" id="tambahMapel_${m.id}">
            <label class="form-check-label" for="tambahMapel_${m.id}">${m.nama}</label>
          </div>
        `;
      });
    }
  }
});

// Event Listener untuk Form Tambah Mapel
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("formTambahMapel")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const inputMapel = document.getElementById("inputNamaMapel");
    const namaMapel = inputMapel?.value.trim();
    if (!namaMapel) return;

    try {
      const newMapelRef = push(ref(db, "daftarMapel"));
      await set(newMapelRef, { nama: namaMapel });
      inputMapel.value = "";
      alert("Mata pelajaran berhasil ditambahkan!");
    } catch (err) {
      console.error("Gagal menambah mapel:", err);
      alert("Terjadi kesalahan saat menyimpan mapel.");
    }
  });
});

window.hapusMapel = async (idMapel) => {
  if (confirm("Yakin ingin menghapus mata pelajaran ini?")) {
    try {
      await remove(ref(db, "daftarMapel/" + idMapel));
      alert("Mata pelajaran berhasil dihapus!");
    } catch (err) {
      console.error("Gagal menghapus mapel:", err);
      alert("Gagal menghapus mata pelajaran.");
    }
  }
};

// Event Listeners Form & Input Lainnya
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("formUjian")?.addEventListener("submit", handleSimpanUjian);
  document.getElementById("formSiswa")?.addEventListener("submit", handleSimpanSiswa);
  document.getElementById("formTambahGuru")?.addEventListener("submit", handleTambahGuru);
  document.getElementById("formEditGuru")?.addEventListener("submit", handleSimpanEditGuru);
  document.getElementById("formTambahKelas")?.addEventListener("submit", handleSimpanKelas);
  document.getElementById("fileExcelSiswa")?.addEventListener("change", importSiswaExcel);
  document.getElementById("fileExcelSoal")?.addEventListener("change", importExcelSoal);

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
    const listMapel = Array.isArray(userSession.mapelDiampu) ? userSession.mapelDiampu.join(", ") : (userSession.mapel || '');
    userDisplayName.innerHTML = `<i class="bi bi-person-circle me-1"></i> ${userSession.nama || userSession.email} (${userSession.role === 'admin' ? 'ADMIN' : 'Guru ' + listMapel})`;
  }
}

window.logout = () => {
  signOut(auth).then(() => {
    sessionStorage.removeItem("userLoggedIn");
    localStorage.removeItem("cbt_current_user");
    localStorage.removeItem("userSession");
    window.location.href = "login.html";
  }).catch(() => {
    sessionStorage.removeItem("userLoggedIn");
    localStorage.removeItem("cbt_current_user");
    localStorage.removeItem("userSession");
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
      opt.value = ujian.id;
      opt.textContent = `${ujian.mapel || ''} - ${ujian.judul || ''}`;
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
  const session = window.userSession || (typeof userSession !== 'undefined' ? userSession : {});
  const isGuru = session && session.role === "guru";
  const kelasDiampuGuru = Array.isArray(session.kelasDiampu) ? session.kelasDiampu : [];

  let kelasTampil = daftarKelas;
  if (isGuru) {
    kelasTampil = daftarKelas.filter(k => kelasDiampuGuru.includes(k.nama));
  }

  const filterSiswa = document.getElementById("filterKelasSiswa");
  if (filterSiswa) {
    const currVal = filterSiswa.value;
    const filterSiswaHTML = isGuru ? '<option value="">-- Kelas Ampuan --</option>' : '<option value="">-- Semua Kelas --</option>';
    filterSiswa.innerHTML = filterSiswaHTML;
    
    kelasTampil.forEach(k => {
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
    const filterNilaiHTML = isGuru ? '<option value="">-- Pilih Kelas Ampuan --</option>' : '<option value="">-- Semua Kelas --</option>';
    filterNilai.innerHTML = filterNilaiHTML;
    
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
    kelasTampil.forEach(k => {
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
   1. KELOLA UJIAN & BANK SOAL
   =================================================== */
window.renderTabelUjian = function() {
  const tbody = document.getElementById("tbodyUjian");
  if (!tbody) return;
  tbody.innerHTML = "";

  const dataSumber = Array.isArray(window.daftarUjian) ? window.daftarUjian : [];

  if (dataSumber.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-3">Belum ada jadwal ujian/bank soal di Database.</td></tr>`;
    return;
  }

  dataSumber.forEach((u, i) => {
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
};

function handleSimpanUjian(e) {
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

  if (selectedKelas.length === 0) return alert("Pilih minimal satu target kelas!");

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
    })
    .catch((err) => {
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

/* ===================================================
   2. KELOLA AKUN GURU & EDIT/RESET PASSWORD (MULTI-MAPEL & KELAS)
   =================================================== */
window.handleTambahGuru = async (e) => {
  e.preventDefault();
  const nama = document.getElementById("guruNama").value.trim();
  const email = document.getElementById("guruEmail").value.trim();
  const password = document.getElementById("guruPassword").value;

  const mapelDiampu = [];
  document.querySelectorAll('.guruMapelCheckbox:checked').forEach((checkbox) => {
    mapelDiampu.push(checkbox.value);
  });

  const kelasDiampu = [];
  document.querySelectorAll('.guruKelasCheckbox:checked').forEach((checkbox) => {
    kelasDiampu.push(checkbox.value);
  });

  if (mapelDiampu.length === 0) {
    alert("Pilih minimal satu mata pelajaran yang diampu!");
    return;
  }
  if (kelasDiampu.length === 0) {
    alert("Pilih minimal satu kelas yang diampu!");
    return;
  }

  try {
    const secondaryApp = getApps().find(app => app.name === "SecondaryApp") 
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
      role: "guru" 
    };
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
};

async function handleSimpanEditGuru(e) {
  e.preventDefault();
  const uid = document.getElementById("editGuruUid").value;
  const nama = document.getElementById("editGuruNama").value.trim();
  const newPassword = document.getElementById("editGuruPassword").value.trim();

  const mapelDiampu = [];
  document.querySelectorAll('.editGuruMapelCheckbox:checked').forEach((checkbox) => {
    mapelDiampu.push(checkbox.value);
  });

  const kelasDiampu = [];
  document.querySelectorAll('.editGuruKelasCheckbox:checked').forEach((checkbox) => {
    kelasDiampu.push(checkbox.value);
  });

  if (mapelDiampu.length === 0) {
    alert("Pilih minimal satu mata pelajaran!");
    return;
  }
  if (kelasDiampu.length === 0) {
    alert("Pilih minimal satu kelas!");
    return;
  }

  try {
    await update(ref(db, "pengguna/" + uid), { 
      nama, 
      mapelDiampu,
      mapel: mapelDiampu[0],
      kelasDiampu 
    });

    alert(`Profil Guru ${nama} berhasil diperbarui!`);
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
    const listMapel = Array.isArray(p.mapelDiampu) ? p.mapelDiampu.join(", ") : (p.mapel || 'Semua Mapel');
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="fw-bold">${p.nama || '-'}</td>
      <td>${p.email || '-'}</td>
      <td><span class="badge bg-info text-dark">${listMapel}</span></td>
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
  if (!file || !window.activeUjianId) return;

  const sumberUjian = Array.isArray(window.daftarUjian) ? window.daftarUjian : [];
  const u = sumberUjian.find(item => item.id === window.activeUjianId);
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

    simpanSoalUjianAktif(window.activeUjianId, soalBaruList)
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
  
  const session = window.userSession || (typeof userSession !== 'undefined' ? userSession : {});
  const isGuru = session && session.role === "guru";
  const colspanNum = isGuru ? 4 : 5;
  
  if (totalBadge) totalBadge.innerText = `${listSiswa.length} Siswa`;
  tbody.innerHTML = "";

  if (listSiswa.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${colspanNum}" class="text-center text-muted py-3">Data siswa tidak ditemukan.</td></tr>`;
    return;
  }

  listSiswa.forEach((s, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="font-monospace">${s.nisn || '-'}</td>
      <td class="fw-bold">${s.nama || '-'}</td>
      <td><span class="badge bg-secondary">${s.kelas || '-'}</span></td>
      ${!isGuru ? `
      <td>
        <button class="btn btn-sm btn-outline-danger" onclick="hapusSiswa('${s.nisn}')">
          <i class="bi bi-trash"></i>
        </button>
      </td>` : ''}
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
  const selectMapelUjian = document.getElementById("ujianMapel");

  let namaGuru = "";
  let mapelGuruList = [];
  let kelasDiampuGuru = [];

  if (window.userSession) {
    namaGuru = window.userSession.nama || window.userSession.username || "";
    mapelGuruList = window.userSession.mapelDiampu || (window.userSession.mapel ? [window.userSession.mapel] : []);
    kelasDiampuGuru = window.userSession.kelasDiampu || [];
  }

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
      if (typeof updateGuruDropdown === "function") updateGuruDropdown();
    }
    if (selectMapelUjian) {
      selectMapelUjian.disabled = false;
      if (window.daftarMapelMaster) {
        selectMapelUjian.innerHTML = '<option value="">-- Pilih Mata Pelajaran --</option>';
        window.daftarMapelMaster.forEach(m => {
          selectMapelUjian.innerHTML += `<option value="${m.nama}">${m.nama}</option>`;
        });
      }
    }
  }

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

    if (window.userSession && window.userSession.role !== "admin") {
      listKelasAktif = listKelasAktif.filter(k => kelasDiampuGuru.includes(k.nama));
    }

    containerCheck.innerHTML = "";
    if (listKelasAktif.length === 0) {
      containerCheck.innerHTML = `<small class="text-danger">Tidak ada kelas hak ampu yang terdaftar.</small>`;
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

window.currentUjianActive = null;
window.currentUjianActiveKey = "";
window.activeUjianId = "";

window.openModalSoal = (idUjian) => {
  const sumberUjian = Array.isArray(window.daftarUjian) ? window.daftarUjian : [];
  const u = sumberUjian.find(item => item.id === idUjian);
  if (!u) return alert("Ujian tidak ditemukan!");

  window.currentUjianActive = u;
  window.currentUjianActiveKey = idUjian;
  window.activeUjianId = idUjian;

  if (typeof window.renderDaftarSoalInteraktif === "function") {
    window.renderDaftarSoalInteraktif(u.soal || []);
  }

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
  document.getElementById("editGuruPassword").value = "";

  // 1. Render Checkbox Mapel untuk Edit Guru
  const containerMapel = document.getElementById("containerEditMapelGuru");
  if (containerMapel) {
    containerMapel.innerHTML = `<small class="text-muted">Memuat mapel...</small>`;
    let listMapelAktif = window.daftarMapelMaster || [];
    containerMapel.innerHTML = "";
    
    // Ambil mapel yang sebelumnya diampu (bisa berupa array atau string tunggal)
    const mapelDb = Array.isArray(g.mapelDiampu) ? g.mapelDiampu : (g.mapel ? [g.mapel] : []);

    if (listMapelAktif.length > 0) {
      listMapelAktif.forEach(m => {
        const isChecked = mapelDb.includes(m.nama) ? "checked" : "";
        containerMapel.innerHTML += `
          <div class="form-check mb-1">
            <input class="form-check-input editGuruMapelCheckbox" type="checkbox" value="${m.nama}" id="editMapel_${m.id}" ${isChecked}>
            <label class="form-check-label" for="editMapel_${m.id}">${m.nama}</label>
          </div>
        `;
      });
    } else {
      containerMapel.innerHTML = `<small class="text-danger">Belum ada mata pelajaran terdaftar.</small>`;
    }
  }

  // 2. Render Checkbox Kelas untuk Edit Guru
  const containerKelas = document.getElementById("containerEditKelasGuru");
  if (containerKelas) {
    containerKelas.innerHTML = `<small class="text-muted">Memuat data kelas...</small>`;
    
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

    containerKelas.innerHTML = "";
    const kelasDiampuDb = g.kelasDiampu || [];

    if (listKelasAktif.length > 0) {
      listKelasAktif.forEach(k => {
        const isChecked = kelasDiampuDb.includes(k.nama) ? "checked" : "";
        containerKelas.innerHTML += `
          <div class="form-check mb-1">
            <input class="form-check-input editGuruKelasCheckbox" type="checkbox" value="${k.nama}" id="editKls_${k.nama}" ${isChecked}>
            <label class="form-check-label" for="editKls_${k.nama}">${k.nama}</label>
          </div>
        `;
      });
    } else {
      containerKelas.innerHTML = `<small class="text-danger">Belum ada kelas terdaftar.</small>`;
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
  
  // Render Checkbox Mapel untuk Tambah Guru
  const containerMapel = document.getElementById("containerCheckboxMapel") || document.getElementById("containerTambahMapelGuru");
  if (containerMapel) {
    containerMapel.innerHTML = "";
    let listMapelAktif = window.daftarMapelMaster || [];
    listMapelAktif.forEach(m => {
      containerMapel.innerHTML += `
        <div class="form-check mb-1">
          <input class="form-check-input guruMapelCheckbox" type="checkbox" value="${m.nama}" id="tambahMapel_${m.id}">
          <label class="form-check-label" for="tambahMapel_${m.id}">${m.nama}</label>
        </div>
      `;
    });
  }

  // Render Checkbox Kelas untuk Tambah Guru
  const containerKelas = document.getElementById("containerTambahKelasGuru");
  if (containerKelas) {
    containerKelas.innerHTML = `<small class="text-muted">Memuat data kelas...</small>`;
    
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

    containerKelas.innerHTML = "";
    if (listKelasAktif.length > 0) {
      listKelasAktif.forEach(k => {
        containerKelas.innerHTML += `
          <div class="form-check">
            <input class="form-check-input guruKelasCheckbox" type="checkbox" value="${k.nama}" id="tambahKls_${k.nama}">
            <label class="form-check-label" for="tambahKls_${k.nama}">${k.nama}</label>
          </div>
        `;
      });
    } else {
      containerKelas.innerHTML = `<small class="text-danger">Belum ada kelas terdaftar.</small>`;
    }
  }

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
  formTambahSoalEl.onsubmit = async (e) => {
    e.preventDefault();
    if (!window.currentUjianActiveKey || !window.currentUjianActive) {
      return alert("Pilih ujian terlebih dahulu!");
    }

    const tipe = document.getElementById("soalTipe").value;
    const pertanyaan = document.getElementById("soalPertanyaan").value.trim();

    // 1. Tangkap file gambar dari input file baru
    const fileInput = document.getElementById("soalGambarFile");
    let gambarUrlFinal = window.currentEditGambarLama || ""; 

    if (fileInput && fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      try {
        // Konversi file gambar ke Base64 agar tersimpan aman di Firebase
        gambarUrlFinal = await convertFileToBase64(file);
      } catch (err) {
        console.error("Gagal memproses gambar:", err);
        alert("Gagal membaca file gambar.");
        return;
      }
    }

    const listSoal = Array.isArray(window.currentUjianActive.soal) ? [...window.currentUjianActive.soal] : [];
    const isEditMode = window.currentEditSoalIndex !== null && window.currentEditSoalIndex >= 0;

    const itemSoal = {
      id: isEditMode && listSoal[window.currentEditSoalIndex]
        ? listSoal[window.currentEditSoalIndex].id
        : "SOAL-" + Date.now(),
      tipe,
      pertanyaan,
      gambarUrl: gambarUrlFinal // Berisi string base64 gambar
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
      window.currentEditGambarLama = null;
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

window.downloadArsipSoalById = (ujianId) => {
  const sumberUjian = Array.isArray(window.daftarUjian) ? window.daftarUjian : [];
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
        const listMapel = Array.isArray(p.mapelDiampu) ? p.mapelDiampu.join(", ") : (p.mapel || 'Guru Pengampu');
        opt.textContent = `${p.nama} - ${listMapel}`;
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
      
      // Memuat token ujian yang ada ke dalam input form edit
      const elToken = document.getElementById("editTokenUjian");
      if (elToken) elToken.value = data.token || "";
      
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
  const tokenBaru = document.getElementById("editTokenUjian")?.value.trim().toUpperCase() || ""; // Tangkap token baru

  if (!ujianId || !judulBaru || !durasiBaru || !tokenBaru) {
    alert("Mohon lengkapi semua data termasuk token!");
    return;
  }

  update(ref(db, `daftarUjian/${ujianId}`), {
    judul: judulBaru,
    durasi: durasiBaru,
    token: tokenBaru // Simpan token baru ke Firebase
  }).then(() => {
    alert("Ujian dan token berhasil diperbarui!");
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

  selectUjian.innerHTML = `<option value="">-- Pilih Mata Pelajaran / Ujian --</option>`;
  const sumberUjian = window.daftarUjian || [];
  
  sumberUjian.forEach(ujian => {
    const opt = document.createElement("option");
    opt.value = ujian.id;
    opt.textContent = `${ujian.mapel || 'Mapel'} - ${ujian.judul || 'Ujian'} (Token: ${ujian.token || '-'})`;
    selectUjian.appendChild(opt);
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
    } catch (error) {
      console.error("Gagal menghapus data:", error);
      alert("Terjadi kesalahan saat menghapus data.");
    }
  }
};

window.downloadRekapNilaiPerKelas = (kelasFilter, ujianIdFilter) => {
  if (!hasilUjian || hasilUjian.length === 0) return alert("Belum ada data nilai!");

  let dataFiltered = hasilUjian.filter(item => {
    let matchKelas = true, matchUjian = true;
    if (kelasFilter) matchKelas = (item.kelas && item.kelas.trim().toLowerCase() === kelasFilter.trim().toLowerCase());
    if (ujianIdFilter) matchUjian = (item.ujianId === ujianIdFilter || item.judul === ujianIdFilter || item.mapel === ujianIdFilter);
    return matchKelas && matchUjian;
  });

  if (dataFiltered.length === 0) return alert("Data nilai tidak ditemukan untuk filter tersebut!");

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
      opt.textContent = `${ujian.mapel || ''} - ${ujian.judul || ''}`;
      selectUjian.appendChild(opt);
    }
  });
  selectUjian.value = currVal;
};

document.addEventListener("click", function(event) {
  const target = event.target.closest("button, a, div");
  if (target && target.textContent && target.textContent.includes("Monitoring Ujian")) {
    setTimeout(window.updateFilterUjianDropdown, 200);
  }
});

// Sembunyikan fitur khusus Admin jika yang login adalah Guru
document.addEventListener("DOMContentLoaded", () => {
  const session = window.userSession || (typeof userSession !== 'undefined' ? userSession : {});
  if (session && session.role === "guru") {
    document.querySelectorAll("button, a").forEach(el => {
      const text = el.textContent.trim();
      if (text.includes("Tambah Guru") || text.includes("Kelola Kelas") || text.includes("Kelola Mata Pelajaran") || text.includes("Kelola Akun Guru")) {
        const container = el.closest('.btn, button, a, li');
        if (container) container.style.display = "none";
      }
    });

    document.querySelectorAll(".nav-link, .btn, button, a").forEach(el => {
      if (el.textContent.includes("Kelola Akun Guru")) {
        el.style.display = "none";
      }
    });
  }
});

// Penyesuaian Tampilan Berdasarkan Role (Guru vs Admin)
document.addEventListener("DOMContentLoaded", () => {
  const session = window.userSession || (typeof userSession !== 'undefined' ? userSession : {});
  const isGuru = session && session.role === "guru";

  if (isGuru) {
    const btnCetak = document.querySelector('button[onclick*="cetakKartuUjianSiswa"]');
    if (btnCetak) btnCetak.style.display = "none";
    
    const btnTemplate = document.querySelector('button[onclick*="downloadTemplateSiswa"]');
    if (btnTemplate) btnTemplate.style.display = "none";

    const labelImport = document.querySelector('label[for="fileExcelSiswa"]') || document.getElementById("fileExcelSiswa")?.closest('label');
    if (labelImport) labelImport.style.display = "none";

    const btnTambahSiswa = document.querySelector('button[onclick*="openModalTambahSiswa"]');
    if (btnTambahSiswa) btnTambahSiswa.style.display = "none";
  }
});

/* ===================================================
   TAMBAHAN: FUNGSI PENGACAK SOAL & OPSI JAWABAN
   =================================================== */

function shuffleArray(array) {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]
    ];
  }
  return array;
}

function getAcakOpsi(soalItem) {
  let opsiArray = [
    { label: 'A', teks: soalItem.opsi?.A },
    { label: 'B', teks: soalItem.opsi?.B },
    { label: 'C', teks: soalItem.opsi?.C },
    { label: 'D', teks: soalItem.opsi?.D },
    { label: 'E', teks: soalItem.opsi?.E }
  ].filter(o => o.teks && o.teks.trim() !== "");

  let teksKunciAsli = soalItem.opsi ? soalItem.opsi[soalItem.kunci] : "";
  let opsiAcak = shuffleArray(opsiArray);

  let opsiBaru = {};
  let kunciBaru = "";
  const labelHuruf = ['A', 'B', 'C', 'D', 'E'];

  opsiAcak.forEach((item, index) => {
    let labelBaru = labelHuruf[index];
    opsiBaru[labelBaru] = item.teks;
    if (item.teks === teksKunciAsli) {
      kunciBaru = labelBaru;
    }
  });

  return {
    ...soalItem,
    opsi: opsiBaru,
    kunci: kunciBaru || soalItem.kunci
  };
}
// Fungsi untuk menangani penyimpanan data kelas baru dari modal kelola kelas
window.handleSimpanKelas = async function(event) {
  if (event) event.preventDefault();
  
  const inputNama = document.getElementById("inputNamaKelas");
  const namaKelas = inputNama ? inputNama.value.trim() : "";
  
  if (!namaKelas) {
    alert("Nama kelas tidak boleh kosong!");
    return;
  }

  try {
    // Simpan ke Firebase Realtime Database pada node "daftarKelas"
    const kelasRef = ref(db, "daftarKelas");
    const newKelasRef = push(kelasRef);
    await set(newKelasRef, {
      nama: namaKelas,
      dibuatPada: new Date().toISOString()
    });

    alert("Kelas berhasil ditambahkan!");
    if (inputNama) inputNama.value = "";
    
    // Perbarui daftar kelas lokal jika ada fungsi pemuat
    if (typeof loadDaftarKelas === "function") {
      loadDaftarKelas();
    }
  } catch (error) {
    console.error("Gagal menyimpan kelas:", error);
    alert("Gagal menyimpan kelas: " + error.message);
  }
};
// Fungsi pembantu untuk mengubah file gambar yang di-upload menjadi Base64
function convertFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}
