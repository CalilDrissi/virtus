#!/bin/bash
# Setup script for the VM - run this on the VM after first boot

set -e

echo "=== Virtus AI Platform VM Setup ==="

# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install Docker
sudo apt-get install -y docker.io docker-compose-plugin
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER

# Install other dependencies
sudo apt-get install -y git nginx certbot python3-certbot-nginx

# Create app directory
sudo mkdir -p /opt/virtus
sudo chown -R $USER:$USER /opt/virtus

# Clone repository
cd /opt/virtus
git clone https://github.com/CalilDrissi/virtus.git . || echo "Repo may already exist"

echo "=== Setup complete ==="
echo "Next steps:"
echo "1. Create .env file with your secrets"
echo "2. Run: docker compose up -d"
