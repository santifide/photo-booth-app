const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const socketIo = require('socket.io');
const selfsigned = require('selfsigned');
const sharp = require('sharp'); // ¡Ahora usamos Sharp!
const { exec } = require('child_process'); // Para gphoto2

const app = express();

// Generar certificados SSL autofirmados para desarrollo
const attrs = [{ name: 'commonName', value: 'localhost' }];
const pems = selfsigned.generate(attrs, { days: 365 });

const options = {
    key: pems.private,
    cert: pems.cert,
};

const PORT = process.env.PORT || 3000;

// Directorios
const FONDO_PANTALLA_DIR = path.join(__dirname, 'fondo-de-pantalla');
const PLANTILLAS_DIR = path.join(__dirname, 'templates');
const FOTOS_VIDEOS_DIR = path.join(__dirname, 'fotos-videos');

// Crear directorios si no existen
if (!fs.existsSync(FONDO_PANTALLA_DIR)) fs.mkdirSync(FONDO_PANTALLA_DIR);
if (!fs.existsSync(PLANTILLAS_DIR)) fs.mkdirSync(PLANTILLAS_DIR);
if (!fs.existsSync(FOTOS_VIDEOS_DIR)) fs.mkdirSync(FOTOS_VIDEOS_DIR);

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/fotos-videos', express.static(FOTOS_VIDEOS_DIR)); // Para la galería
app.use('/fondo-de-pantalla', express.static(FONDO_PANTALLA_DIR)); // ¡Añade esta línea!

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Crear servidor HTTPS
const server = https.createServer(options, app);
const io = socketIo(server);

// --- Socket.IO para Protector de Pantalla ---
let screensaverImages = [];
let screensaverInterval;

const loadScreensaverImages = () => {
    fs.readdir(FONDO_PANTALLA_DIR, (err, files) => {
        if (err) {
            console.error('Error al leer el directorio de fondo de pantalla:', err);
            screensaverImages = [];
            io.emit('screensaver-status', { hasImages: false });
            return;
        }
        screensaverImages = files
            .filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file))
            .sort() // Ordenar alfabéticamente/numéricamente
            .map(file => `/fondo-de-pantalla/${file}`); // Rutas relativas para el cliente
        io.emit('screensaver-status', { hasImages: screensaverImages.length > 0 });
        if (screensaverImages.length > 0) {
            console.log('Imágenes del protector de pantalla cargadas:', screensaverImages);
            io.emit('screensaver-update', screensaverImages);
        } else {
            console.log('No hay imágenes en el directorio de fondo de pantalla.');
        }
    });
};

// Cargar imágenes al iniciar
loadScreensaverImages();

// Observar cambios en el directorio de fondo de pantalla (opcional, pero buena práctica)
fs.watch(FONDO_PANTALLA_DIR, (eventType, filename) => {
    if (filename) {
        console.log(`Cambio detectado en ${FONDO_PANTALLA_DIR}, recargando imágenes del protector.`);
        loadScreensaverImages();
    }
});


io.on('connection', (socket) => {
    console.log('Cliente conectado para Socket.IO');
    socket.emit('screensaver-update', screensaverImages); // Enviar imágenes al conectar
    socket.emit('screensaver-status', { hasImages: screensaverImages.length > 0 });

    // Aquí puedes agregar más lógica para el socket
});


// --- Rutas API para guardar fotos/videos y gphoto2 ---

// Ruta para guardar fotos (recibirá el base64 de la imagen del frontend)
app.post('/api/save-photo', express.json({ limit: '10mb' }), async (req, res) => {
    try {
        const { imageData } = req.body;
        if (!imageData) {
            return res.status(400).send('No image data provided.');
        }

        const base64Data = imageData.replace(/^data:image\/png;base64,/, "");
        const filename = `${new Date().toISOString().replace(/:/g, '-')}_foto.png`;
        const filepath = path.join(FOTOS_VIDEOS_DIR, filename);

        await fs.promises.writeFile(filepath, base64Data, 'base64');
        console.log(`Foto guardada: ${filepath}`);
        io.emit('new-media-item', { type: 'photo', url: `/fotos-videos/${filename}`, name: filename }); // Notificar a la galería
        res.status(200).send('Foto guardada exitosamente.');
    } catch (error) {
        console.error('Error al guardar la foto:', error);
        res.status(500).send('Error al guardar la foto.');
    }
});

