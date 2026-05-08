// js/camera.js

export function openCameraAndCapture(userData, locationData) {
    return new Promise((resolve, reject) => {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black z-[999] flex flex-col';
        modal.innerHTML = `
            <div class="flex-1 relative overflow-hidden bg-black flex items-center justify-center">
                <video id="cameraStream" autoplay playsinline muted class="w-full h-full object-cover z-10"></video>
                <canvas id="captureCanvas" class="hidden"></canvas>
                <img id="photoPreview" class="hidden w-full h-full object-cover z-20">
                
                <div id="cameraGuide" class="absolute inset-0 border-2 border-white/20 m-6 rounded-2xl pointer-events-none flex items-end justify-center pb-4 z-20">
                    <span class="text-white/80 text-[10px] bg-black/50 backdrop-blur px-3 py-1.5 rounded-full uppercase tracking-widest font-bold">Dokumentasi Laporan</span>
                </div>

                <button id="btnFlipCamera" class="absolute top-6 right-6 bg-black/50 text-white p-3 rounded-full z-30 border border-white/20 active:scale-90 transition-transform">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                </button>
            </div>

            <div id="cameraControls" class="h-44 bg-gray-900 flex flex-col items-center justify-center pb-6 z-30">
                <div class="flex items-center justify-between w-full px-8">
                    <button id="btnCloseCam" class="text-white/70 text-sm font-bold py-2">BATAL</button>
                    <button id="btnCapture" class="w-20 h-20 bg-white rounded-full border-[6px] border-gray-700 shadow-xl active:scale-90 transition-transform"></button>
                    <div class="w-12"></div>
                </div>
            </div>

            <div id="confirmControls" class="hidden h-44 bg-gray-900 flex flex-col items-center justify-center gap-4 pb-6 z-30">
                <p class="text-white/80 text-[10px] font-bold tracking-widest uppercase">Foto sudah jelas?</p>
                <div class="flex items-center gap-4 w-full px-6">
                    <button id="btnRetake" class="flex-1 bg-white/10 text-white font-bold py-3.5 rounded-xl border border-white/20 text-sm uppercase active:scale-95 transition-transform">Ulangi</button>
                    <button id="btnConfirm" class="flex-1 bg-primary text-white font-bold py-3.5 rounded-xl text-sm uppercase shadow-lg active:scale-95 transition-transform">Kirim Foto</button>
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
        let currentFacingMode = "environment"; 

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
                // PERBAIKAN: Paksa putar video untuk HP
                video.play().catch(e => console.log("Play error:", e));
            } catch (err) {
                alert("Kamera gagal diakses. Pastikan izin kamera aktif di browser atau HP Anda.");
                reject(err);
            }
        }

        startCamera(currentFacingMode);

        btnFlip.onclick = () => {
            currentFacingMode = (currentFacingMode === "user") ? "environment" : "user";
            startCamera(currentFacingMode);
        };

        function closeModal() {
            if (stream) stream.getTracks().forEach(track => track.stop());
            modal.remove();
        }

        btnCapture.onclick = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');

            if (currentFacingMode === "user") {
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
            }
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            ctx.setTransform(1, 0, 0, 1, 0, 0);

            const now = new Date();
            const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

            const fontSizeTitle = Math.floor(canvas.height * 0.035);
            const fontSizeText = Math.floor(canvas.height * 0.025);
            const boxHeight = fontSizeTitle + (fontSizeText * 2) + 60;

            ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
            ctx.fillRect(0, canvas.height - boxHeight, canvas.width, boxHeight);
            ctx.fillStyle = "white";
            ctx.font = `bold ${fontSizeTitle}px Arial`;
            ctx.fillText(`${userData.name.toUpperCase()} (${userData.role})`, 30, canvas.height - boxHeight + 40);
            ctx.font = `${fontSizeText}px Arial`;
            ctx.fillText(`Waktu : ${dateStr} - ${timeStr} WITA`, 30, canvas.height - boxHeight + 80);
            ctx.fillStyle = "#fef08a"; 
            ctx.fillText(`Lokasi : ${locationData.lat.toFixed(6)}, ${locationData.lng.toFixed(6)}`, 30, canvas.height - 25);

            base64Result = canvas.toDataURL('image/jpeg', 0.6);
            
            preview.src = base64Result;
            preview.classList.remove('hidden');
            video.classList.add('hidden');
            guide.classList.add('hidden');
            btnFlip.classList.add('hidden');
            
            controlsCam.classList.add('hidden');
            controlsConfirm.classList.remove('hidden');
        };

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
            reject("Kamera dibatalkan.");
        };
    });
}
