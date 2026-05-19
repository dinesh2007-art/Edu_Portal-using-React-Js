const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        
        // Initialize tables
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                email TEXT UNIQUE,
                password TEXT,
                role TEXT,
                status TEXT,
                faceDescriptor TEXT,
                rollNumber TEXT,
                phoneNumber TEXT,
                department TEXT,
                section TEXT,
                semester INTEGER
            )`);
            
            // Migrate existing tables
            db.run(`ALTER TABLE users ADD COLUMN faceDescriptor TEXT`, (err) => {});
            db.run(`ALTER TABLE users ADD COLUMN rollNumber TEXT`, (err) => {
                if (!err) {
                    // Generate random roll numbers for existing users
                    db.run(`UPDATE users SET rollNumber = 'EDU-' || abs(random() % 90000 + 10000) WHERE rollNumber IS NULL`);
                }
            });
            db.run(`ALTER TABLE users ADD COLUMN phoneNumber TEXT`, (err) => {});
            db.run(`ALTER TABLE users ADD COLUMN department TEXT`, (err) => {});
            db.run(`ALTER TABLE users ADD COLUMN section TEXT`, (err) => {});
            db.run(`ALTER TABLE users ADD COLUMN semester INTEGER`, (err) => {});
            db.run(`ALTER TABLE users ADD COLUMN dob TEXT`, (err) => {});
            db.run(`ALTER TABLE users ADD COLUMN previousInstitution TEXT`, (err) => {});
            db.run(`ALTER TABLE users ADD COLUMN previousCompany TEXT`, (err) => {});
            db.run(`ALTER TABLE users ADD COLUMN assignedSubjectId INTEGER`, (err) => {});
            db.run(`ALTER TABLE users ADD COLUMN gender TEXT`, (err) => {});
            db.run(`ALTER TABLE users ADD COLUMN accommodationMode TEXT`, (err) => {});
            db.run(`ALTER TABLE users ADD COLUMN newCourseAllotted TEXT`, (err) => {});

            db.run(`CREATE TABLE IF NOT EXISTS submissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER,
                studentName TEXT,
                subjectId INTEGER,
                assignmentType TEXT,
                textContent TEXT,
                fileName TEXT,
                date TEXT,
                marks TEXT,
                feedback TEXT
            )`);
            db.run(`ALTER TABLE submissions ADD COLUMN subjectId INTEGER`, (err) => {});

            db.run(`CREATE TABLE IF NOT EXISTS attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER,
                name TEXT,
                status TEXT
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS subjects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                code TEXT,
                semester INTEGER
            )`);
            db.run(`ALTER TABLE subjects ADD COLUMN semester INTEGER`, (err) => {});

            db.run(`CREATE TABLE IF NOT EXISTS schedules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                subjectId INTEGER,
                date TEXT,
                time TEXT,
                room TEXT,
                type TEXT
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS class_attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER,
                name TEXT,
                date TEXT,
                subjectId INTEGER,
                status TEXT
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS fees (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER,
                amountDue TEXT,
                amountPaid TEXT,
                status TEXT
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS transcripts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER,
                gpa TEXT,
                details TEXT
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS transcript_marks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId INTEGER,
                subjectName TEXT,
                marks TEXT,
                credits TEXT
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS otps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT,
                otp TEXT,
                expiresAt INTEGER
            )`);

            // Seed Admin User
            db.get(`SELECT * FROM users WHERE role = 'admin'`, (err, row) => {
                if (!row) {
                    db.run(`INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)`,
                        ['Admin User', 'admin@edu.com', 'admin123', 'admin', 'approved']
                    );
                    console.log('Seeded initial admin user (admin@edu.com / admin123)');
                }
            });

            // Seed Faculty User
            db.get(`SELECT * FROM users WHERE role = 'faculty'`, (err, row) => {
                if (!row) {
                    db.run(`INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)`,
                        ['Faculty User', 'faculty@edu.com', 'faculty123', 'faculty', 'approved']
                    );
                    console.log('Seeded initial faculty user (faculty@edu.com / faculty123)');
                }
            });

            // Seed Financial Staff User
            db.get(`SELECT * FROM users WHERE role = 'financial_staff'`, (err, row) => {
                if (!row) {
                    db.run(`INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)`,
                        ['Finance Staff', 'finance@edu.com', 'finance123', 'financial_staff', 'approved']
                    );
                    console.log('Seeded initial financial staff user (finance@edu.com / finance123)');
                }
            });

            // Migrate old 'staff' role to 'regular_staff'
            db.run(`UPDATE users SET role = 'regular_staff' WHERE role = 'staff'`);

            // Seed Regular Staff User
            db.get(`SELECT * FROM users WHERE email = 'staff@edu.com'`, (err, row) => {
                if (!row) {
                    db.run(`INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)`,
                        ['Regular Staff', 'staff@edu.com', 'staff123', 'regular_staff', 'approved']
                    );
                    console.log('Seeded initial regular staff user (staff@edu.com / staff123)');
                }
            });

            // Seed Subjects
            db.get(`SELECT COUNT(*) as count FROM subjects`, (err, row) => {
                if (row && row.count === 0) {
                    const initialSubjects = [
                        ['React.js', 'CS101', 1],
                        ['Node.js', 'CS102', 1],
                        ['Python Programming', 'CS103', 1],
                        ['Basic HTML and CSS', 'CS104', 1],
                        ['Tailwind CSS', 'CS105', 1],
                        ['Database Management Systems', 'CS106', 1],
                        ['Machine Learning', 'CS201', 2]
                    ];
                    initialSubjects.forEach(([name, code, semester]) => {
                        db.run(`INSERT INTO subjects (name, code, semester) VALUES (?, ?, ?)`, [name, code, semester]);
                    });
                    console.log('Seeded initial curriculum subjects with semesters.');
                }
            });
        });
    }
});

module.exports = db;
