module.exports = (subscriber) => {
    subscriber.subscribe("khach-hang-tu-van-gui-tin-nhan", (err, count) => {
        if (err) {
            console.error("Lỗi khi đăng ký kênh Redis:", err);
        } else {
            console.log(`Đã đăng ký kênh Redis: ${count}`);
        }
    });
    subscriber.subscribe("khach-hang-mo-phien-chat", (err, count) => {
        if (err) {
            console.error("Lỗi khi đăng ký kênh Redis:", err);
        } else {
            console.log(`Đã đăng ký kênh Redis: ${count}`);
        }
    });
    subscriber.subscribe("nhan-vien-gui-tin-nhan", (err, count) => {
        if (err) {
            console.error("Lỗi khi đăng ký kênh Redis:", err);
        } else {
            console.log(`Đã đăng ký kênh Redis: ${count}`);
        }
    });
    subscriber.subscribe("nhan-vien-mo-phien-chat", (err, count) => {
        if (err) {
            console.error("Lỗi khi đăng ký kênh Redis:", err);
        } else {
            console.log(`Đã đăng ký kênh Redis: ${count}`);
        }
    });
    
    // Đăng ký các kênh cho video call
    subscriber.subscribe("lichgoivideo:moi", (err, count) => {
        if (err) {
            console.error("Lỗi khi đăng ký kênh lichgoivideo:moi:", err);
        } else {
            console.log(`Đã đăng ký kênh lichgoivideo:moi`);
        }
    });
    
    subscriber.subscribe("lichgoivideo:dachon", (err, count) => {
        if (err) {
            console.error("Lỗi khi đăng ký kênh lichgoivideo:dachon:", err);
        } else {
            console.log(`Đã đăng ký kênh lichgoivideo:dachon`);
        }
    });
    
    subscriber.subscribe("lichgoivideo:huy", (err, count) => {
        if (err) {
            console.error("Lỗi khi đăng ký kênh lichgoivideo:huy:", err);
        } else {
            console.log(`Đã đăng ký kênh lichgoivideo:huy`);
        }
    });
    
    // Đăng ký kênh cho sự kiện khách hàng chọn ghế
    subscriber.subscribe("khach-hang-chon-ghe", (err, count) => {
        if (err) {
            console.error("Lỗi khi đăng ký kênh khach-hang-chon-ghe:", err);
        } else {
            console.log(`Đã đăng ký kênh khach-hang-chon-ghe`);
        }
    });
    subscriber.subscribe("khach-hang-huy-chon-ghe", (err, count) => {
        if (err) {
            console.error("Lỗi khi đăng ký kênh khach-hang-huy-chon-ghe:", err);
        } else {
            console.log(`Đã đăng ký kênh khach-hang-huy-chon-ghe`);
        }
    });
    subscriber.subscribe("thanh-toan-don-hang-thanh-cong", (err, count) => {
        if (err) {
            console.error("Lỗi khi đăng ký kênh thanh-toan-don-hang-thanh-cong:", err);
        } else {
            console.log(`Đã đăng ký kênh thanh-toan-don-hang-thanh-cong`);
        }
    });
}