// Ruta para guardar videos (recibirá el blob o base64 del video del frontend)
app.post('/api/save-video', express.json({ limit: '50mb' }), async (req, res) => {
    try {
        const { videoData } = req.body;
        if (!videoData) {
            return res.status(400).send('No video data provided.');
        }

        const base64Data = videoData.replace(/^data:video\/(webm|mp4);base64,/, "");
        const filename = `${new Date().toISOString().replace(/:/g, '-')}_video.webm`; // Asume webm, ajustar si es mp4
        const filepath = path.join(FOTOS_VIDEOS_DIR, filename);

        await fs.promises.writeFile(filepath, base64Data, 'base64');
        console.log(`Video guardado: ${filepath}`);
        io.emit('new-media-item', { type: 'video', url: `/fotos-videos/${filename}`, name: filename }); // Notificar a la galería
        res.status(200).send('Video guardado exitosamente.');
    } catch (error) {
        console.error('Error al guardar el video:', error);
        res.status(500).send('Error al guardar el video.');
    }
});

// Ruta para obtener ítems de la galería
app.get('/api/gallery-items', async (req, res) => {
    try {
        const files = await fs.promises.readdir(FOTOS_VIDEOS_DIR);
        const galleryItems = files
            .filter(file => /\.(png|jpg|jpeg|gif|webm|mp4)$/i.test(file))
            .map(file => {
                const filePath = `/fotos-videos/${file}`;
                const fileType = /\.(png|jpg|jpeg|gif)$/i.test(file) ? 'photo' : 'video';
                return {
                    name: file,
                    url: filePath,
                    type: fileType,
                };
            })
            .sort((a, b) => b.name.localeCompare(a.name)); // Últimos primero
        res.json(galleryItems);
    } catch (error) {
        console.error('Error al obtener ítems de la galería:', error);
        res.status(500).send('Error al obtener ítems de la galería.');
    }
});

// Ruta para tomar foto con DSLR (requiere gphoto2 instalado en el sistema)
app.post('/api/take-dsrl-photo', (req, res) => {
    const filename = `${new Date().toISOString().replace(/:/g, '-')}_dsrl.jpg`;
    const filepath = path.join(FOTOS_VIDEOS_DIR, filename);

    // Comando gphoto2 para capturar y guardar
    // Asegúrate de que gphoto2 esté configurado y la cámara conectada
    const command = `gphoto2 --capture-image-and-download --filename="${filepath}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error al tomar foto con DSLR: ${error.message}`);
            return res.status(500).send(`Error al tomar foto con DSLR: ${stderr}`);
        }
        if (stderr) {
            console.warn(`Advertencia de gphoto2: ${stderr}`);
        }
        console.log(`Foto DSLR tomada: ${filepath}`);
        io.emit('new-media-item', { type: 'photo', url: `/fotos-videos/${filename}`, name: filename });
        res.status(200).send('Foto DSLR tomada exitosamente.');
    });
});


