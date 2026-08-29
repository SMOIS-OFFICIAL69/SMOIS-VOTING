# 🎤 MC OF ISKKU 2026 - ระบบโหวตออนไลน์ (Online Voting System)

ระบบโหวตออนไลน์สำหรับการแข่งขัน **MC OF ISKKU 2026** พัฒนาขึ้นเพื่อใช้คัดเลือกผู้เข้าแข่งขันผ่านคะแนนโหวตจากผู้ชมจำนวน 2 รอบ ได้แก่:
1. **VOTE ROUND 1** : คัดเลือกผู้เข้าแข่งขันเข้าสู่ **TOP 10** (กรรมการ 9 คน + Vote Wild Card 1 คน)
2. **VOTE ROUND 2** : คัดเลือกผู้เข้าแข่งขันเข้าสู่ **TOP 6** (กรรมการ 5 คน + Vote Wild Card 1 คน)

ระบบถูกออกแบบเน้น **Mobile-First UX/UI**, มีระบบป้องกันการโหวตซ้ำด้วย **Database Unique Constraint `UNIQUE(voter_id, round_id)`**, **Google Authentication**, **Admin Control Dashboard**, **ระบบตั้งเวลา (Scheduler)**, **ระบบคำนวณ Wild Card อัตโนมัติ (ข้ามผู้ชนะที่ผ่านจากกรรมการแล้ว)**, **Audit Log ย้อนหลัง**, และ **การส่งออกผลคะแนน (CSV/PDF)**

---

## 🌟 ฟีเจอร์สำคัญของระบบ (Key Features)

### 1. ระบบยืนยันตัวตน (Authentication)
- รองรับ **Google Login** เพื่อยืนยันตัวตนก่อนโหวต
- ตรวจสอบสถานะการโหวตทันที หากเคยโหวตแล้วจะแสดงข้อความ *"คุณได้ใช้สิทธิ์โหวตในรอบนี้แล้ว"*

### 2. ป้องกันการโหวตซ้ำ (Anti-Duplicate Vote)
- กำหนด Unique Constraint ที่ฐานข้อมูล: `UNIQUE(voter_id, round_id)`
- รองรับ Atomic Transaction Lock ป้องกันการกดส่ง Request พร้อมกันหลายครั้งหรือเปิดหลาย Tab
- ผู้โหวตมีสิทธิ์โหวต 1 ครั้งใน ROUND 1 และอีก 1 ครั้งใน ROUND 2 (สิทธิ์แยกกันเด็ดขาด)

### 3. ระบบ Admin & สรุปผล Wild Card อัตโนมัติ (Rule #10)
- **Single Active Round Mutex**: ห้ามเปิด ROUND 1 และ ROUND 2 พร้อมกันในเวลาเดียวกัน
- **Wild Card Tie-Breaker**: กรณีผู้ที่มีคะแนนโหวตสูงสุดถูกเลือกโดยกรรมการแล้ว ระบบจะมอบสิทธิ์ Wild Card ให้ผู้ที่มีคะแนนโหวตอันดับถัดไปที่ยังไม่ผ่านจากกรรมการโดยอัตโนมัติ
- **Confirmation Modal**: มีหน้าต่างยืนยันก่อนเปิด-ปิดการโหวตทุกครั้ง
- **Audit Logs**: บันทึกทุกกิจกรรมย้อนหลัง (LOGIN, VOTE, OPEN, CLOSE, GENERATE, PUBLISH)
- **Export Data**: ส่งออกไฟล์ CSV รายชื่อผู้โหวต, สรุปอันดับ Leaderboard และพิมพ์รายงานสรุป (PDF)

### 4. หน้าประกาศผลการโหวต (Public Result Page)
- ก่อน Admin กด Publish: แสดงสถานะ `🔒 RESULT NOT AVAILABLE`
- หลัง Admin กด Publish: แสดงป้ายประกาศผล `🎉 VOTE RESULT` อย่างเป็นทางการพร้อมชื่อผู้ชนะ Wild Card

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```text
d:\SMOIS\student-club-web\FA\
├── index.html                 # หน้าแรกสำหรับผู้ชม (Voter Landing Page & Card Grid)
├── admin.html                 # หน้าสำหรับผู้ดูแลระบบ (Admin Dashboard & Control)
├── results.html               # หน้าประกาศผลอย่างเป็นทางการ (Public Result Page)
├── css/
│   └── style.css              # Custom Glassmorphism & Mobile-First Design System
├── js/
│   ├── app.js                 # ควบคุมหน้าโหวตสำหรับผู้ชม & Countdown Timer
│   ├── admin.js               # ควบคุมหน้า Admin, Audit Log & คำนวณ Wild Card
│   ├── results.js             # ควบคุมการแสดงผลการโหวตสู่สาธารณะ
│   └── backend-db.js          # Core Database Engine, Unique Locks & Audit Logger
├── db/
│   └── schema.sql             # ไฟล์โครงสร้าง SQLite Database Schema & Seed Data
├── assets/
│   └── candidates/            # รูปภาพผู้เข้าแข่งขัน MC OF ISKKU 2026
├── server.js                  # Express.js REST API Server (กรณีรันแบบ Node Backend)
├── package.json               # Node.js Dependencies configuration
├── README.md                  # เอกสารแนะนำและวิธีการติดตั้งใช้งาน
└── docs/
    ├── ADMIN_GUIDE.md         # คู่มือการใช้งานสำหรับ Admin
    └── VOTER_GUIDE.md         # คู่มือการใช้งานสำหรับผู้โหวต
```

