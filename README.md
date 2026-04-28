# Arya Joyas y Accesorios

Sitio web con catálogo público (`index.html`), panel privado (`admin.html`) para editar textos/productos guardados en MongoDB Atlas y pago de prueba con Webpay Plus.

## Archivos principales

- `public/index.html`: página pública con catálogo y modal de información al hacer clic en una joya.
- `public/pago.html`: página de resultado después de volver desde Webpay.
- `public/css/styles.css`: estilos del sitio, admin, modal y resultado de pago.
- `public/admin.html`: panel privado. No está enlazado desde la web pública y requiere contraseña para editar.
- `public/js/main.js`: carga textos/productos y abre el modal con detalle + botón Webpay test.
- `public/js/pago.js`: muestra el resultado de la transacción.
- `public/js/admin.js`: login, edición, agregado y borrado.
- `server.js`: API Node/Express, MongoDB y Webpay.
- `models/Product.js`: modelo de productos.
- `models/Order.js`: modelo de órdenes/pagos Webpay.
- `models/Settings.js`: textos editables del sitio.
- `seed.js`: carga textos iniciales y 10 productos de ejemplo.

## Qué quedó agregado

- Al hacer clic en una joya se abre una ventana con imagen grande, categoría, material, descripción, precio y cantidad.
- Desde esa ventana se puede consultar por WhatsApp o pagar con Webpay test.
- El backend crea una transacción Webpay, redirige a Transbank y confirma el pago cuando Webpay vuelve al sitio.
- Cada pago queda guardado como una orden en MongoDB con estado `created`, `authorized`, `failed`, `cancelled` o `error`.

## Seguridad importante

No conectes MongoDB directamente desde `index.html` o `admin.html`, porque cualquier persona podría ver la contraseña en el navegador. Por eso este proyecto usa un backend (`server.js`) y variables de entorno.

Como la URI original fue compartida en un chat, lo más seguro es rotar/cambiar la contraseña de ese usuario en MongoDB Atlas antes de publicar el sitio.

`admin.html` no aparece en el menú ni en el sitio público, pero esconder una URL no es seguridad real. Por eso el panel exige `ADMIN_PASSWORD` y las rutas de edición están protegidas por cookie firmada.

## Instalación local

1. Instala Node.js 18 o superior.
2. En la carpeta del proyecto, instala dependencias:

```bash
npm install
```

3. Copia `.env.example` a `.env`:

```bash
cp .env.example .env
```

4. Edita `.env` con tus datos reales:

```env
MONGODB_URI=mongodb+srv://Novaworks:TU_PASSWORD_NUEVA@aryajoyas.q2jbo1s.mongodb.net/arya-joyas?retryWrites=true&w=majority&appName=AryaJoyas
ADMIN_PASSWORD=una-clave-segura
COOKIE_SECRET=una-frase-larga-y-aleatoria
PORT=3000
NODE_ENV=development

# Webpay test/integración
WEBPAY_ENV=integration
WEBPAY_COMMERCE_CODE=
WEBPAY_API_KEY=

# Déjalo vacío en local. En hosting usa tu dominio público, por ejemplo https://aryajoyas.cl
PUBLIC_BASE_URL=
```

En modo `integration`, si `WEBPAY_COMMERCE_CODE` y `WEBPAY_API_KEY` quedan vacíos, el servidor usa las credenciales de integración incluidas por el SDK de Transbank.

5. Carga los textos y 10 productos iniciales:

```bash
npm run seed
```

6. Ejecuta el sitio:

```bash
npm run dev
```

7. Abre:

- Web pública: `http://localhost:3000`
- Admin privado: `http://localhost:3000/admin.html`

## Cómo probar Webpay

1. Entra al catálogo.
2. Haz clic en cualquier joya.
3. En el modal, elige cantidad y presiona `Pagar con Webpay test`.
4. El sitio te enviará al formulario de prueba de Webpay.
5. Al terminar, Webpay vuelve a `/pago.html` con el resultado.

Para pruebas locales normales, `localhost:3000` funciona para iniciar el flujo desde tu navegador. En hosting real, configura `PUBLIC_BASE_URL` con la URL pública para que Webpay pueda volver correctamente.

## Cómo editar productos

En el admin puedes:

- Agregar productos.
- Editar nombre, categoría, material, precio, precio anterior, descripción e imagen.
- Ocultar o mostrar productos con el check `Visible`.
- Marcar productos como `Destacado`.
- Borrar productos.

Las imágenes se editan pegando una URL. Si quieres subir imágenes desde el computador, lo recomendable es agregar un servicio de almacenamiento como Cloudinary, S3 o Firebase Storage.

## Producción

Para usar dinero real no basta con cambiar el botón: necesitas credenciales de producción de Transbank, configurar:

```env
WEBPAY_ENV=production
WEBPAY_COMMERCE_CODE=tu_codigo_comercio_real
WEBPAY_API_KEY=tu_api_key_real
PUBLIC_BASE_URL=https://tu-dominio.cl
NODE_ENV=production
```

Luego sube el proyecto a Render, Railway, Fly.io o un VPS y configura estas variables en el panel del hosting:

- `MONGODB_URI`
- `ADMIN_PASSWORD`
- `COOKIE_SECRET`
- `WEBPAY_ENV`
- `WEBPAY_COMMERCE_CODE`
- `WEBPAY_API_KEY`
- `PUBLIC_BASE_URL`
- `NODE_ENV=production`

Comando de inicio:

```bash
npm start
```
