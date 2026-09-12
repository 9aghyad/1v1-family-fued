# لعبة المزاد للأصدقاء — V26

## التشغيل على Render
هذه اللعبة **Web Service وليست Static Site** لأنها تستخدم Node.js وSocket.IO.

- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Root Directory: اتركه فارغًا إذا كانت هذه الملفات في جذر GitHub
- Health Check Path: `/health`

بعد النشر:
- افتح الرابط الرئيسي: `/` أو `/display` لإنشاء غرفة وعرض رمز من 4 أرقام.
- اللاعبون يفتحون `/player` ويدخلون الرمز والاسم.
- عند دخول لاعبين تبدأ اللعبة تلقائيًا.

## اختبار السيرفر
افتح `/health` ويجب أن تظهر:
`OK - AUCTION GAME V26`

## ملاحظة
ارفع **محتويات هذا المجلد** إلى جذر مستودع GitHub، وليس ملف ZIP نفسه داخل مجلد.
