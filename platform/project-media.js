/**
 * Governed, project-isolated media selected from the developers' public project pages.
 * Remote bytes are integrity-pinned and materialized by scripts/materialize-project-media.mjs.
 */
const reviewed='2026-09-16';
const media=(projectSlug,id,kind,sourceUrl,sha256,width,height,alt,localSource)=>Object.freeze({
  id:`${projectSlug}-${id}`,projectSlug,kind,sourceUrl,sourceType:'OFFICIAL_DEVELOPER_PROJECT_PAGE',
  originalFilename:decodeURIComponent(new URL(sourceUrl).pathname.split('/').at(-1)),assetType:'IMAGE',mediaRole:kind,
  sha256,width,height,alt,...(localSource?{localSource}:{}),retrievedAt:reviewed,reviewedAt:reviewed,approvalState:'APPROVED',usageState:'APPROVED',verificationState:'VERIFIED',
  path:`/assets/projects/${projectSlug}/${id}`
});
const brochureMedia=(projectSlug,id,kind,sourceUrl,sourcePage,localSource,sha256,width,height,alt,unitType)=>Object.freeze({
  id:`${projectSlug}-${id}`,projectSlug,kind,sourceUrl,sourcePage,sourceType:'OFFICIAL_DEVELOPER_BROCHURE',
  originalFilename:decodeURIComponent(new URL(sourceUrl).pathname.split('/').at(-1)),localSource,assetType:'IMAGE',mediaRole:kind,
  sha256,width,height,alt,...(unitType?{unitType}:{}),retrievedAt:reviewed,reviewedAt:reviewed,approvalState:'APPROVED',usageState:'APPROVED',verificationState:'VERIFIED',
  path:`/assets/projects/${projectSlug}/${id}`
});

