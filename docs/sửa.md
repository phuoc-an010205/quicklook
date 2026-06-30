sửa lại giúp mình ,mình muốn thêm <div class="loading-wrapper">
  <div class="bear"></div>
  
  <div class="progress-wrapper">
    <div class="progress-bar"></div>
    <div class="percentage"></div>
  </div>
</div>
/* Container gom cả gấu và thanh tiến trình */
.loading-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px; /* Khoảng cách giữa gấu và thanh loading */
  width: 100%;
  max-width: 300px;
}

/* ============================
   1. CSS CHO CHÚ GẤU
============================ */
.bear {
  width: 160px;
  height: 185px;
  position: relative;
  background: #fff;
  border-radius: 100px 100px 0 0;
}
.bear:after {
  content: "";
  position: absolute;
  width: 100px;
  height: 125px;
  left: 50%;
  top: 25px;
  transform: translateX(-50%);
  background-image: radial-gradient(circle, #000 48%, transparent 55%),
    radial-gradient(circle, #000 48%, transparent 55%),
    radial-gradient(circle, #fff 30%, transparent 45%),
    radial-gradient(circle, #000 48%, transparent 51%),
    linear-gradient(#000 20px, transparent 0),
    linear-gradient(#cfecf9 60px, transparent 0),
    radial-gradient(circle, #cfecf9 50%, transparent 51%),
    radial-gradient(circle, #cfecf9 50%, transparent 51%);
  background-repeat: no-repeat;
  background-size: 16px 16px, 16px 16px, 10px 10px, 42px 42px, 12px 3px,
    50px 25px, 70px 70px, 70px 70px;
  background-position: 25px 10px, 55px 10px, 36px 44px, 50% 30px, 50% 85px,
    50% 50px, 50% 22px, 50% 45px;
  animation: faceLift 3s linear infinite alternate;
}
.bear:before {
  content: "";
  position: absolute;
  width: 140%;
  height: 125px;
  left: -20%;
  top: 0;
  background-image: radial-gradient(circle, #fff 48%, transparent 50%),
    radial-gradient(circle, #fff 48%, transparent 50%);
  background-repeat: no-repeat;
  background-size: 65px 65px;
  background-position: 0px 12px, 145px 12px;
  animation: earLift 3s linear infinite alternate;
}

@keyframes faceLift {
  0% { transform: translateX(-60%); }
  100% { transform: translateX(-30%); }
}
@keyframes earLift {
  0% { transform: translateX(10px); }
  100% { transform: translateX(0px); }
}

/* ============================
   2. CSS CHO THANH LOADING
============================ */
.progress-wrapper {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.progress-bar {
  display: block;
  position: relative;
  height: 14px;
  width: 100%;
  border: 2px solid #fff;
  border-radius: 10px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.1); /* Màu nền mờ cho phần chưa load */
}

.progress-bar:after {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: 0;
  background: #FF3D00;
  animation: 6s prog ease-in infinite;
}

@keyframes prog {
  0% { width: 0%; }
  100% { width: 100%; }
}

/* ============================
   3. CSS CHO BỘ ĐẾM % (PURE CSS)
============================ */
@property --num {
  syntax: '<integer>';
  initial-value: 0;
  inherits: false;
}

.percentage {
  color: #fff;
  font-family: sans-serif;
  font-weight: bold;
  font-size: 18px;
  /* Kết nối biến số với bộ đếm CSS */
  counter-reset: percent var(--num);
  /* Chạy cùng thời gian (6s) và nhịp điệu (ease-in) với thanh loading */
  animation: count 6s ease-in infinite;
}

.percentage::after {
  content: counter(percent) "%";
}

@keyframes count {
  0% { --num: 0; }
  100% { --num: 100; }
}