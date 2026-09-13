declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    BUCKET: R2Bucket;
    WOWSYNC_INVITE_CODE: string;
  }
}
