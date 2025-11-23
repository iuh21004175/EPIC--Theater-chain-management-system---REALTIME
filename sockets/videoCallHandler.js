// Socket.IO handler cho gọi video 1:1
const axios = require('axios');

module.exports = function(socket, redis) {
    // Namespace riêng cho video call

        console.log('📹 Client kết nối video namespace:', socket.id);

        // Client muốn tham gia room
        socket.on('join-room', async (data) => {
            const { roomId, userId, userType } = data;

            console.log(`🔐 Kiểm tra quyền tham gia room: ${roomId}, User: ${userId}, Type: ${userType}`);

            try {
                // Kiểm tra quyền từ Redis
                const roomData = await redis.get(`videoroom:${roomId}`);
                
                if (!roomData) {
                    socket.emit('join-error', { message: 'Room không tồn tại hoặc đã hết hạn' });
                    return;
                }

                const roomInfo = JSON.parse(roomData);

                // Kiểm tra quyền dựa vào user type
                let allowed = false;
                let reason = '';

                if (userType === 'customer') {
                    // Khách hàng: phải đúng khách hàng đặt lịch
                    if (userId == roomInfo.id_khachhang) {
                        allowed = true;
                    } else {
                        reason = 'Bạn không có quyền tham gia cuộc gọi này';
                    }
                } else if (userType === 'staff') {
                    // Nhân viên: phải đúng nhân viên được chọn
                    if (userId == roomInfo.id_nhanvien) {
                        allowed = true;
                    } else {
                        reason = 'Cuộc gọi này đã được nhân viên khác nhận';
                    }
                } else {
                    reason = 'Loại người dùng không hợp lệ';
                }

                if (!allowed) {
                    socket.emit('join-error', { message: reason });
                    return;
                }

                // Cho phép tham gia room
                socket.join(roomId);
                socket.roomId = roomId;
                socket.userId = userId;
                socket.userType = userType;

                // Kiểm tra xem đã có socket cũ của user này chưa
                const existingSocketId = await redis.hget(`videoroom:${roomId}:sockets`, userType);
                if (existingSocketId && existingSocketId !== socket.id) {
                    // Có socket cũ → Disconnect socket cũ trước
                    const oldSocket = videoNamespace.sockets.get(existingSocketId);
                    if (oldSocket) {
                        console.log(`⚠️ User ${userId} (${userType}) đã có kết nối cũ ${existingSocketId}, disconnect socket cũ...`);
                        oldSocket.emit('force-disconnect', {
                            message: 'Bạn đã đăng nhập từ thiết bị khác'
                        });
                        oldSocket.disconnect(true);
                    }
                }

                // Lưu socket ID MỚI vào Redis
                await redis.hset(`videoroom:${roomId}:sockets`, userType, socket.id);

                // Thông báo cho người còn lại trong room
                socket.to(roomId).emit('user-joined', {
                    userId: userId,
                    userType: userType,
                    socketId: socket.id
                });

                // Gửi thông tin về những người đang trong room
                const sockets = await redis.hgetall(`videoroom:${roomId}:sockets`);
                socket.emit('room-joined', {
                    roomId: roomId,
                    participants: sockets
                });

                console.log(`✅ User ${userId} (${userType}) đã tham gia room ${roomId}`);

                // Cập nhật trạng thái cuộc gọi nếu cả 2 đã vào
                const participantCount = Object.keys(sockets).length;
                if (participantCount >= 2) {
                    // Gọi API để cập nhật trạng thái đang gọi
                    try {
                        const apiUrl = `${process.env.URL_API}/goi-video/bat-dau`;
                        console.log('🔄 Đang gọi API cập nhật trạng thái:', apiUrl);
                        const response = await axios.post(apiUrl, {
                            room_id: roomId
                        });
                        console.log('✅ API bat-dau response:', response.data);
                    } catch (err) {
                        console.error('❌ Lỗi gọi API bat-dau:', err.message);
                        if (err.response) {
                            console.error('Response status:', err.response.status);
                            console.error('Response data:', err.response.data);
                        }
                    }
                }

            } catch (error) {
                console.error('Lỗi khi join room:', error);
                socket.emit('join-error', { message: 'Đã xảy ra lỗi' });
            }
        });

        // WebRTC signaling: offer
        socket.on('offer', (data) => {
            const { roomId, offer } = data;
            console.log(`📤 Offer từ ${socket.userType} trong room ${roomId}`);
            socket.to(roomId).emit('offer', {
                offer: offer,
                from: socket.userType
            });
        });

        // WebRTC signaling: answer
        socket.on('answer', (data) => {
            const { roomId, answer } = data;
            console.log(`📥 Answer từ ${socket.userType} trong room ${roomId}`);
            socket.to(roomId).emit('answer', {
                answer: answer,
                from: socket.userType
            });
        });

        // WebRTC signaling: ICE candidate
        socket.on('ice-candidate', (data) => {
            const { roomId, candidate } = data;
            console.log(`🧊 ICE candidate từ ${socket.userType} trong room ${roomId}:`, candidate.type);
            socket.to(roomId).emit('ice-candidate', {
                candidate: candidate,
                from: socket.userType
            });
        });



        // Client chủ động rời phòng
        socket.on('leave-room', async () => {
            if (socket.roomId) {
                const roomId = socket.roomId;
                
                socket.leave(roomId);
                
                // Xóa socket khỏi Redis
                await redis.hdel(`videoroom:${roomId}:sockets`, socket.userType);

                // Thông báo cho người còn lại
                socket.to(roomId).emit('user-left', {
                    userId: socket.userId,
                    userType: socket.userType
                });

                console.log(`👋 User ${socket.userId} đã rời room ${roomId}`);
            }
        });
    }