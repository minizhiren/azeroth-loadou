# Cloudflare deployment

1. Copy `wrangler.example.jsonc` to `wrangler.jsonc` and replace `REPLACE_WITH_D1_DATABASE_ID` with the identifier returned by Cloudflare after creating the D1 database.
2. Create the persistent resources:

   ```powershell
   npx wrangler d1 create azeroth-loadout-db
   npx wrangler r2 bucket create azeroth-loadout-configs
   ```

3. Apply the schema:

   ```powershell
   npx wrangler d1 migrations apply azeroth-loadout-db --remote
   ```

4. Set the invite code without committing it:

   ```powershell
   npx wrangler secret put WOWSYNC_INVITE_CODE
   ```

5. Build and deploy:

   ```powershell
   pnpm build
   npx wrangler deploy --config wrangler.jsonc
   ```

The uploaded configuration archives live in R2, while package metadata lives in D1. Re-deploying the Worker does not remove either resource.
