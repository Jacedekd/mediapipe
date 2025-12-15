// script.js

const videoElement = document.getElementById("input_video");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusEl = document.getElementById("status");
const dressImg = document.getElementById("dressOverlay");

let camera = null;
let pose = null;

// === НАСТРОЙКИ (МОЖНО МЕНЯТЬ) ===
const CONFIG = {
    // Насколько широким должно быть платье относительно плеч
    // 2.0 - ровно по плечам, 3.0 - оверсайз. Попробуйте 2.5 или 2.8
    scale: 2.8, 

    // Сдвиг вверх/вниз. 
    // -0.5 поднимет платье выше к ушам.
    // 0.2 опустит платье ниже.
    offsetY: -0.2, 

    // Дополнительный поворот (в градусах), если платье кривое на картинке
    rotationOffset: 0 
};
// =================================

function updateStatus(text) {
    if (statusEl) statusEl.innerText = "Статус: " + text;
    console.log("[Status]", text);
}

function setupPose() {
    pose = new Pose({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        }
    });

    pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    pose.onResults(onResults);
}

function onResults(results) {
    if (!results.poseLandmarks) return;

    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Отрисовка видео (зеркально)
    canvasCtx.translate(canvasElement.width, 0);
    canvasCtx.scale(-1, 1);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    
    const landmarks = results.poseLandmarks;
    const L_SH = landmarks[11]; // Левое плечо
    const R_SH = landmarks[12]; // Правое плечо

    // Рисуем платье, только если плечи хорошо видны
    if (L_SH && R_SH && L_SH.visibility > 0.6 && R_SH.visibility > 0.6) {
        
        // Координаты (конвертируем из % в пиксели)
        const leftX = L_SH.x * canvasElement.width;
        const rightX = R_SH.x * canvasElement.width;
        const leftY = L_SH.y * canvasElement.height;
        const rightY = R_SH.y * canvasElement.height;

        // Центр между плечами
        const centerX = (leftX + rightX) / 2;
        const centerY = (leftY + rightY) / 2;

        // Ширина плеч
        const dist = Math.sqrt(Math.pow(rightX - leftX, 2) + Math.pow(rightY - leftY, 2));

        // Применяем настройки
        const dressWidth = dist * CONFIG.scale;
        
        dressImg.style.display = "block";
        dressImg.style.width = `${dressWidth}px`;
        
        // Позиция
        // Инвертируем X (canvasWidth - centerX), так как видео отзеркалено
        dressImg.style.left = `${canvasElement.width - centerX}px`; 
        dressImg.style.top = `${centerY + (dist * CONFIG.offsetY)}px`;

        // Угол поворота (чтобы платье наклонялось вместе с телом)
        const angle = Math.atan2(rightY - leftY, rightX - leftX);
        // Конвертируем offset из градусов в радианы
        const rotationFix = CONFIG.rotationOffset * (Math.PI / 180);
        
        // Трансформация:
        // 1. scaleX(-1) — зеркалим картинку (если нужно)
        // 2. rotate(-angle) — поворот против часовой, т.к. видео отзеркалено
        dressImg.style.transform = `translate(-50%, -15%) rotate(${-angle + rotationFix}rad)`; 

    } else {
        dressImg.style.display = "none";
    }

    canvasCtx.restore();
}

function startCamera() {
    if (!pose) setupPose();

    const cameraUtils = new Camera(videoElement, {
        onFrame: async () => {
            await pose.send({ image: videoElement });
        },
        width: 1280,
        height: 720
    });
    
    camera = cameraUtils;
    
    camera.start()
        .then(() => {
            updateStatus("Работает");
            startBtn.disabled = true;
            stopBtn.disabled = false;
        })
        .catch(err => {
            updateStatus("Ошибка камеры: " + err.message);
            console.error(err);
        });
}

function stopCamera() {
    if (camera) {
        const stream = videoElement.srcObject;
        if (stream) {
            const tracks = stream.getTracks();
            tracks.forEach(track => track.stop());
        }
        videoElement.srcObject = null;
    }
    updateStatus("Остановлено");
    startBtn.disabled = false;
    stopBtn.disabled = true;
    dressImg.style.display = "none";
}

startBtn.addEventListener("click", startCamera);
stopBtn.addEventListener("click", stopCamera);

updateStatus("Готов к запуску");