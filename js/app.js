// js/app.js
import { db } from './firebase-app.js';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { checkDeviceAuth, registerDevice, updateProfileData } from './auth.js';
import { getCurrentLocation } from './location.js';
import { openCameraAndCapture } from './camera.js';
import { getDriveLinkByName } from './drive.js'; 

// === ELEMENT DOM ===
const loginScreen = document.getElementById('loginScreen');
const dashboardScreen = document.getElementById('dashboardScreen');
const loginForm = document.getElementById('loginForm');
const btnUploadKegiatan = document.getElementById('btnUploadKegiatan');

const tabs = { beranda: document.getElementById('tabBeranda'), laporan: document.getElementById('tabLaporan'), rekap: document.getElementById('tabRekap'), profil: document.getElementById('tabProfil'), about: document.getElementById('tabAbout') };
const navs = { beranda: document.getElementById('navBeranda'), laporan: document.getElementById('navLaporan'), rekap: document.getElementById('navRekap'), profil: document.getElementById('navProfil'), about: document.getElementById('navAbout') };
const containers = { beranda: document.getElementById('timelineContainer'), laporan: document.getElementById('kategoriContainer'), rekap: document.getElementById('rekapContainer') };

const modalLihatProfil = document.getElementById('modalLihatProfil');
const modalKomentar = document.getElementById('modalKomentar');
const inputCari = document.getElementById('inputCariLaporan');

let currentUser = checkDeviceAuth();
let activePostOwnerId = "";
let unsubscribeMain = null;
const activePostIdInput = document.getElementById('activePostId');

if (currentUser) showDashboard(currentUser);

// === LOGIN & REGISTER ===
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('regName').value;
    const kec = document.getElementById('regKecamatan').value;
    const desa = document.getElementById('regDesa').value;
    const role = document.getElementById('regRole').value;
    const customRole = document.getElementById('regRoleCustom').value;
    
    currentUser = registerDevice(name, role, customRole, kec, desa);
    await setDoc(doc(db, "users", currentUser.deviceId), currentUser, { merge: true });
    showDashboard(currentUser);
});

async function showDashboard(user) {
    loginScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    dashboardScreen.classList.add('flex');
    loadProfilData(user);
    initRealtimeData();
}

// === NAVIGASI ===
function switchTab(target) {
    Object.keys(tabs).forEach(k => {
        tabs[k].classList.add('hidden');
        navs[k].classList.replace('text-primary', 'text-gray-400');
        navs[k].classList.add('opacity-70');
    });
    tabs[target].classList.remove('hidden');
    navs[target].classList.replace('text-gray-400', 'text-primary');
    navs[target].classList.remove('opacity-70');
}
Object.keys(navs).forEach(k => navs[k].onclick = () => switchTab(k));

// === LOGIKA DATA (BERANDA, LAPORAN, REKAP) ===
function initRealtimeData() {
    const q = query(collection(db, "kegiatan"), orderBy("waktu", "desc"));
    if(unsubscribeMain) unsubscribeMain();

    unsubscribeMain = onSnapshot(q, (snapshot) => {
        const allPosts = [];
        const now = new Date().getTime();
        // PERBAIKAN: Ubah batas waktu jadi 7 Hari (604.800.000 ms) agar data tidak cepat hilang
        const batasWaktu = 7 * 24 * 60 * 60 * 1000; 

        snapshot.forEach(docSnap => {
            const d = docSnap.data();
            // PERBAIKAN BUG WAKTU: Amankan data yang baru saja dikirim dan belum dapat stempel waktu
            const postTime = d.waktu ? d.waktu.toDate().getTime() : now;
            const age = now - postTime;
            
            // Sembunyikan yang lebih dari 7 Hari
            if(age > batasWaktu) return; 

            allPosts.push({ 
                id: docSnap.id, 
                ...d, 
                waktuMs: postTime,
                waktuTampil: d.waktu ? d.waktu.toDate().toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : 'Baru saja',
                totalInteraksi: (d.likes?.length || 0) + (d.komentarCount || 0) 
            });
        });

        // Beranda: Interaksi Terbanyak di atas, jika sama urutkan waktu terbaru
        const berandaPosts = [...allPosts].sort((a, b) => {
            if(b.totalInteraksi !== a.totalInteraksi) return b.totalInteraksi - a.totalInteraksi;
            return b.waktuMs - a.waktuMs;
        });
        
        renderBeranda(berandaPosts);
        renderRekap(allPosts);
        renderLaporan(allPosts);
    }, (error) => {
        console.error("Error memuat data:", error);
    });
}

