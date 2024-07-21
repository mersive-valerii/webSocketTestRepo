const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const https = require('https');
const FormData = require('form-data');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
    },
});

io.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('uploadLicense', async (data) => {
        const { podIp, podPassword, LICENSE_pkg, fileName } = data;

        try {
            const url = `https://${podIp}/Config/service/uploadLicense`;

            const formData = new FormData();
            formData.append('LICENSE_pkg', LICENSE_pkg, fileName);

            const response = await axios.post(url, formData, {
                headers: {
                    ...formData.getHeaders(),
                },
                auth: {
                    username: 'admin',
                    password: podPassword,
                },
                httpsAgent: new https.Agent({ rejectUnauthorized: false }),
                timeout: 10000, // Set timeout to 10000ms or 10 seconds
            });

            const responseData = response.data;

            if (responseData.passwordRequired === true) {
                socket.emit('response', { message: "Please provide a password", status: 409 });
                return;
            }

            socket.emit('response', { data: responseData, status: 200 });
        } catch (error) {
            let errorMessage = "socket hangs up";
            let statusCode = 500;

            if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
                errorMessage = "Request timeout";
                statusCode = 408;
            } else if (error.message && error.message.startsWith("connect ENETUNREACH")) {
                errorMessage = "Cannot connect";
                statusCode = 400;
            }

            socket.emit('response', { message: errorMessage, status: statusCode });
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

server.listen(8080, () => {
    console.log('Socket.io server is running on port 8080');
});

// HTTP health check server
const healthServer = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Not found' }));
    }
});

healthServer.listen(8081, () => {
    console.log('Health check server is running on port 8081');
});
