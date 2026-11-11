/* REY shared: menghitung nada, tangga nada, dan chord dari rumus. Dipakai banyak aplikasi REY.
   Rumus ditulis per derajat: angka 1-13, b = turun, bb = turun dua, # = naik (contoh: "1 3b 5b 7bb"). */
(function(){
var L="CDEFGAB",NAT=[0,2,4,5,7,9,11];
function nm(l,pc){var d=((pc-NAT[l])%12+12)%12;if(d>6)d-=12;return L[l]+(d==1?"♯":d==-1?"♭":d==2?"♯♯":d==-2?"♭♭":"")}
function parse(n){var li=L.indexOf(n[0]),a=n[1]=="♯"?1:n[1]=="♭"?-1:0;return{li:li,pc:(NAT[li]+a+12)%12,name:n}}
/* hasil per nada: n = nama nada, pc = kelas nada 0-11, s = setengah nada dari dasar (0-11), h = setengah nada dari dasar termasuk oktaf (9 = 14, 13 = 21), d = derajat */
function scaleOf(r,f){return f.split(" ").map(function(t){var m=t.match(/^(\d+)(bb|b|#)?$/),d=+m[1],a=m[2]=="bb"?-2:m[2]=="b"?-1:m[2]=="#"?1:0,k=(d-1)%7,h=NAT[k]+a+12*Math.floor((d-1)/7),pc=(r.pc+h%12+12)%12;return{pc:pc,s:(h%12+12)%12,h:h,d:d,n:nm((r.li+k)%7,pc)}})}
function base(pc){return 57+((pc-9+12)%12)}
function hz(m){return 440*Math.pow(2,(m-69)/12)}
window.REY={nm:nm,parse:parse,scaleOf:scaleOf,base:base,hz:hz};
})();
