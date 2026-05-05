// js/app.js
import { db } from './firebase-app.js';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { checkDeviceAuth, registerDevice } from './auth.js';
import { getCurrentLocation } from './location.js';
import { openCameraAndCapture } from './camera.js';

// === ELEMENT DOM UTAMA ===
const loginScreen = document.getElementById('loginScreen');
const dashboardScreen = document.getElementById('dashboardScreen');
const loginForm = document.getElementById('loginForm');
const greetName = document.getElementById('greetName');
const btnUploadKegiatan = document.getElementById('btnUploadKegiatan');

// === ELEMENT TABS & NAV ===
const tabs = {
    beranda: document.getElementById('tabBeranda'),
    direktori: document.getElementById('tabDirektori'),
    notifikasi: document.getElementById('tabNotifikasi')
};
const navs = {
    beranda: document.getElementById('navBeranda'),
    direktori: document.getElementById('navDirektori'),
    notifikasi: document.getElementById('navNotifikasi')
};
const containers = {
    beranda: document.getElementById('timelineContainer'),
    direktori: document.getElementById('direktoriContainer'),
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
let unsubscribeKomentar = null; // Untuk menghentikan live-update saat modal ditutup

// === INISIALISASI ===
let currentUser = checkDeviceAuth();
if (currentUser) {
    showDashboard(currentUser);
}

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
    
    // Muat semua data Real-time
    loadFeed(containers.beranda); // Tab Beranda
    loadFeed(containers.direktori, "Semua"); // Tab Direktori
    loadNotifikasi(); // Tab Notifikasi
}

// === LOGIKA NAVIGASI BAWAH ===
function switchTab(activeTabName) {
    // Sembunyikan semua tab & matikan warna icon
    Object.keys(tabs).forEach(key => {
        tabs[key].classList.add('hidden');
        navs[key].classList.remove('text-primary');
        navs[key].classList.add('text-gray-400');
    });
    // Tampilkan tab yg dipilih & nyalakan warna icon
    tabs[activeTabName].classList.remove('hidden');
    navs[activeTabName].classList.remove('text-gray-400');
    navs[activeTabName].classList.add('text-primary');
}

navs.beranda.onclick = () => switchTab('beranda');
navs.direktori.onclick = () => switchTab('direktori');
navs.notifikasi.onclick = () => {
    switchTab('notifikasi');
    document.getElementById('notifBadge').classList.add('hidden'); // Sembunyikan badge merah saat dibuka
};

// === LOGIKA FILTER DIREKTORI ===
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = (e) => {
        // Reset warna tombol filter
        document.querySelectorAll('.filter-btn').forEach(b => {
            b.classList.remove('bg-primary', 'text-white');
            b.classList.add('bg-white', 'text-gray-600');
        });
        // Aktifkan tombol yg diklik
        e.target.classList.remove('bg-white', 'text-gray-600');
        e.target.classList.add('bg-primary', 'text-white');
        
        loadFeed(containers.direktori, e.target.dataset.role);
    };
});

