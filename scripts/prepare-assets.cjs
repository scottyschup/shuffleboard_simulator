// Give changed assets new URLs so an older cached stylesheet cannot style new HTML.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),out=path.join(dist,'assets');
fs.mkdirSync(out,{recursive:true});
for(const name of fs.readdirSync(out))if(/^(style|app|physics)\.[a-f0-9]{12}\.(css|js)$/.test(name))fs.unlinkSync(path.join(out,name));
let html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
for(const name of ['style.css','physics.js','app.js']){
 const data=fs.readFileSync(path.join(dist,name)),hash=crypto.createHash('sha256').update(data).digest('hex').slice(0,12);
 const [stem,ext]=name.split('.'),asset=`assets/${stem}.${hash}.${ext}`;
 fs.writeFileSync(path.join(dist,asset),data);
 const previous=new RegExp(`(?:assets/)?${stem}(?:\\.[a-f0-9]{12})?\\.${ext}(?:\\?[^\"']*)?`,'g');
 html=html.replace(previous,asset);
}
fs.writeFileSync(path.join(dist,'index.html'),html);