function renderBeranda(posts) {
    containers.beranda.innerHTML = posts.length > 0 ? posts.map(p => buildCardHTML(p)).join('') : `<p class="text-center text-gray-400 py-10">Belum ada laporan dalam 7 hari terakhir.</p>`;
}

function renderRekap(posts) {
    containers.rekap.innerHTML = posts.map(p => `
        <tr class="border-b border-gray-50 hover:bg-slate-50 transition-colors">
            <td class="p-3">
                <p class="font-bold text-gray-800">${p.nama || 'Tanpa Nama'}</p>
                <p class="text-[10px] text-gray-400">${p.kecamatan || '-'} - ${p.desa || '-'}</p>
            </td>
            <td class="p-3 text-right font-bold text-primary">${p.waktuTampil} WITA</td>
        </tr>
    `).join('');
}

function renderLaporan(posts) {
    const search = inputCari.value.toLowerCase();
    const filtered = posts.filter(p => (p.nama || "").toLowerCase().includes(search) || (p.desa || "").toLowerCase().includes(search) || (p.jabatan || "").toLowerCase().includes(search));
    
    let structure = {};
    filtered.forEach(p => {
        const j = p.jabatan || 'Lainnya'; const k = p.kecamatan || 'Lainnya'; const d = p.desa || 'Lainnya';
        if(!structure[j]) structure[j] = {};
        if(!structure[j][k]) structure[j][k] = {};
        if(!structure[j][k][d]) structure[j][k][d] = [];
        structure[j][k][d].push(p);
    });

    containers.laporan.innerHTML = Object.keys(structure).map(role => `
        <details class="bg-white rounded-2xl shadow-sm border border-gray-100 mb-3 overflow-hidden group">
            <summary class="p-4 flex justify-between items-center font-bold text-gray-800 cursor-pointer outline-none">
                <span>📁 Kategori ${role}</span><span class="icon-rotate text-primary">▼</span>
            </summary>
            <div class="px-4 pb-4 space-y-2">
                ${Object.keys(structure[role]).map(kec => `
                    <details class="border-l-2 border-primary/20 pl-4 py-1 group/kec">
                        <summary class="py-2 text-sm font-bold text-gray-600 cursor-pointer flex justify-between outline-none">
                            <span>📍 Kec. ${kec}</span><span class="icon-rotate text-[10px]">▼</span>
                        </summary>
                        <div class="space-y-2 mt-2">
                            ${Object.keys(structure[role][kec]).map(desa => `
                                <details class="bg-slate-50 rounded-xl p-1 group/desa">
                                    <summary class="p-2 text-xs font-bold text-secondary cursor-pointer outline-none">🏘️ Desa ${desa}</summary>
                                    <div class="p-2 space-y-4">${structure[role][kec][desa].map(p => buildCardHTML(p)).join('')}</div>
                                </details>
                            `).join('')}
                        </div>
                    </details>
                `).join('')}
            </div>
        </details>
    `).join('');
}

inputCari.oninput = () => initRealtimeData();

