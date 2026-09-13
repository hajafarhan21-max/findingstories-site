import { mkdir,writeFile } from 'node:fs/promises';
import { loadPublicProjects } from '../project-launch/registry.js';
import { canonicalUrl } from '../api/_lib/seo.js';

const forbidden=/\b(guaranteed returns?|guaranteed roi|last chance|act now|official azizi representative|limited units? left)\b/i;
const projects=(await loadPublicProjects()).filter(project=>project.distribution);
await mkdir('generated/distribution',{recursive:true});
for(const project of projects){
  const d=project.distribution;
  const text=Object.values(d).flat().join(' ');
  if(forbidden.test(text))throw new Error(`Unsafe distribution claim for ${project.slug}`);
  const tracked=(source,medium,content)=>`${canonicalUrl(project.path)}?${new URLSearchParams({utm_source:source,utm_medium:medium,utm_campaign:`${project.slug}-project-launch`,utm_content:content})}`;
  const urls={canonical:canonicalUrl(project.path),linkedin:tracked('linkedin','organic_social','project_post'),instagram:tracked('instagram','organic_social','bio_link'),facebook:tracked('facebook','organic_social','project_post'),whatsapp_share:tracked('whatsapp','whatsapp_share','direct_share'),editorial:tracked('publication','editorial','project_reference'),directory:tracked('directory_name','directory','project_profile'),partner:tracked('partner_name','partner','project_referral')};
  const output={generated_from:`projects/${project.slug}/manifest.json`,review_required:true,auto_publish:false,project:{name:project.name,developer:d.verified_developer_name,location:d.verified_location_name,property_types:d.property_types},copy:{short_social:d.social_copy_short,medium_social:d.social_copy_medium,long_social:d.social_copy_long,linkedin:d.linkedin_copy,instagram:d.instagram_caption,facebook:d.facebook_copy,x:d.x_copy,whatsapp:`${d.whatsapp_share_copy} ${urls.whatsapp_share}`,directory_short:d.directory_summary,directory_long:d.long_project_summary,citation:d.citation_summary,outreach_intro:d.outreach_summary,press_pitch:d.press_summary},editorial:{summary_50:d.short_project_summary,summary_100:d.long_project_summary,summary_200:`${d.long_project_summary} ${d.press_summary} ${d.availability_disclaimer}`,key_facts:{developer:d.verified_developer_name,location:d.verified_location_name,property_types:d.property_types.join(', ')},starting_price:d.starting_price_summary||'Not approved for distribution.',payment_plan:d.payment_plan_summary||'Not approved for distribution.',completion:d.completion_summary||'Not approved for distribution.',disclaimer:d.availability_disclaimer,contact_cta:`Review ${project.name} and request current information from a Finding Stories advisor at ${canonicalUrl(project.path)}.`},urls,source_of_truth_notes:d.source_of_truth_notes};
  await writeFile(`generated/distribution/${project.slug}.json`,`${JSON.stringify(output,null,2)}\n`);
}
console.log(`Generated review-only distribution assets for ${projects.length} approved project(s).`);
