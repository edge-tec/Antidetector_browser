# 🐘 ProfileVault — Complete PHP Web Version aaPanel Hosting Guide

This guide explains step-by-step how to host the **PHP Web Version** of **ProfileVault** on aaPanel (using **PHP 7.4 / 8.0 / 8.1 / 8.2** + **MySQL / MariaDB** or **SQLite**) without requiring Node.js on your server!

---

## 🎯 Architecture Overview

```
                      aaPanel Web Server (PHP 8.1 + MySQL)
                                      │
              ┌───────────────────────┴───────────────────────┐
              │                                               │
     Web Admin Dashboard                              Centralized REST API
(Users, Plans, Downloads, CMS)                   (Auth, License, Downloads)
              │                                               │
       ┌──────┼───────┐                                       │
       │      │       │                                       │
     Users  Plans  Downloads                                  │
       │      │       │                                       │
       └──────┼───────┘                                       │
              │                                               │
         Landing Page ────────────────────────────────────────┘
              │
        Windows / macOS / Linux
         Desktop Applications
              │
              ▼
       Login + License Auth
              │
              ▼
 Server-Side Subscription & Expiration Enforcement
```

---

## 💻 Step-by-Step aaPanel PHP Hosting Process

### Step 1: Create Website in aaPanel
1. Log into your **aaPanel Control Panel**.
2. Go to **Website** → **Add Site**.
3. Enter your domain: `your-domain.com`.
4. Select **PHP Version**: `PHP-8.1` (or PHP 8.0 / 8.2 / 7.4).
5. Select **MySQL** Database → Set database name: `profilevault` and user password.
6. Click **Submit**.

---

### Step 2: Import MySQL Database (`database.sql`)
1. In aaPanel, go to **Database** → Locate `profilevault`.
2. Click **Import** → Upload and import `php-backend/database.sql`.
3. This creates all tables:
   - `users` (Initial Admin: `admin@profilevault.local` / Password: `admin`)
   - `pricing_plans` & `subscriptions`
   - `desktop_installations` & `desktop_app_config`
   - `landing_branding`, `landing_hero`, `landing_stats`, `landing_features`, `landing_steps`, `landing_faqs`, `landing_testimonials`, `landing_seo`

---

### Step 3: Configure Database Credentials in `config.php`
Open `php-backend/config.php` and set your aaPanel MySQL credentials:

```php
define('DB_DRIVER', 'mysql');
define('DB_HOST', '127.0.0.1');
define('DB_PORT', '3306');
define('DB_NAME', 'profilevault');
define('DB_USER', 'profilevault_user');
define('DB_PASS', 'your_aapanel_mysql_password');
```

---

### Step 4: Configure Nginx URL Rewrite in aaPanel
1. In aaPanel, go to **Website** → Click on `your-domain.com`.
2. Go to **URL rewrite** tab → Paste the following Nginx rules:
   ```nginx
   location / {
       try_files $uri $uri/ /index.php?$query_string;
   }

   location ~* \.(sql|sqlite|db|env|log)$ {
       deny all;
   }
   ```
3. Click **Save**.

---

### Step 5: Configure Free SSL Certificate (HTTPS)
1. In Website Settings, go to **SSL** tab.
2. Select **Let's Encrypt** → Select domain → Click **Apply**.
3. Enable **Force HTTPS**.

---

### Step 6: Upload PHP Files
1. Copy all files inside `php-backend/` into your aaPanel website root directory (`/www/wwwroot/your-domain.com/`).
2. Build the web UI (`npm run build` on local computer) and upload the contents of `out/renderer/` into `/www/wwwroot/your-domain.com/public/`.

---

## 🔑 Key Features Managed from PHP aaPanel Web Version

1. **User Management**: Search, filter, edit roles, reset passwords, suspend/activate accounts.
2. **Subscriptions & Expiration**: Control monthly/yearly prices, set exact expiration dates, manual subscription assignment.
3. **Application Downloads**: Configure Windows (`.exe`), macOS (`.dmg`), and Linux (`.AppImage`) download links, app versions, and force updates.
4. **Database-Driven Landing Page CMS**: Manage hero titles, site name, logo, features, pricing, FAQs, testimonials, and SEO tags.
5. **Desktop App Server-Side Auth**: Desktop app logs in and validates licenses against `https://your-domain.com/api/license/validate`.
