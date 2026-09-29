# Frontier sound cues

These 18 finished mixes are the approved Frontier cue set. Runtime paths are `/sound/frontier/<cue-id>.mp3`. Source
recordings are from the Sonniss GDC 2024 Game Audio Bundle and remain the property of their respective copyright
holders. Only finished game mixes are included here. Original recordings remain outside the repository; the paths below
identify them for rebuilding.

## Delivery

- 44.1 kHz mono, 160 kbit/s MP3 with gapless duration metadata.
- UI cues target about −18 LUFS short-term in a 3.1-second repeated-cue measurement. Epic is about 2–3 dB hotter.
- The sustained charge is about −20 LUFS. XP is deliberately softer, about −27 LUFS in its 12-ticks-per-second context.
- Decoded true peaks remain below −1 dBFS; measured leading silence is below 1 ms.
- `chest.charge` is a 2.4-second loop (105,840 decoded samples). Its head and tail overlap for 400 ms and the cycle is
  rotated to a quiet zero crossing before encoding. Loop the exact decoded buffer length; native media-element
  scheduling can introduce gaps independently of the asset.
- `xp.tick` lasts about 64 ms, below its 83.33 ms repeat interval.

## Source and processing convention

Each cue combines at least two source files. The first command trims, filters, pitches, fades and mixes the layers.
Charge has an additional circular alignment command. The last command applies the measured final gain, peak limiting and
MP3 encoding. Paths in the commands name the original local bundle and external working mixes; no raw copy is needed.
The resulting MP3 is copied byte-for-byte to the runtime filename. Intermediate WAVs are already multi-source mixes. The
listed SHA-256 hashes identify the approved delivered files.

## chest.tap

Runtime: `/sound/frontier/chest.tap.mp3`. 0.120 s, -18.4 LUFS short-term, -2.3 dBTP.

Wooden contact and a compact latch; immediate, no tail.

SHA-256: `da6bb8cf2736ba86bd724fc413c9fa9acb202a4c191cc41e1bee701c8bbc0400`.

Exact source paths relative to the Sonniss bundle root:

- `Sonic Bat - Videogame Foley Essentials Vol. II/SBvfe2_Shaking Small Wooden Box 030.wav`
- `CB Sounddesign - Activation 2/UIClick_UI Click 33_CB Sounddesign_ACTIVATION2.wav`

Processing commands:

```sh
ffmpeg -hide_banner -v error -y -threads 1 -filter_complex_threads 1 -ss 1.58 -t 0.22 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Sonic Bat - Videogame Foley Essentials Vol. II/SBvfe2_Shaking Small Wooden Box 030.wav' -ss 0.0 -t 0.16499999999999998 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/CB Sounddesign - Activation 2/UIClick_UI Click 33_CB Sounddesign_ACTIVATION2.wav' -filter_complex '[0:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=0.8408964:tempo=1:transients=mixed,atrim=duration=0.1,asetpts=PTS-STARTPTS,highpass=f=90,lowpass=f=2600,volume=-1.3000dB,afade=t=in:d=0.002,afade=t=out:st=0.070000:d=0.03,adelay=0:all=1[l0];[1:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,atrim=duration=0.045,asetpts=PTS-STARTPTS,highpass=f=90,lowpass=f=4800,volume=-16.7654dB,afade=t=in:d=0.002,afade=t=out:st=0.015000:d=0.03,adelay=0:all=1[l1];[l0][l1]amix=inputs=2:normalize=0,apad,atrim=duration=0.12,asetpts=PTS-STARTPTS[mix];[mix]silenceremove=start_periods=1:start_duration=0:start_threshold=-60dB:start_silence=0.001:detection=peak:window=0.001,apad,atrim=duration=0.12,afade=t=in:d=0.002,afade=t=out:st=0.095000:d=0.025[out]' -map '[out]' -ar 44100 -ac 1 -c:a pcm_f32le -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/work/chest.tap-a.wav

ffmpeg -v error -y -i /home/djizus/projects/.reviewer-inbox/frontier-audio/work/chest.tap-a.wav -af volume=18.0000dB,alimiter=limit=0.794328:level=false:latency=true,volume=0.0000dB,aresample=44100 -ar 44100 -ac 1 -c:a libmp3lame -b:a 160k -write_xing 1 -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/chest.tap-a.mp3
```

## chest.charge

Runtime: `/sound/frontier/chest.charge.mp3`. 2.400 s, -20.5 LUFS short-term, -6.7 dBTP.

A metallic pressure rise with glass tension and a faint mechanism; no reward notes yet.

SHA-256: `c57693031b8cade49024aacfa9c340785731e6e4625c357506dccfaa344bb3ca`.

Exact source paths relative to the Sonniss bundle root:

- `Jake Fielding - Haunted Metal Vol.2 - Cinematic Creaks & Risers/DSGNRise_Cinematic Metallic Riser, Trailer, Designed Eerie Wail_JF_Haunted Metal Vol 2_02.wav`
- `Mechanical Wave - Glass/GLASTonl_Dark Tone Thrill_07_MWSFX_GL.wav`
- `Justsoundeffects - Steampunk Gadgets/MECHGear_Tiny Rotation 01_JSE_SG_Stereo.wav`

Processing commands:

```sh
ffmpeg -hide_banner -v error -y -threads 1 -filter_complex_threads 1 -ss 5 -t 2.92 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Jake Fielding - Haunted Metal Vol.2 - Cinematic Creaks & Risers/DSGNRise_Cinematic Metallic Riser, Trailer, Designed Eerie Wail_JF_Haunted Metal Vol 2_02.wav' -ss 0.1 -t 2.36 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Mechanical Wave - Glass/GLASTonl_Dark Tone Thrill_07_MWSFX_GL.wav' -ss 0.1 -t 2.92 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Justsoundeffects - Steampunk Gadgets/MECHGear_Tiny Rotation 01_JSE_SG_Stereo.wav' -filter_complex '[0:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,asendcmd=c='"'"'0.000 rubberband@rise0 pitch 0.707107;0.070 rubberband@rise0 pitch 0.719467;0.140 rubberband@rise0 pitch 0.732043;0.210 rubberband@rise0 pitch 0.744839;0.280 rubberband@rise0 pitch 0.757858;0.350 rubberband@rise0 pitch 0.771105;0.420 rubberband@rise0 pitch 0.784584;0.490 rubberband@rise0 pitch 0.798298;0.560 rubberband@rise0 pitch 0.812252;0.630 rubberband@rise0 pitch 0.826450;0.700 rubberband@rise0 pitch 0.840896;0.770 rubberband@rise0 pitch 0.855595;0.840 rubberband@rise0 pitch 0.870551;0.910 rubberband@rise0 pitch 0.885768;0.980 rubberband@rise0 pitch 0.901250;1.050 rubberband@rise0 pitch 0.917004;1.120 rubberband@rise0 pitch 0.933033;1.190 rubberband@rise0 pitch 0.949342;1.260 rubberband@rise0 pitch 0.965936;1.330 rubberband@rise0 pitch 0.982821;1.400 rubberband@rise0 pitch 1.000000;1.470 rubberband@rise0 pitch 1.017480;1.540 rubberband@rise0 pitch 1.035265;1.610 rubberband@rise0 pitch 1.053361;1.680 rubberband@rise0 pitch 1.071773;1.750 rubberband@rise0 pitch 1.090508;1.820 rubberband@rise0 pitch 1.109569;1.890 rubberband@rise0 pitch 1.128964;1.960 rubberband@rise0 pitch 1.148698;2.030 rubberband@rise0 pitch 1.168777;2.100 rubberband@rise0 pitch 1.189207;2.170 rubberband@rise0 pitch 1.209994;2.240 rubberband@rise0 pitch 1.231144;2.310 rubberband@rise0 pitch 1.252664;2.380 rubberband@rise0 pitch 1.274561;2.450 rubberband@rise0 pitch 1.296840;2.520 rubberband@rise0 pitch 1.319508;2.590 rubberband@rise0 pitch 1.342573;2.660 rubberband@rise0 pitch 1.366040;2.730 rubberband@rise0 pitch 1.389918;2.800 rubberband@rise0 pitch 1.414214'"'"',rubberband@rise0=pitch=0.707107:tempo=1:transients=smooth,atrim=duration=2.8,asetpts=PTS-STARTPTS,highpass=f=220,lowpass=f=3500,volume=-11.2670dB,afade=t=in:d=0.002,afade=t=out:st=2.798000:d=0.002,adelay=0:all=1[l0];[1:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=1.0000000:tempo=0.8:transients=mixed,atrim=duration=2.8,asetpts=PTS-STARTPTS,highpass=f=380,lowpass=f=3000,volume=-20.6815dB,afade=t=in:d=0.002,afade=t=out:st=2.798000:d=0.002,adelay=0:all=1[l1];[2:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,atrim=duration=2.8,asetpts=PTS-STARTPTS,highpass=f=900,lowpass=f=4200,volume=-3.6182dB,afade=t=in:d=0.002,afade=t=out:st=2.798000:d=0.002,adelay=0:all=1[l2];[l0][l1][l2]amix=inputs=3:normalize=0,apad,atrim=duration=2.8,asetpts=PTS-STARTPTS[mix];[mix]asplit=3[h][m][t];[h]atrim=0:0.4,asetpts=PTS-STARTPTS,afade=t=in:d=0.4:curve=hsin[head];[t]atrim=2.4:2.8,asetpts=PTS-STARTPTS,afade=t=out:d=0.4:curve=hsin[tail];[head][tail]amix=inputs=2:normalize=0[cross];[m]atrim=0.4:2.4,asetpts=PTS-STARTPTS[mid];[mid][cross]concat=n=2:v=0:a=1[out]' -map '[out]' -ar 44100 -ac 1 -c:a pcm_f32le -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/round-2/work/chest.charge-a.wav

ffmpeg -v error -y -i /home/djizus/projects/.reviewer-inbox/frontier-audio/round-2/work/chest.charge-a.wav -filter_complex '[0:a]asplit=2[a][b];[a]atrim=start_sample=78926,asetpts=PTS-STARTPTS[first];[b]atrim=end_sample=78926,asetpts=PTS-STARTPTS[last];[first][last]concat=n=2:v=0:a=1[out]' -map '[out]' -ar 44100 -ac 1 -c:a pcm_f32le -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/round-2/work/chest.charge-a-cyclic.wav

ffmpeg -v error -y -i /home/djizus/projects/.reviewer-inbox/frontier-audio/round-2/work/chest.charge-a-cyclic.wav -af volume=10.5000dB,alimiter=limit=0.794328:level=false:latency=true,volume=0.0000dB,aresample=44100 -ar 44100 -ac 1 -c:a libmp3lame -b:a 160k -write_xing 1 -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/round-2/chest.charge-a.mp3
```

