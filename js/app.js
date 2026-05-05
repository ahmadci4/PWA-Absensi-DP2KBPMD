// js/app.js
import { db } from './firebase-app.js';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, where, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { checkDeviceAuth, registerDevice, updateProfileData } from './auth.js';
import { getCurrentLocation } from './location.js';
import { openCameraAndCapture } from './camera.js';

// === ELEMENT DOM UTAMA ===
const loginScreen = document.getElementById('loginScreen');
const dashboardScreen = document.getElementById('dashboardScreen');
const loginForm = document.getElementById('loginForm');
const btnUploadKegiatan = document.getElementById('btnUploadKegiatan');

// === ELEMENT TABS & NAV ===
const tabs = { beranda: document.getElementById('tabBeranda'), kategori: document.getElementById('tabKategori'), rekap: document.getElementById('tabRekap'), notifikasi: document.getElementById('tabNotifikasi'), profil: document.getElementById('tabProfil') };
const navs = { beranda: document.getElementById('navBeranda'), kategori: document.getElementById('navKategori'), rekap: document.getElementById('navRekap'), notifikasi: document.getElementById('navNotifikasi'), profil: document.getElementById('navProfil') };
const containers = { beranda: document.getElementById('timelineContainer'), kategori: document.getElementById('kategoriContainer'), rekap: document.getElementById('rekapContainer'), notifikasi: document.getElementById('notifikasiContainer') };

// === ELEMENT MODAL LIHAT PROFIL & KOMENTAR ===
const modalLihatProfil = document.getElementById('modalLihatProfil');
const btnTutupProfil = document.getElementById('btnTutupProfil');
const modalKomentar = document.getElementById('modalKomentar');
const btnCloseModal = document.getElementById('btnCloseModal');
const listKomentar = document.getElementById('listKomentar');
const formKomentar = document.getElementById('formKomentar');
const inputKomentar = document.getElementById('inputKomentar');
const activePostIdInput = document.getElementById('activePostId');

let currentUser = checkDeviceAuth();
let activePostOwnerId = "";
let unsubscribeKomentar = null; 

if (currentUser) showDashboard(currentUser);

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    const name = document.getElementById('regName').value;
    const kec = document.getElementById('regKecamatan').value;
    const desa = document.getElementById('regDesa').value;
    const role = document.getElementById('regRole').value;
    const customRole = document.getElementById('regRoleCustom').value;
    
    currentUser = registerDevice(name, role, customRole, kec, desa);
    // Sinkronkan ke cloud agar bisa dilihat orang lain
    await syncProfileToCloud(currentUser);
    showDashboard(currentUser);
});

async function showDashboard(user) {
    loginScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    dashboardScreen.classList.add('flex');
    loadProfilData(user);
    loadAllMainData();
    loadNotifikasi(); 
}

// === LOGIKA NAVIGASI ===
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
navs.notifikasi.onclick = () => { switchTab('notifikasi'); document.getElementById('notifBadge').classList.add('hidden'); };
navs.profil.onclick = () => switchTab('profil');

// === LOGIKA RENDER DATA (BERANDA, KATEGORI, REKAP) ===
function loadAllMainData() {
    const q = query(collection(db, "kegiatan"), orderBy("waktu", "desc"));
    onSnapshot(q, (snapshot) => {
        const now = new Date().getTime();
        const timeLimit = 24 * 60 * 60 * 1000;
        containers.beranda.innerHTML = '';
        containers.rekap.innerHTML = '';
        let groupedData = {}; let adaData = false;

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if(!data.waktu) return; 
            const postTime = data.waktu.toDate().getTime();
            const age = now - postTime;
            if(age > timeLimit) return; // Hapus otomatis setelah 24 jam

            adaData = true;
            const sisaMs = timeLimit - age;
            const sisaJam = Math.floor(sisaMs / (1000 * 60 * 60));
            const sisaMenit = Math.floor((sisaMs % (1000 * 60 * 60)) / (1000 * 60));
            
            const cardHTML = buildCardHTML(docSnap.id, data, `⏳ ${sisaJam}j ${sisaMenit}m`);
            containers.beranda.innerHTML += cardHTML;

            const waktuTeks = data.waktu.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            containers.rekap.innerHTML += `<tr><td class="p-3"><p class="font-bold text-gray-800 text-sm">${data.nama}</p><p class="text-[10px] text-gray-500 uppercase">${data.jabatan}</p></td><td class="p-3 text-right text-xs font-bold text-primary">${waktuTeks}</td></tr>`;

            const kec = data.kecamatan || "Lainnya"; const desa = data.desa || "Lainnya"; const nama = data.nama || "Tanpa Nama";
            if(!groupedData[kec]) groupedData[kec] = {}; if(!groupedData[kec][desa]) groupedData[kec][desa] = {};
            if(!groupedData[kec][desa][nama]) groupedData[kec][desa][nama] = [];
            groupedData[kec][desa][nama].push(cardHTML);
        });
        renderAkordeonKategori(groupedData);
    });
}