// === RENDER KARTU POSTINGAN ===
function buildCardHTML(p) {
    const isMyPost = p.deviceId === currentUser.deviceId;
    // PERBAIKAN BUG MAPS: Menggunakan URL resmi Google Maps
    const mapsUrl = p.lokasi ? `https://www.google.com/maps?q=${p.lokasi.lat},${p.lokasi.lng}` : '#';
    
    return `
        <div class="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-3">
            <div class="flex justify-between items-start">
                <div class="flex items-center gap-3 cursor-pointer" onclick="window.lihatProfil('${p.deviceId}')">
                    <div class="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-bold">${p.nama ? p.nama[0].toUpperCase() : 'A'}</div>
                    <div>
                        <h4 class="text-sm font-bold text-gray-800">${p.nama || 'Tanpa Nama'}</h4>
                        <p class="text-[10px] text-primary font-bold uppercase">${p.jabatan || 'Anggota'}</p>
                    </div>
                </div>
                ${isMyPost ? `
                    <div class="flex gap-2">
                        <button onclick="window.editPost('${p.id}', '${p.deskripsi || ''}')" class="text-gray-400 text-xs px-2 py-1 bg-gray-50 rounded hover:bg-gray-200">Edit</button>
                        <button onclick="window.hapusPost('${p.id}')" class="text-rose-400 text-xs font-bold px-2 py-1 bg-rose-50 rounded hover:bg-rose-100">Hapus</button>
                    </div>
                ` : ''}
            </div>
            <p class="text-sm text-gray-600 px-1">${p.deskripsi || ''}</p>
            
            <div class="relative rounded-2xl overflow-hidden border border-gray-50 bg-gray-100">
                <img src="${p.fotoUrl}" class="w-full object-cover max-h-72" loading="lazy">
                <a href="${mapsUrl}" target="_blank" class="absolute bottom-3 right-3 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full text-[10px] font-bold shadow-sm flex items-center gap-1 text-gray-800 hover:bg-white">📍 Buka Map</a>
            </div>
            
            <div class="flex items-center gap-4 px-1 pt-1">
                <button onclick="window.toggleLike('${p.id}', '${p.deviceId}', ${(p.likes || []).includes(currentUser.deviceId)})" class="text-xs font-bold flex items-center gap-1 ${(p.likes || []).includes(currentUser.deviceId) ? 'text-rose-500' : 'text-gray-400'}">❤️ ${p.likes?.length || 0}</button>
                <button onclick="window.bukaKomentar('${p.id}', '${p.deviceId}')" class="text-xs font-bold text-gray-400 flex items-center gap-1 hover:text-primary">💬 ${p.komentarCount || 0}</button>
                <span class="ml-auto text-[10px] text-gray-400 font-bold">${p.waktuTampil}</span>
            </div>

            <div class="flex gap-2 pt-3 mt-1 border-t border-gray-50">
                <button onclick="window.downloadFoto('${p.fotoUrl}', '${p.nama || 'Foto'}')" class="flex-1 bg-sky-50 text-primary py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 active:scale-95 transition-all hover:bg-sky-100">
                    <span>⬇️</span> Simpan Foto
                </button>
                <button onclick="window.uploadToDrive('${p.nama}')" class="flex-1 bg-orange-50 text-orange-600 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 active:scale-95 transition-all hover:bg-orange-100">
                    <span>☁️</span> Upload Drive
                </button>
            </div>
        </div>
    `;
}

