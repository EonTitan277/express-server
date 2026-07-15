# Express Server

A simple Node.js Express server with session-based authentication, rate limiting, and Docker support.

## Features

- Express.js server with session authentication
- bcrypt password hashing
- Rate limiting on login endpoint
- Fail2Ban-compatible auth logging
- Docker & Docker Compose ready
- Environment-based configuration
- **Dynamic council info injection** - Updates HTML content with environment variables on startup

## Quick Start

Server runs at `http://localhost:3000`

### Docker

```bash
docker-compose up -d --build
```

## Environment Variables

Copy the example file and customize it:

```bash
cp .env.example .env
```

Then edit `.env` with your values:
- `SESSION_SECRET` - Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `USERNAME` / `PASSWORD_HASH` - Use `node hash-passwords.js "your_password"` to generate the hash
- `COUNCIL_NAME` / `COUNCIL_PHONE` - Council contact info for HTML injection

## Dynamic Council Info Injection

On server startup, the HTML file at `public/pages/main/main-rules.html` is automatically updated:
- Elements with class `pn` are replaced with `COUNCIL_NAME` value
- Elements with class `ppn` are replaced with `COUNCIL_PHONE` value

This runs before the server starts serving requests, ensuring the static file middleware serves the updated content.

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
