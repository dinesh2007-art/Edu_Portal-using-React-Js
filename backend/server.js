const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const nodemailer = require('nodemailer');
const xlsx = require('xlsx');

// Configure Nodemailer with your SMTP settings
const transporter = nodemailer.createTransport({
    host: "smtp.example.com", // Replace with your real SMTP host
    port: 587,
    secure: false,
    auth: {
        user: "eduportal@edu.in", // The email from which the OTP is sent
        pass: "YOUR_SMTP_PASSWORD" // Replace with your real SMTP password
    }
});

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// File upload configuration
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage: storage });

// --- AUTH API Endpoints ---

// Register
app.post('/api/register', (req, res) => {
    const { name, email, password, role, dob, previousInstitution, previousCompany, gender, accommodationMode, newCourseAllotted } = req.body;
    const rollNumber = 'EDU-' + Math.floor(10000 + Math.random() * 90000);
    const defaultDepartment = 'Computer Science';
    const defaultSection = 'A';
    const defaultSemester = 1;
    const requestedRole = ['student', 'faculty', 'regular_staff', 'financial_staff'].includes(role) ? role : 'student';
    
    db.run(
        `INSERT INTO users (name, email, password, role, status, rollNumber, department, section, semester, dob, previousInstitution, previousCompany, gender, accommodationMode, newCourseAllotted) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, email, password, requestedRole, rollNumber, defaultDepartment, defaultSection, defaultSemester, dob, previousInstitution, previousCompany, gender, accommodationMode, newCourseAllotted],
        function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: "Email already exists" });
                }
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ success: true, message: "Registration successful. Pending admin approval." });
        }
    );
});

// Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ? AND password = ?`, [email, password], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: "Invalid credentials" });
        if (user.status === 'pending') return res.status(403).json({ error: "Account pending admin approval" });
        res.json({ success: true, user });
    });
});

// Forgot Password Flow
app.post('/api/forgot-password', (req, res) => {
    const { email } = req.body;
    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (!user) return res.status(404).json({ error: "No account found with that email." });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

        db.run(`INSERT INTO otps (email, otp, expiresAt) VALUES (?, ?, ?)`, [email, otp, expiresAt], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            
            const mailOptions = {
                from: '"EduPortal" <eduportal@edu.in>',
                to: email,
                subject: 'Your Password Reset OTP',
                html: `
                    <div style="font-family: sans-serif; text-align: center; padding: 20px;">
                        <h2>EduPortal Password Reset</h2>
                        <p>We received a request to reset your password. Here is your One-Time Password:</p>
                        <h1 style="color: #4f46e5; letter-spacing: 5px;">${otp}</h1>
                        <p>This code will expire in 5 minutes.</p>
                    </div>
                `
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error("Failed to send email via SMTP (using fallback console log):", error.message);
                }
                // Always log to console as a fallback during development/testing
                console.log(`\n=== OTP EMAIL LOG ===\nFrom: eduportal@edu.in\nTo: ${email}\nYour OTP is: ${otp}\n=====================\n`);
                res.json({ success: true, message: "OTP sent to your email." });
            });
        });
    });
});

app.post('/api/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    db.get(`SELECT * FROM otps WHERE email = ? AND otp = ? AND expiresAt > ?`, [email, otp, Date.now()], (err, row) => {
        if (!row) return res.status(400).json({ error: "Invalid or expired OTP." });
        res.json({ success: true, message: "OTP verified." });
    });
});

app.post('/api/reset-password', (req, res) => {
    const { email, otp, newPassword } = req.body;
    // Verify OTP one last time before resetting
    db.get(`SELECT * FROM otps WHERE email = ? AND otp = ? AND expiresAt > ?`, [email, otp, Date.now()], (err, row) => {
        if (!row) return res.status(400).json({ error: "Invalid or expired OTP." });
        
        db.run(`UPDATE users SET password = ? WHERE email = ?`, [newPassword, email], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            db.run(`DELETE FROM otps WHERE email = ?`, [email]);
            res.json({ success: true, message: "Password updated successfully!" });
        });
    });
});

// --- ADMIN API Endpoints ---

// Get all users
app.get('/api/admin/users', (req, res) => {
    db.all(`SELECT id, name, email, role, status, assignedSubjectId FROM users WHERE role != 'admin'`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Approve user
app.post('/api/admin/approve', (req, res) => {
    const { id } = req.body;
    db.run(`UPDATE users SET status = 'approved' WHERE id = ?`, [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        
        res.json({ success: true, message: "User approved" });
    });
});

// Update user role
app.post('/api/admin/role', (req, res) => {
    const { id, role } = req.body;
    if (!['student', 'faculty', 'financial_staff', 'regular_staff'].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
    }
    db.run(`UPDATE users SET role = ? WHERE id = ?`, [role, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: "User role updated" });
    });
});

// Generate Password
app.post('/api/admin/generate-password', (req, res) => {
    const { id, type } = req.body;
    
    let chars = '';
    if (type === 'numeric') chars = '0123456789';
    else if (type === 'alphanumeric') chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    else chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'; // default complex

    let newPassword = '';
    for (let i = 0; i < 8; i++) {
        newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    db.run(`UPDATE users SET password = ? WHERE id = ?`, [newPassword, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, newPassword });
    });
});

