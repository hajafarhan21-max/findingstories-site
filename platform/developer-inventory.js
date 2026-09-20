/**
 * Source-backed developer inventory used on developer lifecycle pages.
 * These are directory records, not live inventory and not full project guides.
 * Status reflects the cited official source at the reviewed date.
 */
const reviewed='2026-09-20';
const record=(developerSlug,name,statusSlug,area,sourceUrl,note)=>Object.freeze({developerSlug,name,statusSlug,area,sourceUrl,reviewed,note,availability:'NOT_ASSERTED'});
export const VERIFIED_DEVELOPER_INVENTORY=Object.freeze([
  record('deyaar','DWTN Residences','new-launches','Dubai','https://www.deyaar.ae/en/new-launches/','Listed by Deyaar under New Launches.'),
  record('deyaar','ParkFive','new-launches','Dubai Production City','https://www.deyaar.ae/en/new-launches/','Listed by Deyaar under New Launches.'),
  record('deyaar','AYA','new-launches','Umm Al Quwain','https://www.deyaar.ae/en/new-launches/','Listed by Deyaar under New Launches.'),
  record('deyaar','ELEVE','new-launches','Jebel Ali','https://www.deyaar.ae/en/new-launches/','Listed by Deyaar under New Launches.'),
  record('deyaar','Rosalia Residences','new-launches','Al Furjan','https://www.deyaar.ae/en/new-launches/','Listed by Deyaar under New Launches.'),
  record('deyaar','Rivage','new-launches','Abu Dhabi','https://www.deyaar.ae/en/new-launches/','Listed by Deyaar under New Launches.'),
  record('deyaar','Jannat Midtown','ready','Dubai Production City','https://www.deyaar.ae/en/construction-update/','Deyaar reports completion, statutory approvals and handovers in progress.'),
  record('deyaar','Regalia','ready','Business Bay','https://www.deyaar.ae/en/construction-update/','Deyaar reports completion and homeowner handovers in progress.'),
  record('deyaar','Millennium Talia Residences','ready','Al Furjan','https://www.deyaar.ae/en/construction-update/','Deyaar reports statutory approvals completed and handover phase under way.'),
  record('deyaar','Tria','under-construction','Dubai Silicon Oasis','https://www.deyaar.ae/en/construction-update/','Deyaar reports final-stage construction toward completion.'),
  record('aldar','The Wilds Residences','off-plan','Dubai','https://www.aldar.com/en/news-and-media/aldar-introduces-the-wilds-residences','Official Aldar launch release dated February 2026.'),
  record('aldar','Yas Riva Reserve','new-launches','Yas Island','https://www.aldar.com/en/news-and-media/aldar-launches-yas-riva-reserve-a-gated-villa-community-along-yas-island-s-scenic-waterfront','Official Aldar launch release dated September 2026.'),
  record('aldar','Baccarat Residences Saadiyat','off-plan','Saadiyat Island','https://www.aldar.com/en/news-and-media/aldar-launches-baccarat-residences-saadiyat','Official Aldar launch release dated February 2026.'),
  record('arada','Inaura Downtown','off-plan','Downtown Dubai','https://www.arada.com/en/latest-news/arada-introduces-inaura-a-dynamic-fitness-led-hospitality-and-branded-residences-concept-with-a-debut-location-in-downtown-dubai/','Arada announced sales launch for the branded residences in January 2026.'),
  record('arada','W Residences Dubai Harbour','under-construction','Dubai Harbour','https://www.arada.com/en/latest-news/arada-awards-aed1-55-billion-main-construction-contract-for-w-residences-at-dubai-harbour/','Arada reports early works under way and main construction contract awarded.')
]);
export const inventoryForDeveloper=developerSlug=>VERIFIED_DEVELOPER_INVENTORY.filter(item=>item.developerSlug===developerSlug);
