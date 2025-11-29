// Socket.IO handler cho gọi video 1:1
const axios = require('axios');

module.exports = function(socket, redis) {
    // Namespace riêng cho video call

        console.log('📹 Client kết nối video namespace:', socket.id);

        // Client muốn tham gia room
        socket.on('join-room', async (data) => {
            // Validate input
            if (!data) {
                socket.emit('join-error', { message: 'Dữ liệu không hợp lệ' });
                return;
            }

            const { roomId, userId, userType } = data;

            if (!roomId || !userId || !userType) {
                socket.emit('join-error', { message: 'Thiếu thông tin bắt buộc' });
                return;
            }

            if (!['customer', 'staff'].includes(userType)) {
                socket.emit('join-error', { message: 'userType không hợp lệ' });
                return;
            }

            console.log(`🔐 Kiểm tra quyền tham gia room: ${roomId}, User: ${userId}, Type: ${userType}`);

            try {
                // Kiểm tra quyền từ Redis
                let roomData = await redis.get(`videoroom:${roomId}`);
                
                if (!roomData) {
                    // ============================================
                    // ROOM CHƯA TỒN TẠI → TẠO MỚI
                    // ============================================
                    console.log(`⚠️ Room ${roomId} chưa tồn tại, tạo room mới...`);
                    
                    // Tạo room data mặc định
                    const newRoomInfo = {
                        room_id: roomId,
                        id_khachhang: userType === 'customer' ? userId : null,
                        id_nhanvien: userType === 'staff' ? userId : null,
                        created_at: new Date().toISOString(),
                        created_by: userType
                    };

                    // Lưu vào Redis với TTL 1 giờ (3600 giây)
                    await redis.setex(
                        `videoroom:${roomId}`, 
                        3600, 
                        JSON.stringify(newRoomInfo)
                    );

                    console.log(`✅ Đã tạo room ${roomId} cho ${userType}`);
                    roomData = JSON.stringify(newRoomInfo);
                }

                const roomInfo = JSON.parse(roomData);

                // ============================================
                // Kiểm tra quyền truy cập
                // ============================================
                let allowed = false;
                let reason = '';

                if (userType === 'customer') {
                    // Nếu chưa có customer trong room → cho phép
                    if (!roomInfo.id_khachhang || roomInfo.id_khachhang == userId) {
                        allowed = true;
                        // Cập nhật customer ID nếu chưa có
                        if (!roomInfo.id_khachhang) {
                            roomInfo.id_khachhang = userId;
                            await redis.setex(
                                `videoroom:${roomId}`, 
                                3600, 
                                JSON.stringify(roomInfo)
                            );
                        }
                    } else {
                        reason = 'Bạn không có quyền tham gia cuộc gọi này';
                    }
                } else if (userType === 'staff') {
                    // Nếu chưa có staff trong room → cho phép
                    if (!roomInfo.id_nhanvien || roomInfo.id_nhanvien == userId) {
                        allowed = true;
                        // Cập nhật staff ID nếu chưa có
                        if (!roomInfo.id_nhanvien) {
                            roomInfo.id_nhanvien = userId;
                            await redis.setex(
                                `videoroom:${roomId}`, 
                                3600, 
                                JSON.stringify(roomInfo)
                            );
                        }
                    } else {
                        reason = 'Cuộc gọi này đã được nhân viên khác nhận';
                    }
                }

                if (!allowed) {
                    socket.emit('join-error', { message: reason });
                    return;
                }

                // ============================================
                // Cho phép tham gia room
                // ============================================
                socket.join(roomId);
                socket.roomId = roomId;
                socket.userId = userId;
                socket.userType = userType;

                // Kiểm tra xem đã có socket cũ của user này chưa
                const existingSocketId = await redis.hget(`videoroom:${roomId}:sockets`, userType);
                if (existingSocketId && existingSocketId !== socket.id) {
                    const oldSocket = socket.server.sockets.sockets.get(existingSocketId);
                    if (oldSocket) {
                        console.log(`⚠️ Disconnect socket cũ ${existingSocketId}`);
                        oldSocket.emit('force-disconnect', {
                            message: 'Bạn đã đăng nhập từ thiết bị khác'
                        });
                        oldSocket.disconnect(true);
                    }
                }

                // Lưu socket ID mới vào Redis
                await redis.hset(`videoroom:${roomId}:sockets`, userType, socket.id);

                // Gửi thông tin về những người đang trong room
                const sockets = await redis.hgetall(`videoroom:${roomId}:sockets`);
                socket.emit('room-joined', {
                    roomId: roomId,
                    participants: sockets,
                    isFirstPerson: Object.keys(sockets).length === 1
                });

                // Thông báo cho người còn lại trong room
                socket.to(roomId).emit('user-joined', {
                    userId: userId,
                    userType: userType,
                    socketId: socket.id
                });

                console.log(`✅ User ${userId} (${userType}) đã tham gia room ${roomId}`);

                // Cập nhật trạng thái cuộc gọi nếu cả 2 đã vào
                const participantCount = Object.keys(sockets).length;
                if (participantCount >= 2) {
                    try {
                        const apiUrl = `${process.env.URL_API}/goi-video/bat-dau`;
                        console.log('🔄 Gọi API cập nhật trạng thái...');
                        const response = await axios.post(apiUrl, {
                            room_id: roomId
                        });
                        console.log('✅ API bat-dau response:', response.data);
                    } catch (err) {
                        console.error('❌ Lỗi gọi API bat-dau:', err.message);
                    }
                }

            } catch (error) {
                console.error('❌ Lỗi khi join room:', error);
                socket.emit('join-error', { message: 'Đã xảy ra lỗi khi tham gia phòng' });
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