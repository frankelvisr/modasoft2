#!/usr/bin/env bash
set -euo pipefail

# apply_promotions_migration.sh
# Script idempotente para aplicar migraciones relacionadas con promociones y trazabilidad en modasoft_db.
# - Hace backup del esquema/DB
# - Verifica columnas existentes y aplica ALTER TABLE si faltan
# - Crea índices y FK si faltan
# - Opcional: crea trigger para rellenar producto_nombre
# Uso:
#   DB_USER=root DB_PASS=secret DB_NAME=modasoft_db ./scripts/apply_promotions_migration.sh
#   o simplemente ejecuta y te pedirá la contraseña si no está en DB_PASS

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-modasoft_db}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-}"
DRY_RUN=0
CREATE_TRIGGER=1

# Procesar flags simples
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;; 
    --no-trigger) CREATE_TRIGGER=0; shift ;;
    --help|-h) echo "Usage: DB_USER=... DB_PASS=... DB_NAME=... $0 [--dry-run] [--no-trigger]"; exit 0 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [ -z "$DB_PASS" ]; then
  read -s -p "MySQL password for $DB_USER: " DB_PASS
  echo
fi

export MYSQL_PWD="$DB_PASS"

SQLCMD="mysql -h${DB_HOST} -P${DB_PORT} -u${DB_USER} ${DB_NAME} -N -s -e"

echo "DB host: $DB_HOST    DB: $DB_NAME    user: $DB_USER"
if [ "$DRY_RUN" -eq 1 ]; then
  echo "DRY RUN: no se aplicarán cambios, solo se mostrarán acciones";
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_${DB_NAME}_${TIMESTAMP}.sql"

echo "Realizando backup de la base de datos en $BACKUP_FILE..."
if [ "$DRY_RUN" -eq 0 ]; then
  if ! command -v mysqldump >/dev/null 2>&1; then
    echo "ERROR: mysqldump no encontrado en PATH" >&2; exit 2
  fi
  mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"
  echo "Backup creado: $BACKUP_FILE"
else
  echo "(dry-run) skip mysqldump"
fi

# Helper para comprobar si una columna existe
column_exists() {
  local table="$1"; local column="$2";
  $SQLCMD "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=\"${DB_NAME}\" AND TABLE_NAME=\"${table}\" AND COLUMN_NAME=\"${column}\";"
}

# Helper para comprobar si índice existe
index_exists() {
  local table="$1"; local idx="$2";
  $SQLCMD "SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=\"${DB_NAME}\" AND TABLE_NAME=\"${table}\" AND INDEX_NAME=\"${idx}\";"
}

# Helper para comprobar si FK existe
fk_exists() {
  local table="$1"; local fkcol="$2"; local ref_table="$3";
  $SQLCMD "SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=\"${DB_NAME}\" AND TABLE_NAME=\"${table}\" AND COLUMN_NAME=\"${fkcol}\" AND REFERENCED_TABLE_NAME=\"${ref_table}\";"
}

# Lista de cambios a aplicar (idempotente)
# 1) promociones.param_x,param_y
for col in param_x param_y; do
  echo "Comprobando promociones.$col..."
  exists=$(column_exists promociones "$col")
  if [ "$exists" -eq 0 ]; then
    echo " -> falta promociones.$col -> se agregará"
    if [ "$DRY_RUN" -eq 0 ]; then
      $SQLCMD "ALTER TABLE promociones ADD COLUMN ${col} INT NULL;"
    fi
  else
    echo " -> ya existe promociones.$col"
  fi
done

# 2) detalleventa: id_promocion_aplicada, descuento_unitario, descuento_total
declare -A cols
cols=( [id_promocion_aplicada]='INT NULL' [descuento_unitario]='DECIMAL(12,2) NOT NULL DEFAULT 0' [descuento_total]='DECIMAL(12,2) NOT NULL DEFAULT 0' )
for c in "${!cols[@]}"; do
  echo "Comprobando detalleventa.$c..."
  exists=$(column_exists detalleventa "$c")
  if [ "$exists" -eq 0 ]; then
    echo " -> falta detalleventa.$c -> se agregará"
    if [ "$DRY_RUN" -eq 0 ]; then
      $SQLCMD "ALTER TABLE detalleventa ADD COLUMN ${c} ${cols[$c]};"
    fi
  else
    echo " -> ya existe detalleventa.$c"
  fi
done

