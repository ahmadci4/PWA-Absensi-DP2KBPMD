// js/app.js
import { db } from './firebase-app.js';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { checkDeviceAuth, registerDevice, updateProfileData } from './auth.js';
import { getCurrentLocation } from './location.js';
import { openCameraAndCapture } from './camera.js';

// === ELEMENT DOM UTAMA ===
const loginScreen = document.getElementById('loginScreen');
const dashboardScreen = document.getElementById('dashboardScreen');
const loginForm = document.getElementById('loginForm');
const btnUploadKegiatan = document.getElementById('btnUploadKegiatan');

// === ELEMENT TABS & NAV ===
const tabs = {
    beranda: document.getElementById('tabBeranda'),
    kategori: document.getElementById('tabKategori'),
    rekap: document.getElementById('tabRekap'),
    notifikasi: document.getElementById('tabNotifikasi'),
    profil: document.getElementById('tabProfil')
};
const navs = {
    beranda: document.getElementById('navBeranda'),
    kategori: document.getElementById('navKategori'),
    rekap: document.getElementById('navRekap'),
    notifikasi: document.getElementById('navNotifikasi'),
    profil: document.getElementById('navProfil')
};
const containers = {
    beranda: document.getElementById('timelineContainer'),
    kategori: document.getElementById('kategoriContainer'),
    rekap: document.getElementById('rekapContainer'),
    notifikasi: document.getElementById('notifikasiContainer')
};

// === ELEMENT MODAL KOMENTAR ===
const modalKomentar = document.getElementById('modalKomentar');
const btnCloseModal = document.getElementById('btnCloseModal');
const listKomentar = document.getElementById('listKomentar');
const formKomentar = document.getElementById('formKomentar');
const inputKomentar = document.getElementById('inputKomentar');
const activePostIdInput = document.getElementById('activePostId');
let activePostOwnerId = "";
let unsubscribeKomentar = null; 

// === INISIALISASI & LOGIN ===
let currentUser = checkDeviceAuth();
if (currentUser) {
    showDashboard(currentUser);
}

loginForm.addEventListener('submit', (e) => {
    e.preventDefault(); 
    const name = document.getElementById('regName').value;
    const kec = document.getElementById('regKecamatan').value;
    const desa = document.getElementById('regDesa').value;
    const role = document.getElementById('regRole').value;
    const customRole = document.getElementById('regRoleCustom').value;
    
    currentUser = registerDevice(name, role, customRole, kec, desa);
    showDashboard(currentUser);
});

function showDashboard(user) {
    loginScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    dashboardScreen.classList.add('flex');
    
    // Muat Data Profil
    loadProfilData(user);

    // Muat Semua Data Papan Utama (1 Listener untuk Beranda, Kategori, dan Rekap agar Hemat Kuota)
    loadAllMainData();
    
    // Muat Notifikasi
    loadNotifikasi(); 
}

// === LOGIKA NAVIGASI 5 MENU ===
function switchTab(activeTabName) {
    Object.keys(tabs).forEach(key => {
        tabs[key].classList.add('hidden');
        navs[key].classList.remove('text-primary');
        navs[key].classList.add('text-gray-400');
    });
    tabs[activeTabName].classList.remove('hidden');
    navs[activeTabName].classList.remove('text-gray-400');
    navs[activeTabName].classList.add('text-primary');
}

navs.beranda.onclick = () => switchTab('beranda');
navs.kategori.onclick = () => switchTab('kategori');
navs.rekap.onclick = () => switchTab('rekap');
navs.notifikasi.onclick = () => {
    switchTab('notifikasi');
    document.getElementById('notifBadge').classList.add('hidden'); 
};
navs.profil.onclick = () => switchTab('profil');

