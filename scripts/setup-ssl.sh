#!/bin/bash
# Setup SSL certificate for virtus.virtusoperandi.ai

set -e

DOMAIN="virtus.virtusoperandi.ai"
EMAIL="admin@virtusoperandi.ai"

echo "=== Setting up SSL for $DOMAIN ==="

# Create certbot directories
sudo mkdir -p /opt/virtus/certbot/conf
sudo mkdir -p /opt/virtus/certbot/www

# Stop nginx temporarily to free port 80
cd /opt/virtus
sudo docker-compose stop nginx

# Get certificate using standalone mode
sudo certbot certonly --standalone \
    -d $DOMAIN \
    --email $EMAIL \
    --agree-tos \
    --non-interactive

# Copy certificates to docker volume location
sudo cp -rL /etc/letsencrypt/live /opt/virtus/certbot/conf/
sudo cp -rL /etc/letsencrypt/archive /opt/virtus/certbot/conf/

# Restart nginx with SSL
sudo docker-compose up -d nginx

echo "=== SSL setup complete ==="
echo "Your site is now available at https://$DOMAIN"