## chest.tell.common

Runtime: `/sound/frontier/chest.tell.common.mp3`. 0.440 s, -18.3 LUFS short-term, -2.0 dBTP.

Same B base; grounded confirmation.

SHA-256: `1e8d683a878a79d54ec6c76060e759ea24a02969d86617c3f6f56cbedb918490`.

Exact source paths relative to the Sonniss bundle root:

- `UberDuo - Game Night Audio Props/GAMEBoard_Chess, Contact, King Takes_UberDuo_Game.wav`
- `Sonic Bat - Videogame Foley Essentials Vol. II/SBvfe2_Glass 114.wav`

Processing commands:

```sh
ffmpeg -hide_banner -v error -y -threads 1 -filter_complex_threads 1 -ss 1.97 -t 0.28 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/UberDuo - Game Night Audio Props/GAMEBoard_Chess, Contact, King Takes_UberDuo_Game.wav' -ss 0.0 -t 0.54 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Sonic Bat - Videogame Foley Essentials Vol. II/SBvfe2_Glass 114.wav' -filter_complex '[0:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,atrim=duration=0.16,asetpts=PTS-STARTPTS,highpass=f=90,lowpass=f=3300,volume=-11.7370dB,afade=t=in:d=0.002,afade=t=out:st=0.130000:d=0.03,adelay=0:all=1[l0];[1:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=0.7491535:tempo=1:transients=mixed,atrim=duration=0.42,asetpts=PTS-STARTPTS,highpass=f=650,lowpass=f=6500,volume=10.6424dB,afade=t=in:d=0.002,afade=t=out:st=0.210000:d=0.21,adelay=0:all=1[l1];[l0][l1]amix=inputs=2:normalize=0,apad,atrim=duration=0.44,asetpts=PTS-STARTPTS[mix];[mix]silenceremove=start_periods=1:start_duration=0:start_threshold=-60dB:start_silence=0.001:detection=peak:window=0.001,apad,atrim=duration=0.44,afade=t=in:d=0.002,afade=t=out:st=0.415000:d=0.025[out]' -map '[out]' -ar 44100 -ac 1 -c:a pcm_f32le -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/work/chest.tell.common-b.wav

ffmpeg -v error -y -i /home/djizus/projects/.reviewer-inbox/frontier-audio/work/chest.tell.common-b.wav -af volume=18.0000dB,alimiter=limit=0.794328:level=false:latency=true,volume=0.0000dB,aresample=44100 -ar 44100 -ac 1 -c:a libmp3lame -b:a 160k -write_xing 1 -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/chest.tell.common-b.mp3
```

## chest.tell.uncommon

Runtime: `/sound/frontier/chest.tell.uncommon.mp3`. 0.780 s, -18.4 LUFS short-term, -1.7 dBTP.

Same B base; adds a three-note shimmer.

SHA-256: `5344bf597eb215bf3bbda6b17cbd6ccc02f243426535cfbb7d1b92ccdc4a42a7`.

Exact source paths relative to the Sonniss bundle root:

- `UberDuo - Game Night Audio Props/GAMEBoard_Chess, Contact, King Takes_UberDuo_Game.wav`
- `Sonic Bat - Videogame Foley Essentials Vol. II/SBvfe2_Glass 114.wav`

Processing commands:

```sh
ffmpeg -hide_banner -v error -y -threads 1 -filter_complex_threads 1 -ss 1.97 -t 0.28 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/UberDuo - Game Night Audio Props/GAMEBoard_Chess, Contact, King Takes_UberDuo_Game.wav' -ss 0.0 -t 0.54 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Sonic Bat - Videogame Foley Essentials Vol. II/SBvfe2_Glass 114.wav' -ss 0.0 -t 0.64 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Sonic Bat - Videogame Foley Essentials Vol. II/SBvfe2_Glass 114.wav' -ss 0.0 -t 0.64 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Sonic Bat - Videogame Foley Essentials Vol. II/SBvfe2_Glass 114.wav' -ss 0.0 -t 0.64 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Sonic Bat - Videogame Foley Essentials Vol. II/SBvfe2_Glass 114.wav' -filter_complex '[0:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,atrim=duration=0.16,asetpts=PTS-STARTPTS,highpass=f=90,lowpass=f=3300,volume=-11.7370dB,afade=t=in:d=0.002,afade=t=out:st=0.130000:d=0.03,adelay=0:all=1[l0];[1:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=0.7491535:tempo=1:transients=mixed,atrim=duration=0.42,asetpts=PTS-STARTPTS,highpass=f=650,lowpass=f=6500,volume=10.6424dB,afade=t=in:d=0.002,afade=t=out:st=0.210000:d=0.21,adelay=0:all=1[l1];[2:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=1.2599210:tempo=1:transients=mixed,atrim=duration=0.52,asetpts=PTS-STARTPTS,highpass=f=650,lowpass=f=6500,volume=9.0588dB,afade=t=in:d=0.002,afade=t=out:st=0.270000:d=0.25,adelay=70:all=1[l2];[3:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=1.6817928:tempo=1:transients=mixed,atrim=duration=0.52,asetpts=PTS-STARTPTS,highpass=f=650,lowpass=f=6500,volume=9.0588dB,afade=t=in:d=0.002,afade=t=out:st=0.270000:d=0.25,adelay=140:all=1[l3];[4:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=2.5198421:tempo=1:transients=mixed,atrim=duration=0.52,asetpts=PTS-STARTPTS,highpass=f=650,lowpass=f=6500,volume=9.0588dB,afade=t=in:d=0.002,afade=t=out:st=0.270000:d=0.25,adelay=220:all=1[l4];[l0][l1][l2][l3][l4]amix=inputs=5:normalize=0,apad,atrim=duration=0.78,asetpts=PTS-STARTPTS[mix];[mix]silenceremove=start_periods=1:start_duration=0:start_threshold=-60dB:start_silence=0.001:detection=peak:window=0.001,apad,atrim=duration=0.78,afade=t=in:d=0.002,afade=t=out:st=0.755000:d=0.025[out]' -map '[out]' -ar 44100 -ac 1 -c:a pcm_f32le -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/work/chest.tell.uncommon-b.wav

ffmpeg -v error -y -i /home/djizus/projects/.reviewer-inbox/frontier-audio/work/chest.tell.uncommon-b.wav -af volume=20.1000dB,alimiter=limit=0.794328:level=false:latency=true,volume=0.0000dB,aresample=44100 -ar 44100 -ac 1 -c:a libmp3lame -b:a 160k -write_xing 1 -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/chest.tell.uncommon-b.mp3
```

## chest.tell.rare

Runtime: `/sound/frontier/chest.tell.rare.mp3`. 1.200 s, -18.2 LUFS short-term, -2.1 dBTP.

