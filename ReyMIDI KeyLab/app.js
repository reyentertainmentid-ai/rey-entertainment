
const piano = document.getElementById("piano");
const midiLog = document.getElementById("midiLog");
let midiLogPaused = false;
const clearMidiLog = document.getElementById("clearMidiLog");

const pauseMidiLogBtn = document.getElementById("pauseMidiLog");

pauseMidiLogBtn.addEventListener("click", () => {
    midiLogPaused = !midiLogPaused;

    pauseMidiLogBtn.textContent =
        `Pause: ${midiLogPaused ? "ON" : "OFF"}`;

    pauseMidiLogBtn.setAttribute(
        "aria-pressed",
        String(midiLogPaused)
    );

    pauseMidiLogBtn.blur();
});
const connectionStatus = document.getElementById("connectionStatus");

const activeNotes = new Set();
const testedKeys = new Set();

let sustainEnabled = false;
const sustainedNotes = new Set();

const noteNames = [
    "C", "C♯", "D", "D♯", "E", "F",
    "F♯", "G", "G♯", "A", "A♯", "B"
];


function createPiano() {
    piano.innerHTML = "";

    const keyboard = document.createElement("div");
    keyboard.className = "virtual-keyboard";

    const whiteNotes = [];
    const blackNotes = [];

    for (let note = 21; note <= 108; note++) {
        const pitch = note % 12;
        const octave = Math.floor(note / 12) - 1;

        const isBlack = [1, 3, 6, 8, 10].includes(pitch);

        const key = document.createElement("div");
        key.className = isBlack ? "piano-key black-key" : "piano-key white-key";
        key.dataset.note = note;
        key.dataset.black = isBlack ? "true" : "false";
        key.title = `${noteNames[pitch]}${octave} — MIDI ${note}`;

        if (!isBlack) {
            key.textContent = `${noteNames[pitch]}${octave}`;
            whiteNotes.push(key);
        } else {
            blackNotes.push({
                element: key,
                note: note
            });
        }

        keyboard.appendChild(key);
    }

    piano.innerHTML = "";
    piano.style.display = "block";
    piano.style.padding = "8px";
    piano.style.overflow = "hidden";

    keyboard.style.position = "relative";
    keyboard.style.display = "flex";
    keyboard.style.width = "100%";
    keyboard.style.height = "100%";
    keyboard.style.minHeight = "100px";
    keyboard.style.userSelect = "none";

    const whiteWidth = 100 / whiteNotes.length;

    whiteNotes.forEach((key, index) => {
        key.style.position = "absolute";
        key.style.left = `${index * whiteWidth}%`;
        key.style.width = `${whiteWidth}%`;
        key.style.top = "0";
        key.style.bottom = "0";
        key.style.zIndex = "1";
    });

    const blackWidth = whiteWidth * 0.62;

    blackNotes.forEach(({ element, note }) => {
        const previousWhiteCount = whiteNotes.filter(
            key => Number(key.dataset.note) < note
        ).length;

        element.style.position = "absolute";
        element.style.left =
            `${previousWhiteCount * whiteWidth - blackWidth / 2}%`;
        element.style.width = `${blackWidth}%`;
        element.style.height = "62%";
        element.style.top = "0";
        element.style.zIndex = "2";
    });

    piano.appendChild(keyboard);
}


function logMidi(message) {
    if (midiLogPaused) return;

    const line = document.createElement("div");
    line.textContent =
        `${new Date().toLocaleTimeString()}  ${message}`;

    midiLog.appendChild(line);

    while (midiLog.children.length > 300) {
        midiLog.removeChild(midiLog.firstChild);
    }

    midiLog.scrollTop = midiLog.scrollHeight;
}

function showMidiNote(note, velocity, isOn) {
    const key = piano.querySelector(`[data-note="${note}"]`);

    if (isOn) {
        activeNotes.add(note);
        sustainedNotes.delete(note);
        startPianoNote(note, velocity);
    } else {
        activeNotes.delete(note);

        if (sustainEnabled && pianoSynth.voices.has(note)) {
            sustainedNotes.add(note);
        } else {
            sustainedNotes.delete(note);
            stopPianoNote(note);
        }
    }

    updateNowPlaying();

    if (key) {
        const name = noteNames[note % 12];
        const octave = Math.floor(note / 12) - 1;

        key.classList.toggle("active", isOn);

        if (isOn) {
            key.title = `${name}${octave} — Velocity ${velocity}`;
        } else {
            key.title = `${name}${octave} — MIDI ${note}`;
        }
    }
}

clearMidiLog.addEventListener("click", () => {
    midiLog.innerHTML = "";
    logMidi("MIDI LOG dibersihkan.");
});




/* ============================================================
   Suara piano (synth Web Audio)
   ============================================================ */

const pianoSoundBtn = document.getElementById("pianoSoundToggle");

const pianoSynth = {
    ctx: null,
    master: null,
    voices: new Map(),
    pending: new Map(),
    enabled: true
};


/* ============================================================
   Salamander Grand Piano - Sample Loader
   ============================================================ */


/* ============================================================
   Salamander Grand Piano - SFZ Sample Mapping
   Satu velocity layer: V8 (57-64)
   ============================================================ */

