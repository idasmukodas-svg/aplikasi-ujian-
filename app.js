/* ===================================================
   APP.JS - LMS & CBT SMP PLUS ANNUUR (WITH RBAC & AUTH)
   =================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
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

// Cek Sesi Login
let userSession = null;
const storedUser = sessionStorage.getItem("userLoggedIn");
if (!storedUser) {
  window.location.href = "login.html";
} else {
  userSession = JSON.parse(storedUser);
}

let daftarUjian = [];
let daftarSiswa = [];
let hasilUjian = [];
let daftarPengguna = [];
let activeUjianId = null;

document.addEventListener("DOMContentLoaded", () => {
  renderUserInfoNav();

  // Load Realtime Data
  onValue(ref(db, "daftarUjian"), (snapshot) => {
    const data = snapshot.val();
    const rawList = data ? Object.values(data) : [];
    
    // Jika Guru, filter ujian berdasarkan Mata Pelajaran miliknya
    if (userSession.role === "guru" && userSession.mapel) {
      daftarUjian = rawList.filter(u => u.mapel && u.mapel.toLowerCase().trim() === userSession.mapel.toLowerCase().trim());
    } else {
      daftarUjian = rawList;
    }

    renderStats();
    renderTabelUjian();
    updateFilterUjianDropdown();
  });

  onValue(ref(db, "daftarSiswa"), (snapshot) => {
    const data = snapshot.val();
    daftarSiswa = data ? Object.values(data) : [];
    renderStats();
    renderTabelSiswa();
  });

  onValue(ref(db, "hasilUjian"), (snapshot) => {
    const data = snapshot.val();
    const rawHasil = data ? Object.values(data) : [];

    if (userSession.role === "guru" && userSession.mapel) {
      hasilUjian = rawHasil.filter(h => h.mapel && h.mapel.toLowerCase().trim() === userSession.mapel.toLowerCase().trim());
    } else {
      hasilUjian = rawHasil;
    }

    renderTabelNilai();
  });

  // Load Akun Pengguna (Khusus Admin)
  if (userSession.role === "admin") {
    onValue(ref(db, "pengguna"), (snapshot) => {
      const data = snapshot.val();
      daftarPengguna = data ? Object.values(data) : [];
      renderTabelPengguna();
    });
  }

  // Event Listeners Form
  document.getElementById("formUjian")?.addEventListener("submit", handleSimpanUjian);
  document.getElementById("formTambahSoal")?.addEventListener("submit", handleTambahSoal);
  document.getElementById("formSiswa")?.addEventListener("submit", handleSimpanSiswa);
  document.getElementById("formTambahGuru")?.addEventListener("submit", handleTambahGuru);
  document.getElementById("fileExcelSiswa")?.addEventListener("change", importSiswaExcel);
  document.getElementById("fileExcelSoal")?.addEventListener("change", importExcelSoal);
});

function renderUserInfoNav() {
  const navRight = document.querySelector(".navbar-text");
  if (navRight) {
    navRight.innerHTML = `
      <span class="me-2"><i class="bi bi-person-circle me-1"></i>${userSession.nama || userSession.email} (${userSession.role === 'admin' ? 'Admin' : 'Guru ' + (userSession.mapel || '')})</span>
      <button class="btn btn-outline-light btn-sm font-monospace" onclick="logoutUser()"><i class="bi bi-box-arrow-right"></i> Keluar</button>
    `;
  }
}

window.logoutUser = () => {
  signOut(auth).then(() => {
    sessionStorage.removeItem("userLoggedIn");
    window.location.href = "login.html";
  });
};

function simpanDataUjian() {
  const dataObj = {};
  daftarUjian.forEach(u => { if (u.id) dataObj[u.id] = u; });
  set(ref(db, "daftarUjian"), dataObj);
}

function renderStats() {
  const statSiswa = document.getElementById("statTotalSiswa");
  const statUjian = document.getElementById("statTotalUjian");
  if (statSiswa) statSiswa.innerText = daftarSiswa.length;
  if (statUjian) statUjian.innerText = daftarUjian.length;
}

/* ===================================================
   1. KELOLA UJIAN & BANK SOAL
   =================================================== */
