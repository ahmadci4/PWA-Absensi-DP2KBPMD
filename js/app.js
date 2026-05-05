// js/app.js
import { db } from './firebase-app.js';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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
    e.preventDefault(); // Ini yang mencegah halaman refresh saat login
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
    const btn = tipe === 'masuk' ? btnAbsenMasuk : btnAbsenPulang;
    const originalContent = btn.innerHTML;
    btn.innerHTML = `<span class="font-semibold text-sm">Mencari Lokasi...</span>`;
    btn.classList.add('opacity-50', 'pointer-events-none');

    try {
        const locationData = await getCurrentLocation();
        
        btn.innerHTML = `<span class="font-semibold text-sm">Membuka Kamera...</span>`;
        const photoData = await openCameraAndCapture(currentUser, locationData);
        
        btn.innerHTML = `<span class="font-semibold text-sm">Menyimpan Data...</span>`;
        const todayStr = new Date().toISOString().split('T')[0];
        
        // Simpan langsung Teks Gambar (Base64) ke Database
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
            fotoUrl: photoData 
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

// === EVENT LISTENER TOMBOL ===
btnAbsenMasuk.addEventListener('click', () => prosesAbsensi('masuk'));
btnAbsenPulang.addEventListener('click', () => prosesAbsensi('pulang'));

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
            const photoData = await openCameraAndCapture(currentUser, loc); 
            
            btnUploadKegiatan.innerHTML = `<span class="font-bold text-sm">Menyimpan Data...</span>`;
            await addDoc(collection(db, "kegiatan"), {
                deviceId: currentUser.deviceId,
                nama: currentUser.name,
                jabatan: currentUser.role,
                deskripsi: deskripsi,
                tanggal: new Date().toISOString().split('T')[0],
                waktu: serverTimestamp(),
                fotoUrl: photoData, 
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