Same B base; adds a stretched, harmonized vowel swell.

SHA-256: `a38cd18fcc79b5ad040198958166f7338a38c49132a66e5d8568e643a59d0bfb`.

Exact source paths relative to the Sonniss bundle root:

- `UberDuo - Game Night Audio Props/GAMEBoard_Chess, Contact, King Takes_UberDuo_Game.wav`
- `Sonic Bat - Videogame Foley Essentials Vol. II/SBvfe2_Glass 114.wav`
- `CB Sounddesign - Sci-Fi Voices Volume 03 Advanced Android/Maintenance complete.wav`

Processing commands:

```sh
ffmpeg -hide_banner -v error -y -threads 1 -filter_complex_threads 1 -ss 1.97 -t 0.28 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/UberDuo - Game Night Audio Props/GAMEBoard_Chess, Contact, King Takes_UberDuo_Game.wav' -ss 0.0 -t 0.54 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Sonic Bat - Videogame Foley Essentials Vol. II/SBvfe2_Glass 114.wav' -ss 0.0 -t 0.64 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Sonic Bat - Videogame Foley Essentials Vol. II/SBvfe2_Glass 114.wav' -ss 0.0 -t 0.64 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Sonic Bat - Videogame Foley Essentials Vol. II/SBvfe2_Glass 114.wav' -ss 0.0 -t 0.64 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Sonic Bat - Videogame Foley Essentials Vol. II/SBvfe2_Glass 114.wav' -ss 0.28 -t 0.27359999999999995 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/CB Sounddesign - Sci-Fi Voices Volume 03 Advanced Android/Maintenance complete.wav' -ss 0.28 -t 0.27359999999999995 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/CB Sounddesign - Sci-Fi Voices Volume 03 Advanced Android/Maintenance complete.wav' -ss 0.28 -t 0.27359999999999995 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/CB Sounddesign - Sci-Fi Voices Volume 03 Advanced Android/Maintenance complete.wav' -filter_complex '[0:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,atrim=duration=0.16,asetpts=PTS-STARTPTS,highpass=f=90,lowpass=f=3300,volume=-11.7370dB,afade=t=in:d=0.002,afade=t=out:st=0.130000:d=0.03,adelay=0:all=1[l0];[1:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=0.7491535:tempo=1:transients=mixed,atrim=duration=0.42,asetpts=PTS-STARTPTS,highpass=f=650,lowpass=f=6500,volume=10.6424dB,afade=t=in:d=0.002,afade=t=out:st=0.210000:d=0.21,adelay=0:all=1[l1];[2:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=1.2599210:tempo=1:transients=mixed,atrim=duration=0.52,asetpts=PTS-STARTPTS,highpass=f=650,lowpass=f=6500,volume=9.0588dB,afade=t=in:d=0.002,afade=t=out:st=0.270000:d=0.25,adelay=70:all=1[l2];[3:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=1.6817928:tempo=1:transients=mixed,atrim=duration=0.52,asetpts=PTS-STARTPTS,highpass=f=650,lowpass=f=6500,volume=9.0588dB,afade=t=in:d=0.002,afade=t=out:st=0.270000:d=0.25,adelay=140:all=1[l3];[4:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=2.5198421:tempo=1:transients=mixed,atrim=duration=0.52,asetpts=PTS-STARTPTS,highpass=f=650,lowpass=f=6500,volume=9.0588dB,afade=t=in:d=0.002,afade=t=out:st=0.270000:d=0.25,adelay=220:all=1[l4];[5:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=1.0000000:tempo=0.16:transients=mixed,atrim=duration=0.96,asetpts=PTS-STARTPTS,highpass=f=180,lowpass=f=2700,volume=-24.0556dB,afade=t=in:d=0.18,afade=t=out:st=0.660000:d=0.3,adelay=80:all=1[l5];[6:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=1.2599210:tempo=0.16:transients=mixed,atrim=duration=0.96,asetpts=PTS-STARTPTS,highpass=f=180,lowpass=f=2700,volume=-24.0556dB,afade=t=in:d=0.18,afade=t=out:st=0.660000:d=0.3,adelay=98:all=1[l6];[7:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=1.4983071:tempo=0.16:transients=mixed,atrim=duration=0.96,asetpts=PTS-STARTPTS,highpass=f=180,lowpass=f=2700,volume=-24.0556dB,afade=t=in:d=0.18,afade=t=out:st=0.660000:d=0.3,adelay=116:all=1[l7];[l0][l1][l2][l3][l4][l5][l6][l7]amix=inputs=8:normalize=0,apad,atrim=duration=1.2,asetpts=PTS-STARTPTS[mix];[mix]silenceremove=start_periods=1:start_duration=0:start_threshold=-60dB:start_silence=0.001:detection=peak:window=0.001,apad,atrim=duration=1.2,afade=t=in:d=0.002,afade=t=out:st=1.175000:d=0.025[out]' -map '[out]' -ar 44100 -ac 1 -c:a pcm_f32le -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/work/chest.tell.rare-b.wav

ffmpeg -v error -y -i /home/djizus/projects/.reviewer-inbox/frontier-audio/work/chest.tell.rare-b.wav -af volume=14.7000dB,alimiter=limit=0.794328:level=false:latency=true,volume=0.0000dB,aresample=44100 -ar 44100 -ac 1 -c:a libmp3lame -b:a 160k -write_xing 1 -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/chest.tell.rare-b.mp3
```

## chest.tell.epic

Runtime: `/sound/frontier/chest.tell.epic.mp3`. 1.700 s, -15.7 LUFS short-term, -2.2 dBTP.

Locked B base, a new low boom, glass spray, vocal swell and three brass statements.

SHA-256: `fe545410a59f4363ab03248ab3d17cd9cc1be4f090316116aa041e7b57e67c5f`.

Exact source paths relative to the Sonniss bundle root:

- `UberDuo - Game Night Audio Props/GAMEBoard_Chess, Contact, King Takes_UberDuo_Game.wav`
- `Sonic Bat - Videogame Foley Essentials Vol. II/SBvfe2_Glass 114.wav`
- `BluezoneCorp - Modern Cinematic Impact/Bluezone_BC0294_modern_cinematic_impact_boom_003.wav`
- `Mechanical Wave - Glass/GLASMisc_Reverse Glass Effect_04_MWSFX_GL.wav`
- `CB Sounddesign - Sci-Fi Voices Volume 01 Mothership/Mothership_Awaiting_response.wav`
- `Mechanical Wave - Cinematic Feel/DSGNBram_Cinematic Horn_MWSFX_CF 05.wav`

Processing commands:

