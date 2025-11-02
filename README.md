# modasoft

Sistema ERP completo con Express.js, MySQL y API RESTful para gestión de inventario, ventas, compras y administración.

## 🚀 Inicio Rápido

### Pasos para arrancar:

1. **Instala dependencias:**
   ```bash
   npm install
   ```

2. **Configura el archivo de entorno:**
   ```bash
   copy .env.example .env
   ```
   (En PowerShell: el comando anterior funciona)

3. **Configura la base de datos:**
   - Asegúrate de que MySQL está corriendo (XAMPP compatible)
   - Crea la base de datos `modasoft_db`:
     ```bash
     mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS modasoft_db;"
     ```
   - Importa el esquema desde `db/SQL_PARA_PHPMYADMIN.sql` o `db/modasoft_db.sql`

4. **Arranca el servidor:**
   ```bash
   npm start
   ```
   El servidor estará disponible en `http://localhost:3000`

## 📚 Documentación de API

El sistema incluye **25+ endpoints API RESTful** completamente documentados.

📖 **Ver documentación completa:** [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md)

### Resumen de APIs disponibles:

#### 🔐 Autenticación
- `POST /api/login` - Iniciar sesión
- `POST /api/logout` - Cerrar sesión
- `GET /api/status` - Estado del servidor

#### 👨‍💼 Administrador (17 endpoints)
- **Categorías**: GET, POST, PUT, DELETE
- **Tallas**: GET, POST, PUT, DELETE
- **Proveedores**: GET, POST, PUT, DELETE
- **Productos**: GET (todos/buscar), GET (por ID), POST (simple/completo), PUT, DELETE
- **Validación**: GET validar-eliminación

#### 💰 Caja (5 endpoints)
- **Clientes**: GET buscar por cédula
- **Ventas**: POST venta completa, POST venta simple
- **Tasa BCV**: GET tasa de cambio

## 🎯 Características

- ✅ API RESTful completa con 25+ endpoints
- ✅ Sistema de autenticación con sesiones
- ✅ Roles: Administrador y Caja
- ✅ Gestión completa de inventario con tallas
- ✅ Sistema de ventas integrado
- ✅ Frontend moderno con diseño profesional
- ✅ Módulo de devoluciones
- ✅ Dashboard gerencial

## 📁 Estructura del Proyecto

```
modasoft-main/
├── api/              # Endpoints PHP (legacy)
├── db/               # Scripts SQL de base de datos
├── public/           # Frontend (HTML, CSS, JS)
│   ├── admin.html    # Panel de administración
│   ├── caja.html     # Módulo de caja/ventas
│   └── index.html    # Página de login
├── servidor/         # Backend Node.js/Express
│   ├── servidor.js   # Servidor principal con todas las APIs
│   ├── db.js         # Conexión a base de datos
│   └── auth.js       # Autenticación
└── API_DOCUMENTATION.md  # Documentación completa de APIs
```

## 🔧 Configuración

- Edita `servidor/db.js` para ajustar la conexión a la base de datos
- Las variables de entorno se configuran en `.env`

### Migraciones y soporte de Promociones

Este repositorio incluye mejoras para soportar promociones avanzadas (COMPRA_X_LLEVA_Y) y trazabilidad de promociones en las ventas.

- Archivo SQL con las extensiones: `db/promociones.sql` (contiene sentencias ALTER para añadir `param_x`, `param_y` en `promociones` y `id_promocion_aplicada`, `descuento_unitario`, `descuento_total` en `detalleventa`).
- Recomendación: antes de ejecutar cualquier ALTER, exporta un dump de la base de datos (backup).

Si tu entorno local no tiene MySQL disponible, puedes arrancar rápidamente una instancia de MariaDB con Docker (válido para pruebas locales):

```bash
# Descargar y arrancar MariaDB temporal
docker run -d --name modasoft-mariadb -e MYSQL_ROOT_PASSWORD=rootpass -e MYSQL_DATABASE=modasoft_db -p 3306:3306 mariadb:10.4

# Luego importa el SQL (ajusta la ruta):
docker exec -i modasoft-mariadb sh -c 'exec mysql -uroot -prootpass modasoft_db' < db/promociones.sql
```

Nota: en producción revisa los tiempos de bloqueo de ALTER TABLE y usa herramientas seguras para migraciones en tablas grandes.

### Ejecutar migraciones desde el servidor (opcional)
Si prefieres que el servidor añada las columnas faltantes automáticamente (no destructivo), arranca con la variable de entorno:

```bash
FORCE_SCHEMA_MIGRATE=1 npm start
```

Esto intentará crear las columnas faltantes (`param_x`, `param_y`, `id_promocion_aplicada`, `descuento_unitario`, `descuento_total`) sin eliminar datos existentes.


## 📝 Notas

- El sistema utiliza bcrypt para encriptación de contraseñas
- Las sesiones se manejan mediante cookies
- Compatible con XAMPP y MySQL/MariaDB
