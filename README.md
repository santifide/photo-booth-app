# 📸 Photobooth App

¡Bienvenido a la aplicación Photobooth! Este es un proyecto de cabina de fotos interactiva basada en web, que permite tomar fotos, aplicar plantillas de collage y guardar los resultados. Incluye un protector de pantalla con imágenes personalizables y soporte básico para cámaras DSLR (mediante gphoto2).

## ✨ Características

* **Captura de Fotos:** Toma fotos directamente desde la cámara web del dispositivo.
* **Creación de Collages:** Aplica plantillas predefinidas (marcos) a tus fotos para crear collages personalizados.
* **Guardado de Fotos/Videos:** Guarda las fotos tomadas y los collages generados en el servidor.
* **Galería Local:** Visualiza las fotos y videos guardados en una galería.
* **Protector de Pantalla:** Muestra una secuencia de imágenes personalizables como protector de pantalla.
* **Soporte DSLR (Opcional):** Integración básica con `gphoto2` para captura de imágenes desde cámaras DSLR compatibles.

## 🚀 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado lo siguiente:

* **Node.js:** Versión 14.x o superior. Puedes descargarlo desde [nodejs.org](https://nodejs.org/).
* **npm:** Viene incluido con Node.js.
* **gphoto2 (Opcional, para DSLR):** Si planeas usar una cámara DSLR, necesitarás instalar `gphoto2` en tu sistema operativo. Las instrucciones de instalación varían según tu distribución de Linux (ej. `sudo apt-get install gphoto2` en Debian/Ubuntu).

## 📦 Instalación

Sigue estos pasos para poner en marcha el proyecto:

1.  **Clona este repositorio (o descarga el ZIP):**
    ```bash
    git clone [https://github.com/tu_usuario/nombre_del_repositorio.git](https://github.com/tu_usuario/nombre_del_repositorio.git)
    cd nombre_del_repositorio # (o photobooth-app si lo descargaste)
    ```

2.  **Instala las dependencias de Node.js:**
    ```bash
    npm install
    ```
    Esto instalará todas las librerías necesarias, incluyendo `sharp` para el procesamiento de imágenes.

## ⚙️ Configuración

### Directorios

Asegúrate de que existan las siguientes carpetas en la raíz del proyecto:

* `fondo-de-pantalla/`: Para las imágenes que se usarán en el protector de pantalla.
* `templates/`: Para los archivos `marcoX.png` (tus plantillas de collage).
* `fotos-videos/`: Donde se guardarán las fotos y videos generados.

### Plantillas de Collage (`templates/marcoX.png`)

Las plantillas de collage son imágenes PNG que tienen "huecos" transparentes o de un color específico donde las fotos se superpondrán. La aplicación viene preconfigurada para `marco1.png` (1 foto), `marco2.png` (2 fotos), `marco3.png` (3 fotos) y `marco4.png` (4 fotos).

**Ajuste de Dimensiones y Posiciones:**
Es crucial que, si tus plantillas (`marcoX.png`) tienen diferentes proporciones o los "huecos" para las fotos están en distintas posiciones, edites la sección `app.post('/api/create-collage', ...)` en `server.js`.
Busca el `switch (templateName)` y ajusta los valores de `photoWidth`, `photoHeight`, `left`, `top`, `xOffset`, `yOffset` para que coincidan con las áreas exactas donde quieres que tus fotos aparezcan. Puedes usar un editor de imágenes para obtener las coordenadas y dimensiones en píxeles.

## ▶️ Ejecución de la Aplicación

Para iniciar el servidor Node.js:

```bash
node server.js
