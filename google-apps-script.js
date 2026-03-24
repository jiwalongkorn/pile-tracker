// ============================================================
// Google Apps Script สำหรับรับรูปถ่ายจาก Pile Tracker → เก็บใน Google Drive
// ============================================================
//
// วิธีติดตั้ง:
// 1. ไปที่ https://script.google.com → สร้างโปรเจกต์ใหม่
// 2. วาง code นี้ทั้งหมดลงไป
// 3. แก้ FOLDER_ID เป็น ID ของ folder ใน Google Drive ที่ต้องการเก็บรูป
//    (เปิด folder ใน Drive → ดู URL → https://drive.google.com/drive/folders/XXXXX ← XXXXX คือ ID)
// 4. กด Deploy → New deployment → Web app
//    - Execute as: Me
//    - Who has access: Anyone
// 5. Copy URL ที่ได้ → ไปใส่ในแอพ Pile Tracker ที่ปุ่ม ⚙️ → Google Drive Script URL
//
// หมายเหตุ: ทุกครั้งที่แก้ code ต้อง Deploy ใหม่ (New deployment) ถึงจะมีผล

const FOLDER_ID = "YOUR_FOLDER_ID_HERE"; // ← แก้ตรงนี้

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var folder = DriveApp.getFolderById(FOLDER_ID);
    var blob = Utilities.newBlob(
      Utilities.base64Decode(data.image),
      "image/jpeg",
      data.filename || "pile_photo.jpg"
    );
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var fileId = file.getId();
    var url = "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w800";

    return ContentService.createTextOutput(
      JSON.stringify({ url: url, fileId: fileId })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ error: err.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