// === LOGIKA RENDER DATA SUPER (BERANDA, KATEGORI AKORDEON, REKAP & 24 JAM) ===
function loadAllMainData() {
    const q = query(collection(db, "kegiatan"), orderBy("waktu", "desc"));
    
    onSnapshot(q, (snapshot) => {
        const now = new Date().getTime();
        const timeLimit = 24 * 60 * 60 * 1000; // 24 Jam dalam Milidetik

        containers.beranda.innerHTML = '';
        containers.rekap.innerHTML = '';
        
        let groupedData = {}; // Wadah Akordeon
        let adaData = false;

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if(!data.waktu) return; 

            const postTime = data.waktu.toDate().getTime();
            const age = now - postTime;
            
            // 🛑 SISTEM HANCUR OTOMATIS: Abaikan foto jika sudah lewat 24 Jam
            if(age > timeLimit) return; 

            adaData = true;
            
            // Hitung Mundur Sisa Waktu
            const sisaMs = timeLimit - age;
            const sisaJam = Math.floor(sisaMs / (1000 * 60 * 60));
            const sisaMenit = Math.floor((sisaMs % (1000 * 60 * 60)) / (1000 * 60));
            const countdownTeks = `⏳ Lenyap dalam: ${sisaJam}j ${sisaMenit}m`;

            // Google Maps Link
            const mapsUrl = `https://www.google.com/maps?q=${data.lokasi.lat},${data.lokasi.lng}`;
            
            // Generate Kartu HTML Postingan
            const cardHTML = buildCardHTML(docSnap.id, data, countdownTeks, mapsUrl);

            // 1. Masukkan ke Tab BERANDA
            containers.beranda.innerHTML += cardHTML;

            // 2. Masukkan ke Tab REKAP
            const waktuTeks = data.waktu.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            containers.rekap.innerHTML += `
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="p-3">
                        <p class="font-bold text-gray-800 text-sm">${data.nama}</p>
                        <p class="text-[10px] text-gray-500 uppercase">${data.jabatan} • ${data.kecamatan} - ${data.desa}</p>
                    </td>
                    <td class="p-3 text-right text-xs font-bold text-primary whitespace-nowrap">${waktuTeks} WITA</td>
                </tr>
            `;

            // 3. Kelompokkan untuk Tab KATEGORI (Akordeon)
            const kec = data.kecamatan || "Lainnya";
            const desa = data.desa || "Lainnya";
            const nama = data.nama || "Tanpa Nama";

            if(!groupedData[kec]) groupedData[kec] = {};
            if(!groupedData[kec][desa]) groupedData[kec][desa] = {};
            if(!groupedData[kec][desa][nama]) groupedData[kec][desa][nama] = [];
            
            groupedData[kec][desa][nama].push(cardHTML);
        });

        if(!adaData) {
            containers.beranda.innerHTML = `<div class="text-center text-gray-400 py-10">Belum ada kegiatan dalam 24 jam terakhir.</div>`;
            containers.rekap.innerHTML = `<tr><td colspan="2" class="p-4 text-center text-gray-400">Belum ada rekap hari ini.</td></tr>`;
            containers.kategori.innerHTML = `<div class="text-center text-gray-400 py-10">Tidak ada data wilayah tersedia.</div>`;
            return;
        }

        // Jalankan fungsi membuat Akordeon
        renderAkordeonKategori(groupedData);
    });
}

// Fungsi Render Akordeon
function renderAkordeonKategori(groupedData) {
    let html = '';
    
    // Level 1: Kecamatan
    for (const kec in groupedData) {
        html += `
        <details class="mb-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden group">
            <summary class="p-4 font-bold bg-gray-50 cursor-pointer outline-none text-primary flex justify-between items-center">
                <span>📍 Kec. ${kec}</span>
                <span class="text-lg group-open:rotate-180 transition-transform">▾</span>
            </summary>
            <div class="p-2 pl-4 border-t border-gray-100 bg-white">
        `;
        
        // Level 2: Desa
        for (const desa in groupedData[kec]) {
            html += `
            <details class="mb-2 border border-gray-100 rounded-lg overflow-hidden group/desa">
                <summary class="p-3 font-semibold bg-slate-50 cursor-pointer outline-none text-gray-700 flex justify-between items-center">
                    <span>🏘️ Desa ${desa}</span>
                    <span class="text-gray-400 group-open/desa:rotate-180 transition-transform">▾</span>
                </summary>
                <div class="p-2 pl-4 border-t border-gray-50 bg-white">
            `;
            
            // Level 3: Nama Anggota
            for (const nama in groupedData[kec][desa]) {
                html += `
                <details class="mb-2 bg-white rounded shadow-sm border border-gray-50 group/nama">
                    <summary class="p-3 font-bold cursor-pointer outline-none text-secondary flex items-center gap-2">
                        <div class="w-6 h-6 bg-secondary/10 rounded-full flex items-center justify-center text-[10px] text-secondary">👤</div>
                        ${nama} <span class="text-[10px] bg-secondary text-white px-2 py-0.5 rounded-full ml-auto">${groupedData[kec][desa][nama].length} Laporan</span>
                    </summary>
                    <div class="p-2 space-y-4 bg-gray-50">
                        ${groupedData[kec][desa][nama].join('')}
                    </div>
                </details>
                `;
            }
            html += `</div></details>`;
        }
        html += `</div></details>`;
    }
    containers.kategori.innerHTML = html;
}