function buildCardHTML(postId, data, countdown) {
    const inisial = data.nama.substring(0, 2).toUpperCase();
    const isLiked = (data.likes || []).includes(currentUser.deviceId);
    const mapsUrl = `https://www.google.com/maps?q=${data.lokasi.lat},${data.lokasi.lng}`;

    return `
        <div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">
            <div class="flex justify-between items-start">
                <div class="flex items-center gap-3 cursor-pointer" onclick="window.lihatProfil('${data.deviceId}')">
                    <div class="bg-primary text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm">${inisial}</div>
                    <div>
                        <h4 class="font-bold text-gray-800 text-sm leading-none hover:text-primary transition-colors">${data.nama}</h4>
                        <p class="text-[10px] text-gray-500 mt-1 font-medium bg-gray-100 px-1.5 py-0.5 inline-block rounded">${data.jabatan}</p>
                    </div>
                </div>
                <div class="bg-rose-50 border border-rose-100 px-2 py-1 rounded text-[9px] font-bold text-rose-500">${countdown}</div>
            </div>
            <p class="text-sm text-gray-700 leading-relaxed px-1">${data.deskripsi}</p>
            <div class="relative w-full rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                <img src="${data.fotoUrl}" class="w-full h-auto object-contain max-h-80">
                <a href="${mapsUrl}" target="_blank" class="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-lg">📍 Buka Map</a>
            </div>
            <div class="flex items-center gap-5 px-1 pt-1">
                <button onclick="window.toggleLike('${postId}', '${data.deviceId}', ${isLiked})" class="flex items-center gap-1.5 ${isLiked ? 'text-red-500' : 'text-gray-400'}">
                    <svg class="w-6 h-6 ${isLiked ? 'fill-current' : 'fill-none'}" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
                    <span class="text-xs font-bold">${(data.likes || []).length}</span>
                </button>
                <button onclick="window.bukaKomentar('${postId}', '${data.deviceId}')" class="flex items-center gap-1.5 text-gray-400">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                    <span class="text-xs font-bold">${data.komentarCount || 0}</span>
                </button>
            </div>
        </div>
    `;
}

function renderAkordeonKategori(groupedData) {
    let html = '';
    for (const kec in groupedData) {
        html += `<details class="mb-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden group"><summary class="p-4 font-bold bg-gray-50 cursor-pointer text-primary flex justify-between items-center"><span>📍 Kec. ${kec}</span><span>▾</span></summary><div class="p-2 pl-4 border-t border-gray-100 bg-white">`;
        for (const desa in groupedData[kec]) {
            html += `<details class="mb-2 border border-gray-100 rounded-lg overflow-hidden group/desa"><summary class="p-3 font-semibold bg-slate-50 cursor-pointer text-gray-700 flex justify-between items-center"><span>🏘️ Desa ${desa}</span><span>▾</span></summary><div class="p-2 pl-4 border-t border-gray-50 bg-white">`;
            for (const nama in groupedData[kec][desa]) {
                html += `<details class="mb-2 bg-white rounded shadow-sm border border-gray-50 group/nama"><summary class="p-3 font-bold cursor-pointer text-secondary">👤 ${nama}</summary><div class="p-2 space-y-4 bg-gray-50">${groupedData[kec][desa][nama].join('')}</div></details>`;
            }
            html += `</div></details>`;
        }
        html += `</div></details>`;
    }
    containers.kategori.innerHTML = html;
}

