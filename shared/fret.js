/* REY shared: pencari bentuk jari (voicing) untuk alat berfret, diagram SVG, dan bunyi petikan. */
(function(){
var NN=["C","C♯","D","E♭","E","F","F♯","G","A♭","A","B♭","B"];
var FR={};
FR.TUN={
 gitar:[["Standar","E A D G B E",[40,45,50,55,59,64]],["Drop D","D A D G B E",[38,45,50,55,59,64]],["DADGAD","D A D G A D",[38,45,50,55,57,62]],["Open G","D G D G B D",[38,43,50,55,59,62]],["Open D","D A D F♯ A D",[38,45,50,54,57,62]],["Open E","E B E G♯ B E",[40,47,52,56,59,64]],["Setengah nada turun","E♭ A♭ D♭ G♭ B♭ E♭",[39,44,49,54,58,63]]]
};
function nums(toks){return toks.map(function(t){return +/^\d+/.exec(t)[0]})}
/* ch: {root:pc, toks:[...], pcs:[...], bass:pc|null}; o: {span,maxFret,minStr,rootBass,maxN} */
FR.voicings=function(tun,ch,o){o=o||{};
 var n=tun.length,span=o.span||3,maxFret=o.maxFret||14,toks=ch.toks,pcs=ch.pcs,nm=nums(toks),drop={},need={},allowed={},i;
 toks.forEach(function(t,k){
  if(t=="5"&&toks.length>=4)drop[pcs[k]]=1;
  if(t=="9"&&(nm.indexOf(11)>=0||nm.indexOf(13)>=0))drop[pcs[k]]=1;
  if(t=="11"&&nm.indexOf(13)>=0)drop[pcs[k]]=1});
 toks.forEach(function(t,k){allowed[pcs[k]]=1;if(!(drop[pcs[k]]&&t!="1"))need[pcs[k]]=1});
 toks.forEach(function(t,k){if(t=="1")need[pcs[k]]=1});
 if(ch.bass!=null){allowed[ch.bass]=1;need[ch.bass]=1}
 var needList=Object.keys(need).map(Number),minStr=o.minStr||Math.min(n,Math.max(needList.length,needList.length<=2?3:4));
 var bassPc=ch.bass!=null?ch.bass:ch.root,rootBass=o.rootBass!==false;
 var res=[],f=new Array(n);
 for(var lo=0;lo<=maxFret;lo++){
  var opts=[];
  for(var s=0;s<n;s++){var a=[-1];if(lo<=4)a.push(0);if(lo>0)for(var q=lo;q<=Math.min(lo+span,maxFret);q++)a.push(q);opts.push(a)}
  (function rec(s){
   if(s==n){leaf(lo);return}
   var a=opts[s];for(var k=0;k<a.length;k++){f[s]=a[k];rec(s+1)}})(0)}
 function leaf(lo){
  var first=-1,last=-1,cnt=0,fmin=99,fmax=0,s;
  for(s=0;s<n;s++)if(f[s]>=0){if(first<0)first=s;last=s;cnt++;if(f[s]>0){if(f[s]<fmin)fmin=f[s];if(f[s]>fmax)fmax=f[s]}}
  if(cnt<minStr)return;
  for(s=first;s<=last;s++)if(f[s]<0)return;
  if(lo==0){if(fmax>0)return}else{if(fmin!=lo)return}
  var have={},lowP=1e9,lowPc=-1;
  for(s=first;s<=last;s++){var m=tun[s]+f[s],pc=m%12;if(!allowed[pc])return;have[pc]=1;if(m<lowP){lowP=m;lowPc=pc}}
  for(var k=0;k<needList.length;k++)if(!have[needList[k]])return;
  if(rootBass&&lowPc!=bassPc)return;
  /* jari */
  var fretted=0,atMin=0,sLo=-1,sHi=-1,over=0,openIn=false;
  for(s=first;s<=last;s++)if(f[s]>0){fretted++;if(f[s]==fmin){atMin++;if(sLo<0)sLo=s;sHi=s}else over++}
  var barre=null,fingers=fretted;
  if(atMin>=2){var ok=true;for(s=sLo;s<=sHi;s++)if(f[s]<fmin){ok=false;break}
   if(ok&&1+over<=fingers){barre={fret:fmin,from:sLo,to:sHi};fingers=1+over}}
  if(fingers>4)return;
  var open=0;for(s=first;s<=last;s++)if(f[s]==0)open++;
  var inner=0;if(lo>=2&&fmax-fmin>=2){var fl=-1,fh=-1;for(s=first;s<=last;s++)if(f[s]>0){if(fl<0)fl=s;fh=s}for(s=fl;s<=fh;s++)if(f[s]==0)inner++}
  var mutes=n-cnt,score=inner*2.2+lo*1.2+mutes*1.4+fingers*1.0+(barre?2.5:0)+(fmax-(fmin==99?0:fmin))*.6-open*.8-cnt*.5;
  res.push({f:f.slice(),lo:lo,hi:fmax,barre:barre,fingers:fingers,mutes:mutes,open:open,score:score})}
 res.sort(function(a,b){return a.score-b.score});
 var out=[],used={},maxN=o.maxN||8;
 res.forEach(function(v){if(out.length<maxN&&!used[v.lo]){used[v.lo]=1;out.push(v)}});
 res.forEach(function(v){if(out.length<maxN&&out.indexOf(v)<0)out.push(v)});
 out.sort(function(a,b){return a.lo-b.lo||a.score-b.score});
 return out};
FR.notes=function(tun,v){var m=[];v.f.forEach(function(x,s){if(x>=0)m.push(tun[s]+x)});return m};
/* diagram */
FR.svg=function(v,tun,ch,o){o=o||{};var n=tun.length,W=170,L=32,R=W-18,dx=(R-L)/(n-1),top=52,rh=32,rows=5,H=top+rows*rh+34,
 base=v.hi<=5?1:v.lo,x=function(s){return L+s*dx},h="";
 var tokOf={},nameOf={};ch.pcs.forEach(function(pc,k){if(tokOf[pc]==null){tokOf[pc]=ch.toks[k];nameOf[pc]=ch.names[k]}});
 for(var r=0;r<=rows;r++)h+='<line x1="'+L+'" y1="'+(top+r*rh)+'" x2="'+R+'" y2="'+(top+r*rh)+'" stroke="#5b4a22" stroke-width="'+(r==0&&base==1?5:1.2)+'"/>';
 for(var s=0;s<n;s++)h+='<line x1="'+x(s)+'" y1="'+top+'" x2="'+x(s)+'" y2="'+(top+rows*rh)+'" stroke="#8a7a52" stroke-width="'+(1+(n-1-s)*.12)+'"/>';
 if(base>1)h+='<text x="2" y="'+(top+rh/2+4)+'" fill="#f4d67e" font-size="12" font-weight="bold">'+base+'fr</text>';
 if(v.barre&&v.barre.fret-base<rows){var by=top+(v.barre.fret-base)*rh+rh/2;h+='<rect x="'+(x(v.barre.from)-10)+'" y="'+(by-10)+'" width="'+(x(v.barre.to)-x(v.barre.from)+20)+'" height="20" rx="10" fill="#c8a451"/>'}
 v.f.forEach(function(fr,s){var pc=(tun[s]+Math.max(fr,0))%12,isRoot=pc==ch.root,lab="";
  if(fr>=0&&o.label=="note")lab=nameOf[pc]||NN[pc];else if(fr>=0&&o.label=="deg")lab=tokOf[pc]!=null?REY.fmt(tokOf[pc]):"";
  if(fr<0)h+='<text x="'+x(s)+'" y="'+(top-12)+'" fill="#9a9a9a" font-size="15" text-anchor="middle">×</text>';
  else if(fr==0){h+='<circle cx="'+x(s)+'" cy="'+(top-15)+'" r="6" fill="none" stroke="'+(isRoot?"#f4d67e":"#c8a451")+'" stroke-width="2"/>';if(lab)h+='<text x="'+x(s)+'" y="'+(top-24)+'" fill="#ddd" font-size="9" text-anchor="middle">'+lab+'</text>'}
  else{var cy=top+(fr-base)*rh+rh/2;h+='<circle cx="'+x(s)+'" cy="'+cy+'" r="11" fill="'+(isRoot?"#f4d67e":"#c8a451")+'"/>'+(lab?'<text x="'+x(s)+'" y="'+(cy+4)+'" fill="#111" font-size="'+(lab.length>2?9:11)+'" font-weight="bold" text-anchor="middle">'+lab+'</text>':"")}});
 for(s=0;s<n;s++)h+='<text x="'+x(s)+'" y="'+(H-8)+'" fill="#777" font-size="10" text-anchor="middle">'+NN[tun[s]%12]+'</text>';
 return'<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Diagram chord">'+h+'</svg>'};
/* bunyi petikan (Karplus-Strong) */
var ac;
FR.pluck=function(ms,gap){ac=ac||new(window.AudioContext||window.webkitAudioContext)();if(ac.state=="suspended")ac.resume();
 var sr=ac.sampleRate,t0=ac.currentTime+.05;
 ms.forEach(function(m,i){var fq=REY.hz(m),N=Math.max(2,Math.round(sr/fq)),len=Math.floor(sr*2.2),buf=ac.createBuffer(1,len,sr),d=buf.getChannelData(0),ln=new Float32Array(N),k,p=0;
  for(k=0;k<N;k++)ln[k]=Math.random()*2-1;
  for(k=0;k<len;k++){var a=ln[p],b=ln[(p+1)%N];d[k]=a;ln[p]=(a+b)*.5*.997;p=(p+1)%N}
  var s=ac.createBufferSource();s.buffer=buf;var g=ac.createGain();g.gain.value=.3;s.connect(g);g.connect(ac.destination);s.start(t0+i*gap)})};
window.FR=FR;
})();