export const PROJECT_MEDIA=Object.freeze({
  'terra-gardens':Object.freeze([
    media('terra-gardens','hero','hero','https://uae-cms.emaar.com/uploads/422604_hero_slide_0_658baa7ad8.jpg','c4e56d31d69ffba1e621a350997a52f0b2fa178fbced3a32dcf05e502766c415',1620,832,'Landscaped running trail and gardens at Terra Gardens'),
    media('terra-gardens','amenity-pool','amenity','https://uae-cms.emaar.com/uploads/422565_feature_block_0_fc7e3c0a70.jpg','9d7a1b241b26268a0bebe608e4cfc56647c531cfd948e2aec10d6b365c2d35d3',1200,655,'Residents’ swimming pool at Terra Gardens'),
    media('terra-gardens','exterior','exterior','https://uae-cms.emaar.com/uploads/422580_exterior_1_ea34328743.jpg','c7a58e43864250165cfc3db4c30f12cb2e1250ef676dbd8101a298f8c40a01c9',1024,768,'Terra Gardens residences overlooking a landscaped lawn'),
    media('terra-gardens','interior','interior','https://uae-cms.emaar.com/uploads/422595_interior_0_45674028a3.jpg','9c9387696b690411fd1ba9a457b1aa101f06ba92ef7044bb7f8318dbdb2e1f21',1024,768,'Warm neutral bedroom interior at Terra Gardens'),
    media('terra-gardens','exterior-2','exterior','https://uae-cms.emaar.com/uploads/422577_exterior_0_81fe11979a.jpg','46702fdbb14bc4911e92ae42d0c09ccdda21fb25d1ce9cb4144f1d6085eda13d',1024,768,'Terra Gardens exterior arrival'),
    media('terra-gardens','exterior-3','exterior','https://uae-cms.emaar.com/uploads/422583_exterior_2_c01a57b764.jpg','76ab1fcdb3c4a3047d73126da4809a1280d92c5625d87a8f9de4482b2c7a1306',1024,768,'Terra Gardens landscaped exterior'),
    media('terra-gardens','interior-2','interior','https://uae-cms.emaar.com/uploads/422598_interior_1_2305667385.jpg','c01745c180439e8fe2857b6a8f44c932d3bc54024726501f990f7dd1d4b21db0',1024,768,'Terra Gardens living room interior'),
    media('terra-gardens','interior-3','interior','https://uae-cms.emaar.com/uploads/422601_interior_2_7580d90964.jpg','4cbd04f2e3a6dd0a1a0be7c4144cedb60c99a76ed1127ceff0fe65d42b9cf5ad',1024,768,'Terra Gardens kitchen interior'),
    media('terra-gardens','amenity-2','amenity','https://uae-cms.emaar.com/uploads/422568_feature_block_1_1b1391c58f.jpg','f690abe899ac8a7dca52b8d7795b0d3348fbc9619852a75ef7b7fb70e9f7bd2c',1200,655,'Terra Gardens outdoor amenity'),
    media('terra-gardens','lifestyle-1','lifestyle','https://uae-cms.emaar.com/uploads/422571_feature_block_2_89277ee917.jpg','b6b1ba9e8c621db497cbb66e27130b54a5de67eed892f31fb2ab9744bd034f9a',1200,655,'Terra Gardens landscaped lifestyle'),
    media('terra-gardens','lifestyle-2','lifestyle','https://uae-cms.emaar.com/uploads/422607_hero_slide_1_c5cdcc3630.jpg','a5b5db62f99b074054e67c0694b5fefaa26a843e64d398558bd5cbf9ef879c5c',1620,832,'Terra Gardens community lifestyle'),
    media('terra-gardens','lifestyle-3','lifestyle','https://uae-cms.emaar.com/uploads/422610_hero_slide_2_98ec746c8c.jpg','ae2521632296bc55105eeb5cb23cf0ce39d60426d6ea7ab0f99cff47ac30605e',1620,832,'Terra Gardens garden lifestyle')
  ]),
  'the-serene-sobha-central':Object.freeze([
    media('the-serene-sobha-central','hero','hero','https://sobharealty.com/sites/default/files/2025-08/Banner%201440x618%20%E2%80%93%2014.jpg','8560a6c3d7574f05c8ea25db19b2ccd612a686184f319b007b49f1426ecc34c3',2880,1236,'The Serene tower at Sobha Central against the Dubai skyline'),
    media('the-serene-sobha-central','exterior','exterior','https://sobharealty.com/sites/default/files/2025-08/Listing%20372x274%20%E2%80%93%2040.jpg','02c84d991db01abacb7504a83099a69522f7ba95f933c9d40b96c287973d2f72',744,548,'The Serene and Sobha Central landscaped podium'),
    // Upstream bytes for the previously reviewed interior changed on Sobha's server.
    // Fail closed: omit the asset until the replacement bytes are independently reviewed and re-pinned.
    media('the-serene-sobha-central','amenity-pool','amenity','https://sobharealty.com/sites/default/files/2025-08/Listing%20372x274%20%E2%80%93%2043.jpg','5f1cdd06337f58b5e5729606245f4416db5b92c0848757cd9d9ae17e3d94b74b',744,548,'Landscaped swimming pool at The Serene, Sobha Central'),
    media('the-serene-sobha-central','amenity-2','amenity','https://sobharealty.com/sites/default/files/2025-08/Listing%20372x274%20%E2%80%93%2042.jpg','509c469aa53a1ebd85dda2664d489295b5beb7bfd3fe90f39f98a6af74b8af18',744,548,'Lifestyle amenity at The Serene'),
    media('the-serene-sobha-central','amenity-3','amenity','https://sobharealty.com/sites/default/files/2025-08/Listing%20372x274%20%E2%80%93%2044.jpg','b10281b6e7744f4dee9c9721a50741e0362b5a1d339b324ee0b6565066ca3245',744,548,'Landscaped leisure space at The Serene'),
    media('the-serene-sobha-central','amenity-4','amenity','https://sobharealty.com/sites/default/files/2025-08/Listing%20372x274%20%E2%80%93%2046.jpg','e22150e45fa9192088a936ba4f7b2aee3c1ffe04d4adc3260bd42bf313e2ee69',744,548,'Resident amenity at The Serene'),
    media('the-serene-sobha-central','amenity-5','amenity','https://sobharealty.com/sites/default/files/2025-08/Listing%20372x274%20%E2%80%93%2047.jpg','242c898bf657c2fa1aa12238aecd8a4ed68306799da237706ca4dc33e5292f2c',744,548,'Sobha Central community amenity'),
    brochureMedia('the-serene-sobha-central','location-map','location-map','https://sobharealty.com/sites/default/files/2025-08/SOBHA%20CENTRAL%20-%20THE%20SERENE%20BROCHURE_0.pdf',29,'assets-source/project-media/serene-map.webp.base64','eb79c1d7b138b98dfa1df10205d27130c40b307e97e779e11b621df682ae86a1',1400,990,'Official location plan for Sobha Central'),
    brochureMedia('the-serene-sobha-central','floor-plan-1br','floor-plan','https://sobharealty.com/sites/default/files/2025-08/SOBHA%20CENTRAL%20-%20THE%20SERENE%20BROCHURE_0.pdf',34,'assets-source/project-media/serene-1br.webp.base64','f988a03678847ffdf212e35326c57a9e68fcf25227f586dfb900590bd0ce7f6f',834,1179,'Official one-bedroom floor plan at The Serene','1'),
    brochureMedia('the-serene-sobha-central','floor-plan-2br','floor-plan','https://sobharealty.com/sites/default/files/2025-08/SOBHA%20CENTRAL%20-%20THE%20SERENE%20BROCHURE_0.pdf',61,'assets-source/project-media/serene-2br.webp.base64','1dc577ea2daa29c49874e22f6f33b52cd0a4e5e3a72067a8ebbf22d7989a0a5f',834,1179,'Official two-bedroom floor plan at The Serene','2')
  ]),
  'sparklz-by-danube':Object.freeze([
    media('sparklz-by-danube','hero','hero','https://danubeproperties.com/wp-content/uploads/2026/05/sparklz.jpg','d801b1e42a4975be2d0e910b57dec104f5c9a520ced7692289f5a2a72036debc',1280,685,'Sparklz by Danube project exterior')
  ]),
  'w-residences-dubai-harbour':Object.freeze([
    media('w-residences-dubai-harbour','hero','hero','https://aradawebcontent.blob.core.windows.net/arada-com/2024/07/W-Residences-hero-banner-jpg.webp','b8e1c1b7eea2426ff70ff60e3f49e55bbeefe09c07a665db5ceefc61e312a4eb',1920,759,'Official W Residences Dubai Harbour exterior'),
    media('w-residences-dubai-harbour','exterior-1','exterior','https://aradawebcontent.blob.core.windows.net/arada-com/2024/06/front-view-1-jpg.webp','1cd7f38e8c4696b9419e3137d4d2318467405c794814cdb24f361bbae6357e5f',1280,1080,'W Residences Dubai Harbour waterfront exterior'),
    media('w-residences-dubai-harbour','interior-1','interior','https://aradawebcontent.blob.core.windows.net/arada-com/2024/10/W-new-feature-6.jpg','495de5e0dc02451d568e540f7f1cc1969260c3cfbf61e9afc2423993111d6ba0',812,441,'W Residences Dubai Harbour residence interior'),
    media('w-residences-dubai-harbour','amenity-1','amenity','https://aradawebcontent.blob.core.windows.net/arada-com/2024/10/W-home-page.jpg','161f7664bac39824b5393708478fe6a39cf1b0200e24945c2153e9110446ac48',829,415,'W Residences Dubai Harbour amenity space'),
    media('w-residences-dubai-harbour','lifestyle-1','lifestyle','https://aradawebcontent.blob.core.windows.net/arada-com/2024/07/W-residences-feature-11-jpg.webp','4be1d77f30f36064b1df9c6ea4acf21275100d63cbe0492d8f7920d92ecab4d7',829,415,'W Residences Dubai Harbour lifestyle setting')
  ]),
  'yas-riva':Object.freeze([
    media('yas-riva','hero','hero','https://asset.aldar.com/damascus/launch/mp-yasriva/yas_banner_01.jpg','6cd92c31fcb769a6421d19984dd381d81396ea63d894f716e1a769cfaf02ccdc',1200,675,'Yas Riva canal-front villas'),
    media('yas-riva','exterior-1','exterior','https://asset.aldar.com/damascus/launch/mp-yasriva/yas_banner_03.jpg','3069aa442779a73c82fc5219e52d718b2cfee2c1154140cf71d73a1dac27fc94',2000,1100,'Yas Riva waterfront villa exterior'),
    media('yas-riva','interior-1','interior','https://asset.aldar.com/damascus/launch/mp-yasriva/refined_story.jpg','2a3c9b5587e193806abe1c14247c7601e4d0274b43b2c286bb99a126831fa023',2000,1380,'Yas Riva refined residence interior'),
    media('yas-riva','amenity-1','amenity','https://asset.aldar.com/damascus/launch/mp-yasriva/tab_one_theme.jpg','8212bef7dd9544c41319b32259c46f0a8b35106e850a1e2c4bb93f671c6be6f3',1000,968,'Yas Riva community amenity'),
    media('yas-riva','lifestyle-1','lifestyle','https://asset.aldar.com/damascus/launch/mp-yasriva/lifestyle_banner.webp','4a7a1218f89344db4f11c3b96ea34ac850e2dfeae9f5be97c1e9f5e83c031c58',3583,2389,'Yas Riva waterfront lifestyle')
  ]),
  'mar-casa':Object.freeze([
    media('mar-casa','hero','hero','https://www.deyaar.ae/wp-content/uploads/2023/07/image-3-1.jpg','2b7a1d79645ee70c2b8fa3a9a0082076962d74704ecf1a6ea4d4a75d143d3a7a',2080,1170,'Mar Casa tower exterior'),
    media('mar-casa','exterior-1','exterior','https://www.deyaar.ae/wp-content/uploads/2023/07/Rectangle-144-2.jpg','eb48a62633206fe8181e50dc87e776db8315ca8ec93455a3b83989133ba54a42',960,960,'Mar Casa architectural exterior'),
    media('mar-casa','interior-1','interior','https://www.deyaar.ae/wp-content/uploads/2023/07/Rectangle-143-2-scaled.jpg','a635fefb960743d5a5925d090d5e0dcc58e20605ccd8605b47a3439a4cc7908f',2560,1071,'Mar Casa residence interior'),
    media('mar-casa','amenity-1','amenity','https://www.deyaar.ae/wp-content/uploads/2023/07/Rectangle-23-2.jpg','5890e0a3edb262f1ccf79fd33411e81d5075de5008a5210a9c028791661a9eb9',1216,1216,'Mar Casa resident amenity'),
    media('mar-casa','lifestyle-1','lifestyle','https://www.deyaar.ae/wp-content/uploads/2023/07/Rectangle-15-4-2.jpg','00ddd294b5dab272a8eacc4b4bccf6992c1f40f058c320e780d7ff81a0d3ae38',1344,800,'Mar Casa waterfront lifestyle'),
    brochureMedia('mar-casa','location-map','location-map','https://www.deyaar.ae/wp-content/uploads/2023/07/MAR-CASA-Brochure.pdf',10,'assets-source/project-media/mar-map.webp.base64','ce9824d8ab24cd05a472b423cc62bd1e110df6d303d09e5fc30e40612f5b435d',1400,788,'Official Mar Casa location map'),
    brochureMedia('mar-casa','floor-plan-1br','floor-plan','https://www.deyaar.ae/wp-content/uploads/2023/07/MAR-CASA-Brochure.pdf',38,'assets-source/project-media/mar-1br.webp.base64','3136c2c7af7fbcc9b5c19131d1febdefc8439ac7497c90d5c16fff6cc86849a3',1400,788,'Official Mar Casa one-bedroom floor plan','1'),
    brochureMedia('mar-casa','floor-plan-2br','floor-plan','https://www.deyaar.ae/wp-content/uploads/2023/07/MAR-CASA-Brochure.pdf',45,'assets-source/project-media/mar-2br.webp.base64','5eea321c9131fec77d568707f3c06245c6f686b824ede6b16a215865421ad3ff',1400,788,'Official Mar Casa two-bedroom floor plan','2'),
    brochureMedia('mar-casa','floor-plan-3br','floor-plan','https://www.deyaar.ae/wp-content/uploads/2023/07/MAR-CASA-Brochure.pdf',51,'assets-source/project-media/mar-3br.webp.base64','0817dec33470b62184d605b094a4247b148f3c674b1722332b85bf618484b216',1400,788,'Official Mar Casa three-bedroom floor plan','3')
  ]),
  'olfah':Object.freeze([
    media('olfah','hero','hero','https://www.alefgroup.ae/wp-content/uploads/2026/04/Group-72743-scaled.jpg','2cef0904363167f48c64cee6d1ea5261de5945d902a6f01e4d1a28010f56d314',2560,978,'Olfah landscaped community','assets-source/project-media/olfah-hero.jpg.base64'),
    media('olfah','exterior-1','exterior','https://www.alefgroup.ae/wp-content/uploads/2026/05/Community-3.jpg','3bda4aabe7102a72874bd6c53a100761949a608f5be796413b7607f173161242',972,603,'Olfah residential exterior','assets-source/project-media/olfah-exterior-1.jpg.base64'),
    media('olfah','interior-1','interior','https://www.alefgroup.ae/wp-content/uploads/2026/05/Property-1.jpg','fb0835bf5bf6070e836268d3c6f2128e47e1fa1f239e89718eabd22d8f544717',1296,804,'Olfah apartment interior','assets-source/project-media/olfah-interior-1.jpg.base64'),
    media('olfah','amenity-1','amenity','https://www.alefgroup.ae/wp-content/uploads/2026/05/Community-4.jpg','d29ab40e2aab27b0168006aca5207f3706abb6157f5126014e7f239585dcad4a',972,603,'Olfah landscaped amenity','assets-source/project-media/olfah-amenity-1.jpg.base64'),
    media('olfah','lifestyle-1','lifestyle','https://www.alefgroup.ae/wp-content/uploads/2026/05/Community-5-2x.jpg','272c434a59202d6956c153cd4b5aaf47df867bc5a3b0f0d8a208474185e515f8',972,603,'Olfah community lifestyle','assets-source/project-media/olfah-lifestyle-1.jpg.base64')
  ])
});
