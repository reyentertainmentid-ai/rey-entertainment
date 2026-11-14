/* REY shared: alat bersama untuk aplikasi baris 4 (suara, keyboard, pencarian chord, kunci). Butuh theory.js dan chord-data.js. */
(function(){
var NAT=[0,2,4,5,7,9,11],
RM=["C","D♭","D","E♭","E","F","F♯","G","A♭","A","B♭","B"],
RN=["C","C♯","D","E♭","E","F","F♯","G","G♯","A","B♭","B"],
SH=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"],
FLT=["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];
var $=function(s){return document.querySelector(s)},$$=function(s){return [].slice.call(document.querySelectorAll(s))};
/* suara */
var ac;function ctx(){ac=ac||new(window.AudioContext||window.webkitAudioContext)();if(ac.state=="suspended")ac.resume()}
function blip(m,t,d){var o=ac.createOscillator(),g=ac.createGain();o.type="triangle";o.frequency.value=REY.hz(m);g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.28,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+d+.05)}
function chord(ms,arp){ctx();var t=ac.currentTime+.05;ms.forEach(function(m,i){blip(m,t+(arp?i*.28:0),arp?.9:1.5)})}
function list(L,gap){ctx();gap=gap||1.1;var t=ac.currentTime+.05;L.forEach(function(ms,j){ms.forEach(function(m){blip(m,t+j*gap,gap+.1)})})}
function notes(ms,gap){ctx();gap=gap||.32;var t=ac.currentTime+.05;ms.forEach(function(m,i){blip(m,t+i*gap,.5)})}
/* keyboard */
function kb(o){var w=0,wh="",bl="",n;
for(n=0;n<=12;n++){var pc=n%12,white=NAT.indexOf(pc)>=0,on=o.hl.has(pc),f=on?(pc==o.root?"#f4d67e":"#c8a451"):(white?"#ececec":"#222"),x=w*40,ls=o.lab(pc);
var r=white?'<rect x="'+x+'" y="0" width="38" height="130" rx="3" fill="'+f+'"/>':'<rect x="'+(x-12)+'" y="0" width="24" height="78" rx="2" fill="'+f+'" stroke="#000"/>';
var t=ls.map(function(s,i){return'<text class="kt" x="'+(white?x+19:x)+'" y="'+(white?122:32+i*14)+'" fill="'+(on||white?"#111":"#ddd")+'">'+s+'</text>'}).join("");
if(white){wh+=r+t;w++}else bl+=r+t}
return'<svg viewBox="0 0 320 132" style="max-width:520px" role="img" aria-label="Tuts piano">'+wh+bl+'</svg>'}
function kbOf(ns,rootpc){var mp=new Map(ns.map(function(x){return[x.pc,x.n]}));return kb({hl:new Set(mp.keys()),root:rootpc,lab:function(pc){return mp.has(pc)?[mp.get(pc)]:[]}})}
/* data chord */
function OK(c){return !(c[4]||"").startsWith("USUL")}
function types(g){return REY_DATA.chords.filter(function(c){return(g=="sus"?(c[3]=="sus"||c[3]=="power"):c[3]==g)&&OK(c)})}
function allTypes(){return REY_DATA.chords.filter(OK)}
function strip(s){return s.replace(/[()]/g,"")}
var BY={},BYS={};
function idx(){if(BY.__done)return;allTypes().forEach(function(c){BY[c[0]]=c;BYS[strip(c[0])]=c});BY.__done=1}
function normSym(s){s=(s||"").trim();
s=s.replace(/b/g,"♭").replace(/#/g,"♯");
if(/^(maj|Maj|MAJ|Ma|M|Δ|△)$/.test(s))return "";
s=s.replace(/^(Maj|MAJ|Ma|M|Δ|△)(?=\d)/,"maj").replace(/^(min|Min|mi|−|-)(?!aj)/,"m");
s=s.replace(/^mM(\d+)/,"m(maj$1)").replace(/^m\(?[M](\d+)\)?/,"m(maj$1)");
s=s.replace(/^dom/,"").replace(/°7/,"dim7").replace(/°/,"dim").replace(/ø7?/,"m7♭5").replace(/^aug7/,"7♯5").replace(/^\+7/,"7♯5").replace(/^\+$/,"aug").replace(/^\+/,"aug");
s=s.replace(/^(7|9|maj7|maj9)sus$/,"$1sus4").replace(/^sus$/,"sus4").replace(/m7-5|m7−5/,"m7♭5").replace(/-5|−5/,"♭5").replace(/\+5/,"♯5").replace(/^maj7\+5/,"maj7♯5");
if(s=="m6/9"||s=="min6/9")s="m6/9";
return s}
function resolve(sfx){idx();var s=normSym(sfx);return BY[s]||BYS[strip(s)]||null}
/* nama nada */
function pcOf(l,a){var li="CDEFGAB".indexOf(l);return((NAT[li]+(a=="♯"||a=="#"?1:a=="♭"||a=="b"?-1:0))%12+12)%12}
function spell(pc,flat){return(flat?FLT:SH)[((pc%12)+12)%12]}
function nice(n){return n.replace(/#/g,"♯").replace(/b/g,"♭")}
/* baca chord: C, F#m7b5, Bb13, G/B */
var TOK=/^(?:maj|Maj|MAJ|min|dim|aug|sus|add|dom|m|M|\+|°|ø|Δ|△|-|−|\d+|[#♯b♭]|\(|\)|\/(?=\d))*$/;
function split(tok){var m=/^([A-G])([#♯b♭]?)(.*?)(?:\/([A-G])([#♯b♭]?))?$/.exec(tok);if(!m)return null;
if(!TOK.test(m[3]))return null;
return{r:m[1]+m[2],root:pcOf(m[1],m[2]),sfx:m[3],b:m[4]?m[4]+m[5]:null,bass:m[4]?pcOf(m[4],m[5]):null}}
function parse(tok){var p=split(tok);if(!p)return null;var row=resolve(p.sfx);if(!row)return null;p.row=row;return p}
function midiOf(rootName,row,bassName){var r=REY.parse(rootName),ns=REY.chordOf(r,row[1]),b=REY.base(r.pc);return{ns:ns,midi:ns.map(function(x){return b+x.s}),root:r.pc}}
/* kenali chord dari kumpulan nada (pc): kembalikan semua kemungkinan */
function nameOf(pcs,flat,groups){var set=new Set(pcs),out=[],G=groups||["triad","7th","sus","power","tambahan","sus7","9th","ekstensi"];
G.forEach(function(g){types(g).forEach(function(c){for(var r=0;r<12;r++){
var ns=c[1].split(" ").map(function(t){var m=/^(\d+)([b#]*)$/.exec(t),d=+m[1],a=0,i;for(i=0;i<m[2].length;i++)a+=m[2][i]=="#"?1:-1;return(r+NAT[(d-1)%7]+a+120)%12});
var s=new Set(ns);if(s.size==set.size&&ns.every(function(x){return set.has(x)}))out.push({root:r,name:spell(r,flat)+c[0],row:c})}})});
return out}
/* kunci */
var KEYS=[],i;for(i=0;i<12;i++)KEYS.push(FLT[i]==SH[i]?SH[i]:(i==6?"F#":FLT[i]));
var FLATKEYS={F:1,Bb:1,Eb:1,Ab:1,Db:1,Gb:1,Dm:1,Gm:1,Cm:1,Fm:1,Bbm:1,Ebm:1};
function keyFlat(k){return !!FLATKEYS[k]||/b/.test(k.slice(1))}
function copy(t,btn){var done=function(){var o=btn.textContent;btn.textContent="Tersalin";setTimeout(function(){btn.textContent=o},1200)};
try{navigator.clipboard.writeText(t).then(done,function(){fallback()})}catch(e){fallback()}
function fallback(){var a=document.createElement("textarea");a.value=t;document.body.appendChild(a);a.select();try{document.execCommand("copy");done()}catch(e){}a.remove()}}
/* rangkaian nada (naik) dari tangga nada */
function scaleMidi(s,base){var a=s.slice().sort(function(x,y){return x.s-y.s}).map(function(x){return base+x.s});a.push(base+12);return a}
/* chord tiap derajat dari tangga nada 7 nada */
var QT={"0,4,7":"","0,3,7":"m","0,3,6":"dim","0,4,8":"aug"},
Q7={"0,4,7,11":"maj7","0,4,7,10":"7","0,3,7,10":"m7","0,3,6,10":"m7♭5","0,3,6,9":"dim7","0,3,7,11":"m(maj7)","0,4,8,11":"maj7♯5","0,4,8,10":"7♯5","0,4,6,10":"7♭5","0,3,6,11":"dim(maj7)"},
RO=["I","II","III","IV","V","VI","VII"],FN=["T","S","T","S","D","T","D"],FNM={T:"Tonik",S:"Subdominan",D:"Dominan"};
function degs(r,formula){var s=REY.scaleOf(r,formula);if(s.length!=7)return null;var b=REY.base(r.pc);
return s.map(function(x,i){var ks3=[0,2,4].map(function(k){return i+k}),ks4=[0,2,4,6].map(function(k){return i+k}),
iv=function(ks){return ks.map(function(k){return((s[k%7].s+12*Math.floor(k/7)-x.s)%12+12)%12}).join(",")},
q3=QT[iv(ks3)],q7=Q7[iv(ks4)],d=x.s-NAT[i],up=q3===""||q3=="aug",
num=(d<0?"♭":d>0?"♯":"")+(up?RO[i]:RO[i].toLowerCase())+(q3=="dim"?"°":q3=="aug"?"+":""),
mi=function(ks){return ks.map(function(k){return b+s[k%7].s+12*Math.floor(k/7)})};
return{i:i,note:x.n,pc:x.pc,s:x.s,q3:q3,q7:q7,num:num,fn:FN[i],tri:x.n+(q3===undefined?"?":q3),sev:x.n+(q7===undefined?"?":q7),mt:mi(ks3),m7:mi(ks4),ns3:ks3.map(function(k){return s[k%7]}),ns7:ks4.map(function(k){return s[k%7]})}})}
window.K={NAT:NAT,RM:RM,RN:RN,SH:SH,FL:FLT,$:$,$$:$$,ctx:ctx,blip:blip,chord:chord,list:list,notes:notes,kb:kb,kbOf:kbOf,types:types,allTypes:allTypes,resolve:resolve,normSym:normSym,split:split,parse:parse,midiOf:midiOf,nameOf:nameOf,spell:spell,pcOf:pcOf,nice:nice,KEYS:KEYS,keyFlat:keyFlat,copy:copy,scaleMidi:scaleMidi,degs:degs,FN:FN,FNM:FNM,RO:RO,QT:QT,Q7:Q7};
})();
