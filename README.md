# باشگاه فوتبالی تلگرام

یک ربات فارسی تلگرام به‌همراه Mini App موبایل‌فرست برای کوییز، جام، پیش‌بینی مسابقه، رتبه‌بندی، فروشگاه سکه، جوایز، دعوت دوستان و تبلیغات اسپانسری. تمام محتوا و نتایج توسط مدیر ثبت می‌شوند و پروژه هیچ وابستگی‌ای به APIهای فوتبال یا لایو‌اسکور ندارد.

## وضعیت پروژه

- React + TypeScript + Vite + Tailwind CSS
- Telegram Mini Apps SDK و `initData` امضاشده
- Node.js 22 + Express + Telegraf
- MongoDB Atlas + Mongoose
- Webhook در production و long polling در development
- یک پروژه و یک URL عمومی؛ Express خروجی production فرانت را سرو می‌کند
- پنل مدیریت داخل همان Mini App و محدود به `ADMIN_IDS`
- مدل‌های Mongoose با ایندکس‌های یکتا برای داده‌های اصلی، فروشگاه و دفتر تراکنش سکه
- seed شامل بیش از ۵۰ سؤال فارسی، نشان‌ها، تنظیمات، کوییز، جام، جایزه و بازی نمونه
- فید اجتماعی «فان» برای انتشار امن متن و تصاویر JPG/PNG/WEBP، لایک، گزارش و مدیریت محتوا
- تست‌های عضویت، احراز هویت تلگرام، کوییز، پیش‌بینی، دعوت و جلوگیری از عملیات تکراری
- TypeScript، lint، build و npm audit بدون خطا

## ساختار

```text
persian-football-club/
├── client/                 # React Telegram Mini App
│   ├── src/components/
│   ├── src/pages/
│   ├── src/layouts/
│   └── dist/               # خروجی production پس از build
├── server/
│   ├── src/bot/            # ربات Telegraf
│   ├── src/models/         # مدل‌های Mongoose
│   ├── src/routes/         # API کاربر، ادمین و cron
│   ├── src/services/       # امتیازدهی، عضویت، referral، sponsor و scheduling
│   ├── src/scripts/seed.ts
│   └── src/tests/
├── .env.example
├── railway.json
├── render.yaml
└── package.json
```

## متغیرهای محیطی

فایل `.env.example` را به `.env` کپی کنید:

```env
BOT_TOKEN=
BOT_USERNAME=
MONGODB_URI=
CHANNEL_ID=
CHANNEL_USERNAME=
CHANNEL_JOIN_URL=
ADMIN_IDS=
BASE_URL=
TELEGRAM_MINI_APP_DEEP_LINK_BASE=
WEBHOOK_SECRET=
CRON_SECRET=
NODE_ENV=development
PORT=3000
TIMEZONE=Asia/Tehran
PAYMENT_PROVIDER=test
DAILY_COIN_REWARD=25
VITE_DEMO_DATA_ENABLED=true
DEMO_DATA_ENABLED=true
FOOTBALL_API_ENABLED=false
```

### Local environment file

The repository-root `.env` is the only local environment file used by the API.
Do not create `server/.env`. The server resolves the root file independently of
the current working directory, so both `npm run dev` from the repository root and
`npm run dev` from `server/` use the same configuration. Variables supplied by the
deployment environment take precedence over the local file.

### Demo and Football API flags

Keep `VITE_DEMO_DATA_ENABLED=true`, `DEMO_DATA_ENABLED=true`, and
`FOOTBALL_API_ENABLED=false` while demo data is the active production source.
The Football API kill-switch prevents standings requests and admin synchronization
from contacting the provider. To switch to the real provider later, set
`FOOTBALL_API_ENABLED=true` and `DEMO_DATA_ENABLED=false`; the frontend receives
the backend runtime flag during authenticated startup.

توضیح متغیرها:

| متغیر | مقدار |
|---|---|
| `BOT_TOKEN` | توکن BotFather |
| `BOT_USERNAME` | نام کاربری ربات بدون `@` |
| `MONGODB_URI` | Connection String از MongoDB Atlas |
| `CHANNEL_ID` | شناسه عددی کانال؛ برای کانال‌ها معمولاً با `-100` شروع می‌شود |
| `CHANNEL_USERNAME` | نام کاربری کانال عمومی بدون `@`؛ برای کانال خصوصی می‌تواند خالی باشد |
| `CHANNEL_JOIN_URL` | لینک عضویت عمومی یا لینک دعوت کانال خصوصی |
| `ADMIN_IDS` | شناسه‌های عددی تلگرام مدیران، جداشده با ویرگول |
| `BASE_URL` | URL کامل HTTPS سرویس، بدون `/` پایانی |
| `TELEGRAM_MINI_APP_DEEP_LINK_BASE` | لینک عمومی HTTPS مینی‌اپ تلگرام بدون `startapp`؛ نمونه: `https://t.me/your_bot/your_app` |
| `WEBHOOK_SECRET` | رشته تصادفی قوی حداقل ۸ کاراکتر |
| `CRON_SECRET` | رشته تصادفی مستقل برای endpoint کرون |
| `NODE_ENV` | `development`، `test` یا `production` |
| `PORT` | پورت Express؛ Railway/Render معمولاً خودکار تنظیم می‌کنند |
| `TIMEZONE` | `Asia/Tehran` |
| `PAYMENT_PROVIDER` | در توسعه `test` برای جریان صریح آزمایشی؛ در production تا زمان افزودن درگاه واقعی `none` |
| `DAILY_COIN_REWARD` | تعداد سکه هدیه قابل دریافت در هر بازه ۲۴ ساعته |

ساخت secret مناسب:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## اجرای محلی

نیازمندی‌ها:

- Node.js 22 یا جدیدتر
- MongoDB محلی یا MongoDB Atlas
- ربات و کانال تلگرام برای تست واقعی

```bash
cp .env.example .env
npm install
npm run seed
npm run dev
```

آدرس‌ها:

- فرانت توسعه: `http://localhost:5173`
- API: `http://localhost:3000/api`
- Health check: `http://localhost:3000/api/health`

در حالت development، ربات با long polling اجرا می‌شود. برای پیش‌نمایش رابط خارج از تلگرام، فرانت به‌صورت خودکار از کاربر توسعه با شناسه `900001` استفاده می‌کند. برای دسترسی محلی به پنل مدیریت، مقدار زیر را قرار دهید:

```env
ADMIN_IDS=900001
```

دکمه «بررسی عضویت» در preview محلی، عضویت کاربر توسعه را تأیید می‌کند. در production این میانبر کاملاً غیرفعال است و عضویت واقعی از Telegram API بررسی می‌شود.

## دستورات

```bash
npm run dev          # اجرای همزمان فرانت و بک‌اند
npm run build        # build فرانت و TypeScript بک‌اند
npm start            # اجرای production از server/dist
npm run seed         # ایجاد داده اولیه
npm test             # اجرای تست‌ها
npm run typecheck    # TypeScript check
npm run lint         # ESLint
npm audit --omit=dev # بررسی آسیب‌پذیری production
```

## تنظیم BotFather و Mini App

1. در BotFather با `/newbot` ربات را بسازید و `BOT_TOKEN` و `BOT_USERNAME` را وارد `.env` کنید.
2. پس از deploy و دریافت URL HTTPS، از `/setmenubutton` استفاده کنید.
3. ربات را انتخاب کنید.
4. متن دکمه را مثلاً `⚽ ورود به باشگاه فوتبالی` قرار دهید.
5. URL را برابر `BASE_URL` قرار دهید.
6. در صورت استفاده از Mini App رسمی BotFather، با `/newapp` یا بخش مدیریت Web App همان URL را ثبت کنید.
7. در `/setdomain`، دامنه Railway یا Render را ثبت کنید؛ دامنه اختصاصی لازم نیست.
8. Privacy mode برای این پروژه مانع کارکرد پیام خصوصی و Web App نیست.

## تنظیم کانال و عضویت اجباری

1. ربات را به کانال اضافه کنید.
2. ربات را admin کنید تا `getChatMember` و ارسال اعلان کانال قابل اتکا باشد.
3. دست‌کم مجوز ارسال پیام را برای انتشار اعلان‌ها بدهید.
4. `CHANNEL_ID` را شناسه عددی کانال قرار دهید.
5. برای کانال عمومی، `CHANNEL_JOIN_URL=https://t.me/channel_username` است.
6. برای کانال خصوصی، لینک دعوت معتبر را در `CHANNEL_JOIN_URL` قرار دهید.
7. `CHANNEL_USERNAME` برای کانال خصوصی می‌تواند خالی باشد.

