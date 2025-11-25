const PhienChat = require("../models/PhienChat");
const TinNhan = require("../models/TinNhan");
const { redis } = require("../config/redisClient");
const { minioClient, defaultBucket } = require("../config/minioClient");
const crypto = require('crypto');
const path = require('path');

module.exports = {
    khachHangGuiTinNhan: async (data) => {
        try {
            console.log('khachHangGuiTinNhan received data:', data);
            // Parse data nếu là string
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            
            // Xử lý dữ liệu theo các format có thể nhận được
            let idPhienChat, noiDung, loaiNoiDung, image_data, file_name, file_type;
            
            // Format cũ: {id: number, msg: string}
            if (data.id !== undefined && data.msg !== undefined) {
                idPhienChat = data.id;
                noiDung = data.msg;
                loaiNoiDung = 1; // Mặc định là text
            } 
            // Format mới snake_case: {id_phienchat, noi_dung, loai_noi_dung, ...}
            else if (data.id_phienchat !== undefined) {
                idPhienChat = data.id_phienchat;
                noiDung = data.noi_dung;
                loaiNoiDung = data.loai_noi_dung || 1;
                image_data = data.image_data;
                file_name = data.file_name;
                file_type = data.file_type;
            }
            // Format mới camelCase: {idPhienChat, noiDung, loaiNoiDung, ...}
            else if (data.idPhienChat !== undefined) {
                idPhienChat = data.idPhienChat;
                noiDung = data.noiDung;
                loaiNoiDung = data.loaiNoiDung || 1;
                image_data = data.image_data || data.imageData;
                file_name = data.file_name || data.fileName;
                file_type = data.file_type || data.fileType;
            }
            // Trường hợp không match format nào
            else {
                console.error('Không nhận diện được format dữ liệu:', data);
                throw new Error('Format dữ liệu không hợp lệ');
            }
            
            console.log('Processed data:', { idPhienChat, noiDung, loaiNoiDung });
            
            // Kiểm tra dữ liệu bắt buộc
            if (idPhienChat === undefined || idPhienChat === null) {
                throw new Error('idPhienChat không được để trống');
            }
            
            let finalNoiDung = noiDung || '';
            
            // Nếu là hình ảnh, lưu vào MinIO
            if (loaiNoiDung === 2 && image_data) {
                // Tạo buffer từ base64 image
                const base64Data = image_data.split(';base64,').pop();
                const fileBuffer = Buffer.from(base64Data, 'base64');
                
                // Tạo tên file ngẫu nhiên để tránh trùng lặp
                const randomString = crypto.randomBytes(8).toString('hex');
                const fileExtension = path.extname(file_name || 'image.jpg');
                const fileName = `chat-images/${idPhienChat}/${Date.now()}-${randomString}${fileExtension}`;
                
                // Upload file lên MinIO
                await minioClient.putObject(
                    defaultBucket,
                    fileName,
                    fileBuffer,
                    fileBuffer.length,
                    { 'Content-Type': file_type || 'image/jpeg' }
                );
                
                // Lưu đường dẫn tương đối vào cơ sở dữ liệu
                finalNoiDung = fileName;
                console.log('Image uploaded to MinIO:', fileName);
            }
            
            console.log('Creating TinNhan with:', { idPhienChat, finalNoiDung, loaiNoiDung });
            
            const tinNhan = await TinNhan.create({
                idPhienChat,
                noiDung: finalNoiDung,
                loaiNoiDung: loaiNoiDung || 1, // Mặc định là 1 (Text) nếu không có
                nguoiGui: 1 // 1 - Khách hàng
            });
            
            const listPhienChatNhanVienMo = await redis.smembers('list-phien-chat-nhan-vien-mo');
            if(listPhienChatNhanVienMo.includes(idPhienChat.toString())) {
                tinNhan.trangThai = 1; // Đã xem
                await tinNhan.save();
            }
            
            await PhienChat.update({trangThai: 1}, { // Đang chờ nhân viên trả lời
                where: {
                    id: idPhienChat
                }
            });
            
            return tinNhan;
        } catch (error) {
            console.error("Lỗi khi gửi tin nhắn:", error);
            throw error;
        }
    },
    nhanVienGuiTinNhan: async (idPhienChat, idNhanVien, noiDung, loaiNoiDung, imageData, fileName, fileType) => {
        try {
            let finalNoiDung = noiDung;
            
            // Nếu là hình ảnh, lưu vào MinIO
            if (loaiNoiDung === 2 && imageData) {
                // Tạo buffer từ base64 image
                const base64Data = imageData.split(';base64,').pop();
                const fileBuffer = Buffer.from(base64Data, 'base64');
                
                // Tạo tên file ngẫu nhiên để tránh trùng lặp
                const randomString = crypto.randomBytes(8).toString('hex');
                const fileExtension = path.extname(fileName);
                const fileNameWithPath = `chat-images/${idPhienChat}/${Date.now()}-${randomString}${fileExtension}`;
                
                // Upload file lên MinIO
                await minioClient.putObject(
                    defaultBucket,
                    fileNameWithPath,
                    fileBuffer,
                    fileBuffer.length,
                    { 'Content-Type': fileType }
                );
                
                // Lưu đường dẫn tương đối vào cơ sở dữ liệu
                finalNoiDung = fileNameWithPath;
                console.log('Image uploaded to MinIO:', fileNameWithPath);
            }
            
            const tinNhan = await TinNhan.create({
                idPhienChat,
                idNhanVien,
                noiDung: finalNoiDung,
                loaiNoiDung: loaiNoiDung || 1, // Mặc định là 1 (Text)
                nguoiGui: 2 // 2 - Nhân viên
            });
            
            const listPhienChatKhachHangMo = await redis.smembers('list-phien-chat-khach-hang-mo');
            if(listPhienChatKhachHangMo.includes(idPhienChat.toString())) {
                tinNhan.trangThai = 1; // Đã xem
                await tinNhan.save();
            }
            
            await PhienChat.update({trangThai: 0}, { // Chờ khách hàng trả lời
                where: {
                    id: idPhienChat
                }
            });
            
            return tinNhan;
        } catch (error) {
            console.error("Lỗi khi gửi tin nhắn:", error);
            throw error;
        }
    }
}
