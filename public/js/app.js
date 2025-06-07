document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // Elementos del DOM
    const protectorPantalla = document.getElementById('protector-pantalla');
    const screensaverImage = document.getElementById('screensaver-image');
    const menuPrincipal = document.getElementById('menu-principal');
    const captureSection = document.getElementById('capture-section');
    const webcamPreview = document.getElementById('webcam-preview');
    const photoCanvas = document.getElementById('photo-canvas');
    const countdownDisplay = document.getElementById('countdown-display');
    const flashBlanco = document.getElementById('flash-blanco');
    const reviewDrawSection = document.getElementById('review-draw-section');
    const collageCanvas = document.getElementById('collage-canvas');
    const colorPicker = document.getElementById('color-picker');
    const btnUndoDraw = document.getElementById('btn-undo-draw');
    const btnCancelDraw = document.getElementById('btn-cancel-draw');
    const btnRetakePhoto = document.getElementById('btn-retake-photo');
    const btnSaveCollage = document.getElementById('btn-save-collage');
    const videoRecordSection = document.getElementById('video-record-section');
    const videoPreview = document.getElementById('video-preview');
    const videoCountdown = document.getElementById('video-countdown');
    const btnStartRecording = document.getElementById('btn-start-recording');
    const btnStopRecording = document.getElementById('btn-stop-recording');
    const btnPlayVideo = document.getElementById('btn-play-video');
    const btnEraseVideo = document.getElementById('btn-erase-video');
    const btnRetakeVideo = document.getElementById('btn-retake-video');
    const btnSaveVideo = document.getElementById('btn-save-video');
    const gallerySection = document.getElementById('gallery-section');
    const galleryContent = document.getElementById('gallery-content');
    const btnBackToMenuFromGallery = document.getElementById('btn-back-to-menu-from-gallery');


    // Botones del menú principal
    const btnRecordVideo = document.getElementById('btn-record-video');
    const btnTake1Photo = document.getElementById('btn-take-1-photo');
    const btnTake2Photos = document.getElementById('btn-take-2-photos');
    const btnTake3Photos = document.getElementById('btn-take-3-photos');
    const btnTake4Photos = document.getElementById('btn-take-4-photos');
    const btnGallery = document.getElementById('btn-gallery');
    const btnTakeDsrlPhoto = document.getElementById('btn-take-dsrl-photo');

    let currentStream; // Para la webcam
    let mediaRecorder; // Para la grabación de video
    let videoChunks = []; // Para almacenar los datos del video
    let photosTaken = []; // Almacena los data URLs de las fotos tomadas para el collage
    let numberOfPhotosToTake = 0;
    let drawingContext;
    let drawingHistory = [];
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let screensaverImages = [];
    let currentScreensaverIndex = 0;
    let screensaverFadeInterval;
    let activityTimer;
    const INACTIVITY_TIMEOUT = 5000; // 5 segundos de inactividad para el protector de pantalla

    // --- Funciones de Utilidad y Navegación ---

    const hideAllSections = () => {
        menuPrincipal.style.display = 'none';
        captureSection.style.display = 'none';
        reviewDrawSection.style.display = 'none';
        videoRecordSection.style.display = 'none';
        gallerySection.style.display = 'none';
        protectorPantalla.style.display = 'none';
    };

    const showMenu = () => {
        hideAllSections();
        menuPrincipal.style.display = 'flex';
        stopWebcam();
        resetActivityTimer();
    };

    const showCaptureSection = () => {
        hideAllSections();
        captureSection.style.display = 'flex';
        startWebcam(webcamPreview);
        resetActivityTimer();
    };

    const showReviewDrawSection = (collageDataUrl) => {
        hideAllSections();
        reviewDrawSection.style.display = 'flex';
        stopWebcam();
        loadCollageForDrawing(collageDataUrl);
        resetActivityTimer();
    };

    const showVideoRecordSection = () => {
        hideAllSections();
        videoRecordSection.style.display = 'flex';
        startWebcam(videoPreview, true); // True para audio
        resetActivityTimer();
    };

    const showGallery = async () => {
        hideAllSections();
        gallerySection.style.display = 'flex';
        await loadGalleryItems();
        resetActivityTimer();
    };

    // --- Protector de Pantalla ---

    const resetActivityTimer = () => {
        clearTimeout(activityTimer);
        protectorPantalla.classList.add('hidden'); // Ocultar si está visible
        activityTimer = setTimeout(showScreensaver, INACTIVITY_TIMEOUT);
    };

    const showScreensaver = () => {
        if (screensaverImages.length > 0) {
            protectorPantalla.style.display = 'flex';
            protectorPantalla.classList.remove('hidden');
            startScreensaverFade();
        }
    };

    const startScreensaverFade = () => {
        if (screensaverImages.length <= 1) {
            screensaverImage.src = screensaverImages[0] || '';
            return;
        }

        clearInterval(screensaverFadeInterval);
        screensaverFadeInterval = setInterval(() => {
            currentScreensaverIndex = (currentScreensaverIndex + 1) % screensaverImages.length;
            screensaverImage.src = screensaverImages[currentScreensaverIndex];
        }, 5000); // Cambia cada 5 segundos
    };

    const stopScreensaverFade = () => {
        clearInterval(screensaverFadeInterval);
    };

    // Eventos para ocultar el protector de pantalla
    document.addEventListener('mousemove', resetActivityTimer);
    document.addEventListener('click', resetActivityTimer);
    document.addEventListener('keydown', resetActivityTimer);

    socket.on('screensaver-status', (data) => {
        if (!data.hasImages) {
            console.log('No hay imágenes para el protector de pantalla, se desactiva.');
            clearTimeout(activityTimer); // Desactiva el temporizador si no hay imágenes
            protectorPantalla.style.display = 'none'; // Asegúrate de que esté oculto
        } else {
            resetActivityTimer(); // Reinicia el temporizador si hay imágenes
        }
    });

    socket.on('screensaver-update', (images) => {
        screensaverImages = images;
        if (screensaverImages.length > 0) {
            screensaverImage.src = screensaverImages[currentScreensaverIndex] || '';
            startScreensaverFade();
        } else {
            stopScreensaverFade();
        }
        resetActivityTimer(); // Reiniciar el temporizador después de una actualización
    });

    // --- Webcam y Captura de Fotos ---

    const startWebcam = async (videoElement, includeAudio = false) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: includeAudio });
            videoElement.srcObject = stream;
            currentStream = stream;
            // Asegúrate de que el video esté reproduciéndose antes de intentar capturar
            await videoElement.play();
        } catch (err) {
            console.error('Error al acceder a la webcam:', err);
            alert('No se pudo acceder a la webcam. Asegúrate de tener una conectada y dar permisos.');
            showMenu();
        }
    };

    const stopWebcam = () => {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
        }
    };

    const takePhoto = (canvas, video) => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/png'); // Obtiene la imagen como Data URL
    };

    const flashEffect = () => {
        flashBlanco.classList.add('active');
        setTimeout(() => {
            flashBlanco.classList.remove('active');
        }, 100); // Pequeño retardo para el efecto flash
    };

    const startPhotoSequence = async (count) => {
        photosTaken = []; // Reinicia las fotos tomadas
        numberOfPhotosToTake = count;
        showCaptureSection(); // Asegura que la sección de captura esté visible

        for (let i = 0; i < numberOfPhotosToTake; i++) {
            await new Promise(resolve => {
                let countdown = 5;
                countdownDisplay.textContent = `Prepárate en ${countdown}`;
                const timer = setInterval(() => {
                    countdown--;
                    countdownDisplay.textContent = `Prepárate en ${countdown}`;
                    if (countdown === 0) {
                        clearInterval(timer);
                        countdownDisplay.textContent = ''; // Limpiar el contador
                        flashBlanco.textContent = 'Sonríe';
                        flashEffect();
                        // Esperar un poco para que el flash sea visible antes de tomar la foto
                        setTimeout(() => {
                            const photoDataUrl = takePhoto(photoCanvas, webcamPreview);
                            photosTaken.push(photoDataUrl);
                            resolve();
                        }, 150); // Ajustar el tiempo si es necesario
                    }
                }, 1000);
            });
        }

        // Una vez que todas las fotos son tomadas, crear el collage
        const templateName = `marco${numberOfPhotosToTake}.png`;
        await createCollage(photosTaken, templateName);
    };

    const createCollage = async (photos, template) => {
        try {
            const response = await fetch('/api/create-collage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ photoData: photos, templateName: template })
            });
            console.log(response)

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error al crear el collage: ${errorText}`);
            }

            const data = await response.json();
            showReviewDrawSection(data.collage);
        } catch (error) {
            console.error('Error en createCollage:', error);
            alert('Hubo un error al crear el collage. Inténtalo de nuevo.');
            showMenu();
        }
    };


    // --- Dibujo sobre el Collage ---

    const loadCollageForDrawing = (collageDataUrl) => {
        const img = new Image();
        img.onload = () => {
            collageCanvas.width = img.width;
            collageCanvas.height = img.height;
            drawingContext = collageCanvas.getContext('2d');
            drawingContext.drawImage(img, 0, 0);
            drawingContext.strokeStyle = colorPicker.value;
            drawingContext.lineWidth = 5;
            drawingContext.lineJoin = 'round';
            drawingContext.lineCap = 'round';
            drawingHistory = [collageCanvas.toDataURL()]; // Guarda el estado inicial
        };
        img.src = collageDataUrl;
    };

    collageCanvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        [lastX, lastY] = [e.offsetX, e.offsetY];
    });

    collageCanvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        drawingContext.beginPath();
        drawingContext.moveTo(lastX, lastY);
        drawingContext.lineTo(e.offsetX, e.offsetY);
        drawingContext.stroke();
        [lastX, lastY] = [e.offsetX, e.offsetY];
    });

    collageCanvas.addEventListener('mouseup', () => {
        isDrawing = false;
        drawingContext.closePath();
        drawingHistory.push(collageCanvas.toDataURL()); // Guarda el estado después de dibujar
    });

    collageCanvas.addEventListener('mouseout', () => {
        isDrawing = false;
        if (drawingHistory.length > 0 && drawingHistory[drawingHistory.length - 1] !== collageCanvas.toDataURL()) {
             drawingHistory.push(collageCanvas.toDataURL());
        }
    });


    colorPicker.addEventListener('input', (e) => {
        drawingContext.strokeStyle = e.target.value;
    });

    btnUndoDraw.addEventListener('click', () => {
        if (drawingHistory.length > 1) { // Necesitas al menos el estado inicial y uno más
            drawingHistory.pop(); // Elimina el último estado
            const lastState = new Image();
            lastState.onload = () => {
                drawingContext.clearRect(0, 0, collageCanvas.width, collageCanvas.height);
                drawingContext.drawImage(lastState, 0, 0);
            };
            lastState.src = drawingHistory[drawingHistory.length - 1];
        }
    });

    btnCancelDraw.addEventListener('click', () => {
        showMenu();
    });

    btnRetakePhoto.addEventListener('click', () => {
        startPhotoSequence(numberOfPhotosToTake);
    });

    btnSaveCollage.addEventListener('click', async () => {
        const imageData = collageCanvas.toDataURL('image/png');
        try {
            const response = await fetch('/api/save-photo', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ imageData })
            });

            if (response.ok) {
                alert('Collage guardado exitosamente!');
                showMenu();
            } else {
                alert('Error al guardar el collage.');
            }
        } catch (error) {
            console.error('Error al guardar el collage:', error);
            alert('Error de conexión al guardar el collage.');
        }
    });

    // --- Grabación de Videomensajes ---

    let videoTimerInterval;
    let videoRemainingTime = 60; // 60 segundos límite

    btnStartRecording.addEventListener('click', async () => {
        videoChunks = [];
        videoRemainingTime = 60;
        videoCountdown.textContent = ''; // Limpiar el contador inicial

        let countdown = 5;
        videoCountdown.textContent = `Prepárate en ${countdown}`;
        const startTimer = setInterval(() => {
            countdown--;
            videoCountdown.textContent = `Prepárate en ${countdown}`;
            if (countdown === 0) {
                clearInterval(startTimer);
                videoCountdown.textContent = 'Grabando...';
                btnStartRecording.style.display = 'none';
                btnStopRecording.style.display = 'inline-block';
                startVideoRecording();
            }
        }, 1000);
    });

    const startVideoRecording = () => {
        try {
            mediaRecorder = new MediaRecorder(currentStream, { mimeType: 'video/webm' }); // Puedes probar 'video/mp4' pero webm es más común en navegadores
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    videoChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const videoBlob = new Blob(videoChunks, { type: 'video/webm' });
                const videoUrl = URL.createObjectURL(videoBlob);
                videoPreview.srcObject = null; // Detener la vista previa en vivo
                videoPreview.src = videoUrl;
                videoPreview.controls = true; // Mostrar controles para reproducción

                btnStopRecording.style.display = 'none';
                btnPlayVideo.style.display = 'inline-block';
                btnEraseVideo.style.display = 'inline-block';
                btnRetakeVideo.style.display = 'inline-block';
                btnSaveVideo.style.display = 'inline-block';
                videoCountdown.textContent = '';
                stopWebcam(); // Detener la webcam después de grabar
            };

            mediaRecorder.start();
            videoTimerInterval = setInterval(() => {
                videoRemainingTime--;
                videoCountdown.textContent = `Tiempo restante: ${videoRemainingTime} segundos`;
                if (videoRemainingTime <= 0) {
                    mediaRecorder.stop();
                    clearInterval(videoTimerInterval);
                }
            }, 1000);

        } catch (error) {
            console.error('Error al iniciar la grabación de video:', error);
            alert('No se pudo iniciar la grabación de video.');
            showMenu();
        }
    };

    btnStopRecording.addEventListener('click', () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            clearInterval(videoTimerInterval);
        }
    });

    btnPlayVideo.addEventListener('click', () => {
        videoPreview.play();
    });

    btnEraseVideo.addEventListener('click', () => {
        videoPreview.src = '';
        videoPreview.controls = false;
        videoChunks = [];
        showMenu();
    });

    btnRetakeVideo.addEventListener('click', () => {
        videoPreview.src = '';
        videoPreview.controls = false;
        videoChunks = [];
        btnStartRecording.style.display = 'inline-block';
        btnPlayVideo.style.display = 'none';
        btnEraseVideo.style.display = 'none';
        btnRetakeVideo.style.display = 'none';
        btnSaveVideo.style.display = 'none';
        videoCountdown.textContent = '';
        showVideoRecordSection(); // Reiniciar la sección de grabación
    });

    btnSaveVideo.addEventListener('click', async () => {
        const videoBlob = new Blob(videoChunks, { type: 'video/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(videoBlob);
        reader.onloadend = async () => {
            const base64data = reader.result;
            try {
                const response = await fetch('/api/save-video', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ videoData: base64data })
                });

                if (response.ok) {
                    alert('Videomensaje guardado exitosamente!');
                    showMenu();
                } else {
                    alert('Error al guardar el videomensaje.');
                }
            } catch (error) {
                console.error('Error al guardar el videomensaje:', error);
                alert('Error de conexión al guardar el videomensaje.');
            }
        };
    });

    // --- Galería ---

    const loadGalleryItems = async () => {
        try {
            const response = await fetch('/api/gallery-items');
            if (!response.ok) {
                throw new Error('Error al cargar la galería.');
            }
            const items = await response.json();
            galleryContent.innerHTML = ''; // Limpiar galería existente

            if (items.length === 0) {
                galleryContent.innerHTML = '<p>No hay fotos o videos aún.</p>';
                return;
            }

            items.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('gallery-item');

                if (item.type === 'photo') {
                    const img = document.createElement('img');
                    img.src = item.url;
                    img.alt = item.name;
                    itemDiv.appendChild(img);
                } else if (item.type === 'video') {
                    const video = document.createElement('video');
                    video.src = item.url;
                    video.controls = true;
                    video.autoplay = false;
                    video.muted = true; // Muteado por defecto en la previsualización
                    itemDiv.appendChild(video);
                }
                const nameSpan = document.createElement('span');
                nameSpan.classList.add('gallery-item-name');
                nameSpan.textContent = item.name;
                itemDiv.appendChild(nameSpan);

                galleryContent.appendChild(itemDiv);
            });

        } catch (error) {
            console.error('Error al cargar la galería:', error);
            galleryContent.innerHTML = '<p>Error al cargar la galería. Inténtalo de nuevo.</p>';
        }
    };

    socket.on('new-media-item', (data) => {
        // Recargar la galería si el usuario está en ella, o simplemente notificar
        if (gallerySection.style.display === 'flex') {
            loadGalleryItems();
        } else {
            console.log('Nuevo ítem de medios:', data);
            // Podrías mostrar una notificación al usuario aquí
        }
    });

    btnBackToMenuFromGallery.addEventListener('click', showMenu);

    // --- Botones del Menú Principal ---

    btnRecordVideo.addEventListener('click', showVideoRecordSection);
    btnTake1Photo.addEventListener('click', () => startPhotoSequence(1));
    btnTake2Photos.addEventListener('click', () => startPhotoSequence(2));
    btnTake3Photos.addEventListener('click', () => startPhotoSequence(3));
    btnTake4Photos.addEventListener('click', () => startPhotoSequence(4));
    btnGallery.addEventListener('click', showGallery);

    btnTakeDsrlPhoto.addEventListener('click', async () => {
        if (confirm('¿Seguro que quieres tomar una foto con la DSLR? Asegúrate de que esté conectada y lista.')) {
            try {
                // Puedes mostrar un "cargando" o "preparando cámara" aquí
                alert('Tomando foto con DSLR, por favor espera...');
                const response = await fetch('/api/take-dsrl-photo', {
                    method: 'POST',
                });
                if (response.ok) {
                    alert('Foto tomada con DSLR exitosamente. Revisa la galería.');
                    // Considera mostrar la foto recién tomada o ir a la galería
                    showGallery();
                } else {
                    const errorText = await response.text();
                    alert(`Error al tomar foto con DSLR: ${errorText}`);
                    showMenu();
                }
            } catch (error) {
                console.error('Error en la llamada a la API de DSLR:', error);
                alert('Error de conexión con el servidor para la DSLR.');
                showMenu();
            }
        }
    });

    // Iniciar la aplicación
    showMenu();
});