```sh
ffmpeg -hide_banner -v error -y -threads 1 -filter_complex_threads 1 -ss 1.97 -t 0.28 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/UberDuo - Game Night Audio Props/GAMEBoard_Chess, Contact, King Takes_UberDuo_Game.wav' -ss 0.0 -t 0.54 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Sonic Bat - Videogame Foley Essentials Vol. II/SBvfe2_Glass 114.wav' -ss 0.0 -t 0.97 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/BluezoneCorp - Modern Cinematic Impact/Bluezone_BC0294_modern_cinematic_impact_boom_003.wav' -ss 0.42 -t 1.0299999999999998 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Mechanical Wave - Glass/GLASMisc_Reverse Glass Effect_04_MWSFX_GL.wav' -ss 0.18 -t 0.272 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/CB Sounddesign - Sci-Fi Voices Volume 01 Mothership/Mothership_Awaiting_response.wav' -ss 0.18 -t 0.272 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/CB Sounddesign - Sci-Fi Voices Volume 01 Mothership/Mothership_Awaiting_response.wav' -ss 0.18 -t 0.272 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/CB Sounddesign - Sci-Fi Voices Volume 01 Mothership/Mothership_Awaiting_response.wav' -ss 0.4 -t 0.35 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Mechanical Wave - Cinematic Feel/DSGNBram_Cinematic Horn_MWSFX_CF 05.wav' -ss 0.4 -t 0.4 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Mechanical Wave - Cinematic Feel/DSGNBram_Cinematic Horn_MWSFX_CF 05.wav' -ss 0.4 -t 0.7 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Mechanical Wave - Cinematic Feel/DSGNBram_Cinematic Horn_MWSFX_CF 05.wav' -filter_complex '[0:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,atrim=duration=0.16,asetpts=PTS-STARTPTS,highpass=f=90,lowpass=f=3300,volume=-11.7370dB,afade=t=in:d=0.002,afade=t=out:st=0.130000:d=0.03,adelay=0:all=1[l0];[1:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=0.7491535:tempo=1:transients=mixed,atrim=duration=0.42,asetpts=PTS-STARTPTS,highpass=f=650,lowpass=f=6500,volume=10.6424dB,afade=t=in:d=0.002,afade=t=out:st=0.210000:d=0.21,adelay=0:all=1[l1];[2:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=0.8408964:tempo=1:transients=mixed,atrim=duration=0.85,asetpts=PTS-STARTPTS,highpass=f=32,lowpass=f=260,volume=-22.4517dB,afade=t=in:d=0.002,afade=t=out:st=0.820000:d=0.03,adelay=0:all=1[l2];[3:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=1.0000000:tempo=1.4:transients=mixed,atrim=duration=0.65,asetpts=PTS-STARTPTS,areverse,highpass=f=1000,lowpass=f=7200,volume=-16.6915dB,afade=t=in:d=0.002,afade=t=out:st=0.620000:d=0.03,adelay=60:all=1[l3];[4:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=1.0000000:tempo=0.16:transients=mixed,atrim=duration=0.95,asetpts=PTS-STARTPTS,highpass=f=220,lowpass=f=2400,volume=-22.7710dB,afade=t=in:d=0.13,afade=t=out:st=0.650000:d=0.3,adelay=100:all=1[l4];[5:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=1.2599210:tempo=0.16:transients=mixed,atrim=duration=0.95,asetpts=PTS-STARTPTS,highpass=f=220,lowpass=f=2400,volume=-22.7710dB,afade=t=in:d=0.13,afade=t=out:st=0.650000:d=0.3,adelay=113:all=1[l5];[6:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=1.4983071:tempo=0.16:transients=mixed,atrim=duration=0.95,asetpts=PTS-STARTPTS,highpass=f=220,lowpass=f=2400,volume=-22.7710dB,afade=t=in:d=0.13,afade=t=out:st=0.650000:d=0.3,adelay=126:all=1[l6];[7:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,atrim=duration=0.23,asetpts=PTS-STARTPTS,highpass=f=180,lowpass=f=4300,volume=-12.7750dB,afade=t=in:d=0.008,afade=t=out:st=0.138000:d=0.09200000000000001,adelay=150:all=1[l7];[8:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=1.2599210:tempo=1:transients=mixed,atrim=duration=0.28,asetpts=PTS-STARTPTS,highpass=f=180,lowpass=f=4300,volume=-12.7750dB,afade=t=in:d=0.008,afade=t=out:st=0.168000:d=0.11200000000000002,adelay=380:all=1[l8];[9:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=1.4983071:tempo=1:transients=mixed,atrim=duration=0.58,asetpts=PTS-STARTPTS,highpass=f=180,lowpass=f=4300,volume=-12.7750dB,afade=t=in:d=0.008,afade=t=out:st=0.450000:d=0.13,adelay=670:all=1[l9];[l0][l1][l2][l3][l4][l5][l6][l7][l8][l9]amix=inputs=10:normalize=0,apad,atrim=duration=1.7,asetpts=PTS-STARTPTS[mix];[mix]silenceremove=start_periods=1:start_duration=0:start_threshold=-60dB:start_silence=0.001:detection=peak:window=0.001,apad,atrim=duration=1.7,afade=t=in:d=0.002,afade=t=out:st=1.675000:d=0.025[out]' -map '[out]' -ar 44100 -ac 1 -c:a pcm_f32le -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/round-2/work/chest.tell.epic-a.wav

ffmpeg -v error -y -i /home/djizus/projects/.reviewer-inbox/frontier-audio/round-2/work/chest.tell.epic-a.wav -af volume=14.8000dB,alimiter=limit=0.794328:level=false:latency=true,volume=0.0000dB,aresample=44100 -ar 44100 -ac 1 -c:a libmp3lame -b:a 160k -write_xing 1 -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/round-2/chest.tell.epic-a.mp3
```

## chest.burst

Runtime: `/sound/frontier/chest.burst.mp3`. 0.420 s, -18.5 LUFS short-term, -2.3 dBTP.

Wooden lid release with a short air burst; weight without an explosion.

SHA-256: `38cf0ed979808e20ad86fd5f947c5d441613ca94b34561961afafbe37d3096e8`.

Exact source paths relative to the Sonniss bundle root:

- `InMotionAudio - Wood/WOODImpt_Drops20_InMotionAudio_Wood.wav`
- `Rescopic Sound - Distinct Whooshes/WHSH_Airy-Whoosh Wind Gust 11_RSCPC_DW.wav`
- `Rescopic Sound - User Interaction/UIClick_Select Middle 29_RSCPC_USIN.wav`

Processing commands:

```sh
ffmpeg -hide_banner -v error -y -threads 1 -filter_complex_threads 1 -ss 0.04 -t 0.37 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/InMotionAudio - Wood/WOODImpt_Drops20_InMotionAudio_Wood.wav' -ss 1.22 -t 0.42 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Rescopic Sound - Distinct Whooshes/WHSH_Airy-Whoosh Wind Gust 11_RSCPC_DW.wav' -ss 0.02 -t 0.19 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Rescopic Sound - User Interaction/UIClick_Select Middle 29_RSCPC_USIN.wav' -filter_complex '[0:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=0.7491535:tempo=1:transients=mixed,atrim=duration=0.25,asetpts=PTS-STARTPTS,highpass=f=90,lowpass=f=4500,volume=-12.8382dB,afade=t=in:d=0.002,afade=t=out:st=0.220000:d=0.03,adelay=0:all=1[l0];[1:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,atrim=duration=0.3,asetpts=PTS-STARTPTS,highpass=f=450,lowpass=f=5800,volume=-28.3958dB,afade=t=in:d=0.002,afade=t=out:st=0.150000:d=0.15,adelay=0:all=1[l1];[2:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,atrim=duration=0.07,asetpts=PTS-STARTPTS,highpass=f=90,lowpass=f=8500,volume=-19.8794dB,afade=t=in:d=0.002,afade=t=out:st=0.040000:d=0.03,adelay=40:all=1[l2];[l0][l1][l2]amix=inputs=3:normalize=0,apad,atrim=duration=0.42,asetpts=PTS-STARTPTS[mix];[mix]silenceremove=start_periods=1:start_duration=0:start_threshold=-60dB:start_silence=0.001:detection=peak:window=0.001,apad,atrim=duration=0.42,afade=t=in:d=0.002,afade=t=out:st=0.395000:d=0.025[out]' -map '[out]' -ar 44100 -ac 1 -c:a pcm_f32le -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/work/chest.burst-b.wav

ffmpeg -v error -y -i /home/djizus/projects/.reviewer-inbox/frontier-audio/work/chest.burst-b.wav -af volume=17.7000dB,alimiter=limit=0.794328:level=false:latency=true,volume=0.0000dB,aresample=44100 -ar 44100 -ac 1 -c:a libmp3lame -b:a 160k -write_xing 1 -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/chest.burst-b.mp3
```

## coin.shower

Runtime: `/sound/frontier/coin.shower.mp3`. 0.880 s, -18.5 LUFS short-term, -2.1 dBTP.

Seven staggered pitched-metal contacts decay into a small treasure scatter.

SHA-256: `a8e2ea9603e859d6ebf5b07e43257c20e823578a71666f34cc2b9f4de6b4df0b`.

Exact source paths relative to the Sonniss bundle root:

- `Pole Position - The Metal Hit Sweeteners Library/Iron - Thick - HIT - Hammer.wav`
- `Sonic Bat - Videogame Foley Essentials Vol. II/SBvfe2_Glass 114.wav`

Processing commands:

```sh
ffmpeg -hide_banner -v error -y -threads 1 -filter_complex_threads 1 -ss 0.0 -t 0.3 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Pole Position - The Metal Hit Sweeteners Library/Iron - Thick - HIT - Hammer.wav' -ss 0.0 -t 0.3 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Pole Position - The Metal Hit Sweeteners Library/Iron - Thick - HIT - Hammer.wav' -ss 0.0 -t 0.3 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Pole Position - The Metal Hit Sweeteners Library/Iron - Thick - HIT - Hammer.wav' -ss 0.0 -t 0.3 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Pole Position - The Metal Hit Sweeteners Library/Iron - Thick - HIT - Hammer.wav' -ss 0.0 -t 0.3 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Pole Position - The Metal Hit Sweeteners Library/Iron - Thick - HIT - Hammer.wav' -ss 0.0 -t 0.3 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Pole Position - The Metal Hit Sweeteners Library/Iron - Thick - HIT - Hammer.wav' -ss 0.0 -t 0.3 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Pole Position - The Metal Hit Sweeteners Library/Iron - Thick - HIT - Hammer.wav' -ss 0.0 -t 0.47 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Sonic Bat - Videogame Foley Essentials Vol. II/SBvfe2_Glass 114.wav' -filter_complex '[0:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=2.0000000:tempo=1:transients=mixed,atrim=duration=0.18,asetpts=PTS-STARTPTS,highpass=f=1200,lowpass=f=7500,volume=-7.1370dB,afade=t=in:d=0.002,afade=t=out:st=0.060000:d=0.12,adelay=0:all=1[l0];[1:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=2.5198421:tempo=1:transients=mixed,atrim=duration=0.18,asetpts=PTS-STARTPTS,highpass=f=1200,lowpass=f=7500,volume=-8.7206dB,afade=t=in:d=0.002,afade=t=out:st=0.060000:d=0.12,adelay=55:all=1[l1];[2:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=2.9966142:tempo=1:transients=mixed,atrim=duration=0.18,asetpts=PTS-STARTPTS,highpass=f=1200,lowpass=f=7500,volume=-9.6357dB,afade=t=in:d=0.002,afade=t=out:st=0.060000:d=0.12,adelay=130:all=1[l2];[3:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=2.2449241:tempo=1:transients=mixed,atrim=duration=0.18,asetpts=PTS-STARTPTS,highpass=f=1200,lowpass=f=7500,volume=-11.1043dB,afade=t=in:d=0.002,afade=t=out:st=0.060000:d=0.12,adelay=230:all=1[l3];[4:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=3.3635857:tempo=1:transients=mixed,atrim=duration=0.18,asetpts=PTS-STARTPTS,highpass=f=1200,lowpass=f=7500,volume=-13.1576dB,afade=t=in:d=0.002,afade=t=out:st=0.060000:d=0.12,adelay=350:all=1[l4];[5:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=2.6696797:tempo=1:transients=mixed,atrim=duration=0.18,asetpts=PTS-STARTPTS,highpass=f=1200,lowpass=f=7500,volume=-15.8515dB,afade=t=in:d=0.002,afade=t=out:st=0.060000:d=0.12,adelay=490:all=1[l5];[6:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=4.0000000:tempo=1:transients=mixed,atrim=duration=0.18,asetpts=PTS-STARTPTS,highpass=f=1200,lowpass=f=7500,volume=-19.7774dB,afade=t=in:d=0.002,afade=t=out:st=0.060000:d=0.12,adelay=640:all=1[l6];[7:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=1.2599210:tempo=1:transients=mixed,atrim=duration=0.35,asetpts=PTS-STARTPTS,highpass=f=650,lowpass=f=6500,volume=5.1824dB,afade=t=in:d=0.002,afade=t=out:st=0.175000:d=0.175,adelay=60:all=1[l7];[l0][l1][l2][l3][l4][l5][l6][l7]amix=inputs=8:normalize=0,apad,atrim=duration=0.88,asetpts=PTS-STARTPTS[mix];[mix]silenceremove=start_periods=1:start_duration=0:start_threshold=-60dB:start_silence=0.001:detection=peak:window=0.001,apad,atrim=duration=0.88,afade=t=in:d=0.002,afade=t=out:st=0.855000:d=0.025[out]' -map '[out]' -ar 44100 -ac 1 -c:a pcm_f32le -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/work/coin.shower-b.wav

ffmpeg -v error -y -i /home/djizus/projects/.reviewer-inbox/frontier-audio/work/coin.shower-b.wav -af volume=26.5000dB,alimiter=limit=0.794328:level=false:latency=true,volume=0.0000dB,aresample=44100 -ar 44100 -ac 1 -c:a libmp3lame -b:a 160k -write_xing 1 -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/coin.shower-b.mp3
```

## card.deal

Runtime: `/sound/frontier/card.deal.mp3`. 0.250 s, -18.4 LUFS short-term, -2.3 dBTP.

A single papery flick; the frontend can stagger three deals.

SHA-256: `6643cb73a88040232717e919b40f7333903061528e18de989b6b68b69f2de07c`.

Exact source paths relative to the Sonniss bundle root:

- `Mechanical Wave - Cardboard and Paper/PAPRHndl_Paper Sheet Crumple_ 04_MWSFX_CDAP.wav`
- `CB Sounddesign - Activation 2/UIMvmt_UI Zooms 103_CB Soudndesign_ACTIVATION2.wav`

Processing commands:

```sh
ffmpeg -hide_banner -v error -y -threads 1 -filter_complex_threads 1 -ss 0.51 -t 0.31 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Mechanical Wave - Cardboard and Paper/PAPRHndl_Paper Sheet Crumple_ 04_MWSFX_CDAP.wav' -ss 0.04 -t 0.26 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/CB Sounddesign - Activation 2/UIMvmt_UI Zooms 103_CB Soudndesign_ACTIVATION2.wav' -filter_complex '[0:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=1.1892071:tempo=1:transients=mixed,atrim=duration=0.19,asetpts=PTS-STARTPTS,highpass=f=400,lowpass=f=5600,volume=-7.3417dB,afade=t=in:d=0.002,afade=t=out:st=0.135000:d=0.055,adelay=0:all=1[l0];[1:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=1.2599210:tempo=1:transients=mixed,atrim=duration=0.14,asetpts=PTS-STARTPTS,highpass=f=90,lowpass=f=4400,volume=-20.7910dB,afade=t=in:d=0.002,afade=t=out:st=0.110000:d=0.03,adelay=0:all=1[l1];[l0][l1]amix=inputs=2:normalize=0,apad,atrim=duration=0.25,asetpts=PTS-STARTPTS[mix];[mix]silenceremove=start_periods=1:start_duration=0:start_threshold=-60dB:start_silence=0.001:detection=peak:window=0.001,apad,atrim=duration=0.25,afade=t=in:d=0.002,afade=t=out:st=0.225000:d=0.025[out]' -map '[out]' -ar 44100 -ac 1 -c:a pcm_f32le -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/work/card.deal-b.wav

ffmpeg -v error -y -i /home/djizus/projects/.reviewer-inbox/frontier-audio/work/card.deal-b.wav -af volume=13.1000dB,alimiter=limit=0.794328:level=false:latency=true,volume=0.0000dB,aresample=44100 -ar 44100 -ac 1 -c:a libmp3lame -b:a 160k -write_xing 1 -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/card.deal-b.mp3
```

## card.pick

Runtime: `/sound/frontier/card.pick.mp3`. 0.480 s, -18.5 LUFS short-term, -6.8 dBTP.

Paper contact resolves into a warm confirmation as the card lands.

SHA-256: `c8aa90760448c65adfa0e5bf2dfc55fc04cd5145322216db33623c48e6b08283`.

Exact source paths relative to the Sonniss bundle root:

- `Mechanical Wave - Cardboard and Paper/PAPRHndl_Large Book Squeak Page Turn_ 01_MWSFX_CDAP.wav`
- `CB Sounddesign - Activation 2/UIMisc_Feedback 36 up_CB Sounddesign_ACTIVATION2.wav`
- `Mechanical Wave - Sound Effects Collection/BELLHand_Metallic Bell_ 22_MWSFX_SEC.wav`

Processing commands:

```sh
ffmpeg -hide_banner -v error -y -threads 1 -filter_complex_threads 1 -ss 1.68 -t 0.24 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Mechanical Wave - Cardboard and Paper/PAPRHndl_Large Book Squeak Page Turn_ 01_MWSFX_CDAP.wav' -ss 0.0 -t 0.48 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/CB Sounddesign - Activation 2/UIMisc_Feedback 36 up_CB Sounddesign_ACTIVATION2.wav' -ss 0.06 -t 0.4 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Mechanical Wave - Sound Effects Collection/BELLHand_Metallic Bell_ 22_MWSFX_SEC.wav' -filter_complex '[0:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,atrim=duration=0.12,asetpts=PTS-STARTPTS,highpass=f=450,lowpass=f=8500,volume=-9.0588dB,afade=t=in:d=0.002,afade=t=out:st=0.090000:d=0.03,adelay=0:all=1[l0];[1:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=1.1892071:tempo=1:transients=mixed,atrim=duration=0.36,asetpts=PTS-STARTPTS,highpass=f=90,lowpass=f=4500,volume=-10.7799dB,afade=t=in:d=0.002,afade=t=out:st=0.330000:d=0.03,adelay=35:all=1[l1];[2:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=1.3348399:tempo=1:transients=mixed,atrim=duration=0.28,asetpts=PTS-STARTPTS,highpass=f=650,lowpass=f=6500,volume=-19.1176dB,afade=t=in:d=0.002,afade=t=out:st=0.140000:d=0.14,adelay=110:all=1[l2];[l0][l1][l2]amix=inputs=3:normalize=0,apad,atrim=duration=0.48,asetpts=PTS-STARTPTS[mix];[mix]silenceremove=start_periods=1:start_duration=0:start_threshold=-60dB:start_silence=0.001:detection=peak:window=0.001,apad,atrim=duration=0.48,afade=t=in:d=0.002,afade=t=out:st=0.455000:d=0.025[out]' -map '[out]' -ar 44100 -ac 1 -c:a pcm_f32le -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/work/card.pick-a.wav

ffmpeg -v error -y -i /home/djizus/projects/.reviewer-inbox/frontier-audio/work/card.pick-a.wav -af volume=8.8000dB,alimiter=limit=0.794328:level=false:latency=true,volume=0.0000dB,aresample=44100 -ar 44100 -ac 1 -c:a libmp3lame -b:a 160k -write_xing 1 -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/card.pick-a.mp3
```

