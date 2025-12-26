# Township 311 System

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT">
  <img src="https://img.shields.io/badge/React-18-61DAFB.svg" alt="React 18">
  <img src="https://img.shields.io/badge/FastAPI-0.109-009688.svg" alt="FastAPI">
  <img src="https://img.shields.io/badge/PostgreSQL-15-336791.svg" alt="PostgreSQL 15">
</p>

A white-label, open-source civic engagement platform for municipal request management (311 system). Features AI-powered triage, GIS integration, and a premium glassmorphism UI. Built for on-premises government deployment.

## ✨ Features

- **Open311 Compliant** - GeoReport v2 compatible API
- **Premium Glassmorphism UI** - Modern, responsive design
- **Mobile-First** - App-like experience on mobile devices
- **AI Triage** - Optional Vertex AI integration for request analysis
- **GIS Ready** - PostGIS for spatial queries and geocoding
- **White-Label** - Fully customizable branding
- **Self-Hosted** - Data sovereignty with on-premises deployment

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/WestWindsorForward/WWF-Open-Source-311-Template.git
   cd WWF-Open-Source-311-Template
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Start the services**
   ```bash
   docker-compose up -d
   ```

4. **Access the portals**
   - 🏠 **Resident Portal**: http://localhost/
   - 👷 **Staff Dashboard**: http://localhost/staff
   - ⚙️ **Admin Console**: http://localhost/admin
   - 📚 **API Docs**: http://localhost/api/docs

### Default Credentials

| Portal | Username | Password |
|--------|----------|----------|
| Staff/Admin | `admin` | `admin123` |

> ⚠️ **Change these in production!**

## 📱 User Roles

| Role | Capabilities |
|------|-------------|
| **Resident** | Submit requests (no login required) |
| **Staff** | View/update requests, manual intake, statistics |
| **Admin** | All staff permissions + user management, branding, settings |

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Tailwind CSS, Framer Motion |
| Backend | FastAPI, Python 3.11, SQLAlchemy Async |
| Database | PostgreSQL 15 + PostGIS |
| Queue | Celery + Redis |
| AI | Google Vertex AI (optional) |
| Proxy | Caddy (auto-SSL) |
| Container | Docker Compose |

## 📁 Project Structure

```
township-311/
├── backend/
│   ├── app/
│   │   ├── api/          # API route handlers
│   │   ├── core/         # Auth, config, Celery
│   │   ├── db/           # Database session & init
│   │   ├── services/     # Business logic
│   │   ├── tasks/        # Background tasks
│   │   ├── main.py       # FastAPI app
│   │   ├── models.py     # SQLAlchemy models
│   │   └── schemas.py    # Pydantic schemas
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── context/      # React contexts
│   │   ├── pages/        # Page components
│   │   ├── services/     # API client
│   │   └── types/        # TypeScript types
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── Caddyfile
└── .env.example
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DOMAIN` | Your domain for SSL | `localhost` |
| `SECRET_KEY` | JWT signing key | (change me!) |
| `DB_PASSWORD` | Database password | `township` |
| `INITIAL_ADMIN_PASSWORD` | Default admin password | `admin123` |

### Admin Console

Access `/admin` to configure:

- **Branding**: Municipality name, logo, colors
- **Users**: Staff and admin accounts
- **Services**: Request categories
- **API Keys**: Vertex AI, Twilio, Google Maps
- **Modules**: Enable/disable AI and SMS features

## 🔄 Updates

From the Admin Console, click "Pull Updates" to:
1. Fetch latest code from GitHub
2. Rebuild Docker containers
3. Restart services

Or manually:
```bash
git pull origin main
docker-compose build --no-cache
docker-compose up -d
```

## 📖 API Documentation

Interactive API documentation available at `/api/docs` (Swagger UI) or `/api/redoc` (ReDoc).

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/services/` | GET | List service categories |
| `/api/open311/v2/requests.json` | POST | Submit request (public) |
| `/api/open311/v2/requests.json` | GET | List requests (staff) |
| `/api/auth/login` | POST | OAuth2 login |
| `/api/system/settings` | GET/POST | Branding settings |

## 🔒 Security

- Passwords hashed with bcrypt
- JWT tokens for authentication
- CORS configured for API protection
- Caddy provides automatic HTTPS
- PII hidden from public endpoints

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines before submitting PRs.

---

<p align="center">
  Built with ❤️ for civic engagement
</p>
