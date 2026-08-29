/**
 * MC OF ISKKU 2026 - FULL REAL-TIME CRUD MULTI-TAB GOOGLE APPS SCRIPT ENGINE (Code.gs)
 * สคริปต์หลังบ้าน Google Sheets บันทึก / แก้ไข / ลบ ข้อมูลทันทีเรียลไทม์ 100%:
 * 1. 1_สรุปผลอย่างเป็นทางการ (Official Summary & Auto Recalculate Ranks)
 * 2. 2_บันทึกการโหวต (Votes Log - เพิ่ม / ลบผลโหวต)
 * 3. 3_รายชื่อผู้เข้าแข่งขัน (Candidates - เพิ่ม / แก้ไข / ลบผู้สมัคร)
 * 4. 4_ผู้ลงทะเบียนโหวต (Voters Register)
 * 5. 5_ผู้ดูแลระบบ (Admins - บัญชีแอดมิน & รหัส PIN ถาวร)
 * 6. 6_Audit_Logs (System Audit Trail)
 * 7. 7_รอบการโหวต (Rounds - วันเวลาเปิด-ปิดการโหวตทุกอุปกรณ์)
 */

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. อ่านชีทสรุปผล
    var summary = readSheetAsJSON(ss, '1_สรุปผลอย่างเป็นทางการ', function(row) {
      return {
        rank: String(row[0] || ''),
        number: String(row[1] || ''),
        nickname: String(row[2] || ''),
        full_name: String(row[3] || ''),
        major: String(row[4] || ''),
        votes: Number(row[5] || 0),
        round: String(row[6] || 'ROUND_1'),
        timestamp: String(row[7] || '')
      };
    });

    // 2. อ่านชีทการโหวต
    var votes = readSheetAsJSON(ss, '2_บันทึกการโหวต (Votes)', function(row) {
      return {
        id: String(row[0] || ''),
        voter_id: String(row[5] || ''),
        round_id: String(row[1] || 'ROUND_1'),
        candidate_id: String(row[4] || ''),
        candidate_number: String(row[2] || ''),
        candidate_nickname: String(row[3] || ''),
        created_at: String(row[8] || new Date().toISOString())
      };
    });

    // 3. อ่านชีทผู้เข้าแข่งขัน
    var candidates = readSheetAsJSON(ss, '3_รายชื่อผู้เข้าแข่งขัน', function(row) {
      return {
        id: String(row[0] || ''),
        number: String(row[1] || ''),
        nickname: String(row[2] || ''),
        full_name: String(row[3] || ''),
        major: String(row[4] || ''),
        year: String(row[5] || 'ปี 1'),
        status: String(row[6] || 'ACTIVE'),
        image_url: String(row[7] || '')
      };
    });

    // 4. อ่านชีทผู้ลงทะเบียนโหวต
    var users = readSheetAsJSON(ss, '4_ผู้ลงทะเบียนโหวต', function(row) {
      return {
        id: String(row[0] || ''),
        student_id: String(row[1] || ''),
        name: String(row[1] || ''),
        user_type: String(row[2] || 'GUEST'),
        email: String(row[3] || ''),
        role: String(row[4] || 'VOTER'),
        created_at: String(row[5] || '')
      };
    });

    // 5. อ่านชีทผู้ดูแลระบบ (Admins)
    var admins = readSheetAsJSON(ss, '5_ผู้ดูแลระบบ (Admins)', function(row) {
      return {
        id: String(row[0] || ''),
        username: String(row[1] || ''),
        name: String(row[2] || ''),
        pin: String(row[3] || 'admin123'),
        role: String(row[4] || 'ADMIN'),
        status: String(row[5] || 'ACTIVE'),
        created_at: String(row[6] || '')
      };
    });

    // 6. อ่านชีท Audit Logs
    var audit_logs = readSheetAsJSON(ss, '6_Audit_Logs', function(row) {
      return {
        id: String(row[0] || ''),
        user_id: String(row[1] || ''),
        action: String(row[2] || ''),
        round_id: String(row[3] || ''),
        candidate_id: String(row[4] || ''),
        details: String(row[5] || ''),
        ip_address: String(row[6] || '127.0.0.1'),
        user_agent: String(row[7] || ''),
        timestamp: String(row[8] || '')
      };
    });

    // 7. อ่านชีท รอบการโหวต (Voting Rounds)
    var voting_rounds = readSheetAsJSON(ss, '7_รอบการโหวต (Rounds)', function(row) {
      return {
        id: String(row[0] || ''),
        round_name: String(row[1] || ''),
        subtitle: String(row[2] || ''),
        description: String(row[3] || ''),
        status: String(row[4] || 'OPEN'),
        start_at: row[5] ? String(row[5]) : null,
        end_at: row[6] ? String(row[6]) : null
      };
    });

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      system: 'MC_OF_ISKKU_2026_LIVE_DATABASE',
      data: {
        summary: summary,
        votes: votes,
        candidates: candidates,
        users: users,
        admins: admins,
        voting_rounds: voting_rounds,
        audit_logs: audit_logs
      },
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var postData = JSON.parse(e.postData.contents);
    var action = postData.action;
    var payload = postData.payload;
    var timestamp = postData.timestamp || new Date().toISOString();

    // =========================================================================
    // 1. FULL SYNC (บันทึกข้อมูลทั้ง 7 แท็บลง Google Sheets ล่าสุดทันที)
    // =========================================================================
    if (action === 'FULL_SYNC') {

      // 1. 1_สรุปผลอย่างเป็นทางการ (Summary)
      if (payload.summary && Array.isArray(payload.summary)) {
        var sheet1 = getOrCreateSheet(ss, '1_สรุปผลอย่างเป็นทางการ', [
          'ลำดับ (Rank)', 'หมายเลข', 'ชื่อเล่น', 'ชื่อ-นามสกุล', 'สาขาวิชา', 'คะแนนโหวต (Votes)', 'รอบการโหวต', 'เวลาอัปเดตล่าสุด'
        ]);
        clearSheetData(sheet1);
        payload.summary.forEach(function(item) {
          sheet1.appendRow([
            item.rank || '', item.number || '', item.nickname || '', item.full_name || '', item.major || '', item.votes || 0, item.round || 'ROUND_1', timestamp
          ]);
        });
      }

      // 2. 2_บันทึกการโหวต (Votes)
      if (payload.votes && Array.isArray(payload.votes)) {
        var sheet2 = getOrCreateSheet(ss, '2_บันทึกการโหวต (Votes)', [
          'Vote ID', 'Round ID', 'Candidate Number', 'Candidate Nickname', 'Candidate ID', 'Voter ID', 'Voter Name', 'Voter Type', 'Timestamp'
        ]);
        clearSheetData(sheet2);
        payload.votes.forEach(function(v) {
          sheet2.appendRow([
            v.vote_id || v.id || '', v.round_id || 'ROUND_1', v.candidate_number || '', v.candidate_nickname || '', v.candidate_id || '', v.voter_id || '', v.voter_name || '', v.voter_type || '', v.created_at || timestamp
          ]);
        });
      }

      // 3. 3_รายชื่อผู้เข้าแข่งขัน (Candidates)
      if (payload.candidates && Array.isArray(payload.candidates)) {
        var sheet3 = getOrCreateSheet(ss, '3_รายชื่อผู้เข้าแข่งขัน', [
          'Candidate ID', 'Number', 'Nickname', 'Full Name', 'Major', 'Year', 'Status', 'Image URL'
        ]);
        clearSheetData(sheet3);
        payload.candidates.forEach(function(c) {
          sheet3.appendRow([
            c.id || '', c.number || '', c.nickname || '', c.full_name || '', c.major || '', c.year || 'ปี 1', c.status || 'ACTIVE', c.image_url || ''
          ]);
        });
      }

      // 4. ผู้ลงทะเบียนโหวต (Users)
      if (payload.users && Array.isArray(payload.users)) {
        var sheet4 = getOrCreateSheet(ss, '4_ผู้ลงทะเบียนโหวต', [
          'User ID', 'Student ID / Name', 'User Type', 'Email', 'Role', 'Registered Timestamp'
        ]);
        clearSheetData(sheet4);
        payload.users.forEach(function(u) {
          sheet4.appendRow([
            u.id || '', u.student_id || u.name || '', u.user_type || 'GUEST', u.email || '', u.role || 'VOTER', u.created_at || timestamp
          ]);
        });
      }

      // 5. ผู้ดูแลระบบ (Admins)
      if (payload.admins && Array.isArray(payload.admins)) {
        var sheet5 = getOrCreateSheet(ss, '5_ผู้ดูแลระบบ (Admins)', [
          'Admin ID', 'Username', 'Name / Title', 'PIN Password', 'Role', 'Status', 'Registered Timestamp'
        ]);
        clearSheetData(sheet5);
        payload.admins.forEach(function(adm) {
          sheet5.appendRow([
            adm.id || '', adm.username || '', adm.name || '', adm.pin || 'admin123', adm.role || 'ADMIN', adm.status || 'ACTIVE', adm.created_at || timestamp
          ]);
        });
      }

      // 6. Audit Logs
      if (payload.audit_logs && Array.isArray(payload.audit_logs)) {
        var sheet6 = getOrCreateSheet(ss, '6_Audit_Logs', [
          'Log ID', 'User ID', 'Action', 'Round ID', 'Candidate ID', 'Details', 'IP Address', 'User Agent', 'Timestamp'
        ]);
        clearSheetData(sheet6);
        payload.audit_logs.forEach(function(a) {
          sheet6.appendRow([
            a.id || '', a.user_id || 'ANONYMOUS', a.action || '', a.round_id || '', a.candidate_id || '', a.details || '', a.ip_address || '127.0.0.1', a.user_agent || '', a.timestamp || timestamp
          ]);
        });
      }

      // 7. รอบการโหวต (Rounds)
      if (payload.voting_rounds && Array.isArray(payload.voting_rounds)) {
        var sheet7 = getOrCreateSheet(ss, '7_รอบการโหวต (Rounds)', [
          'Round ID', 'Round Name', 'Subtitle', 'Description', 'Status', 'Start At', 'End At'
        ]);
        clearSheetData(sheet7);
        payload.voting_rounds.forEach(function(r) {
          sheet7.appendRow([
            r.id || '', r.round_name || '', r.subtitle || '', r.description || '', r.status || 'OPEN', r.start_at || '', r.end_at || ''
          ]);
        });
      }

      recalculateSummarySheet(ss);

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Full sync completed successfully!'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // =========================================================================
    // 2. PING / TEST CONNECTION
    // =========================================================================
    if (action === 'PING_TEST') {
      var logSheet = getOrCreateSheet(ss, '6_Audit_Logs', ['Log ID', 'User ID', 'Action', 'Details', 'Timestamp']);
      logSheet.appendRow(['test_' + Date.now(), payload.user_id || 'ADMIN', 'PING_TEST', 'Webhook Connection Verified Successfully', timestamp]);
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Google Sheets Live Sync Webhook is Active!'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // =========================================================================
    // 3. REAL-TIME EVENT-BASED INSTANT SAVE / UPDATE / DELETE
    // =========================================================================

    // (A) เพิ่มการโหวต -> บันทึกลงแท็บ 2_บันทึกการโหวต (Votes) & อัปเดตชีท 1 ทันที
    if (action === 'VOTE_CREATED') {
      var voteSheet = getOrCreateSheet(ss, '2_บันทึกการโหวต (Votes)', [
        'Vote ID', 'Round ID', 'Candidate Number', 'Candidate Nickname', 'Candidate ID', 'Voter ID', 'Voter Name', 'Voter Type', 'Timestamp'
      ]);
      var voteItems = Array.isArray(payload) ? payload : [payload];
      voteItems.forEach(function(v) {
        voteSheet.appendRow([
          v.vote_id || v.id || ('vt_' + Date.now()),
          v.round_id || 'ROUND_1',
          v.candidate_number || '',
          v.candidate_nickname || '',
          v.candidate_id || '',
          v.voter_id || '',
          v.voter_name || '',
          v.voter_type || '',
          v.created_at || timestamp
        ]);
      });
      recalculateSummarySheet(ss);
    }

    // (B) ลบผลโหวต -> ลบบรรทัดในแท็บ 2 & คำนวณชีท 1 ใหม่ทันที
    else if (action === 'VOTE_DELETED') {
      var voteSheetDel = getOrCreateSheet(ss, '2_บันทึกการโหวต (Votes)', [
        'Vote ID', 'Round ID', 'Candidate Number', 'Candidate Nickname', 'Candidate ID', 'Voter ID', 'Voter Name', 'Voter Type', 'Timestamp'
      ]);
      var targetVoteId = payload.id || payload.vote_id;
      deleteRowByValue(voteSheetDel, 1, targetVoteId);
      recalculateSummarySheet(ss);
    }

    // (C) ลงทะเบียนผู้ใช้ใหม่ -> บันทึกลงแท็บ 4_ผู้ลงทะเบียนโหวต ทันที
    else if (action === 'USER_REGISTERED') {
      var userSheet = getOrCreateSheet(ss, '4_ผู้ลงทะเบียนโหวต', [
        'User ID', 'Student ID / Name', 'User Type', 'Email', 'Role', 'Registered Timestamp'
      ]);
      userSheet.appendRow([
        payload.id || ('usr_' + Date.now()),
        payload.student_id || payload.name || '',
        payload.user_type || 'GUEST',
        payload.email || '',
        payload.role || 'VOTER',
        payload.created_at || timestamp
      ]);
    }

    // (D) จัดการผู้เข้าแข่งขัน -> เพิ่ม / แก้ไขบรรทัดเดิม / ลบบรรทัด ในแท็บ 3_รายชื่อผู้เข้าแข่งขัน ทันที
    else if (action === 'CANDIDATE_ADDED') {
      var candSheet = getOrCreateSheet(ss, '3_รายชื่อผู้เข้าแข่งขัน', [
        'Candidate ID', 'Number', 'Nickname', 'Full Name', 'Major', 'Year', 'Status', 'Image URL'
      ]);
      candSheet.appendRow([
        payload.id || ('cand_' + Date.now()),
        payload.number || '',
        payload.nickname || '',
        payload.full_name || '',
        payload.major || '',
        payload.year || 'ปี 1',
        payload.status || 'ACTIVE',
        payload.image_url || ''
      ]);
      recalculateSummarySheet(ss);
    }
    else if (action === 'CANDIDATE_UPDATED') {
      var candSheetUpd = getOrCreateSheet(ss, '3_รายชื่อผู้เข้าแข่งขัน', [
        'Candidate ID', 'Number', 'Nickname', 'Full Name', 'Major', 'Year', 'Status', 'Image URL'
      ]);
      updateRowByColumnValue(candSheetUpd, 1, payload.id, [
        payload.id, payload.number || '', payload.nickname || '', payload.full_name || '', payload.major || '', payload.year || 'ปี 1', payload.status || 'ACTIVE', payload.image_url || ''
      ]);
      recalculateSummarySheet(ss);
    }
    else if (action === 'CANDIDATE_DELETED') {
      var candSheetDel = getOrCreateSheet(ss, '3_รายชื่อผู้เข้าแข่งขัน', [
        'Candidate ID', 'Number', 'Nickname', 'Full Name', 'Major', 'Year', 'Status', 'Image URL'
      ]);
      deleteRowByValue(candSheetDel, 1, payload.id);
      recalculateSummarySheet(ss);
    }

    // (E) จัดการผู้ดูแลระบบ -> เพิ่ม / แก้ไขบรรทัดเดิม / ลบบรรทัด ในแท็บ 5_ผู้ดูแลระบบ (Admins) ทันที
    else if (action === 'ADMIN_ADDED') {
      var admSheet = getOrCreateSheet(ss, '5_ผู้ดูแลระบบ (Admins)', [
        'Admin ID', 'Username', 'Name / Title', 'PIN Password', 'Role', 'Status', 'Registered Timestamp'
      ]);
      admSheet.appendRow([
        payload.id || ('adm_' + Date.now()),
        payload.username || '',
        payload.name || '',
        payload.pin || 'admin123',
        payload.role || 'ADMIN',
        payload.status || 'ACTIVE',
        timestamp
      ]);
    }
    else if (action === 'ADMIN_UPDATED') {
      var admSheetUpd = getOrCreateSheet(ss, '5_ผู้ดูแลระบบ (Admins)', [
        'Admin ID', 'Username', 'Name / Title', 'PIN Password', 'Role', 'Status', 'Registered Timestamp'
      ]);
      updateRowByColumnValue(admSheetUpd, 1, payload.id, [
        payload.id, payload.username || '', payload.name || '', payload.pin || 'admin123', payload.role || 'ADMIN', payload.status || 'ACTIVE', timestamp
      ]);
    }
    else if (action === 'ADMIN_DELETED') {
      var admSheetDel = getOrCreateSheet(ss, '5_ผู้ดูแลระบบ (Admins)', [
        'Admin ID', 'Username', 'Name / Title', 'PIN Password', 'Role', 'Status', 'Registered Timestamp'
      ]);
      deleteRowByValue(admSheetDel, 1, payload.id);
    }

    // (F) บันทึก Audit Log -> แท็บ 6_Audit_Logs
    else if (action === 'AUDIT_LOG') {
      var logSheetSingle = getOrCreateSheet(ss, '6_Audit_Logs', [
        'Log ID', 'User ID', 'Action', 'Round ID', 'Candidate ID', 'Details', 'IP Address', 'User Agent', 'Timestamp'
      ]);
      logSheetSingle.appendRow([
        payload.id || ('log_' + Date.now()),
        payload.user_id || 'ANONYMOUS',
        payload.action || '',
        payload.round_id || '',
        payload.candidate_id || '',
        payload.details || '',
        payload.ip_address || '127.0.0.1',
        payload.user_agent || '',
        payload.timestamp || timestamp
      ]);
    }

    // (G) บันทึกรอบการโหวต & ตั้งเวลาเปิด-ปิด -> แก้ไขบรรทัดเดิมในแท็บ 7_รอบการโหวต (Rounds) ทันที
    else if (action === 'SCHEDULE_UPDATED' || action === 'ROUND_UPDATED') {
      var roundSheet = getOrCreateSheet(ss, '7_รอบการโหวต (Rounds)', [
        'Round ID', 'Round Name', 'Subtitle', 'Description', 'Status', 'Start At', 'End At'
      ]);
      var rId = payload.round_id || payload.id;
      updateRowByColumnValue(roundSheet, 1, rId, [
        rId, payload.round_name || '', payload.subtitle || '', payload.description || '', payload.status || 'OPEN', payload.start_at || '', payload.end_at || ''
      ]);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Event processed successfully: ' + action
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// =============================================================================
// HELPER FUNCTIONS & AUTOMATED RECALCULATIONS
// =============================================================================

/**
 * คำนวณสรุปผลคะแนนรวม และลำดับในชีท 1_สรุปผลอย่างเป็นทางการ โดยอัตโนมัติ 100%
 */
function recalculateSummarySheet(ss) {
  try {
    var candSheet = getOrCreateSheet(ss, '3_รายชื่อผู้เข้าแข่งขัน', [
      'Candidate ID', 'Number', 'Nickname', 'Full Name', 'Major', 'Year', 'Status', 'Image URL'
    ]);
    var voteSheet = getOrCreateSheet(ss, '2_บันทึกการโหวต (Votes)', [
      'Vote ID', 'Round ID', 'Candidate Number', 'Candidate Nickname', 'Candidate ID', 'Voter ID', 'Voter Name', 'Voter Type', 'Timestamp'
    ]);
    var summarySheet = getOrCreateSheet(ss, '1_สรุปผลอย่างเป็นทางการ', [
      'ลำดับ (Rank)', 'หมายเลข', 'ชื่อเล่น', 'ชื่อ-นามสกุล', 'สาขาวิชา', 'คะแนนโหวต (Votes)', 'รอบการโหวต', 'เวลาอัปเดตล่าสุด'
    ]);

    var candidates = candSheet.getDataRange().getValues();
    var votes = voteSheet.getDataRange().getValues();

    if (candidates.length <= 1) {
      clearSheetData(summarySheet);
      return;
    }

    // นับคะแนนโหวตแยกตาม Candidate ID หรือ Candidate Number
    var voteCounts = {};
    for (var i = 1; i < votes.length; i++) {
      var cId = String(votes[i][4] || ''); // Candidate ID
      var cNum = String(votes[i][2] || ''); // Candidate Number
      var key = cId || cNum;
      if (key) {
        voteCounts[key] = (voteCounts[key] || 0) + 1;
      }
    }

    // สร้างอาร์เรย์สรุปคะแนน
    var summaryList = [];
    for (var j = 1; j < candidates.length; j++) {
      var id = String(candidates[j][0] || '');
      var num = String(candidates[j][1] || '');
      var nick = String(candidates[j][2] || '');
      var fname = String(candidates[j][3] || '');
      var major = String(candidates[j][4] || '');
      var year = String(candidates[j][5] || 'ปี 1');
      var status = String(candidates[j][6] || 'ACTIVE');

      if (status === 'ACTIVE' || status === '') {
        var count = voteCounts[id] || voteCounts[num] || 0;
        summaryList.push({
          number: num,
          nickname: nick,
          full_name: fname,
          major: major + ' (' + year + ')',
          votes: count,
          round: 'ROUND_1'
        });
      }
    }

    // เรียงลำดับจากคะแนนมากไปน้อย
    summaryList.sort(function(a, b) {
      return b.votes - a.votes;
    });

    // เขียนข้อมูลลงชีท 1_สรุปผลอย่างเป็นทางการ
    clearSheetData(summarySheet);
    var nowStr = new Date().toISOString();
    summaryList.forEach(function(item, idx) {
      summarySheet.appendRow([
        '#' + (idx + 1),
        item.number,
        item.nickname,
        item.full_name,
        item.major,
        item.votes,
        item.round,
        nowStr
      ]);
    });

  } catch (err) {
    Logger.log('Error recalculating summary sheet: ' + err.toString());
  }
}

function readSheetAsJSON(ss, sheetName, mapperFn) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var result = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row.join('').trim() !== '') {
      result.push(mapperFn(row));
    }
  }
  return result;
}

function getOrCreateSheet(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
  }
  return sheet;
}

function clearSheetData(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }
}

function deleteRowByValue(sheet, columnIndex, value) {
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][columnIndex - 1]) === String(value)) {
      sheet.deleteRow(i + 1);
    }
  }
}

function updateRowByColumnValue(sheet, columnIndex, value, newRowValues) {
  var data = sheet.getDataRange().getValues();
  var found = false;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][columnIndex - 1]) === String(value)) {
      sheet.getRange(i + 1, 1, 1, newRowValues.length).setValues([newRowValues]);
      found = true;
      break;
    }
  }
  if (!found) {
    sheet.appendRow(newRowValues);
  }
}
