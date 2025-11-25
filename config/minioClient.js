const Minio = require('minio');

// Tạo một Minio client với các thông tin kết nối từ biến môi trường
const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000'),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
});

// Tên bucket mặc định để lưu trữ các file tin nhắn
const defaultBucket = process.env.MINIO_BUCKET || 'chat-files';

// Đảm bảo bucket tồn tại khi ứng dụng khởi động
const ensureBucketExists = async () => {
    try {
        const exists = await minioClient.bucketExists(defaultBucket);
        if (!exists) {
            await minioClient.makeBucket(defaultBucket, process.env.MINIO_REGION || 'us-east-1');
            console.log(`Bucket '${defaultBucket}' created successfully`);
        } else {
            console.log(`Bucket '${defaultBucket}' already exists`);
        }
    } catch (error) {
        console.error(`Error ensuring bucket exists: ${error}`);
    }
};

// Khởi tạo bucket khi module được import
ensureBucketExists();

module.exports = { minioClient, defaultBucket };