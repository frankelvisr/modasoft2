/*
  admin-funcionalidades.js
  Funcionalidades completas para el panel de administración
  Sistema ERP Modasoft
*/

// ==================== DASHBOARD ====================
// Las funciones del dashboard ya están en admin.html

// ==================== COMPRAS ====================
let itemsCompra = [];

document.addEventListener('DOMContentLoaded', function() {
        // Cargar ventas del mes en el panel de Ventas (administrador)
        if (document.getElementById('listaVentasAdmin')) {
            cargarVentasAdmin();
            const inputBuscarVentas = document.getElementById('buscarVentaAdmin');
            if (inputBuscarVentas) {
                let t;
                inputBuscarVentas.addEventListener('input', function(e) {
                    clearTimeout(t);
                    t = setTimeout(() => {
                        cargarVentasAdmin(e.target.value.trim());
                    }, 350);
                });
            }
        }
    // Cargar productos y proveedores para compras
    if (document.getElementById('compraProveedor')) {
        cargarProveedoresCompra();
        cargarProductosCompra();
        
        document.getElementById('btnAgregarItemCompra')?.addEventListener('click', agregarItemCompra);
        document.getElementById('form-compra')?.addEventListener('submit', registrarCompra);
    }

    // Gestión de clientes
    if (document.getElementById('form-cliente')) {
        document.getElementById('form-cliente').addEventListener('submit', registrarCliente);
        cargarClientes();
    }

    // Gestión de promociones
    if (document.getElementById('form-promocion')) {
        document.getElementById('form-promocion').addEventListener('submit', crearPromocion);
        cargarPromociones();
    }

    // Mostrar parametros X/Y cuando se selecciona COMPRA_X_LLEVA_Y
    const promoTipoEl = document.getElementById('promoTipo');
    const promoParamsEl = document.getElementById('promoParams');
    if (promoTipoEl && promoParamsEl) {
        promoTipoEl.addEventListener('change', function() {
            if (promoTipoEl.value === 'COMPRA_X_LLEVA_Y') promoParamsEl.style.display = 'block';
            else promoParamsEl.style.display = 'none';
        });
    }

    // Contabilidad
    if (document.getElementById('selectPeriodoIngresos')) {
        document.getElementById('selectPeriodoIngresos').addEventListener('change', cargarIngresos);
        cargarIngresos();
    }

    // Cuentas por pagar
    cargarCuentasPagar();

    // Control de caja
    cargarMovimientosCaja();

    // Conciliación bancaria
    if (document.getElementById('form-conciliacion')) {
        document.getElementById('form-conciliacion').addEventListener('submit', registrarConciliacion);
        cargarConciliaciones();
    }

    // Reportes
    cargarReporteUtilidad();

    // Selector de temporada para análisis de ventas (si existe en la página)
    const selTemp = document.getElementById('selectTemporada');
    if (selTemp) {
        selTemp.addEventListener('change', function() {
            fetchVentasTemporada(selTemp.value);
        });
        // Cargar inicialmente según la opción seleccionada
        fetchVentasTemporada(selTemp.value || 'actual');
    }
});

// ==================== FUNCIONES DE COMPRAS ====================
async function cargarProveedoresCompra() {
    try {
        const res = await fetch('/api/proveedores');
        const data = await res.json();
        const select = document.getElementById('compraProveedor');
        if (select && data.proveedores) {
            select.innerHTML = '<option value="">Selecciona Proveedor</option>';
            data.proveedores.forEach(prov => {
                const opt = document.createElement('option');
                opt.value = prov.id_proveedor;
                opt.textContent = prov.nombre;
                select.appendChild(opt);
            });
        }
    } catch (error) {
        console.error('Error cargando proveedores:', error);
    }
}

async function cargarProductosCompra() {
    try {
        const res = await fetch('/api/admin/productos');
        const data = await res.json();
        const select = document.getElementById('compraProducto');
        if (select && data.productos) {
            select.innerHTML = '<option value="">Selecciona Producto</option>';
            data.productos.forEach(prod => {
                const opt = document.createElement('option');
                opt.value = prod.id_producto;
                opt.textContent = `${prod.marca} - ${prod.nombre}`;
                select.appendChild(opt);
            });
        }
    } catch (error) {
        console.error('Error cargando productos:', error);
    }
}

