// js/camera.js

export function openCameraAndCapture(userData, locationData) {
    return new Promise((resolve, reject) => {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black z-[999] flex flex-col fade-in';
        modal.innerHTML = `
            <div class="flex-1 relative overflow-hidden">
                <video id="cameraStream" autoplay playsinline class="w-full h-full object-cover"></video>
                <canvas id="captureCanvas" class="hidden"></canvas>
                <div class="absolute inset-0 border-2 border-white/40 m-12 rounded-xl pointer-events-none flex items-center justify-center">
                    <span class="text-white/50 text-sm bg-black/50 px-3 py-1 rounded-full">Posisikan wajah di dalam kotak</span>
                </div>
            </div>
            <div class="h-40 bg-gray-900 flex flex-row items-center justify-center gap-10 pb-6">
                <button id="btnCloseCam" class="text-white bg-gray-700 px-6 py-3 rounded-full font-semibold hover:bg-gray-600 transition-all">Batal</button>
                <button id="btnCapture" class="w-20 h-20 bg-white rounded-full border-4 border-gray-400 shadow-[0_0_15px_rgba(255,255,255,0.5)] active:scale-95 transition-all"></button>
                <div class="w-[88px]"></div> 
            </div>
        `;
        document.body.appendChild(modal);

        const video = document.getElementById('cameraStream');
        const canvas = document.getElementById('captureCanvas');
        const btnCapture = document.getElementById('btnCapture');
        const btnClose = document.getElementById('btnCloseCam');
        let stream;

        navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
            .then(s => {
                stream = s;
                video.srcObject = stream;
            })
            .catch(err => {
                closeModal();
                reject("Akses kamera ditolak.");
            });

        function closeModal() {
            if (stream) stream.getTracks().forEach(track => track.stop()); 
            modal.remove();
        }

        btnClose.onclick = () => {
            closeModal();
            reject("Dibatalkan oleh pengguna.");
        };

        btnCapture.onclick = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const now = new Date();
            const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            
            ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
            ctx.fillRect(0, canvas.height - 140, canvas.width, 140);
            
            ctx.font = "bold 26px Arial";
            ctx.fillStyle = "#ffffff"; 
            ctx.fillText(`${userData.name} (${userData.role})`, 20, canvas.height - 90);
            
            ctx.font = "22px Arial";
            ctx.fillStyle = "#fef08a"; 
            ctx.fillText(`Waktu: ${dateStr} - ${timeStr} WITA`, 20, canvas.height - 55);
            
            ctx.fillStyle = "#e0f2fe"; 
            ctx.fillText(`Lokasi: ${locationData.latitude.toFixed(6)}, ${locationData.longitude.toFixed(6)}`, 20, canvas.height - 20);
            
            // Mengubah gambar menjadi teks (Base64) kualitas 50%
            const base64Image = canvas.toDataURL('image/jpeg', 0.5);
            closeModal();
            resolve(base64Image);
        };
    });
}