# 3) Índice y FK opcional para detalleventa.id_promocion_aplicada
IDX_NAME="idx_detalleventa_promocion"
exists_idx=$(index_exists detalleventa "$IDX_NAME")
if [ "$exists_idx" -eq 0 ]; then
  echo " -> creando índice $IDX_NAME on detalleventa(id_promocion_aplicada)"
  if [ "$DRY_RUN" -eq 0 ]; then
    $SQLCMD "CREATE INDEX ${IDX_NAME} ON detalleventa (id_promocion_aplicada);"
  fi
else
  echo " -> índice $IDX_NAME ya existe"
fi

# FK
fkcount=$(fk_exists detalleventa id_promocion_aplicada promociones)
if [ "$fkcount" -eq 0 ]; then
  echo " -> no existe FK a promociones desde detalleventa.id_promocion_aplicada -> se añadirá"
  if [ "$DRY_RUN" -eq 0 ]; then
    # Usar nombre de constraint fijo
    $SQLCMD "ALTER TABLE detalleventa ADD CONSTRAINT fk_detalleventa_promocion FOREIGN KEY (id_promocion_aplicada) REFERENCES promociones(id_promocion) ON DELETE SET NULL ON UPDATE CASCADE;" || echo "Advertencia: no se pudo crear FK (posible permisos o versiones).";
  fi
else
  echo " -> FK ya existe"
fi

# 4) índices en promociones (activa, fecha)
if [ "$(index_exists promociones idx_promociones_activa)" -eq 0 ]; then
  echo " -> creando idx_promociones_activa"
  if [ "$DRY_RUN" -eq 0 ]; then $SQLCMD "ALTER TABLE promociones ADD INDEX idx_promociones_activa (activa);"; fi
else echo " -> idx_promociones_activa ya existe"; fi
if [ "$(index_exists promociones idx_promociones_fecha)" -eq 0 ]; then
  echo " -> creando idx_promociones_fecha"
  if [ "$DRY_RUN" -eq 0 ]; then $SQLCMD "ALTER TABLE promociones ADD INDEX idx_promociones_fecha (fecha_inicio, fecha_fin);"; fi
else echo " -> idx_promociones_fecha ya existe"; fi

# 5) opcional: producto_nombre en detalleventa
echo "Comprobando detalleventa.producto_nombre (opcional)..."
if [ "$(column_exists detalleventa producto_nombre)" -eq 0 ]; then
  echo " -> falta columna producto_nombre -> se agregará (opcional)"
  if [ "$DRY_RUN" -eq 0 ]; then
    $SQLCMD "ALTER TABLE detalleventa ADD COLUMN producto_nombre VARCHAR(255) NULL;"
  fi
else
  echo " -> detalleventa.producto_nombre ya existe"
fi

# 6) Crear trigger para rellenar producto_nombre si se solicita
if [ "$CREATE_TRIGGER" -eq 1 ]; then
  echo "Comprobando trigger trg_detalleventa_before_insert..."
  trig_exists=$($SQLCMD "SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=\"${DB_NAME}\" AND TRIGGER_NAME='trg_detalleventa_before_insert';")
  if [ "$trig_exists" -eq 0 ]; then
    echo " -> trigger no existe -> se creará"
    if [ "$DRY_RUN" -eq 0 ]; then
      TMPFILE=$(mktemp /tmp/trg_detalleventa_XXXX.sql)
      cat > "$TMPFILE" <<'SQL'
CREATE TRIGGER trg_detalleventa_before_insert
BEFORE INSERT ON detalleventa
FOR EACH ROW
BEGIN
  IF NEW.producto_nombre IS NULL OR NEW.producto_nombre = '' THEN
    DECLARE _nombre VARCHAR(255);
    SELECT nombre INTO _nombre FROM productos WHERE id_producto = NEW.id_producto LIMIT 1;
    SET NEW.producto_nombre = _nombre;
  END IF;
END;
SQL
      # Ejecutar el SQL
      $SQLCMD "SOURCE $TMPFILE" || $SQLCMD "$(cat $TMPFILE)" || true
      rm -f "$TMPFILE"
      echo "Trigger creado (si el servidor permitió la creación)."
    fi
  else
    echo " -> trigger ya existe"
  fi
else
  echo "--no-trigger especificado, se omite creación del trigger"
fi

echo "--- Operación finalizada ---"

# Limpiar variable sensible
unset MYSQL_PWD

exit 0