// === FUNGSI DOWNLOAD & G-DRIVE (GLOBAL) ===
window.downloadFoto = (base64Data, namaUser) => {
    const a = document.createElement('a');
    a.href = base64Data;
    const tgl = new Date().toISOString().split('T')[0];
    a.download = `Laporan_${namaUser.replace(/\s+/g, '_')}_${tgl}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};

window.uploadToDrive = (namaUser) => {
    const link = getDriveLinkByName(namaUser);
    if (link) {
        window.open(link, '_blank');
    } else {
        alert(`❌ Maaf, Link Google Drive untuk nama "${namaUser}" tidak ditemukan. Pastikan nama profil Anda sesuai dengan data di pusat.`);
    }
};

// === FUNGSI GLOBAL LAINNYA ===
window.hapusPost = async (id) => { if(confirm("Hapus laporan ini permanen?")) await deleteDoc(doc(db, "kegiatan", id)); };
window.editPost = async (id, old) => { const val = prompt("Edit deskripsi:", old); if(val) await updateDoc(doc(db, "kegiatan", id), { deskripsi: val }); };

window.lihatProfil = async (uid) => {
    modalLihatProfil.classList.remove('hidden');
    const s = await getDoc(doc(db, "users", uid));
    if(s.exists()){
        const d = s.data();
        document.getElementById('viewProfilNama').textContent = d.name || "Tanpa Nama";
        document.getElementById('viewProfilJabatan').textContent = d.role || "Anggota";
        document.getElementById('viewProfilBio').textContent = d.bio || "Tidak ada bio.";
        document.getElementById('viewProfilInisial').textContent = d.name ? d.name[0].toUpperCase() : "A";
        document.getElementById('viewProfilSosmed').innerHTML = `
            ${d.sosmed?.wa ? `<a href="https://wa.me/${d.sosmed.wa}" target="_blank" class="p-3 bg-green-500 text-white rounded-full text-xs shadow-md">WA</a>` : ''}
            ${d.sosmed?.ig ? `<a href="${d.sosmed.ig}" target="_blank" class="p-3 bg-pink-500 text-white rounded-full text-xs shadow-md">IG</a>` : ''}
        `;
    }
};
document.getElementById('btnTutupProfil').onclick = () => modalLihatProfil.classList.add('hidden');

// === KOMENTAR & LIKE ===
window.toggleLike = async (postId, postOwnerId, isLiked) => {
    const postRef = doc(db, "kegiatan", postId);
    if (isLiked) { await updateDoc(postRef, { likes: arrayRemove(currentUser.deviceId) }); } 
    else { await updateDoc(postRef, { likes: arrayUnion(currentUser.deviceId) }); }
};

window.bukaKomentar = (postId, postOwnerId) => {
    activePostIdInput.value = postId; activePostOwnerId = postOwnerId;
    modalKomentar.classList.remove('hidden');
    const qKom = query(collection(db, "kegiatan", postId, "komentar"), orderBy("waktu", "asc"));
    onSnapshot(qKom, (snapshot) => {
        const listKomentar = document.getElementById('listKomentar');
        listKomentar.innerHTML = '';
        snapshot.forEach(docSnap => {
            const kom = docSnap.data();
            listKomentar.innerHTML += `<div class="bg-white p-3 rounded-2xl border border-gray-100 w-[90%]"><p class="font-bold text-[11px] text-primary">${kom.nama}</p><p class="text-sm text-gray-700">${kom.teks}</p></div>`;
        });
        listKomentar.scrollTop = listKomentar.scrollHeight;
    });
};
document.getElementById('btnCloseModal').onclick = () => modalKomentar.classList.add('hidden');
document.getElementById('formKomentar').onsubmit = async (e) => {
    e.preventDefault(); const teks = document.getElementById('inputKomentar').value; const postId = activePostIdInput.value;
    if(!teks || !postId) return; document.getElementById('inputKomentar').value = '';
    await addDoc(collection(db, "kegiatan", postId, "komentar"), { nama: currentUser.name, teks: teks, waktu: serverTimestamp() });
    const snap = await getDoc(doc(db, "kegiatan", postId));
    await updateDoc(doc(db, "kegiatan", postId), { komentarCount: (snap.data().komentarCount || 0) + 1 });
};

// === LOGOUT & PROFIL ===
document.getElementById('btnLogout').onclick = () => { if(confirm("Yakin ingin keluar aplikasi?")){ localStorage.clear(); location.reload(); }};
document.getElementById('formProfil').onsubmit = async (e) => {
    e.preventDefault();
    const up = { bio: document.getElementById('editBio').value, sosmed: { wa: document.getElementById('editWA').value, ig: document.getElementById('editIG').value } };
    currentUser = updateProfileData(up);
    await updateDoc(doc(db, "users", currentUser.deviceId), up);
    alert("Profil berhasil diperbarui!"); loadProfilData(currentUser);
};
function loadProfilData(u) {
    document.getElementById('profilNama').textContent = u.name;
    document.getElementById('profilJabatan').textContent = u.role;
    document.getElementById('profilBio').textContent = u.bio || "Ketuk edit untuk menambah bio.";
    document.getElementById('profilInisial').textContent = u.name ? u.name[0].toUpperCase() : "A";
}

// === UPLOAD LAPORAN KAMERA ===
btnUploadKegiatan.onclick = async () => {
    const desc = prompt("📝 Buat deskripsi laporan:");
    if(!desc) return;
    const btnContent = btnUploadKegiatan.innerHTML;
    btnUploadKegiatan.innerHTML = `<span class="animate-spin text-sm">⌛</span> <span class="text-[10px] font-bold tracking-wide uppercase">MEMBUKA KAMERA...</span>`;
    btnUploadKegiatan.classList.add('pointer-events-none');
    
    try {
        const loc = await getCurrentLocation();
        const foto = await openCameraAndCapture(currentUser, loc);
        
        btnUploadKegiatan.innerHTML = `<span class="animate-spin text-sm">⌛</span> <span class="text-[10px] font-bold tracking-wide uppercase">MENGIRIM...</span>`;
        
        await addDoc(collection(db, "kegiatan"), {
            deviceId: currentUser.deviceId, nama: currentUser.name, jabatan: currentUser.role, kecamatan: currentUser.kecamatan, desa: currentUser.desa,
            deskripsi: desc, fotoUrl: foto, lokasi: loc, waktu: serverTimestamp(), likes: [], komentarCount: 0
        });
        switchTab('beranda');
        btnUploadKegiatan.innerHTML = btnContent; 
        btnUploadKegiatan.classList.remove('pointer-events-none');
    } catch (e) { 
        console.log("Kamera dibatalkan / gagal:", e); 
        btnUploadKegiatan.innerHTML = btnContent; 
        btnUploadKegiatan.classList.remove('pointer-events-none'); 
    }
};
