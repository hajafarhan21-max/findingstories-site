# Organic distribution UTM standard

Use the direct canonical project URL; never a preview host, internal ID or unnecessary redirect.

`https://www.finding-stories.com/{slug}?utm_source={publisher}&utm_medium={channel}&utm_campaign={slug}-project-launch&utm_content={placement}`

## Controlled values
- `utm_source`: `linkedin`, `instagram`, `facebook`, `whatsapp`, a verified publication/domain label, `partner_name`, `directory_name`, or `event_name`.
- `utm_medium`: `organic_social`, `whatsapp_share`, `editorial`, `directory`, `partner`, `referral`, `press`, or `event`.
- `utm_campaign`: stable `{project-slug}-project-launch`; Florence is `azizi-florence-project-launch`.
- `utm_content`: concise placement/creative such as `project_post`, `bio_link`, `direct_share`, `project_reference`, `project_profile`, or `project_referral`.

Lowercase ASCII snake/kebab labels only; no names, emails, phone numbers, CRM IDs or mutable dates. Preserve all four fields through the current first/latest-touch lead pipeline. Use `project_launch` as campaign purpose, not as a second medium. Generated examples live in `generated/distribution/{slug}.json`. Review links before publication. Do not add UTMs to canonical tags, sitemap entries, or internal navigation.