// Función para crear el collage (¡Ahora con Sharp!)
app.post('/api/create-collage', express.json({ limit: '20mb' }), async (req, res) => {
    try {
        const { photoData, templateName } = req.body; // photoData será un array de base64
        if (!photoData || !Array.isArray(photoData) || photoData.length === 0 || !templateName) {
            return res.status(400).send('Datos incompletos para crear el collage.');
        }

        const templatePath = path.join(PLANTILLAS_DIR, templateName);
        if (!fs.existsSync(templatePath)) {
            console.error(`Plantilla no encontrada en la ruta: ${templatePath}`);
            return res.status(404).send('Plantilla no encontrada.');
        }

        const templateBuffer = await fs.promises.readFile(templatePath);
        const inputPhotos = await Promise.all(photoData.map(async (data) => {
            return sharp(Buffer.from(data.replace(/^data:image\/(png|jpeg);base64,/, ""), 'base64'));
        }));

        let compositeOperations = [];
        let metadata = await sharp(templateBuffer).metadata();
        const templateWidth = metadata.width;
        const templateHeight = metadata.height;

        // Las coordenadas y tamaños exactos de los "recuadros negros" en tus plantillas
        // deben ser determinados manualmente o con alguna herramienta de inspección de imagen.
        // Los valores aquí son EJEMPLOS y probablemente necesiten AJUSTE.

        switch (templateName) {
            case 'marco1.png':
                if (inputPhotos[0]) {
                    // Posición y tamaño para una foto
                    const photoWidth = Math.round(templateWidth * 0.8); // Redondeado
                    const photoHeight = Math.round(templateHeight * 0.7); // Redondeado
                    const left = Math.round(templateWidth * 0.1);
                    const top = Math.round(templateHeight * 0.15);

                    compositeOperations.push({
                        input: await inputPhotos[0].resize(photoWidth, photoHeight, { fit: 'cover' }).png().toBuffer(),
                        left: left,
                        top: top,
                    });
                }
                break;
            case 'marco2.png':
                if (inputPhotos[0] && inputPhotos[1]) {
                    // Posición y tamaño para dos fotos (una arriba, otra abajo)
                    const photoWidth = Math.round(templateWidth * 0.8); // Redondeado
                    const photoHeight = Math.round((templateHeight / 2) * 0.7); // Redondeado
                    const left = Math.round(templateWidth * 0.1);

                    compositeOperations.push({
                        input: await inputPhotos[0].resize(photoWidth, photoHeight, { fit: 'cover' }).png().toBuffer(),
                        left: left,
                        top: Math.round(templateHeight * 0.05), // Primera foto
                    });
                    compositeOperations.push({
                        input: await inputPhotos[1].resize(photoWidth, photoHeight, { fit: 'cover' }).png().toBuffer(),
                        left: left,
                        top: Math.round(templateHeight * 0.52), // Segunda foto
                    });
                }
                break;
            case 'marco3.png':
                if (inputPhotos[0] && inputPhotos[1] && inputPhotos[2]) {
                    // Posición y tamaño para tres fotos (una arriba, otra en medio, otra abajo)
                    const photoWidth = Math.round(templateWidth * 0.8); // Redondeado
                    const photoHeight = Math.round((templateHeight / 3) * 0.7); // Redondeado
                    const left = Math.round(templateWidth * 0.1);

                    compositeOperations.push({
                        input: await inputPhotos[0].resize(photoWidth, photoHeight, { fit: 'cover' }).png().toBuffer(),
                        left: left,
                        top: Math.round(templateHeight * 0.03), // Primera foto
                    });
                    compositeOperations.push({
                        input: await inputPhotos[1].resize(photoWidth, photoHeight, { fit: 'cover' }).png().toBuffer(),
                        left: left,
                        top: Math.round(templateHeight * 0.35), // Segunda foto
                    });
                    compositeOperations.push({
                        input: await inputPhotos[2].resize(photoWidth, photoHeight, { fit: 'cover' }).png().toBuffer(),
                        left: left,
                        top: Math.round(templateHeight * 0.67), // Tercera foto
                    });
                }
                break;
            case 'marco4.png':
                if (inputPhotos[0] && inputPhotos[1] && inputPhotos[2] && inputPhotos[3]) {
                    // Posición y tamaño para cuatro fotos (grid 2x2)
                    const photoWidth = Math.round((templateWidth / 2) * 0.8); // Redondeado
                    const photoHeight = Math.round((templateHeight / 2) * 0.8); // Redondeado
                    const xOffset = Math.round(templateWidth * 0.07);
                    const yOffset = Math.round(templateHeight * 0.07);

                    compositeOperations.push({
                        input: await inputPhotos[0].resize(photoWidth, photoHeight, { fit: 'cover' }).png().toBuffer(),
                        left: xOffset,
                        top: yOffset,
                    }); // Top-left
                    compositeOperations.push({
                        input: await inputPhotos[1].resize(photoWidth, photoHeight, { fit: 'cover' }).png().toBuffer(),
                        left: Math.round(templateWidth / 2 + xOffset),
                        top: yOffset,
                    }); // Top-right
                    compositeOperations.push({
                        input: await inputPhotos[2].resize(photoWidth, photoHeight, { fit: 'cover' }).png().toBuffer(),
                        left: xOffset,
                        top: Math.round(templateHeight / 2 + yOffset),
                    }); // Bottom-left
                    compositeOperations.push({
                        input: await inputPhotos[3].resize(photoWidth, photoHeight, { fit: 'cover' }).png().toBuffer(),
                        left: Math.round(templateWidth / 2 + xOffset),
                        top: Math.round(templateHeight / 2 + yOffset),
                    }); // Bottom-right
                }
                break;
            default:
                return res.status(400).send('Plantilla no reconocida o lógica de collage no implementada para esta plantilla.');
        }

        const collageBuffer = await sharp(templateBuffer)
            .composite(compositeOperations)
            .png({ quality: 90 }) // Calidad del PNG, puedes ajustar
            .toBuffer();

        const collageBase64 = `data:image/png;base64,${collageBuffer.toString('base64')}`;

        res.json({ collage: collageBase64 });

    } catch (error) {
        console.error('Error al crear el collage con Sharp:', error);
        res.status(500).send(`Error interno del servidor al crear el collage: ${error.message}`);
    }
});


server.listen(PORT, () => {
    console.log(`Servidor HTTPS ejecutándose en https://localhost:${PORT}`);
});