// === LOGIKA RENDER FEED (BERANDA & DIREKTORI) ===
function loadFeed(container, roleFilter = null) {
    let q;
    if (roleFilter && roleFilter !== "Semua") {
        q = query(collection(db, "kegiatan"), where("jabatan", "==", roleFilter), orderBy("waktu", "desc"));
    } else {
        q = query(collection(db, "kegiatan"), orderBy("waktu", "desc"));
    }
    
    onSnapshot(q, (snapshot) => {
        container.innerHTML = ''; 
        if(snapshot.empty) {
            container.innerHTML = `<div class="text-center text-gray-400 py-10">Belum ada postingan.</div>`;
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const postId = docSnap.id;
            const waktu = data.waktu ? new Date(data.waktu.toDate()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Baru saja';
            const inisial = data.nama.substring(0, 2).toUpperCase();
            
            // Hitung Like
            const likesArray = data.likes || [];
            const isLiked = likesArray.includes(currentUser.deviceId);
            const likeCount = likesArray.length;
            const komCount = data.komentarCount || 0;

            const card = document.createElement('div');
            card.className = "bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3 fade-in";
            card.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="bg-primary text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm">${inisial}</div>
                    <div>
                        <h4 class="font-bold text-gray-800 text-sm leading-none">${data.nama}</h4>
                        <p class="text-[11px] text-gray-500 mt-1 font-medium">${data.jabatan} • ${waktu} WITA</p>
                    </div>
                </div>
                <p class="text-sm text-gray-700 leading-relaxed px-1">${data.deskripsi}</p>
                <div class="relative w-full rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                    <img src="${data.fotoUrl}" class="w-full h-auto object-contain max-h-80" alt="Foto">
                </div>
                
                <!-- Action Buttons (Like & Comment) -->
                <div class="flex items-center gap-4 mt-1 px-1 border-t border-gray-50 pt-3">
                    <button onclick="window.toggleLike('${postId}', '${data.deviceId}', ${isLiked})" class="flex items-center gap-1.5 transition-all ${isLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'}">
                        <svg class="w-6 h-6 ${isLiked ? 'fill-current' : 'fill-none'}" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
                        <span class="text-xs font-semibold">${likeCount}</span>
                    </button>
                    <button onclick="window.bukaKomentar('${postId}', '${data.deviceId}')" class="flex items-center gap-1.5 text-gray-500 hover:text-primary transition-all">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                        <span class="text-xs font-semibold">${komCount}</span>
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    });
}

// === FUNGSI LIKE (Di-attach ke window agar bisa dipanggil dari HTML) ===
window.toggleLike = async (postId, postOwnerId, isLiked) => {
    const postRef = doc(db, "kegiatan", postId);
    try {
        if (isLiked) {
            await updateDoc(postRef, { likes: arrayRemove(currentUser.deviceId) });
        } else {
            await updateDoc(postRef, { likes: arrayUnion(currentUser.deviceId) });
            // Kirim Notifikasi jika yg dilike bukan postingan sendiri
            if (postOwnerId !== currentUser.deviceId) {
                await addDoc(collection(db, "notifikasi"), {
                    targetUserId: postOwnerId,
                    dariNama: currentUser.name,
                    tipe: "like",
                    waktu: serverTimestamp()
                });
            }
        }
    } catch (error) { console.error("Error like:", error); }
};

// === FUNGSI BUKA MODAL KOMENTAR ===
window.bukaKomentar = (postId, postOwnerId) => {
    activePostIdInput.value = postId;
    activePostOwnerId = postOwnerId;
    modalKomentar.classList.remove('hidden');
    
    // Load Komentar secara Real-time khusus untuk postingan ini
    const qKom = query(collection(db, "kegiatan", postId, "komentar"), orderBy("waktu", "asc"));
    unsubscribeKomentar = onSnapshot(qKom, (snapshot) => {
        listKomentar.innerHTML = '';
        if(snapshot.empty) {
            listKomentar.innerHTML = `<div class="text-center text-sm text-gray-400 mt-4">Jadilah yang pertama berkomentar!</div>`;
            return;
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
        // Auto scroll ke paling bawah (komentar terbaru)
        listKomentar.scrollTop = listKomentar.scrollHeight;
    });
};

// Tutup Modal Komentar
btnCloseModal.onclick = () => {
    modalKomentar.classList.add('hidden');
    if(unsubscribeKomentar) unsubscribeKomentar(); // Matikan live update komentar
};

// Kirim Komentar
formKomentar.addEventListener('submit', async (e) => {
    e.preventDefault();
    const teks = inputKomentar.value;
    const postId = activePostIdInput.value;
    if(!teks || !postId) return;
    
    inputKomentar.value = ''; // Kosongkan input
    try {
        // Tambah ke sub-koleksi komentar
        await addDoc(collection(db, "kegiatan", postId, "komentar"), {
            nama: currentUser.name,
            jabatan: currentUser.role,
            teks: teks,
            waktu: serverTimestamp()
        });
        
        // Update total komentar di postingan utama
        const postRef = doc(db, "kegiatan", postId);
        // Note: Cara paling aman update counter di PWA sederhana
        const qKom = query(collection(db, "kegiatan", postId, "komentar"));
        import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js").then(async (m) => {
            const snap = await m.getDocs(qKom);
            await updateDoc(postRef, { komentarCount: snap.size });
        });

        // Kirim Notifikasi
        if (activePostOwnerId !== currentUser.deviceId) {
            await addDoc(collection(db, "notifikasi"), {
                targetUserId: activePostOwnerId,
                dariNama: currentUser.name,
                tipe: "komentar",
                teksKomentar: teks,
                waktu: serverTimestamp()
            });
        }
    } catch (err) { alert("Gagal mengirim komentar!"); console.error(err); }
});

// === LOGIKA NOTIFIKASI ===
function loadNotifikasi() {
    const qNotif = query(collection(db, "notifikasi"), where("targetUserId", "==", currentUser.deviceId), orderBy("waktu", "desc"));
    onSnapshot(qNotif, (snapshot) => {
        containers.notifikasi.innerHTML = '';
        if(snapshot.empty) {
            containers.notifikasi.innerHTML = `<div class="text-center text-gray-400 py-10 text-sm">Belum ada notifikasi.</div>`;
            return;
        }

        // Tampilkan badge merah di navigasi jika ada notif (dan kita sedang tidak di tab notif)
        if(tabs.notifikasi.classList.contains('hidden')) {
            document.getElementById('notifBadge').classList.remove('hidden');
        }

        snapshot.forEach(docSnap => {
            const notif = docSnap.data();
            const waktu = notif.waktu ? new Date(notif.waktu.toDate()).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' }) : 'Baru saja';
            
            let icon, pesan;
            if(notif.tipe === 'like') {
                icon = `<svg class="w-5 h-5 text-red-500 fill-current mt-1" viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>`;
                pesan = `<b>${notif.dariNama}</b> menyukai laporan kegiatan Anda.`;
            } else {
                icon = `<svg class="w-5 h-5 text-primary fill-current mt-1" viewBox="0 0 20 20"><path d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"></path></svg>`;
                pesan = `<b>${notif.dariNama}</b> berkomentar: "${notif.teksKomentar}"`;
            }

            containers.notifikasi.innerHTML += `
                <div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex gap-3 fade-in">
                    ${icon}
                    <div>
                        <p class="text-sm text-gray-800 leading-snug">${pesan}</p>
                        <p class="text-[10px] text-gray-400 mt-1">${waktu} WITA</p>
                    </div>
                </div>
            `;
        });
    });
}

// === LOGIKA UPLOAD KEGIATAN BARU ===
btnUploadKegiatan.addEventListener('click', async () => {
    const deskripsi = prompt("📝 Tulis deskripsi kegiatan saat ini:\n(Contoh: Posyandu di Dusun Bayan)");
    if (!deskripsi) return;

    const originalContent = btnUploadKegiatan.innerHTML;
    btnUploadKegiatan.innerHTML = `<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
    btnUploadKegiatan.classList.add('pointer-events-none');

    try {
        const locationData = await getCurrentLocation();
        const photoData = await openCameraAndCapture(currentUser, locationData); 
        
        // Simpan ke Firestore dengan penambahan properti "likes" dan "komentarCount"
        await addDoc(collection(db, "kegiatan"), {
            deviceId: currentUser.deviceId,
            nama: currentUser.name,
            jabatan: currentUser.role,
            deskripsi: deskripsi,
            tanggal: new Date().toISOString().split('T')[0],
            waktu: serverTimestamp(),
            fotoUrl: photoData, 
            lokasi: locationData,
            likes: [], // Array kosong untuk menampung ID yang melike
            komentarCount: 0 // Default komentar 0
        });

        // Paksa kembali ke tab Beranda agar langsung melihat hasilnya
        switchTab('beranda');

        btnUploadKegiatan.innerHTML = originalContent;
        btnUploadKegiatan.classList.remove('pointer-events-none');
        
    } catch (error) {
        alert("GAGAL: " + error);
        btnUploadKegiatan.innerHTML = originalContent;
        btnUploadKegiatan.classList.remove('pointer-events-none');
    }
});
