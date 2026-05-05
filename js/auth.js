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
    const deviceId = localStorage.getItem('deviceId');
    const userData = localStorage.getItem('userData');
    
    if (deviceId && userData) {
        return JSON.parse(userData);
    }
    return null;
}

// Simpan data user ke device
export function registerDevice(name, role) {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
        deviceId = generateUUID();
        localStorage.setItem('deviceId', deviceId);
    }

    const userData = {
        deviceId: deviceId,
        name: name,
        role: role,
        registeredAt: new Date().toISOString()
    };

    localStorage.setItem('userData', JSON.stringify(userData));
    return userData;
}