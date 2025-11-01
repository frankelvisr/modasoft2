# modasoft

Proyecto simple con Express y MySQL (XAMPP compatible).

Pasos para arrancar:

1. Instala dependencias:

   npm install

2. Copia el archivo de ejemplo de entorno y ajusta las variables:

   copy .env.example .env

   (En PowerShell: el comando anterior funciona)

3. Si usas XAMPP/MySQL, asegúrate de que MySQL está corriendo y que existe la base de datos `modasoft_db`.
   Puedes crearla desde phpMyAdmin o usando la consola MySQL:

   # En PowerShell (ajusta usuario/contraseña si es necesario)
   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS modasoft_db;"

   Luego crea la tabla que indiques en `DB_TABLE`.

4. Arranca el servidor:

   npm start

El servidor sirve archivos est1ticos desde la raDz del proyecto (por ejemplo `index.html`) y expone la ruta `/api/datos` que lee de la tabla configurada.

Notas:
- Edita `servidor/db.js` para ajustar las consultas a la estructura real de tu tabla.
