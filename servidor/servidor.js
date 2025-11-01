
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

// 1. INICIALIZAR APP DE EXPRESS
const app = express();

// 2. MIDDLEWARE DE AUTENTICACIÓN (debe ir antes de las rutas que lo usan)
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

// 3. MIDDLEWARE GENERAL
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieSession({
  name: 'session',
  keys: ['clave-secreta-unica'], // reemplaza por una clave real en producción
  maxAge: 1000 * 60 * 60 // 1 hora
}));

// Servir archivos estáticos (front-end)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Intento de migración ligera al iniciar: eliminar id_talla de detallecompra porque las compras no usan talla
(async function ajustarEsquemaDetalleCompra() {
  try {
    // 1) Intentar eliminar la clave foránea hacia tallas si existe
    try {
      await pool.query("ALTER TABLE detallecompra DROP FOREIGN KEY detallecompra_ibfk_3");
      console.log('Esquema: se eliminó la FK detallecompra_ibfk_3 (si existía).');
    } catch (e) {
      // si la FK no existe con ese nombre, intentamos buscar y eliminar cualquier FK que referencia tallas
      try {
        const [fks] = await pool.query("SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'detallecompra' AND REFERENCED_TABLE_NAME = 'tallas'");
        for (const fk of fks) {
          await pool.query(`ALTER TABLE detallecompra DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
          console.log(`Esquema: se eliminó la FK ${fk.CONSTRAINT_NAME} en detallecompra`);
        }
      } catch (e2) {
        // no crítico
      }
    }

    // 2) Intentar DROP COLUMN id_talla si existe
    try {
      await pool.query('ALTER TABLE detallecompra DROP COLUMN id_talla');
      console.log('Esquema: columna detallecompra.id_talla eliminada (si existía).');
    } catch (e) {
      // Si falla, puede que la columna no exista o no tengamos permisos; registramos y seguimos
      console.warn('Advertencia al intentar eliminar columna detallecompra.id_talla:', e.message || e);
    }
  } catch (e) {
    console.warn('Advertencia en ajuste de esquema detallecompra:', e.message || e);
  }
})();


// ---------------- Rutas compartidas: Logout ----------------
app.post('/api/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

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


// ==================== COMPRAS (ADMIN) ====================
// POST /api/compras: Registrar una compra (talla opcional)
app.post('/api/compras', requiereRol('administrador'), async (req, res) => {
  const { id_proveedor, fecha_compra, estado_pago, total_compra, items } = req.body;
  if (!id_proveedor || !fecha_compra || !estado_pago || !total_compra || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ ok: false, error: 'Datos incompletos para registrar la compra.' });
  }
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1. Insertar compra principal
    const [compraRes] = await conn.query(
      'INSERT INTO compras (id_proveedor, fecha_compra, total_compra, estado_pago) VALUES (?, ?, ?, ?)',
      [id_proveedor, fecha_compra, total_compra, estado_pago]
    );
    const id_compra = compraRes.insertId;

    // 2. Insertar items en detallecompra (talla opcional)
    for (const item of items) {
      const { idProducto, idTalla, cantidad, costo } = item;
      if (!idProducto || !cantidad || !costo) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ ok: false, error: 'Cada item debe tener producto, cantidad y costo.' });
      }

      // Insertar detalle de compra SIN campo id_talla (la tabla detallecompra ya no debe contener id_talla)
      await conn.query(
        'INSERT INTO detallecompra (id_compra, id_producto, cantidad, costo_unitario) VALUES (?, ?, ?, ?)',
        [id_compra, idProducto, cantidad, costo]
      );

      // Actualizar inventario: si el item especifica idTalla actualizamos inventario por talla,
      // si no, actualizamos el inventario total del producto
      if (idTalla) {
        // Si existe registro, sumar; si no, crear
        const [invRows] = await conn.query('SELECT cantidad FROM inventario WHERE id_producto = ? AND id_talla = ? LIMIT 1', [idProducto, idTalla]);
        if (invRows.length > 0) {
          await conn.query('UPDATE inventario SET cantidad = cantidad + ? WHERE id_producto = ? AND id_talla = ?', [cantidad, idProducto, idTalla]);
        } else {
          await conn.query('INSERT INTO inventario (id_producto, id_talla, cantidad) VALUES (?, ?, ?)', [idProducto, idTalla, cantidad]);
        }
        // También ajustar inventario total si existe la columna
        await conn.query('UPDATE productos SET inventario = inventario + ? WHERE id_producto = ?', [cantidad, idProducto]);
      } else {
        // Sumar a inventario total del producto (columna inventario)
        await conn.query('UPDATE productos SET inventario = inventario + ? WHERE id_producto = ?', [cantidad, idProducto]);
      }
    }

    await conn.commit();
    conn.release();
    res.json({ ok: true, id_compra });
  } catch (e) {
    if (conn) { try { await conn.rollback(); conn.release(); } catch (_) {} }
    console.error('Error registrar compra:', e.message || e);
    res.status(500).json({ ok: false, error: 'Error al registrar compra.' });
  }
});

// GET /api/compras: Listar compras
app.get('/api/compras', requiereRol('administrador'), async (req, res) => {
  try {
    const [compras] = await pool.query(
      `SELECT c.id_compra, c.fecha_compra, c.total_compra, c.estado_pago, p.nombre AS nombre_proveedor
       FROM compras c
       LEFT JOIN proveedores p ON c.id_proveedor = p.id_proveedor
       ORDER BY c.fecha_compra DESC, c.id_compra DESC LIMIT 100`
    );
    res.json({ compras });
  } catch (e) {
    console.error('Error listar compras:', e.message || e);
    res.status(500).json({ compras: [] });
  }
});


// Endpoint para indicadores del dashboard (ventas del mes, serie por día, rotación básica)
app.get('/api/dashboard/indicadores', requiereRol('administrador'), async (req, res) => {
  try {
    const now = new Date();
    const year = Number(req.query.year) || now.getFullYear();
    const month = Number(req.query.month) || (now.getMonth() + 1);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2,'0')}-01 00:00:00`;
    const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2,'0')}-01 00:00:00`;

    // Ventas del mes (total en $)
    const [tot] = await pool.query('SELECT IFNULL(SUM(total_venta),0) AS total_mes FROM ventas WHERE fecha_hora >= ? AND fecha_hora < ?', [startStr, endStr]);
    const ventasMes = tot && tot[0] ? Number(tot[0].total_mes) : 0;

    // Serie diaria para gráfico
    const [porDia] = await pool.query(
      `SELECT DATE(fecha_hora) AS dia, IFNULL(SUM(total_venta),0) AS ingreso_total FROM ventas WHERE fecha_hora >= ? AND fecha_hora < ? GROUP BY DATE(fecha_hora) ORDER BY DATE(fecha_hora) ASC`,
      [startStr, endStr]
    );

    // Comparación con mes anterior
    const prevStart = new Date(year, month - 2, 1);
    const prevEnd = new Date(year, month - 1, 1);
    const prevStartStr = `${prevStart.getFullYear()}-${String(prevStart.getMonth() + 1).padStart(2,'0')}-01 00:00:00`;
    const prevEndStr = `${prevEnd.getFullYear()}-${String(prevEnd.getMonth() + 1).padStart(2,'0')}-01 00:00:00`;
    const [prevTot] = await pool.query('SELECT IFNULL(SUM(total_venta),0) AS total_prev FROM ventas WHERE fecha_hora >= ? AND fecha_hora < ?', [prevStartStr, prevEndStr]);
    const totalPrev = prevTot && prevTot[0] ? Number(prevTot[0].total_prev) : 0;
    const ventasCambio = totalPrev > 0 ? ((ventasMes - totalPrev) / totalPrev) * 100 : (ventasMes > 0 ? 100 : 0);

    // Rotación de inventario básica: unidades vendidas / stock total
    const [unidades] = await pool.query(
      `SELECT IFNULL(SUM(d.cantidad),0) AS unidades_vendidas FROM detalleventa d JOIN ventas v ON d.id_venta = v.id_venta WHERE v.fecha_hora >= ? AND v.fecha_hora < ?`,
      [startStr, endStr]
    );
    const unidadesVendidas = unidades && unidades[0] ? Number(unidades[0].unidades_vendidas) : 0;
    const [stock] = await pool.query('SELECT IFNULL(SUM(inventario),0) AS stock_total FROM productos');
    const stockTotal = stock && stock[0] ? Number(stock[0].stock_total) : 0;
    const rotacionInventario = stockTotal > 0 ? unidadesVendidas / stockTotal : 0;

    res.json({ ventasMes, ventasTemporada: porDia, ventasCambio, rotacionInventario, margenGanancia: 0, stockBajo: 0 });
  } catch (e) {
    console.error('Error indicadores dashboard:', e.message || e);
    res.status(500).json({ error: 'Error al calcular indicadores' });
  }
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
  const [result] = await pool.query('UPDATE categorias SET nombre = ? WHERE id_categoria = ?', [nombre.trim(), id]);
    if (result.affectedRows > 0) return res.json({ ok: true, success: true }); // Ajustado para devolver {ok: true, success: true}
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
    if (result.affectedRows > 0) return res.json({ ok: true, success: true }); // Ajustado para devolver {ok: true, success: true}
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
    if (result.affectedRows > 0) return res.json({ ok: true, success: true }); // Ajustado para devolver {ok: true, success: true}
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

// Nuevo endpoint: Registro de productos completo (usado por admin.html)
app.post('/api/productos', requiereRol('administrador'), async (req, res) => {
  const { marca, categoria, proveedor, nombre, precio, inventario, cantidades } = req.body;
  try {
    // Validar que la suma de cantidades por talla no exceda el inventario total
    const totalInventario = Number(inventario) || 0;
    let sumaTallas = 0;
    if (Array.isArray(cantidades)) {
      for (const t of cantidades) {
        sumaTallas += Number(t.cantidad) || 0;
      }
    }
    if (sumaTallas > totalInventario) {
      return res.status(400).json({ ok: false, message: `La suma de las cantidades por talla (${sumaTallas}) excede el inventario total (${totalInventario}). Ajusta los valores.` });
    }

    // 1. Insertar producto principal
    const [prodResult] = await pool.query(
      'INSERT INTO productos (nombre, marca, precio_venta, inventario, id_categoria, id_proveedor) VALUES (?, ?, ?, ?, ?, ?)',
      [nombre, marca, precio, inventario, categoria, proveedor]
    );
    const id_producto = prodResult.insertId;
    // 2. Insertar cantidades por talla en Inventario
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
// Eliminar producto (DELETE) - Ajustado para devolver {ok: true, success: true}
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

    // Preparar posible filtro por cédula de cliente (req.query.cliente)
    const clienteCedula = req.query.cliente ? String(req.query.cliente).trim() : null;

    // 1) Obtener ventas en el rango (con opcional filtro por cédula)
    let baseWhere = 'v.fecha_hora >= ? AND v.fecha_hora < ?';
    const ventasParams = [startStr, endStr];
    if (clienteCedula) {
      baseWhere += ' AND c.cedula = ?';
      ventasParams.push(clienteCedula);
    }

    const [ventasRows] = await pool.query(
      `SELECT v.id_venta, v.fecha_hora, v.total_venta, v.tipo_pago, u.usuario AS usuario, c.nombre AS cliente, c.cedula AS cliente_cedula
       FROM ventas v
       LEFT JOIN usuarios u ON v.id_usuario = u.id_usuario
       LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
       WHERE ${baseWhere}
       ORDER BY v.fecha_hora DESC
      `,
      ventasParams
    );

    // 2) Obtener detalle para cada venta (optimizable, pero suficiente para volúmenes moderados)
    for (const v of ventasRows) {
      // Evitar referenciar columnas que pueden no existir en esquemas distintos.
      const [det] = await pool.query(
        `SELECT d.id_producto, p.marca, p.nombre AS producto, d.id_talla, t.nombre AS talla, d.cantidad, d.precio_unitario
         FROM detalleventa d
         LEFT JOIN productos p ON d.id_producto = p.id_producto
         LEFT JOIN tallas t ON d.id_talla = t.id_talla
         WHERE d.id_venta = ?`,
        [v.id_venta]
      );
      v.detalle = det;
    }

    // 3) Totales del mes
    // 3) Totales del mes (aplicar mismo filtro por cliente si existe)
    let totQuery = 'SELECT IFNULL(SUM(total_venta),0) AS total_mes, COUNT(*) AS ventas_count FROM ventas v';
    let totParams = [startStr, endStr];
    if (clienteCedula) {
      totQuery += ' LEFT JOIN clientes c ON v.id_cliente = c.id_cliente WHERE v.fecha_hora >= ? AND v.fecha_hora < ? AND c.cedula = ?';
      totParams.push(clienteCedula);
    } else {
      totQuery += ' WHERE v.fecha_hora >= ? AND v.fecha_hora < ?';
    }
    const [tot] = await pool.query(totQuery, totParams);
    const total_mes = (Array.isArray(tot) && tot[0]) ? tot[0].total_mes : (tot.total_mes || 0);

    // 4) Totales por día (para gráficas)
    // 4) Totales por día (aplicar filtro por cliente si existe)
    let porDiaQuery = `SELECT DATE(v.fecha_hora) AS dia, SUM(v.total_venta) AS total, COUNT(*) AS ventas
       FROM ventas v`;
    const porDiaParams = [startStr, endStr];
    if (clienteCedula) {
      porDiaQuery += ' LEFT JOIN clientes c ON v.id_cliente = c.id_cliente WHERE v.fecha_hora >= ? AND v.fecha_hora < ? AND c.cedula = ?';
      porDiaParams.push(clienteCedula);
    } else {
      porDiaQuery += ' WHERE v.fecha_hora >= ? AND v.fecha_hora < ?';
    }
    porDiaQuery += ' GROUP BY DATE(v.fecha_hora) ORDER BY DATE(v.fecha_hora) ASC';
    const [porDia] = await pool.query(porDiaQuery, porDiaParams);

    res.json({ ok: true, ventas: ventasRows, totales: { total_mes: Number(total_mes), count: tot[0] ? tot[0].ventas_count : 0 }, por_dia: porDia, year, month });
  } catch (e) {
    console.error('Error listar ventas admin:', e.message || e);
    res.status(500).json({ ok: false, ventas: [], message: 'Error al consultar ventas' });
  }
});

// Endpoint optimizado: listar clientes con resumen de compras (count, total)
app.get('/api/admin/clientes/resumen', requiereRol('administrador'), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const per_page = Math.max(1, Math.min(500, Number(req.query.per_page) || 100));
    const offset = (page - 1) * per_page;

    // Obtener clientes que tengan al menos una venta, con conteo y total gastado
    const [rows] = await pool.query(
      `SELECT c.id_cliente, c.nombre, c.cedula, c.telefono, c.email,
              COUNT(v.id_venta) AS compras_count, IFNULL(SUM(v.total_venta),0) AS total_gastado, MAX(v.fecha_hora) AS ultima_compra
       FROM clientes c
       JOIN ventas v ON v.id_cliente = c.id_cliente
       GROUP BY c.id_cliente
       HAVING compras_count > 0
       ORDER BY total_gastado DESC
       LIMIT ? OFFSET ?`,
      [per_page, offset]
    );

    // Opcional: contar total de clientes con compras (para paginación)
    const [cntRows] = await pool.query(
      `SELECT COUNT(DISTINCT c.id_cliente) AS total_clients_with_purchases FROM clientes c JOIN ventas v ON v.id_cliente = c.id_cliente`
    );
    const total_clients = (Array.isArray(cntRows) && cntRows[0]) ? Number(cntRows[0].total_clients_with_purchases) : 0;

    res.json({ ok: true, clientes: rows, page, per_page, total_clients });
  } catch (e) {
    console.error('Error listar clientes resumen admin:', e.message || e);
    res.status(500).json({ ok: false, clientes: [], page: 1, per_page: 0, total_clients: 0, message: 'Error del servidor' });
  }
});

// Endpoint administrativo: obtener ventas (historial) completas de un cliente por cédula
app.get('/api/admin/clientes/ventas', requiereRol('administrador'), async (req, res) => {
  try {
    const cedula = req.query.cedula ? String(req.query.cedula).trim() : null;
    if (!cedula) return res.json({ ok: false, ventas: [], total: 0, count: 0, message: 'Cédula requerida' });

    const [ventasRows] = await pool.query(
      `SELECT v.id_venta, v.fecha_hora, v.total_venta, v.tipo_pago, u.usuario AS usuario
       FROM ventas v
       LEFT JOIN usuarios u ON v.id_usuario = u.id_usuario
       LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
       WHERE c.cedula = ?
       ORDER BY v.fecha_hora DESC`,
      [cedula]
    );

    // Agregar detalle de cada venta
    for (const v of ventasRows) {
      const [det] = await pool.query(
        `SELECT d.id_producto, p.marca, p.nombre AS producto, d.id_talla, t.nombre AS talla, d.cantidad, d.precio_unitario
         FROM detalleventa d
         LEFT JOIN productos p ON d.id_producto = p.id_producto
         LEFT JOIN tallas t ON d.id_talla = t.id_talla
         WHERE d.id_venta = ?`,
        [v.id_venta]
      );
      v.detalle = det;
    }

    const total = ventasRows.reduce((s, v) => s + (Number(v.total_venta) || 0), 0);
    const count = ventasRows.length;
    return res.json({ ok: true, ventas: ventasRows, total, count });
  } catch (e) {
    console.error('Error historial cliente admin:', e.message || e);
    return res.status(500).json({ ok: false, ventas: [], total: 0, count: 0, message: 'Error del servidor' });
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

// Registro de venta simple (AJUSTADO para coincidir con la llamada simple del front-end)
app.post('/api/caja/venta', requiereRol('caja'), async (req, res) => {
  const { id_cliente, monto } = req.body;
  
  // Datos simplificados para la venta a través del formulario de "Caja"
  const total_venta = monto;
  const tipo_pago = 'Efectivo'; // Valor por defecto
  
  try {
    // 1) Crear venta (en tabla Ventas)
    const [ventaResult] = await pool.query(
      `INSERT INTO ventas (fecha_hora, total_venta, tipo_pago, id_usuario, id_cliente)
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


// ---------------- Ventas: validar stock y actualizar inventario ----------------
// Ajustar para aceptar id_producto e id_talla (requerido) y decrementar inventario
// (Esta ruta reemplaza la primera ruta fallida /api/ventas que estaba mezclada con la lógica antigua)
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
    const disponible = Number(invRows[0].cantidad) || 0;
    if (disponible === 0) {
      return res.status(400).json({ ok: false, message: 'No hay unidades disponibles para la talla seleccionada.' });
    }
    const cantidadNum = Number(cantidad);
    const precioNum = Number(precio_unitario) || 0;

    if (disponible < cantidadNum) {
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
    const total_dolar = precioNum * cantidadNum;
    const [ventaRes] = await pool.query('INSERT INTO ventas (fecha_hora, total_venta, tipo_pago, id_usuario, id_cliente) VALUES (NOW(), ?, ?, ?, ?)', [total_dolar, tipo_pago || 'Efectivo', req.session.user.id, id_cliente]);
    const id_venta = ventaRes.insertId;

    // 4. Registrar detalleventa y actualizar inventario
    await pool.query('INSERT INTO detalleventa (id_venta, id_producto, id_talla, cantidad, precio_unitario) VALUES (?, ?, ?, ?, ?)', [id_venta, id_producto, id_talla, cantidadNum, precioNum]);
    // calcular si la venta agotó la talla
    const agotado = (disponible - cantidadNum) <= 0;
    // actualizar inventario por talla (evitar negativos)
    await pool.query('UPDATE inventario SET cantidad = GREATEST(0, cantidad - ?) WHERE id_producto = ? AND id_talla = ?', [cantidadNum, id_producto, id_talla]);
    // actualizar stock total en productos (si existe columna inventario)
    await pool.query('UPDATE productos SET inventario = GREATEST(0, inventario - ?) WHERE id_producto = ?', [cantidadNum, id_producto]);

    res.json({ ok: true, id_venta, agotado });
  } catch (e) {
    console.error('Error al registrar venta:', e.message);
    res.status(500).json({ ok: false, message: 'Error al registrar venta' });
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


// Inicio del servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});