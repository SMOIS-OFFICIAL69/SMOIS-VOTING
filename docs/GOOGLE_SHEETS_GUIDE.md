# 📊 คู่มือการเชื่อมต่อและบันทึกข้อมูลลง Google Sheets แยกตามชีท (Multi-Tab Sync)
## MC OF ISKKU 2026

ระบบรองรับการส่งออกและบันทึกข้อมูลแยกตามชีท (Multi-Tab Worksheets) 2 รูปแบบหลัก:

---

## 🟢 รูปแบบที่ 1: กดปุ่มส่งออกไฟล์ Spreadsheet Multi-Tab 5 ชีทในคลิกเดียว (แนะนำ)

ในหน้า [admin.html](file:///d:/SMOIS/student-club-web/FA/admin.html) Admin สามารถกดปุ่ม **`📗 Export ชีทแยกตามส่วน (.xlsx Multi-Tab)`** ที่มุมขวาบน 

ระบบจะสร้างไฟล์ **Spreadsheet (.xls / .xlsx)** ที่แบ่งแท็บชีทแยกส่วนกันอย่างเป็นระเบียบ ดังนี้:

1. **`1_สรุปผลอย่างเป็นทางการ`**: สรุปผู้ชนะ Wild Card ROUND 1 (TOP 10) และ ROUND 2 (TOP 6)
2. **`2_บันทึกการโหวต (Votes)`**: รายการโหวตทุกรายการ (Vote ID, รอบ, ผู้สมัคร, ประเภทผู้โหวต, รหัสนักศึกษา/ชื่อ, เวลา)
3. **`3_รายชื่อผู้เข้าแข่งขัน`**: รายละเอียดผู้สมัคร MC 01 - MC 12 (หมายเลข, ชื่อ, สาขา, รูปภาพ)
4. **`4_ผู้ลงทะเบียนโหวต`**: รายชื่อนักศึกษาและบุคคลภายนอกที่ลงทะเบียนโหวต
5. **`5_Audit_Logs`**: บันทึกประวัติการใช้งานและกิจกรรมในระบบย้อนหลัง

> 💡 **นำเข้า Google Sheets**: สามารถนำไฟล์นี้ไปอัปโหลดเข้าสู่ Google Drive ➔ เปิดด้วย **Google Sheets** จะได้ชีทแยกแท็บ 5 หน้าพร้อมใช้งานทันที!

---

## ⚡ รูปแบบที่ 2: เชื่อมต่อบันทึกข้อมูลลง Google Sheets แบบเรียลไทม์ (Live Sync Webhook)

หากผู้จัดงานต้องการให้ทุกคะแนนโหวตซิงค์สดลงสู่ Google Sheets ทันทีที่มีผู้ชมกดโหวต สามารถตั้งค่าได้ง่ายๆ ดังนี้:

### ขั้นตอนที่ 1: สร้าง Google Sheets และตั้งค่า Google Apps Script
1. เปิด [Google Sheets](https://sheets.google.com) ➔ สร้างสเปรดชีตใหม่ตั้งชื่อ **MC_OF_ISKKU_2026_Live_Votes**
2. ไปที่เมนู **ส่วนขยาย (Extensions)** ➔ เลือก **Apps Script**
3. ลบโค้ดเดิมออกทั้งหมด แล้วคัดลอกโค้ดจากไฟล์ [`docs/Code.gs`](file:///d:/SMOIS/student-club-web/FA/docs/Code.gs) ไปวาง

```javascript
/**
 * MC OF ISKKU 2026 - FULL MULTI-TAB GOOGLE APPS SCRIPT WEBHOOK ENGINE (Code.gs)
 * สคริปต์บันทึกข้อมูลทุกอย่าง ครบทั้ง 6 แท็บชีทแบบอัตโนมัติ:
 * 1. 1_สรุปผลอย่างเป็นทางการ
 * 2. 2_บันทึกการโหวต (Votes)
 * 3. 3_รายชื่อผู้เข้าแข่งขัน
 * 4. 4_คณะกรรมการ
 * 5. 5_ผู้ลงทะเบียนโหวต
 * 6. 6_Audit_Logs
 */

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    system: 'MC_OF_ISKKU_2026_FULL_MULTI_TAB_LIVE_SYNC',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Server busy' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'No POST body' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = data.action || 'VOTE_CREATED';
    var payload = data.payload || {};
    var timestamp = data.timestamp || new Date().toISOString();

    // 1. FULL SYNC ALL 6 SHEETS (ซิงค์ทุกอย่างในครั้งเดียว)
    if (action === 'FULL_SYNC') {
      if (payload.summary) {
        var s1 = getOrCreateSheet(ss, '1_สรุปผลอย่างเป็นทางการ', ['อันดับ / ประเภท', 'หมายเลข', 'ชื่อเล่น', 'ชื่อ-นามสกุล', 'สาขาวิชา', 'คะแนนรวม', 'รอบการโหวต', 'เวลาอัปเดต']);
        clearSheetData(s1);
        payload.summary.forEach(function(i) { s1.appendRow([i.rank, i.number, i.nickname, i.full_name, i.major, i.votes, i.round, timestamp]); });
      }
      if (payload.votes) {
        var s2 = getOrCreateSheet(ss, '2_บันทึกการโหวต (Votes)', ['Vote ID', 'Round ID', 'Candidate Number', 'Candidate Nickname', 'Candidate ID', 'Voter ID', 'Voter Name', 'Voter Type', 'Timestamp']);
        clearSheetData(s2);
        payload.votes.forEach(function(v) { s2.appendRow([v.vote_id, v.round_id, v.candidate_number, v.candidate_nickname, v.candidate_id, v.voter_id, v.voter_name, v.voter_type, v.created_at || timestamp]); });
      }
      if (payload.candidates) {
        var s3 = getOrCreateSheet(ss, '3_รายชื่อผู้เข้าแข่งขัน', ['Candidate ID', 'Number', 'Nickname', 'Full Name', 'Major', 'Year', 'Status', 'Image URL', 'Timestamp']);
        clearSheetData(s3);
        payload.candidates.forEach(function(c) { s3.appendRow([c.id, c.number, c.nickname, c.full_name, c.major, c.year || '', c.status || 'ACTIVE', c.image_url || '', timestamp]); });
      }
      if (payload.judges) {
        var s4 = getOrCreateSheet(ss, '4_คณะกรรมการ', ['Judge ID', 'Name', 'Role Title', 'Status', 'Avatar URL', 'Timestamp']);
        clearSheetData(s4);
        payload.judges.forEach(function(j) { s4.appendRow([j.id, j.name, j.role_title || '', j.status || 'ACTIVE', j.avatar_url || '', timestamp]); });
      }
      if (payload.users) {
        var s5 = getOrCreateSheet(ss, '5_ผู้ลงทะเบียนโหวต', ['User ID', 'Student ID / Name', 'User Type', 'Email', 'Role', 'Registered Timestamp']);
        clearSheetData(s5);
        payload.users.forEach(function(u) { s5.appendRow([u.id, u.student_id || u.name, u.user_type, u.email || '', u.role || 'VOTER', u.created_at || timestamp]); });
      }
      if (payload.audit_logs) {
        var s6 = getOrCreateSheet(ss, '6_Audit_Logs', ['Log ID', 'User ID', 'Action', 'Round ID', 'Candidate ID', 'Details', 'IP Address', 'User Agent', 'Timestamp']);
        clearSheetData(s6);
        payload.audit_logs.forEach(function(a) { s6.appendRow([a.id, a.user_id, a.action, a.round_id, a.candidate_id, a.details, a.ip_address || '127.0.0.1', a.user_agent || '', a.timestamp || timestamp]); });
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Full sync completed for all 6 sheets!' })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. REALTIME EVENTS
    if (action === 'VOTE_CREATED') {
      var voteSheet = getOrCreateSheet(ss, '2_บันทึกการโหวต (Votes)', ['Vote ID', 'Round ID', 'Candidate Number', 'Candidate Nickname', 'Candidate ID', 'Voter ID', 'Voter Name', 'Voter Type', 'Timestamp']);
      var voteItems = Array.isArray(payload) ? payload : [payload];
      voteItems.forEach(function(v) { voteSheet.appendRow([v.vote_id || v.id, v.round_id || 'ROUND_1', v.candidate_number || '', v.candidate_nickname || '', v.candidate_id || '', v.voter_id || '', v.voter_name || '', v.voter_type || '', v.created_at || timestamp]); });
    } else if (action === 'USER_REGISTERED' || action === 'STUDENT_LOGIN' || action === 'GUEST_LOGIN') {
      var userSheet = getOrCreateSheet(ss, '5_ผู้ลงทะเบียนโหวต', ['User ID', 'Student ID / Name', 'User Type', 'Email', 'Role', 'Registered Timestamp']);
      var u = payload;
      if (!findRowByValue(userSheet, 1, u.id)) { userSheet.appendRow([u.id, u.student_id || u.name, u.user_type || 'GUEST', u.email || '', u.role || 'VOTER', u.created_at || timestamp]); }
    } else if (action === 'AUDIT_LOG') {
      var auditSheet = getOrCreateSheet(ss, '6_Audit_Logs', ['Log ID', 'User ID', 'Action', 'Round ID', 'Candidate ID', 'Details', 'IP Address', 'User Agent', 'Timestamp']);
      var a = payload;
      auditSheet.appendRow([a.id || ('log_' + Date.now()), a.user_id || 'ANONYMOUS', a.action || action, a.round_id || '', a.candidate_id || '', a.details || '', a.ip_address || '127.0.0.1', a.user_agent || '', a.timestamp || timestamp]);
    } else if (action === 'CANDIDATE_UPDATED' || action === 'CANDIDATE_ADDED') {
      var candSheet = getOrCreateSheet(ss, '3_รายชื่อผู้เข้าแข่งขัน', ['Candidate ID', 'Number', 'Nickname', 'Full Name', 'Major', 'Year', 'Status', 'Image URL', 'Timestamp']);
      var c = payload, row = findRowByValue(candSheet, 1, c.id);
      if (row) { candSheet.getRange(row, 1, 1, 9).setValues([[c.id, c.number, c.nickname, c.full_name, c.major, c.year || '', c.status || 'ACTIVE', c.image_url || '', timestamp]]); }
      else { candSheet.appendRow([c.id, c.number, c.nickname, c.full_name, c.major, c.year || '', c.status || 'ACTIVE', c.image_url || '', timestamp]); }
    } else if (action === 'JUDGE_UPDATED' || action === 'JUDGE_ADDED') {
      var judgeSheet = getOrCreateSheet(ss, '4_คณะกรรมการ', ['Judge ID', 'Name', 'Role Title', 'Status', 'Avatar URL', 'Timestamp']);
      var j = payload, jRow = findRowByValue(judgeSheet, 1, j.id);
      if (jRow) { judgeSheet.getRange(jRow, 1, 1, 6).setValues([[j.id, j.name, j.role_title || '', j.status || 'ACTIVE', j.avatar_url || '', timestamp]]); }
      else { judgeSheet.appendRow([j.id, j.name, j.role_title || '', j.status || 'ACTIVE', j.avatar_url || '', timestamp]); }
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  } finally { lock.releaseLock(); }
}

function getOrCreateSheet(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) { sheet = ss.insertSheet(sheetName); }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    var hRange = sheet.getRange(1, 1, 1, headers.length);
    hRange.setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function clearSheetData(sheet) {
  var last = sheet.getLastRow();
  if (last > 1) { sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).clearContent(); }
}

function findRowByValue(sheet, colIndex, targetValue) {
  if (!targetValue) return null;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][colIndex - 1] === targetValue) { return i + 1; }
  }
  return null;
}
```


4. กดปุ่ม **ทำให้ใช้งานได้ (Deploy)** ➔ เลือก **การทำให้ใช้งานได้ใหม่ (New Deployment)**
5. เลือกประเภท: **เว็บแอป (Web App)**
   - สิทธิ์การเข้าถึง (Who has access): เลือก **ทุกคน (Anyone)**
6. กด **ทำให้ใช้งานได้ (Deploy)** แล้วคัดลอก **URL เว็บแอป (Web App URL)**

### ขั้นตอนที่ 2: วาง URL ใน Admin Dashboard
1. ไปที่หน้า [admin.html](file:///d:/SMOIS/student-club-web/FA/admin.html) ➔ หัวข้อ **"🟢 เชื่อมต่อ Google Sheets (Live Sync)"**
2. วาง Web App URL ที่คัดลอกมา แล้วกดปุ่ม **`🔗 เชื่อมต่อ Google Sheets`**
3. ทุกครั้งที่มีการลงคะแนนโหวต ข้อมูลจะถูกซิงค์สดลงสู่ Google Sheets ทันที!