const pianoSamples = {
    regions: [],
buffers: new Map(),
loadingBuffers: new Map(),
loading: false,
loaded: false,

    velocityLayer: 8,
    velocityMin: 57,
    velocityMax: 64,

    async loadSFZ() {
        if (this.loaded) return;
        if (this.loading) {
            while (this.loading) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            return;
        }

        this.loading = true;

        try {
            const response = await fetch(
                "piano-samples/SalamanderGrandPianoV3Retuned.sfz"
            );

            if (!response.ok) {
                throw new Error("SFZ HTTP " + response.status);
            }

            const sfzText = await response.text();
            const regionPattern = /<region>\s*([^\r\n]+)/g;

            let match;
            const regions = [];

        
while ((match = regionPattern.exec(sfzText)) !== null) {
    const line = match[1];
    const values = {};

    const propertyPattern =
        /(\w+)=("[^"]*"|'[^']*'|\S+)/g;

    let property;

    while ((property = propertyPattern.exec(line)) !== null) {
        values[property[1]] =
            property[2].replace(/^["']|["']$/g, "");
    }

    if (
        !values.sample ||
        values.lokey === undefined ||
        values.hikey === undefined
    ) {
        continue;
    }

    if (
        Number(values.lovel) !== this.velocityMin ||
        Number(values.hivel) !== this.velocityMax
    ) {
        continue;
    }

    const lokey = Number(values.lokey);
    const hikey = Number(values.hikey);

    const pitchKeycenter =
        values.pitch_keycenter !== undefined
            ? Number(values.pitch_keycenter)
            : Math.round((lokey + hikey) / 2);

    regions.push({
        sample: values.sample.replace(/\\/g, "/"),
        lokey,
        hikey,
        pitchKeycenter,
        tune: Number(values.tune || 0)
    });
}


            if (!regions.length) {
                throw new Error("Pemetaan velocity V8 tidak ditemukan.");
            }

            this.regions = regions;
            this.loaded = true;

            console.log(
                "Pemetaan Salamander berhasil dibaca:",
                regions.length,
                "region V8"
            );

        } catch (error) {
            console.error("SFZ Loader Error:", error);
            throw error;

        } finally {
            this.loading = false;
        }
    },

    findRegion(note) {
        return this.regions.find(region =>
            note >= region.lokey && note <= region.hikey
        );
    },

    async getBuffer(region) {
    const sample = region.sample;

    // Periksa sampel yang sudah selesai dimuat.
    if (this.buffers.has(sample)) {
        return this.buffers.get(sample);
    }

    // Jika sedang dimuat, gunakan proses yang sama.
    if (this.loadingBuffers.has(sample)) {
        return this.loadingBuffers.get(sample);
    }

    const url =
        "piano-samples/" +
        sample.split("/").map(encodeURIComponent).join("/");

    // Buat satu proses pemuatan untuk setiap sampel.
    const loadingPromise = Promise.resolve().then(async () => {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Gagal memuat sampel " + sample);
        }

        const audioData = await response.arrayBuffer();

        const buffer =
            await pianoSynth.ctx.decodeAudioData(audioData);

        this.buffers.set(sample, buffer);

        console.log("Sampel dimuat:", sample);

        return buffer;
    });

    this.loadingBuffers.set(sample, loadingPromise);

    try {
        return await loadingPromise;
    } finally {
        // Hapus antrean setelah berhasil maupun gagal.
        if (this.loadingBuffers.get(sample) === loadingPromise) {
            this.loadingBuffers.delete(sample);
        }
    }
}
};

async function preparePianoSamples() {
    try {
        console.log("Menyiapkan sampel piano...");

        await pianoSamples.loadSFZ();

        // Siapkan AudioContext tanpa mengaktifkan pemutaran.
        if (!pianoSynth.ctx) {
            const AudioCtor =
                window.AudioContext || window.webkitAudioContext;

            if (!AudioCtor) {
                throw new Error("Web Audio API tidak tersedia.");
            }

            const ctx = new AudioCtor();
            const master = ctx.createGain();
            const limiter = ctx.createDynamicsCompressor();

            master.gain.value = 0.6;
            master.connect(limiter);
            limiter.connect(ctx.destination);

            ctx.addEventListener("statechange", updateSoundButton);

            pianoSynth.ctx = ctx;
            pianoSynth.master = master;
        }

        // Kumpulkan semua sampel unik dari region V8.
        const uniqueSamples = [
            ...new Map(
                pianoSamples.regions.map(region => [
                    region.sample,
                    region
                ])
            ).values()
        ];

      // Muat dan decode sampel satu per satu.
let berhasil = 0;
let gagal = 0;

for (const region of uniqueSamples) {
    try {
        await pianoSamples.getBuffer(region);
        berhasil++;
    } catch (error) {
        gagal++;
        console.error(
            "Gagal memuat:",
            region.sample,
            error
        );
    }
}

console.log(
    `Persiapan piano selesai: ${berhasil} berhasil, ${gagal} gagal.`
);

        console.log(
            "Persiapan piano selesai:",
            pianoSamples.buffers.size,
            "sampel siap."
        );

        updateSoundButton();

    } catch (error) {
        console.error("Persiapan sampel piano gagal:", error);
    }
}
preparePianoSamples();

function isPianoAudioRunning() {
    return !!(pianoSynth.ctx && pianoSynth.ctx.state === "running");
}

function updateSoundButton() {
    let label = "Suara: hidup";
    if (!pianoSynth.enabled) label = "Suara: mati";
    else if (!isPianoAudioRunning()) label = "Klik untuk aktifkan suara";

    pianoSoundBtn.textContent = label;
    pianoSoundBtn.setAttribute("aria-pressed", String(pianoSynth.enabled && isPianoAudioRunning()));
}

// Browser menahan suara sampai ada klik atau tombol keyboard dari pengguna.
// Pesan MIDI sendiri tidak dihitung, jadi suara dibuka saat gestur pertama.
function unlockPianoAudio() {
    try {
        if (!pianoSynth.ctx) {
            const AudioCtor = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtor) return;

            const ctx = new AudioCtor();
            const master = ctx.createGain();
            const limiter = ctx.createDynamicsCompressor();

            master.gain.value = 0.6;
            master.connect(limiter);
            limiter.connect(ctx.destination);

            ctx.addEventListener("statechange", updateSoundButton);
            pianoSynth.ctx = ctx;
            pianoSynth.master = master;
        }

        if (pianoSynth.ctx.state === "suspended") pianoSynth.ctx.resume();
    } catch (error) {
        console.error("ReyMIDI KeyLab - Suara piano gagal dibuka:", error);
    }

    updateSoundButton();
}

function startPianoNote(note, velocity) {
    if (!pianoSynth.enabled || !isPianoAudioRunning()) return;

    stopPianoNote(note, true);

    const request = {};
    pianoSynth.pending.set(note, request);

    const vel = Math.min(127, Math.max(1, velocity || 80)) / 127;

    async function playSample() {
        try {
            await pianoSamples.loadSFZ();

            const region = pianoSamples.findRegion(note);

            if (!region) {
                throw new Error("Sampel MIDI Note " + note + " tidak ditemukan.");
            }

            const buffer = await pianoSamples.getBuffer(region);

            if (
                pianoSynth.pending.get(note) !== request ||
                !activeNotes.has(note) ||
                !pianoSynth.enabled
            ) {
                return;
            }

            const ctx = pianoSynth.ctx;
            const t = ctx.currentTime;

            const source = ctx.createBufferSource();
            source.buffer = buffer;

            source.playbackRate.value = Math.pow(
                2,
                (note - region.pitchKeycenter + region.tune / 100) / 12
            );

            const envelope = ctx.createGain();

            const peak = 0.12 + Math.pow(vel, 1.4) * 0.38;

            envelope.gain.setValueAtTime(0.0001, t);
            envelope.gain.linearRampToValueAtTime(peak, t + 0.004);

            source.connect(envelope);
            envelope.connect(pianoSynth.master);

            const voice = { source, envelope };

            pianoSynth.voices.set(note, voice);
            pianoSynth.pending.delete(note);

            source.onended = () => {
                if (pianoSynth.voices.get(note) === voice) {
                    pianoSynth.voices.delete(note);
                }
            };

            source.start(t);

        } catch (error) {
            if (pianoSynth.pending.get(note) === request) {
                pianoSynth.pending.delete(note);
            }

            console.error("Piano Sample Error:", error);
        }
    }

    playSample();
}

function stopPianoNote(note, immediate = false) {
    pianoSynth.pending.delete(note);

    const voice = pianoSynth.voices.get(note);

    if (!voice || !pianoSynth.ctx) return;

    pianoSynth.voices.delete(note);

    const now = pianoSynth.ctx.currentTime;
    const gain = voice.envelope.gain;

    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);

    if (immediate) {
        gain.linearRampToValueAtTime(0.0001, now + 0.01);

        try {
            voice.source.stop(now + 0.03);
        } catch (error) {
            // Sampel sudah berhenti.
        }
    } else {
        const releaseTime = 0.35;

        gain.linearRampToValueAtTime(
            0.0001,
            now + releaseTime
        );

        try {
            voice.source.stop(now + releaseTime + 0.02);
        } catch (error) {
            // Sampel sudah berhenti.
        }
    }
}

