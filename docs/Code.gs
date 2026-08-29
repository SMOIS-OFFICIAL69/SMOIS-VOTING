/**
 * MC OF ISKKU 2026 - FULL CRUD MULTI-TAB GOOGLE APPS SCRIPT WEBHOOK ENGINE (Code.gs)
 * สคริปต์บันทึกและให้ทุกอุปกรณ์ดึงข้อมูลตรงกันแบบเรียลไทม์ (Live Central Database Engine):
 * 1. 1_สรุปผลอย่างเป็นทางการ (Official Summary)
 * 2. 2_บันทึกการโหวต (Votes)
 * 3. 3_รายชื่อผู้เข้าแข่งขัน (Candidates)
 * 4. 4_ผู้ลงทะเบียนโหวต (Voters)
 * 5. 5_ผู้ดูแลระบบ (Admins)
 * 6. 6_Audit_Logs (System Audit Trail)
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
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // รอล็อกสูงสุด 10 วินาที
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Server busy, lock timeout'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'No POST body found'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = data.action || 'VOTE_CREATED';
    var payload = data.payload || {};
    var timestamp = data.timestamp || new Date().toISOString();

    // =========================================================================
    // 1. FULL SYNC (ซิงค์และอัปเดตข้อมูลทั้งหมด 6 แท็บชีทพร้อมกันในครั้งเดียว)
    // =========================================================================
    if (action === 'FULL_SYNC') {
      // 1. สรุปผลอย่างเป็นทางการ
      if (payload.summary && Array.isArray(payload.summary)) {
        var sheet1 = getOrCreateSheet(ss, '1_สรุปผลอย่างเป็นทางการ', [
          'อันดับ / ประเภท', 'หมายเลข', 'ชื่อเล่น', 'ชื่อ-นามสกุล', 'สาขาวิชา', 'คะแนนรวม', 'รอบการโหวต', 'เวลาอัปเดต'
        ]);
        clearSheetData(sheet1);
        payload.summary.forEach(function(item) {
          sheet1.appendRow([
            item.rank || '', item.number || '', item.nickname || '', item.full_name || '', item.major || '', item.votes || 0, item.round || 'ROUND_1', timestamp
          ]);
        });
      }

      // 2. รายการโหวต
      if (payload.votes && Array.isArray(payload.votes)) {
        var sheet2 = getOrCreateSheet(ss, '2_บันทึกการโหวต (Votes)', [
          'Vote ID', 'Round ID', 'Candidate Number', 'Candidate Nickname', 'Candidate ID', 'Voter ID', 'Voter Name', 'Voter Type', 'Timestamp'
        ]);
        clearSheetData(sheet2);
        payload.votes.forEach(function(v) {
          sheet2.appendRow([
            v.vote_id || v.id, v.round_id || '', v.candidate_number || '', v.candidate_nickname || '', v.candidate_id || '', v.voter_id || '', v.voter_name || '', v.voter_type || '', v.created_at || timestamp
          ]);
        });
      }

      // 3. รายชื่อผู้เข้าแข่งขัน
      if (payload.candidates && Array.isArray(payload.candidates)) {
        var sheet3 = getOrCreateSheet(ss, '3_รายชื่อผู้เข้าแข่งขัน', [
          'Candidate ID', 'Number', 'Nickname', 'Full Name', 'Major', 'Year', 'Status', 'Image URL', 'Timestamp'
        ]);
        clearSheetData(sheet3);
        payload.candidates.forEach(function(c) {
          sheet3.appendRow([
            c.id, c.number, c.nickname, c.full_name, c.major, c.year || '', c.status || 'ACTIVE', c.image_url || '', timestamp
          ]);
        });
      }

      // 4. ผู้ลงทะเบียนโหวต
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
    // 3. REAL-TIME CRUD EVENTS (เพิ่ม / แก้ไข / ลบ รายการ)
    // =========================================================================

    // (A) เพิ่ม/ลบการโหวต -> แท็บ 2_บันทึกการโหวต (Votes) & อัปเดตชีท 1_สรุปผลอย่างเป็นทางการ อัตโนมัติ
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
    else if (action === 'VOTE_DELETED') {
      var voteSheetDel = getOrCreateSheet(ss, '2_บันทึกการโหวต (Votes)', [
        'Vote ID', 'Round ID', 'Candidate Number', 'Candidate Nickname', 'Candidate ID', 'Voter ID', 'Voter Name', 'Voter Type', 'Timestamp'
      ]);
      deleteRowByValue(voteSheetDel, 1, payload.id);
      recalculateSummarySheet(ss);
    }

    // (B) เพิ่ม/ลงทะเบียนผู้ใช้ -> แท็บ 4_ผู้ลงทะเบียนโหวต
    else if (action === 'USER_REGISTERED' || action === 'STUDENT_LOGIN' || action === 'GUEST_LOGIN') {
      var userSheet = getOrCreateSheet(ss, '4_ผู้ลงทะเบียนโหวต', [
        'User ID', 'Student ID / Name', 'User Type', 'Email', 'Role', 'Registered Timestamp'
      ]);
      var u = payload;
      var existingRow = findRowByValue(userSheet, 1, u.id);
      if (!existingRow) {
        userSheet.appendRow([
          u.id || '', u.student_id || u.name || '', u.user_type || 'GUEST', u.email || '', u.role || 'VOTER', u.created_at || timestamp
        ]);
      }
    }

    // (C) ผู้ดูแลระบบ (Admins): เพิ่ม / แก้ไข / ลบ -> แท็บ 5_ผู้ดูแลระบบ (Admins)
    else if (action === 'ADMIN_ADDED' || action === 'ADMIN_UPDATED') {
      var admSheet = getOrCreateSheet(ss, '5_ผู้ดูแลระบบ (Admins)', [
        'Admin ID', 'Username', 'Name / Title', 'Role', 'Status', 'Registered Timestamp'
      ]);
      var adm = payload;
      var admRowIndex = findRowByValue(admSheet, 1, adm.id);
      if (admRowIndex) {
        admSheet.getRange(admRowIndex, 1, 1, 6).setValues([[
          adm.id, adm.username, adm.name || '', adm.role || 'ADMIN', adm.status || 'ACTIVE', timestamp
        ]]);
      } else {
        admSheet.appendRow([
          adm.id, adm.username, adm.name || '', adm.role || 'ADMIN', adm.status || 'ACTIVE', timestamp
        ]);
      }
    }
    else if (action === 'ADMIN_DELETED') {
      var admSheetDel = getOrCreateSheet(ss, '5_ผู้ดูแลระบบ (Admins)', [
        'Admin ID', 'Username', 'Name / Title', 'Role', 'Status', 'Registered Timestamp'
      ]);
      deleteRowByValue(admSheetDel, 1, payload.id);
    }

    // (D) บันทึก Audit Log -> แท็บ 6_Audit_Logs
    else if (action === 'AUDIT_LOG') {
      var auditSheet = getOrCreateSheet(ss, '6_Audit_Logs', [
        'Log ID', 'User ID', 'Action', 'Round ID', 'Candidate ID', 'Details', 'IP Address', 'User Agent', 'Timestamp'
      ]);
      var a = payload;
      auditSheet.appendRow([
        a.id || ('log_' + Date.now()), a.user_id || 'ANONYMOUS', a.action || action, a.round_id || '', a.candidate_id || '', a.details || '', a.ip_address || '127.0.0.1', a.user_agent || '', a.timestamp || timestamp
      ]);
    }

    // (E) ผู้สมัคร: เพิ่ม / แก้ไข / ลบ -> แท็บ 3_รายชื่อผู้เข้าแข่งขัน
    else if (action === 'CANDIDATE_ADDED' || action === 'CANDIDATE_UPDATED') {
      var candSheet = getOrCreateSheet(ss, '3_รายชื่อผู้เข้าแข่งขัน', [
        'Candidate ID', 'Number', 'Nickname', 'Full Name', 'Major', 'Year', 'Status', 'Image URL', 'Timestamp'
      ]);
      var c = payload;
      var cRowIndex = findRowByValue(candSheet, 1, c.id);
      if (cRowIndex) {
        candSheet.getRange(cRowIndex, 1, 1, 9).setValues([[
          c.id, c.number, c.nickname, c.full_name, c.major, c.year || '', c.status || 'ACTIVE', c.image_url || '', timestamp
        ]]);
      } else {
        candSheet.appendRow([
          c.id, c.number, c.nickname, c.full_name, c.major, c.year || '', c.status || 'ACTIVE', c.image_url || '', timestamp
        ]);
      }
    }
    else if (action === 'CANDIDATE_DELETED') {
      var candSheetDel = getOrCreateSheet(ss, '3_รายชื่อผู้เข้าแข่งขัน', [
        'Candidate ID', 'Number', 'Nickname', 'Full Name', 'Major', 'Year', 'Status', 'Image URL', 'Timestamp'
      ]);
      deleteRowByValue(candSheetDel, 1, payload.id);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateSheet(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#1e293b');
    headerRange.setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function clearSheetData(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }
}

function findRowByValue(sheet, colIndex, targetValue) {
  if (!targetValue) return null;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][colIndex - 1] === targetValue) {
      return i + 1;
    }
  }
  return null;
}

function deleteRowByValue(sheet, colIndex, targetValue) {
  var rowIndex = findRowByValue(sheet, colIndex, targetValue);
  if (rowIndex) {
    sheet.deleteRow(rowIndex);
    return true;
  }
  return false;
}

function readSheetAsJSON(ss, sheetName, mapFunction) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var results = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] !== "" && data[i][0] !== null) {
      results.push(mapFunction(data[i]));
    }
  }
  return results;
}

function recalculateSummarySheet(ss) {
  try {
    var voteSheet = ss.getSheetByName('2_บันทึกการโหวต (Votes)');
    var candSheet = ss.getSheetByName('3_รายชื่อผู้เข้าแข่งขัน');
    var summarySheet = getOrCreateSheet(ss, '1_สรุปผลอย่างเป็นทางการ', [
      'อันดับ / ประเภท', 'หมายเลข', 'ชื่อเล่น', 'ชื่อ-นามสกุล', 'สาขาวิชา', 'คะแนนรวม', 'รอบการโหวต', 'เวลาอัปเดต'
    ]);

    if (!candSheet || candSheet.getLastRow() <= 1) return;

    // 1. Tally votes from Sheet 2
    var voteTally = {};
    if (voteSheet && voteSheet.getLastRow() > 1) {
      var voteData = voteSheet.getDataRange().getValues();
      for (var i = 1; i < voteData.length; i++) {
        var cId = String(voteData[i][4] || '');
        var rId = String(voteData[i][1] || 'ROUND_1');
        if (cId) {
          var key = rId + '_' + cId;
          voteTally[key] = (voteTally[key] || 0) + 1;
        }
      }
    }

    // 2. Read candidates from Sheet 3
    var candData = candSheet.getDataRange().getValues();
    var candidatesList = [];
    for (var j = 1; j < candData.length; j++) {
      var candId = String(candData[j][0] || '');
      if (candId) {
        candidatesList.push({
          id: candId,
          number: String(candData[j][1] || ''),
          nickname: String(candData[j][2] || ''),
          full_name: String(candData[j][3] || ''),
          major: String(candData[j][4] || ''),
          year: String(candData[j][5] || ''),
          votes_r1: voteTally['ROUND_1_' + candId] || 0,
          votes_r2: voteTally['ROUND_2_' + candId] || 0
        });
      }
    }

    // 3. Rewrite Sheet 1 with updated totals and ranks
    clearSheetData(summarySheet);
    var nowStr = new Date().toLocaleString('th-TH');

    // Round 1
    var listR1 = candidatesList.slice().sort(function(a, b) { return b.votes_r1 - a.votes_r1; });
    listR1.forEach(function(c, idx) {
      summarySheet.appendRow([
        '#' + (idx + 1), c.number, c.nickname, c.full_name, c.major, c.votes_r1, 'ROUND_1', nowStr
      ]);
    });

    // Round 2
    var listR2 = candidatesList.slice().sort(function(a, b) { return b.votes_r2 - a.votes_r2; });
    listR2.forEach(function(c, idx) {
      summarySheet.appendRow([
        '#' + (idx + 1), c.number, c.nickname, c.full_name, c.major, c.votes_r2, 'ROUND_2', nowStr
      ]);
    });
  } catch (err) {
    Logger.log('recalculateSummarySheet error: ' + err);
  }
}