// Admin Create User (Faculty/Staff)
app.post('/api/admin/create-user', (req, res) => {
    const { name, email, role } = req.body;
    let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let newPassword = '';
    for (let i = 0; i < 8; i++) newPassword += chars.charAt(Math.floor(Math.random() * chars.length));

    db.run(`INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, 'approved')`, [name, email, newPassword, role], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: "User created", password: newPassword });
    });
});

// Admin Assign Subject to Faculty
app.post('/api/admin/assign-subject', (req, res) => {
    const { id, subjectId } = req.body;
    db.run(`UPDATE users SET assignedSubjectId = ? WHERE id = ? AND role = 'faculty'`, [subjectId, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: "Subject assigned" });
    });
});

// Admin Upload Students (Excel)
app.post('/api/admin/upload-students', upload.single('excelFile'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    try {
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
        
        let inserted = 0;
        let errors = [];

        db.serialize(() => {
            const stmt = db.prepare(`INSERT INTO users (name, email, password, role, status, rollNumber, phoneNumber, gender, accommodationMode, newCourseAllotted) VALUES (?, ?, ?, 'student', 'approved', ?, ?, ?, ?, ?)`);
            
            data.forEach(row => {
                let regNum = row['Registration Number'] || row['registrationNumber'] || row['registration_number'] || row['Roll Number'] || row['rollNumber'] || '';
                // Convert 252U1R to EDU
                if (regNum.startsWith('252U1R')) {
                    regNum = regNum.replace('252U1R', 'EDU');
                }
                
                const name = row['Name'] || row['name'] || '';
                const email = row['Email'] || row['email'] || row['Mail'] || row['mail ids'] || '';
                const phone = row['Phone'] || row['phone'] || row['Phone Number'] || '';
                const gender = row['Gender'] || row['gender'] || '';
                const accommodationMode = row['Accommodation Mode'] || row['accommodationMode'] || row['accomodation mode'] || '';
                const newCourseAllotted = row['New Course Allotted'] || row['newCourseAllotted'] || row['new course alloted'] || '';
                const password = regNum || 'student123'; // Set password to their Roll Number

                if (name && email) {
                    stmt.run([name, email, password, regNum, phone, gender, accommodationMode, newCourseAllotted], (err) => {
                        if (!err) inserted++;
                    });
                }
            });
            
            stmt.finalize(() => {
                res.json({ success: true, message: `Successfully processed ${data.length} records.` });
            });
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// --- STUDENT & FACULTY API Endpoints ---

app.get('/api/submissions', (req, res) => {
    db.all(`SELECT submissions.*, subjects.name as subjectName FROM submissions LEFT JOIN subjects ON submissions.subjectId = subjects.id`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/submit', upload.single('projectFile'), (req, res) => {
    const { userId, studentName, subjectId, assignmentType, textContent } = req.body;
    const file = req.file ? req.file.filename : null;
    const date = new Date().toLocaleDateString();

    db.run(
        `INSERT INTO submissions (userId, studentName, subjectId, assignmentType, textContent, fileName, date, marks, feedback) VALUES (?, ?, ?, ?, ?, ?, ?, '', '')`,
        [userId, studentName, subjectId, assignmentType, textContent, file, date],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ success: true, message: "Submission recorded!" });
        }
    );
});

app.post('/api/grade', (req, res) => {
    const { id, marks, feedback } = req.body;
    db.run(`UPDATE submissions SET marks = ?, feedback = ? WHERE id = ?`, [marks, feedback, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: "Grade updated!" });
    });
});

app.get('/api/approved_students', (req, res) => {
    db.all(`SELECT * FROM users WHERE role = 'student' AND status = 'approved'`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        // Map id to userId for backward compatibility where needed, though keeping id is better
        const mapped = rows.map(r => ({ ...r, userId: r.id }));
        res.json(mapped);
    });
});

// Schedules API
app.get('/api/schedules', (req, res) => {
    db.all(`SELECT schedules.*, subjects.name as subjectName, subjects.code as subjectCode FROM schedules LEFT JOIN subjects ON schedules.subjectId = subjects.id`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/schedules/add', (req, res) => {
    const { subjectId, date, time, room, type } = req.body;
    db.run(`INSERT INTO schedules (subjectId, date, time, room, type) VALUES (?, ?, ?, ?, ?)`, 
        [subjectId, date, time, room, type], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ success: true, message: "Schedule added!" });
    });
});

app.post('/api/schedules/delete', (req, res) => {
    const { id } = req.body;
    db.run(`DELETE FROM schedules WHERE id = ?`, [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: "Schedule deleted!" });
    });
});

