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

function updateStatus(text) {
    if (statusEl) statusEl.innerText = "Статус: " + text;
    console.log("[Status]", text);
}

// 1. Настройка нейросети
function setupPose() {
    // Используем глобальную переменную Pose, которая загрузилась из CDN
    pose = new Pose({
        locateFile: (file) => {
            // Очень важно: указываем путь к файлам модели (.tflite, .binarypb)
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

// 2. Обработка каждого кадра
function onResults(results) {
    if (!results.poseLandmarks) return;

    // Подгоняем размер канваса под видео
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Отрисовка видео (зеркально, как в зеркале)
    canvasCtx.translate(canvasElement.width, 0);
    canvasCtx.scale(-1, 1);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    
    // Рисуем ключевые точки (для отладки можно раскомментировать)
    // drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 2});
    // drawLandmarks(canvasCtx, results.poseLandmarks, {color: '#FF0000', lineWidth: 1});

    // --- Логика наложения платья ---
    const landmarks = results.poseLandmarks;
    
    // Индексы точек: 11-левое плечо, 12-правое плечо, 23-левое бедро, 24-правое бедро
    const L_SH = landmarks[11];
    const R_SH = landmarks[12];
    const L_H = landmarks[23];
    const R_H = landmarks[24];

    if (L_SH && R_SH && L_H && R_H) {
        // Вычисляем координаты (MediaPipe дает от 0.0 до 1.0, умножаем на ширину)
        const leftShoulderX = L_SH.x * canvasElement.width;
        const rightShoulderX = R_SH.x * canvasElement.width;
        
        // Ширина плеч
        const shoulderWidth = Math.abs(leftShoulderX - rightShoulderX);
        
        // Центр между плечами
        const centerX = (leftShoulderX + rightShoulderX) / 2;
        const centerY = (L_SH.y * canvasElement.height + R_SH.y * canvasElement.height) / 2;

        // Расчет размеров платья
        // widthPx делаем чуть шире плеч (умножаем на 3, подбирается экспериментально под картинку)
        const widthPx = shoulderWidth * 2.8; 
        
        // Показываем и двигаем картинку
        dressImg.style.display = "block";
        dressImg.style.width = `${widthPx}px`;
        // Поскольку видео отзеркалено в Canvas, но координаты HTML элементов обычные,
        // нам нужно "раззеркалить" координату X для картинки
        dressImg.style.left = `${canvasElement.width - centerX}px`; 
        dressImg.style.top = `${centerY}px`;
        
        // Простой поворот (угол между плечами)
        const dx = R_SH.x - L_SH.x;
        const dy = R_SH.y - L_SH.y;
        // Из-за зеркалирования угол инвертируем
        const angle = -Math.atan2(dy, dx); 
        
        dressImg.style.transform = `translate(-50%, -15%) rotate(${angle}rad) scaleX(-1)`;
    } else {
        dressImg.style.display = "none";
    }

    canvasCtx.restore();
}

// 3. Запуск камеры
function startCamera() {
    if (!pose) setupPose();

    const cameraUtils = new Camera(videoElement, {
        onFrame: async () => {
            await pose.send({ image: videoElement });
        },
        width: 1280,
        height: 720
    });
    
    camera = cameraUtils; // Сохраняем в глобальную переменную
    
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
        // У класса Camera нет метода stop() в старых версиях, но можно остановить поток видео
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
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
}

// Привязка кнопок
startBtn.addEventListener("click", startCamera);
stopBtn.addEventListener("click", stopCamera);

// Инициализация
updateStatus("Готов к запуску");