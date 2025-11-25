// Set timezone ngay đầu file, trước khi require bất cứ thứ gì khác
require('dotenv').config();
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const port = 3000;

const io = new Server(http, {
  cors: {
    origin: process.env.URL_WEB, // Cho phép tất cả origin (chỉ dùng để test, không nên dùng production)
    methods: ["GET", "POST"],
    credentials: true
  }
});
const { redis, subscriber } = require('./config/redisClient');
require('./sockets/socketHandler')(io, redis);
require('./services/redisHandler')(subscriber, io, redis);
require('./services/redisSub')(subscriber);

http.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
