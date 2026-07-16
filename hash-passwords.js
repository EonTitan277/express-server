const bcrypt = require('bcrypt');
const saltRounds = 12;
const password = process.argv[2]; // Get password from command line argument

if (!password) {
    console.error('Usage: node hash-passwords.js "your_password"');
    process.exit(1);
}

bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) {
        console.error('Error hashing password:', err);
        process.exit(1);
    }
    console.log('Store this hash:', hash);
});