برای یافتن شناسه کانال، یک پیام از کانال را به یک ربات اطلاعاتی معتبر فوروارد کنید یا updateهای Bot API را موقتاً بررسی کنید. شناسه کانال باید عددی و معمولاً با `-100` آغاز شود.

## MongoDB Atlas

1. در Atlas یک پروژه و Cluster بسازید.
2. در Database Access یک کاربر با رمز قوی بسازید.
3. در Network Access، IP سرویس Railway/Render را مجاز کنید. برای شروع می‌توان `0.0.0.0/0` را فقط همراه رمز قوی استفاده کرد.
4. Connection String را کپی کرده و نام دیتابیس را مشخص کنید:

```env
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster.mongodb.net/football-club?retryWrites=true&w=majority
```

5. پس از deploy، یک‌بار seed را اجرا کنید.

ایندکس‌های یکتا از ثبت دوباره تلاش کوییز، پیش‌بینی، referral، رویداد اسپانسر و jobهای scheduled جلوگیری می‌کنند.

## Deploy روی Railway

1. پروژه را در GitHub قرار دهید.
2. در Railway گزینه Deploy from GitHub Repo را بزنید.
3. تمام متغیرهای `.env.example` را در Variables وارد کنید.
4. `NODE_ENV=production` باشد.
5. `BASE_URL` را URL نهایی Railway قرار دهید.
6. Railway از `railway.json` استفاده می‌کند:
   - Build: `npm ci && npm run build`
   - Start: `npm start`
   - Health: `/api/health`
7. پس از اولین deploy، در Railway Shell اجرا کنید:

```bash
npm run seed
```

تصاویر اصلی و نسخه‌های JPEG قابل اشتراک بخش «فان» در MongoDB GridFS و در همان دیتابیس `MONGODB_URI` ذخیره می‌شوند؛ بنابراین به فایل‌سیستم موقت Railway یا Render وابسته نیستند و نیازی به Volume یا `UPLOAD_DIR` ندارند.

8. سرویس را redeploy کنید تا webhook با URL نهایی ثبت شود.

## Deploy روی Render

1. Repository را به Render متصل کنید.
2. یک Web Service بسازید یا از `render.yaml` استفاده کنید.
3. Runtime را Node و نسخه را 22 قرار دهید.
4. Build Command:

```bash
npm ci && npm run build
```

5. Start Command:

```bash
npm start
```

6. Health Check Path:

```text
/api/health
```

7. Environment variables را وارد کنید و `BASE_URL` را URL سرویس Render قرار دهید.
8. در Shell سرویس یک‌بار `npm run seed` اجرا کنید.

در پلن رایگان Render ممکن است سرویس در زمان بی‌کاری sleep شود؛ برای اعلان‌های دقیق‌تر Railway یا پلن همیشه‌فعال مناسب‌تر است.

## Webhook تلگرام

در production، برنامه هنگام startup این webhook را خودکار ثبت می‌کند:

```text
{BASE_URL}/telegram/webhook/{WEBHOOK_SECRET}
```

همچنین `secret_token` تلگرام با `WEBHOOK_SECRET` تنظیم و هدر ورودی بررسی می‌شود. بنابراین endpoint فقط داشتن URL را کافی نمی‌داند.

بررسی webhook:

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

حذف webhook برای بازگشت به long polling محلی:

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/deleteWebhook?drop_pending_updates=false"
```

## Cron خارجی

Endpoint محافظت‌شده:

```text
POST {BASE_URL}/api/cron/run
Header: x-cron-secret: {CRON_SECRET}
```

نمونه:

```bash
curl -X POST \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  "https://YOUR-SERVICE/api/cron/run"
```

در cron-job.org، UptimeRobot با webhook، GitHub Actions یا هر سرویس cron رایگان:

- Method: `POST`
- URL: `https://YOUR-SERVICE/api/cron/run`
- Header: `x-cron-secret`
- Interval پیشنهادی: هر ۱ تا ۵ دقیقه

هر اجرای cron:

- مسابقات scheduled را فعال می‌کند
- مسابقات و کوییزهای منقضی را تمام می‌کند
- بازی‌های شروع‌شده را live می‌کند
- پیش‌بینی بازی‌های دارای نتیجه را دقیقاً یک‌بار محاسبه می‌کند
- reminderهای موعدرسیده را می‌فرستد
- broadcastهای زمان‌بندی‌شده را برای کاربران یا کانال ارسال می‌کند
- sponsor و reward منقضی را غیرفعال می‌کند
- با status claim و idempotency key از اجرای دوباره جلوگیری می‌کند

