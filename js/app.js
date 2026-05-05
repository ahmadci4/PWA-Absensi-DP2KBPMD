// js/app.js
import { db, storage } from './firebase-app.js';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { checkDeviceAuth, registerDevice } from './auth.js';
import { getCurrentLocation } from './location.js';
import { openCameraAndCapture } from './camera.js';

// === ELEMENT DOM ===
const loginScreen = document.getElementById('loginScreen');
const dashboardScreen = document.getElementById('dashboardScreen');
const loginForm = document.getElementById('loginForm');

const greetName = document.getElementById('greetName');
const greetRole = document.getElementById('greetRole');
const absenStatus = document.getElementById('absenStatus');
const statusBadge = document.getElementById('statusBadge');

const btnAbsenMasuk = document.getElementById('btnAbsenMasuk');
const btnAbsenPulang = document.getElementById('btnAbsenPulang');
const btnUploadKegiatan = document.getElementById('btnUploadKegiatan');

// === INISIALISASI APLIKASI ===
let currentUser = checkDeviceAuth();

if (currentUser) {
    showDashboard(currentUser);
}

// === LOGIKA LOGIN / DEVICE BINDING ===
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('userName').value;
    const role = document.getElementById('userRole').value;
    
    currentUser = registerDevice(name, role);
    showDashboard(currentUser);
});

function showDashboard(user) {
    loginScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    dashboardScreen.classList.add('flex');
    
    greetName.textContent = user.name;
    greetRole.textContent = user.role;
    
    checkTodayStatus(user);
}

// === CEK STATUS ABSENSI HARI INI ===
async function checkTodayStatus(user) {
    // Note: Dalam production, sebaiknya query berdasarkan tanggal format YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0]; 
    const q = query(collection(db, "absensi"), 
                    where("deviceId", "==", user.deviceId), 
                    where("tanggal", "==", today));
    
    try {
        const querySnapshot = await getDocs(q);
        let sudahMasuk = false;
        let sudahPulang = false;

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.tipe === 'masuk') sudahMasuk = true;
            if (data.tipe === 'pulang') sudahPulang = true;
        });

        if (sudahPulang) {
            absenStatus.textContent = "Selesai Tugas";
            statusBadge.textContent = "Lengkap";
            statusBadge.className = "bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold";
            btnAbsenMasuk.classList.add('opacity-50', 'pointer-events-none');
            btnAbsenPulang.classList.add('opacity-50', 'pointer-events-none');
        } else if (sudahMasuk) {
            absenStatus.textContent = "Sudah Absen Masuk";
            statusBadge.textContent = "Aktif";
            statusBadge.className = "bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold";
            btnAbsenMasuk.classList.add('opacity-50', 'pointer-events-none');
            btnAbsenPulang.classList.remove('opacity-50', 'pointer-events-none');
        }
    } catch (error) {
        console.error("Gagal mengambil status:", error);
    }
}

// === LOGIKA PROSES ABSENSI ===
async function prosesAbsensi(tipe) {
    try {
        // 1. Tampilkan Loading
        alert(`Mencari koordinat lokasi Anda... Pastikan Anda di area instansi.`);
        
        // 2. Ambil & Validasi Lokasi (Radius 100m)
        const locationData = await getCurrentLocation();
        
        // 3. Buka Kamera & Ambil Foto (Watermark otomatis)
        const photoBlob = await openCameraAndCapture(currentUser, locationData);
        
        alert("Mengunggah data... Mohon tunggu.");

        // 4. Upload Foto ke Firebase Storage
        const todayStr = new Date().toISOString().split('T')[0];
        const fileName = `absensi_${todayStr}/${currentUser.deviceId}_${tipe}_${Date.now()}.jpg`;
        const storageRef = ref(storage, fileName);
        
        await uploadBytes(storageRef, photoBlob);
        const photoUrl = await getDownloadURL(storageRef);

        // 5. Simpan Data ke Firestore
        await addDoc(collection(db, "absensi"), {
            deviceId: currentUser.deviceId,
            nama: currentUser.name,
            jabatan: currentUser.role,
            tipe: tipe, // 'masuk' atau 'pulang'
            tanggal: todayStr,
            waktu: serverTimestamp(),
            lokasi: {
                lat: locationData.latitude,
                lng: locationData.longitude,
                jarak: Math.round(locationData.distance)
            },
            fotoUrl: photoUrl
        });

        alert(`Absen ${tipe.toUpperCase()} berhasil disimpan!`);
        checkTodayStatus(currentUser); // Refresh UI Status

    } catch (error) {
        alert("GAGAL: " + error);
        console.error(error);
    }
}

// === EVENT LISTENER TOMBOL ===
btnAbsenMasuk.addEventListener('click', () => prosesAbsensi('masuk'));
btnAbsenPulang.addEventListener('click', () => prosesAbsensi('pulang'));

// === LOGIKA UPLOAD KEGIATAN (FITUR EXTRA) ===
btnUploadKegiatan.addEventListener('click', async () => {
    const deskripsi = prompt("Masukkan deskripsi kegiatan singkat:");
    if (!deskripsi) return;

    try {
        // Ambil lokasi (tanpa validasi radius, karena kegiatan bisa di lapangan luar instansi)
        // Kita modifikasi sedikit agar tidak reject jika di luar radius untuk kegiatan lapangan
        navigator.geolocation.getCurrentPosition(async (position) => {
            const loc = { latitude: position.coords.latitude, longitude: position.coords.longitude };
            
            const photoBlob = await openCameraAndCapture(currentUser, loc);
            alert("Mengunggah kegiatan...");

            const fileName = `kegiatan/${currentUser.deviceId}_${Date.now()}.jpg`;
            const storageRef = ref(storage, fileName);
            await uploadBytes(storageRef, photoBlob);
            const photoUrl = await getDownloadURL(storageRef);

            await addDoc(collection(db, "kegiatan"), {
                deviceId: currentUser.deviceId,
                nama: currentUser.name,
                jabatan: currentUser.role,
                deskripsi: deskripsi,
                tanggal: new Date().toISOString().split('T')[0],
                waktu: serverTimestamp(),
                fotoUrl: photoUrl,
                lokasi: loc
            });

            alert("Kegiatan berhasil diunggah dan akan muncul di Timeline Admin!");
        }, (err) => alert("Gagal mendapat lokasi: " + err.message));

    } catch (error) {
        alert("GAGAL: " + error);
    }
});