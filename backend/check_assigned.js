const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.all("SELECT id, name, code FROM subjects", [], (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log("SUBJECTS IN DB:");
        console.log(rows);
    }
    db.close();
});
