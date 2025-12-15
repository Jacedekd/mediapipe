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
// Убедитесь, что имя файла верное и КАРТИНКА БЕЗ ФОНА!
dressImage.src = "assets/dress1.png"; 

// === НАСТРОЙКИ (ПОДГОНКА) ===
// Меняйте эти цифры, чтобы платье село идеально
const CONFIG = {
    scale: 3.0,       // Ширина платья (больше = шире)
    offsetY: -10,     // Сдвиг вверх/вниз в пикселях (минус = выше)
    rotationFix: 0    // Если платье нужно чуть довернуть (в градусах)
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

    // 1. Подгоняем размер холста
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;

    // 2. РИСУЕМ ВИДЕО (ЗЕРКАЛЬНО)
    canvasCtx.save();
    canvasCtx.translate(canvasElement.width, 0);
    canvasCtx.scale(-1, 1); // Отражаем по горизонтали
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.restore(); // <--- ВАЖНО: Возвращаем кисть в нормальное состояние!
    
    // С этого момента мы рисуем в ОБЫЧНОМ мире (не зеркальном).
    // Платье теперь точно будет головой вверх.

    const landmarks = results.poseLandmarks;
    const L_SH = landmarks[11]; // Левое плечо
    const R_SH = landmarks[12]; // Правое плечо

    if (L_SH && R_SH && L_SH.visibility > 0.5 && R_SH.visibility > 0.5) {
        
        // 3. ПЕРЕСЧИТЫВАЕМ КООРДИНАТЫ ПОД ЗЕРКАЛЬНОЕ ВИДЕО
        // MediaPipe дает x от 0 (слева) до 1 (справа).
        // Так как мы видео отзеркалили, нам нужно инвертировать X: (1 - x)
        
        const leftX = (1 - L_SH.x) * canvasElement.width;
        const leftY = L_SH.y * canvasElement.height;
        
        const rightX = (1 - R_SH.x) * canvasElement.width;
        const rightY = R_SH.y * canvasElement.height;

        // Центр между плечами
        const centerX = (leftX + rightX) / 2;
        const centerY = (leftY + rightY) / 2;

        // Вычисляем размеры и угол
        const dx = rightX - leftX;
        const dy = rightY - leftY;
        
        // Расстояние между плечами
        const shoulderDist = Math.sqrt(dx*dx + dy*dy);
        
        // Угол наклона
        const angle = Math.atan2(dy, dx);

        // Размеры картинки
        const imgW = shoulderDist * CONFIG.scale;
        const aspectRatio = dressImage.height / dressImage.width;
        const imgH = imgW * aspectRatio;

        // 4. РИСУЕМ ПЛАТЬЕ
        canvasCtx.save();
        
        // Переносим точку рисования в центр между плечами + сдвиг (offsetY)
        canvasCtx.translate(centerX, centerY + CONFIG.offsetY);
        
        // Поворачиваем на угол плеч
        canvasCtx.rotate(angle);

        // Рисуем картинку. 
        // Смещаем на половину ширины влево (-imgW/2), чтобы центр был ровно посередине.
        // Смещаем немного вверх (-imgH/5), чтобы "вешалка" была на уровне плеч.
        canvasCtx.drawImage(dressImage, -imgW / 2, -imgH / 5, imgW, imgH);
        
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