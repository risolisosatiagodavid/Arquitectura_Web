import * as http from 'node:http';

const PORT = 8080;

const server = http.createServer((req, res) => {
    const { method, url } = req;

    // Manejo de la ruta GET /
    if (method === 'GET' && url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Servidor HTTP funcionando correctamente.\n');
        return;
    }

    // Manejo de la ruta POST /archivo
    if (method === 'POST' && url === '/archivo') {
        let totalBytes = 0;  //Variable para contar los bytes

        // Procesamiento del payload mediante streams
        req.on('data', (chunk) => {
            totalBytes += chunk.length;
        });

        // Respuesta una vez finalizada la recepción del stream
        req.on('end', () => {
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`Bytes recibidos: ${totalBytes}\n`);
        });

        req.on('error', (err) => {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Error al procesar el archivo.\n');
        });
        return;
    }

    // Cualquier otra ruta o método responde 404
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found\n');
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});