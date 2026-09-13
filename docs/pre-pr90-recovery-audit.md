# Pre-PR90 recovery audit

Compared `a92b4b5419af5ef52f374283a631f10309016544` with `8c957bbf8c9fe003cc68e4aff92a93098ed5bbba` before implementation.

| Feature/content | Pre-PR90 | PR90 production | Action | Decision |
|---|---|---|---|---|
| Finding Stories identity | FS gold mark, wordmark and strapline | Text only | Restored the approved treatment as a reusable SVG in both navigation modes | Restore |
| Main enquiry | Rich name/contact/purpose/budget/type/area/bed/timeline/message brief | Reduced form | Forward-ported all intent fields, consent and existing `/api/leads` client | Merge |
| Buying purpose | Investment, end use and broader intent | Only two choices | Added Both | Restore |
| Developers | Broad homepage mentions | Azizi-only registry | Official-source directory records; no implied availability | Rebuild |
| Areas | Multiple Dubai choices | Sharjah only | UAE directory with 46 Dubai districts plus three emirate markets | Rebuild |
| Property types | Apartments and broad residential types | Townhouses/villas only | Ten-type residential/commercial taxonomy | Restore/rebuild |
| Project presentation | Broad promotional discovery | One governed Florence record | Retained Florence and governance; added neutral multi-dimensional discovery | Merge |
| CTAs / WhatsApp | Enquiry and WhatsApp | Preserved | Added sell/rent entry points; retained WhatsApp number | Merge |
| Mobile | Responsive navigation/forms | Premium mobile menu | Preserved and expanded menu; single-column long forms | Keep/merge |
| SEO/meta | Canonical, robots and structured acquisition routes | Generator-backed canonicals/sitemap | Preserved canonical origin and generated only explicit useful routes | Keep |
| Leads | `/api/leads`, attribution and Gmail notification | Preserved | Client remains unchanged; all forms post to the same endpoint | Keep |
| Premium visual system | Dark/gold legacy | Ivory editorial system | Kept PR90 typography/layout; fixed dark-card contrast and brand-neutral hero | Keep/fix |

## Source policy
Official and government sources are controlled-ingestion candidates. Portal URLs are recorded only for human review unless permission is established. No portal copy or imagery was collected.
