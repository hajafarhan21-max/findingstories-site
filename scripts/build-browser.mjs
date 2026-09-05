import { build } from 'esbuild';
await build({entryPoints:['client/project-source-upload-client.js'],outfile:'public/project-source-upload-client.js',bundle:true,format:'esm',platform:'browser',target:['es2022'],minify:true,legalComments:'none'});
