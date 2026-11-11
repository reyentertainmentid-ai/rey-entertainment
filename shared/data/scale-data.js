/* REY shared: data skala dan interval (rumus dari catatan DATA CHORD). Derajat ditulis 1-7, b = turun, # = naik. */
window.REY_DATA=window.REY_DATA||{};
REY_DATA.scales=[
["Ionian (mayor)","1 2 3 4 5 6 7"],["Dorian","1 2 3b 4 5 6 7b"],["Phrygian","1 2b 3b 4 5 6b 7b"],
["Lydian","1 2 3 4# 5 6 7"],["Mixolydian (dominan)","1 2 3 4 5 6 7b"],["Aeolian (minor natural)","1 2 3b 4 5 6b 7b"],
["Locrian","1 2b 3b 4 5b 6b 7b"],["Harmonic major","1 2 3 4 5 6b 7"],["Harmonic minor","1 2 3b 4 5 6b 7"],
["Melodic minor","1 2 3b 4 5 6 7"],["Gypsy minor (Hungarian)","1 2 3b 4# 5 6b 7"],["Blues","1 3b 4 5b 5 7b"],
["Pentatonik mayor","1 2 3 5 6"],["Pentatonik minor","1 3b 4 5 7b"],
["Diminished (whole-half)","1 2 3b 4 5b 6b 6 7"],["Half-whole diminished","1 2b 3b 3 4# 5 6 7b"]];
/* [setengah nada, nama, rumus untuk menulis nada, rumus tampilan] */
REY_DATA.intervals=[[0,"Prime","1","1"],[1,"2 minor","2b","2♭"],[2,"2 mayor","2","2"],[3,"3 minor","3b","3♭"],[4,"3 mayor","3","3"],[5,"4 murni","4","4"],[6,"Tritonus","5b","5♭ (atau 4♯)"],[7,"5 murni","5","5"],[8,"6 minor","6b","6♭"],[9,"6 mayor","6","6"],[10,"7 minor","7b","7♭"],[11,"7 mayor","7","7"],[12,"Oktaf","1","8"]];
