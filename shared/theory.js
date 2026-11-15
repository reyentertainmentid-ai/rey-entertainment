/* REY shared: menghitung nada, tangga nada, dan chord dari rumus. Dipakai banyak aplikasi REY. */
(function(){
var L="CDEFGAB",NAT=[0,2,4,5,7,9,11];
function nm(l,pc){var d=((pc-NAT[l])%12+12)%12;if(d>6)d-=12;return L[l]+(d==1?"♯":d==-1?"♭":d==2?"♯♯":d==-2?"♭♭":"")}
function parse(n){var li=L.indexOf(n[0]),a=n[1]=="♯"?1:n[1]=="♭"?-1:0;return{li:li,pc:(NAT[li]+a+12)%12,name:n}}
/* tangga nada: rumus derajat 1-7, contoh "1 2 3b 4 5 6b 7b" */
function scaleOf(r,f){return f.split(" ").map(function(t){var m=t.match(/^(\d)([b#]?)$/),d=+m[1],a=m[2]=="b"?-1:m[2]=="#"?1:0,s=((NAT[d-1]+a)%12+12)%12,pc=(r.pc+s)%12;return{pc:pc,s:s,n:nm((r.li+d-1)%7,pc)}})}
/* chord: rumus derajat 1-13 dengan banyak tanda, contoh "1 3b 5bb 7bb" atau "1 3 5 7b 9# 11# 13b". s = jarak dalam setengah nada dari nada dasar (9 = 14, 11 = 17, 13 = 21) */
function chordOf(r,f){return f.split(" ").map(function(t){var m=t.match(/^(\d+)([b#]*)$/),d=+m[1],a=0,i;for(i=0;i<m[2].length;i++)a+=m[2][i]=="#"?1:-1;var s=NAT[(d-1)%7]+a+(d>7?12:0),pc=((r.pc+s)%12+12)%12;return{pc:pc,s:s,n:nm((r.li+d-1)%7,pc),d:d}})}
function fmt(f){return f.replace(/bb/g,"♭♭").replace(/b/g,"♭").replace(/#/g,"♯")}
function base(pc){return 57+((pc-9+12)%12)}
function hz(m){return 440*Math.pow(2,(m-69)/12)}
window.REY={nm:nm,parse:parse,scaleOf:scaleOf,chordOf:chordOf,fmt:fmt,base:base,hz:hz};
})();
