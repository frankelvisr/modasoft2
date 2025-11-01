// servidor/servidor.js
const express = require('express');
const path = require('path');
let bcrypt;
try {
  // prefer native bcrypt if available
  bcrypt = require('bcrypt');
} catch (e) {
  // fallback to bcryptjs (pure JS) which is already installed
  bcrypt = require('bcryptjs');
}
const { pool, verificarConexiónBD, obtenerProductos } = require('./db'); // db.js con MySQL
const { verificarCredenciales } = require('./auth');
const cookieSession = require('cookie-session');
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieSession({
  name: 'session',
  keys: ['clave-secreta-unica'], // reemplaza por una clave real en producción
  maxAge: 1000 * 60 * 60 // 1 hora
}));

// Servir archivos estáticos (front-end)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Ruta: estado del servidor y BD
app.get('/api/status', async (req, res) => {
  const bdOK = await verificarConexiónBD();
  // Incluir info de sesión si existe
  const user = req.session.user || null;
  let rol = 'Invitado';
  if (user) {
    if (user.id_rol == 1) rol = 'Administrador';
    if (user.id_rol == 2) rol = 'Caja';
  }
  res.json({ servidor: true, bd: bdOK, usuario: user ? user.usuario : null, rol: rol });
});

// Ruta de login
app.post('/api/login', async (req, res) => {
  const { usuario, password } = req.body;
  try {
    const user = await verificarCredenciales(usuario, password, { pool });
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
    }
    // Guardar en sesión
    req.session.user = { id: user.id, usuario: user.usuario, id_rol: user.id_rol };
    let rol = user.id_rol == 1 ? 'Administrador' : 'Caja';
    return res.json({ ok: true, usuario: user.usuario, rol });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'Error del servidor' });
  }
});

// Middleware de autenticación
function requiereRol(rol) {
  return (req, res, next) => {
    const u = req.session && req.session.user;
    if (!u) return res.status(401).json({ ok: false, error: 'No autenticado' });
    // Supuestos: id_rol 1 = Administrador, 2 = Caja
    const esAdmin = u.id_rol == 1;
    const esCaja = u.id_rol == 2;

    if (rol === 'administrador' && esAdmin) return next();
    if (rol === 'caja' && esCaja) return next();
    if (rol === 'cualquiera' && (esAdmin || esCaja)) return next(); // Para rutas generales
    
    return res.status(403).json({ ok: false, error: 'Acceso no autorizado' });
  };
}

// ---------------- Rutas compartidas: Logout ----------------
app.post('/api/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

// ---------------- Administrador (rutas protegidas) ----------------
// Categorías
app.delete('/api/categorias/:id', requiereRol('administrador'), async (req, res) => {
  const id = req.params.id;
  try {
    // Verificar uso en Productos
    const [cnt] = await pool.query('SELECT COUNT(*) as total FROM productos WHERE id_categoria = ?', [id]);
    const total = (Array.isArray(cnt) && cnt[0]) ? cnt[0].total : (cnt.total || 0);
    if (total > 0) {
      return res.status(400).json({ ok: false, success: false, message: `No se puede eliminar: ${total} producto(s) usan esta categoría` });
    }
    const [delRes] = await pool.query('DELETE FROM categorias WHERE id_categoria = ?', [id]);
    if (delRes.affectedRows > 0) return res.json({ ok: true, success: true });
    return res.status(404).json({ ok: false, success: false, message: 'Categoría no encontrada' });
  } catch (e) {
    console.error('Error eliminar categoria:', e.message);
    res.status(500).json({ ok: false, success: false, message: 'Error del servidor al eliminar categoría' });
  }
});
app.get('/api/categorias', requiereRol('administrador'), async (req, res) => {
  try {
  const [rows] = await pool.query('SELECT id_categoria, nombre FROM categorias ORDER BY nombre');
    res.json({ categorias: rows });
  } catch (e) {
    res.status(500).json({ categorias: [] });
  }
});
// Editar categoría (PUT)
app.put('/api/categorias/:id', requiereRol('administrador'), async (req, res) => {
  const id = req.params.id;
  const { nombre } = req.body;
  if (!nombre || nombre.trim() === '') return res.status(400).json({ success: false, message: 'Nombre requerido' });
  try {
    const [result] = await pool.query('UPDATE Categorias SET nombre = ? WHERE id_categoria = ?', [nombre.trim(), id]);
    if (result.affectedRows > 0) return res.json({ success: true });
    return res.status(404).json({ success: false, message: 'Categoría no encontrada' });
  } catch (e) {
    console.error('Error editar categoria:', e.message);
    return res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});
app.post('/api/categorias', requiereRol('administrador'), async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.json({ ok: false });
  try {
  await pool.query('INSERT INTO categorias (nombre) VALUES (?)', [nombre]);
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false });
  }
});

