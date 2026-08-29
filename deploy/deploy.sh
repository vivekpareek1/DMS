#!/bin/bash
docker-compose up -d --build
sleep 20
docker-compose exec backend npx prisma migrate deploy
echo "Done http://YOUR_IP:3000"