function stopAllPianoNotes() {
    // Batalkan semua sampel yang masih dalam proses loading.
    pianoSynth.pending.clear();

    // Hentikan semua voice yang sedang dimainkan.
    Array.from(pianoSynth.voices.keys()).forEach((note) => {
        stopPianoNote(note);
    });
}

// Lepaskan semua nada yang masih tercatat tertekan (mis. kabel jumper lepas
// sebelum sempat mengirim Note OFF).
function releaseAllNotes() {
    Array.from(activeNotes).forEach((note) => showMidiNote(note, 0, false));
}

["pointerdown", "keydown"].forEach((type) => {
    window.addEventListener(type, (event) => {
        // Tombol Suara mengatur dirinya sendiri lewat klik
        if (event.target && event.target.closest && event.target.closest("#pianoSoundToggle")) return;
        if (!isPianoAudioRunning()) unlockPianoAudio();
    });
});

pianoSoundBtn.addEventListener("click", () => {
    if (!isPianoAudioRunning()) {
        pianoSynth.enabled = true;
        unlockPianoAudio();
    } else {
        pianoSynth.enabled = !pianoSynth.enabled;
        if (!pianoSynth.enabled) stopAllPianoNotes();
    }

    updateSoundButton();
    pianoSoundBtn.blur();
});

updateSoundButton();

// ===== SUSTAIN =====

const pianoSustainBtn = document.getElementById("pianoSustainToggle");

pianoSustainBtn.addEventListener("click", () => {
    sustainEnabled = !sustainEnabled;

    if (!sustainEnabled) {
        sustainedNotes.forEach((note) => {
            stopPianoNote(note);
        });

        sustainedNotes.clear();
    }

    pianoSustainBtn.textContent =
        `Sustain: ${sustainEnabled ? "ON" : "OFF"}`;

    pianoSustainBtn.setAttribute(
        "aria-pressed",
        String(sustainEnabled)
    );

    pianoSustainBtn.blur();
});

/* ============================================================
   Nada yang ditekan + deteksi chord
   ============================================================ */

const nowPlayingNotes = document.getElementById("npNotes");
const nowPlayingChord = document.getElementById("npChordName");
const nowPlayingInfo = document.getElementById("npChordInfo");

// iv    = jarak tiap nada dari nada akar, dalam semiton (1 semiton = 1 tuts ke atas)
// alias = penulisan lain yang sering dipakai (ditampilkan di keterangan)
// high  = nama lain bila nada tambahannya ditekan lebih dari satu oktaf di atas akar
//         (contoh: C D E G = Cadd2, tetapi C E G D' dengan D di oktaf atas = Cadd9)
const CHORD_TYPES = [
    // Triad
    { iv: [0, 4, 7], suffix: "", label: "Mayor", feel: "terdengar cerah dan stabil", alias: ["M"] },
    { iv: [0, 3, 7], suffix: "m", label: "Minor", feel: "terdengar sendu atau serius" },
    { iv: [0, 2, 7], suffix: "sus2", label: "Suspended 2", feel: "terdengar terbuka, belum jelas mayor atau minor" },
    { iv: [0, 5, 7], suffix: "sus4", label: "Suspended 4", feel: "terdengar menggantung dan ingin kembali ke mayor" },
    { iv: [0, 4, 8], suffix: "aug", label: "Augmented", feel: "terdengar mengambang dan misterius", alias: ["+"] },
    { iv: [0, 3, 6], suffix: "dim", label: "Diminished", feel: "terdengar tegang dan ingin bergerak" },

    // Tambahan nada (add)
    {
        iv: [0, 2, 4, 7], suffix: "add2", label: "Mayor add2",
        feel: "mayor dengan nada ke-2 yang berdekatan, terdengar modern dan sedikit bergesekan",
        high: { step: 2, suffix: "add9", label: "Mayor add9", feel: "mayor yang terdengar lebar dan berkilau" }
    },
    {
        iv: [0, 2, 3, 7], suffix: "m(add2)", label: "Minor add2",
        feel: "minor dengan nada ke-2 yang berdekatan, terdengar dalam dan sedikit bergesekan",
        high: { step: 2, suffix: "m(add9)", label: "Minor add9", feel: "minor yang terdengar dalam dan lebar" }
    },
    {
        iv: [0, 4, 5, 7], suffix: "add4", label: "Mayor add4",
        feel: "mayor dengan nada ke-4 yang berdekatan, terdengar hangat tapi menggantung",
        high: { step: 5, suffix: "add11", label: "Mayor add11", feel: "mayor dengan nada ke-11 di oktaf atas, terdengar luas dan melayang" }
    },

    // Sixth
    {
        iv: [0, 4, 7, 9], suffix: "6", label: "Mayor 6", feel: "mayor yang terdengar manis dan santai",
        high: { step: 9, suffix: "add13", label: "Mayor add13", feel: "mayor dengan nada ke-13 di oktaf atas, terdengar cerah dan jazzy" }
    },
    { iv: [0, 3, 7, 9], suffix: "m6", label: "Minor 6", feel: "minor dengan nuansa jazz" },
    { iv: [0, 2, 4, 7, 9], suffix: "69", label: "Mayor 6/9", feel: "terdengar santai dan lembut, sering dipakai di akhir lagu jazz" },

    // Septim
    { iv: [0, 4, 7, 11], suffix: "maj7", label: "Mayor 7", feel: "terdengar lembut dan mewah", alias: ["M7"] },
    { iv: [0, 3, 7, 10], suffix: "m7", label: "Minor 7", feel: "sendu tapi halus" },
    { iv: [0, 4, 7, 10], suffix: "7", label: "Dominan 7", feel: "terdengar bluesy dan ingin lanjut ke chord berikutnya" },
    { iv: [0, 3, 7, 11], suffix: "m(maj7)", label: "Minor Mayor 7", feel: "terdengar misterius, seperti musik film detektif", alias: ["mM7", "m(M7)"] },
    { iv: [0, 3, 6, 10], suffix: "m7♭5", label: "Half-diminished", feel: "terdengar gelap, sering dipakai di jazz", alias: ["m7-5"] },
    { iv: [0, 3, 6, 9], suffix: "dim7", label: "Diminished 7", feel: "terdengar sangat tegang dan dramatis" },
    { iv: [0, 4, 8, 10], suffix: "aug7", label: "Augmented 7", feel: "terdengar tegang dan mengambang, ingin bergerak ke chord lain", alias: ["7♯5", "+7"] },
    { iv: [0, 4, 8, 11], suffix: "maj7♯5", label: "Mayor 7♯5", feel: "terdengar mengambang dan mewah", alias: ["M7#5", "Maj7#5"] },
    { iv: [0, 5, 7, 10], suffix: "7sus4", label: "Dominan 7 sus4", feel: "menggantung dengan nuansa blues" },

    // Alterasi
    { iv: [0, 4, 6, 10], suffix: "7♭5", label: "Dominan 7♭5", feel: "terdengar tegang dan bengkok, khas jazz", alias: ["7b5"] },
    { iv: [0, 1, 4, 7, 10], suffix: "7♭9", label: "Dominan 7♭9", feel: "terdengar sangat tegang dan eksotis, ingin segera selesai", alias: ["7b9"] },
    { iv: [0, 1, 3, 7, 10], suffix: "m7♭9", label: "Minor 7♭9", feel: "terdengar gelap dan misterius", alias: ["m7b9"] },

    // Nona (9)
    { iv: [0, 2, 4, 7, 11], suffix: "maj9", label: "Mayor 9", feel: "terdengar mewah dan melayang", alias: ["M9"] },
    { iv: [0, 2, 3, 7, 10], suffix: "m9", label: "Minor 9", feel: "terdengar halus dan santai" },
    { iv: [0, 2, 4, 7, 10], suffix: "9", label: "Dominan 9", feel: "funky dan penuh warna" },

    // Sebelas (11)
    { iv: [0, 2, 4, 5, 7, 11], suffix: "maj11", label: "Mayor 11", feel: "terdengar sangat luas dan melayang", alias: ["M11"] },
    { iv: [0, 2, 3, 5, 7, 10], suffix: "m11", label: "Minor 11", feel: "terdengar dalam dan lembut" },
    { iv: [0, 2, 4, 5, 7, 10], suffix: "11", label: "Dominan 11", feel: "terdengar menggantung dan modern" },
    { iv: [0, 2, 5, 10], suffix: "11", label: "Dominan 11 (versi ringkas)", feel: "terdengar terbuka dan menggantung; sama dengan chord mayor satu nada di bawah akar dengan bass akar, misalnya B♭/C untuk C11" },

    // Tiga belas (13)
    { iv: [0, 2, 4, 5, 7, 9, 11], suffix: "maj13", label: "Mayor 13", feel: "terdengar penuh dan mewah", alias: ["M13"] },
    { iv: [0, 2, 3, 5, 7, 9, 10], suffix: "m13", label: "Minor 13", feel: "terdengar kaya dan santai, nuansa jazz" },
    { iv: [0, 2, 4, 5, 7, 9, 10], suffix: "13", label: "Dominan 13", feel: "terdengar penuh warna, khas jazz dan funk" }
];

