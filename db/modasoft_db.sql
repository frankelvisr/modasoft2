-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 02-11-2025 a las 02:39:40
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `modasoft_db`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `categorias`
--

CREATE TABLE `categorias` (
  `id_categoria` int(11) NOT NULL,
  `nombre` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `categorias`
--

INSERT INTO `categorias` (`id_categoria`, `nombre`) VALUES
(27, 'blusas'),
(24, 'camisas');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `clientes`
--

CREATE TABLE `clientes` (
  `id_cliente` int(11) NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `cedula` varchar(20) DEFAULT NULL,
  `telefono` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `clientes`
--

INSERT INTO `clientes` (`id_cliente`, `nombre`, `cedula`, `telefono`, `email`) VALUES
(3, 'frankelvs', '30928764', '123456', 'fra@gmail.con'),
(4, 'alexandra', '30528764', '123456789', 'ale@gmail.com'),
(5, 'alexandra', '30528711', '123456', 'ale@gmail.com');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `compras`
--

CREATE TABLE `compras` (
  `id_compra` int(11) NOT NULL,
  `id_proveedor` int(11) NOT NULL,
  `fecha_compra` date NOT NULL,
  `total_compra` decimal(10,2) NOT NULL,
  `estado_pago` varchar(50) NOT NULL COMMENT 'Pagada, Pendiente, Parcial'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `compras`
--

INSERT INTO `compras` (`id_compra`, `id_proveedor`, `fecha_compra`, `total_compra`, `estado_pago`) VALUES
(3, 1, '2025-10-29', 300.00, 'Pendiente'),
(4, 1, '2025-10-27', 150.00, 'Pagada'),
(5, 1, '2025-11-01', 300.00, 'Pagada');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `conciliacion_bancaria`
--

CREATE TABLE `conciliacion_bancaria` (
  `id_conciliacion` int(11) NOT NULL,
  `fecha_conciliacion` date NOT NULL,
  `saldo_libro` decimal(10,2) NOT NULL COMMENT 'Saldo según nuestros registros',
  `saldo_banco` decimal(10,2) NOT NULL COMMENT 'Saldo según extracto bancario',
  `diferencia` decimal(10,2) NOT NULL COMMENT 'Diferencia entre saldo_libro y saldo_banco',
  `estado` varchar(50) NOT NULL DEFAULT 'PENDIENTE' COMMENT 'PENDIENTE, CONCILIADA, CON_DIFERENCIAS',
  `notas` text DEFAULT NULL,
  `id_usuario` int(11) NOT NULL COMMENT 'Usuario que realizó la conciliación',
  `fecha_registro` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `configuracion`
--

CREATE TABLE `configuracion` (
  `id_config` int(11) NOT NULL,
  `clave` varchar(100) NOT NULL,
  `valor` text DEFAULT NULL,
  `descripcion` varchar(200) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `configuracion`
--

INSERT INTO `configuracion` (`id_config`, `clave`, `valor`, `descripcion`) VALUES
(1, 'clave_devoluciones', 'devol123', 'Clave de acceso para módulo de devoluciones');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `cuentas_por_pagar`
--

CREATE TABLE `cuentas_por_pagar` (
  `id_cuenta` int(11) NOT NULL,
  `id_proveedor` int(11) NOT NULL,
  `id_compra` int(11) DEFAULT NULL COMMENT 'Referencia a la compra que generó la cuenta',
  `monto_total` decimal(10,2) NOT NULL,
  `monto_pagado` decimal(10,2) NOT NULL DEFAULT 0.00,
  `monto_pendiente` decimal(10,2) NOT NULL COMMENT 'Calculado: monto_total - monto_pagado',
  `fecha_vencimiento` date NOT NULL,
  `estado` varchar(50) NOT NULL DEFAULT 'PENDIENTE' COMMENT 'PENDIENTE, PARCIAL, PAGADA, VENCIDA',
  `fecha_registro` datetime NOT NULL DEFAULT current_timestamp(),
  `notas` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `detallecompra`
--

CREATE TABLE `detallecompra` (
  `id_detalle` int(11) NOT NULL,
  `id_compra` int(11) NOT NULL,
  `id_producto` int(11) NOT NULL,
  `cantidad` int(11) NOT NULL,
  `costo_unitario` decimal(10,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `detallecompra`
--

INSERT INTO `detallecompra` (`id_detalle`, `id_compra`, `id_producto`, `cantidad`, `costo_unitario`) VALUES
(1, 3, 23, 20, 15.00),
(2, 4, 23, 10, 15.00),
(3, 5, 23, 20, 15.00);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `detalleventa`
--

CREATE TABLE `detalleventa` (
  `id_detalle` int(11) NOT NULL,
  `id_venta` int(11) NOT NULL,
  `id_producto` int(11) NOT NULL,
  `id_talla` int(11) NOT NULL,
  `cantidad` int(11) NOT NULL,
  `precio_unitario` decimal(10,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `devoluciones`
--

CREATE TABLE `devoluciones` (
  `id_devolucion` int(11) NOT NULL,
  `id_detalle` int(11) NOT NULL COMMENT 'El item de la venta original',
  `fecha_hora` datetime NOT NULL,
  `cantidad` int(11) NOT NULL,
  `monto_reembolsado` decimal(10,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `inventario`
--

CREATE TABLE `inventario` (
  `id_inventario` int(11) NOT NULL,
  `id_producto` int(11) NOT NULL,
  `id_talla` int(11) NOT NULL,
  `cantidad` int(11) NOT NULL DEFAULT 0,
  `costo_promedio` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Costo para cálculo de utilidad'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `inventario`
--

INSERT INTO `inventario` (`id_inventario`, `id_producto`, `id_talla`, `cantidad`, `costo_promedio`) VALUES
(29, 23, 5, 2, 0.00),
(30, 23, 4, 2, 0.00),
(31, 23, 3, 2, 0.00),
(32, 23, 2, 4, 0.00),
(33, 24, 5, 2, 0.00),
(34, 24, 4, 2, 0.00),
(35, 24, 3, 4, 0.00),
(36, 24, 2, 2, 0.00);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `movimientoscaja`
--

CREATE TABLE `movimientoscaja` (
  `id_movimiento` int(11) NOT NULL,
  `fecha_hora` datetime NOT NULL,
  `tipo_movimiento` varchar(50) NOT NULL COMMENT 'INGRESO_VENTA, EGRESO_COMPRA, EGRESO_GASTO, AJUSTE_DEPOSITO, etc.',
  `monto` decimal(10,2) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `referencia_id` int(11) DEFAULT NULL COMMENT 'ID de la Venta/Compra que generó el movimiento',
  `id_usuario` int(11) NOT NULL,
  `id_devolucion` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `movimientos_bancarios`
--

CREATE TABLE `movimientos_bancarios` (
  `id_movimiento_bancario` int(11) NOT NULL,
  `id_conciliacion` int(11) DEFAULT NULL,
  `fecha_movimiento` date NOT NULL,
  `tipo` varchar(50) NOT NULL COMMENT 'DEPOSITO, RETIRO, TRANSFERENCIA, etc.',
  `monto` decimal(10,2) NOT NULL,
  `descripcion` varchar(200) DEFAULT NULL,
  `referencia` varchar(100) DEFAULT NULL,
  `conciliado` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pagos_proveedores`
--

CREATE TABLE `pagos_proveedores` (
  `id_pago` int(11) NOT NULL,
  `id_cuenta` int(11) NOT NULL,
  `monto` decimal(10,2) NOT NULL,
  `fecha_pago` datetime NOT NULL DEFAULT current_timestamp(),
  `metodo_pago` varchar(50) NOT NULL COMMENT 'TRANSFERENCIA, CHEQUE, EFECTIVO, etc.',
  `referencia` varchar(100) DEFAULT NULL COMMENT 'Número de cheque, referencia de transferencia, etc.',
  `id_usuario` int(11) NOT NULL COMMENT 'Usuario que registró el pago',
  `notas` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `productos`
--

CREATE TABLE `productos` (
  `id_producto` int(11) NOT NULL,
  `nombre` varchar(200) NOT NULL,
  `marca` varchar(100) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `precio_venta` decimal(10,2) NOT NULL,
  `inventario` int(11) NOT NULL DEFAULT 0,
  `id_categoria` int(11) NOT NULL,
  `id_proveedor` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `productos`
--

INSERT INTO `productos` (`id_producto`, `nombre`, `marca`, `descripcion`, `precio_venta`, `inventario`, `id_categoria`, `id_proveedor`) VALUES
(23, 'primavera', 'shein', NULL, 20.00, 60, 27, 4),
(24, 'primavera', 'Fast Fashion', NULL, 2.00, 10, 24, 4);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `promociones`
--

CREATE TABLE `promociones` (
  `id_promocion` int(11) NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `tipo_promocion` varchar(50) NOT NULL COMMENT 'DESCUENTO_PORCENTAJE, DESCUENTO_FIJO, COMPRA_X_LLEVA_Y, etc.',
  `valor` decimal(10,2) NOT NULL COMMENT 'Porcentaje o monto fijo según tipo',
  `fecha_inicio` date NOT NULL,
  `fecha_fin` date NOT NULL,
  `activa` tinyint(1) NOT NULL DEFAULT 1,
  `id_categoria` int(11) DEFAULT NULL COMMENT 'Si aplica a una categoría específica',
  `id_producto` int(11) DEFAULT NULL COMMENT 'Si aplica a un producto específico',
  `minimo_compra` decimal(10,2) DEFAULT 0.00 COMMENT 'Monto mínimo de compra'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `proveedores`
--

CREATE TABLE `proveedores` (
  `id_proveedor` int(11) NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `contacto` varchar(150) DEFAULT NULL,
  `telefono` varchar(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `proveedores`
--

INSERT INTO `proveedores` (`id_proveedor`, `nombre`, `contacto`, `telefono`) VALUES
(1, 'fran', '123', '123'),
(4, 'yoileannys', 'jfdutrd', '5649846485');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `roles`
--

CREATE TABLE `roles` (
  `id_rol` int(11) NOT NULL,
  `nombre_rol` varchar(50) NOT NULL COMMENT 'Ej: Administrador, Caja/Empleado'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `roles`
--

INSERT INTO `roles` (`id_rol`, `nombre_rol`) VALUES
(1, 'Administrador'),
(2, 'Caja/Empleado');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `tallas`
--

CREATE TABLE `tallas` (
  `id_talla` int(11) NOT NULL,
  `nombre` varchar(10) NOT NULL,
  `ajuste` varchar(50) DEFAULT NULL,
  `pecho` int(11) DEFAULT NULL,
  `cintura` int(11) DEFAULT NULL,
  `cadera` int(11) DEFAULT NULL,
  `largo` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `tallas`
--

INSERT INTO `tallas` (`id_talla`, `nombre`, `ajuste`, `pecho`, `cintura`, `cadera`, `largo`) VALUES
(2, 'xxl', 'Oversized', NULL, NULL, NULL, NULL),
(3, 's', NULL, NULL, NULL, NULL, NULL),
(4, 'm', NULL, NULL, NULL, NULL, NULL),
(5, 'l | Ajuste', 'Slim', 20, 20, 20, 20);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuarios`
--

CREATE TABLE `usuarios` (
  `id_usuario` int(11) NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `usuario` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL COMMENT 'Contraseña encriptada (debe usarse hashing)',
  `id_rol` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `usuarios`
--

INSERT INTO `usuarios` (`id_usuario`, `nombre`, `usuario`, `password_hash`, `id_rol`) VALUES
(1, 'frank', 'caja', '$2b$10$YBzkCsf/GSkuQTaYXfz2DeIrS8wFTQWoUlLgLTLgihW.nW83uICEK', 2),
(2, 'admin', 'admin', '$2b$10$YBzkCsf/GSkuQTaYXfz2DeIrS8wFTQWoUlLgLTLgihW.nW83uICEK', 1);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `ventas`
--

CREATE TABLE `ventas` (
  `id_venta` int(11) NOT NULL,
  `fecha_hora` datetime NOT NULL,
  `total_venta` decimal(10,2) NOT NULL,
  `tipo_pago` varchar(50) NOT NULL,
  `id_usuario` int(11) NOT NULL COMMENT 'Usuario de caja que realizó la venta',
  `id_cliente` int(11) DEFAULT NULL COMMENT 'Puede ser NULL para ventas anónimas'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `ventas`
--

INSERT INTO `ventas` (`id_venta`, `fecha_hora`, `total_venta`, `tipo_pago`, `id_usuario`, `id_cliente`) VALUES
(13, '2025-11-01 15:37:25', 40.00, 'Pago Móvil', 1, 3),
(14, '2025-11-01 15:46:14', 40.00, 'Efectivo Bolívares', 1, 3),
(27, '2025-11-01 16:40:46', 40.00, 'Pago Móvil', 1, 3),
(28, '2025-11-01 16:45:46', 40.00, 'Pago Móvil', 1, 4),
(29, '2025-11-01 17:22:46', 40.00, 'Pago Móvil', 1, 5),
(30, '2025-11-01 17:23:02', 40.00, 'Pago Móvil', 1, 5),
(31, '2025-11-01 17:28:10', 40.00, 'Pago Móvil', 1, 5);

-- --------------------------------------------------------

--
-- Estructura Stand-in para la vista `vista_margen_categoria`
-- (Véase abajo para la vista actual)
--
CREATE TABLE `vista_margen_categoria` (
`id_categoria` int(11)
,`categoria` varchar(100)
,`total_productos` bigint(21)
,`precio_promedio` decimal(14,6)
,`costo_promedio` decimal(14,6)
,`utilidad_promedio` decimal(15,6)
,`margen_promedio` decimal(24,10)
,`ventas_totales` decimal(42,2)
,`utilidad_total` decimal(43,2)
);

-- --------------------------------------------------------

--
-- Estructura Stand-in para la vista `vista_rotacion_inventario`
-- (Véase abajo para la vista actual)
--
CREATE TABLE `vista_rotacion_inventario` (
`id_producto` int(11)
,`nombre` varchar(200)
,`marca` varchar(100)
,`categoria` varchar(100)
,`stock_actual` decimal(32,0)
,`unidades_vendidas_ultimo_mes` decimal(32,0)
,`indice_rotacion` decimal(36,4)
);

-- --------------------------------------------------------

--
-- Estructura Stand-in para la vista `vista_utilidad_productos`
-- (Véase abajo para la vista actual)
--
CREATE TABLE `vista_utilidad_productos` (
`id_producto` int(11)
,`nombre` varchar(200)
,`marca` varchar(100)
,`categoria` varchar(100)
,`precio_venta` decimal(10,2)
,`costo_promedio` decimal(14,6)
,`utilidad_unitaria` decimal(15,6)
,`margen_ganancia` decimal(24,10)
,`stock_total` decimal(32,0)
,`unidades_vendidas` decimal(32,0)
,`total_ventas` decimal(42,2)
,`utilidad_total` decimal(47,6)
);

-- --------------------------------------------------------

--
-- Estructura Stand-in para la vista `vista_ventas_temporada`
-- (Véase abajo para la vista actual)
--
CREATE TABLE `vista_ventas_temporada` (
`anio` int(4)
,`mes` int(2)
,`trimestre` int(1)
,`periodo` varchar(7)
,`total_ventas` bigint(21)
,`ingreso_total` decimal(32,2)
,`promedio_venta` decimal(14,6)
,`unidades_vendidas` decimal(32,0)
,`clientes_atendidos` bigint(21)
);

-- --------------------------------------------------------

--
-- Estructura para la vista `vista_margen_categoria`
--
DROP TABLE IF EXISTS `vista_margen_categoria`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `vista_margen_categoria`  AS SELECT `c`.`id_categoria` AS `id_categoria`, `c`.`nombre` AS `categoria`, count(distinct `p`.`id_producto`) AS `total_productos`, avg(`p`.`precio_venta`) AS `precio_promedio`, avg(coalesce(`i`.`costo_promedio`,0)) AS `costo_promedio`, avg(`p`.`precio_venta` - coalesce(`i`.`costo_promedio`,0)) AS `utilidad_promedio`, avg((`p`.`precio_venta` - coalesce(`i`.`costo_promedio`,0)) / nullif(`p`.`precio_venta`,0) * 100) AS `margen_promedio`, coalesce(sum(`dv`.`cantidad` * `dv`.`precio_unitario`),0) AS `ventas_totales`, coalesce(sum(`dv`.`cantidad` * (`dv`.`precio_unitario` - coalesce(`i`.`costo_promedio`,0))),0) AS `utilidad_total` FROM (((`categorias` `c` left join `productos` `p` on(`c`.`id_categoria` = `p`.`id_categoria`)) left join `inventario` `i` on(`p`.`id_producto` = `i`.`id_producto`)) left join `detalleventa` `dv` on(`p`.`id_producto` = `dv`.`id_producto`)) GROUP BY `c`.`id_categoria`, `c`.`nombre` ;

-- --------------------------------------------------------

--
-- Estructura para la vista `vista_rotacion_inventario`
--
DROP TABLE IF EXISTS `vista_rotacion_inventario`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `vista_rotacion_inventario`  AS SELECT `p`.`id_producto` AS `id_producto`, `p`.`nombre` AS `nombre`, `p`.`marca` AS `marca`, `c`.`nombre` AS `categoria`, coalesce(sum(`i`.`cantidad`),0) AS `stock_actual`, coalesce(sum(case when `v`.`fecha_hora` >= curdate() - interval 1 month then `dv`.`cantidad` else 0 end),0) AS `unidades_vendidas_ultimo_mes`, CASE WHEN coalesce(sum(`i`.`cantidad`),0) > 0 THEN coalesce(sum(case when `v`.`fecha_hora` >= curdate() - interval 1 month then `dv`.`cantidad` else 0 end),0) / sum(`i`.`cantidad`) ELSE 0 END AS `indice_rotacion` FROM ((((`productos` `p` left join `categorias` `c` on(`p`.`id_categoria` = `c`.`id_categoria`)) left join `inventario` `i` on(`p`.`id_producto` = `i`.`id_producto`)) left join `detalleventa` `dv` on(`p`.`id_producto` = `dv`.`id_producto`)) left join `ventas` `v` on(`dv`.`id_venta` = `v`.`id_venta`)) GROUP BY `p`.`id_producto`, `p`.`nombre`, `p`.`marca`, `c`.`nombre` ;

-- --------------------------------------------------------

--
-- Estructura para la vista `vista_utilidad_productos`
--
DROP TABLE IF EXISTS `vista_utilidad_productos`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `vista_utilidad_productos`  AS SELECT `p`.`id_producto` AS `id_producto`, `p`.`nombre` AS `nombre`, `p`.`marca` AS `marca`, coalesce(`c`.`nombre`,'Sin categoría') AS `categoria`, `p`.`precio_venta` AS `precio_venta`, coalesce((select avg(`inventario`.`costo_promedio`) from `inventario` where `inventario`.`id_producto` = `p`.`id_producto` and `inventario`.`costo_promedio` > 0),0) AS `costo_promedio`, `p`.`precio_venta`- coalesce((select avg(`inventario`.`costo_promedio`) from `inventario` where `inventario`.`id_producto` = `p`.`id_producto` and `inventario`.`costo_promedio` > 0),0) AS `utilidad_unitaria`, CASE WHEN `p`.`precio_venta` > 0 THEN (`p`.`precio_venta` - coalesce((select avg(`inventario`.`costo_promedio`) from `inventario` where `inventario`.`id_producto` = `p`.`id_producto` and `inventario`.`costo_promedio` > 0),0)) / `p`.`precio_venta` * 100 ELSE 0 END AS `margen_ganancia`, coalesce((select sum(`inventario`.`cantidad`) from `inventario` where `inventario`.`id_producto` = `p`.`id_producto`),0) AS `stock_total`, coalesce((select sum(`detalleventa`.`cantidad`) from `detalleventa` where `detalleventa`.`id_producto` = `p`.`id_producto`),0) AS `unidades_vendidas`, coalesce((select sum(`detalleventa`.`cantidad` * `detalleventa`.`precio_unitario`) from `detalleventa` where `detalleventa`.`id_producto` = `p`.`id_producto`),0) AS `total_ventas`, coalesce((select sum(`dv2`.`cantidad` * `dv2`.`precio_unitario`) - sum(`dv2`.`cantidad` * coalesce((select avg(`inventario`.`costo_promedio`) from `inventario` where `inventario`.`id_producto` = `p`.`id_producto` and `inventario`.`costo_promedio` > 0),0)) from `detalleventa` `dv2` where `dv2`.`id_producto` = `p`.`id_producto`),0) AS `utilidad_total` FROM (`productos` `p` left join `categorias` `c` on(`p`.`id_categoria` = `c`.`id_categoria`)) ;

-- --------------------------------------------------------

--
-- Estructura para la vista `vista_ventas_temporada`
--
DROP TABLE IF EXISTS `vista_ventas_temporada`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `vista_ventas_temporada`  AS SELECT year(`v`.`fecha_hora`) AS `anio`, month(`v`.`fecha_hora`) AS `mes`, quarter(`v`.`fecha_hora`) AS `trimestre`, date_format(`v`.`fecha_hora`,'%Y-%m') AS `periodo`, count(distinct `v`.`id_venta`) AS `total_ventas`, sum(`v`.`total_venta`) AS `ingreso_total`, avg(`v`.`total_venta`) AS `promedio_venta`, coalesce(sum(`dv`.`cantidad`),0) AS `unidades_vendidas`, count(distinct `v`.`id_cliente`) AS `clientes_atendidos` FROM (`ventas` `v` left join `detalleventa` `dv` on(`v`.`id_venta` = `dv`.`id_venta`)) GROUP BY year(`v`.`fecha_hora`), month(`v`.`fecha_hora`), quarter(`v`.`fecha_hora`), date_format(`v`.`fecha_hora`,'%Y-%m') ;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `categorias`
--
ALTER TABLE `categorias`
  ADD PRIMARY KEY (`id_categoria`),
  ADD UNIQUE KEY `nombre` (`nombre`);

--
-- Indices de la tabla `clientes`
--
ALTER TABLE `clientes`
  ADD PRIMARY KEY (`id_cliente`),
  ADD UNIQUE KEY `cedula` (`cedula`);

--
-- Indices de la tabla `compras`
--
ALTER TABLE `compras`
  ADD PRIMARY KEY (`id_compra`),
  ADD KEY `id_proveedor` (`id_proveedor`);

--
-- Indices de la tabla `conciliacion_bancaria`
--
ALTER TABLE `conciliacion_bancaria`
  ADD PRIMARY KEY (`id_conciliacion`),
  ADD KEY `id_usuario` (`id_usuario`);

--
-- Indices de la tabla `configuracion`
--
ALTER TABLE `configuracion`
  ADD PRIMARY KEY (`id_config`),
  ADD UNIQUE KEY `clave` (`clave`);

--
-- Indices de la tabla `cuentas_por_pagar`
--
ALTER TABLE `cuentas_por_pagar`
  ADD PRIMARY KEY (`id_cuenta`),
  ADD KEY `id_proveedor` (`id_proveedor`),
  ADD KEY `id_compra` (`id_compra`);

--
-- Indices de la tabla `detallecompra`
--
ALTER TABLE `detallecompra`
  ADD PRIMARY KEY (`id_detalle`),
  ADD KEY `id_compra` (`id_compra`),
  ADD KEY `id_producto` (`id_producto`);

--
-- Indices de la tabla `detalleventa`
--
ALTER TABLE `detalleventa`
  ADD PRIMARY KEY (`id_detalle`),
  ADD KEY `id_venta` (`id_venta`),
  ADD KEY `id_producto` (`id_producto`),
  ADD KEY `id_talla` (`id_talla`);

--
-- Indices de la tabla `devoluciones`
--
ALTER TABLE `devoluciones`
  ADD PRIMARY KEY (`id_devolucion`),
  ADD KEY `id_detalle` (`id_detalle`);

--
-- Indices de la tabla `inventario`
--
ALTER TABLE `inventario`
  ADD PRIMARY KEY (`id_inventario`),
  ADD UNIQUE KEY `uk_inventario` (`id_producto`,`id_talla`),
  ADD KEY `id_talla` (`id_talla`);

--
-- Indices de la tabla `movimientoscaja`
--
ALTER TABLE `movimientoscaja`
  ADD PRIMARY KEY (`id_movimiento`),
  ADD KEY `id_usuario` (`id_usuario`),
  ADD KEY `id_devolucion` (`id_devolucion`);

--
-- Indices de la tabla `movimientos_bancarios`
--
ALTER TABLE `movimientos_bancarios`
  ADD PRIMARY KEY (`id_movimiento_bancario`),
  ADD KEY `id_conciliacion` (`id_conciliacion`);

--
-- Indices de la tabla `pagos_proveedores`
--
ALTER TABLE `pagos_proveedores`
  ADD PRIMARY KEY (`id_pago`),
  ADD KEY `id_cuenta` (`id_cuenta`),
  ADD KEY `id_usuario` (`id_usuario`);

--
-- Indices de la tabla `productos`
--
ALTER TABLE `productos`
  ADD PRIMARY KEY (`id_producto`),
  ADD KEY `id_categoria` (`id_categoria`),
  ADD KEY `id_proveedor` (`id_proveedor`);

--
-- Indices de la tabla `promociones`
--
ALTER TABLE `promociones`
  ADD PRIMARY KEY (`id_promocion`),
  ADD KEY `id_categoria` (`id_categoria`),
  ADD KEY `id_producto` (`id_producto`);

--
-- Indices de la tabla `proveedores`
--
ALTER TABLE `proveedores`
  ADD PRIMARY KEY (`id_proveedor`);

--
-- Indices de la tabla `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`id_rol`),
  ADD UNIQUE KEY `nombre_rol` (`nombre_rol`);

--
-- Indices de la tabla `tallas`
--
ALTER TABLE `tallas`
  ADD PRIMARY KEY (`id_talla`),
  ADD UNIQUE KEY `nombre` (`nombre`);

--
-- Indices de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`id_usuario`),
  ADD UNIQUE KEY `usuario` (`usuario`),
  ADD KEY `id_rol` (`id_rol`);

--
-- Indices de la tabla `ventas`
--
ALTER TABLE `ventas`
  ADD PRIMARY KEY (`id_venta`),
  ADD KEY `id_usuario` (`id_usuario`),
  ADD KEY `id_cliente` (`id_cliente`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `categorias`
--
ALTER TABLE `categorias`
  MODIFY `id_categoria` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=30;

--
-- AUTO_INCREMENT de la tabla `clientes`
--
ALTER TABLE `clientes`
  MODIFY `id_cliente` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT de la tabla `compras`
--
ALTER TABLE `compras`
  MODIFY `id_compra` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT de la tabla `conciliacion_bancaria`
--
ALTER TABLE `conciliacion_bancaria`
  MODIFY `id_conciliacion` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `configuracion`
--
ALTER TABLE `configuracion`
  MODIFY `id_config` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT de la tabla `cuentas_por_pagar`
--
ALTER TABLE `cuentas_por_pagar`
  MODIFY `id_cuenta` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `detallecompra`
--
ALTER TABLE `detallecompra`
  MODIFY `id_detalle` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT de la tabla `detalleventa`
--
ALTER TABLE `detalleventa`
  MODIFY `id_detalle` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `devoluciones`
--
ALTER TABLE `devoluciones`
  MODIFY `id_devolucion` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `inventario`
--
ALTER TABLE `inventario`
  MODIFY `id_inventario` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=37;

--
-- AUTO_INCREMENT de la tabla `movimientoscaja`
--
ALTER TABLE `movimientoscaja`
  MODIFY `id_movimiento` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `movimientos_bancarios`
--
ALTER TABLE `movimientos_bancarios`
  MODIFY `id_movimiento_bancario` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `pagos_proveedores`
--
ALTER TABLE `pagos_proveedores`
  MODIFY `id_pago` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `productos`
--
ALTER TABLE `productos`
  MODIFY `id_producto` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT de la tabla `promociones`
--
ALTER TABLE `promociones`
  MODIFY `id_promocion` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `proveedores`
--
ALTER TABLE `proveedores`
  MODIFY `id_proveedor` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT de la tabla `roles`
--
ALTER TABLE `roles`
  MODIFY `id_rol` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT de la tabla `tallas`
--
ALTER TABLE `tallas`
  MODIFY `id_talla` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `id_usuario` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `ventas`
--
ALTER TABLE `ventas`
  MODIFY `id_venta` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=32;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `compras`
--
ALTER TABLE `compras`
  ADD CONSTRAINT `compras_ibfk_1` FOREIGN KEY (`id_proveedor`) REFERENCES `proveedores` (`id_proveedor`);

--
-- Filtros para la tabla `conciliacion_bancaria`
--
ALTER TABLE `conciliacion_bancaria`
  ADD CONSTRAINT `conciliacion_bancaria_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`);

--
-- Filtros para la tabla `cuentas_por_pagar`
--
ALTER TABLE `cuentas_por_pagar`
  ADD CONSTRAINT `cuentas_por_pagar_ibfk_1` FOREIGN KEY (`id_proveedor`) REFERENCES `proveedores` (`id_proveedor`),
  ADD CONSTRAINT `cuentas_por_pagar_ibfk_2` FOREIGN KEY (`id_compra`) REFERENCES `compras` (`id_compra`) ON DELETE SET NULL;

--
-- Filtros para la tabla `detallecompra`
--
ALTER TABLE `detallecompra`
  ADD CONSTRAINT `detallecompra_ibfk_1` FOREIGN KEY (`id_compra`) REFERENCES `compras` (`id_compra`),
  ADD CONSTRAINT `detallecompra_ibfk_2` FOREIGN KEY (`id_producto`) REFERENCES `productos` (`id_producto`);

--
-- Filtros para la tabla `detalleventa`
--
ALTER TABLE `detalleventa`
  ADD CONSTRAINT `detalleventa_ibfk_1` FOREIGN KEY (`id_venta`) REFERENCES `ventas` (`id_venta`),
  ADD CONSTRAINT `detalleventa_ibfk_2` FOREIGN KEY (`id_producto`) REFERENCES `productos` (`id_producto`),
  ADD CONSTRAINT `detalleventa_ibfk_3` FOREIGN KEY (`id_talla`) REFERENCES `tallas` (`id_talla`);

--
-- Filtros para la tabla `devoluciones`
--
ALTER TABLE `devoluciones`
  ADD CONSTRAINT `devoluciones_ibfk_1` FOREIGN KEY (`id_detalle`) REFERENCES `detalleventa` (`id_detalle`);

--
-- Filtros para la tabla `inventario`
--
ALTER TABLE `inventario`
  ADD CONSTRAINT `inventario_ibfk_1` FOREIGN KEY (`id_producto`) REFERENCES `productos` (`id_producto`),
  ADD CONSTRAINT `inventario_ibfk_2` FOREIGN KEY (`id_talla`) REFERENCES `tallas` (`id_talla`);

--
-- Filtros para la tabla `movimientoscaja`
--
ALTER TABLE `movimientoscaja`
  ADD CONSTRAINT `movimientoscaja_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`),
  ADD CONSTRAINT `movimientoscaja_ibfk_2` FOREIGN KEY (`id_devolucion`) REFERENCES `devoluciones` (`id_devolucion`) ON DELETE SET NULL;

--
-- Filtros para la tabla `movimientos_bancarios`
--
ALTER TABLE `movimientos_bancarios`
  ADD CONSTRAINT `movimientos_bancarios_ibfk_1` FOREIGN KEY (`id_conciliacion`) REFERENCES `conciliacion_bancaria` (`id_conciliacion`) ON DELETE SET NULL;

--
-- Filtros para la tabla `pagos_proveedores`
--
ALTER TABLE `pagos_proveedores`
  ADD CONSTRAINT `pagos_proveedores_ibfk_1` FOREIGN KEY (`id_cuenta`) REFERENCES `cuentas_por_pagar` (`id_cuenta`),
  ADD CONSTRAINT `pagos_proveedores_ibfk_2` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`);

--
-- Filtros para la tabla `productos`
--
ALTER TABLE `productos`
  ADD CONSTRAINT `productos_ibfk_1` FOREIGN KEY (`id_categoria`) REFERENCES `categorias` (`id_categoria`),
  ADD CONSTRAINT `productos_ibfk_2` FOREIGN KEY (`id_proveedor`) REFERENCES `proveedores` (`id_proveedor`);

--
-- Filtros para la tabla `promociones`
--
ALTER TABLE `promociones`
  ADD CONSTRAINT `promociones_ibfk_1` FOREIGN KEY (`id_categoria`) REFERENCES `categorias` (`id_categoria`) ON DELETE SET NULL,
  ADD CONSTRAINT `promociones_ibfk_2` FOREIGN KEY (`id_producto`) REFERENCES `productos` (`id_producto`) ON DELETE SET NULL;

--
-- Filtros para la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD CONSTRAINT `usuarios_ibfk_1` FOREIGN KEY (`id_rol`) REFERENCES `roles` (`id_rol`);

--
-- Filtros para la tabla `ventas`
--
ALTER TABLE `ventas`
  ADD CONSTRAINT `ventas_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`),
  ADD CONSTRAINT `ventas_ibfk_2` FOREIGN KEY (`id_cliente`) REFERENCES `clientes` (`id_cliente`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

-- -------------------------------------------------------------------------
-- Extensiones para soporte de promociones avanzadas y trazabilidad
-- Estas sentencias añaden columnas opcionales para COMPRA_X_LLEVA_Y
-- y columnas en detalleventa para registrar la promoción aplicada y los descuentos.
-- Ejecuta estas sentencias en phpMyAdmin si deseas activar estas funciones.
-- HAZ BACKUP antes de ejecutar.
-- -------------------------------------------------------------------------

-- 1) Añadir columnas param_x/param_y a promociones (si no existen)
ALTER TABLE promociones
  ADD COLUMN IF NOT EXISTS param_x INT NULL,
  ADD COLUMN IF NOT EXISTS param_y INT NULL;

-- 2) Añadir columnas de trazabilidad en detalleventa (si la tabla existe)
ALTER TABLE detalleventa
  ADD COLUMN IF NOT EXISTS id_promocion_aplicada INT NULL,
  ADD COLUMN IF NOT EXISTS descuento_unitario DECIMAL(12,2) NULL,
  ADD COLUMN IF NOT EXISTS descuento_total DECIMAL(12,2) NULL;

-- 3) Índice y FK opcionales para detalleventa.id_promocion_aplicada
CREATE INDEX IF NOT EXISTS idx_detalleventa_promocion ON detalleventa (id_promocion_aplicada);

-- Nota: algunas versiones de MariaDB/MySQL no soportan IF NOT EXISTS en ADD CONSTRAINT.
-- Si la instrucción siguiente falla, revisa previamente si la FK ya existe mediante:
-- SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
-- WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'detalleventa' AND CONSTRAINT_TYPE = 'FOREIGN KEY';
ALTER TABLE detalleventa
  ADD CONSTRAINT IF NOT EXISTS fk_detalleventa_promocion
  FOREIGN KEY (id_promocion_aplicada) REFERENCES promociones(id_promocion)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 4) Índices útiles en promociones
ALTER TABLE promociones
  ADD INDEX IF NOT EXISTS idx_promociones_activa (activa),
  ADD INDEX IF NOT EXISTS idx_promociones_fecha (fecha_inicio, fecha_fin);

-- Fin de las extensiones para promociones avanzadas

-- -------------------------------------------------------------------------
-- Opcional: agregar columna producto_nombre en detalleventa y trigger
-- Esto es útil para mantener el nombre del producto en el detalle en el momento
-- de la venta (histórico), evitando joins costosos en reportes.
-- Ejecuta sólo si quieres esta copia denormalizada.
-- -------------------------------------------------------------------------

ALTER TABLE detalleventa
  ADD COLUMN IF NOT EXISTS producto_nombre VARCHAR(255) NULL;

-- Crear trigger para rellenar producto_nombre al insertar en detalleventa
-- Nota: requiere privilegios para crear triggers. Si tu servidor no permite
-- DELIMITER en este contexto, ejecuta las siguientes líneas directamente
-- desde un cliente MySQL (phpMyAdmin o CLI).

-- START TRIGGER (ejecutar en cliente que soporte delimitadores)
-- DELIMITER $$
-- CREATE TRIGGER trg_detalleventa_before_insert
-- BEFORE INSERT ON detalleventa
-- FOR EACH ROW
-- BEGIN
--   IF NEW.producto_nombre IS NULL OR NEW.producto_nombre = '' THEN
--     DECLARE _nombre VARCHAR(255);
--     SELECT nombre INTO _nombre FROM productos WHERE id_producto = NEW.id_producto LIMIT 1;
--     SET NEW.producto_nombre = _nombre;
--   END IF;
-- END$$
-- DELIMITER ;
-- END TRIGGER

-- -------------------------------------------------------------------------
-- Ejemplos de datos de prueba (usar sólo en entorno de pruebas)
-- -------------------------------------------------------------------------
-- 1) Promoción 10% global válida 30 días
-- INSERT INTO promociones (nombre, descripcion, tipo_promocion, valor, fecha_inicio, fecha_fin, activa, id_categoria, id_producto, minimo_compra, param_x, param_y)
-- VALUES ('Test 10% Global', 'Descuento 10% para pruebas', 'DESCUENTO_PORCENTAJE', 10, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), 1, NULL, NULL, 0, NULL, NULL);

-- 2) Promoción Compra 2 Lleva 1 para producto ejemplo (reemplaza 23 por id real)
-- INSERT INTO promociones (nombre, descripcion, tipo_promocion, valor, fecha_inicio, fecha_fin, activa, id_categoria, id_producto, minimo_compra, param_x, param_y)
-- VALUES ('Compra 2 Lleva 1 Test', 'Compra 2 y llévate 1 gratis en producto 23', 'COMPRA_X_LLEVA_Y', 0, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), 1, NULL, 23, 0, 2, 1);

-- 3) Ejemplo manual de venta y detalle (solo para pruebas manuales):
-- INSERT INTO ventas (fecha_hora, total_venta, tipo_pago, id_usuario, id_cliente) VALUES (NOW(), 100.00, 'Efectivo', 1, NULL);
-- -- Reemplaza 999 por el id_venta generado
-- INSERT INTO detalleventa (id_venta, id_producto, id_talla, cantidad, precio_unitario, id_promocion_aplicada, descuento_unitario, descuento_total, producto_nombre)
-- VALUES (999, 23, NULL, 3, 10.00, 1, 1.00, 3.00, 'Nombre producto 23');

-- -------------------------------------------------------------------------
-- Notas de ejecución segura:
-- 1) Haz backup antes de aplicar: mysqldump -u <user> -p <db> > backup.sql
-- 2) Revisa columnas existentes:
--    SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'detalleventa';
-- 3) Ejecuta ALTERs uno a uno si tu servidor no soporta IF NOT EXISTS.
-- 4) Para crear el trigger, usa un cliente que soporte delimitadores (phpMyAdmin o CLI).
-- -------------------------------------------------------------------------