function renderTabelUjian() {
  const tbody = document.getElementById("tbodyUjian");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (daftarUjian.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-3">Belum ada jadwal ujian/bank soal.</td></tr>`;
    return;
  }

  daftarUjian.forEach((u, i) => {
    const jmlSoal = u.soal ? u.soal.length : 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><span class="badge bg-secondary">${u.mapel || '-'}</span></td>
      <td><span class="badge bg-dark">${u.kelasTarget || 'Semua'}</span></td>
      <td class="fw-bold">${u.judul || '-'}</td>
      <td>${u.durasi || 0} Mns</td>
      <td><span class="badge bg-info text-dark font-monospace">${u.token || '-'}</span></td>
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

function handleSimpanUjian(e) {
  e.preventDefault();
  const mapelInput = document.getElementById("ujianMapel").value.trim();
  const kelasTarget = document.getElementById("ujianKelasTarget")?.value || "Semua";
  const judul = document.getElementById("ujianJudul").value;
  const durasi = document.getElementById("ujianDurasi").value;
  const token = document.getElementById("ujianToken").value;

  const id = "UJN-" + Date.now();
  const newUjian = {
    id, mapel: mapelInput, kelasTarget, judul, durasi: parseInt(durasi), token, soal: []
  };

  set(ref(db, "daftarUjian/" + id), newUjian)
    .then(() => {
      alert("Ujian / Bank Soal Berhasil Disimpan!");
      const modalEl = document.getElementById("modalUjian");
      if (modalEl && window.bootstrap) bootstrap.Modal.getInstance(modalEl)?.hide();
    })
    .catch((err) => alert("Gagal menyimpan: " + err.message));
}

function handleTambahSoal(e) {
  e.preventDefault();
  const u = daftarUjian.find(item => item.id === activeUjianId);
  if (!u) return alert("Ujian aktif tidak ditemukan!");

  const tipe = document.getElementById("soalTipe").value;
  const pertanyaan = document.getElementById("soalPertanyaan").value;
  const gambarUrl = document.getElementById("soalGambarUrl")?.value.trim() || "";

  let newSoal = {
    id: "SOAL-" + Date.now(),
    tipe,
    pertanyaan,
    gambarUrl
  };

  if (tipe === "pg") {
    newSoal.opsi = {
      A: document.getElementById("soalA")?.value || "",
      B: document.getElementById("soalB")?.value || "",
      C: document.getElementById("soalC")?.value || "",
      D: document.getElementById("soalD")?.value || ""
    };
    newSoal.kunci = document.getElementById("soalKunciPG")?.value || "A";
  } else if (tipe === "pg_kompleks") {
    newSoal.opsi = {
      A: document.getElementById("soalA")?.value || "",
      B: document.getElementById("soalB")?.value || "",
      C: document.getElementById("soalC")?.value || "",
      D: document.getElementById("soalD")?.value || ""
    };
    const checkedKunci = [];
    ['A', 'B', 'C', 'D'].forEach(opt => {
      if (document.getElementById("kunciKompleks" + opt)?.checked) checkedKunci.push(opt);
    });
    newSoal.kunci = checkedKunci;
  } else if (tipe === "mencocokkan") {
    const pasangan = [];
    for (let i = 1; i <= 3; i++) {
      const elKiri = document.getElementById(`matchKiri${i}`)?.value;
      const elKanan = document.getElementById(`matchKanan${i}`)?.value;
      if (elKiri && elKanan) pasangan.push({ kiri: elKiri, kanan: elKanan });
    }
    newSoal.pasangan = pasangan;
  }

  if (!u.soal) u.soal = [];
  u.soal.push(newSoal);
  simpanDataUjian();
  alert("Soal berhasil ditambahkan ke Bank Soal!");
  document.getElementById("formTambahSoal").reset();
  if (window.switchTipeSoal) window.switchTipeSoal("pg");
}

/* ===================================================
   2. KELOLA AKUN GURU (KHUSUS ADMIN)
   =================================================== */
async function handleTambahGuru(e) {
  e.preventDefault();
  if (userSession.role !== "admin") return alert("Akses ditolak. Hanya Admin yang bisa menambah guru.");

  const nama = document.getElementById("guruNama").value.trim();
  const email = document.getElementById("guruEmail").value.trim();
  const password = document.getElementById("guruPassword").value;
  const mapel = document.getElementById("guruMapel").value.trim();

  try {
    // Buat akun Auth baru
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    const dataPengguna = { uid, nama, email, mapel, role: "guru" };
    await set(ref(db, "pengguna/" + uid), dataPengguna);

    alert(`Akun Guru ${nama} berhasil dibuat!`);
    document.getElementById("formTambahGuru").reset();
    const modalEl = document.getElementById("modalTambahGuru");
    if (modalEl && window.bootstrap) bootstrap.Modal.getInstance(modalEl)?.hide();

  } catch (err) {
    console.error("Gagal buat guru:", err);
    alert("Gagal membuat akun guru: " + err.message);
  }
}

function renderTabelPengguna() {
  const tbody = document.getElementById("tbodyPengguna");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (daftarPengguna.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">Belum ada akun guru terdaftar.</td></tr>`;
    return;
  }

  daftarPengguna.forEach((p, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="fw-bold">${p.nama}</td>
      <td>${p.email}</td>
      <td><span class="badge bg-info text-dark">${p.mapel || 'Semua Mapel'}</span></td>
      <td><span class="badge ${p.role === 'admin' ? 'bg-danger' : 'bg-primary'}">${p.role.toUpperCase()}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

/* ===================================================
   3. DATA SISWA & REKAP NILAI
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
      const modalEl = document.getElementById("modalSiswa");
      if (modalEl && window.bootstrap) bootstrap.Modal.getInstance(modalEl)?.hide();
    })
    .catch((err) => alert("Gagal menyimpan siswa: " + err.message));
}

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
    json.forEach(row => {
      const tipe = String(row.Tipe || row.tipe || "pg").trim().toLowerCase();
      const pertanyaan = row.Pertanyaan || row.pertanyaan;
      const gambarUrl = row.GambarURL || row.gambarUrl || row.Gambar || "";

      if (!pertanyaan) return;

      let itemSoal = {
        id: "SOAL-" + Date.now() + Math.random().toString(36).substr(2, 4),
        tipe, pertanyaan, gambarUrl
      };

      if (tipe === "pg") {
        itemSoal.opsi = {
          A: row.A || "", B: row.B || "", C: row.C || "", D: row.D || ""
        };
        itemSoal.kunci = String(row.Kunci || "A").toUpperCase().trim();
      } else if (tipe === "pg_kompleks") {
        itemSoal.opsi = {
          A: row.A || "", B: row.B || "", C: row.C || "", D: row.D || ""
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

      if (!u.soal) u.soal = [];
      u.soal.push(itemSoal);
      countAdded++;
    });

    simpanDataUjian();
    alert(`Berhasil mengimpor ${countAdded} soal!`);
    event.target.value = "";
  };
  reader.readAsArrayBuffer(file);
}

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
          <i class="bi bi-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderTabelNilai() {
  const tbody = document.getElementById("tbodyNilai");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (hasilUjian.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">Belum ada hasil ujian.</td></tr>`;
    return;
  }
  hasilUjian.forEach((h, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="font-monospace">${h.nisn}</td>
      <td class="fw-bold">${h.nama} <span class="badge bg-light text-dark border ms-1">${h.kelas || '-'}</span></td>
      <td>${h.mapel || '-'} - ${h.judul || '-'}</td>
      <td><span class="badge bg-success fs-6">${h.nilai || 0}</span></td>
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
    opt.textContent = `${u.mapel || ''} (${u.kelasTarget || 'Semua'}) - ${u.judul || ''}`;
    selectUjian.appendChild(opt);
  });
}

/* EXPOSE GLOBALS TO WINDOW */
window.openModalTambahUjian = () => {
  document.getElementById("formUjian")?.reset();
  const tokenEl = document.getElementById("ujianToken");
  if (tokenEl) tokenEl.value = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  if (userSession.role === "guru" && userSession.mapel) {
    const inputMapel = document.getElementById("ujianMapel");
    if (inputMapel) {
      inputMapel.value = userSession.mapel;
      inputMapel.readOnly = true;
    }
  }

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

  const titleEl = document.getElementById("judulUjianSoal");
  if (titleEl) titleEl.innerText = `${u.mapel} [${u.kelasTarget || 'Semua'}] - ${u.judul}`;
  document.getElementById("formTambahSoal")?.reset();
  if (window.switchTipeSoal) window.switchTipeSoal("pg");

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
    { NISN: "0081234561", NAMA: "Ahmad Rizky", KELAS: "IX A" },
    { NISN: "0081234562", NAMA: "Siti Nurhaliza", KELAS: "IX B" }
  ];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template Siswa");
  XLSX.writeFile(wb, "Template_Data_Siswa.xlsx");
};

window.exportSiswaExcel = () => {
  if (daftarSiswa.length === 0) return alert("Tidak ada data siswa.");
  const ws = XLSX.utils.json_to_sheet(daftarSiswa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data Siswa");
  XLSX.writeFile(wb, "Data_Siswa_CBT.xlsx");
};

window.downloadTemplateSoal = () => {
  const data = [
    { Tipe: "pg", Pertanyaan: "Perhatikan gambar berikut, perangkat ini adalah?", GambarURL: "https://via.placeholder.com/300", A: "Keyboard", B: "Mouse", C: "Monitor", D: "Printer", Kunci: "B", Pasangan: "" },
    { Tipe: "pg_kompleks", Pertanyaan: "Manakah yang merupakan OS?", GambarURL: "", A: "Windows", B: "Linux", C: "Word", D: "Excel", Kunci: "A,B", Pasangan: "" },
    { Tipe: "mencocokkan", Pertanyaan: "Jodohkan istilah berikut!", GambarURL: "", A: "", B: "", C: "", D: "", Kunci: "", Pasangan: "CPU=Otak Komputer;RAM=Memori Sementara" }
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
