/* ===================================================
   1. KELOLA UJIAN & BANK SOAL (Disesuaikan dengan HTML Asli)
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
    const isAktif = u.status === "aktif";
    const statusBadge = isAktif 
      ? `<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Aktif</span>` 
      : `<span class="badge bg-secondary"><i class="bi bi-x-circle me-1"></i>Nonaktif</span>`;
    
    const jadwalText = `<div class="small fw-bold text-primary">${formatDateTimeDisplay(u.waktuMulai)}</div>
                        <div class="small text-muted">s.d. ${formatDateTimeDisplay(u.waktuSelesai)}</div>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>
        <span class="badge bg-secondary">${u.mapel || '-'}</span>
        <div class="small text-muted">Target: ${u.kelasTarget || 'Semua'}</div>
      </td>
      <td class="fw-bold">
        ${u.judul || '-'}
        <div class="mt-1">
          <div class="form-check form-switch form-check-inline cursor-pointer mb-0" title="Klik untuk mengubah status">
            <input class="form-check-input" type="checkbox" role="switch" id="switch-${u.id}" ${isAktif ? 'checked' : ''} onchange="toggleStatusUjian('${u.id}', '${u.status}')">
            <label class="form-check-label small" for="switch-${u.id}">${statusBadge}</label>
          </div>
        </div>
      </td>
      <td>${jadwalText}</td>
      <td>${u.durasi || 0} Mns</td>
      <td><span class="badge bg-info text-dark font-monospace">${u.token || '-'}</span></td>
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
