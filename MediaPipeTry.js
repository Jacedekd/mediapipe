// MediaPipeTry.js

const videoElement = document.getElementById("input_video");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusEl = document.getElementById("status");
const dressImg = document.getElementById("dressOverlay");

let camera = null;
let pose = null;
let lastBox = null;

function updateStatus(s) { 
    statusEl.innerText = "Status: " + s; 
    console.log("Status: " + s); // Выводим в консоль
}

// Инициализация MediaPipe Pose
function createPose() {
    // Проверка, что необходимые элементы HTML существуют перед инициализацией
    if (!videoElement || !canvasElement || !startBtn || !stopBtn) {
        updateStatus("ERROR: Missing HTML elements. Check tryon-test.html.");
        return;
    }
    
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
  if (!videoElement.videoWidth) return;

  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  // Зеркальное отражение видео, чтобы оно выглядело как зеркало
  canvasCtx.translate(canvasElement.width, 0);
  canvasCtx.scale(-1, 1);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  // Возвращаем контекст в нормальное состояние для рисования ключевых точек
  canvasCtx.restore(); 
  canvasCtx.save(); // Начинаем новый save/restore для рисования

  if (results.poseLandmarks) {
    
    // --- Логика рисования ключевых точек (зеркально отраженная) ---
    canvasCtx.fillStyle = "rgba(0,255,0,0.9)";
    results.poseLandmarks.forEach(pt => {
        // Координаты LandMark уже отражены, т.к. results.image было отражено.
        // Используем стандартные координаты (0..1)
      const x = pt.x * canvasElement.width; 
      const y = pt.y * canvasElement.height;
      canvasCtx.beginPath();
      canvasCtx.arc(x, y, 3, 0, 2 * Math.PI);
      canvasCtx.fill();
    });
    
    // --- Логика наложения платья (CSS) ---
    const L_SH = results.poseLandmarks[11];
    const R_SH = results.poseLandmarks[12];
    const L_H = results.poseLandmarks[23];
    const R_H = results.poseLandmarks[24];
    
    if (L_SH && R_SH && L_H && R_H) {
      // Вычисление рамки (координаты 0..1)
      const sx = Math.min(L_SH.x, R_SH.x);
      const ex = Math.max(L_SH.x, R_SH.x);
      const sy = Math.min(L_SH.y, R_SH.y);
      const ey = Math.max(L_H.y, R_H.y);
        
      const w = (ex - sx) * canvasElement.width;
      const h = (ey - sy) * canvasElement.height;
        
        // Координаты центра в пикселях (не нужно инвертировать X)
        const cx_pixel = (sx + ex) / 2 * canvasElement.width;
        const cy_pixel = (sy + ey) / 2 * canvasElement.height;

      // Угол наклона плеч
      const dx = (R_SH.x - L_SH.x) * canvasElement.width;
      const dy = (R_SH.y - L_SH.y) * canvasElement.height;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      lastBox = { w, h, angle, cx: cx_pixel, cy: cy_pixel };
        
      // Отображаем overlay (картинка платья)
      dressImg.style.display = "block";
      const widthPx = w * 1.05; 
      dressImg.style.width = `${widthPx}px`;
      dressImg.style.left = `${lastBox.cx}px`;
      dressImg.style.top = `${lastBox.cy}px`;
      dressImg.style.transform = `translate(-50%,-50%) rotate(${lastBox.angle}deg)`;
    } else {
      dressImg.style.display = "none";
    }
  } else {
    dressImg.style.display = "none";
  }

  canvasCtx.restore();
}

// Запуск камеры
function startCamera() {
  if (!pose) createPose();
    
    // Проверка наличия кнопки, чтобы избежать ошибки
    if (!startBtn) {
        updateStatus("ERROR: Start button not found.");
        return;
    }

    try {
        camera = new Camera(videoElement, {
            onFrame: async () => {
                await pose.send({ image: videoElement });
            },
            width: 1280,
            height: 720
        });

        // Именно здесь браузер запрашивает разрешение
        camera.start(); 
        updateStatus("running");
    } catch (error) {
        // Ловим ошибку, если браузер отказал в доступе или произошел сбой
        updateStatus("ERROR: " + error.name + " (" + error.message + ")");
        console.error("Camera startup failed:", error);
    }
}

// Остановка камеры
function stopCamera() {
  if (camera) {
    camera.stop();
    camera = null;
  }
  updateStatus("stopped");
  dressImg.style.display = "none";
}

// Кнопки
if (startBtn && stopBtn) {
    startBtn.addEventListener("click", startCamera);
    stopBtn.addEventListener("click", stopCamera);
}

// Инициализация при загрузке
window.addEventListener("load", () => {
  createPose();
  updateStatus("ready");
});

