const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PhienChat = sequelize.define('PhienChat', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    chuDe: {
        field: 'chu_de',
        type: DataTypes.STRING,
        allowNull: false
    },
    trangThai: {
        field: 'trang_thai',
        type: DataTypes.INTEGER,
        allowNull: false
    }, // 0 - Chờ khách hàng trả lời, 1 - Đang chờ nhân viên trả lời, 2 - Đang chat (Nhân viên mở chat), 3 - Đã kết thúc 
    createdAt: {
        field: 'created_at',
        type: DataTypes.DATE,
        allowNull: false
    },
    updatedAt: {
        field: 'updated_at',
        type: DataTypes.DATE,
        allowNull: false
    }
}, {
    tableName: 'phien_chat',
    timestamps: true, // Enable để Sequelize tự handle
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = PhienChat;