// === LOGIKA LIHAT PROFIL ORANG LAIN ===
window.lihatProfil = async (userId) => {
    modalLihatProfil.classList.remove('hidden');
    document.getElementById('viewProfilNama').textContent = "Memuat...";
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        const d = userSnap.data();
        document.getElementById('viewProfilInisial').textContent = d.name.substring(0, 2).toUpperCase();
        document.getElementById('viewProfilNama').textContent = d.name;
        document.getElementById('viewProfilJabatan').textContent = d.role;
        document.getElementById('viewProfilWilayah').textContent = `Kec. ${d.kecamatan} - Desa ${d.desa}`;
        
        const container = document.getElementById('viewProfilSosmed');
        container.innerHTML = '';
        const s = d.sosmed || {};
        if(s.wa) container.innerHTML += `<a href="https://wa.me/${s.wa}" target="_blank" class="bg-green-500 text-white p-3 rounded-full shadow-md">WA</a>`;
        if(s.ig) container.innerHTML += `<a href="${s.ig}" target="_blank" class="bg-pink-500 text-white p-3 rounded-full shadow-md">IG</a>`;
        if(s.fb) container.innerHTML += `<a href="${s.fb}" target="_blank" class="bg-blue-600 text-white p-3 rounded-full shadow-md">FB</a>`;
        if(s.tiktok) container.innerHTML += `<a href="${s.tiktok}" target="_blank" class="bg-black text-white p-3 rounded-full shadow-md">TK</a>`;
    }
};
btnTutupProfil.onclick = () => modalLihatProfil.classList.add('hidden');

// === LOGIKA TAB PROFIL PRIBADI ===
function loadProfilData(user) {
    document.getElementById('profilNama').textContent = user.name;
    document.getElementById('profilJabatan').textContent = user.role;
    document.getElementById('profilWilayah').textContent = `Kec. ${user.kecamatan} - Desa ${user.desa}`;
    document.getElementById('profilInisial').textContent = user.name.substring(0, 2).toUpperCase();
    if(user.sosmed) {
        document.getElementById('editWA').value = user.sosmed.wa || "";
        document.getElementById('editIG').value = user.sosmed.ig || "";
        document.getElementById('editFB').value = user.sosmed.fb || "";
        document.getElementById('editTikTok').value = user.sosmed.tiktok || "";
    }
}

document.getElementById('formProfil').addEventListener('submit', async (e) => {
    e.preventDefault();
    const sosmedData = {
        wa: document.getElementById('editWA').value,
        ig: document.getElementById('editIG').value,
        fb: document.getElementById('editFB').value,
        tiktok: document.getElementById('editTikTok').value,
    };
    currentUser = updateProfileData(sosmedData);
    await syncProfileToCloud(currentUser);
    alert("Berhasil: Profil Anda kini dapat dilihat oleh anggota lain!");
});

async function syncProfileToCloud(user) {
    const userRef = doc(db, "users", user.deviceId);
    await setDoc(userRef, user, { merge: true });
}

// === LIKE, KOMENTAR, NOTIFIKASI (TETAP SAMA SEPERTI SESI SEBELUMNYA) ===
window.toggleLike = async (postId, postOwnerId, isLiked) => {
    const postRef = doc(db, "kegiatan", postId);
    if (isLiked) { await updateDoc(postRef, { likes: arrayRemove(currentUser.deviceId) }); } 
    else { 
        await updateDoc(postRef, { likes: arrayUnion(currentUser.deviceId) });
        if (postOwnerId !== currentUser.deviceId) {
            await addDoc(collection(db, "notifikasi"), { targetUserId: postOwnerId, dariNama: currentUser.name, tipe: "like", waktu: serverTimestamp() });
        }
    }
};

