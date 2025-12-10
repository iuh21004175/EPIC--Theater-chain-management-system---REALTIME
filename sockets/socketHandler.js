module.exports = (io, redis) => {
    io.on('connection', (socket) => {
        // console.log('A user connected');
        socket.on('disconnect', async () => {
            try {
                const socketid = socket.id;
                console.log(`Socket ${socketid} disconnected`);
                
                // Lấy thông tin khách hàng
                const idKhachHang = await redis.get(`socket-khach-hang-${socketid}`);
                console.log(`Checking customer ID for socket ${socketid}: ${idKhachHang || 'not found'}`);
                
                if (idKhachHang) {
                    // Lấy ID phiên chat trước khi xóa
                    const idPhienChat = await redis.get(`khach-hang-${idKhachHang}-mo-phien-chat`);
                    console.log(`Customer ${idKhachHang} had open session: ${idPhienChat || 'none'}`);
                    
                    // Xóa các keys liên quan
                    await redis.del(`khach-hang-${idKhachHang}`);
                    await redis.del(`socket-khach-hang-${socketid}`);
                    
                    // Chỉ xóa khỏi danh sách nếu có phiên chat mở
                    if (idPhienChat) {
                        await redis.srem('list-phien-chat-khach-hang-mo', idPhienChat);
                        console.log(`Removed session ${idPhienChat} from customer open sessions list`);
                    }
                }
                
                // Tương tự với nhân viên
                const idNhanVien = await redis.get(`socket-nhan-vien-${socketid}`);
                console.log(`Checking staff ID for socket ${socketid}: ${idNhanVien || 'not found'}`);
                
                if (idNhanVien) {
                    const idPhienChat = await redis.get(`nhan-vien-${idNhanVien}-mo-phien-chat`);
                    console.log(`Staff ${idNhanVien} had open session: ${idPhienChat || 'none'}`);
                    
                    // Xóa thông tin socket và nhân viên
                    await redis.del(`nhan-vien-${idNhanVien}`);
                    await redis.del(`socket-nhan-vien-${socketid}`);
                    
                    if (idPhienChat) {
                        // Xóa thông tin phiên chat đang được mở bởi nhân viên này
                        await redis.del(`phien-chat-${idPhienChat}-nhan-vien`);
                        await redis.srem('list-phien-chat-nhan-vien-mo', idPhienChat);
                        await redis.del(`nhan-vien-${idNhanVien}-mo-phien-chat`);
                        
                        console.log(`Removed session ${idPhienChat} from staff open sessions list`);
                        console.log(`Released lock on session ${idPhienChat} due to staff ${idNhanVien} disconnect`);
                        
                        // Broadcast đến tất cả nhân viên khác rằng phiên chat đã được đóng
                        io.to('room-nhan-vien-tu-van').emit('phien-chat-duoc-dong', JSON.stringify({
                            id_phienchat: idPhienChat,
                            id_nhanvien: idNhanVien
                        }));
                    }
                }
                // Xóa danh sách ghế khách hàng

                const suatChieuId = await redis.get(`khach-hang-${socketid}-chon-suat-chieu`);
                const valueGiamSatKhachHang = await redis.get(`danh-sach-ghe-khach-hang-${socketid}-suat-chieu-${suatChieuId}`);
                const danhSachGheDaChon = JSON.parse(valueGiamSatKhachHang) || [];
                console.log(`Customer with socket ${socketid} had selected seats:`, danhSachGheDaChon, 'for showtime:', suatChieuId);
                if(suatChieuId){
                    const valueGiamSatTong = await redis.get(`giam-sat-suat-chieu-${suatChieuId}`);
                    let listTong = JSON.parse(valueGiamSatTong) || [];
                    const updatedList = listTong.filter(gheId => !danhSachGheDaChon.includes(gheId));
                    console.log(`Updated seat list for showtime ${suatChieuId}:`, updatedList);
                    redis.set(`giam-sat-suat-chieu-${suatChieuId}`, JSON.stringify(updatedList));
                    await redis.del(`danh-sach-ghe-khach-hang-${socketid}`);
                    await redis.del(`khach-hang-${socketid}-chon-suat-chieu`);
                    io.emit(`cap-nhat-danh-sach-ghe-${suatChieuId}-da-chon`, JSON.stringify(updatedList));
                }

            } catch (error) {
                console.error('Error handling disconnect:', error);
            }
        });
        console.log('New client connected', socket.id);
        socket.on('khach-hang-truc-tuyen', async (id) => {
            try {
                // Kiểm tra nếu khách hàng đã có socket ID khác
                const existingSocketId = await redis.get(`khach-hang-${id}`);
                if (existingSocketId) {
                    console.log(`Customer ${id} already connected with socket ${existingSocketId}, updating...`);
                }
                
                await redis.set(`khach-hang-${id}`, socket.id);
                await redis.set(`socket-khach-hang-${socket.id}`, id);
                console.log(`Khách hàng ${id} trực tuyến với socket ID: ${socket.id}`);
            } catch (error) {
                console.error(`Error connecting customer ${id}:`, error);
            }
        })
        socket.on('khach-hang-gui-tin-nhan', (data) => {
            console.log('Tin nhắn từ khách hàng:', data);
            const {msg, id, history} = JSON.parse(data);
            redis.publish('khach-hang-gui-tin-nhan', JSON.stringify({msg: msg, id: id, socketId: socket.id, history: history}));

        });

        socket.on('khach-hang-tu-van-gui-tin-nhan', (data) => {
            console.log('Socket received khach-hang-tu-van-gui-tin-nhan:', data);
            try {
                const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
                
                // Kiểm tra các trường hợp hình ảnh (cả snake_case và camelCase)
                if (parsedData.loai_noi_dung === 2 || parsedData.loaiNoiDung === 2 || 
                    parsedData.image_data || parsedData.imageData) {
                    console.log('Xử lý tin nhắn hình ảnh');
                    // Giữ nguyên format gửi đi
                    redis.publish('khach-hang-tu-van-gui-tin-nhan', JSON.stringify(parsedData));
                } 
                // Xử lý các format text thông thường
                else {
                    // Nếu là format snake_case
                    if (parsedData.id_phienchat !== undefined) {
                        console.log('Xử lý tin nhắn text format snake_case');
                        redis.publish('khach-hang-tu-van-gui-tin-nhan', JSON.stringify({
                            id_phienchat: parsedData.id_phienchat,
                            noi_dung: parsedData.noi_dung,
                            loai_noi_dung: 1
                        }));
                    } 
                    // Nếu là format camelCase
                    else if (parsedData.idPhienChat !== undefined) {
                        console.log('Xử lý tin nhắn text format camelCase');
                        redis.publish('khach-hang-tu-van-gui-tin-nhan', JSON.stringify({
                            id_phienchat: parsedData.idPhienChat,
                            noi_dung: parsedData.noiDung,
                            loai_noi_dung: 1
                        }));
                    }
                    // Nếu là format cũ
                    else if (parsedData.id !== undefined) {
                        console.log('Xử lý tin nhắn text format cũ');
                        redis.publish('khach-hang-tu-van-gui-tin-nhan', JSON.stringify({
                            id: parsedData.id,
                            msg: parsedData.msg
                        }));
                    }
                    // Không nhận dạng được format
                    else {
                        console.error('Không nhận diện được format tin nhắn', parsedData);
                    }
                }
            } catch (error) {
                console.error('Error processing khach-hang-tu-van-gui-tin-nhan:', error);
            }
        });
        
        socket.on('khach-hang-mo-phien-chat', async (data) => {
            try {
                const { id, id_khachhang } = JSON.parse(data);
                await redis.sadd('list-phien-chat-khach-hang-mo', id);
                await redis.set(`khach-hang-${id_khachhang}-mo-phien-chat`, id);
                console.log(`Khách hàng ${id_khachhang} đã mở phiên chat ${id}`);
            } catch (error) {
                console.error('Error processing khach-hang-mo-phien-chat:', error);
            }
        });
        
        socket.on('khach-hang-dong-phien-chat', async (data) => {
            try {
                const { id, id_khachhang } = JSON.parse(data);
                await redis.srem('list-phien-chat-khach-hang-mo', id);
                await redis.del(`khach-hang-${id_khachhang}-mo-phien-chat`);
                console.log(`Khách hàng ${id_khachhang} đã đóng phiên chat ${id}`);
            } catch (error) {
                console.error('Error processing khach-hang-dong-phien-chat:', error);
            }
        });
        socket.on('nhan-vien-tham-gia-tu-van', async (data) => {
            try {
                const {id} = JSON.parse(data);
                
                const existingSocketId = await redis.get(`nhan-vien-${id}`);
                if (existingSocketId) {
                    console.log(`Staff ${id} already connected with socket ${existingSocketId}, updating...`);
                }
                
                await redis.set(`nhan-vien-${id}`, socket.id);
                await redis.set(`socket-nhan-vien-${socket.id}`, id);
                socket.join('room-nhan-vien-tu-van');
                console.log(`Nhân viên ${id} tham gia tư vấn với socket ID: ${socket.id}`);
            } catch (error) {
                console.error(`Error connecting staff ${data}:`, error);
            }
        });
        
        socket.on('nhan-vien-mo-phien-chat', async (data) => {
            try {
                const { id_phienchat, id_nhanvien, ten_nhanvien } = JSON.parse(data);
                
                // Kiểm tra xem phiên chat đã được mở bởi nhân viên khác chưa
                const existingStaff = await redis.get(`phien-chat-${id_phienchat}-nhan-vien`);
                if (existingStaff) {
                    const staffInfo = JSON.parse(existingStaff);
                    console.log(`Phiên chat ${id_phienchat} đã được mở bởi nhân viên ${staffInfo.id_nhanvien}`);
                    // Trả về thông báo phiên chat đã được mở
                    io.to(socket.id).emit('phien-chat-da-duoc-mo', JSON.stringify({
                        id_phienchat,
                        id_nhanvien: staffInfo.id_nhanvien,
                        ten_nhanvien: staffInfo.ten_nhanvien
                    }));
                    return;
                }
                
                // Lưu thông tin nhân viên đang mở phiên chat
                await redis.set(`phien-chat-${id_phienchat}-nhan-vien`, JSON.stringify({
                    id_nhanvien,
                    ten_nhanvien,
                    socket_id: socket.id,
                    timestamp: Date.now()
                }));
                
                await redis.sadd('list-phien-chat-nhan-vien-mo', id_phienchat);
                await redis.set(`nhan-vien-${id_nhanvien}-mo-phien-chat`, id_phienchat);
                
                console.log(`Nhân viên ${id_nhanvien} (${ten_nhanvien}) đã mở phiên chat ${id_phienchat}`);
                
                // Broadcast đến tất cả nhân viên khác
                io.to('room-nhan-vien-tu-van').emit('phien-chat-duoc-mo', JSON.stringify({
                    id_phienchat,
                    id_nhanvien,
                    ten_nhanvien
                }));
            } catch (error) {
                console.error('Error processing nhan-vien-mo-phien-chat:', error);
            }
        });
        
        socket.on('nhan-vien-dong-phien-chat', async (data) => {
            try {
                const { id_phienchat, id_nhanvien } = JSON.parse(data);
                
                // Xóa thông tin nhân viên đang mở phiên chat
                await redis.del(`phien-chat-${id_phienchat}-nhan-vien`);
                await redis.srem('list-phien-chat-nhan-vien-mo', id_phienchat);
                await redis.del(`nhan-vien-${id_nhanvien}-mo-phien-chat`);
                
                console.log(`Nhân viên ${id_nhanvien} đã đóng phiên chat ${id_phienchat}`);
                
                // Broadcast đến tất cả nhân viên khác
                io.to('room-nhan-vien-tu-van').emit('phien-chat-duoc-dong', JSON.stringify({
                    id_phienchat,
                    id_nhanvien
                }));
            } catch (error) {
                console.error('Error processing nhan-vien-dong-phien-chat:', error);
            }
        });
        socket.on('nhan-vien-gui-tin-nhan', (data) => {
            console.log('Tin nhắn từ nhân viên:', data);
            try {
                const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
                
                // Hỗ trợ cả tin nhắn thường và tin nhắn hình ảnh
                if (parsedData.loai_noi_dung === 2 || parsedData.loaiNoiDung === 2 || 
                    parsedData.image_data || parsedData.imageData) {
                    console.log('Nhân viên gửi tin nhắn hình ảnh');
                    // Giữ nguyên format gửi đi
                    redis.publish('nhan-vien-gui-tin-nhan', JSON.stringify(parsedData));
                }
                // Tin nhắn thông thường
                else {
                    // Xử lý cả định dạng snake_case và camelCase
                    const id_phienchat = parsedData.id_phienchat || parsedData.idPhienChat;
                    const id_khachhang = parsedData.id_khachhang || parsedData.idKhachHang;
                    const id_nhanvien = parsedData.id_nhanvien || parsedData.idNhanVien;
                    const noi_dung = parsedData.noi_dung || parsedData.noiDung;
                    
                    redis.publish('nhan-vien-gui-tin-nhan', JSON.stringify({
                        id_phienchat, 
                        id_khachhang, 
                        id_nhanvien, 
                        noi_dung,
                        loai_noi_dung: 1
                    }));
                }
            } catch (error) {
                console.error('Lỗi khi xử lý tin nhắn từ nhân viên:', error);
            }
        });
        socket.on('khach-hang-chon-ghe', (data) => {
            console.log('Khách hàng chọn ghế:', data);
            const { gheId, suatChieuId } = JSON.parse(data);
            // Xử lý sự kiện khách hàng chọn ghế
            redis.publish('khach-hang-chon-ghe', JSON.stringify({ gheId, suatChieuId, socketId: socket.id }));
        });
        socket.on('khach-hang-huy-chon-ghe', (data) => {
            console.log('Khách hàng hủy chọn ghế:', data);
            const { gheId, suatChieuId } = JSON.parse(data);
            // Xử lý sự kiện khách hàng hủy chọn ghế
            redis.publish('khach-hang-huy-chon-ghe', JSON.stringify({ gheId, suatChieuId, socketId: socket.id }));
        });
        socket.on('lay-danh-sach-ghe-da-chon', async (data) => {
            console.log('Lấy danh sách ghế đã chọn cho:', data);
            const { suatChieuId } = JSON.parse(data);
            // Xử lý sự kiện lấy danh sách ghế đã chọn
            const valueGiamSat = await redis.get(`giam-sat-suat-chieu-${suatChieuId}`);
            const danhSachGheDaChon = JSON.parse(valueGiamSat) || [];
            io.to(socket.id).emit(`cap-nhat-danh-sach-ghe-${suatChieuId}-da-chon`, JSON.stringify(danhSachGheDaChon));
        })
        require('./videoCallHandler')(socket,redis); // Thêm video call handler
    });
}
