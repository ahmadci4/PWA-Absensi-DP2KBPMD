// === LOGIKA PROSES ABSENSI ===
async function prosesAbsensi(tipe) {
    const btn = tipe === 'masuk' ? btnAbsenMasuk : btnAbsenPulang;
    const originalContent = btn.innerHTML;
    btn.innerHTML = `<span class="font-semibold text-sm">Mencari Lokasi...</span>`;
    btn.classList.add('opacity-50', 'pointer-events-none');

    try {
        const locationData = await getCurrentLocation();
        
        btn.innerHTML = `<span class="font-semibold text-sm">Membuka Kamera...</span>`;
        // photoData sekarang isinya adalah "Teks Gambar" (Base64)
        const photoData = await openCameraAndCapture(currentUser, locationData);
        
        btn.innerHTML = `<span class="font-semibold text-sm">Menyimpan Data...</span>`;
        const todayStr = new Date().toISOString().split('T')[0];
        
        // LANGSUNG SIMPAN KE FIRESTORE DATABASE (Tanpa lewat Storage)
        await addDoc(collection(db, "absensi"), {
            deviceId: currentUser.deviceId,
            nama: currentUser.name,
            jabatan: currentUser.role,
            tipe: tipe, 
            tanggal: todayStr,
            waktu: serverTimestamp(),
            lokasi: {
                lat: locationData.latitude,
                lng: locationData.longitude,
                jarak: locationData.distance ? Math.round(locationData.distance) : 0
            },
            fotoUrl: photoData // Teks gambar langsung disimpan di sini
        });

        btn.innerHTML = originalContent;
        alert(`SUKSES: Absen ${tipe.toUpperCase()} berhasil disimpan!`);
        checkTodayStatus(currentUser);

    } catch (error) {
        alert("GAGAL: " + error);
        console.error(error);
        btn.innerHTML = originalContent;
        checkTodayStatus(currentUser); 
    }
}
