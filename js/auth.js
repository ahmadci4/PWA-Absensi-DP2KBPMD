// js/auth.js

// Fungsi untuk generate UUID unik untuk device
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Cek apakah user sudah terdaftar di device ini
export function checkDeviceAuth() {
    const userData = localStorage.getItem('userData');
    if (userData) {
        return JSON.parse(userData);
    }
    return null;
}

// Simpan data user ke device (Ditambah Wilayah dan Custom Role)
export function registerDevice(name, role, customRole, kecamatan, desa) {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
        deviceId = generateUUID();
        localStorage.setItem('deviceId', deviceId);
    }

    // Tentukan jabatan: Jika memilih "LAINNYA", gunakan input manual
    const finalRole = (role === 'LAINNYA' && customRole) ? customRole : role;

    const userData = {
        deviceId: deviceId,
        name: name,
        role: finalRole,
        kecamatan: kecamatan,
        desa: desa,
        registeredAt: new Date().toISOString(),
        // Struktur awal untuk menyimpan Sosial Media
        sosmed: {
            wa: "",
            ig: "",
            fb: "",
            tiktok: "",
            web: ""
        }
    };

    localStorage.setItem('userData', JSON.stringify(userData));
    return userData;
}

// Fungsi khusus untuk mengupdate data Profil (Sosial Media)
export function updateProfileData(sosmedData) {
    let userData = checkDeviceAuth();
    if(userData) {
        userData.sosmed = sosmedData;
        localStorage.setItem('userData', JSON.stringify(userData));
        return userData;
    }
    return null;
}
