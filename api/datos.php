<?php
// api/datos.php
// Devuelve filas de la tabla Productos en JSON
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Responder a preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Configuración: ajusta según tu entorno XAMPP
$dbHost = '127.0.0.1';
$dbName = 'modasoft_db';
$dbUser = 'root';
$dbPass = ''; // Si tu XAMPP tiene contraseña, ponla aquí
$dbPort = 3306;

$dsn = "mysql:host=$dbHost;port=$dbPort;dbname=$dbName;charset=utf8mb4";

try {
    $pdo = new PDO($dsn, $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    // Permite seleccionar la tabla a consultar
    $tabla = isset($_GET['tabla']) ? $_GET['tabla'] : 'productos';

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $tabla === 'tallas') {
        // Recibe datos en JSON
        $input = json_decode(file_get_contents('php://input'), true);
        $nombre = isset($input['nombre']) ? trim($input['nombre']) : '';
        if (!$nombre || strlen($nombre) > 10) {
            echo json_encode(["ok" => false, "error" => "Nombre de talla inválido o muy largo."]);
            exit;
        }
        try {
            $stmt = $pdo->prepare("INSERT INTO Tallas (nombre) VALUES (?)");
            $stmt->execute([$nombre]);
            echo json_encode(["ok" => true]);
        } catch (PDOException $e) {
            echo json_encode(["ok" => false, "error" => $e->getMessage()]);
        }
        exit;
    }

    if ($tabla === 'tallas') {
        $stmt = $pdo->query("SELECT id_talla, nombre FROM Tallas ORDER BY id_talla DESC");
        $rows = $stmt->fetchAll();
        echo json_encode(["ok" => true, "tallas" => $rows]);
    } else {
        $stmt = $pdo->query("SELECT id_producto, nombre, descripcion, precio_venta FROM Productos LIMIT 50");
        $rows = $stmt->fetchAll();
        echo json_encode(["ok" => true, "rows" => $rows]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["ok" => false, "error" => $e->getMessage()]);
}

