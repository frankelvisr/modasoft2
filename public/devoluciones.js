/*
  devoluciones.js
  Funcionalidades para el módulo de devoluciones en caja
*/

document.addEventListener('DOMContentLoaded', function() {
    const formAcceso = document.getElementById('form-acceso-devoluciones');
    const panelDevoluciones = document.getElementById('panelDevoluciones');
    const btnBuscarVenta = document.getElementById('btnBuscarVentaDevolucion');
    
    if (formAcceso) {
        formAcceso.addEventListener('submit', async function(e) {
            e.preventDefault();
            const clave = document.getElementById('claveDevoluciones').value;
            
            try {
                const res = await fetch('/api/devoluciones/validar-clave', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clave })
                });
                
                const data = await res.json();
                if (data.ok) {
                    panelDevoluciones.style.display = 'block';
                    formAcceso.reset();
                } else {
                    alert('Clave incorrecta');
                }
            } catch (error) {
                alert('Error de conexión');
            }
        });
    }

    if (btnBuscarVenta) {
        btnBuscarVenta.addEventListener('click', buscarVentasCliente);
    }
});

async function buscarVentasCliente() {
    const cedula = document.getElementById('devolucionCedula').value.trim();
    if (!cedula) {
        alert('Ingrese la cédula del cliente');
        return;
    }

    try {
        const res = await fetch(`/api/devoluciones/ventas-cliente?cedula=${encodeURIComponent(cedula)}`);
        const data = await res.json();
        const contenedor = document.getElementById('ventasClienteDevolucion');
        
        if (data.ok && data.ventas && data.ventas.length > 0) {
            contenedor.innerHTML = data.ventas.map(venta => `
                <div class="item">
                    <div>
                        <strong>Venta #${venta.id_venta}</strong><br>
                        Fecha: ${venta.fecha_hora}<br>
                        Total: $${venta.total_venta}<br>
                        Productos:
                        <ul style="margin-top:8px;">
                            ${venta.detalles.map(det => `
                                <li>${det.nombre_producto} - Talla: ${det.nombre_talla} - 
                                Cantidad: ${det.cantidad} - Precio: $${det.precio_unitario}
                                <button class="btn btn-small" onclick="procesarDevolucion(${det.id_detalle}, ${det.cantidad}, ${det.precio_unitario})" 
                                style="margin-left:10px;">Devolver</button></li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            `).join('');
        } else {
            contenedor.innerHTML = '<div class="item">No se encontraron ventas para este cliente</div>';
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al buscar ventas');
    }
}

window.procesarDevolucion = async function(idDetalle, cantidadMax, precioUnitario) {
    const cantidad = prompt(`Ingrese la cantidad a devolver (máximo: ${cantidadMax}):`, cantidadMax);
    if (!cantidad || isNaN(cantidad) || parseInt(cantidad) < 1 || parseInt(cantidad) > cantidadMax) {
        alert('Cantidad inválida');
        return;
    }

    try {
        const res = await fetch('/api/devoluciones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_detalle: idDetalle,
                cantidad: parseInt(cantidad),
                monto_reembolsado: parseFloat(cantidad) * precioUnitario
            })
        });

        const data = await res.json();
        if (data.ok) {
            alert('Devolución procesada correctamente. El inventario ha sido actualizado.');
            buscarVentasCliente(); // Recargar ventas
        } else {
            alert('Error: ' + (data.error || ''));
        }
    } catch (error) {
        alert('Error de conexión');
    }
};