## xp.tick

Runtime: `/sound/frontier/xp.tick.mp3`. 0.064 s, -27.5 LUFS short-term, -13.0 dBTP.

Soft 64 ms tick; no overlap at 12 per second. Matched in the 12 Hz test context.

SHA-256: `0714754fffbc90729afc6a561e1f5ea9608aba52c3c4fc0d4375b2e2eb42e956`.

Exact source paths relative to the Sonniss bundle root:

- `CB Sounddesign - Activation 2/UIClick_UI Click 33_CB Sounddesign_ACTIVATION2.wav`
- `BluezoneCorp - Futuristic User Interface/Bluezone_BC0303_futuristic_user_interface_high_tech_beep_038.wav`

Processing commands:

```sh
ffmpeg -hide_banner -v error -y -threads 1 -filter_complex_threads 1 -ss 0.0 -t 0.16499999999999998 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/CB Sounddesign - Activation 2/UIClick_UI Click 33_CB Sounddesign_ACTIVATION2.wav' -ss 0.01 -t 0.16399999999999998 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/BluezoneCorp - Futuristic User Interface/Bluezone_BC0303_futuristic_user_interface_high_tech_beep_038.wav' -filter_complex '[0:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=1.3348399:tempo=1:transients=mixed,atrim=duration=0.045,asetpts=PTS-STARTPTS,highpass=f=350,lowpass=f=2800,volume=-7.0980dB,afade=t=in:d=0.002,afade=t=out:st=0.022000:d=0.023,adelay=0:all=1[l0];[1:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=1.4983071:tempo=1:transients=mixed,atrim=duration=0.044,asetpts=PTS-STARTPTS,highpass=f=550,lowpass=f=2400,volume=-30.5211dB,afade=t=in:d=0.002,afade=t=out:st=0.019000:d=0.025,adelay=0:all=1[l1];[l0][l1]amix=inputs=2:normalize=0,apad,atrim=duration=0.064,asetpts=PTS-STARTPTS[mix];[mix]silenceremove=start_periods=1:start_duration=0:start_threshold=-60dB:start_silence=0.001:detection=peak:window=0.001,apad,atrim=duration=0.064,afade=t=in:d=0.002,afade=t=out:st=0.048000:d=0.016[out]' -map '[out]' -ar 44100 -ac 1 -c:a pcm_f32le -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/work/xp.tick-a.wav

ffmpeg -v error -y -i /home/djizus/projects/.reviewer-inbox/frontier-audio/work/xp.tick-a.wav -af volume=9.5000dB,alimiter=limit=0.794328:level=false:latency=true,volume=0.0000dB,aresample=44100 -ar 44100 -ac 1 -c:a libmp3lame -b:a 160k -write_xing 1 -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/xp.tick-a.mp3
```

## resource.collect.essence

Runtime: `/sound/frontier/resource.collect.essence.mp3`. 0.540 s, -18.2 LUFS short-term, -2.3 dBTP.

A thin zap, glowing texture and fast filament tick make an electronic crystal arrival.

SHA-256: `8fefb5938a3b3e8eacfac83de6784c86fc856e4145e23aa104cab1e7fad0d86a`.

Exact source paths relative to the Sonniss bundle root:

- `Rescopic Sound - Parallax/SCIMisc_Zap Short 14_RSCPC_PX.wav`
- `BluezoneCorp - Alien Interface/Bluezone_BC0300_alien_interface_sci_fi_texture_003.wav`
- `CB Sounddesign - Activation 2/UIData_Counter mid 54_CB Sounddesign_ACTIVATION2.wav`

Processing commands:

```sh
ffmpeg -hide_banner -v error -y -threads 1 -filter_complex_threads 1 -ss 0.0 -t 0.35 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Rescopic Sound - Parallax/SCIMisc_Zap Short 14_RSCPC_PX.wav' -ss 0.35 -t 0.54 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/BluezoneCorp - Alien Interface/Bluezone_BC0300_alien_interface_sci_fi_texture_003.wav' -ss 1.95 -t 0.37 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/CB Sounddesign - Activation 2/UIData_Counter mid 54_CB Sounddesign_ACTIVATION2.wav' -filter_complex '[0:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=1.4983071:tempo=1:transients=mixed,atrim=duration=0.23,asetpts=PTS-STARTPTS,highpass=f=1600,lowpass=f=7300,volume=-17.9943dB,afade=t=in:d=0.002,afade=t=out:st=0.080000:d=0.15,adelay=0:all=1[l0];[1:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=2.0000000:tempo=1:transients=mixed,atrim=duration=0.42,asetpts=PTS-STARTPTS,highpass=f=1100,lowpass=f=6200,volume=-26.5854dB,afade=t=in:d=0.002,afade=t=out:st=0.200000:d=0.22,adelay=0:all=1[l1];[2:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=2.0000000:tempo=1:transients=mixed,atrim=duration=0.25,asetpts=PTS-STARTPTS,highpass=f=1400,lowpass=f=6000,volume=-11.0297dB,afade=t=in:d=0.002,afade=t=out:st=0.130000:d=0.12,adelay=75:all=1[l2];[l0][l1][l2]amix=inputs=3:normalize=0,apad,atrim=duration=0.54,asetpts=PTS-STARTPTS[mix];[mix]silenceremove=start_periods=1:start_duration=0:start_threshold=-60dB:start_silence=0.001:detection=peak:window=0.001,apad,atrim=duration=0.54,afade=t=in:d=0.002,afade=t=out:st=0.515000:d=0.025[out]' -map '[out]' -ar 44100 -ac 1 -c:a pcm_f32le -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/round-2/work/resource.collect.essence-c.wav

ffmpeg -v error -y -i /home/djizus/projects/.reviewer-inbox/frontier-audio/round-2/work/resource.collect.essence-c.wav -af volume=19.8000dB,alimiter=limit=0.794328:level=false:latency=true,volume=0.0000dB,aresample=44100 -ar 44100 -ac 1 -c:a libmp3lame -b:a 160k -write_xing 1 -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/round-2/resource.collect.essence-c.mp3
```

## resource.collect.labor

Runtime: `/sound/frontier/resource.collect.labor.mp3`. 0.341 s, -18.3 LUFS short-term, -2.4 dBTP.

A wooden tool contact and muted metal reward; distinct from Essence.

SHA-256: `6e915d1f0dd7a6d03ec4209c591a2f7d6f8c1d9ff07fe3ff25665c72a4ee67b2`.

Exact source paths relative to the Sonniss bundle root:

- `InMotionAudio - Wood/WOODImpt_Drops20_InMotionAudio_Wood.wav`
- `Pole Position - The Metal Hit Sweeteners Library/Iron - Thick - HIT - Hammer.wav`

Processing commands:

```sh
ffmpeg -hide_banner -v error -y -threads 1 -filter_complex_threads 1 -ss 0.04 -t 0.26 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/InMotionAudio - Wood/WOODImpt_Drops20_InMotionAudio_Wood.wav' -ss 0 -t 0.32999999999999996 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Pole Position - The Metal Hit Sweeteners Library/Iron - Thick - HIT - Hammer.wav' -filter_complex '[0:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=1.0594631:tempo=1:transients=mixed,atrim=duration=0.14,asetpts=PTS-STARTPTS,highpass=f=90,lowpass=f=2800,volume=-13.9980dB,afade=t=in:d=0.002,afade=t=out:st=0.110000:d=0.03,adelay=0:all=1[l0];[1:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=1.1224620:tempo=1:transients=mixed,atrim=duration=0.21,asetpts=PTS-STARTPTS,highpass=f=600,lowpass=f=4500,volume=-18.0910dB,afade=t=in:d=0.002,afade=t=out:st=0.090000:d=0.12,adelay=45:all=1[l1];[l0][l1]amix=inputs=2:normalize=0,apad,atrim=duration=0.34,asetpts=PTS-STARTPTS[mix];[mix]silenceremove=start_periods=1:start_duration=0:start_threshold=-60dB:start_silence=0.001:detection=peak:window=0.001,apad,atrim=duration=0.34,afade=t=in:d=0.002,afade=t=out:st=0.315000:d=0.025[out]' -map '[out]' -ar 44100 -ac 1 -c:a pcm_f32le -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/work/resource.collect.labor-b.wav

ffmpeg -v error -y -i /home/djizus/projects/.reviewer-inbox/frontier-audio/work/resource.collect.labor-b.wav -af volume=20.4000dB,alimiter=limit=0.794328:level=false:latency=true,volume=0.0000dB,aresample=44100 -ar 44100 -ac 1 -c:a libmp3lame -b:a 160k -write_xing 1 -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/resource.collect.labor-b.mp3
```