function agregarItemCompra() {
    const idProducto = document.getElementById('compraProducto').value;
    const idTalla = document.getElementById('compraTalla') ? document.getElementById('compraTalla').value : '';
    const cantidad = parseInt(document.getElementById('compraCantidad').value);
    const costo = parseFloat(document.getElementById('compraCosto').value);

    // Solo validar producto, cantidad y costo (talla es opcional)
    if (!idProducto || !cantidad || !costo) {
        alert('Completa todos los campos obligatorios (producto, cantidad y costo)');
        return;
    }

    itemsCompra.push({ idProducto, idTalla: idTalla || null, cantidad, costo });
    renderItemsCompra();
    calcularTotalCompra();
    // Limpiar campos
    document.getElementById('compraCantidad').value = '';
    document.getElementById('compraCosto').value = '';
}

function renderItemsCompra() {
    const contenedor = document.getElementById('compraItems');
    if (!contenedor) return;
    if (itemsCompra.length === 0) {
        contenedor.innerHTML = '<div class="item">Agrega productos a la compra</div>';
        return;
    }
    contenedor.innerHTML = itemsCompra.map((item, idx) => {
        const tallaTxt = item.idTalla && item.idTalla !== 'null' && item.idTalla !== '' ? `- Talla ${item.idTalla}` : '';
        return `
        <div class="item">
            <span>Producto ${item.idProducto} ${tallaTxt} - ${item.cantidad} unidades - $${item.costo.toFixed(2)} c/u</span>
            <button class="btn btn-small secondary" onclick="eliminarItemCompra(${idx})">Eliminar</button>
        </div>
        `;
    }).join('');
}

window.eliminarItemCompra = function(index) {
    itemsCompra.splice(index, 1);
    renderItemsCompra();
    calcularTotalCompra();
};

function calcularTotalCompra() {
    const total = itemsCompra.reduce((sum, item) => sum + (item.cantidad * item.costo), 0);
    document.getElementById('compraTotal').textContent = total.toFixed(2);
}

async function registrarCompra(e) {
    e.preventDefault();
    if (itemsCompra.length === 0) {
        alert('Agrega al menos un producto a la compra');
        return;
    }

    try {
        const proveedor = document.getElementById('compraProveedor').value;
        const fecha = document.getElementById('compraFecha').value;
        const estadoPago = document.getElementById('compraEstadoPago').value;
        const total = parseFloat(document.getElementById('compraTotal').textContent);

        const res = await fetch('/api/compras', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_proveedor: proveedor,
                fecha_compra: fecha,
                estado_pago: estadoPago,
                total_compra: total,
                items: itemsCompra
            })
        });

        const data = await res.json();
        if (data.ok) {
            alert('Compra registrada correctamente');
            itemsCompra = [];
            renderItemsCompra();
            calcularTotalCompra();
            e.target.reset();
            cargarCompras();
        } else {
            alert('Error al registrar compra: ' + (data.error || ''));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error de conexión');
    }
}

