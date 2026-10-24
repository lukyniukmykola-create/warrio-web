// Browser-safe configuration. Never place service_role, sb_secret, database
// passwords, OAuth secrets or WARRIO_IMPORT_KEY in this file.
window.WARRIO_WEB_CONFIG = Object.freeze({
  environment: "production",
  supabaseUrl: "https://pziqzthhqcqiyerurlyn.supabase.co",
  supabasePublishableKey: "sb_publishable_gH84epIrsBe5AIOOtw3wkg_tx2LRzsl",
  verificationPath: "verify/index.html",
  activationPath: "activate/index.html",
  supportEmail: "neofox.richardson@gmail.com"
});