// Proveedores
app.delete('/api/proveedores/:id', requiereRol('administrador'), async (req, res) => {
  const id = req.params.id;
  try {
    // Verificar uso en Productos
    const [cnt] = await pool.query('SELECT COUNT(*) as total FROM productos WHERE id_proveedor = ?', [id]);
    const total = (Array.isArray(cnt) && cnt[0]) ? cnt[0].total : (cnt.total || 0);
    if (total > 0) {
      return res.status(400).json({ ok: false, success: false, message: `No se puede eliminar: ${total} producto(s) usan este proveedor` });
    }
    const [delRes] = await pool.query('DELETE FROM proveedores WHERE id_proveedor = ?', [id]);
    if (delRes.affectedRows > 0) return res.json({ ok: true, success: true });
    return res.status(404).json({ ok: false, success: false, message: 'Proveedor no encontrado' });
  } catch (e) {
    console.error('Error eliminar proveedor:', e.message);
    res.status(500).json({ ok: false, success: false, message: 'Error del servidor al eliminar proveedor' });
  }
});
// Tallas
app.get('/api/tallas', requiereRol('administrador'), async (req, res) => {
  try {
  const [rows] = await pool.query('SELECT id_talla, nombre FROM tallas ORDER BY nombre');
    res.json({ tallas: rows });
  } catch (e) {
    res.status(500).json({ tallas: [] });
  }
});
app.post('/api/tallas', requiereRol('administrador'), async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.json({ ok: false });
  try {
  await pool.query('INSERT INTO tallas (nombre) VALUES (?)', [nombre]);
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false });
  }
});
// Editar talla (PUT)
app.put('/api/tallas/:id', requiereRol('administrador'), async (req, res) => {
  const id = req.params.id;
  const { nombre, ajuste, pecho, cintura, cadera, largo } = req.body;
  if (!nombre || !ajuste) return res.status(400).json({ success: false, message: 'Nombre y ajuste requeridos' });
  try {
  const [result] = await pool.query('UPDATE tallas SET nombre = ?, ajuste = ?, pecho = ?, cintura = ?, cadera = ?, largo = ? WHERE id_talla = ?', [nombre, ajuste, pecho || null, cintura || null, cadera || null, largo || null, id]);
    if (result.affectedRows > 0) return res.json({ success: true });
    return res.status(404).json({ success: false, message: 'Talla no encontrada' });
  } catch (e) {
    console.error('Error editar talla:', e.message);
    return res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});
app.delete('/api/tallas/:id', requiereRol('administrador'), async (req, res) => {
  const id = req.params.id;
  try {
    // Verificar uso en inventario
    const [cnt] = await pool.query('SELECT COUNT(*) as total FROM inventario WHERE id_talla = ?', [id]);
    const total = (Array.isArray(cnt) && cnt[0]) ? cnt[0].total : (cnt.total || 0);
    if (total > 0) {
      return res.status(400).json({ ok: false, success: false, message: `No se puede eliminar: ${total} registro(s) en inventario usan esta talla` });
    }
    const [delRes] = await pool.query('DELETE FROM tallas WHERE id_talla = ?', [id]);
    if (delRes.affectedRows > 0) return res.json({ ok: true, success: true });
    return res.status(404).json({ ok: false, success: false, message: 'Talla no encontrada' });
  } catch (e) {
    console.error('Error eliminar talla:', e.message);
    res.status(500).json({ ok: false, success: false, message: 'Error del servidor al eliminar talla' });
  }
});

// Endpoint genérico para validar eliminación (usado por el front-end)
app.get('/api/:tipo/validar-eliminacion/:id', requiereRol('administrador'), async (req, res) => {
  const tipo = req.params.tipo;
  const id = req.params.id;
  try {
    let query;
    switch (tipo) {
      case 'categorias':
        query = 'SELECT COUNT(*) as total FROM productos WHERE id_categoria = ?';
        break;
      case 'tallas':
        query = 'SELECT COUNT(*) as total FROM inventario WHERE id_talla = ?';
        break;
      case 'proveedores':
        query = 'SELECT COUNT(*) as total FROM productos WHERE id_proveedor = ?';
        break;
      default:
        return res.status(400).json({ puedeEliminar: false, message: 'Tipo no válido' });
    }
    const [cnt] = await pool.query(query, [id]);
    const total = (Array.isArray(cnt) && cnt[0]) ? cnt[0].total : (cnt.total || 0);
    if (total > 0) {
      return res.json({ puedeEliminar: false, message: `No se puede eliminar: ${total} producto(s) usan este elemento`, total });
    }
    return res.json({ puedeEliminar: true, message: 'El elemento no está en uso', total: 0 });
  } catch (e) {
    console.error('Error validar-eliminacion:', e.message);
    return res.status(500).json({ puedeEliminar: false, message: 'Error del servidor al validar eliminación' });
  }
});
app.get('/api/proveedores', requiereRol('administrador'), async (req, res) => {
  try {
  const [rows] = await pool.query('SELECT id_proveedor, nombre FROM proveedores ORDER BY nombre');
    res.json({ proveedores: rows });
  } catch (e) {
    res.status(500).json({ proveedores: [] });
  }
});
// Editar proveedor (PUT)
app.put('/api/proveedores/:id', requiereRol('administrador'), async (req, res) => {
  const id = req.params.id;
  const { nombre, contacto, telefono } = req.body;
  if (!nombre || nombre.trim() === '') return res.status(400).json({ success: false, message: 'Nombre requerido' });
  try {
  const [result] = await pool.query('UPDATE proveedores SET nombre = ?, contacto = ?, telefono = ? WHERE id_proveedor = ?', [nombre.trim(), contacto || null, telefono || null, id]);
    if (result.affectedRows > 0) return res.json({ success: true });
    return res.status(404).json({ success: false, message: 'Proveedor no encontrado' });
  } catch (e) {
    console.error('Error editar proveedor:', e.message);
    return res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});
app.post('/api/proveedores', requiereRol('administrador'), async (req, res) => {
  const { nombre, contacto, telefono } = req.body;
  if (!nombre) return res.json({ ok: false });
  try {
  await pool.query('INSERT INTO proveedores (nombre, contacto, telefono) VALUES (?, ?, ?)', [nombre, contacto, telefono]);
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false });
  }
});
// Nuevo endpoint: Registro de productos completo (usado por admin.html)
app.post('/api/productos', requiereRol('administrador'), async (req, res) => {
  const { marca, categoria, proveedor, nombre, precio, inventario, cantidades } = req.body;
  try {
    // 1. Insertar producto principal
    const [prodResult] = await pool.query(
      'INSERT INTO productos (nombre, marca, precio_venta, inventario, id_categoria, id_proveedor) VALUES (?, ?, ?, ?, ?, ?)',
      [nombre, marca, precio, inventario, categoria, proveedor]
    );
    const id_producto = prodResult.insertId;
    // 2. Insertar cantidades por talla en InventarioTallas
    if (Array.isArray(cantidades)) {
      for (const t of cantidades) {
  await pool.query('INSERT INTO inventario (id_producto, id_talla, cantidad) VALUES (?, ?, ?)', [id_producto, t.id_talla, t.cantidad]);
      }
    }
    res.json({ ok: true, id_producto });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al registrar producto' });
  }
});
// Listar productos (GET)
// Obtener producto por ID (GET)
app.get('/api/admin/productos/:id', requiereRol('administrador'), async (req, res) => {
  const id = req.params.id;
  try {
  const [rows] = await pool.query('SELECT id_producto, nombre, marca, inventario, precio_venta, id_categoria, id_proveedor FROM productos WHERE id_producto = ?', [id]);
    if (rows.length > 0) {
      res.json({ producto: rows[0] });
    } else {
      res.json({ producto: null });
    }
  } catch (e) {
    res.json({ producto: null });
  }
});
// Editar producto (PUT)
app.put('/api/admin/productos/:id', requiereRol('administrador'), async (req, res) => {
  const id = req.params.id;
  const { marca, nombre, inventario, precio, id_categoria, id_proveedor } = req.body;
  try {
  await pool.query('UPDATE productos SET marca = ?, nombre = ?, inventario = ?, precio_venta = ?, id_categoria = ?, id_proveedor = ? WHERE id_producto = ?', [marca, nombre, inventario, precio, id_categoria, id_proveedor, id]);
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false });
  }
});
// Eliminar producto (DELETE)
app.delete('/api/admin/productos/:id', requiereRol('administrador'), async (req, res) => {
  const id = req.params.id;
  let conn;
  try {
    // Obtener conexión y comenzar transacción
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1) Verificar si el producto tiene registros en detalleventa -> si tiene ventas, NO eliminar
    const [detCountRows] = await conn.query('SELECT COUNT(*) as total FROM detalleventa WHERE id_producto = ?', [id]);
    const detTotal = (Array.isArray(detCountRows) && detCountRows[0]) ? detCountRows[0].total : (detCountRows.total || 0);
    if (detTotal > 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ ok: false, success: false, message: `No se puede eliminar: el producto tiene ${detTotal} venta(s) registrada(s)` });
    }

    // 2) Eliminar filas relacionadas en inventario (si existen)
    await conn.query('DELETE FROM inventario WHERE id_producto = ?', [id]);

    // 3) Eliminar el producto
    const [delRes] = await conn.query('DELETE FROM productos WHERE id_producto = ?', [id]);
    if (delRes.affectedRows === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ ok: false, success: false, message: 'Producto no encontrado' });
    }

    // Commit y liberar
    await conn.commit();
    conn.release();
    return res.json({ ok: true, success: true });
  } catch (e) {
    if (conn) {
      try { await conn.rollback(); conn.release(); } catch (_) {}
    }
    console.error('Error eliminar producto admin (transaction):', e.message || e);
    return res.status(500).json({ ok: false, success: false, message: 'Error del servidor al eliminar producto' });
  }
});
app.get('/api/admin/productos', requiereRol('administrador'), async (req, res) => {
  const { q } = req.query;
  try {
  let query = 'SELECT id_producto, nombre, marca, inventario, precio_venta FROM productos';
    let params = [];
    if (q) {
      query += ' WHERE nombre LIKE ?';
      params.push(`%${q}%`);
    }
    query += ' LIMIT 100';
    const [rows] = await pool.query(query, params);

    // Obtener cantidades por talla para cada producto
    for (const prod of rows) {
      const [tallas] = await pool.query(
        'SELECT tallas.nombre AS talla, inventario.cantidad FROM inventario JOIN tallas ON inventario.id_talla = tallas.id_talla WHERE inventario.id_producto = ?',
        [prod.id_producto]
      );
      prod.tallas = tallas.map(t => `${t.talla}=${t.cantidad}`).join(' ');
    }
    res.json({ productos: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al consultar productos' });
  }
});

// Crear producto (POST)
app.post('/api/admin/productos', requiereRol('administrador'), async (req, res) => {
  const { nombre, descripcion, precio_venta, id_categoria } = req.body;
  // Usamos id_categoria: 1 como valor por defecto/ejemplo
  const final_id_categoria = id_categoria || 1; 
  try {
    const [result] = await pool.query(
      'INSERT INTO productos (nombre, descripcion, precio_venta, id_categoria) VALUES (?, ?, ?, ?)',
      [nombre, descripcion || '', precio_venta, final_id_categoria]
    );
    res.json({ ok: true, id_producto: result.insertId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

// ---------------- Caja (rutas protegidas) ----------------
// Buscar cliente por cédula
app.get('/api/clientes/buscar', requiereRol('caja'), async (req, res) => {
  const cedula = req.query.cedula;
  if (!cedula) return res.json({ cliente: null });
  try {
  const [rows] = await pool.query('SELECT id_cliente, nombre, cedula, telefono, email FROM clientes WHERE cedula = ? LIMIT 1', [cedula]);
    if (rows.length > 0) {
      res.json({ cliente: rows[0] });
    } else {
      res.json({ cliente: null });
    }
  } catch (e) {
    res.json({ cliente: null });
  }
});
// Nuevo endpoint: Registro de ventas completo (usado por caja.html)
app.post('/api/ventas', requiereRol('caja'), async (req, res) => {
  const { cliente_nombre, cliente_cedula, cliente_telefono, cliente_email, marca, talla, cantidad, precio_unitario, total_dolar, total_bs, tipo_pago } = req.body;

  // Validación de datos requeridos para el cálculo
  const cantidadNum = Number(cantidad);
  const precioNum = Number(precio_unitario);
  let totalVenta = Number(total_dolar);
  if (isNaN(totalVenta) || totalVenta === 0) {
    // Si no viene total_dolar, lo calculamos
    if (!isNaN(precioNum) && !isNaN(cantidadNum)) {
      totalVenta = precioNum * cantidadNum;
    }
  }
  if (!cliente_nombre || !cliente_cedula || isNaN(totalVenta) || totalVenta <= 0) {
    return res.status(400).json({ ok: false, message: 'Datos de venta incompletos o inválidos.' });
  }
  try {
    // 1. Buscar o crear cliente
    let id_cliente = null;
    const [cliRows] = await pool.query('SELECT id_cliente FROM clientes WHERE cedula = ?', [cliente_cedula]);
    if (cliRows.length > 0) {
      id_cliente = cliRows[0].id_cliente;
    } else {
      const [cliRes] = await pool.query('INSERT INTO clientes (nombre, cedula, telefono, email) VALUES (?, ?, ?, ?)', [cliente_nombre, cliente_cedula, cliente_telefono || '', cliente_email || '']);
      id_cliente = cliRes.insertId;
    }
    // 2. Registrar venta principal
    const [ventaRes] = await pool.query(
      'INSERT INTO ventas (fecha_hora, total_venta, tipo_pago, id_usuario, id_cliente) VALUES (NOW(), ?, ?, ?, ?)',
      [totalVenta, tipo_pago || 'Efectivo', req.session.user.id, id_cliente]
    );
    const id_venta = ventaRes.insertId;
    // 3. Registrar detalle de venta
    // Buscar id_producto por marca (simplificado)
    const [prodRows] = await pool.query('SELECT id_producto FROM productos WHERE marca = ? LIMIT 1', [marca]);
    let id_producto = prodRows.length > 0 ? prodRows[0].id_producto : null;
    // Buscar id_talla
    const [tallaRows] = await pool.query('SELECT id_talla FROM tallas WHERE nombre = ?', [talla]);
    let id_talla = tallaRows.length > 0 ? tallaRows[0].id_talla : null;
    if (id_producto && id_talla) {
      await pool.query('INSERT INTO detalleventa (id_venta, id_producto, id_talla, cantidad, precio_unitario) VALUES (?, ?, ?, ?, ?)', [id_venta, id_producto, id_talla, cantidadNum, precioNum]);
    }
    res.json({ ok: true, id_venta });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al registrar venta' });
  }
});
// Endpoint para tasa BCV (simulado)
app.get('/api/tasa-bcv', async (req, res) => {
  // Aquí deberías consultar una API real, pero devolvemos un valor fijo de ejemplo
  res.json({ tasa: 36 });
});
// Registro de venta simple (AJUSTADO para coincidir con la llamada simple del front-end)
app.post('/api/caja/venta', requiereRol('caja'), async (req, res) => {
  const { id_cliente, monto } = req.body;
  
  // Datos simplificados para la venta a través del formulario de "Caja"
  const total_venta = monto;
  const tipo_pago = 'Efectivo'; // Valor por defecto
  
  try {
    // 1) Crear venta (en tabla Ventas)
    const [ventaResult] = await pool.query(
      `INSERT INTO Ventas (fecha_hora, total_venta, tipo_pago, id_usuario, id_cliente)
       VALUES (NOW(), ?, ?, ?, ?)`,
      [total_venta, tipo_pago, req.session.user.id, id_cliente || null]
    );
    const id_venta = ventaResult.insertId;

    // Aquí no se inserta DetalleVenta ni se actualiza Inventario
    // porque el formulario del front-end es muy simple,
    // pero la ruta es funcional y registra la venta principal.
    
    res.json({ ok: true, id_venta });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al registrar venta' });
  }
});

// Ejemplo de función para generar hash (solo para la primera vez)
app.get('/api/generar-hash/:password', async (req, res) => {
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(req.params.password, salt);
    res.send({ password: req.params.password, hash: hash, nota: 'Usar este hash en phpMyAdmin para crear el usuario' });
  } catch (e) {
    res.status(500).json({ error: 'Error al generar hash' });
  }
});

// ---------------- Rutas públicas para Productos (CAJA y front) ----------------
// Listado de productos (para Caja) -> incluye tallas y cantidades
app.get('/api/productos', requiereRol('cualquiera'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id_producto, nombre, marca, inventario, precio_venta FROM productos LIMIT 500');
    // Obtener tallas por producto
    for (const prod of rows) {
      const [tallas] = await pool.query(
        'SELECT inventario.id_talla, tallas.nombre, inventario.cantidad FROM inventario JOIN tallas ON inventario.id_talla = tallas.id_talla WHERE inventario.id_producto = ?',
        [prod.id_producto]
      );
      prod.tallas = tallas.map(t => ({ id_talla: t.id_talla, nombre: t.nombre, cantidad: t.cantidad }));
    }
    res.json({ productos: rows });
  } catch (e) {
    console.error('Error listar productos publico:', e.message);
    res.status(500).json({ productos: [] });
  }
});

// Obtener producto por id (para Caja)
app.get('/api/productos/:id', requiereRol('cualquiera'), async (req, res) => {
  const id = req.params.id;
  try {
    const [rows] = await pool.query('SELECT id_producto, nombre, marca, inventario, precio_venta FROM productos WHERE id_producto = ? LIMIT 1', [id]);
    if (rows.length === 0) return res.json({ producto: null });
    const prod = rows[0];
    const [tallas] = await pool.query(
      'SELECT inventario.id_talla, tallas.nombre, inventario.cantidad FROM inventario JOIN tallas ON inventario.id_talla = tallas.id_talla WHERE inventario.id_producto = ?',
      [prod.id_producto]
    );
    prod.tallas = tallas.map(t => ({ id_talla: t.id_talla, nombre: t.nombre, cantidad: t.cantidad }));
    res.json({ producto: prod });
  } catch (e) {
    console.error('Error obtener producto publico:', e.message);
    res.status(500).json({ producto: null });
  }
});

// ---------------- Endpoint para tasa BCV con cache y fallback ----------------
let _cachedTasa = null;
let _cachedTasaTs = 0;
const TASA_CACHE_MS = 1000 * 60 * 5; // 5 minutos
const fetch = require('node-fetch');

app.get('/api/tasa-bcv', async (req, res) => {
  const now = Date.now();
  if (_cachedTasa && (now - _cachedTasaTs) < TASA_CACHE_MS) {
    return res.json({ tasa: _cachedTasa, source: 'cache' });
  }
  try {
    // Intentar obtener desde URL configurada (ej: BCV real si la proporcionas)
    if (process.env.BCV_API_URL) {
      const resp = await fetch(process.env.BCV_API_URL, { timeout: 5000 });
      const json = await resp.json();
      // Se asume que la respuesta tiene un campo 'tasa' o 'valor' según la API real.
      const tasaFromApi = json.tasa || json.valor || json.USD || (json.data && json.data.USD);
      const tasa = parseFloat(tasaFromApi);
      if (!isNaN(tasa) && tasa > 0) {
        _cachedTasa = tasa;
        _cachedTasaTs = Date.now();
        return res.json({ tasa: _cachedTasa, source: 'BCV_API_URL' });
      }
    }
    // Fallback: intentar fuente pública (ej. DolarToday JSON como fallback)
    try {
      const resp2 = await fetch('https://s3.amazonaws.com/dolartoday/data.json', { timeout: 5000 });
      const json2 = await resp2.json();
      const tasaDt = json2 && json2.USD && (json2.USD.transferencia || json2.USD.promedio) || json2.USD && json2.USD.sicad2;
      const tasa = parseFloat(tasaDt);
      if (!isNaN(tasa) && tasa > 0) {
        _cachedTasa = tasa;
        _cachedTasaTs = Date.now();
        return res.json({ tasa: _cachedTasa, source: 'dtd-fallback' });
      }
    } catch (e) {
      // no hay fallback exitoso
    }
    // Último recurso: valor fijo (fallback)
    _cachedTasa = 36;
    _cachedTasaTs = Date.now();
    return res.json({ tasa: _cachedTasa, source: 'fallback' });
  } catch (e) {
    console.error('Error obtener tasa BCV:', e.message);
    _cachedTasa = 36;
    _cachedTasaTs = Date.now();
    res.json({ tasa: _cachedTasa, source: 'error-fallback' });
  }
});

// ---------------- Ventas: validar stock y actualizar inventario ----------------
// Ajustar para aceptar id_producto e id_talla (requerido) y decrementar inventario
app.post('/api/ventas', requiereRol('caja'), async (req, res) => {
  const {
    cliente_nombre, cliente_cedula, cliente_telefono, cliente_email,
    id_producto, id_talla, cantidad, precio_unitario, tipo_pago
  } = req.body;

  if (!id_producto || !id_talla || !cantidad || cantidad <= 0) {
    return res.status(400).json({ ok: false, message: 'Faltan id_producto, id_talla o cantidad válida.' });
  }

  try {
    // 1. Verificar stock en inventario
    const [invRows] = await pool.query('SELECT cantidad FROM inventario WHERE id_producto = ? AND id_talla = ? LIMIT 1', [id_producto, id_talla]);
    if (invRows.length === 0) {
      return res.status(400).json({ ok: false, message: 'No hay inventario para ese producto/talla.' });
    }
    const disponible = invRows[0].cantidad || 0;
    if (disponible < cantidad) {
      return res.status(400).json({ ok: false, message: `Stock insuficiente. Disponible: ${disponible}` });
    }

    // 2. Buscar o crear cliente
    let id_cliente = null;
    const [cliRows] = await pool.query('SELECT id_cliente FROM clientes WHERE cedula = ? LIMIT 1', [cliente_cedula]);
    if (cliRows.length > 0) {
      id_cliente = cliRows[0].id_cliente;
    } else {
      const [cliRes] = await pool.query('INSERT INTO clientes (nombre, cedula, telefono, email) VALUES (?, ?, ?, ?)', [cliente_nombre, cliente_cedula, cliente_telefono || '', cliente_email || '']);
      id_cliente = cliRes.insertId;
    }

    // 3. Registrar venta principal
    const total_dolar = (precio_unitario || 0) * cantidad;
    const [ventaRes] = await pool.query('INSERT INTO ventas (fecha_hora, total_venta, tipo_pago, id_usuario, id_cliente) VALUES (NOW(), ?, ?, ?, ?)', [total_dolar, tipo_pago || 'Efectivo', req.session.user.id, id_cliente]);
    const id_venta = ventaRes.insertId;

    // 4. Registrar detalleventa y actualizar inventario
    await pool.query('INSERT INTO detalleventa (id_venta, id_producto, id_talla, cantidad, precio_unitario) VALUES (?, ?, ?, ?, ?)', [id_venta, id_producto, id_talla, cantidad, precio_unitario || 0]);
    // actualizar inventario por talla
    await pool.query('UPDATE inventario SET cantidad = cantidad - ? WHERE id_producto = ? AND id_talla = ?', [cantidad, id_producto, id_talla]);
    // actualizar stock total en productos (si existe columna inventario)
    await pool.query('UPDATE productos SET inventario = GREATEST(0, inventario - ?) WHERE id_producto = ?', [cantidad, id_producto]);

    res.json({ ok: true, id_venta });
  } catch (e) {
    console.error('Error al registrar venta:', e.message);
    res.status(500).json({ ok: false, message: 'Error al registrar venta' });
  }
});

// Endpoint administrativo: listar ventas por mes (con detalle y totales diarios)
app.get('/api/admin/ventas', requiereRol('administrador'), async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const month = Number(req.query.month) || (new Date().getMonth() + 1); // 1-12

    // Rango inicio/fin para el mes
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1); // inicio del siguiente mes

    const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01 00:00:00`;
    const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-01 00:00:00`;

    // 1) Obtener ventas en el rango
    const [ventasRows] = await pool.query(
      `SELECT v.id_venta, v.fecha_hora, v.total_venta, v.tipo_pago, u.usuario AS usuario, c.nombre AS cliente
       FROM ventas v
       LEFT JOIN usuarios u ON v.id_usuario = u.id_usuario
       LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
       WHERE v.fecha_hora >= ? AND v.fecha_hora < ?
       ORDER BY v.fecha_hora DESC
      `,
      [startStr, endStr]
    );

    // 2) Obtener detalle para cada venta (optimizable, pero suficiente para volúmenes moderados)
    for (const v of ventasRows) {
      const [det] = await pool.query(
        `SELECT d.id_detalleventa, d.id_producto, p.marca, p.nombre AS producto, d.id_talla, t.nombre AS talla, d.cantidad, d.precio_unitario
         FROM detalleventa d
         LEFT JOIN productos p ON d.id_producto = p.id_producto
         LEFT JOIN tallas t ON d.id_talla = t.id_talla
         WHERE d.id_venta = ?`,
        [v.id_venta]
      );
      v.detalle = det;
    }

    // 3) Totales del mes
    const [tot] = await pool.query(
      `SELECT IFNULL(SUM(total_venta),0) AS total_mes, COUNT(*) AS ventas_count FROM ventas WHERE fecha_hora >= ? AND fecha_hora < ?`,
      [startStr, endStr]
    );
    const total_mes = (Array.isArray(tot) && tot[0]) ? tot[0].total_mes : (tot.total_mes || 0);

    // 4) Totales por día (para gráficas)
    const [porDia] = await pool.query(
      `SELECT DATE(fecha_hora) AS dia, SUM(total_venta) AS total, COUNT(*) AS ventas
       FROM ventas
       WHERE fecha_hora >= ? AND fecha_hora < ?
       GROUP BY DATE(fecha_hora)
       ORDER BY DATE(fecha_hora) ASC`,
      [startStr, endStr]
    );

    res.json({ ok: true, ventas: ventasRows, totales: { total_mes: Number(total_mes), count: tot[0] ? tot[0].ventas_count : 0 }, por_dia: porDia, year, month });
  } catch (e) {
    console.error('Error listar ventas admin:', e.message || e);
    res.status(500).json({ ok: false, ventas: [], message: 'Error al consultar ventas' });
  }
});

// ---------------- Ajuste de respuestas en eliminaciones (estandarizar ok / success) ----------------
// Reescribir / ajustar los deletes existentes para devolver { ok: true, success: true } en caso de éxito
// ...existing delete routes...
// (Modifica las rutas existentes ya definidas más arriba: categorías, proveedores, tallas, productos admin)
// Asegurarse de responder con ok y success para compatibilidad con admin.html
// Ejemplo: reemplazar 'return res.json({ success: true });' con 'return res.json({ ok: true, success: true });'
// ...existing code...
// Para mantener el patch compacto no repetimos todo el código: sustituir las respuestas en cada delete (categorias, proveedores, tallas, productos) como se indicó arriba.
// ...existing code...
app.delete('/api/admin/productos/:id', requiereRol('administrador'), async (req, res) => {
  const id = req.params.id;
  let conn;
  try {
    // Obtener conexión y comenzar transacción
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1) Verificar si el producto tiene registros en detalleventa -> si tiene ventas, NO eliminar
    const [detCountRows] = await conn.query('SELECT COUNT(*) as total FROM detalleventa WHERE id_producto = ?', [id]);
    const detTotal = (Array.isArray(detCountRows) && detCountRows[0]) ? detCountRows[0].total : (detCountRows.total || 0);
    if (detTotal > 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ ok: false, success: false, message: `No se puede eliminar: el producto tiene ${detTotal} venta(s) registrada(s)` });
    }

    // 2) Eliminar filas relacionadas en inventario (si existen)
    await conn.query('DELETE FROM inventario WHERE id_producto = ?', [id]);

    // 3) Eliminar el producto
    const [delRes] = await conn.query('DELETE FROM productos WHERE id_producto = ?', [id]);
    if (delRes.affectedRows === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ ok: false, success: false, message: 'Producto no encontrado' });
    }

    // Commit y liberar
    await conn.commit();
    conn.release();
    return res.json({ ok: true, success: true });
  } catch (e) {
    if (conn) {
      try { await conn.rollback(); conn.release(); } catch (_) {}
    }
    console.error('Error eliminar producto admin (transaction):', e.message || e);
    return res.status(500).json({ ok: false, success: false, message: 'Error del servidor al eliminar producto' });
  }
});

// Inicio del servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});