async function cargarCompras() {
    try {
        const res = await fetch('/api/compras');
        const data = await res.json();
        const lista = document.getElementById('listaCompras');
        if (lista && data.compras) {
            lista.innerHTML = data.compras.map(compra => `
                <div class="item">
                    <div>
                        <strong>Compra #${compra.id_compra}</strong><br>
                        Proveedor: ${compra.nombre_proveedor || 'N/A'}<br>
                        Fecha: ${compra.fecha_compra} | Total: $${compra.total_compra} | Estado: ${compra.estado_pago}
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error cargando compras:', error);
    }
}

// ==================== FUNCIONES DE CLIENTES ====================
async function registrarCliente(e) {
    e.preventDefault();
    try {
        const res = await fetch('/api/clientes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre: document.getElementById('clienteNombre').value,
                cedula: document.getElementById('clienteCedula').value,
                telefono: document.getElementById('clienteTelefono').value,
                email: document.getElementById('clienteEmail').value
            })
        });

        const data = await res.json();
        if (data.ok) {
            alert('Cliente registrado correctamente');
            e.target.reset();
            cargarClientes();
        } else {
            alert('Error: ' + (data.error || ''));
        }
    } catch (error) {
        alert('Error de conexión');
    }
}

async function cargarClientes() {
    try {
        // Usar endpoint optimizado que devuelve clientes con resumen (evita N requests por cliente)
        const page = 1;
        const per_page = 200;
        const res = await fetch(`/api/admin/clientes/resumen?page=${page}&per_page=${per_page}`, { credentials: 'include' });
        const data = await res.json();
        const lista = document.getElementById('listaClientesAdmin');
        if (!lista) return;

        if (!data || !data.clientes || data.clientes.length === 0) {
            lista.innerHTML = '<div class="item">No se encontraron clientes con compras registradas.</div>';
            return;
        }

        // Umbral para considerar "frecuente" (ajustable)
        const UMBRAL_FRECUENTE = 3;

        lista.innerHTML = data.clientes.map(cli => {
            const frecuente = (Number(cli.compras_count) >= UMBRAL_FRECUENTE) ? ' (Frecuente)' : '';
            return `
                <div class="item">
                    <div>
                        <strong>${cli.nombre || 'Sin nombre'}${frecuente}</strong><br>
                        Cédula: ${cli.cedula || 'N/A'} | Tel: ${cli.telefono || 'N/A'} | Email: ${cli.email || 'N/A'}<br>
                        <small>Compras: ${cli.compras_count} | Total: $${Number(cli.total_gastado||0).toFixed(2)}</small>
                    </div>
                    <div class="actions">
                        <button class="btn btn-small" onclick="editarCliente(${cli.id_cliente})">Editar</button>
                        <button class="btn btn-small secondary" onclick="verHistorialCliente(${cli.id_cliente}, '${(cli.nombre||'').replace(/'/g, "\\'")}', '${cli.cedula || ''}')">Ver historial</button>
                    </div>
                </div>
            `;
        }).join('');

        // Modal simple para historial de compras de cliente (si no existe, crearlo)
        if (!document.getElementById('modalHistorialCliente')) {
            const modal = document.createElement('div');
            modal.id = 'modalHistorialCliente';
            modal.style = 'display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.4);z-index:9999;align-items:center;justify-content:center;';
            modal.innerHTML = `<div style="background:#fff;padding:24px;max-width:500px;width:90vw;border-radius:8px;box-shadow:0 2px 16px #0002;position:relative;">
                <button id="cerrarModalHistorialCliente" style="position:absolute;top:8px;right:8px;font-size:1.2em;">&times;</button>
                <div id="contenidoHistorialCliente">Cargando...</div>
            </div>`;
            document.body.appendChild(modal);
            document.getElementById('cerrarModalHistorialCliente').onclick = () => { modal.style.display = 'none'; };
        }

    } catch (error) {
        console.error('Error cargando clientes:', error);
    }
}

// Función para abrir modal y mostrar historial (usa endpoint existente)
window.verHistorialCliente = async function(id_cliente, nombre, cedula) {
    const modal = document.getElementById('modalHistorialCliente');
    const contenido = document.getElementById('contenidoHistorialCliente');
    if (!modal || !contenido) return;
    modal.style.display = 'flex';
    contenido.innerHTML = `<b>${nombre}</b><br>Cédula: ${cedula}<br><br>Cargando historial...`;
    try {
        const res = await fetch(`/api/admin/clientes/ventas?cedula=${encodeURIComponent(cedula)}`, { credentials: 'include' });
        const data = await res.json();
        if (!data.ok || !data.ventas || data.ventas.length === 0) {
            contenido.innerHTML = `<b>${nombre}</b><br>Cédula: ${cedula}<br><br>No hay compras registradas para este cliente.`;
            return;
        }
        const total = data.total || data.ventas.reduce((sum, v) => sum + (parseFloat(v.total_venta)||0), 0);
        const frecuencia = data.count || data.ventas.length;
        const detalle = data.ventas.map(v => `<li>Venta #${v.id_venta} - ${v.fecha_hora} - $${parseFloat(v.total_venta||0).toFixed(2)}</li>`).join('');
        contenido.innerHTML = `<b>${nombre}</b><br>Cédula: ${cedula}<br><br>
            <b>Compras registradas:</b> ${frecuencia}<br>
            <b>Monto total:</b> $${Number(total).toFixed(2)}<br><br>
            <b>Historial:</b><ul style='margin:8px 0 0 16px;padding:0;'>${detalle}</ul>`;
    } catch (e) {
        console.error('Error al cargar historial cliente:', e);
        contenido.innerHTML = `<b>${nombre}</b><br>Cédula: ${cedula}<br><br>Error al cargar historial.`;
    }
};

// ==================== FUNCIONES DE PROMOCIONES ====================
async function crearPromocion(e) {
    e.preventDefault();
    try {
        const res = await fetch('/api/promociones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre: document.getElementById('promoNombre').value,
                tipo_promocion: document.getElementById('promoTipo').value,
                valor: parseFloat(document.getElementById('promoValor').value),
                fecha_inicio: document.getElementById('promoFechaInicio').value,
                fecha_fin: document.getElementById('promoFechaFin').value,
                id_categoria: document.getElementById('promoAplicarA').value || null,
                minimo_compra: parseFloat(document.getElementById('promoMinimoCompra').value),
                param_x: document.getElementById('promoParamX') ? parseInt(document.getElementById('promoParamX').value) || null : null,
                param_y: document.getElementById('promoParamY') ? parseInt(document.getElementById('promoParamY').value) || null : null,
                descripcion: document.getElementById('promoDescripcion') ? document.getElementById('promoDescripcion').value : null
            })
        });

        const data = await res.json();
        if (data.ok) {
            alert('Promoción creada correctamente');
            e.target.reset();
            cargarPromociones();
        } else {
            alert('Error: ' + (data.error || ''));
        }
    } catch (error) {
        alert('Error de conexión');
    }
}