const INTERVAL_NAMES = [
    "Prima (nada sama)", "Sekon kecil", "Sekon besar", "Terts kecil", "Terts besar",
    "Kuart murni", "Tritone", "Kuint murni", "Sext kecil", "Sext besar",
    "Septim kecil", "Septim besar"
];

// pcs = daftar nada unik (0-11, 0 = C), bass = nada paling rendah yang ditekan.
// Akar chord dicoba dari nada terendah dulu; kalau cocok dengan akar lain,
// berarti chord sedang dibalik (inversi) dan ditulis dengan garis miring.
function detectChord(pcs, bass) {
    const roots = [bass].concat(pcs.filter((pc) => pc !== bass));

    for (const root of roots) {
        const set = new Set(pcs.map((pc) => (pc - root + 12) % 12));

        for (const type of CHORD_TYPES) {
            if (type.iv.length === set.size && type.iv.every((step) => set.has(step))) {
                return { root, type };
            }
        }
    }

    return null;
}

function describeNotes(notes) {
    const bass = notes[0] % 12;
    const pcs = Array.from(new Set(notes.map((note) => note % 12)));

    if (pcs.length === 1) {
        return {
            name: noteNames[bass],
            info: notes.length === 1
                ? "1 nada. Chord butuh minimal 3 nada berbeda."
                : "Nada yang sama di beberapa oktaf."
        };
    }

    if (pcs.length === 2) {
        const other = pcs.find((pc) => pc !== bass);
        const semitones = (other - bass + 12) % 12;

        // Akar + kuint = power chord (rumus 1 5 1)
        if (semitones === 7) {
            return {
                name: `${noteNames[bass]}5`,
                info: `${noteNames[bass]} power chord: hanya akar dan kuint, tanpa terts, jadi belum terdengar mayor atau minor.`
            };
        }

        let info = `Interval: ${INTERVAL_NAMES[semitones]}. Chord butuh minimal 3 nada berbeda.`;
        if (semitones === 5) {
            info = `Interval: ${INTERVAL_NAMES[semitones]}. Ini power chord ${noteNames[other]}5 yang dibalik.`;
        }

        return { name: `${noteNames[bass]} + ${noteNames[other]}`, info };
    }

    const match = detectChord(pcs, bass);

    if (!match) {
        return {
            name: "?",
            info: "Kombinasi ini belum dikenali sebagai chord umum."
        };
    }

    // Nada tambahan yang jauh (lebih dari satu oktaf di atas akar) memakai nama lain
    let type = match.type;
    if (type.high) {
        const rootNote = notes.find((note) => note % 12 === match.root);
        const extraNote = notes.find((note) => note % 12 === (match.root + type.high.step) % 12);

        if (extraNote - rootNote >= 12) {
            type = Object.assign({}, type, type.high, { alias: [] });
        }
    }

    const rootName = noteNames[match.root];
    const bassName = noteNames[bass];
    const inverted = match.root !== bass;

    let info = `${rootName} ${type.label}, ${type.feel}.`;
    if (type.alias && type.alias.length) {
        info += ` Bisa juga ditulis ${type.alias.map((a) => rootName + a).join(" atau ")}.`;
    }
    if (inverted) {
        info += ` Nada terendah ${bassName}, bukan akar ${rootName}, jadi ditulis ${rootName}${type.suffix}/${bassName} (chord dibalik).`;
    }

    return {
        name: `${rootName}${type.suffix}${inverted ? "/" + bassName : ""}`,
        info
    };
}

function updateNowPlaying() {
    const notes = Array.from(activeNotes).sort((a, b) => a - b);

    nowPlayingNotes.textContent = "";

    if (notes.length === 0) {
        const empty = document.createElement("span");
        empty.className = "np-empty";
        empty.textContent = "Tekan tuts untuk melihat nadanya";
        nowPlayingNotes.appendChild(empty);

        nowPlayingChord.textContent = "—";
        nowPlayingInfo.textContent = "";
        return;
    }

    notes.forEach((note) => {
        const chip = document.createElement("span");
        chip.className = "np-note";
        chip.textContent = noteNames[note % 12];

        const octave = document.createElement("sub");
        octave.textContent = Math.floor(note / 12) - 1;
        chip.appendChild(octave);

        nowPlayingNotes.appendChild(chip);
    });

    const result = describeNotes(notes);
    nowPlayingChord.textContent = result.name;
    nowPlayingInfo.textContent = result.info;
}


/* ============================================================
   HID Keyboard Test
   ============================================================ */