// Fungsi Merangkai HTML Postingan
function buildCardHTML(postId, data, countdownTeks, mapsUrl) {
    const waktuTeks = data.waktu.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const inisial = data.nama.substring(0, 2).toUpperCase();
    
    const likesArray = data.likes || [];
    const isLiked = likesArray.includes(currentUser.deviceId);
    const likeCount = likesArray.length;
    const komCount = data.komentarCount || 0;

    return `
        <div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">
            <div class="flex justify-between items-start">
                <div class="flex items-center gap-3">
                    <div class="bg-gradient-to-br from-primary to-secondary text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm">${inisial}</div>
                    <div>
                        <h4 class="font-bold text-gray-800 text-sm leading-none">${data.nama}</h4>
                        <p class="text-[10px] text-gray-500 mt-1 font-medium bg-gray-100 px-1.5 py-0.5 inline-block rounded">${data.jabatan}</p>
                    </div>
                </div>
                <!-- Hitung Mundur -->
                <div class="bg-rose-50 border border-rose-100 px-2 py-1 rounded text-[9px] font-bold text-rose-500">
                    ${countdownTeks}
                </div>
            </div>
            
            <p class="text-sm text-gray-700 leading-relaxed px-1 mt-1">${data.deskripsi}</p>
            
            <div class="relative w-full rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                <img src="${data.fotoUrl}" class="w-full h-auto object-contain max-h-80" alt="Foto">
                
                <!-- Link Arah Google Maps -->
                <a href="${mapsUrl}" target="_blank" class="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1 hover:bg-black/80 transition-colors shadow-lg">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    Buka Map
                </a>
            </div>
            
            <!-- Tombol Interaksi -->
            <div class="flex items-center gap-5 mt-1 px-1 pt-1">
                <button onclick="window.toggleLike('${postId}', '${data.deviceId}', ${isLiked})" class="flex items-center gap-1.5 transition-all ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}">
                    <svg class="w-6 h-6 ${isLiked ? 'fill-current' : 'fill-none'}" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
                    <span class="text-xs font-bold">${likeCount}</span>
                </button>
                <button onclick="window.bukaKomentar('${postId}', '${data.deviceId}')" class="flex items-center gap-1.5 text-gray-400 hover:text-primary transition-all">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                    <span class="text-xs font-bold">${komCount}</span>
                </button>
                <span class="text-[10px] text-gray-400 ml-auto font-medium">${waktuTeks}</span>
            </div>
        </div>
    `;
}

// === FUNGSI LIKE & KOMENTAR (TETAP SAMA SEPERTI SEBELUMNYA) ===
window.toggleLike = async (postId, postOwnerId, isLiked) => {
    const postRef = doc(db, "kegiatan", postId);
    try {
        if (isLiked) {
            await updateDoc(postRef, { likes: arrayRemove(currentUser.deviceId) });
        } else {
            await updateDoc(postRef, { likes: arrayUnion(currentUser.deviceId) });
            if (postOwnerId !== currentUser.deviceId) {
                await addDoc(collection(db, "notifikasi"), {
                    targetUserId: postOwnerId, dariNama: currentUser.name, tipe: "like", waktu: serverTimestamp()
                });
            }
        }
    } catch (error) { console.error("Error like:", error); }
};

window.bukaKomentar = (postId, postOwnerId) => {
    activePostIdInput.value = postId;
    activePostOwnerId = postOwnerId;
    modalKomentar.classList.remove('hidden');
    
    const qKom = query(collection(db, "kegiatan", postId, "komentar"), orderBy("waktu", "asc"));
    unsubscribeKomentar = onSnapshot(qKom, (snapshot) => {
        listKomentar.innerHTML = '';
        if(snapshot.empty) {
            listKomentar.innerHTML = `<div class="text-center text-sm text-gray-400 mt-4">Belum ada komentar.</div>`; return;
        }
        snapshot.forEach(docSnap => {
            const kom = docSnap.data();
            listKomentar.innerHTML += `
                <div class="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm border border-gray-100 w-[90%] fade-in">
                    <p class="font-bold text-[11px] text-primary">${kom.nama} <span class="text-gray-400 font-normal">(${kom.jabatan})</span></p>
                    <p class="text-sm text-gray-700 mt-0.5">${kom.teks}</p>
                </div>
            `;
        });
        listKomentar.scrollTop = listKomentar.scrollHeight;
    });
};

btnCloseModal.onclick = () => { modalKomentar.classList.add('hidden'); if(unsubscribeKomentar) unsubscribeKomentar(); };

formKomentar.addEventListener('submit', async (e) => {
    e.preventDefault();
    const teks = inputKomentar.value;
    const postId = activePostIdInput.value;
    if(!teks || !postId) return;
    inputKomentar.value = ''; 
    try {
        await addDoc(collection(db, "kegiatan", postId, "komentar"), { nama: currentUser.name, jabatan: currentUser.role, teks: teks, waktu: serverTimestamp() });
        const postRef = doc(db, "kegiatan", postId);
        const qKom = query(collection(db, "kegiatan", postId, "komentar"));
        import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js").then(async (m) => {
            const snap = await m.getDocs(qKom); await updateDoc(postRef, { komentarCount: snap.size });
        });
        if (activePostOwnerId !== currentUser.deviceId) {
            await addDoc(collection(db, "notifikasi"), { targetUserId: activePostOwnerId, dariNama: currentUser.name, tipe: "komentar", teksKomentar: teks, waktu: serverTimestamp() });
        }
    } catch (err) { alert("Gagal!"); }
});