async function cargarPromociones() {
    try {
        const res = await fetch('/api/promociones');
        const data = await res.json();
        const lista = document.getElementById('listaPromociones');
        if (lista && data.promociones) {
            lista.innerHTML = data.promociones.map(promo => `
                <div class="item">
                    <div>
                        <strong>${promo.nombre}</strong><br>
                        Tipo: ${promo.tipo_promocion} | Valor: ${promo.valor} | 
                        ${promo.fecha_inicio} - ${promo.fecha_fin} | 
                        ${promo.activa ? 'Activa' : 'Inactiva'}
                    </div>
                    <div class="actions">
                        <button class="btn btn-small" onclick="editarPromocion(${promo.id_promocion})">Editar</button>
                        <button class="btn btn-small secondary" onclick="desactivarPromocion(${promo.id_promocion})">Desactivar</button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error cargando promociones:', error);
    }
}

// ==================== FUNCIONES DE CONTABILIDAD ====================
async function cargarIngresos() {
    const periodo = document.getElementById('selectPeriodoIngresos')?.value || 'mes';
    try {
        const res = await fetch(`/api/contabilidad/ingresos?periodo=${periodo}`);
        const data = await res.json();
        const tbody = document.getElementById('tbodyIngresos');
        if (tbody && data.ingresos) {
            tbody.innerHTML = data.ingresos.map(ing => `
                <tr>
                    <td style="padding:var(--spacing-md);">${ing.fecha_hora}</td>
                    <td style="padding:var(--spacing-md);text-align:right;">$${parseFloat(ing.total_venta).toFixed(2)}</td>
                    <td style="padding:var(--spacing-md);">${ing.tipo_pago}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error cargando ingresos:', error);
    }
}

// ==================== FUNCIONES DE VENTAS (ADMIN) ====================
async function cargarVentasAdmin(busqueda = '') {
    try {
        // Por ahora tomamos mes/año actuales; se pueden exponer filtros en UI
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const res = await fetch(`/api/admin/ventas?year=${year}&month=${month}`);
        const data = await res.json();
        const lista = document.getElementById('listaVentasAdmin');
        if (!lista) return;

        if (!data.ok) {
            lista.innerHTML = `<div class="item">Error cargando ventas: ${data.message || 'error'}</div>`;
            return;
        }

        let ventas = data.ventas || [];
        if (busqueda) {
            const b = busqueda.toLowerCase();
            ventas = ventas.filter(v => (v.cliente || '').toLowerCase().includes(b) || (v.usuario || '').toLowerCase().includes(b) || String(v.id_venta).includes(b));
        }

        if (ventas.length === 0) {
            lista.innerHTML = '<div class="item">No hay ventas para el mes seleccionado.</div>';
            return;
        }

        lista.innerHTML = ventas.map(v => `
            <div class="item" data-id="${v.id_venta}">
                <div>
                    <strong>Venta #${v.id_venta}</strong> — ${v.cliente || 'Cliente Anónimo'}<br>
                    Fecha: ${v.fecha_hora} | Total: $${parseFloat(v.total_venta || 0).toFixed(2)} | Pago: ${v.tipo_pago} | Usuario: ${v.usuario || 'N/A'}
                    <div style="margin-top:8px;font-size:0.9em;color:var(--text-muted);">${(v.detalle || []).map(d => `${d.marca || ''} ${d.producto || ''} (${d.talla || ''}) x${d.cantidad} @ $${parseFloat(d.precio_unitario||0).toFixed(2)}`).join(' · ')}</div>
                </div>
                <div class="actions">
                    <button class="btn btn-small" onclick="verDetalleVenta(${v.id_venta})">Ver</button>
                </div>
            </div>
        `).join('');

        // Mostrar totales resumidos (si existe contenedor en dashboard)
        if (document.getElementById('ventasMes')) {
            document.getElementById('ventasMes').textContent = '$' + (data.totales && data.totales.total_mes ? parseFloat(data.totales.total_mes).toFixed(2) : '0.00');
        }

    } catch (error) {
        console.error('Error cargando ventas admin:', error);
        const lista = document.getElementById('listaVentasAdmin');
        if (lista) lista.innerHTML = '<div class="item">Error de conexión al cargar ventas</div>';
    }
}

window.verDetalleVenta = function(id) {
    // Simple scroll a la venta o abrir modal: por ahora mostramos alerta con detalles
    alert('Ver detalles venta #' + id + ' (implementar modal si se desea)');
};


// ==================== FUNCIONES DE CUENTAS POR PAGAR ====================
async function cargarCuentasPagar() {
    try {
        const res = await fetch('/api/cuentas-pagar');
        const data = await res.json();
        const lista = document.getElementById('listaCuentasPagar');
        if (lista && data.cuentas) {
            lista.innerHTML = data.cuentas.map(cuenta => `
                <div class="item">
                    <div>
                        <strong>Cuenta #${cuenta.id_cuenta}</strong><br>
                        Proveedor: ${cuenta.nombre_proveedor} | 
                        Monto: $${cuenta.monto_total} | 
                        Pendiente: $${cuenta.monto_pendiente} | 
                        Vencimiento: ${cuenta.fecha_vencimiento} | 
                        Estado: ${cuenta.estado}
                    </div>
                    <div class="actions">
                        <button class="btn btn-small" onclick="registrarPago(${cuenta.id_cuenta})">Registrar Pago</button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error cargando cuentas por pagar:', error);
    }
}

// ==================== FUNCIONES DE CONTROL DE CAJA ====================
async function cargarMovimientosCaja() {
    try {
        const res = await fetch('/api/movimientos-caja');
        const data = await res.json();
        const lista = document.getElementById('listaMovimientosCaja');
        if (lista && data.movimientos) {
            lista.innerHTML = data.movimientos.map(mov => `
                <div class="item">
                    <div>
                        <strong>${mov.tipo_movimiento}</strong><br>
                        Fecha: ${mov.fecha_hora} | Monto: $${mov.monto} | 
                        ${mov.descripcion || ''}
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error cargando movimientos:', error);
    }
}

// ==================== FUNCIONES DE CONCILIACIÓN ====================
async function registrarConciliacion(e) {
    e.preventDefault();
    try {
        const res = await fetch('/api/conciliacion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fecha_conciliacion: document.getElementById('conciliacionFecha').value,
                saldo_libro: parseFloat(document.getElementById('conciliacionSaldoLibro').value),
                saldo_banco: parseFloat(document.getElementById('conciliacionSaldoBanco').value)
            })
        });

        const data = await res.json();
        if (data.ok) {
            alert('Conciliación registrada correctamente');
            e.target.reset();
            cargarConciliaciones();
        } else {
            alert('Error: ' + (data.error || ''));
        }
    } catch (error) {
        alert('Error de conexión');
    }
}

async function cargarConciliaciones() {
    try {
        const res = await fetch('/api/conciliacion');
        const data = await res.json();
        const lista = document.getElementById('listaConciliaciones');
        if (lista && data.conciliaciones) {
            lista.innerHTML = data.conciliaciones.map(conc => `
                <div class="item">
                    <div>
                        <strong>Conciliación ${conc.fecha_conciliacion}</strong><br>
                        Saldo Libro: $${conc.saldo_libro} | Saldo Banco: $${conc.saldo_banco} | 
                        Diferencia: $${conc.diferencia} | Estado: ${conc.estado}
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error cargando conciliaciones:', error);
    }
}

// ==================== FUNCIONES DE REPORTES ====================
async function cargarReporteUtilidad() {
    try {
        const res = await fetch('/api/reportes/utilidad-productos');
        const data = await res.json();
        const tbody = document.getElementById('tbodyReporteUtilidad');
        if (tbody && data.utilidad) {
            tbody.innerHTML = data.utilidad.map(prod => `
                <tr>
                    <td style="padding:var(--spacing-md);">${prod.nombre}</td>
                    <td style="padding:var(--spacing-md);text-align:right;">$${parseFloat(prod.costo_promedio || 0).toFixed(2)}</td>
                    <td style="padding:var(--spacing-md);text-align:right;">$${parseFloat(prod.precio_venta || 0).toFixed(2)}</td>
                    <td style="padding:var(--spacing-md);text-align:right;">$${parseFloat(prod.utilidad_unitaria || 0).toFixed(2)}</td>
                    <td style="padding:var(--spacing-md);text-align:right;">${prod.unidades_vendidas || 0}</td>
                    <td style="padding:var(--spacing-md);text-align:right;">$${parseFloat(prod.utilidad_total || 0).toFixed(2)}</td>
                    <td style="padding:var(--spacing-md);text-align:right;">${parseFloat(prod.margen_ganancia || 0).toFixed(1)}%</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error cargando reporte:', error);
    }
}

// ------------------ Análisis de Ventas por Temporada (frontend helper) ------------------
async function fetchVentasTemporada(periodo = 'actual') {
    try {
        const res = await fetch(`/api/reportes/ventas-temporada?periodo=${encodeURIComponent(periodo)}`);
        const data = await res.json();
        if (!data) return;

        // data.rows contiene objetos con ingreso_total (según la vista)
        // Para compatibilidad con cargarGraficoVentas (que espera {ingreso_total}), pasamos rows directamente
        if (data.rows && Array.isArray(data.rows)) {
            // Si la vista devuelve por mes, usamos ingreso_total; si son agrupaciones, también deberían tener ingreso_total
            cargarGraficoVentas(data.rows.map(r => ({ ingreso_total: Number(r.ingreso_total || 0), label: r.periodo || (r.anio && r.mes ? `${r.anio}-${String(r.mes).padStart(2,'0')}` : '') })));
        }
    } catch (e) {
        console.error('Error obteniendo ventas por temporada:', e);
    }
}

// ------------------ Rotación de Inventario (frontend helper) ------------------
async function fetchRotacionInventario(top = 50) {
    try {
        const res = await fetch(`/api/reportes/rotacion-inventario?top=${top}`);
        const data = await res.json();
        if (data && data.rows) {
            // Puedes mostrar estos datos en una tabla o usar otra función para renderizarlos
            console.log('Rotación inventario top', top, data.rows);
            // Ejemplo: actualizar un contenedor si existe
            const cont = document.getElementById('rotacionTabla');
            if (cont) {
                cont.innerHTML = data.rows.map(r => `
                    <div class="item">
                      <div><strong>${r.nombre}</strong> — ${r.categoria || ''}</div>
                      <div>Stock: ${r.stock_actual} | Vendidas (últ. mes): ${r.unidades_vendidas_ultimo_mes} | Índice: ${parseFloat(r.indice_rotacion||0).toFixed(2)}</div>
                    </div>
                `).join('');
            }
        }
    } catch (e) {
        console.error('Error al obtener rotación de inventario:', e);
    }
}

function exportarReporteUtilidad() {
    // Implementar exportación a Excel/CSV
    alert('Funcionalidad de exportación pendiente');
}