// [label, code, x, y, lebar, tinggi] dalam satuan "u"
const KEYBOARD_LAYOUT = [
        // Baris fungsi
        ["Esc", "Escape", 0, 0, 1],
        ["F1", "F1", 2, 0, 1],
        ["F2", "F2", 3, 0, 1],
        ["F3", "F3", 4, 0, 1],
        ["F4", "F4", 5, 0, 1],
        ["F5", "F5", 6.5, 0, 1],
        ["F6", "F6", 7.5, 0, 1],
        ["F7", "F7", 8.5, 0, 1],
        ["F8", "F8", 9.5, 0, 1],
        ["F9", "F9", 11, 0, 1],
        ["F10", "F10", 12, 0, 1],
        ["F11", "F11", 13, 0, 1],
        ["F12", "F12", 14, 0, 1],
        ["PrtSc", "PrintScreen", 15.5, 0, 1],
        ["ScrLk", "ScrollLock", 16.5, 0, 1],
        ["Pause", "Pause", 17.5, 0, 1],
    
        // Baris angka
        ["~", "Backquote", 0, 1.5, 1],
        ["1", "Digit1", 1, 1.5, 1],
        ["2", "Digit2", 2, 1.5, 1],
        ["3", "Digit3", 3, 1.5, 1],
        ["4", "Digit4", 4, 1.5, 1],
        ["5", "Digit5", 5, 1.5, 1],
        ["6", "Digit6", 6, 1.5, 1],
        ["7", "Digit7", 7, 1.5, 1],
        ["8", "Digit8", 8, 1.5, 1],
        ["9", "Digit9", 9, 1.5, 1],
        ["0", "Digit0", 10, 1.5, 1],
        ["-", "Minus", 11, 1.5, 1],
        ["=", "Equal", 12, 1.5, 1],
        ["Backspace", "Backspace", 13, 1.5, 2],
    
        // Baris QWERTY
        ["Tab", "Tab", 0, 2.5, 1.5],
        ["Q", "KeyQ", 1.5, 2.5, 1],
        ["W", "KeyW", 2.5, 2.5, 1],
        ["E", "KeyE", 3.5, 2.5, 1],
        ["R", "KeyR", 4.5, 2.5, 1],
        ["T", "KeyT", 5.5, 2.5, 1],
        ["Y", "KeyY", 6.5, 2.5, 1],
        ["U", "KeyU", 7.5, 2.5, 1],
        ["I", "KeyI", 8.5, 2.5, 1],
        ["O", "KeyO", 9.5, 2.5, 1],
        ["P", "KeyP", 10.5, 2.5, 1],
        ["[", "BracketLeft", 11.5, 2.5, 1],
        ["]", "BracketRight", 12.5, 2.5, 1],
        ["\\", "Backslash", 13.5, 2.5, 1.5],
    
        // Baris ASDF
        ["Caps", "CapsLock", 0, 3.5, 1.75],
        ["A", "KeyA", 1.75, 3.5, 1],
        ["S", "KeyS", 2.75, 3.5, 1],
        ["D", "KeyD", 3.75, 3.5, 1],
        ["F", "KeyF", 4.75, 3.5, 1],
        ["G", "KeyG", 5.75, 3.5, 1],
        ["H", "KeyH", 6.75, 3.5, 1],
        ["J", "KeyJ", 7.75, 3.5, 1],
        ["K", "KeyK", 8.75, 3.5, 1],
        ["L", "KeyL", 9.75, 3.5, 1],
        [";", "Semicolon", 10.75, 3.5, 1],
        ["'", "Quote", 11.75, 3.5, 1],
        ["Enter", "Enter", 12.75, 3.5, 2.25],
    
        // Baris ZXCV
        ["Shift", "ShiftLeft", 0, 4.5, 2.25],
        ["Z", "KeyZ", 2.25, 4.5, 1],
        ["X", "KeyX", 3.25, 4.5, 1],
        ["C", "KeyC", 4.25, 4.5, 1],
        ["V", "KeyV", 5.25, 4.5, 1],
        ["B", "KeyB", 6.25, 4.5, 1],
        ["N", "KeyN", 7.25, 4.5, 1],
        ["M", "KeyM", 8.25, 4.5, 1],
        [",", "Comma", 9.25, 4.5, 1],
        [".", "Period", 10.25, 4.5, 1],
        ["/", "Slash", 11.25, 4.5, 1],
        ["Shift", "ShiftRight", 12.25, 4.5, 2.75],
    
        // Baris bawah
        ["Ctrl", "ControlLeft", 0, 5.5, 1.25],
        ["Win", "MetaLeft", 1.25, 5.5, 1.25],
        ["Alt", "AltLeft", 2.5, 5.5, 1.25],
        ["Space", "Space", 3.75, 5.5, 6.25],
        ["Alt", "AltRight", 10, 5.5, 1.25],
        ["Win", "MetaRight", 11.25, 5.5, 1.25],
        ["Menu", "ContextMenu", 12.5, 5.5, 1.25],
        ["Ctrl", "ControlRight", 13.75, 5.5, 1.25],
    
        // Tombol navigasi
        ["Ins", "Insert", 15.5, 1.5, 1],
        ["Home", "Home", 16.5, 1.5, 1],
        ["PgUp", "PageUp", 17.5, 1.5, 1],
        ["Del", "Delete", 15.5, 2.5, 1],
        ["End", "End", 16.5, 2.5, 1],
        ["PgDn", "PageDown", 17.5, 2.5, 1],
    
        // Tombol panah
        ["↑", "ArrowUp", 16.5, 4.5, 1],
        ["←", "ArrowLeft", 15.5, 5.5, 1],
        ["↓", "ArrowDown", 16.5, 5.5, 1],
        ["→", "ArrowRight", 17.5, 5.5, 1],
    
        // Numpad
        ["Num", "NumLock", 19.5, 1.5, 1],
        ["/", "NumpadDivide", 20.5, 1.5, 1],
        ["*", "NumpadMultiply", 21.5, 1.5, 1],
        ["-", "NumpadSubtract", 22.5, 1.5, 1],
        ["7", "Numpad7", 19.5, 2.5, 1],
        ["8", "Numpad8", 20.5, 2.5, 1],
        ["9", "Numpad9", 21.5, 2.5, 1],
        ["+", "NumpadAdd", 22.5, 2.5, 1, 2],
        ["4", "Numpad4", 19.5, 3.5, 1],
        ["5", "Numpad5", 20.5, 3.5, 1],
        ["6", "Numpad6", 21.5, 3.5, 1],
        ["1", "Numpad1", 19.5, 4.5, 1],
        ["2", "Numpad2", 20.5, 4.5, 1],
        ["3", "Numpad3", 21.5, 4.5, 1],
        ["Enter", "NumpadEnter", 22.5, 4.5, 1, 2],
        ["0", "Numpad0", 19.5, 5.5, 2],
        [".", "NumpadDecimal", 21.5, 5.5, 1]
];

const KEYBOARD_UNITS_W = 23.5;
const KEYBOARD_UNITS_H = 6.5;
const RECENT_LIMIT = 5;

