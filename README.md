# The Bill PWA

Aplicación web progresiva (PWA) para dividir gastos en grupo, con notificaciones push.

## Requisitos previos

- [Node.js y npm](https://nodejs.org/) instalados en tu computadora.

## Cómo iniciar la aplicación localmente

El proyecto está compuesto por dos partes: la interfaz (Frontend) y el servidor de notificaciones push (Backend). Es necesario ejecutar ambas partes de forma simultánea.

### 1. Iniciar el servidor Frontend

El frontend está compuesto por archivos estáticos en la raíz del proyecto. Para levantarlo, abre una terminal en la carpeta principal (`the-bill-pwa`) y ejecuta:

```bash
npx serve
```

*Esto iniciará la interfaz de la aplicación web, típicamente accesible desde `http://localhost:3000`.*

### 2. Iniciar el servidor Backend (Push)

El backend es un servidor Node.js que maneja las suscripciones y el envío de notificaciones. Abre una **nueva** ventana de terminal, ingresa a la carpeta `push-server` e inicia el servidor de desarrollo:

```bash
cd push-server
npm install    # (Necesario solo la primera vez para descargar las dependencias)
npm run dev
```

*Esto iniciará el servidor de notificaciones, típicamente accesible desde `http://localhost:3001`.*

## Probar la app desde un celular

Para ver la aplicación desde tu dispositivo móvil:
1. Asegúrate de que tanto tu computadora como el celular estén conectados a la **misma red Wi-Fi**.
2. Averigua la dirección IP local de tu computadora (usando `ipconfig` en Windows o `ifconfig` / `ip a` en Linux/Mac).
3. Abre el navegador en tu celular e ingresa la dirección IP seguida del puerto del frontend, por ejemplo: `http://192.168.0.X:3000`.
