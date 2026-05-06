// js/camera.js

export function openCameraAndCapture(userData, locationData) {
    return new Promise((resolve, reject) => {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black z-[999] flex flex-col fade-in';
        modal.innerHTML = `
            <div class="flex-1 relative overflow-hidden bg-black flex items-center justify-center">
                <video id="cameraStream" autoplay playsinline class="w-full h-full object-cover"></video>
                <canvas id="captureCanvas" class="hidden"></canvas>
                <img id="photoPreview" class="hidden w-full h-full object-cover shadow-2xl">
                
                <!-- Panduan Kamera -->
                <div id="cameraGuide" class="absolute inset-0 border-2 border-white/20 m-10 rounded-2xl pointer-events-none flex items-end justify-center pb-4">
                    <span class="text-white/60 text-[10px] bg-black/40 px-3 py-1 rounded-full uppercase tracking-widest">Dokumentasi Laporan</span>
                </div>

                <!-- Tombol Balik Kamera (Flip) -->
                <button id="btnFlipCamera" class="absolute top-6 right-6 bg-black/40 text-white p-3 rounded-full backdrop-blur-md active:scale-90 transition-transform">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                </button>
            </div>

            <!-- Kontrol Utama Kamera -->
            <div id="cameraControls" class="h-44 bg-gray-900 flex flex-col items-center justify-center gap-4 pb-6">
                <div class="flex items-center gap-10">
                    <button id="btnCloseCam" class="text-white/70 text-sm font-bold px-4 py-2">BATAL</button>
                    <button id="btnCapture" class="w-20 h-20 bg-white rounded-full border-[6px] border-gray-700 shadow-xl active:scale-90 transition-transform"></button>
                    <div class="w-14"></div> <!-- Spacer -->
                </div>
            </div>

            <!-- Kontrol Konfirmasi (Muncul setelah foto diambil) -->
            <div id="confirmControls" class="hidden h-44 bg-gray-900 flex flex-col items-center justify-center gap-5 pb-6">
                <p class="text-white text-xs font-bold tracking-widest">FOTO SUDAH BAGUS?</p>
                <div class="flex items-center gap-6 w-full px-10">
                    <button id="btnRetake" class="flex-1 bg-white/10 text-white font-bold py-4 rounded-2xl border border-white/20 active:scale-95 transition-all uppercase text-xs">Ulangi</button>
                    <button id="btnConfirm" class="flex-1 bg-primary text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all uppercase text-xs">Kirim</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const video = document.getElementById('cameraStream');
        const canvas = document.getElementById('captureCanvas');
        const preview = document.getElementById('photoPreview');
        const guide = document.getElementById('cameraGuide');
        const controlsCam = document.getElementById('cameraControls');
        const controlsConfirm = document.getElementById('confirmControls');
        
        const btnCapture = document.getElementById('btnCapture');
        const btnRetake = document.getElementById('btnRetake');
        const btnConfirm = document.getElementById('btnConfirm');
        const btnClose = document.getElementById('btnCloseCam');
        const btnFlip = document.getElementById('btnFlipCamera');

        let stream;
        let base64Result = "";
        let currentFacingMode = "environment"; // Default kamera belakang

        // Fungsi Memulai Kamera
        async function startCamera(facingMode) {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            try {
                const constraints = { 
                    video: { facingMode: facingMode }, 
                    audio: false 
                };
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                video.srcObject = stream;
            } catch (err) {
                console.error("Error akses kamera:", err);
                alert("Gagal mengakses kamera.");
            }
        }

        // Jalankan Kamera Awal
        startCamera(currentFacingMode);

        // Fungsi Balik Kamera
        btnFlip.onclick = () => {
            currentFacingMode = (currentFacingMode === "user") ? "environment" : "user";
            startCamera(currentFacingMode);
        };

        function closeModal() {
            if (stream) stream.getTracks().forEach(track => track.stop());
            modal.remove();
        }

        // Ambil Foto
        btnCapture.onclick = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');

            // Efek Mirror jika pakai kamera depan
            if (currentFacingMode === "user") {
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
            }
            
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Reset Transformasi setelah draw image
            ctx.setTransform(1, 0, 0, 1, 0, 0);

            // Watermark Data
            const now = new Date();
            const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

            ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
            ctx.fillRect(0, canvas.height - 150, canvas.width, 150);
            ctx.fillStyle = "white";
            ctx.font = "bold 24px sans-serif";
            ctx.fillText(`${userData.name.toUpperCase()} (${userData.role})`, 30, canvas.height - 100);
            ctx.font = "20px sans-serif";
            ctx.fillText(`Waktu: ${dateStr} - ${timeStr} WITA`, 30, canvas.height - 65);
            ctx.fillStyle = "#fef08a";
            ctx.fillText(`Lokasi: ${locationData.lat.toFixed(6)}, ${locationData.lng.toFixed(6)}`, 30, canvas.height - 30);

            base64Result = canvas.toDataURL('image/jpeg', 0.6);
            
            preview.src = base64Result;
            preview.classList.remove('hidden');
            video.classList.add('hidden');
            guide.classList.add('hidden');
            btnFlip.classList.add('hidden');
            
            controlsCam.classList.add('hidden');
            controlsConfirm.classList.remove('hidden');
        };

        // Tombol Ulangi (Retake)
        btnRetake.onclick = () => {
            preview.classList.add('hidden');
            video.classList.remove('hidden');
            guide.classList.remove('hidden');
            btnFlip.classList.remove('hidden');
            controlsCam.classList.remove('hidden');
            controlsConfirm.classList.add('hidden');
            base64Result = "";
        };

        btnConfirm.onclick = () => {
            closeModal();
            resolve(base64Result);
        };

        btnClose.onclick = () => {
            closeModal();
            reject("Dibatalkan.");
        };
    });
}
