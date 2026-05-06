# Unloved Productions Ecosystem — Pop!_OS Setup Guide

**System:** Razer Blade 15 Advanced (RTX 3080 16GB / i9-11900H / 32GB DDR4)  
**OS:** Pop!_OS 22.04 LTS (NVIDIA ISO recommended)

---

## Table of Contents

1. [System Prerequisites](#1-system-prerequisites)
2. [NVIDIA Drivers & CUDA](#2-nvidia-drivers--cuda)
3. [Ollama Setup](#3-ollama-setup)
4. [MySQL via Docker (for APF)](#4-mysql-via-docker-for-apf)
5. [APF Setup](#5-apf-setup)
6. [ShadowCast Setup](#6-shadowcast-setup)
7. [Mission Control Setup](#7-mission-control-setup)
8. [Connecting Everything](#8-connecting-everything)
9. [Startup Script (One Command)](#9-startup-script-one-command)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. System Prerequisites

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essentials
sudo apt install -y build-essential git curl wget unzip software-properties-common

# Python 3.10+ (comes with Pop!_OS 22.04)
sudo apt install -y python3 python3-pip python3-venv python3-dev

# Node.js 20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
python3 --version   # Should be 3.10+
node --version      # Should be 20+
npm --version       # Should be 10+

# Docker (needed for MySQL)
sudo apt install -y docker.io docker-compose
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
# LOG OUT AND BACK IN for docker group to take effect
```

---

## 2. NVIDIA Drivers & CUDA

Pop!_OS with the NVIDIA ISO comes with drivers pre-installed. Verify:

```bash
nvidia-smi
# Should show RTX 3080 with driver 535+ and CUDA 12.x
```

If not installed or outdated:

```bash
sudo apt install -y system76-cuda-latest
# Reboot after install
sudo reboot
```

For Ollama GPU acceleration, you need the NVIDIA Container Toolkit (optional, only if running Ollama in Docker):

```bash
# Not needed if running Ollama natively (recommended)
```

---

## 3. Ollama Setup

Ollama runs your local LLMs. Install natively (not Docker) for best GPU performance:

```bash
curl -fsSL https://ollama.com/install.sh | sh

# Start Ollama service
ollama serve &

# Pull recommended models for your RTX 3080 (16GB VRAM)
ollama pull llama3.1:8b              # Fast all-rounder (5GB VRAM) — scripts & analysis
ollama pull mistral:7b-instruct      # Creative writing alternative (4.5GB VRAM)
ollama pull qwen2.5:14b-instruct-q5_K_M  # Heavy reasoning (12GB VRAM) — deep analysis

# Verify
ollama list
curl http://localhost:11434/api/tags
```

**VRAM Budget on your RTX 3080 16GB:**

| Model | VRAM Usage | Best For |
|-------|-----------|----------|
| llama3.1:8b | ~5GB | Script generation, product analysis |
| mistral:7b-instruct | ~4.5GB | Creative writing, hooks |
| qwen2.5:14b-instruct-q5_K_M | ~12GB | Deep reasoning, complex analysis |

> **Tip:** Only one model loads into VRAM at a time by default. Ollama auto-unloads idle models after 5 minutes.

To make Ollama start on boot:

```bash
sudo systemctl enable ollama
```

---

## 4. MySQL via Docker (for APF)

APF requires MySQL. Easiest way is Docker:

```bash
# Create a persistent data directory
mkdir -p ~/docker-data/mysql

# Run MySQL 8
docker run -d \
  --name apf-mysql \
  --restart unless-stopped \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=unloveddev \
  -e MYSQL_DATABASE=apf \
  -v ~/docker-data/mysql:/var/lib/mysql \
  mysql:8

# Verify it's running
docker ps | grep apf-mysql

# Test connection (wait ~10 seconds for MySQL to initialize)
docker exec apf-mysql mysql -uroot -punloveddev -e "SELECT 1;"
```

The MySQL container will auto-restart on boot thanks to `--restart unless-stopped`.

---

## 5. APF Setup

```bash
# Clone the repo
cd ~/projects
git clone https://github.com/unlovedproductions/APF.git
cd APF

# Install dependencies
npm install

# Create .env file
cat > .env << 'EOF'
DATABASE_URL=mysql://root:unloveddev@localhost:3306/apf
PORT=3000
NODE_ENV=development
EOF
```

**Important:** APF uses Manus OAuth for authentication. For local development without OAuth, you have two options:

**Option A — Run in dev mode (recommended for testing with MC):**
```bash
npm run dev
```
The server starts on port 3000. The `/api/health` endpoint works without auth. Product endpoints require auth via the tRPC session cookie.

**Option B — If you need to bypass auth for local MC integration:**
Add this to `server/_core/trpc.ts` temporarily:

```typescript
// Add after the existing protectedProcedure export
export const localProcedure = t.procedure; // No auth required
```

Then in `server/routers.ts`, create a local products endpoint that uses `localProcedure` instead of `protectedProcedure`.

**Push the database schema:**
```bash
npm run db:push
```

**Start APF:**
```bash
npm run dev
# Runs on http://localhost:3000
```

---

## 6. ShadowCast Setup

```bash
# Clone the repo
cd ~/projects
git clone https://github.com/unlovedproductions/shadowcast-.git shadowcast
cd shadowcast/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Install system dependencies for video rendering
sudo apt install -y ffmpeg libsm6 libxext6 libgl1-mesa-glx

# Install fonts (ShadowCast uses custom fonts in assets/)
# The repo includes fonts, but if missing:
sudo apt install -y fonts-inter fonts-roboto
```

**Configure Ollama as LLM provider:**

ShadowCast auto-detects Ollama at `http://localhost:11434`. To verify or change, start the app and use the `/api/config` endpoint or the frontend settings.

**Start ShadowCast:**
```bash
cd ~/projects/shadowcast/backend
source venv/bin/activate
python3 app.py
# Runs on http://localhost:8000
```

**Verify:**
```bash
curl http://localhost:8000/api/health
# Should return: {"status":"ok","app":"ShadowCast","version":"4.0"}
```

---

## 7. Mission Control Setup

```bash
# Clone the repo
cd ~/projects
git clone https://github.com/unlovedproductions/mission-control.git
cd mission-control

# Backend setup
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Start backend (in one terminal)
uvicorn main:app --host 0.0.0.0 --port 8100 --reload

# Frontend setup (in another terminal)
cd ~/projects/mission-control/frontend
npm install
npm run dev
# Runs on http://localhost:3100
```

**Verify:**
```bash
curl http://localhost:8100/api/health
# Should return: {"status":"ok"}

# Check all services
curl http://localhost:8100/api/status/services
# Should show shadowcast: online, apf: online, ollama: online
```

---

## 8. Connecting Everything

Once all three apps + Ollama are running, Mission Control auto-detects them at these default URLs:

| Service | URL | Port |
|---------|-----|------|
| ShadowCast | http://localhost:8000 | 8000 |
| APF | http://localhost:3000 | 3000 |
| Ollama | http://localhost:11434 | 11434 |
| Mission Control Backend | http://localhost:8100 | 8100 |
| Mission Control Frontend | http://localhost:3100 | 3100 |

If any service runs on a different port, update it in Mission Control's Settings page (http://localhost:3100/settings).

**Data Flow:**
1. APF scrapes affiliate products from marketplaces
2. Mission Control imports products from APF via tRPC
3. You select a product and create a video job
4. Mission Control sends the job to ShadowCast's `/api/generate`
5. ShadowCast uses Ollama to generate scripts, then renders video
6. Mission Control polls ShadowCast for completion and stores the result

---

## 9. Startup Script (One Command)

Create a startup script to launch everything:

```bash
cat > ~/start-ecosystem.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting Unloved Productions Ecosystem..."

# Start MySQL (if not already running)
docker start apf-mysql 2>/dev/null || echo "MySQL already running"

# Start Ollama (if not already running)
pgrep -x ollama > /dev/null || (ollama serve &)
sleep 2

# Start APF
echo "Starting APF..."
cd ~/projects/APF
npm run dev &
APF_PID=$!

# Start ShadowCast
echo "Starting ShadowCast..."
cd ~/projects/shadowcast/backend
source venv/bin/activate
python3 app.py &
SC_PID=$!

# Start Mission Control Backend
echo "Starting Mission Control Backend..."
cd ~/projects/mission-control/backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8100 &
MC_PID=$!

# Start Mission Control Frontend
echo "Starting Mission Control Frontend..."
cd ~/projects/mission-control/frontend
npm run dev &
FE_PID=$!

sleep 5
echo ""
echo "✅ Ecosystem is running!"
echo "   Mission Control: http://localhost:3100"
echo "   ShadowCast:      http://localhost:8000"
echo "   APF:             http://localhost:3000"
echo "   Ollama:          http://localhost:11434"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait and cleanup on exit
trap "kill $APF_PID $SC_PID $MC_PID $FE_PID 2>/dev/null; echo 'Stopped.'" EXIT
wait
EOF

chmod +x ~/start-ecosystem.sh
```

**Usage:**
```bash
~/start-ecosystem.sh
```

---

## 10. Troubleshooting

| Issue | Solution |
|-------|----------|
| `nvidia-smi` not found | Install NVIDIA drivers: `sudo apt install system76-driver-nvidia` |
| Ollama "no GPU detected" | Verify CUDA: `nvcc --version`. If missing: `sudo apt install system76-cuda-latest` |
| MySQL won't start | Check Docker: `docker logs apf-mysql`. May need to remove and recreate container |
| APF "Cannot connect to database" | Verify MySQL is running: `docker ps`. Check .env DATABASE_URL |
| APF port 3000 busy | Kill the process: `lsof -ti:3000 | xargs kill` or change PORT in .env |
| ShadowCast import errors | Make sure venv is activated and all deps installed. Check `moviepy>=2.0` specifically |
| ShadowCast "No module named moviepy" | `pip install moviepy>=2.0.0` (must be v2, not v1) |
| MC shows services "offline" | Verify each service is running with curl to their /api/health |
| MC product import fails | APF auth issue — see Section 5 Option B for local bypass |
| Video job stuck at "rendering" | Check ShadowCast terminal for errors. May be VRAM issue if model + render compete |
| Ollama model won't load | Check VRAM: `nvidia-smi`. Unload other models: `ollama stop <model>` |
| Port conflicts | Use `ss -tlnp | grep <port>` to find what's using it |

**Useful Commands:**
```bash
# Check all ports
ss -tlnp | grep -E "3000|3100|8000|8100|11434|3306"

# Check GPU usage
nvidia-smi

# Check Ollama models loaded
curl http://localhost:11434/api/ps

# Restart a single service
# (just kill the process and re-run its start command)
```

---

## Notes

- **Pop!_OS vs Ubuntu:** Pop!_OS is based on Ubuntu 22.04 so all Ubuntu instructions apply. The main difference is Pop!_OS has better NVIDIA driver support out of the box (especially with the NVIDIA ISO).
- **VRAM Management:** When ShadowCast is rendering video AND Ollama has a model loaded, you may hit VRAM limits. ShadowCast's video rendering uses GPU for some operations. If you get CUDA OOM errors during render, stop the Ollama model first: `ollama stop llama3.1:8b`.
- **First Run:** On first launch, Mission Control creates its SQLite database automatically. No setup needed.
- **APF Auth:** The tRPC product endpoints require authentication. For pure local dev, the simplest path is to manually add products to APF's frontend first, then import them into MC. Or implement the auth bypass in Section 5.
