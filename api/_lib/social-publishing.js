const METHODS=['publishPost','publishImage','publishVideo','getPostStatus','getProfileStatus','getAnalytics'];

/** Review-only boundary for future official platform clients. No network calls are made here. */
export class SocialPublishingAdapter{
  constructor(platform,{mode='DRY_RUN'}={}){
    if(!['DRY_RUN','REVIEW_ONLY'].includes(mode))throw new Error('Social publishing is locked to DRY_RUN or REVIEW_ONLY until an approved client is implemented.');
    this.platform=platform; this.mode=mode;
  }
  payload(operation,input={}){return {platform:this.platform,operation,mode:this.mode,published:false,external_action_performed:false,input};}
}
for(const method of METHODS)SocialPublishingAdapter.prototype[method]=function(input){return this.payload(method,input);};

export const supportedSocialPlatforms=['linkedin','instagram','facebook','x','youtube','google-business-profile'];
export function createSocialAdapter(platform,options){
  if(!supportedSocialPlatforms.includes(platform))throw new Error(`Unsupported social platform: ${platform}`);
  return new SocialPublishingAdapter(platform,options);
}
