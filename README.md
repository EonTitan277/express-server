# Express Server

A simple Node.js Express server with session-based authentication, rate limiting, and Docker support.

## Features

- Express.js server with session authentication
- bcrypt password hashing
- Rate limiting on login endpoint
- Fail2Ban-compatible auth logging
- Docker & Docker Compose ready
- Environment-based configuration

## Quick Start

Server runs at `http://localhost:3000`

### Docker

```bash
docker-compose up -d --build
```

## Environment Variables

Create a `.env` file with:

```env
PORT=3000
USERNAME=your_username
PASSWORD_HASH=your_bcrypt_hash
SESSION_SECRET=your_secret_key
```

Generate a password hash:
```bash
node hash-passwords.js "your_password"
```

## Project Structure

```
express-server/
├── server.js           # Main Express app
├── hash-passwords.js   # Password hashing utility
├── package.json
├── Dockerfile
├── docker-compose.yml
├── .env                # Your config (not committed)
├── logs/               # Auth logs for Fail2Ban
└── public/             # Static files (mounted in Docker)
```

## Security Features

1. **Password Hashing** - bcrypt with 10 salt rounds
2. **HTTP-only Cookies** - Sessions inaccessible to JavaScript
3. **Secure Session Config** - `resave: false`, `saveUninitialized: false`
4. **Rate Limiting** - 4 attempts per 15 minutes per IP
5. **Fail2Ban Logging** - Structured logs for automated banning
6. **Proxy-aware IP Detection** - Reads `X-Forwarded-For` header
7. **Static File Protection** - All routes except `/` require auth

## Generating a Secure Session Secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