// Nomor HID (Usage ID, Usage Page 0x07 "Keyboard/Keypad") untuk tiap event.code
const HID_USAGE = (() => {
    const map = {
        Enter: 0x28, Escape: 0x29, Backspace: 0x2A, Tab: 0x2B, Space: 0x2C,
        Minus: 0x2D, Equal: 0x2E, BracketLeft: 0x2F, BracketRight: 0x30,
        Backslash: 0x31, Semicolon: 0x33, Quote: 0x34, Backquote: 0x35,
        Comma: 0x36, Period: 0x37, Slash: 0x38, CapsLock: 0x39,
        PrintScreen: 0x46, ScrollLock: 0x47, Pause: 0x48,
        Insert: 0x49, Home: 0x4A, PageUp: 0x4B, Delete: 0x4C, End: 0x4D, PageDown: 0x4E,
        ArrowRight: 0x4F, ArrowLeft: 0x50, ArrowDown: 0x51, ArrowUp: 0x52,
        NumLock: 0x53, NumpadDivide: 0x54, NumpadMultiply: 0x55,
        NumpadSubtract: 0x56, NumpadAdd: 0x57, NumpadEnter: 0x58,
        NumpadDecimal: 0x63, IntlBackslash: 0x64, ContextMenu: 0x65,
        ControlLeft: 0xE0, ShiftLeft: 0xE1, AltLeft: 0xE2, MetaLeft: 0xE3,
        ControlRight: 0xE4, ShiftRight: 0xE5, AltRight: 0xE6, MetaRight: 0xE7
    };

    "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach((letter, n) => {
        map["Key" + letter] = 0x04 + n;
    });

    for (let n = 1; n <= 9; n++) {
        map["Digit" + n] = 0x1E + n - 1;
        map["Numpad" + n] = 0x59 + n - 1;
    }
    map.Digit0 = 0x27;
    map.Numpad0 = 0x62;

    for (let n = 1; n <= 12; n++) {
        map["F" + n] = 0x3A + n - 1;
    }

    return map;
})();

function formatHid(code) {
    const value = HID_USAGE[code];
    if (value === undefined) return "—";
    return "0x" + value.toString(16).toUpperCase().padStart(2, "0");
}

const MAC_LABELS = {
    MetaLeft: "⌘ Cmd",
    MetaRight: "⌘ Cmd",
    AltLeft: "⌥ Opt",
    AltRight: "⌥ Opt"
};