window.bukaKomentar = (postId, postOwnerId) => {
    activePostIdInput.value = postId; activePostOwnerId = postOwnerId;
    modalKomentar.classList.remove('hidden');
    const qKom = query(collection(db, "kegiatan", postId, "komentar"), orderBy("waktu", "asc"));
    unsubscribeKomentar = onSnapshot(qKom, (snapshot) => {
        listKomentar.innerHTML = '';
        snapshot.forEach(docSnap => {
            const kom = docSnap.data();
            listKomentar.innerHTML += `<div class="bg-white p-3 rounded-2xl border border-gray-100 w-[90%] fade-in"><p class="font-bold text-[11px] text-primary">${kom.nama}</p><p class="text-sm text-gray-700">${kom.teks}</p></div>`;
        });
        listKomentar.scrollTop = listKomentar.scrollHeight;
    });
};
btnCloseModal.onclick = () => { modalKomentar.classList.add('hidden'); if(unsubscribeKomentar) unsubscribeKomentar(); };
formKomentar.addEventListener('submit', async (e) => {
    e.preventDefault(); const teks = inputKomentar.value; const postId = activePostIdInput.value;
    if(!teks || !postId) return; inputKomentar.value = '';
    await addDoc(collection(db, "kegiatan", postId, "komentar"), { nama: currentUser.name, teks: teks, waktu: serverTimestamp() });
    const postRef = doc(db, "kegiatan", postId);
    const qKom = query(collection(db, "kegiatan", postId, "komentar"));
    import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js").then(async (m) => {
        const snap = await m.getDocs(qKom); await updateDoc(postRef, { komentarCount: snap.size });
    });
    if (activePostOwnerId !== currentUser.deviceId) {
        await addDoc(collection(db, "notifikasi"), { targetUserId: activePostOwnerId, dariNama: currentUser.name, tipe: "komentar", teksKomentar: teks, waktu: serverTimestamp() });
    }
});

function loadNotifikasi() {
    const qNotif = query(collection(db, "notifikasi"), where("targetUserId", "==", currentUser.deviceId), orderBy("waktu", "desc"));
    onSnapshot(qNotif, (snapshot) => {
        containers.notifikasi.innerHTML = '';
        if(snapshot.empty) { containers.notifikasi.innerHTML = `<div class="text-center text-gray-400 py-10 text-sm">Belum ada notifikasi.</div>`; return; }
        if(tabs.notifikasi.classList.contains('hidden')) document.getElementById('notifBadge').classList.remove('hidden');
        snapshot.forEach(docSnap => {
            const n = docSnap.data(); const waktu = n.waktu ? new Date(n.waktu.toDate()).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' }) : 'Baru saja';
            let msg = n.tipe === 'like' ? `<b>${n.dariNama}</b> menyukai laporan Anda.` : `<b>${n.dariNama}</b> berkomentar: "${n.teksKomentar}"`;
            containers.notifikasi.innerHTML += `<div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex gap-3"><div class="w-2 h-2 bg-primary rounded-full mt-2"></div><div><p class="text-sm text-gray-800">${msg}</p><p class="text-[10px] text-gray-400">${waktu}</p></div></div>`;
        });
    });
}

btnUploadKegiatan.addEventListener('click', async () => {
    const deskripsi = prompt("📝 Tulis deskripsi laporan lapangan:");
    if (!deskripsi) return;
    const originalContent = btnUploadKegiatan.innerHTML;
    btnUploadKegiatan.innerHTML = `<span class="animate-spin text-sm">⌛</span>`;
    btnUploadKegiatan.classList.add('pointer-events-none');
    try {
        const loc = await getCurrentLocation(); const foto = await openCameraAndCapture(currentUser, loc); 
        await addDoc(collection(db, "kegiatan"), {
            deviceId: currentUser.deviceId, nama: currentUser.name, jabatan: currentUser.role, kecamatan: currentUser.kecamatan, desa: currentUser.desa,
            deskripsi: deskripsi, tanggal: new Date().toISOString().split('T')[0], waktu: serverTimestamp(), fotoUrl: foto, lokasi: loc, likes: [], komentarCount: 0 
        });
        switchTab('beranda');
        btnUploadKegiatan.innerHTML = originalContent; btnUploadKegiatan.classList.remove('pointer-events-none');
    } catch (error) { alert("GAGAL: " + error); btnUploadKegiatan.innerHTML = originalContent; btnUploadKegiatan.classList.remove('pointer-events-none'); }
});
