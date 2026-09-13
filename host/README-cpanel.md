# Sosis Launcher — وب‌پلتفرم آماده‌ی cPanel (بدون Node، بدون server.js)

این پوشه یک وب‌اپ **PHP خالص** است: فقط آپلود می‌کنید و کار می‌کند.
نیازمندی: هاست cPanel با **PHP 7.4 یا بالاتر** (همین؛ بدون Composer، بدون Node، بدون دیتابیس MySQL — داده‌ها در `data/db.json` با قفل فایل ذخیره می‌شوند).

## نصب روی هاست (app.sosis-shop.top)

1. محتوای همین پوشه (`host/`) را زیپ کنید و در cPanel → File Manager داخل
   `public_html/` (یا ساب‌دامین `app.sosis-shop.top`) آپلود و Extract کنید.
   ساختار نهایی باید این‌گونه باشد:
   ```
   public_html/
   ├── .htaccess  .user.ini
   ├── index.html  login.html  register.html  profile.html  leaderboard.html  admin.html
   ├── css/  js/  assets/  (avatars/ داخل assets)
   ├── api/           ← همه‌ی endpointهای PHP
   ├── data/          ← db.json + secret.key (به‌صورت خودکار ساخته می‌شود، عمومی نیست)
   └── datasetup/     ← فایل‌های قابل دانلود (ستاپ لانچر را اینجا/از پنل آپلود کنید)
   ```
2. در cPanel → **MultiPHP INI Editor** (یا خود `.user.ini`) مطمئن شوید:
   `upload_max_filesize=1500M`, `post_max_size=1500M`, `max_execution_time=600`
3. سایت را باز کنید: `/` لندینگ، `/admin.html` ادمین پنل.
   - رمز اولیه ادمین: **mani2010** (یا مقدار `ADMIN_PASSWORD` در environment)
   - بلافاصله از تب **Security** رمز را عوض کنید.
4. در ادمین پنل → **Files**: فایل `SosisLauncherSetup.exe` را آپلود کنید
   (خروجی `npm run dist` روی ویندوز). سپس در تب **Publish update** ورژن را
   ثبت کنید (مثلاً `1.1.0`) → SHA-256 و سایز خودکار محاسبه و ذخیره می‌شود.
5. از تب **Site & downloads** می‌توانید دکمه دانلود عمومی و `/datasetup` را
   خاموش/روشن کنید.

##endpointها (همان قرارداد اپ)

| مسیر | خروجی |
| --- | --- |
| `GET /datasetup` | مانیفست Launcher Download Endpoint (JSON) |
| `GET /datasetup/<file>` | دانلود فایل (با گیتِ downloadEnabled) |
| `GET /latest.json` | مانیفست آپدیت (version + download + sha256) |
| `POST /api/auth/register` `/api/auth/login` `/api/auth/logout` | حساب کاربری |
| `GET /api/auth/me` · `POST /api/auth/avatar` | پروفایل و عکس پروفایل |
| `POST /api/sync/session` | همگام‌سازی session از اپ (Bearer token) |
| `GET /api/leaderboard` · `GET /api/games/popular` | لیدربورد و محبوب‌ترین‌ها |
| `/api/admin/*` | ورود/فایل‌ها/انتشار ورژن/تنظیم سایت/تغییر رمز |

## رفتار آپدیت خودکار اپ
اپ هنگام شروع `https://app.sosis-shop.top/latest.json` را می‌خواند؛ اگر
`version` بزرگ‌تر از ورژن نصب‌شده بود → ستاپ را از `download` دانلود می‌کند →
`sha256` را تأیید می‌کند → نصب/ری‌استارت و تغییرات اعمال می‌شود. یعنی فقط
کافی است در ادمین پنل ورژن جدید را Publish کنید.

## پیش‌نمایش لوکال (اختیاری، بدون cPanel)
```bash
php -S 0.0.0.0:8080 router.php
```
(`router.php` فقط برای شبیه‌سازی rewriteها در سرور داخلی PHP است و روی هاست
نیازی به آن نیست.)

## امنیت
- رمزها با `password_hash` (bcrypt)؛ توکن‌ها HMAC-Signed با کلید تصادفی در `data/secret.key`
- کوکی‌ها HttpOnly + SameSite؛ پوشه `data/` با `.htaccess` مسدود
- آپلودها فقط به `datasetup/` و `assets/avatars/`، با sanitize نام فایل
- `_lib.php` و `data/` از بیرون قابل دسترسی نیستند
