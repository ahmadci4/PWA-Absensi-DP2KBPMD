// js/location.js

export async function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject("Geolokasi tidak didukung oleh perangkat ini.");
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                
                // Deteksi akurasi dasar:
                // Kita longgarkan batas akurasi menjadi 500 meter, karena di pedesaan 
                // atau di dalam ruangan (rumah warga/posyandu) sinyal GPS kadang melompat.
                if (accuracy > 500) {
                    reject(`Akurasi sinyal GPS lemah (${Math.round(accuracy)}m). Silakan cari area luar ruangan sejenak agar koordinat akurat.`);
                } 
                else {
                    // Berhasil mendapatkan lokasi!
                    // Langsung resolve tanpa membatasi radius. 
                    // (distance diset 0 agar tidak menyebabkan error di app.js)
                    resolve({ latitude, longitude, accuracy, distance: 0 });
                }
            },
            (error) => {
                reject("Gagal mendapatkan lokasi. Pastikan GPS HP aktif dan Anda memberikan izin lokasi pada browser.");
            },
            // Opsi untuk akurasi tertinggi
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    });
}
