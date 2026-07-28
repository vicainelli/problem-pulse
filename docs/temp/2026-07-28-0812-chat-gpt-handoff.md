# Problem Pulse – Handoff Document

## Objective

Build **Problem Pulse**, a private research engine that discovers recurring user problems from public online discussions.

The goal is **not** to build a Reddit analytics product or resell Reddit data.

The goal is to help a solo developer discover validated product opportunities by:

* collecting public discussions
* extracting pain points with AI
* clustering similar problems
* ranking opportunities
* generating research reports

Reddit is only the first supported data source.

---

# Current Direction

The architecture should remain source-agnostic.

Future sources include:

* Reddit
* GitHub Issues
* Hacker News
* Product Hunt
* G2
* Capterra
* other public communities

Collectors should be independent modules.

---

# Planned Pipeline

```text
Collectors
        ↓
Normalization
        ↓
AI Pain Extraction
        ↓
Embeddings
        ↓
Clustering
        ↓
Opportunity Scoring
        ↓
Research Report
```

---

# High-level Features

* Read public discussions
* Detect recurring problems
* Ignore one-off complaints
* Cluster semantically similar problems
* Detect buying signals
* Rank opportunities
* Produce structured reports

Future scoring factors:

* frequency
* severity
* recurrence
* business audience
* workaround quality
* willingness to pay
* trend over time

---

# Planned Folder Structure

```
problem-pulse/

collectors/
    reddit/
    github/
    hackernews/
    producthunt/

classifiers/

embeddings/

clustering/

scoring/

reports/
```

---

# Reddit API Situation

Important discovery:

The historical Reddit OAuth flow using:

```
reddit.com/prefs/apps
```

is no longer available for this account.

Current flow redirects developers toward:

```
https://developers.reddit.com/new
```

which creates **Devvit** applications.

Devvit is **not** appropriate for this project because it creates applications that run inside Reddit communities.

This project requires:

* external scheduled jobs
* read-only access
* multiple public subreddits
* private processing
* no Reddit UI
* no moderator functionality

Therefore the correct path is requesting access to the **Reddit Data API** through Reddit's support form.

---

# Reddit Data API Application

A detailed application has already been drafted.

Key points:

* external backend
* read-only
* OAuth
* no posting
* no voting
* no messaging
* no moderation
* aggregate research only
* no public redistribution of Reddit data

The application should describe the project honestly as a private research tool.

---

# Remaining Reddit Form Questions

Still to submit:

* benefit for Redditors
* detailed application description
* why Devvit cannot be used
* GitHub repository
* platform
* intended subreddits

Draft answers already exist and should be reused.

---

# Initial Target Subreddits

Current proposal:

* r/SaaS
* r/startups
* r/Entrepreneur
* r/smallbusiness
* r/webdev
* r/programming
* r/devops
* r/reactjs

These are only the initial research targets.

---

# Product Philosophy

The engine should not merely collect complaints.

It should identify:

* recurring problems
* expensive workflows
* manual processes
* spreadsheet usage
* poor integrations
* repetitive work
* buying signals

Good signals include statements like:

* "I'd pay for this."
* "Someone should build this."
* "We built an internal tool."
* "We're still using Excel."
* "Zapier doesn't solve this."

---

# Long-term Vision

Instead of manually browsing Reddit, the system should generate a daily report such as:

* Top opportunities
* Supporting evidence
* Frequency
* Severity
* Existing workarounds
* Estimated MVP
* Competition
* Confidence

Eventually the system should combine multiple data sources rather than relying solely on Reddit.

---

# Sensitive Information

No credentials, API keys, secrets, usernames or personal information have been exchanged or stored in this conversation.
