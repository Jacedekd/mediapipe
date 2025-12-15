// script.js

const videoElement = document.getElementById("input_video");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusEl = document.getElementById("status");

let camera = null;
let pose = null;

// === ЗАГРУЗКА КАРТИНКИ ПЛАТЬЯ ===
const dressImage = new Image();
// Укажите точный путь к вашей картинке (без фона!)
dressImage.src = "assets/dress1.png"; 

// === НАСТРОЙКИ (ПОДГОНКА) ===
const CONFIG = {
    scale: 2.8,       // Ширина платья (чем больше, тем шире)
    offsetY: 0,    // Сдвиг вверх-вниз (попробуйте 0, -50, 50)
    rotationFix: 0    // Если платье нужно повернуть (в градусах)
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

    // 1. Настраиваем размеры
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;

    // 2. Очищаем холст
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // 3. Зеркалим всё пространство (и видео, и платье сразу!)
    canvasCtx.translate(canvasElement.width, 0);
    canvasCtx.scale(-1, 1);

    // 4. Рисуем видеопоток
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    // 5. Рисуем платье
    const landmarks = results.poseLandmarks;
    const L_SH = landmarks[11]; // Левое плечо
    const R_SH = landmarks[12]; // Правое плечо

    if (L_SH && R_SH && L_SH.visibility > 0.5 && R_SH.visibility > 0.5) {
        // Координаты (MediaPipe дает от 0 до 1, умножаем на ширину)
        const lx = L_SH.x * canvasElement.width;
        const ly = L_SH.y * canvasElement.height;
        const rx = R_SH.x * canvasElement.width;
        const ry = R_SH.y * canvasElement.height;

        // Центр между плечами
        const centerX = (lx + rx) / 2;
        const centerY = (ly + ry) / 2;

        // Ширина и угол
        const dx = rx - lx;
        const dy = ry - ly;
        const distance = Math.sqrt(dx*dx + dy*dy);
        const angle = Math.atan2(dy, dx); // Угол наклона плеч

        // Размеры платья
        const imgW = distance * CONFIG.scale;
        // Сохраняем пропорции картинки
        const aspectRatio = dressImage.height / dressImage.width; 
        const imgH = imgW * aspectRatio;

        // Рисование с поворотом
        canvasCtx.save(); // Сохраняем текущее состояние
        
        // Переносим кисть в центр между плечами
        canvasCtx.translate(centerX, centerY + CONFIG.offsetY);
        
        // Поворачиваем кисть на угол плеч (+ корректировка, если есть)
        // ВАЖНО: Угол берем отрицательный или положительный в зависимости от зеркальности
        // В данном контексте angle работает корректно, так как весь Context отзеркален
        canvasCtx.rotate(angle);

        // Рисуем картинку (сдвигаем на половину ширины/высоты влево-вверх, чтобы центр был в точке)
        canvasCtx.drawImage(dressImage, -imgW / 2, -imgH / 5, imgW, imgH); 
        // Примечание: -imgH / 5 — это "точка вешалки". Если платье висит слишком низко, меняйте этот делитель (например на / 2)

        canvasCtx.restore(); // Возвращаем кисть назад
    }

    canvasCtx.restore(); // Завершаем зеркальный режим
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
// Остальной код для остановки такой же...