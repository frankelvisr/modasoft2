// JS para mejorar la experiencia de Caja: carrito, cálculo y visualización de promociones
let cajaCart = [];
let productosCache = [];
let promocionesCache = [];

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('ventaProducto')) {
    loadProductosForCaja();
    loadPromociones();

    document.getElementById('btnAgregarProducto').addEventListener('click', onAgregarAlCarrito);
    document.getElementById('btnPagarVenta').addEventListener('click', onPagarVenta);
  }
});

async function loadProductosForCaja() {
  try {
    const res = await fetch('/api/productos');
    const data = await res.json();
    productosCache = data.productos || [];
    const sel = document.getElementById('ventaProducto');
    sel.innerHTML = `<option value="">Selecciona producto</option>`;
    productosCache.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id_producto;
      opt.textContent = `${p.marca || ''} - ${p.nombre} - $${parseFloat(p.precio_venta||0).toFixed(2)} | Stock: ${p.inventario||0}`;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', onProductoChange);
  } catch (e) {
    console.error('Error cargando productos para caja:', e);
  }
}

async function loadPromociones() {
  try {
    const res = await fetch('/api/promociones');
    if (!res.ok) return;
    const data = await res.json();
    promocionesCache = data.promociones || [];
  } catch (e) {
    console.error('Error cargando promociones:', e);
  }
}

function onProductoChange() {
  const pid = document.getElementById('ventaProducto').value;
  const prod = productosCache.find(p => String(p.id_producto) === String(pid));
  if (prod) {
    document.getElementById('ventaPrecioUnitario').value = parseFloat(prod.precio_venta || 0).toFixed(2);
    const tallaSel = document.getElementById('ventaTalla');
    tallaSel.innerHTML = '<option value="">Selecciona talla</option>';
    (prod.tallas || []).forEach(t => {
      const o = document.createElement('option'); o.value = t.id_talla; o.textContent = `${t.nombre} (${t.cantidad})`; tallaSel.appendChild(o);
    });
  }
  calcularTotalesForm();
}

function calcularTotalesForm() {
  const precio = parseFloat(document.getElementById('ventaPrecioUnitario').value || 0) || 0;
  const cantidad = parseInt(document.getElementById('ventaCantidad').value || 0) || 0;
  const total = precio * cantidad;
  document.getElementById('ventaTotalDolar').value = total ? `$${total.toFixed(2)}` : '';
  // tasa en el front se obtiene al pedir /api/tasa-bcv si se quiere convertir, omitimos aquí
}

function onAgregarAlCarrito() {
  const id_producto = document.getElementById('ventaProducto').value;
  const id_talla = document.getElementById('ventaTalla').value || null;
  const cantidad = parseInt(document.getElementById('ventaCantidad').value || 0);
  const precio_unitario = parseFloat(document.getElementById('ventaPrecioUnitario').value || 0) || 0;
  if (!id_producto || !cantidad || cantidad <= 0) { alert('Selecciona producto y cantidad válida'); return; }
  const prod = productosCache.find(p => String(p.id_producto) === String(id_producto));
  cajaCart.push({ id_producto: Number(id_producto), id_talla: id_talla ? Number(id_talla) : null, cantidad, precio_unitario, nombre: prod ? (prod.nombre || prod.marca) : 'Producto' });
  renderCart();
}

function aplicarMejorPromocion(item) {
  // Lógica simplificada que emula al servidor: evalúa promocionesCache y devuelve {promo, descuento_total, detalle}
  const pAplicables = promocionesCache.filter(p => p.activa && new Date(p.fecha_inicio) <= new Date() && new Date(p.fecha_fin) >= new Date());
  const prodInfo = productosCache.find(p => p.id_producto === item.id_producto) || {};
  let mejor = { descuento: 0, promo: null, detalle: null };
  const subtotal = item.precio_unitario * item.cantidad;
  const subtotalCarrito = cajaCart.reduce((s,it)=>s + (it.precio_unitario * it.cantidad), 0);
  for (const p of pAplicables) {
    if (p.id_producto && Number(p.id_producto) !== Number(item.id_producto)) continue;
    if (p.id_categoria && Number(p.id_categoria) !== Number(prodInfo.id_categoria)) continue;
    const minimo = Number(p.minimo_compra || 0);
    if (minimo > 0) {
      const scope = (p.id_producto || p.id_categoria) ? subtotal : subtotalCarrito;
      if (scope < minimo) continue;
    }
    let descuento = 0;
    if (p.tipo_promocion === 'DESCUENTO_PORCENTAJE') descuento = subtotal * (Number(p.valor||0)/100);
    else if (p.tipo_promocion === 'DESCUENTO_FIJO') {
      const val = Number(p.valor||0);
      descuento = (p.id_producto || p.id_categoria) ? (item.cantidad * val) : (subtotalCarrito > 0 ? (subtotal / subtotalCarrito) * val : 0);
    } else if (p.tipo_promocion === 'COMPRA_X_LLEVA_Y') {
      const x = Number(p.param_x||0); const y = Number(p.param_y||0);
      if (x > 0 && y >= 0) {
        const bloque = x + y;
        const completos = Math.floor(item.cantidad / bloque);
        const gratis = completos * y;
        descuento = gratis * item.precio_unitario;
      }
    }
    if (descuento > mejor.descuento) mejor = { descuento, promo: p, detalle: { subtotal } };
  }
  return { descuento: mejor.descuento, promo: mejor.promo, detalle: mejor.detalle };
}

