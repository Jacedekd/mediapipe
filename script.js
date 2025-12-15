// script.js

const videoElement = document.getElementById("input_video");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusEl = document.getElementById("status");

let camera = null;
let pose = null;

// === ЗАГРУЗКА КАРТИНКИ ===
const dressImage = new Image();
dressImage.src = "assets/dress1.png"; // Убедитесь, что путь верный

// === ГЛАВНЫЕ НАСТРОЙКИ (КРУТИТЕ ЗДЕСЬ) ===
const CONFIG = {
    // 1. ШИРИНА: Увеличивайте, если платье узкое.
    // Попробуйте значения: 3.5, 4.0, 4.5
    scale: 6.1,       

    // 2. ПОСАДКА ПО ВЫСОТЕ (Y): 
    // 0 = центр платья на уровне плеч (высоко).
    // 0.4 = платье сдвигается вниз на 40% своей высоты (нормально).
    // Попробуйте: 0.3, 0.4, 0.5
    offsetYFactor: 0.45,     
    
    // 3. ПОВОРОТ: Если картинка платья изначально кривая
    rotationOffset: 0    
};

function updateStatus(text) {
    if (statusEl) statusEl.innerText = "Статус: " + text;
}

function setupPose() {
    pose = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });

    pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    pose.onResults(onResults);
}

function onResults(results) {
    if (!results.poseLandmarks) return;

    // Настраиваем размер
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;

    // 1. Рисуем ВИДЕО (зеркально)
    canvasCtx.save();
    canvasCtx.translate(canvasElement.width, 0);
    canvasCtx.scale(-1, 1);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.restore(); 

    const landmarks = results.poseLandmarks;
    const L_SH = landmarks[11]; // Левое плечо
    const R_SH = landmarks[12]; // Правое плечо

    // Рисуем платье, только если плечи видны
    if (L_SH && R_SH && L_SH.visibility > 0.5 && R_SH.visibility > 0.5) {
        
        // --- МАТЕМАТИКА КООРДИНАТ ---
        
        // Инвертируем X, так как мы смотрим на зеркальное видео
        const leftX = (1 - L_SH.x) * canvasElement.width;
        const leftY = L_SH.y * canvasElement.height;
        const rightX = (1 - R_SH.x) * canvasElement.width;
        const rightY = R_SH.y * canvasElement.height;

        // Центр между плечами (точка на шее)
        const centerX = (leftX + rightX) / 2;
        const centerY = (leftY + rightY) / 2;

        // Реальная ширина плеч в пикселях
        const dx = rightX - leftX;
        const dy = rightY - leftY;
        const shoulderDist = Math.sqrt(dx*dx + dy*dy);
        
        // Угол наклона тела
        const angle = Math.atan2(dy, dx);

        // --- РАСЧЕТ РАЗМЕРОВ ПЛАТЬЯ ---
        
        // Ширина платья зависит от ширины плеч * масштаб
        const imgW = shoulderDist * CONFIG.scale;
        
        // Высоту считаем пропорционально, чтобы картинка не сплющилась
        const aspectRatio = dressImage.height / dressImage.width;
        const imgH = imgW * aspectRatio;

        // --- ОТРИСОВКА ---
        canvasCtx.save();
        
        // Переносим кисть в точку шеи
        canvasCtx.translate(centerX, centerY);
        
        // Поворачиваем вместе с телом
        canvasCtx.rotate(angle);

        // Сдвигаем платье ВНИЗ по его собственной оси
        // (imgH * CONFIG.offsetYFactor) отвечает за спуск платья с шеи на грудь
        const yShift = imgH * CONFIG.offsetYFactor;

        // Рисуем! 
        // -imgW / 2 -> центрируем по горизонтали
        // -imgH / 2 + yShift -> центрируем по вертикали и сдвигаем вниз
        canvasCtx.drawImage(dressImage, -imgW / 2, -imgH / 2 + yShift, imgW, imgH);
        
        canvasCtx.restore();
    }
}

function startCamera() {
    if (!pose) setupPose();
    const cameraUtils = new Camera(videoElement, {
        onFrame: async () => { await pose.send({ image: videoElement }); },
        width: 1280, height: 720
    });
    camera = cameraUtils;
    camera.start();
    updateStatus("Работает");
    startBtn.disabled = true;
    stopBtn.disabled = false;
}

startBtn.addEventListener("click", startCamera);
stopBtn.addEventListener("click", () => {
    if (camera) {
         videoElement.srcObject.getTracks().forEach(t => t.stop());
         videoElement.srcObject = null;
    }
    updateStatus("Остановлено");
    startBtn.disabled = false;
    stopBtn.disabled = true;
    canvasCtx.clearRect(0,0, canvasElement.width, canvasElement.height);
});
