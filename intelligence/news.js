import {mayPublish} from './governance.js';
export const publishableNews=items=>items.filter(mayPublish);
