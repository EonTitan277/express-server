const bcrypt = require('bcrypt');
const saltRounds = 12;
const password = 'your_secure_password'; // Replace with your desired password

bcrypt.hash(password, saltRounds, (err, hash) => {
    console.log('Store this hash:', hash);
});