function initHidTest() {
    const keyboard = document.getElementById("computerKeyboard");
    const stage = document.getElementById("hidKeys");
    const progressFill = document.getElementById("hidProgressFill");
    const progressText = document.getElementById("hidProgressText");
    const recentList = document.getElementById("hidRecent");
    const codeModeBtn = document.getElementById("hidCodeMode");
    const keysModeBtn = document.getElementById("hidKeysMode");
    const osWinBtn = document.getElementById("hidOsWin");
    const osMacBtn = document.getElementById("hidOsMac");
    const soundBtn = document.getElementById("hidSoundToggle");
    const resetBtn = document.getElementById("resetHidTest");
    const lockBtn = document.getElementById("hidLockToggle");
    const leds = {
        NumLock: document.getElementById("numLockIndicator"),
        CapsLock: document.getElementById("capsLockIndicator"),
        ScrollLock: document.getElementById("scrollLockIndicator")
    };

    const layoutCodes = new Set(KEYBOARD_LAYOUT.map((k) => k[1]));
    const keyElements = new Map();
    const heldKeys = new Set();
    let recent = [];
    let mode = "hid";
    let os = /mac/i.test(
        (navigator.userAgentData && navigator.userAgentData.platform) ||
        navigator.platform || ""
    ) ? "mac" : "win";
    let soundOn = false;
    let audioCtx = null;

    /* ---------- bangun keyboard ---------- */
    keyboard.innerHTML = "";

    const divider = document.createElement("div");
    divider.className = "keyboard-divider";
    keyboard.appendChild(divider);

    KEYBOARD_LAYOUT.forEach(([label, code, x, y, w, h = 1]) => {
        const key = document.createElement("div");
        key.className = "keyboard-key";

        const isPlain = /^[A-Za-z0-9\[\]\\;',.\/`=\-~]$/.test(label);
        if (!isPlain) key.classList.add("mod");

        key.dataset.code = code;
        key.dataset.label = label;
        key.style.setProperty("--x", x);
        key.style.setProperty("--y", y);
        key.style.setProperty("--w", w);
        key.style.setProperty("--h", h);
        key.textContent = label;

        keyboard.appendChild(key);
        keyElements.set(code, key);
    });

    /* ---------- ukuran otomatis ---------- */
    function fitKeyboard() {
        const cs = getComputedStyle(stage);
        const w = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const h = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);

        // Lebar dan tinggi satuan dihitung terpisah agar keyboard mengisi kotak,
        // dengan batas rasio supaya tombol tidak terlalu melebar.
        let ux = Math.max(12, w / KEYBOARD_UNITS_W);
        let uy = Math.max(12, h / KEYBOARD_UNITS_H);
        ux = Math.min(ux, uy * 1.6);
        uy = Math.min(uy, ux * 1.6);

        keyboard.style.setProperty("--ux", ux.toFixed(2) + "px");
        keyboard.style.setProperty("--uy", uy.toFixed(2) + "px");
    }

    if (window.ResizeObserver) {
        new ResizeObserver(fitKeyboard).observe(stage);
    }
    window.addEventListener("resize", fitKeyboard);
    fitKeyboard();

    /* ---------- tampilan ---------- */
    function updateProgress() {
        let count = 0;
        testedKeys.forEach((code) => {
            if (layoutCodes.has(code)) count++;
        });
        const pct = Math.round((count / layoutCodes.size) * 100);
        progressFill.style.width = pct + "%";
        progressText.textContent = pct + "%";
    }

    function renderRecent() {
        recentList.textContent = "";

        if (recent.length === 0) {
            const empty = document.createElement("span");
            empty.className = "hid-recent-empty";
            empty.textContent = "Tekan tombol di keyboard";
            recentList.appendChild(empty);
            return;
        }

        recent.forEach((item, index) => {
            const chip = document.createElement("span");
            chip.className = "hid-chip" + (index === 0 ? " latest" : "");
            chip.textContent = mode === "hid" ? item.hid : item.key;
            recentList.appendChild(chip);
        });
    }

    function setMode(newMode) {
        mode = newMode;
        codeModeBtn.classList.toggle("active", mode === "hid");
        keysModeBtn.classList.toggle("active", mode === "keys");
        renderRecent();
    }

    function applyOs(newOs) {
        os = newOs;
        osWinBtn.classList.toggle("active", os === "win");
        osMacBtn.classList.toggle("active", os === "mac");

        keyElements.forEach((el, code) => {
            el.textContent = (os === "mac" && MAC_LABELS[code]) || el.dataset.label;
        });
    }

    function updateLeds(event) {
        if (typeof event.getModifierState !== "function") return;
        Object.keys(leds).forEach((name) => {
            leds[name].classList.toggle("on", event.getModifierState(name));
        });
    }

    /* ---------- suara mesin tik ---------- */
    let noiseBuffer = null;

    let strikeBuffer = null;
    let strikeLoading = false;

    function prepareAudio() {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === "suspended") audioCtx.resume();

        // Muat rekaman ketukan mesin tik (sound-data.js) sekali saja
        if (!strikeBuffer && !strikeLoading && typeof TYPEWRITER_SPRITE !== "undefined") {
            strikeLoading = true;

            const binary = atob(TYPEWRITER_SPRITE.base64);
            const bytes = new Uint8Array(binary.length);
            for (let n = 0; n < binary.length; n++) bytes[n] = binary.charCodeAt(n);

            audioCtx.decodeAudioData(bytes.buffer)
                .then((buffer) => { strikeBuffer = buffer; })
                .catch((error) => console.error("ReyMIDI KeyLab - Rekaman suara gagal dibaca:", error))
                .finally(() => { strikeLoading = false; });
        }
    }

    function playClick(code) {
        if (!soundOn) return;

        try {
            prepareAudio();

            const ctx = audioCtx;
            const t = ctx.currentTime;
            const out = ctx.createGain();
            out.gain.value = 0.9;
            out.connect(ctx.destination);

            if (!noiseBuffer) {
                noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.08), ctx.sampleRate);
                const data = noiseBuffer.getChannelData(0);
                for (let n = 0; n < data.length; n++) data[n] = Math.random() * 2 - 1;
            }

            // "Klak" logam: noise pendek yang disaring
            const strike = (time, freq, vol, dur) => {
                const src = ctx.createBufferSource();
                const filter = ctx.createBiquadFilter();
                const gain = ctx.createGain();
                src.buffer = noiseBuffer;
                filter.type = "bandpass";
                filter.frequency.value = freq;
                filter.Q.value = 1.2;
                gain.gain.setValueAtTime(vol, time);
                gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
                src.connect(filter);
                filter.connect(gain);
                gain.connect(out);
                src.start(time);
                src.stop(time + dur + 0.01);
            };

            // "Tok" rendah: batang ketik menghantam
            const thump = (time, f0, f1, vol, dur) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "sine";
                osc.frequency.setValueAtTime(f0, time);
                osc.frequency.exponentialRampToValueAtTime(f1, time + dur);
                gain.gain.setValueAtTime(vol, time);
                gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
                osc.connect(gain);
                gain.connect(out);
                osc.start(time);
                osc.stop(time + dur + 0.01);
            };

            // "Ting" lonceng ujung baris
            const bell = (time) => {
                [2093, 3136].forEach((freq, n) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = "sine";
                    osc.frequency.value = freq;
                    gain.gain.setValueAtTime(n === 0 ? 0.16 : 0.08, time);
                    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.7);
                    osc.connect(gain);
                    gain.connect(out);
                    osc.start(time);
                    osc.stop(time + 0.75);
                });
            };

            // Ketukan dari rekaman asli (jika sudah siap)
            const playRecorded = (rate, vol) => {
                const [start, dur] = TYPEWRITER_SPRITE.segments[
                    Math.floor(Math.random() * TYPEWRITER_SPRITE.segments.length)
                ];
                const src = ctx.createBufferSource();
                const gain = ctx.createGain();
                src.buffer = strikeBuffer;
                src.playbackRate.value = rate;
                gain.gain.value = vol;
                src.connect(gain);
                gain.connect(out);
                src.start(t, start, dur);
            };

            const jitter = Math.random();
            const isEnter = code === "Enter" || code === "NumpadEnter";

            if (strikeBuffer) {
                if (code === "Space") {
                    playRecorded(0.8, 1);
                } else if (isEnter) {
                    playRecorded(0.9, 1);
                    bell(t + 0.1);
                } else {
                    playRecorded(0.96 + jitter * 0.08, 0.9);
                }
            } else if (code === "Space") {
                thump(t, 120, 50, 0.5, 0.09);
                strike(t, 900, 0.18, 0.05);
            } else if (isEnter) {
                strike(t, 2200 + jitter * 300, 0.5, 0.05);
                thump(t, 150, 55, 0.7, 0.1);
                strike(t + 0.05, 1200, 0.25, 0.08);
                bell(t + 0.12);
            } else {
                strike(t, 2400 + jitter * 600, 0.45, 0.035);
                thump(t, 170 + jitter * 30, 70, 0.45, 0.06);
                strike(t + 0.03, 4200, 0.12, 0.02);
            }
        } catch (error) {
            console.error("ReyMIDI KeyLab - Suara keyboard gagal:", error);
        }
    }

    /* ---------- logika tombol ---------- */
    function keyName(event) {
        if (event.key === " ") return "Space";
        if (event.key && event.key.length === 1) return event.key.toUpperCase();
        return event.key || event.code;
    }

    function registerPress(code, event) {
        recent.unshift({ hid: formatHid(code), key: keyName(event) });
        if (recent.length > RECENT_LIMIT) recent.length = RECENT_LIMIT;

        if (layoutCodes.has(code)) {
            testedKeys.add(code);
            keyElements.get(code).classList.add("tested");
        }

        renderRecent();
        updateProgress();
        playClick(code);
    }

    function setHeld(code, isHeld) {
        const el = keyElements.get(code);
        if (isHeld) heldKeys.add(code); else heldKeys.delete(code);
        if (el) el.classList.toggle("down", isHeld);
    }

    function isTypingTarget(target) {
        return !!(target && target.closest &&
            target.closest("select, textarea, input[type='text']"));
    }

    // F5 dan F12 ikut diblokir selama KeyLab terbuka. Ctrl+R dan Ctrl+Shift+I/J
    // sengaja dibiarkan sebagai jalan keluar untuk reload dan DevTools saat pengembangan.
    function keepBrowserDefault(event) {
        return (event.ctrlKey && event.code === "KeyR") ||
            (event.ctrlKey && event.shiftKey && (event.code === "KeyI" || event.code === "KeyJ"));
    }

    window.addEventListener("keydown", (event) => {
        if (event.isComposing || isTypingTarget(event.target)) return;
        if (!keepBrowserDefault(event)) event.preventDefault();

        updateLeds(event);

        const code = event.code || event.key;
        if (!code) return;

        setHeld(code, true);
        if (!event.repeat) registerPress(code, event);
    });

    window.addEventListener("keyup", (event) => {
        if (event.isComposing || isTypingTarget(event.target)) return;
        if (!keepBrowserDefault(event)) event.preventDefault();

        updateLeds(event);

        const code = event.code || event.key;
        if (!code) return;

        // Beberapa tombol (mis. Print Screen) hanya mengirim keyup
        if (!heldKeys.has(code)) registerPress(code, event);
        setHeld(code, false);
    });

    window.addEventListener("blur", () => {
        Array.from(heldKeys).forEach((code) => setHeld(code, false));
    });

    /* ---------- kontrol ---------- */
    codeModeBtn.addEventListener("click", () => { setMode("hid"); codeModeBtn.blur(); });
    keysModeBtn.addEventListener("click", () => { setMode("keys"); keysModeBtn.blur(); });
    osWinBtn.addEventListener("click", () => { applyOs("win"); osWinBtn.blur(); });
    osMacBtn.addEventListener("click", () => { applyOs("mac"); osMacBtn.blur(); });

    soundBtn.addEventListener("click", () => {
        soundOn = !soundOn;
        soundBtn.setAttribute("aria-pressed", String(soundOn));
        soundBtn.title = soundOn ? "Suara tombol: hidup" : "Suara tombol: mati";
        soundBtn.blur();

        if (soundOn) {
            try { prepareAudio(); } catch (error) { console.error(error); }
        }
    });

    resetBtn.addEventListener("click", () => {
        testedKeys.clear();
        recent = [];
        heldKeys.clear();

        keyElements.forEach((el) => el.classList.remove("tested", "down"));

        renderRecent();
        updateProgress();
        resetBtn.blur();
    });

    /* ---------- kunci tombol sistem (Win, Print Screen, dll.) ---------- */
    // Tombol Win dan Print Screen ditangani Windows, jadi halaman web hanya bisa
    // menahannya lewat Keyboard Lock API, yang butuh layar penuh (Chrome / Edge).
    const LOCKED_KEYS = ["MetaLeft", "MetaRight", "PrintScreen", "ContextMenu", "F5", "F12"];
    const canLock = !!(navigator.keyboard && navigator.keyboard.lock &&
        document.documentElement.requestFullscreen);

    function setLocked(state) {
        lockBtn.setAttribute("aria-pressed", String(state));
        lockBtn.title = state
            ? "Tombol sistem dikunci. Klik untuk melepas."
            : "Kunci tombol sistem (layar penuh)";
    }

    if (!canLock) {
        lockBtn.disabled = true;
        lockBtn.title = "Browser ini tidak mendukung kunci tombol sistem (gunakan Chrome atau Edge)";
    }

    lockBtn.addEventListener("click", async () => {
        lockBtn.blur();

        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen(); // pelepasan kunci ditangani fullscreenchange
                return;
            }

            await document.documentElement.requestFullscreen();
            await navigator.keyboard.lock(LOCKED_KEYS);
            setLocked(true);
        } catch (error) {
            console.error("ReyMIDI KeyLab - Kunci tombol gagal:", error);
            setLocked(false);
            if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        }
    });

    document.addEventListener("fullscreenchange", () => {
        if (!document.fullscreenElement) {
            if (navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock();
            setLocked(false);
        }
    });

    applyOs(os);
    setMode("hid");
    updateProgress();
}