app.get('/api/class_attendance', (req, res) => {
    const { date, subjectId, userId } = req.query;
    let query = `SELECT * FROM class_attendance WHERE 1=1`;
    let params = [];
    if (date && subjectId) {
        query += ` AND date = ? AND subjectId = ?`;
        params.push(date, subjectId);
    }
    if (userId) {
        query += ` AND userId = ?`;
        params.push(userId);
    }
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/class_attendance/update', (req, res) => {
    const { userId, name, date, subjectId, status } = req.body;
    db.get(`SELECT id FROM class_attendance WHERE userId = ? AND date = ? AND subjectId = ?`, [userId, date, subjectId], (err, row) => {
        if (row) {
            db.run(`UPDATE class_attendance SET status = ? WHERE id = ?`, [status, row.id], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, message: "Attendance updated!" });
            });
        } else {
            db.run(`INSERT INTO class_attendance (userId, name, date, subjectId, status) VALUES (?, ?, ?, ?, ?)`, [userId, name, date, subjectId, status], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, message: "Attendance logged!" });
            });
        }
    });
});

app.get('/api/subjects', (req, res) => {
    db.all(`SELECT * FROM subjects`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/subjects/add', (req, res) => {
    const { name, code } = req.body;
    db.run(`INSERT INTO subjects (name, code) VALUES (?, ?)`, [name, code], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: "Subject added!" });
    });
});

// --- STAFF API Endpoints ---

app.get('/api/staff/students', (req, res) => {
    db.all(`SELECT id, name, email, role, status FROM users WHERE role = 'student'`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/fees', (req, res) => {
    db.all(`SELECT * FROM fees`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/fees/update', (req, res) => {
    const { userId, amountDue, amountPaid, status } = req.body;
    db.get(`SELECT id FROM fees WHERE userId = ?`, [userId], (err, row) => {
        if (row) {
            db.run(`UPDATE fees SET amountDue = ?, amountPaid = ?, status = ? WHERE userId = ?`, [amountDue, amountPaid, status, userId], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, message: "Fees updated!" });
            });
        } else {
            db.run(`INSERT INTO fees (userId, amountDue, amountPaid, status) VALUES (?, ?, ?, ?)`, [userId, amountDue, amountPaid, status], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, message: "Fees created!" });
            });
        }
    });
});

app.get('/api/transcripts', (req, res) => {
    db.all(`SELECT * FROM transcripts`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/transcripts/update', (req, res) => {
    const { userId, gpa, details } = req.body;
    db.get(`SELECT id FROM transcripts WHERE userId = ?`, [userId], (err, row) => {
        if (row) {
            db.run(`UPDATE transcripts SET gpa = ?, details = ? WHERE userId = ?`, [gpa, details, userId], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, message: "Transcript updated!" });
            });
        } else {
            db.run(`INSERT INTO transcripts (userId, gpa, details) VALUES (?, ?, ?)`, [userId, gpa, details], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, message: "Transcript created!" });
            });
        }
    });
});

app.get('/api/transcripts/student/:rollNumber', (req, res) => {
    db.get(`SELECT id, name, rollNumber, department, section, phoneNumber, semester FROM users WHERE rollNumber = ? AND role = 'student'`, [req.params.rollNumber], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Student not found" });
        res.json(row);
    });
});

app.post('/api/transcripts/marks', (req, res) => {
    const { userId, marksData } = req.body;
    db.serialize(() => {
        db.run(`DELETE FROM transcript_marks WHERE userId = ?`, [userId]);
        const stmt = db.prepare(`INSERT INTO transcript_marks (userId, subjectName, marks, credits) VALUES (?, ?, ?, ?)`);
        marksData.forEach(m => {
            stmt.run([userId, m.subjectName, m.marks, m.credits]);
        });
        stmt.finalize(() => {
            res.json({ success: true, message: "Transcript marks saved!" });
        });
    });
});

// --- FACE API Endpoints ---
app.post('/api/face/enroll', (req, res) => {
    const { userId, faceDescriptor } = req.body;
    db.run(`UPDATE users SET faceDescriptor = ? WHERE id = ?`, [JSON.stringify(faceDescriptor), userId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: "Face enrolled successfully!" });
    });
});

app.get('/api/face/descriptor/:userId', (req, res) => {
    db.get(`SELECT faceDescriptor FROM users WHERE id = ?`, [req.params.userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row || !row.faceDescriptor) return res.status(404).json({ error: "No face descriptor found" });
        res.json({ descriptor: JSON.parse(row.faceDescriptor) });
    });
});

app.post('/api/student/mark-attendance', (req, res) => {
    const { userId, name, date, subjectId } = req.body;
    
    // Check if attendance is already marked for this date and subject
    db.get(`SELECT id FROM class_attendance WHERE userId = ? AND date = ? AND subjectId = ?`, [userId, date, subjectId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) {
            db.run(`UPDATE class_attendance SET status = 'Present' WHERE id = ?`, [row.id], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, message: "Attendance marked as Present!" });
            });
        } else {
            db.run(`INSERT INTO class_attendance (userId, name, date, subjectId, status) VALUES (?, ?, ?, ?, ?)`, [userId, name, date, subjectId, 'Present'], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, message: "Attendance logged successfully!" });
            });
        }
    });
});

app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));