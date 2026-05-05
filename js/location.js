// js/location.js

// CONTOH KOORDINAT KANTOR (Area Lombok Utara - Silakan sesuaikan titik akuratnya)
const OFFICE_LAT = -8.3495; // Ganti dengan Latitude Kantor BKKBN/DP2KBPMD
const OFFICE_LNG = 116.3116; // Ganti dengan Longitude Kantor
const MAX_RADIUS = 100; // Maksimal radius 100 meter

// Rumus Haversine untuk menghitung jarak antara 2 titik koordinat (dalam meter)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Radius bumi dalam meter
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c; 
}

export async function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject("Geolokasi tidak didukung oleh perangkat ini.");
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                const distance = calculateDistance(latitude, longitude, OFFICE_LAT, OFFICE_LNG);
                
                // Deteksi dasar Fake GPS: Jika akurasi terlalu buruk (> 100m) biasanya indikasi GPS loncat / mock location
                if (accuracy > 100) {
                    reject(`Akurasi sinyal GPS lemah (${Math.round(accuracy)}m). Silakan pindah ke area terbuka.`);
                } 
                // Validasi Radius 100 Meter
                else if (distance > MAX_RADIUS) {
                    reject(`Anda berada di luar area absensi. Jarak Anda: ${Math.round(distance)}m (Maks 100m).`);
                } 
                else {
                    resolve({ latitude, longitude, accuracy, distance });
                }
            },
            (error) => {
                reject("Gagal mendapatkan lokasi. Pastikan GPS aktif dan izin diberikan pada browser.");
            },
            // Opsi untuk akurasi tertinggi
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    });
}