function renderCart() {
  const cont = document.getElementById('ventaDetalle');
  if (!cont) return;
  if (cajaCart.length === 0) { cont.innerHTML = '<div class="item">Carrito vacío. Agrega productos para la venta.</div>'; return; }
  let html = '';
  let total = 0; let totalDescuentos = 0;
  cajaCart.forEach((it, idx) => {
    const calc = aplicarMejorPromocion(it);
    const descuento = Number(calc.descuento || 0);
    const lineaTotal = (it.precio_unitario * it.cantidad) - descuento;
    total += lineaTotal; totalDescuentos += descuento;
    html += `<div class="item" data-idx="${idx}">
      <div><strong>${it.nombre || ('#'+it.id_producto)}</strong> x${it.cantidad} @ $${parseFloat(it.precio_unitario||0).toFixed(2)}</div>
      <div style="font-size:0.9em;color:#666;">Subtotal: $${(it.precio_unitario*it.cantidad).toFixed(2)} ${descuento>0?`| Descuento: -$${descuento.toFixed(2)} (${calc.promo?calc.promo.nombre:'promo'})`:''}</div>
      <div style="margin-top:6px;">Total línea: $${lineaTotal.toFixed(2)} <button class="btn btn-small secondary" onclick="removeCartItem(${idx})">Eliminar</button></div>
    </div>`;
  });
  html += `<div class="item" style="border-top:1px solid #eee;padding-top:8px;"><strong>Total descuentos:</strong> $${totalDescuentos.toFixed(2)} — <strong>Total a pagar:</strong> $${total.toFixed(2)}</div>`;
  cont.innerHTML = html;
}

window.removeCartItem = function(idx) { cajaCart.splice(idx,1); renderCart(); };

async function onPagarVenta() {
  if (cajaCart.length === 0) { alert('Carrito vacío'); return; }
  // Recopilar datos cliente
  const cliente = {
    cedula: document.getElementById('ventaClienteCedula').value || null,
    nombre: document.getElementById('ventaClienteNombre').value || null,
    telefono: document.getElementById('ventaClienteTelefono').value || null,
    email: document.getElementById('ventaClienteEmail').value || null
  };
  const tipo_pago = document.getElementById('ventaTipoPago').value || 'Efectivo';
  try {
    const res = await fetch('/api/caja/venta', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ items: cajaCart, cliente_nombre: cliente.nombre, cliente_cedula: cliente.cedula, cliente_telefono: cliente.telefono, cliente_email: cliente.email, tipo_pago })
    });
    if (!res.ok) {
      const err = await res.json().catch(()=>({message:'Error servidor'}));
      alert('Error al procesar venta: ' + (err.message || JSON.stringify(err)));
      return;
    }
    const data = await res.json();
    if (data.ok) {
      alert('Venta registrada. ID: ' + (data.id_venta || data.id_venta || 'n/a') + '\nTotal: $' + (data.total||0).toFixed(2));
      cajaCart = [];
      renderCart();
      document.getElementById('form-venta-caja').reset();
    } else {
      alert('Error procesando venta: ' + (data.message || '')); 
    }
  } catch (e) {
    console.error('Error al pagar venta:', e);
    alert('Error de conexión al servidor');
  }
}

// Export para tests manuales
if (typeof window !== 'undefined') window._caja = { cajaCart, renderCart, aplicarMejorPromocion };
