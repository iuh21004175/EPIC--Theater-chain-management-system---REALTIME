const e = require("express");
const ScChatTrucTuyen = require("../services/Sc_ChatTrucTuyen");
module.exports = (subscriber, io, redis) => {
    subscriber.on("message", async (channel, message) => {
        if (channel === "khach-hang-tao-phien-chat"){
            console.log("Dữ liệu nhận được từ kênh 'khach-hang-tao-phien-chat':", message);
        }

        else if (channel === "khach-hang-tu-van-gui-tin-nhan"){
            const rawData = JSON.parse(message);
            console.log("Dữ liệu nhận được từ kênh 'khach-hang-tu-van-gui-tin-nhan':", message);
            
            try {
                // Gọi hàm khachHangGuiTinNhan với toàn bộ dữ liệu
                const tinNhan = await ScChatTrucTuyen.khachHangGuiTinNhan(rawData);
                
                if (!tinNhan) {
                    console.error("Không thể tạo tin nhắn");
                    return;
                }
                
                // Chuẩn bị dữ liệu để gửi đến phòng nhân viên
                let messageToSend = {};
                
                // Xác định format dữ liệu đầu vào
                if (rawData.id !== undefined) {
                    // Format cũ
                    messageToSend = {
                        id: rawData.id,
                        msg: tinNhan.noiDung,
                        loai_noi_dung: tinNhan.loaiNoiDung
                    };
                } else {
                    // Format mới
                    messageToSend = {
                        id: rawData.id_phienchat,
                        msg: tinNhan.noiDung,
                        loai_noi_dung: tinNhan.loaiNoiDung
                    };
                }
                
                // Nếu là tin nhắn dạng ảnh
                if (tinNhan.loaiNoiDung === 2) {
                    messageToSend.is_image = true;
                }
                
                // Gửi đến tất cả nhân viên trong phòng
                io.to('room-nhan-vien-tu-van').emit("khach-hang-tu-van-gui-tin-nhan", JSON.stringify(messageToSend));
            } catch (error) {
                console.error("Lỗi xử lý tin nhắn khách hàng:", error.message);
            }
        }
        else if (channel === "khach-hang-mo-phien-chat"){
            const { id, id_khachhang } = JSON.parse(message);
            await redis.sadd('list-phien-chat-khach-hang-mo', id);
            await redis.set(`khach-hang-${id_khachhang}-mo-phien-chat`, id);
        }
        else if (channel === "nhan-vien-gui-tin-nhan"){
            const data = JSON.parse(message);
            console.log("Dữ liệu nhận được từ kênh 'nhan-vien-gui-tin-nhan':", message);
            
            // Hỗ trợ cả hai format snake_case và camelCase
            const id_phienchat = data.id_phienchat || data.idPhienChat;
            const id_nhanvien = data.id_nhanvien || data.idNhanVien;
            const id_khachhang = data.id_khachhang || data.idKhachHang;
            const noi_dung = data.noi_dung || data.noiDung;
            const loai_noi_dung = data.loai_noi_dung || data.loaiNoiDung || 1;
            const image_data = data.image_data || data.imageData;
            const file_name = data.file_name || data.fileName;
            const file_type = data.file_type || data.fileType;
            
            console.log('Đã xử lý dữ liệu:', {
                id_phienchat, id_nhanvien, id_khachhang, 
                noi_dung, loai_noi_dung
            });
            
            // Cập nhật vào DB
            const tinNhan = await ScChatTrucTuyen.nhanVienGuiTinNhan(
                id_phienchat, 
                id_nhanvien, 
                noi_dung,
                loai_noi_dung || 1,
                image_data,
                file_name,
                file_type
            );
            
            const socketIdKhachHang = await redis.get(`khach-hang-${id_khachhang}`);
            console.log("Khách hàng ID:", id_khachhang);
            console.log("Socket ID khách hàng:", socketIdKhachHang);
            
            // Chuẩn bị dữ liệu để gửi
            let messageToSend = {
                id_phienchat,
                noi_dung: tinNhan.noiDung,
                loai_noi_dung: tinNhan.loaiNoiDung
                // 
            };
            
            // Nếu là tin nhắn dạng ảnh, gửi đường dẫn tương đối
            if (tinNhan.loaiNoiDung === 2) {
                messageToSend.is_image = true;
            }
            
            if(socketIdKhachHang) {
                // Gửi sự kiện đến khách hàng trực tuyến
                io.to(socketIdKhachHang).emit("nhan-vien-gui-tin-nhan", JSON.stringify(messageToSend));
            }
            
            // Gửi sự kiện đến tất cả socket trong room, trừ socket phát sự kiện
            const socketIdNhanVien = await redis.get(`nhan-vien-${id_nhanvien}`);
            if(socketIdNhanVien) {
                // Gửi sự kiện đến tất cả socket trong room, trừ socket phát sự kiện
                io.to('room-nhan-vien-tu-van').except(socketIdNhanVien).emit("nhan-vien-gui-tin-nhan", JSON.stringify(messageToSend));
            }
        }
        else if (channel === "nhan-vien-mo-phien-chat"){
            const { id, id_nhanvien } = JSON.parse(message);
            await redis.sadd('list-phien-chat-nhan-vien-mo', id);
            await redis.set(`nhan-vien-${id_nhanvien}-mo-phien-chat`, id);
        }
        
        // Xử lý các sự kiện video call
        else if (channel === "lichgoivideo:moi"){
            const data = JSON.parse(message);
            console.log("Lịch gọi video mới:", data);
            
            // Emit đến namespace video cho nhân viên của rạp đó
            io.of('/video').emit('lichgoivideo:moi', data);
        }
        
        else if (channel === "lichgoivideo:dachon"){
            const data = JSON.parse(message);
            console.log("Nhân viên đã chọn tư vấn:", data);
            
            // Lấy socket ID của khách hàng từ Redis
            const socketIdKhachHang = await redis.get(`khach-hang-${data.id_khachhang}`);
            
            if(socketIdKhachHang) {
                // Gửi thông báo đến khách hàng cụ thể
                io.to(socketIdKhachHang).emit("lichgoivideo:dachon", data);
            }
            
            // Cũng emit đến namespace video
            io.of('/video').emit('lichgoivideo:dachon', data);
        }
        
        else if (channel === "lichgoivideo:huy"){
            const data = JSON.parse(message);
            console.log("Nhân viên đã hủy tư vấn:", data);
            
            // Lấy socket ID của khách hàng từ Redis
            const socketIdKhachHang = await redis.get(`khach-hang-${data.id_khachhang}`);
            
            if(socketIdKhachHang) {
                // Gửi thông báo đến khách hàng cụ thể
                io.to(socketIdKhachHang).emit("lichgoivideo:huy", data);
            }
            
            // Cũng emit đến namespace video
            io.of('/video').emit('lichgoivideo:huy', data);
        }

        else if(channel === "khach-hang-chon-ghe"){
            const { gheId, suatChieuId, socketId } = JSON.parse(message);
            console.log("Khách hàng chọn ghế:", gheId, suatChieuId);
            // Xử lý sự kiện khách hàng chọn ghế ở đây (nếu cần)
            const valueGiamSatTong = await redis.get(`giam-sat-suat-chieu-${suatChieuId}`);
            const valueGiamSatKhachHang = await redis.get(`danh-sach-ghe-khach-hang-${socketId}-suat-chieu-${suatChieuId}`);
            let listTong = JSON.parse(valueGiamSatTong) || [];
            let listKhachHang = JSON.parse(valueGiamSatKhachHang) || [];
            await redis.set(`giam-sat-suat-chieu-${suatChieuId}`, JSON.stringify([...listTong, gheId]));
            await redis.set(`khach-hang-${socketId}-chon-suat-chieu`, suatChieuId);
            await redis.set(`danh-sach-ghe-khach-hang-${socketId}-suat-chieu-${suatChieuId}`, JSON.stringify([...listKhachHang, gheId]));
            io.except(socketId).emit(`khach-hang-chon-ghe-suat-chieu-${suatChieuId}`, gheId);
        }
        else if(channel === "khach-hang-huy-chon-ghe"){
            const { gheId, suatChieuId, socketId } = JSON.parse(message);
            console.log("Khách hàng hủy chọn ghế:", gheId, suatChieuId);
            // Xử lý sự kiện khách hàng hủy chọn ghế ở đây (nếu cần)
            const valueGiamSatTong = await redis.get(`giam-sat-suat-chieu-${suatChieuId}`);
            const valueGiamSatKhachHang = await redis.get(`danh-sach-ghe-khach-hang-${socketId}-suat-chieu-${suatChieuId}`);
            let listTong = JSON.parse(valueGiamSatTong) || [];
            let listKhachHang = JSON.parse(valueGiamSatKhachHang) || [];
            listTong = listTong.filter(id => id !== gheId);
            listKhachHang = listKhachHang.filter(id => id !== gheId);
            await redis.set(`giam-sat-suat-chieu-${suatChieuId}`, JSON.stringify(listTong));
            await redis.set(`danh-sach-ghe-khach-hang-${socketId}-suat-chieu-${suatChieuId}`, JSON.stringify(listKhachHang));
            io.except(socketId).emit(`khach-hang-huy-chon-ghe-suat-chieu-${suatChieuId}`, gheId);
        }
        else if(channel === "thanh-toan-don-hang-thanh-cong"){
            const {suatChieuId, gheIds} = JSON.parse(message);
            const valueGiamSatTong = await redis.get(`giam-sat-suat-chieu-${suatChieuId}`);
            let listTong = JSON.parse(valueGiamSatTong) || [];
            const updatedList = listTong.filter(gheId => !gheIds.includes(gheId));
            console.log(`Updated seat list for showtime ${suatChieuId}:`, updatedList);
            redis.set(`giam-sat-suat-chieu-${suatChieuId}`, JSON.stringify(updatedList));
            io.emit(`cap-nhat-danh-sach-ghe-${suatChieuId}-da-dat`, JSON.stringify(gheIds));
        }
    });
}