## site.discover

Runtime: `/sound/frontier/site.discover.mp3`. 0.850 s, -18.4 LUFS short-term, -3.6 dBTP.

A small upward reveal followed by a clear discovery accent.

SHA-256: `bc93e1bceee2a187eecd89b9c2115df8d11ad432d0ad9e9ae25ca32fb64abc50`.

Exact source paths relative to the Sonniss bundle root:

- `Rescopic Sound - User Interaction/UIMvmt_Window Open Thin 05_RSCPC_USIN.wav`
- `CB Sounddesign - Activation 2/UIMisc_Feedback 36 up_CB Sounddesign_ACTIVATION2.wav`
- `Mechanical Wave - Sound Effects Collection/BELLHand_Metallic Bell_ 22_MWSFX_SEC.wav`

Processing commands:

```sh
ffmpeg -hide_banner -v error -y -threads 1 -filter_complex_threads 1 -ss 0.0 -t 0.48 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Rescopic Sound - User Interaction/UIMvmt_Window Open Thin 05_RSCPC_USIN.wav' -ss 0.0 -t 0.68 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/CB Sounddesign - Activation 2/UIMisc_Feedback 36 up_CB Sounddesign_ACTIVATION2.wav' -ss 0.06 -t 0.55 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Mechanical Wave - Sound Effects Collection/BELLHand_Metallic Bell_ 22_MWSFX_SEC.wav' -filter_complex '[0:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=0.8408964:tempo=1:transients=mixed,atrim=duration=0.36,asetpts=PTS-STARTPTS,highpass=f=90,lowpass=f=3300,volume=-11.4576dB,afade=t=in:d=0.002,afade=t=out:st=0.330000:d=0.03,adelay=0:all=1[l0];[1:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,atrim=duration=0.56,asetpts=PTS-STARTPTS,highpass=f=90,lowpass=f=4400,volume=-9.5370dB,afade=t=in:d=0.002,afade=t=out:st=0.530000:d=0.03,adelay=55:all=1[l1];[2:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=2.0000000:tempo=1:transients=mixed,atrim=duration=0.43,asetpts=PTS-STARTPTS,highpass=f=650,lowpass=f=6500,volume=-17.1794dB,afade=t=in:d=0.002,afade=t=out:st=0.215000:d=0.215,adelay=240:all=1[l2];[l0][l1][l2]amix=inputs=3:normalize=0,apad,atrim=duration=0.85,asetpts=PTS-STARTPTS[mix];[mix]silenceremove=start_periods=1:start_duration=0:start_threshold=-60dB:start_silence=0.001:detection=peak:window=0.001,apad,atrim=duration=0.85,afade=t=in:d=0.002,afade=t=out:st=0.825000:d=0.025[out]' -map '[out]' -ar 44100 -ac 1 -c:a pcm_f32le -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/work/site.discover-a.wav

ffmpeg -v error -y -i /home/djizus/projects/.reviewer-inbox/frontier-audio/work/site.discover-a.wav -af volume=9.7000dB,alimiter=limit=0.794328:level=false:latency=true,volume=0.0000dB,aresample=44100 -ar 44100 -ac 1 -c:a libmp3lame -b:a 160k -write_xing 1 -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/site.discover-a.mp3
```

## site.clear

Runtime: `/sound/frontier/site.clear.mp3`. 1.050 s, -18.5 LUFS short-term, -2.4 dBTP.

A shield plants, low victory weight lands, and a ceremonial resonance settles. No discovery sweep.

SHA-256: `17b14797f3a1a94b110e481bd17419a9293b0b2b8fd0c15dc08bdcdc014a9b64`.

Exact source paths relative to the Sonniss bundle root:

- `Justsoundeffects - Melee Weapons/WEAPArmr_Metal Shield Block Hits_JSE_MW.wav`
- `Jake Fielding - Haunted Metal Vol.1 - Cinematic Hits & Impacts/DSGNBoom_Cinematic Metallic Hit, Boom, Trailer, Sub_JF_Haunted Metal Vol 1_02.wav`
- `Orbital Emitter - Cinematic Transitions for Editors Volume 2/80,TheGong.wav`

Processing commands:

```sh
ffmpeg -hide_banner -v error -y -threads 1 -filter_complex_threads 1 -ss 2.6 -t 0.42 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Justsoundeffects - Melee Weapons/WEAPArmr_Metal Shield Block Hits_JSE_MW.wav' -ss 0.81 -t 0.67 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Jake Fielding - Haunted Metal Vol.1 - Cinematic Hits & Impacts/DSGNBoom_Cinematic Metallic Hit, Boom, Trailer, Sub_JF_Haunted Metal Vol 1_02.wav' -ss 0.14 -t 0.97 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Orbital Emitter - Cinematic Transitions for Editors Volume 2/80,TheGong.wav' -filter_complex '[0:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=0.7937005:tempo=1:transients=mixed,atrim=duration=0.3,asetpts=PTS-STARTPTS,highpass=f=90,lowpass=f=4300,volume=-7.7117dB,afade=t=in:d=0.002,afade=t=out:st=0.270000:d=0.03,adelay=0:all=1[l0];[1:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=0.7491535:tempo=1:transients=mixed,atrim=duration=0.55,asetpts=PTS-STARTPTS,highpass=f=42,lowpass=f=340,volume=-18.9106dB,afade=t=in:d=0.002,afade=t=out:st=0.250000:d=0.3,adelay=0:all=1[l1];[2:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=1.3348399:tempo=1:transients=mixed,atrim=duration=0.85,asetpts=PTS-STARTPTS,highpass=f=150,lowpass=f=3100,volume=-16.7204dB,afade=t=in:d=0.002,afade=t=out:st=0.400000:d=0.45,adelay=110:all=1[l2];[l0][l1][l2]amix=inputs=3:normalize=0,apad,atrim=duration=1.05,asetpts=PTS-STARTPTS[mix];[mix]silenceremove=start_periods=1:start_duration=0:start_threshold=-60dB:start_silence=0.001:detection=peak:window=0.001,apad,atrim=duration=1.05,afade=t=in:d=0.002,afade=t=out:st=1.025000:d=0.025[out]' -map '[out]' -ar 44100 -ac 1 -c:a pcm_f32le -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/round-2/work/site.clear-a.wav

ffmpeg -v error -y -i /home/djizus/projects/.reviewer-inbox/frontier-audio/round-2/work/site.clear-a.wav -af volume=18.1000dB,alimiter=limit=0.794328:level=false:latency=true,volume=0.0000dB,aresample=44100 -ar 44100 -ac 1 -c:a libmp3lame -b:a 160k -write_xing 1 -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/round-2/site.clear-a.mp3
```

## building.upgrade

Runtime: `/sound/frontier/building.upgrade.mp3`. 0.750 s, -18.5 LUFS short-term, -1.4 dBTP.

Construction weight, a tool accent, then the bright new-tier settle.

SHA-256: `6588a72992a826b43c9ad8ba72fcb522c8b09a48c5a302c25fe06aaff531dfea`.

Exact source paths relative to the Sonniss bundle root:

- `InMotionAudio - Wood/WOODImpt_Drops20_InMotionAudio_Wood.wav`
- `Pole Position - The Metal Hit Sweeteners Library/Iron - Thick - HIT - Hammer.wav`
- `Sonic Bat - Videogame Foley Essentials Vol. II/SBvfe2_Glass 114.wav`

Processing commands:

```sh
ffmpeg -hide_banner -v error -y -threads 1 -filter_complex_threads 1 -ss 0.04 -t 0.31 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/InMotionAudio - Wood/WOODImpt_Drops20_InMotionAudio_Wood.wav' -ss 0 -t 0.38 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Pole Position - The Metal Hit Sweeteners Library/Iron - Thick - HIT - Hammer.wav' -ss 0.0 -t 0.56 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Sonic Bat - Videogame Foley Essentials Vol. II/SBvfe2_Glass 114.wav' -filter_complex '[0:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=0.8408964:tempo=1:transients=mixed,atrim=duration=0.19,asetpts=PTS-STARTPTS,highpass=f=90,lowpass=f=2400,volume=-16.9206dB,afade=t=in:d=0.002,afade=t=out:st=0.160000:d=0.03,adelay=0:all=1[l0];[1:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,atrim=duration=0.26,asetpts=PTS-STARTPTS,highpass=f=450,lowpass=f=3800,volume=-14.7412dB,afade=t=in:d=0.002,afade=t=out:st=0.230000:d=0.03,adelay=70:all=1[l1];[2:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=1.2599210:tempo=1:transients=mixed,atrim=duration=0.44,asetpts=PTS-STARTPTS,highpass=f=650,lowpass=f=6500,volume=11.9814dB,afade=t=in:d=0.002,afade=t=out:st=0.220000:d=0.22,adelay=190:all=1[l2];[l0][l1][l2]amix=inputs=3:normalize=0,apad,atrim=duration=0.75,asetpts=PTS-STARTPTS[mix];[mix]silenceremove=start_periods=1:start_duration=0:start_threshold=-60dB:start_silence=0.001:detection=peak:window=0.001,apad,atrim=duration=0.75,afade=t=in:d=0.002,afade=t=out:st=0.725000:d=0.025[out]' -map '[out]' -ar 44100 -ac 1 -c:a pcm_f32le -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/work/building.upgrade-b.wav

ffmpeg -v error -y -i /home/djizus/projects/.reviewer-inbox/frontier-audio/work/building.upgrade-b.wav -af volume=22.1000dB,alimiter=limit=0.794328:level=false:latency=true,volume=0.0000dB,aresample=44100 -ar 44100 -ac 1 -c:a libmp3lame -b:a 160k -write_xing 1 -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/building.upgrade-b.mp3
```

## research.unlock

Runtime: `/sound/frontier/research.unlock.mp3`. 0.850 s, -18.1 LUFS short-term, -2.5 dBTP.

Parchment and a rising confirmation, with shimmer as the next link lights.

SHA-256: `1904a4955a23b226dea7ea78b2819fb146d35e1c12998a885efe66fad657c0ad`.

Exact source paths relative to the Sonniss bundle root:

- `Mechanical Wave - Cardboard and Paper/PAPRHndl_Large Book Squeak Page Turn_ 01_MWSFX_CDAP.wav`
- `CB Sounddesign - Activation 2/UIMisc_Feedback 36 up_CB Sounddesign_ACTIVATION2.wav`
- `Mechanical Wave - Sound Effects Collection/BELLHand_Metallic Bell_ 22_MWSFX_SEC.wav`

Processing commands:

```sh
ffmpeg -hide_banner -v error -y -threads 1 -filter_complex_threads 1 -ss 1.68 -t 0.26 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Mechanical Wave - Cardboard and Paper/PAPRHndl_Large Book Squeak Page Turn_ 01_MWSFX_CDAP.wav' -ss 0.0 -t 0.69 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/CB Sounddesign - Activation 2/UIMisc_Feedback 36 up_CB Sounddesign_ACTIVATION2.wav' -ss 0.06 -t 0.6 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Mechanical Wave - Sound Effects Collection/BELLHand_Metallic Bell_ 22_MWSFX_SEC.wav' -filter_complex '[0:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,atrim=duration=0.14,asetpts=PTS-STARTPTS,highpass=f=450,lowpass=f=8500,volume=-13.4958dB,afade=t=in:d=0.002,afade=t=out:st=0.110000:d=0.03,adelay=0:all=1[l0];[1:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=1.3348399:tempo=1:transients=mixed,atrim=duration=0.57,asetpts=PTS-STARTPTS,highpass=f=90,lowpass=f=5000,volume=-10.7799dB,afade=t=in:d=0.002,afade=t=out:st=0.540000:d=0.03,adelay=25:all=1[l1];[2:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=2.6696797:tempo=1:transients=mixed,atrim=duration=0.48,asetpts=PTS-STARTPTS,highpass=f=650,lowpass=f=6500,volume=-13.0970dB,afade=t=in:d=0.002,afade=t=out:st=0.240000:d=0.24,adelay=180:all=1[l2];[l0][l1][l2]amix=inputs=3:normalize=0,apad,atrim=duration=0.85,asetpts=PTS-STARTPTS[mix];[mix]silenceremove=start_periods=1:start_duration=0:start_threshold=-60dB:start_silence=0.001:detection=peak:window=0.001,apad,atrim=duration=0.85,afade=t=in:d=0.002,afade=t=out:st=0.825000:d=0.025[out]' -map '[out]' -ar 44100 -ac 1 -c:a pcm_f32le -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/work/research.unlock-a.wav

ffmpeg -v error -y -i /home/djizus/projects/.reviewer-inbox/frontier-audio/work/research.unlock-a.wav -af volume=13.3000dB,alimiter=limit=0.794328:level=false:latency=true,volume=0.0000dB,aresample=44100 -ar 44100 -ac 1 -c:a libmp3lame -b:a 160k -write_xing 1 -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/research.unlock-a.mp3
```

## rank.up

Runtime: `/sound/frontier/rank.up.mp3`. 1.250 s, -18.4 LUFS short-term, -5.5 dBTP.

Three clean keyboard-derived fanfare stabs with a plucked upper finish; a compact tonal milestone.

SHA-256: `8fb0472390f492d2459437b3f914b2146df31633262cf85a7eb4ebae003b056e`.

Exact source paths relative to the Sonniss bundle root:

- `Used Bin Loops - Lo-Tech Premium Degraded Tape FX/UBL_Lo-Tech_70_one_shot_key_Amin.wav`
- `Rogue Waves - Metal Tensions/MUSCStngr_Whammy Bar Flutter, Clean_RogueWaves_MetalTensions.wav`

Processing commands:

```sh
ffmpeg -hide_banner -v error -y -threads 1 -filter_complex_threads 1 -ss 0.025 -t 0.3 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Used Bin Loops - Lo-Tech Premium Degraded Tape FX/UBL_Lo-Tech_70_one_shot_key_Amin.wav' -ss 0.025 -t 0.3 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Used Bin Loops - Lo-Tech Premium Degraded Tape FX/UBL_Lo-Tech_70_one_shot_key_Amin.wav' -ss 0.025 -t 0.75 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Used Bin Loops - Lo-Tech Premium Degraded Tape FX/UBL_Lo-Tech_70_one_shot_key_Amin.wav' -ss 0.025 -t 0.36 -i '/home/djizus/Downloads/Sonniss.com - GDC 2024 - Game Audio Bundle/Rogue Waves - Metal Tensions/MUSCStngr_Whammy Bar Flutter, Clean_RogueWaves_MetalTensions.wav' -filter_complex '[0:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,atrim=duration=0.18,asetpts=PTS-STARTPTS,highpass=f=200,lowpass=f=5300,volume=-14.7991dB,afade=t=in:d=0.008,afade=t=out:st=0.108000:d=0.072,adelay=0:all=1[l0];[1:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=1.4983071:tempo=1:transients=mixed,atrim=duration=0.18,asetpts=PTS-STARTPTS,highpass=f=200,lowpass=f=5300,volume=-14.7991dB,afade=t=in:d=0.008,afade=t=out:st=0.108000:d=0.072,adelay=220:all=1[l1];[2:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=2.0000000:tempo=1:transients=mixed,atrim=duration=0.63,asetpts=PTS-STARTPTS,highpass=f=200,lowpass=f=5300,volume=-14.7991dB,afade=t=in:d=0.008,afade=t=out:st=0.500000:d=0.13,adelay=450:all=1[l2];[3:a]aresample=44100,aformat=channel_layouts=mono,asetpts=PTS-STARTPTS,rubberband=pitch=2.0000000:tempo=1:transients=mixed,atrim=duration=0.24,asetpts=PTS-STARTPTS,highpass=f=900,lowpass=f=6200,volume=-3.0715dB,afade=t=in:d=0.002,afade=t=out:st=0.080000:d=0.16,adelay=450:all=1[l3];[l0][l1][l2][l3]amix=inputs=4:normalize=0,apad,atrim=duration=1.25,asetpts=PTS-STARTPTS[mix];[mix]silenceremove=start_periods=1:start_duration=0:start_threshold=-60dB:start_silence=0.001:detection=peak:window=0.001,apad,atrim=duration=1.25,afade=t=in:d=0.002,afade=t=out:st=1.225000:d=0.025[out]' -map '[out]' -ar 44100 -ac 1 -c:a pcm_f32le -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/round-2/work/rank.up-c.wav

ffmpeg -v error -y -i /home/djizus/projects/.reviewer-inbox/frontier-audio/round-2/work/rank.up-c.wav -af volume=8.6000dB,alimiter=limit=0.794328:level=false:latency=true,volume=0.0000dB,aresample=44100 -ar 44100 -ac 1 -c:a libmp3lame -b:a 160k -write_xing 1 -map_metadata -1 /home/djizus/projects/.reviewer-inbox/frontier-audio/round-2/rank.up-c.mp3
```
