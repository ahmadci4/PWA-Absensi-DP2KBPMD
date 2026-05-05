// === LOGIKA UPLOAD KEGIATAN ===
btnUploadKegiatan.addEventListener('click', async () => {
    const deskripsi = prompt("Masukkan deskripsi kegiatan singkat:");
    if (!deskripsi) return;

    const originalContent = btnUploadKegiatan.innerHTML;
    btnUploadKegiatan.innerHTML = `<span class="font-bold text-sm">Memproses...</span>`;
    btnUploadKegiatan.classList.add('opacity-50', 'pointer-events-none');

    try {
        navigator.geolocation.getCurrentPosition(async (position) => {
            const loc = { latitude: position.coords.latitude, longitude: position.coords.longitude };
            
            btnUploadKegiatan.innerHTML = `<span class="font-bold text-sm">Membuka Kamera...</span>`;
            const photoData = await openCameraAndCapture(currentUser, loc); // Gambar jadi teks
            
            btnUploadKegiatan.innerHTML = `<span class="font-bold text-sm">Menyimpan Data...</span>`;
            await addDoc(collection(db, "kegiatan"), {
                deviceId: currentUser.deviceId,
                nama: currentUser.name,
                jabatan: currentUser.role,
                deskripsi: deskripsi,
                tanggal: new Date().toISOString().split('T')[0],
                waktu: serverTimestamp(),
                fotoUrl: photoData, // Teks gambar langsung disimpan di sini
                lokasi: loc
            });

            btnUploadKegiatan.innerHTML = originalContent;
            btnUploadKegiatan.classList.remove('opacity-50', 'pointer-events-none');
            alert("SUKSES: Kegiatan lapangan berhasil diunggah!");
            
        }, (err) => {
            alert("Gagal mendapat lokasi: " + err.message);
            btnUploadKegiatan.innerHTML = originalContent;
            btnUploadKegiatan.classList.remove('opacity-50', 'pointer-events-none');
        });

    } catch (error) {
        alert("GAGAL: " + error);
        btnUploadKegiatan.innerHTML = originalContent;
        btnUploadKegiatan.classList.remove('opacity-50', 'pointer-events-none');
    }
});