// === LOGIKA NOTIFIKASI ===
function loadNotifikasi() {
    const qNotif = query(collection(db, "notifikasi"), where("targetUserId", "==", currentUser.deviceId), orderBy("waktu", "desc"));
    onSnapshot(qNotif, (snapshot) => {
        containers.notifikasi.innerHTML = '';
        if(snapshot.empty) { containers.notifikasi.innerHTML = `<div class="text-center text-gray-400 py-10 text-sm">Belum ada notifikasi.</div>`; return; }

        if(tabs.notifikasi.classList.contains('hidden')) document.getElementById('notifBadge').classList.remove('hidden');

        snapshot.forEach(docSnap => {
            const notif = docSnap.data();
            const waktu = notif.waktu ? new Date(notif.waktu.toDate()).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' }) : 'Baru saja';
            let icon = notif.tipe === 'like' 
                ? `<svg class="w-5 h-5 text-red-500 fill-current mt-1" viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>`
                : `<svg class="w-5 h-5 text-primary fill-current mt-1" viewBox="0 0 20 20"><path d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"></path></svg>`;
            let pesan = notif.tipe === 'like' ? `<b>${notif.dariNama}</b> menyukai laporan Anda.` : `<b>${notif.dariNama}</b> berkomentar: "${notif.teksKomentar}"`;

            containers.notifikasi.innerHTML += `<div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex gap-3 fade-in">${icon}<div><p class="text-sm text-gray-800 leading-snug">${pesan}</p><p class="text-[10px] text-gray-400 mt-1">${waktu} WITA</p></div></div>`;
        });
    });
}

// === LOGIKA TAB PROFIL ===
function loadProfilData(user) {
    document.getElementById('profilNama').textContent = user.name;
    document.getElementById('profilJabatan').textContent = user.role;
    document.getElementById('profilWilayah').textContent = `Kec. ${user.kecamatan || '-'} - Desa ${user.desa || '-'}`;
    document.getElementById('profilInisial').textContent = user.name.substring(0, 2).toUpperCase();

    if(user.sosmed) {
        document.getElementById('editWA').value = user.sosmed.wa || "";
        document.getElementById('editIG').value = user.sosmed.ig || "";
        document.getElementById('editFB').value = user.sosmed.fb || "";
        document.getElementById('editTikTok').value = user.sosmed.tiktok || "";
        document.getElementById('editWeb').value = user.sosmed.web || "";
    }
}

document.getElementById('formProfil').addEventListener('submit', (e) => {
    e.preventDefault();
    const sosmedData = {
        wa: document.getElementById('editWA').value,
        ig: document.getElementById('editIG').value,
        fb: document.getElementById('editFB').value,
        tiktok: document.getElementById('editTikTok').value,
        web: document.getElementById('editWeb').value
    };
    updateProfileData(sosmedData);
    alert("Berhasil: Data Profil Sosial Media telah diperbarui!");
});

// === LOGIKA UPLOAD LAPORAN KEGIATAN BARU ===
btnUploadKegiatan.addEventListener('click', async () => {
    const deskripsi = prompt("📝 Tulis deskripsi laporan lapangan:\n(Contoh: Posyandu di Dusun Bayan)");
    if (!deskripsi) return;

    const originalContent = btnUploadKegiatan.innerHTML;
    btnUploadKegiatan.innerHTML = `<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
    btnUploadKegiatan.classList.add('pointer-events-none');

    try {
        const locationData = await getCurrentLocation();
        const photoData = await openCameraAndCapture(currentUser, locationData); 
        
        await addDoc(collection(db, "kegiatan"), {
            deviceId: currentUser.deviceId,
            nama: currentUser.name,
            jabatan: currentUser.role,
            kecamatan: currentUser.kecamatan || "",
            desa: currentUser.desa || "",
            deskripsi: deskripsi,
            tanggal: new Date().toISOString().split('T')[0],
            waktu: serverTimestamp(),
            fotoUrl: photoData, 
            lokasi: locationData,
            likes: [], 
            komentarCount: 0 
        });

        switchTab('beranda');
        btnUploadKegiatan.innerHTML = originalContent;
        btnUploadKegiatan.classList.remove('pointer-events-none');
        
    } catch (error) {
        alert("GAGAL: " + error);
        btnUploadKegiatan.innerHTML = originalContent;
        btnUploadKegiatan.classList.remove('pointer-events-none');
    }
});
