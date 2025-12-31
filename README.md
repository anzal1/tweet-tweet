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
   - `GROQ_API_KEY`
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
- `GROQ_API_KEY` for Groq AI requests
- `GROQ_MODEL=llama-3.3-70b-versatile` to override the model
- `GROQ_TIMEOUT_MS=45000` to override the Groq request timeout
- `GROQ_RETRIES=2` to override the Groq request retry count

Tune content:
- Update feeds and keyword/domain filters in `tweet.js`.
- Adjust `CATEGORY_WEIGHTS` to change trending vs evergreen mix.
- Edit the prompt in `buildPrompt` for tone/style tweaks.

## Humanization Features
The bot uses several techniques to make tweets sound more human and engaging:

- **Voice Variants**: Randomly rotates between 8 different personas (curious builder, pragmatic tech lead, opinionated dev, etc.)
- **Hook Patterns**: Uses 10 different opening strategies (contrarian statements, personal anecdotes, surprising facts, etc.)
- **Engagement Closers**: Occasionally adds punchy endings ("Worth a look.", "Saved me hours.", etc.)
- **Time-Aware Context**: Sometimes adds day-appropriate intros ("Monday momentum:", "Weekend reading:")
- **First-Person Perspective**: Encourages "I", "we", "my experience" for authenticity
- **Banned Phrases**: Filters out 30+ corporate/AI-sounding phrases ("game changer", "leverage", "synergy", etc.)
- **Rhetorical Questions**: Allows one question per tweet for engagement

## Duplicate Prevention (4 Layers)
The bot uses multiple strategies to avoid repetitive content:

1. **Source ID & URL Match**: Exact match prevention - won't tweet the same article twice
2. **Title Fingerprinting**: Uses Jaccard similarity on word sets (threshold: 60%) to catch similar titles
3. **Tweet Content Similarity**: Compares generated tweet text against recent posts
4. **Topic Cooldown** (48 hours): Extracts tech topics (kubernetes, react, LLM, etc.) and prevents tweeting about the same topic too frequently

All checks use a 14-day rolling window stored in `posted.json`.

## Content Sources (20+ feeds)
Curated from the best engineering blogs and tech news:

**Engineering Blogs (Evergreen)**:
- Cloudflare, Stripe, Netflix, AWS Architecture
- Google Developers, Meta Engineering, Uber, Spotify
- Discord, Slack, LinkedIn, Dropbox, GitHub, Mozilla, Vercel

**Research**: ArXiv cs.SE (Software Engineering) and cs.LG (Machine Learning)

**Trending News**: The Verge, TechCrunch, Ars Technica, OpenAI Blog

**Live Sources**: Hacker News (Top & Best), GitHub Trending

## Topic Coverage
The bot recognizes 150+ tech keywords across categories:
- **Languages**: TypeScript, Rust, Go, Python, Zig, Elixir, etc.
- **Frameworks**: React, Next.js, Vue, Svelte, etc.
- **Infrastructure**: Kubernetes, Docker, Terraform, etc.
- **Databases**: PostgreSQL, Redis, MongoDB, Supabase, etc.
- **AI/ML**: LLM, GPT, RAG, embeddings, fine-tuning, etc.
- **DevOps**: CI/CD, GitHub Actions, observability, etc.

## Suggested cadence
- 3 to 5 posts per week is a good starting point.
- The current schedule posts weekdays once per day.

## Security
- Do not commit `.env`.
- Rotate credentials if you ever expose them.
