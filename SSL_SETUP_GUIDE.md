# SSL Certificate Setup Guide for buddywilde.com

## Current Status
- Domain: buddywilde.com
- Server: server.buddywilde.com
- OS: Ubuntu 22.04
- Web Server: Nginx
- Access: SSH via PuTTY as root

## Step-by-Step SSL Setup with Let's Encrypt

### Step 1: Verify DNS is Pointing to Your VPS

Before requesting SSL certificates, ensure your domain is pointing to your server's IP address.

```bash
# Check if your domain resolves to your server
ping buddywilde.com
ping www.buddywilde.com
```

The IP should match your VPS IP address. If not, update your DNS A records at your domain registrar.

### Step 2: Check/Install Certbot

```bash
# Check if certbot is installed
certbot --version

# If not installed, install it:
apt update
apt install certbot python3-certbot-nginx -y
```

### Step 3: Check Nginx Configuration

```bash
# Check if nginx is running
systemctl status nginx

# Test nginx configuration
nginx -t

# View current nginx config
ls -la /etc/nginx/sites-available/
ls -la /etc/nginx/sites-enabled/
```

### Step 4: Create Basic Nginx Configuration (if needed)

Create a basic HTTP configuration first (before SSL):

```bash
# Create nginx config file
nano /etc/nginx/sites-available/buddywilde.com
```

Add this content:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name buddywilde.com www.buddywilde.com server.buddywilde.com;

    root /var/www/buddywilde.com/public_html;
    index index.html index.htm;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # This is needed for Let's Encrypt verification
    location ~ /.well-known/acme-challenge {
        allow all;
        root /var/www/buddywilde.com/public_html;
    }
}
```

Save the file (Ctrl+X, then Y, then Enter).

### Step 5: Enable the Site and Test

```bash
# Create symbolic link to enable the site
ln -s /etc/nginx/sites-available/buddywilde.com /etc/nginx/sites-enabled/

# Remove default site if it exists
rm /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

# If test passes, reload nginx
systemctl reload nginx
```

### Step 6: Create Web Root Directory

```bash
# Create directory structure
mkdir -p /var/www/buddywilde.com/public_html

# Create a simple test page
echo "<h1>BuddyWilde - Coming Soon</h1>" > /var/www/buddywilde.com/public_html/index.html

# Set proper permissions
chown -R www-data:www-data /var/www/buddywilde.com
chmod -R 755 /var/www/buddywilde.com
```

### Step 7: Test Your Site

Open a browser and visit:
- http://buddywilde.com
- http://www.buddywilde.com

You should see your test page.

### Step 8: Request SSL Certificates

Now request SSL certificates for all your domains:

```bash
# Request certificates for all domains at once
certbot --nginx -d buddywilde.com -d www.buddywilde.com -d server.buddywilde.com
```

You'll be prompted to:
1. Enter your email address (for renewal notifications)
2. Agree to Terms of Service (type 'A')
3. Share email with EFF (optional, type 'Y' or 'N')
4. Choose whether to redirect HTTP to HTTPS (choose option 2 for redirect)

Certbot will automatically:
- Request certificates from Let's Encrypt
- Verify domain ownership
- Update your nginx configuration with SSL settings
- Set up auto-renewal

### Step 9: Verify SSL Installation

```bash
# Check certificate status
certbot certificates

# Test nginx configuration
nginx -t

# Reload nginx if needed
systemctl reload nginx
```

### Step 10: Test Your Secure Site

Open a browser and visit:
- https://buddywilde.com
- https://www.buddywilde.com
- https://server.buddywilde.com

You should see a secure padlock icon.

### Step 11: Verify Auto-Renewal

```bash
# Test the renewal process (dry run)
certbot renew --dry-run

# Check certbot timer (handles auto-renewal)
systemctl status certbot.timer
```

If the timer is not active:

```bash
systemctl enable certbot.timer
systemctl start certbot.timer
```

## Final Nginx Configuration

After certbot runs, your nginx config will look similar to this:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name buddywilde.com www.buddywilde.com server.buddywilde.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name buddywilde.com www.buddywilde.com server.buddywilde.com;

    ssl_certificate /etc/letsencrypt/live/buddywilde.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/buddywilde.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root /var/www/buddywilde.com/public_html;
    index index.html index.htm;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## Troubleshooting Common Issues

### Issue 1: "Connection refused" or "Cannot reach domain"

**Solution**: Check DNS propagation and firewall rules

```bash
# Check if ports 80 and 443 are open
ufw status

# If ufw is active, allow ports:
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp  # Keep SSH open!
ufw reload
```

### Issue 2: "Certificate verification failed"

**Solution**: Ensure domain points to your server and nginx is running

```bash
# Check nginx status
systemctl status nginx

# Check if nginx is listening on port 80
netstat -tlnp | grep :80

# Check nginx error logs
tail -f /var/log/nginx/error.log
```

### Issue 3: "Too many certificates already issued"

**Solution**: Let's Encrypt has rate limits (50 certs per domain per week)

Wait or use the staging environment for testing:

```bash
certbot --nginx --staging -d buddywilde.com -d www.buddywilde.com
```

### Issue 4: Nginx test fails

```bash
# Check nginx configuration syntax
nginx -t

# View detailed error
journalctl -xe -u nginx

# Check for port conflicts
netstat -tlnp | grep :80
netstat -tlnp | grep :443
```

## Quick Reference Commands

```bash
# Check certbot certificates
certbot certificates

# Renew certificates manually
certbot renew

# Restart nginx
systemctl restart nginx

# Check nginx status
systemctl status nginx

# View nginx error log
tail -f /var/log/nginx/error.log

# View certbot log
tail -f /var/log/letsencrypt/letsencrypt.log

# Test nginx config
nginx -t
```

## Next Steps After SSL Setup

1. Upload your React build to `/var/www/buddywilde.com/public_html/`
2. Set up Node.js REST API server (port 3000)
3. Set up WebSocket server (port 8080)
4. Update nginx configuration for reverse proxying (see PRODUCTION_ARCHITECTURE.md)
5. Configure PM2 for Node.js processes
6. Set up database connection

## Security Best Practices

```bash
# Enable automatic security updates
apt install unattended-upgrades -y
dpkg-reconfigure -plow unattended-upgrades

# Set up basic firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw enable

# Keep system updated
apt update && apt upgrade -y
```

## Certificate Renewal

Certificates are valid for 90 days and auto-renew at 60 days. The renewal happens automatically via systemd timer.

To manually renew:

```bash
certbot renew
systemctl reload nginx
```

## Support

If you encounter issues:

1. Check nginx error logs: `/var/log/nginx/error.log`
2. Check certbot logs: `/var/log/letsencrypt/letsencrypt.log`
3. Verify DNS: `dig buddywilde.com`
4. Test ports: `telnet buddywilde.com 80` and `telnet buddywilde.com 443`

## Important Notes

- Let's Encrypt certificates are valid for 90 days
- Auto-renewal happens via systemd timer (certbot.timer)
- Always test nginx config before reloading: `nginx -t`
- Keep backups of your nginx configurations
- Your SSL certificates are stored in `/etc/letsencrypt/live/buddywilde.com/`
