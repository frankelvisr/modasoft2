// JS para mejorar la experiencia de Caja: carrito, cálculo y visualización de promociones
let cajaCart = [];
let productosCache = [];
let promocionesCache = [];

document.addEventListener('DOMContentLoaded', async () => {
  if (document.getElementById('ventaProducto')) {
    // Cargar productos y promociones de forma automática y esperar a que terminen
    try {
      await Promise.all([loadProductosForCaja(), loadPromociones()]);
    } catch (e) {
      console.error('Error inicializando productos/promociones:', e);
      // intentar cargar individualmente si Promise.all falló
      await loadProductosForCaja().catch(()=>{});
      await loadPromociones().catch(()=>{});
    }

    // Listeners
    document.getElementById('btnAgregarProducto').addEventListener('click', onAgregarAlCarrito);
    document.getElementById('btnPagarVenta').addEventListener('click', onPagarVenta);
    // Render inicial del carrito (si hay items previos)
    renderCart();
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
    const res = await fetch('/api/promociones/activas');
    if (!res.ok) {
      promocionesCache = [];
      return;
    }
    const data = await res.json();
    promocionesCache = data.promociones || [];
    // Después de cargar promociones, actualizar vista si hay carrito
    renderCart();
  } catch (e) {
    console.error('Error cargando promociones:', e);
    showNotification('No se pudieron cargar las promociones.', 'error');
    promocionesCache = [];
  }
}

function showNotification(message, type = 'info', timeout = 0) {
  const container = document.getElementById('cajaNotif');
  if (!container) return;
  container.innerHTML = `<div class="notif ${type}">${message}</div>`;
  if (timeout && timeout > 0) setTimeout(() => { container.innerHTML = ''; }, timeout);
}

function clearNotification() {
  const container = document.getElementById('cajaNotif');
  if (!container) return;
  container.innerHTML = '';
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

async function onAgregarAlCarrito() {
  const id_producto = document.getElementById('ventaProducto').value;
  const id_talla = document.getElementById('ventaTalla').value || null;
  const cantidad = parseInt(document.getElementById('ventaCantidad').value || 0);
  const precio_unitario = parseFloat(document.getElementById('ventaPrecioUnitario').value || 0) || 0;
  if (!id_producto || !cantidad || cantidad <= 0) { alert('Selecciona producto y cantidad válida'); return; }
  const prod = productosCache.find(p => String(p.id_producto) === String(id_producto));
  cajaCart.push({ id_producto: Number(id_producto), id_talla: id_talla ? Number(id_talla) : null, cantidad, precio_unitario, nombre: prod ? (prod.nombre || prod.marca) : 'Producto', no_aplicar_promocion: false, force_promotion_id: null });
  // Asegurar que promociones estén cargadas antes de renderizar
  if (!promocionesCache || promocionesCache.length === 0) {
    await loadPromociones().catch(()=>{});
  }
  renderCart();
}

function aplicarMejorPromocion(item) {
  // Lógica simplificada que emula al servidor: evalúa promocionesCache y devuelve {promo, descuento_total, detalle}
  // promocionesCache ya debería contener solo promociones activas (endpoint /api/promociones/activas)
  const now = new Date();
  const pAplicables = promocionesCache.filter(p => {
    try {
      return (!p.fecha_inicio || new Date(p.fecha_inicio) <= now) && (!p.fecha_fin || new Date(p.fecha_fin) >= now);
    } catch (e) { return true; }
  });
  const prodInfo = productosCache.find(p => p.id_producto === item.id_producto) || {};
  let mejor = { descuento: 0, promo: null, detalle: null };
  const subtotal = item.precio_unitario * item.cantidad;
  const subtotalCarrito = cajaCart.reduce((s,it)=>s + (it.precio_unitario * it.cantidad), 0);
  // Si el cajero deshabilitó promociones para este item
  if (item.no_aplicar_promocion) return { descuento: 0, promo: null, detalle: null };

  // Si el cajero forzó una promoción específica
  if (item.force_promotion_id) {
    const forced = pAplicables.find(pp => Number(pp.id_promocion) === Number(item.force_promotion_id));
    if (forced) {
      // aplicar la promoción forzada (reutilizar la lógica de cálculo)
      const p = forced;
      let descuentoForced = 0;
      if (p.tipo_promocion === 'DESCUENTO_PORCENTAJE') {
        descuentoForced = subtotal * (Number(p.valor || 0) / 100);
      } else if (p.tipo_promocion === 'DESCUENTO_FIJO') {
        const val = Number(p.valor || 0);
        if (p.id_producto || p.id_categoria) descuentoForced = item.cantidad * val;
        else descuentoForced = subtotalCarrito > 0 ? (subtotal / subtotalCarrito) * val : 0;
      } else if (p.tipo_promocion === 'COMPRA_X_LLEVA_Y') {
        const paramX = Number(p.param_x || 0);
        const paramY = Number(p.param_y || 0);
        if (paramX > 0 && paramY >= 0) {
          const bloque = paramX + paramY;
          const completos = Math.floor(item.cantidad / bloque);
          const gratis = completos * paramY;
          descuentoForced = gratis * item.precio_unitario;
        }
      }
      return { descuento: descuentoForced, promo: p, detalle: { subtotal } };
    }
  }

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
    // Controles: checkbox para aplicar/ignorar promo y select para forzar promoción
    const promoOptions = promocionesCache.filter(p => {
      try {
        const now = new Date();
        if (p.id_producto && Number(p.id_producto) !== Number(it.id_producto)) return false;
        if (p.fecha_inicio && new Date(p.fecha_inicio) > now) return false;
        if (p.fecha_fin && new Date(p.fecha_fin) < now) return false;
        return true;
      } catch (e) { return false; }
    });
    const promoSelectHtml = promoOptions.length > 0 ? `
      <select onchange="window._caja.setForcedPromo(${idx}, this.value)">
        <option value="">Auto</option>
        ${promoOptions.map(pp => `<option value="${pp.id_promocion}" ${it.force_promotion_id && Number(it.force_promotion_id)===Number(pp.id_promocion)?'selected':''}>Forzar: ${pp.nombre}</option>`).join('')}
      </select>` : '';

    html += `<div class="item" data-idx="${idx}">
      <div style="display:flex;justify-content:space-between;align-items:center;"><strong>${it.nombre || ('#'+it.id_producto)}</strong> <button class="btn btn-small secondary" onclick="removeCartItem(${idx})">Eliminar</button></div>
      <div style="font-size:0.9em;color:#666;">Subtotal: $${(it.precio_unitario*it.cantidad).toFixed(2)} ${descuento>0?`| Descuento: -$${descuento.toFixed(2)} (${calc.promo?calc.promo.nombre:'promo'})`:''} ${calc.promo?` <button class="btn" onclick="window._caja.showPromoDetails(${idx})" style="margin-left:8px;">Detalles promo</button>`:''}</div>
      <div style="margin-top:6px;display:flex;gap:8px;align-items:center;">
        <label style="font-size:0.9em;"><input type="checkbox" ${it.no_aplicar_promocion? 'checked' : ''} onchange="window._caja.toggleNoPromo(${idx}, this.checked)"> Ignorar promo</label>
        ${promoSelectHtml}
        <div style="margin-left:auto;font-weight:700;">Total línea: $${lineaTotal.toFixed(2)}</div>
      </div>
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
        body: JSON.stringify({ items: cajaCart.map(it=>({ id_producto: it.id_producto, id_talla: it.id_talla, cantidad: it.cantidad, precio_unitario: it.precio_unitario, no_aplicar_promocion: !!it.no_aplicar_promocion, force_promotion_id: it.force_promotion_id })), cliente_nombre: cliente.nombre, cliente_cedula: cliente.cedula, cliente_telefono: cliente.telefono, cliente_email: cliente.email, tipo_pago })
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
if (typeof window !== 'undefined') window._caja = {
  cajaCart,
  renderCart,
  aplicarMejorPromocion,
  toggleNoPromo: (idx, checked) => { if (cajaCart[idx]) { cajaCart[idx].no_aplicar_promocion = !!checked; renderCart(); } },
  setForcedPromo: (idx, promoId) => { if (cajaCart[idx]) { cajaCart[idx].force_promotion_id = promoId ? Number(promoId) : null; renderCart(); } },
  showPromoDetails: (idx) => {
    try {
      const item = cajaCart[idx];
      if (!item) return;
      const calc = aplicarMejorPromocion(item);
      const promo = calc && calc.promo ? calc.promo : null;
      const modal = document.getElementById('promoModal');
      const title = document.getElementById('promoModalTitle');
      const body = document.getElementById('promoModalBody');
      if (!modal || !title || !body) return;
      if (!promo) {
        title.textContent = 'Sin promoción aplicable';
        body.innerHTML = '<p>No hay promociones aplicables para esta línea.</p>';
      } else {
        title.textContent = promo.nombre || 'Promoción';
        body.innerHTML = `
          <p><strong>Tipo:</strong> ${promo.tipo_promocion}</p>
          <p><strong>Descripción:</strong> ${promo.descripcion || '-'} </p>
          <p><strong>Válida desde:</strong> ${promo.fecha_inicio} hasta ${promo.fecha_fin}</p>
          <p><strong>Condiciones:</strong> ${promo.minimo_compra ? 'Mínimo compra: ' + promo.minimo_compra : 'Ninguna'}</p>
          <p><strong>Parámetros:</strong> ${promo.param_x ? 'X=' + promo.param_x : ''} ${promo.param_y ? ' Y=' + promo.param_y : ''}</p>
          <hr>
          <p><strong>Detalle cálculo:</strong></p>
          <pre style="white-space:pre-wrap;">Subtotal línea: $${(item.precio_unitario*item.cantidad).toFixed(2)}\nDescuento estimado: $${(calc.descuento||0).toFixed(2)}</pre>
        `;
      }
      modal.style.display = 'block';
    } catch (e) { console.error('Error mostrando detalles de promo:', e); }
  }
};

// Modal close handler
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const pm = document.getElementById('promoModal');
    const pmClose = document.getElementById('promoModalClose');
    if (pmClose) pmClose.addEventListener('click', () => { if (pm) pm.style.display = 'none'; });
    // Cerrar click fuera del contenido
    if (pm) pm.addEventListener('click', (ev) => { if (ev.target === pm) pm.style.display = 'none'; });
  });
}