async function connectMIDI() {
    if (!navigator.requestMIDIAccess) {
        connectionStatus.textContent = "MIDI: Browser tidak mendukung";
        logMidi("Web MIDI tidak tersedia di browser ini.");
        return;
    }

    try {
        logMidi("Meminta akses MIDI...");
const midi = await navigator.requestMIDIAccess();


        let selectedInputId = "";
let scanTimer = null;
let userHasChosenInput = false;
let lastConnectedId = null;

        const oldSelector = document.getElementById("midiInputSelect");
        if (oldSelector) oldSelector.remove();

        connectionStatus.textContent = "MIDI: ";

        const selector = document.createElement("select");
        selector.id = "midiInputSelect";
        selector.style.marginLeft = "10px";
        selector.style.padding = "7px";
        selector.style.borderRadius = "5px";
        selector.style.background = "#0a0a0b";
        selector.style.color = "#f1f1f4";
        selector.style.border = "1px solid #7d6220";
        selector.style.maxWidth = "240px";

        connectionStatus.appendChild(selector);

        function connectSelectedInput() {
            for (const input of midi.inputs.values()) {
                input.onmidimessage = null;
            }

            // Ganti atau cabut perangkat: lepaskan nada yang mungkin nyangkut
            if (selectedInputId !== lastConnectedId) {
                releaseAllNotes();
                lastConnectedId = selectedInputId;
            }

            const input = midi.inputs.get(selectedInputId);

            if (!input || input.state !== "connected") {
                connectionStatus.firstChild.textContent =
                    "MIDI: Belum Terhubung";
                return;
            }

            connectionStatus.firstChild.textContent = "MIDI: ";

            input.onmidimessage = (event) => {
                const [status, data1, data2] = event.data;
                const command = status & 0xF0;
                const channel = (status & 0x0F) + 1;

                if (command === 0x90 && data2 > 0) {
                    showMidiNote(data1, data2, true);
                    logMidi(
                        `Note ON | Ch ${channel} | Note ${data1} | Vel ${data2}`
                    );
                } else if (
                    command === 0x80 ||
                    (command === 0x90 && data2 === 0)
                ) {
                    showMidiNote(data1, 0, false);
                    logMidi(
                        `Note OFF | Ch ${channel} | Note ${data1}`
                    );
                } else if (command === 0xB0) {
                    // CC 120 (All Sound Off) dan CC 123 (All Notes Off)
                    if (data1 === 120 || data1 === 123) releaseAllNotes();

                    logMidi(
                        `CC | Ch ${channel} | CC ${data1} | Value ${data2}`
                    );
                } else if (command === 0xE0) {
                    const pitchBend = (data2 << 7) | data1;
                    logMidi(
                        `Pitch Bend | Ch ${channel} | Value ${pitchBend}`
                    );
                } else {
                    logMidi(
                        `MIDI | Status ${status} | Data ${data1}, ${data2}`
                    );
                }
            };

            connectionStatus.firstChild.textContent = "MIDI: REY MIDI";
        }

        function updateInputs() {
            const inputs = Array.from(midi.inputs.values()).filter(
                input => input.state === "connected"
            );

            const previousValue = selectedInputId;
            selector.innerHTML = "";

            const placeholder = document.createElement("option");
            placeholder.value = "";
            placeholder.textContent = inputs.length
                ? "Pilih MIDI Input"
                : "Tidak ada MIDI Input";
            selector.appendChild(placeholder);

            inputs.forEach((input, index) => {
                const option = document.createElement("option");
                option.value = input.id;
                option.textContent = input.name || `MIDI Input ${index + 1}`;
                selector.appendChild(option);
            });

        if (inputs.some(input => input.id === previousValue)) {
    selectedInputId = previousValue;
} else if (inputs.length === 1 && !userHasChosenInput) {
    selectedInputId = inputs[0].id;
} else {
    selectedInputId = "";
}

            selector.value = selectedInputId;
            connectSelectedInput();

            if (inputs.length === 0) {
                connectionStatus.firstChild.textContent =
                    "MIDI: Belum Terhubung";
            }
        }

       selector.addEventListener("change", () => {
    userHasChosenInput = true;
    selectedInputId = selector.value;
    connectSelectedInput();
});

        midi.onstatechange = () => {
            updateInputs();
        };
     window.addEventListener("pagehide", () => {
    midi.onstatechange = null;

    for (const input of midi.inputs.values()) {
        input.onmidimessage = null;
    }

    if (scanTimer !== null) {
        clearInterval(scanTimer);
    }
});

        updateInputs();

        // Periksa kembali daftar perangkat selama beberapa detik
        // setelah halaman dibuka.
        let attempts = 0;
        scanTimer = setInterval(() => {
            updateInputs();
            attempts++;

            if (attempts >= 10) {
                clearInterval(scanTimer);
                scanTimer = null;
            }
        }, 500);

   } catch (error) {
    connectionStatus.textContent = "MIDI: Akses ditolak/gagal";
    logMidi(`Gagal membuka MIDI: ${error.name} - ${error.message}`);
    console.error("ReyMIDI KeyLab - Gagal membuka MIDI:", error);
}
}




createPiano();
initHidTest();
connectMIDI();
logMidi("ReyMIDI KeyLab siap.");