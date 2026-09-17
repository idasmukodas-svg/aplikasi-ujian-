// Contoh fungsi saat siswa memverifikasi token untuk mulai ujian
function cekAksesDanMulaiUjian(nisnSiswa, tokenInput) {
  // 1. Ambil data siswa yang sedang login dari database
  get(ref(db, "daftarSiswa/" + nisnSiswa)).then((snapshotSiswa) => {
    if (!snapshotSiswa.exists()) {
      alert("Data siswa tidak ditemukan!");
      return;
    }
    const dataSiswa = snapshotSiswa.val(); // Berisi { nama, kelas: "IX A", sesi: "Sesi 1" }

    // 2. Ambil daftar ujian yang sedang berstatus "Aktif"
    get(ref(db, "daftarUjian")).then((snapshotUjian) => {
      if (!snapshotUjian.exists()) {
        alert("Tidak ada ujian yang aktif saat ini.");
        return;
      }

      let ujianAktif = null;
      snapshotUjian.forEach((childSnapshot) => {
        const ujian = childSnapshot.val();
        // Cek ujian yang statusnya Aktif dan tokennya cocok
        if (ujian.status === "Aktif" && ujian.token === tokenInput) {
          ujianAktif = ujian;
        }
      });

      if (!ujianAktif) {
        alert("Token salah atau tidak ada ujian yang sedang aktif dengan token tersebut.");
        return;
      }

      // 3. VALIDASI KELAS (Otomatis berdasarkan Mapel/Judul Ujian & Kelas Siswa)
      // Misal judul/mapel ujian mengandung kata "Kelas IX" atau target kelas 9
      const mapelAtauJudul = (ujianAktif.mapel + " " + ujianAktif.judul).toLowerCase();
      const kelasSiswa = dataSiswa.kelas.toLowerCase(); // contoh: "ix a" atau "9b"

      // Cek jika ujian untuk kelas 9 (IX / 9)
      if (mapelAtauJudul.includes("ix") || mapelAtauJudul.includes("kelas 9")) {
        if (!kelasSiswa.includes("ix") && !kelasSiswa.includes("9")) {
          alert("Akses Ditolak! Ujian ini khusus untuk siswa Kelas 9.");
          return;
        }
      } 
      // Cek jika ujian untuk kelas 8 (VIII / 8)
      else if (mapelAtauJudul.includes("viii") || mapelAtauJudul.includes("kelas 8")) {
        if (!kelasSiswa.includes("viii") && !kelasSiswa.includes("8")) {
          alert("Akses Ditolak! Ujian ini khusus untuk siswa Kelas 8.");
          return;
        }
      }

      // Jika lolos validasi, arahkan ke halaman pengerjaan soal
      alert("Token valid! Memulai ujian...");
      window.location.href = `kerjakan-ujian.html?id=${ujianAktif.id}&nisn=${nisnSiswa}`;
    });
  });
}
