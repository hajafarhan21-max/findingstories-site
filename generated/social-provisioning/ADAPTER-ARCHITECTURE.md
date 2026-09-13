# Native publishing adapter architecture

The adapter boundary is `api/_lib/social-publishing.js`. It exposes `publishPost()`, `publishImage()`, `publishVideo()`, `getPostStatus()`, `getProfileStatus()` and `getAnalytics()` for every target platform. Every method currently returns an exact review payload with `published: false` and performs no network request. Production modes are deliberately rejected. Future official clients must add platform validation, least-privilege OAuth, idempotency, response evidence and secret-manager integration without placing secrets in Git.