---

## 🚀 วิธีการติดตั้งและเปิดใช้งาน (Installation & Setup Guide)

### วิธีที่ 1: เปิดใช้งานผ่าน เว็บเบราว์เซอร์ โดยตรง (Out-of-the-Box Local Mode)
ระบบถูกสร้างให้สามารถทำงานได้ทันทีโดยไม่ต้องติดตั้งโปรแกรมเพิ่มเติม (มี In-Browser SQLite Engine & LocalStorage Persistence)
1. เปิดไฟล์ [index.html](file:///d:/SMOIS/student-club-web/FA/index.html) ผ่าน Chrome / Edge / Safari หรือ VS Code Live Server
2. เข้าสู่หน้า Admin ผ่านลิงก์ด้านล่างเว็บไซต์ หรือเปิด [admin.html](file:///d:/SMOIS/student-club-web/FA/admin.html)
   - **Admin Passcode / PIN**: `admin123`

### วิธีที่ 2: รันผ่าน Node.js Express REST API Server
หากต้องการรันในสภาพแวดล้อม Node.js Server:
```bash
# 1. ติดตั้ง Package Dependencies
npm install

# 2. เริ่มต้นการทำงานของ Server
npm start
```
เปิดเบราว์เซอร์ไปที่: `http://localhost:3000`

---

## 🧪 รายการทดสอบระบบ (Test Cases Checklist)

ก่อนนำระบบไปใช้งานจริง ได้ผ่านการทดสอบครอบคลุมทุกกรณีตามข้อ 30 ใน Prompt ดังนี้:

- [x] **Login สำเร็จ & ไม่สำเร็จ**: ทดสอบล็อกอินด้วย Google Account และจำลองบัญชีผู้ใช้
- [x] **Vote ครั้งแรก**: สามารถลงคะแนนสำเร็จ ได้รับ Vote ID และใบเสร็จยืนยัน (Receipt)
- [x] **Vote ครั้งที่สองในรอบเดิม**: ระบบปฏิเสธพร้อมข้อความ *"คุณได้ใช้สิทธิ์โหวตในรอบนี้แล้ว"*
- [x] **สิทธิ์แยก ROUND 1 และ ROUND 2**: โหวต ROUND 1 สำเร็จ เมื่อเปลี่ยนเข้า ROUND 2 สามารถโหวตได้อีก 1 ครั้ง
- [x] **เปิด-ปิดการโหวต**: ปุ่ม OPEN / CLOSE ทำงานพร้อม Popup ยืนยัน
- [x] **ห้ามเปิด 2 รอบพร้อมกัน (Mutex Rule)**: พยายามเปิด ROUND 2 ขณะที่ ROUND 1 เปิดอยู่ -> ระบบบล็อกและแจ้งเตือน
- [x] **หมดเวลาการโหวต (Timer Auto-Close)**: เมื่อหมดเวลา สถานะเปลี่ยนเป็น VOTING CLOSED อัตโนมัติ
- [x] **Request ซ้ำพร้อมกัน (Concurrency Lock)**: ป้องกันไม่ให้เกิด Vote เกิน 1 รายการ
- [x] **Wild Card กรณีอันดับ 1 จาก Vote ผ่านจากกรรมการแล้ว (Rule #10)**: 
  - ตัวอย่าง: เลือก A เป็นผู้ผ่านเข้ารอบจากกรรมการ แต่ A มีคะแนนโหวตอันดับ 1 -> ระบบข้าม A และมอบสิทธิ์ Wild Card ให้ F (อันดับ 2 ที่ยังไม่ผ่านจากกรรมการ)
- [x] **Export ผลคะแนน**: ส่งออกไฟล์ CSV Vote Details, Leaderboard และ Print PDF Report

---

## 🛡️ การรักษาความปลอดภัยและความเป็นส่วนตัว (Privacy & Security)

1. **ไม่แสดงคะแนนแบบ Real-time ให้ผู้ชม**: แสดงเพียง *"ขอบคุณทุกคะแนนโหวต"* หรือ *"มีผู้ใช้สิทธิ์แล้ว XXX คน"* เพื่อป้องกันการปั่นคะแนน
2. **ไม่เปิดเผยข้อมูลส่วนตัว**: อีเมลและ Google User ID จะไม่ถูกแสดงต่อสาธารณะ
3. **Immutability**: เมื่อบันทึก Vote เข้าสู่ระบบแล้ว จะไม่สามารถแก้ไขหรือลบโดยผู้โหวตได้

---

© 2026 MC OF ISKKU. Organised by Student Club.
