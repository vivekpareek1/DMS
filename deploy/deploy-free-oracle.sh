
#!/bin/bash
# FREE Oracle Cloud Always Free Deployment Script
set -e
echo "=== Vault DMS FREE Deployment (Oracle Always Free) ==="
echo "This VM is FREE FOREVER - 4 vCPU, 24GB RAM"

# Install Docker if not exists
if ! command -v docker &> /dev/null; then
  echo "Installing Docker..."
  sudo apt update
  sudo apt install -y docker.io docker-compose git
  sudo usermod -aG docker $USER
  echo "Docker installed. Please logout/login or run: newgrp docker"
fi

# Check .env
if [ ! -f .env ]; then
  echo "Creating .env from template..."
  cp .env.template .env
  echo "!!! EDIT .env with your DRIVE_ROOT_FOLDER_ID and GOOGLE_SERVICE_ACCOUNT_JSON !!!"
  nano .env
fi

# Deploy FREE tier (low RAM version for safety, but Oracle has 24GB so we can use full)
echo "Deploying with FREE tier config (2GB RAM friendly)..."
docker-compose -f docker-compose.free.yml up -d --build

echo "Waiting 30s for DB..."
sleep 30

echo "Running migrations..."
docker-compose -f docker-compose.free.yml exec backend npx prisma migrate deploy || echo "Migration may need manual run"

echo ""
echo "=== DEPLOYED FREE ==="
echo "Frontend: http://$(curl -s ifconfig.me):3000"
echo "Backend: http://$(curl -s ifconfig.me):3001/api/health"
echo "Test permission-wise upload:"
echo "  1. Open frontend URL"
echo "  2. Login admin / admin123"
echo "  3. Create viewer user -> try upload -> should be blocked ⛔"
echo ""
echo "This Oracle VM is FREE FOREVER, never sleeps!"
