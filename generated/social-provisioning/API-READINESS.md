# Official direct API readiness

This is an architecture audit, not evidence of account eligibility, approval or credentials. Platform requirements can change and must be rechecked by the owner before implementation. Only official APIs may be connected.

| Channel | Classification | Official reference | Current gate |
|---|---|---|---|
| LinkedIn | DIRECT_API_SUPPORTED; DIRECT_API_REQUIRES_APP_APPROVAL; DIRECT_API_REQUIRES_ADMIN_APPROVAL | [Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api) | Approved application permissions and organization administrator authorization |
| Instagram | DIRECT_API_SUPPORTED; DIRECT_API_REQUIRES_APP_APPROVAL; DIRECT_API_REQUIRES_BUSINESS_VERIFICATION | [Instagram Platform](https://developers.facebook.com/docs/instagram-platform/) | Professional account, linked Meta assets, app permissions/review and any requested verification |
| Facebook | DIRECT_API_SUPPORTED; DIRECT_API_REQUIRES_APP_APPROVAL; DIRECT_API_REQUIRES_BUSINESS_VERIFICATION | [Pages API](https://developers.facebook.com/docs/pages-api/) | Page ownership, access token permissions/review and any requested verification |
| X | DIRECT_API_SUPPORTED; DIRECT_API_REQUIRES_PAID_ACCESS | [Create Post](https://docs.x.com/x-api/posts/create-post) | Developer account, suitable paid access tier and user authorization |
| YouTube | DIRECT_API_SUPPORTED; DIRECT_API_REQUIRES_APP_APPROVAL | [Videos: insert](https://developers.google.com/youtube/v3/docs/videos/insert) | Google Cloud project, OAuth consent/authorization, quota and channel verification where requested |
| Google Business Profile | DIRECT_API_SUPPORTED; DIRECT_API_REQUIRES_APP_APPROVAL; DIRECT_API_REQUIRES_BUSINESS_VERIFICATION | [Business Profile APIs](https://developers.google.com/my-business/) | Verified eligible profile, approved project/API access and OAuth authorization |

When an official API is unavailable or approval is absent, classification is **HUMAN_BROWSER_PUBLICATION_REQUIRED**. No adapter may leave REVIEW_ONLY until its requirements have documented evidence and an approved implementation.