## پنل مدیریت

شناسه عددی مدیر باید در `ADMIN_IDS` باشد. پنل از مسیر `/admin` داخل Mini App قابل دسترسی است و شامل موارد زیر است:

برای فعال‌کردن دکمه «ارتباط با پشتیبانی» در پروفایل کاربران، در بخش «تنظیمات» رکوردی با کلید `supportTelegramUsername` بسازید و نام کاربری تلگرام مدیر را به‌عنوان مقدار وارد کنید (با یا بدون `@`). مقدار پیش از ارسال به کلاینت اعتبارسنجی می‌شود.

- بازی‌های مهم، ثبت نتیجه و محاسبه مجدد امن امتیازها
- سؤال‌ها و چهار گزینه
- کوییزها و انتخاب سؤال‌ها
- جام‌ها و مسابقات مستقل
- جایزه‌ها
- sponsor و گزارش impressions/clicks
- نشان‌ها
- پیام همگانی و انتشار کانال
- تنظیمات
- کاربران
- بسته‌های سکه: ایجاد، ویرایش، فعال/غیرفعال، تغییر ترتیب و حذف
- create، edit، duplicate، publish/hide و delete با تأیید
- آپلود تصویر تا ۲MB

تصاویر آپلودشده به data URL تبدیل می‌شوند و در رکورد مربوط ذخیره می‌شوند؛ این روش بدون سرویس جانبی روی Railway/Render کار می‌کند. برای حجم بسیار زیاد تصویر، بعداً می‌توان بدون تغییر UI یک storage سازگار با S3 اضافه کرد.

## امنیت

- هویت کاربر و مدیر هرگز از body یا query frontend پذیرفته نمی‌شود.
- `initData` با HMAC-SHA256، `BOT_TOKEN` و `auth_date` بررسی می‌شود.
- مقایسه hash به‌صورت timing-safe انجام می‌شود.
- admin route فقط با Telegram ID معتبر در `ADMIN_IDS` باز می‌شود.
- عضویت کانال پیش از کوییز، مسابقه، پیش‌بینی، referral و جایزه دوباره بررسی می‌شود.
- sponsor redirect با توکن کوتاه‌عمر HMAC امضا می‌شود.
- مقصد sponsor فقط `http` یا `https` است.
- inputها با Zod و validatorهای Mongoose بررسی می‌شوند.
- موجودی سکه فقط در سرویس فروشگاه و همراه دفتر تراکنش، عملیات اتمیک و کلید idempotency تغییر می‌کند؛ پرداخت آزمایشی در production قابل تکمیل نیست.
- Helmet، rate limit، محدودیت body و centralized error handler فعال‌اند.
- logها token، secret و initData را redact می‌کنند.
- پیام‌های ربات بدون parse mode ناامن ارسال می‌شوند و ابزار escape نیز برای توسعه پیام‌های HTML موجود است.
- blocked user و خطاهای Telegram ثبت می‌شوند؛ `retry_after` رعایت می‌شود.

## تست و تأیید build

```bash
npm run typecheck
npm run build
npm test
npm run lint
npm audit --omit=dev
```

تست‌ها موارد زیر را پوشش می‌دهند:

- امضای صحیح، دستکاری‌شده و منقضی `initData`
- وضعیت‌های مختلف عضویت کانال
- امتیازدهی کوییز
- پیش‌بینی نتیجه و نتیجه دقیق
- بسته‌شدن پیش‌بینی در deadline و kickoff
- self-referral و کاربران غیرجدید
- وجود ایندکس‌های unique برای duplicate prevention

## راه‌اندازی production

پس از تنظیم environment variables:

```bash
npm ci
npm run build
npm run seed
npm start
```

سپس:

1. `/api/health` را بررسی کنید.
2. وضعیت webhook را با `getWebhookInfo` ببینید.
3. در ربات `/start` بزنید.
4. عضویت کانال را تأیید کنید.
5. Mini App را باز کنید.
6. با Telegram ID موجود در `ADMIN_IDS` وارد پنل شوید.
7. cron خارجی را فعال کنید.
