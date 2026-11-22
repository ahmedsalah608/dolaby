# دولابي (Dolaby)

أبلكيشن شخصي لأحمد: الدولاب (هدوم وعطور)، الترشيحات، والمستشار بالذكاء الاصطناعي. للاستخدام الشخصي بس.

- الواجهة: صفحة واحدة (`index.html` + `app.js`) على GitHub Pages: https://ahmedsalah608.github.io/dolaby/
- البيانات: Supabase (مشروع `dolaby`، eu-central-1). كل جدول عليه Row Level Security (`owner_id = auth.uid()`)، والصور في مخزن خاص بلينكات موقّعة.
- حساب واحد بس يقدر يتعمل (trigger على `auth.users`).
- الذكاء الاصطناعي: Edge Function اسمها `advisor` (الكود في `supabase/functions/advisor`). مفتاح Anthropic بيتكتب من الإعدادات، والمتصفح مايقدرش يقراه تاني، والسيرفر بس اللي بيستخدمه.
- الموديلات: Claude Sonnet 5.5 للمستشار والأحكام والتخطيط، وClaude Haiku 5.5 للحاجات الرخيصة الكتير (طقم اليوم، استخلاص الدروس، تجربة المفتاح).
- مكتبة supabase-js محطوطة جوه الريبو (`vendor/`)، والخط Readex Pro كمان (`fonts/`، رخصة OFL).

`config.js` فيه قيم عامة بس (عنوان المشروع والمفتاح العام). البيانات محمية بـRLS.
