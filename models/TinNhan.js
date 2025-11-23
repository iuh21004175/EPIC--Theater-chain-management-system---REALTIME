const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TinNhan = sequelize.define('TinNhan', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    idPhienChat: {
        field: 'id_phienchat',
        type: DataTypes.INTEGER,
        allowNull: false
    },
    noiDung: {
        field: 'noi_dung',
        type: DataTypes.TEXT,
        allowNull: false
    },
    loaiNoiDung: {
        field: 'loai_noidung',
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    nguoiGui: {
        field: 'nguoi_gui',
        type: DataTypes.INTEGER,
        allowNull: true
    },
    idNhanVien: {
        field: 'id_nhanvien',
        type: DataTypes.INTEGER,
        allowNull: true
    },
    trangThai: {
        field: 'trang_thai',
        type: DataTypes.INTEGER,
        defaultValue: 0
    }// 0 - Chưa xem, 1 - Đã xem
}, {
    tableName: 'tin_nhan',
    timestamps: true, // Enable để Sequelize tự handle
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = TinNhan;