1.Mình muốn thêm tính năng khi người dùng bấm ctrl + lăn chuột sẽ phóng to và thu nhỏ thì hình ảnh cũng hay đổi theo id="all-previews-container" và cho ảnh .mage-item img 210*210 để người dùng dễ nhìn,
2.đổi withImageLoader thành thanh loading % thanh gì loading text
tích hợp hiệu ứng này hay cho loading text
<span class="loader"></span>
.loader{
        display: block;
        position: relative;
        height: 12px;
        width: 80%;
        border: 1px solid #fff;
        border-radius: 10px;
        overflow: hidden;
      }
      .loader:after{
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
        to  {   width: 100%;}
      }
    hiện số phần % nữa 
