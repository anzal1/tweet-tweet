# Daily Auto Tweet

Automated tweet generator that pulls from tech, football, gaming, and trending sources, then posts in an engineering tech lead voice. It ranks signals, avoids repeats, and optionally appends a link (with the platform's OG card).

## What it does
- Pulls signals from HN, GitHub Trending, and curated RSS/Atom feeds
- Filters to on-topic items (domains + keywords)
- Generates a short, engaging tweet with a clear takeaway
- Optionally appends a source link and uses OG cards for images
- Avoids repeats using a rolling history file

## Local setup
1. Install deps:
   - `pnpm install`
2. Add `.env` with your X credentials:
   - `X_API_KEY`
   - `X_API_SECRET`
   - `X_ACCESS_TOKEN`
   - `X_ACCESS_SECRET`
3. Dry run (no posting):
   - `DRY_RUN=true node tweet.js`
4. Post for real:
   - `node tweet.js`

## GitHub Actions setup (free)
1. Create a GitHub repo and push this project.
2. Add repo secrets (Settings -> Secrets and variables -> Actions):
   - `X_API_KEY`
   - `X_API_SECRET`
   - `X_ACCESS_TOKEN`
   - `X_ACCESS_SECRET`
3. The workflow runs on a schedule defined in:
   - `.github/workflows/tweet.yml`
4. Trigger a manual run from the Actions tab to verify.

Notes:
- GitHub Actions is free for public repos. Private repos have limited free minutes.
- X API posting may require a paid plan depending on the current tier.

## Configuration
Environment variables:
- `DRY_RUN=true` to print without posting
- `DRY_RUN_SAVE=false` to avoid saving dry-run posts
- `INCLUDE_LINKS=false` to skip appending links
- `INCLUDE_IMAGES=false` to skip media uploads (default uses OG cards when links exist)
- `POSTED_PATH=.cache/posted.json` to store history in a custom path

Tune content:
- Update feeds and keyword/domain filters in `tweet.js`.
- Adjust `CATEGORY_WEIGHTS` to change trending vs evergreen mix.
- Edit the prompt in `buildPrompt` for tone/style tweaks.

## Suggested cadence
- 3 to 5 posts per week is a good starting point.
- The current schedule posts weekdays once per day.

## Security
- Do not commit `.env`.
- Rotate credentials if you ever expose them.
