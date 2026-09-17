/**
 * Governed, project-isolated media selected from the developers' public project pages.
 * Remote bytes are integrity-pinned and materialized by scripts/materialize-project-media.mjs.
 */
const reviewed='2026-09-16';
const media=(projectSlug,id,kind,sourceUrl,sha256,width,height,alt)=>Object.freeze({
  id:`${projectSlug}-${id}`,projectSlug,kind,sourceUrl,sourceType:'OFFICIAL_DEVELOPER_PROJECT_PAGE',
  originalFilename:decodeURIComponent(new URL(sourceUrl).pathname.split('/').at(-1)),assetType:'IMAGE',mediaRole:kind,
  sha256,width,height,alt,retrievedAt:reviewed,reviewedAt:reviewed,approvalState:'APPROVED',usageState:'APPROVED',verificationState:'VERIFIED',
  path:`/assets/projects/${projectSlug}/${id}`
});

export const PROJECT_MEDIA=Object.freeze({
  'terra-gardens':Object.freeze([
    media('terra-gardens','hero','hero','https://uae-cms.emaar.com/uploads/422604_hero_slide_0_658baa7ad8.jpg','c4e56d31d69ffba1e621a350997a52f0b2fa178fbced3a32dcf05e502766c415',1620,832,'Landscaped running trail and gardens at Terra Gardens'),
    media('terra-gardens','amenity-pool','amenity','https://uae-cms.emaar.com/uploads/422565_feature_block_0_fc7e3c0a70.jpg','9d7a1b241b26268a0bebe608e4cfc56647c531cfd948e2aec10d6b365c2d35d3',1200,655,'Residents’ swimming pool at Terra Gardens'),
    media('terra-gardens','exterior','exterior','https://uae-cms.emaar.com/uploads/422580_exterior_1_ea34328743.jpg','c7a58e43864250165cfc3db4c30f12cb2e1250ef676dbd8101a298f8c40a01c9',1024,768,'Terra Gardens residences overlooking a landscaped lawn'),
    media('terra-gardens','interior','interior','https://uae-cms.emaar.com/uploads/422595_interior_0_45674028a3.jpg','9c9387696b690411fd1ba9a457b1aa101f06ba92ef7044bb7f8318dbdb2e1f21',1024,768,'Warm neutral bedroom interior at Terra Gardens')
  ]),
  'the-serene-sobha-central':Object.freeze([
    media('the-serene-sobha-central','hero','hero','https://sobharealty.com/sites/default/files/2025-08/Banner%201440x618%20%E2%80%93%2014.jpg','8560a6c3d7574f05c8ea25db19b2ccd612a686184f319b007b49f1426ecc34c3',2880,1236,'The Serene tower at Sobha Central against the Dubai skyline'),
    media('the-serene-sobha-central','exterior','exterior','https://sobharealty.com/sites/default/files/2025-08/Listing%20372x274%20%E2%80%93%2040.jpg','02c84d991db01abacb7504a83099a69522f7ba95f933c9d40b96c287973d2f72',744,548,'The Serene and Sobha Central landscaped podium'),
    media('the-serene-sobha-central','interior','interior','https://sobharealty.com/sites/default/files/2025-08/Listing%20372x274%20%E2%80%93%2041.jpg','479d7cc620965d5d7a00ffbfc8e81a7d14d8dc3f35cd3648088fbfdb890156ef',744,548,'Open-plan residence interior at The Serene'),
    media('the-serene-sobha-central','amenity-pool','amenity','https://sobharealty.com/sites/default/files/2025-08/Listing%20372x274%20%E2%80%93%2043.jpg','5f1cdd06337f58b5e5729606245f4416db5b92c0848757cd9d9ae17e3d94b74b',744,548,'Landscaped swimming pool at The Serene, Sobha Central')
  ])
});
