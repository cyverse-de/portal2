# CyVerse User Portal

The CyVerse User Portal is the place for user account and resource management.

# Requirements

* NGINX (not required for local development)
* PostgreSQL
* Node.js / NPM

# Local Development Installation

## Install code and dependencies
```
git clone git@gitlab.com:cyverse/portal2.git
cd portal2
npm install
```

## Edit configuration
Copy `src/config-default.json` to `src/config.json` and edit accordingly.

## Run server
```
npm run dev
```

# Ubuntu 20.04 Installation

## Install packages
```
sudo apt update
sudo apt install nodejs npm postgresql postgresql-contrib nginx
```

## Setup database

### Create user and database
```
sudo su postgres
createuser portal_db_reader
createdb portal
```

### Create empty database or Restore from dump
```
# Create empty database
psql -d portal -f ./portal.sql

# Restore from dump (portal_dumpl.sql must be generated)
psql -d portal -f portal_dump.sql
```

### Import GRID institutions (for newly created database)
Download latest GRID database from https://www.grid.ac/downloads
```
src/scripts/import_grid_institutions.py /path/to/grid.csv
```

## Install code and dependencies
```
mkdir /opt/dev
cd /opt/dev
git clone git@gitlab.com:cyverse/portal2.git

cd portal2
npm install
```

## Edit configuration
### Copy from template
```
cp src/config-default.json src/config.json
```

### Update the following fields in config.json
```
uiBaseUrl
apiBaseUrl
wsBaseUrl

uidNumberOffset

hmacKey

email.bccNewAccountConfirmation
email.bccPasswordChangeRequest
email.bccServiceAccessGranted
email.bccWorkshopEnrollmentRequest

db.user
db.password

session.secret

keycloak.*

googleAnalyticsId (optional, null to disable)

sentryDSN (optional, null to disable)

ldap.*

intercom.*

mailchimp.*

mailman.*
```

## Setup PM2

```
npm run build
npm install pm2@latest -g
pm2 start npm --name portal2 -- start
pm2 save
pm2 startup   # manually run the commands that this outputs
```

## Setup webserver

### Open ports
```
sudo ufw allow 80
sudo ufw allow 443
```

### Configure NGINX

Edit `/etc/nginx/sites-available/hostname` config file with content below,

Then enable
```
ln -s /etc/nginx/sites-available/portal /etc/nginx/sites-enabled/hostname
```

```
server {
    listen 80;
    return 301 https://hostname$request_uri;
}

server {
    listen 443 ssl;
    server_name hostname;

    ssl_certificate /etc/ssl/certs/hostname.org.pem;
    ssl_certificate_key /etc/ssl/private/hostname.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-Proto https; # needed to work with Node set("trust proxy", true)
        proxy_set_header X-Forwarded-For $remote_addr;
    }

    location /ws {
        rewrite /ws/(.*) /$1 break;
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

### Restart NGINX
```
sudo service nginx restart
```
