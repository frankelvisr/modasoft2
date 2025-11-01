<?php
// api/status.php
// Devuelve JSON con el estado de la conexión a la base de datos
header('Content-Type: application/json; charset=utf-8');

// Configuración: ajusta según tu entorno XAMPP
$dbHost = '127.0.0.1';
$dbName = 'modasoft_db';
$dbUser = 'root';
$dbPass = ''; // Si tu XAMPP tiene contraseña, ponla aquí
$dbPort = 3306;

$result = [
    'ok' => false,
    'php_extensions' => get_loaded_extensions(),
    'attempts' => []
];

// Intento con PDO (127.0.0.1)
$dsn = "mysql:host=$dbHost;port=$dbPort;dbname=$dbName;charset=utf8mb4";
try {
    $pdo = new PDO($dsn, $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $result['attempts'][] = ['method' => 'pdo', 'host' => $dbHost, 'status' => 'ok'];
    $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM Productos LIMIT 1");
    $row = $stmt->fetch();
    $result['products_count'] = $row ? intval($row['cnt']) : 0;
    $result['ok'] = true;
    echo json_encode($result);
    exit;
} catch (PDOException $e) {
    $result['attempts'][] = ['method' => 'pdo', 'host' => $dbHost, 'status' => 'error', 'error' => $e->getMessage()];
}

// Intento con mysqli
try {
    if (!function_exists('mysqli_connect')) {
        $result['attempts'][] = ['method' => 'mysqli', 'status' => 'not_available'];
    } else {
        $mysqli = mysqli_connect($dbHost, $dbUser, $dbPass, $dbName, $dbPort);
        if ($mysqli) {
            $result['attempts'][] = ['method' => 'mysqli', 'status' => 'ok'];
            $res = mysqli_query($mysqli, "SELECT COUNT(*) as cnt FROM Productos LIMIT 1");
            if ($res) {
                $row = mysqli_fetch_assoc($res);
                $result['products_count'] = intval($row['cnt']);
                $result['ok'] = true;
                echo json_encode($result);
                exit;
            }
        } else {
            $result['attempts'][] = ['method' => 'mysqli', 'status' => 'error', 'error' => mysqli_connect_error()];
        }
    }
} catch (Exception $e) {
    $result['attempts'][] = ['method' => 'mysqli', 'status' => 'error', 'error' => $e->getMessage()];
}

// Si llegamos aquí, no conectamos
http_response_code(500);
echo json_encode($result);

