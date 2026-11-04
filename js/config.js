// إعدادات التطبيق — عدّلها قبل النشر
window.POS_CONFIG = {
  schema: 1,
  trialMs: 24 * 60 * 60 * 1000,     // مدة التجربة: 24 ساعة
  clockTolerance: 5 * 60 * 1000,    // سماحية فرق الساعة: 5 دقائق
  // المفتاح العام للتحقق من أكواد الترخيص (ينتج عن: node tools/license-tool.mjs keygen)
  // يبقى null حتى تضع مفتاحك العام. المفتاح الخاص لا يوضع هنا أبدًا.
  publicKey: {"kty":"EC","crv":"P-256","x":"XSNgEZDb10RVWM23or-8BPc3eevaqbeV5R7rajAYcHs","y":"_MxmFQfHcoMXlJXq0_S4YGy6CUuGspS6w5nLGHMLqCg"},
  contact: 'للحصول على ترخيص تواصل مع البائع وأرسل له «معرّف التثبيت» الظاهر في الإعدادات.'
};
