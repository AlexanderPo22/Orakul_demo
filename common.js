/* ===================================================================
   Оракул — общий скрипт для всех страниц (index / achievements / console / 404)
   Подключается ДО скрипта страницы: <script src="common.js"></script>

   Наружу отдаётся один объект — window.Orakul:
     Orakul.LIST / Orakul.TOTAL          — каталог достижений
     Orakul.has(id) / count() / unlock(id) / reset()
     Orakul.Snd.click() / orb() / air() / hover() / flip() / fanfare() / theme() ...
       (клики по ссылкам/кнопкам/карточкам = orb потише, по пустому месту = air)
     Orakul.theme.apply(name, animate) / toggle() / name()
     Orakul.store.get(key, fb) / set(key, value)
     Orakul.burst(el, n)                 — взрыв частиц из элемента
     Orakul.tilt.refresh()               — навесить эффект на новые карточки
     Orakul.toast(def) / dance(emoji) / whisper()
   =================================================================== */
(function (window, document) {
    'use strict';

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    /* ================= ХРАНИЛИЩЕ ================= */
    var K = {
        ach: 'orakul.achievements',
        cards: 'orakul.cards',
        logo: 'orakul.logoClicks',
        clicks: 'orakul.clicks',
        time: 'orakul.timeOnSite',
        theme: 'orakul.theme',
        sound: 'orakul.sound'
    };

    function get(key, fallback) {
        try {
            var raw = localStorage.getItem(key);
            if (raw === null) return fallback;
            return JSON.parse(raw);
        } catch (e) { return fallback; }
    }

    function set(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    }

    /* ================= КАТАЛОГ ДОСТИЖЕНИЙ ================= */
    var LIST = [
        { id: 'magic',         icon: '🔮', title: 'Магия!',
          hint: 'Источник силы Оракула любит внимание.' },
        { id: 'curious',       icon: '🃏', title: 'Любопытный',
          hint: 'Четыре двери в разделе тайн — открой их все.' },
        { id: 'melomaniac',    icon: '🎵', title: 'Меломан',
          hint: 'У любой мелодии есть выключатель. Он прячется в углу.' },
        { id: 'ready',         icon: '⬇️', title: 'Готов к бою',
          hint: 'Тот, кто решится на первый шаг, получит установщик.' },
        { id: 'codex',         icon: '💻', title: 'Кодекс',
          hint: 'Исходник лежит на виду у всех, кто смотрит в сторону кода.' },
        { id: 'nightwatch',    icon: '🌙', title: 'Ночной страж',
          hint: 'Иногда нужно заглянуть в самую бездну.' },
        { id: 'pastvoice',     icon: '👋', title: 'Голос из прошлого',
          hint: 'Пять прикосновений к имени — и прошлое ответит.' },
        { id: 'stormdance',    icon: '💃', title: 'Танец в буре',
          hint: 'Буря замечает тех, кто меняет направление. Трижды.' },
        { id: 'patient',       icon: '⏳', title: 'Терпеливый',
          hint: 'Пять минут тишины. Время копится даже между визитами.' },
        { id: 'lightspeed',    icon: '⚡', title: 'Скорость света',
          hint: 'Семь ударов сердца — и бездна позади. Не медли.' },
        { id: 'archaeologist', icon: '🏺', title: 'Археолог', secret: true,
          hint: 'В самом низу, между строк, кто-то оставил след. Не оборачивайся.' },
        { id: 'clicker',       icon: '🖱️', title: 'Кликер',
          hint: 'Сто прикосновений — и машина признает тебя своей.' },
        { id: 'hacker',        icon: '🖥️', title: 'Хакер', secret: true,
          hint: 'Слово, которое знает каждый страж Петли.' },
        { id: 'onepiece',      icon: '🏴‍☠️', title: 'Ван Пис', secret: true,
          hint: 'Имя, что ищут в конце Великой линии.' },
        { id: 'whatwasthat',   icon: '👁️', title: 'Что это было?', secret: true,
          hint: 'Кто-то выйдет на связь. Ответь — и узнаешь, что это было.' },
        { id: 'boss',          icon: '👔', title: 'На ковре у босса',
          hint: 'Начальство вызывает только тех, у кого есть доступ.' }
    ];

    var TOTAL = LIST.length;
    var byId = {};
    LIST.forEach(function (def) { byId[def.id] = def; });

    var achieved = get(K.ach, {});
    if (!achieved || typeof achieved !== 'object' || Array.isArray(achieved)) achieved = {};

    function has(id) { return !!achieved[id]; }

    /* Считаем только награды из каталога: старые или чужие ключи
       в localStorage не должны раздувать счётчик (например «17 / 16»). */
    function count() {
        var n = 0;
        for (var i = 0; i < LIST.length; i++) if (achieved[LIST[i].id]) n++;
        return n;
    }

    /* ================= ЗВУК (WebAudio, без файлов) ================= */
    var Snd = (function () {
        var ctx = null;
        var master = null;
        var on = true;
        var ambientStarted = false;
        var melodyTimer = null;
        var lastHover = 0;
        var lastCrackle = 0;
        var lastType = 0;
        var lastKey = 0;
        var lastOrb = 0;
        var lastAir = 0;

        try { if (localStorage.getItem(K.sound) === '0') on = false; } catch (e) {}

        function ensure() {
            if (!ctx) {
                var AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return null;
                try { ctx = new AC(); } catch (e) { return null; }
                master = ctx.createGain();
                master.gain.value = on ? 1 : 0;
                master.connect(ctx.destination);
            }
            if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
            return ctx;
        }

        function tone(freq, start, dur, type, peak, dest) {
            if (!ctx) return;
            var osc = ctx.createOscillator();
            var g = ctx.createGain();
            osc.type = type || 'sine';
            osc.frequency.setValueAtTime(freq, start);
            g.gain.setValueAtTime(0.0001, start);
            g.gain.exponentialRampToValueAtTime(peak || 0.1, start + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
            osc.connect(g).connect(dest || master);
            osc.start(start);
            osc.stop(start + dur + 0.03);
        }

        function noise(dur, shape, power) {
            var len = Math.max(64, Math.floor(ctx.sampleRate * dur));
            var buf = ctx.createBuffer(1, len, ctx.sampleRate);
            var d = buf.getChannelData(0);
            for (var i = 0; i < len; i++) {
                var env = shape === 'bell' ? Math.sin(Math.PI * (i / len)) : Math.pow(1 - i / len, power || 3);
                d[i] = (Math.random() * 2 - 1) * env;
            }
            var src = ctx.createBufferSource();
            src.buffer = buf;
            return src;
        }

        /* ---- фоновый гул + загадочная мелодия ---- */
        function start() {
            if (ambientStarted) return;
            var c = ensure();
            if (!c) return;
            ambientStarted = true;

            var now = c.currentTime;
            var bus = c.createGain();
            bus.gain.setValueAtTime(0.0001, now);
            bus.gain.exponentialRampToValueAtTime(0.055, now + 3.5);
            bus.connect(master);

            var lp = c.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 260;
            lp.Q.value = 0.6;
            lp.connect(bus);

            [55, 82.5, 110].forEach(function (f, i) {
                var osc = c.createOscillator();
                var g = c.createGain();
                osc.type = i === 2 ? 'triangle' : 'sine';
                osc.frequency.value = f + (Math.random() * 0.6 - 0.3);
                g.gain.value = i === 2 ? 0.22 : 0.4;
                osc.connect(g).connect(lp);
                osc.start(now);
            });

            var lfo = c.createOscillator();
            var lfoGain = c.createGain();
            lfo.type = 'sine';
            lfo.frequency.value = 0.06;
            lfoGain.gain.value = 70;
            lfo.connect(lfoGain).connect(lp.frequency);
            lfo.start(now);

            var air = noise(3, 'bell');
            air.loop = true;
            var airFilter = c.createBiquadFilter();
            airFilter.type = 'lowpass';
            airFilter.frequency.value = 420;
            var airGain = c.createGain();
            airGain.gain.value = 0.05;
            air.connect(airFilter).connect(airGain).connect(bus);
            air.start(now);

            /* эхо-мелодия */
            var delay = c.createDelay(1.5);
            delay.delayTime.value = 0.46;
            var fb = c.createGain();
            fb.gain.value = 0.38;
            var wet = c.createGain();
            wet.gain.value = 0.55;
            delay.connect(fb).connect(delay);
            delay.connect(wet).connect(bus);

            var melodyBus = c.createGain();
            melodyBus.gain.value = 1;
            melodyBus.connect(bus);
            melodyBus.connect(delay);

            function bell(freq, at, dur, peak) {
                var osc = c.createOscillator();
                var g = c.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, at);
                g.gain.setValueAtTime(0.0001, at);
                g.gain.exponentialRampToValueAtTime(peak, at + 0.03);
                g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
                osc.connect(g).connect(melodyBus);
                osc.start(at);
                osc.stop(at + dur + 0.05);
            }

            var motif = [220.00, 261.63, 329.63, 293.66, 392.00, 329.63, 261.63, 246.94];
            var step = 0;

            function playNote() {
                if (!on) return;
                var t = c.currentTime + 0.08;
                var f = motif[step % motif.length];
                step++;
                bell(f, t, 2.4, 0.05);
                bell(f * 2, t + 0.015, 1.6, 0.015);
                if (step % 4 === 0) bell(f * 1.5, t + 0.42, 1.8, 0.013);
            }

            setTimeout(playNote, 1200);
            melodyTimer = setInterval(playNote, 2600);
        }

        function isOn() { return on; }

        function setOn(value) {
            on = !!value;
            try { localStorage.setItem(K.sound, on ? '1' : '0'); } catch (e) {}
            // Не создаём AudioContext только ради того, чтобы выключить звук
            var c = on ? ensure() : ctx;
            if (c && master) {
                var t = c.currentTime;
                master.gain.cancelScheduledValues(t);
                master.gain.setValueAtTime(master.gain.value, t);
                master.gain.linearRampToValueAtTime(on ? 1 : 0, t + 0.25);
            }
            if (on) start();
            return on;
        }

        /* ---- обычный клик: тот же магический звук, что у шара, но тише ----
           Оставлен ради совместимости: раньше это был сухой щелчок. */
        function click(vol) {
            orb(vol == null ? 0.4 : vol);
        }

        /* ---- «пшшш»: короткий тихий выдох (клик по пустому месту) ----
           Шум с падающим фильтром, без тонов и арпеджио. */
        function air(vol) {
            if (!on) return;
            var c = ensure();
            if (!c) return;
            var now = c.currentTime;
            if (now - lastAir < 0.05) return;   // не наслаиваем выдохи
            lastAir = now;

            var v = vol == null ? 1 : vol;

            var src = noise(0.17, 'pow', 1.6);
            var bp = c.createBiquadFilter();
            bp.type = 'bandpass';
            bp.Q.value = 0.7;
            bp.frequency.setValueAtTime(3200, now);
            bp.frequency.exponentialRampToValueAtTime(1100, now + 0.15);

            var lp = c.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 4200;

            var g = c.createGain();
            g.gain.setValueAtTime(0.0001, now);
            g.gain.exponentialRampToValueAtTime(0.055 * v, now + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

            src.connect(bp).connect(lp).connect(g).connect(master);
            src.start(now);
        }

        /* ---- «вжух» при наведении на карточку ---- */
        function hover() {
            if (!on) return;
            var c = ensure();
            if (!c) return;
            var now = c.currentTime;
            if (now - lastHover < 0.09) return;
            lastHover = now;

            var src = noise(0.14, 'bell');
            var bp = c.createBiquadFilter();
            bp.type = 'bandpass';
            bp.Q.value = 1.6;
            bp.frequency.setValueAtTime(900, now);
            bp.frequency.exponentialRampToValueAtTime(2400, now + 0.12);
            var g = c.createGain();
            g.gain.value = 0.03;
            src.connect(bp).connect(g).connect(master);
            src.start(now);
        }

        /* ---- потрескивание (скролл, курсор) ---- */
        function crackle(strength) {
            if (!on) return;
            var c = ensure();
            if (!c) return;
            var now = c.currentTime;
            if (now - lastCrackle < 0.07) return;
            lastCrackle = now;

            var src = noise(0.02 + Math.random() * 0.03, 'pow', 2.2);
            var bp = c.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.value = 2600 + Math.random() * 3200;
            bp.Q.value = 3 + Math.random() * 6;
            var g = c.createGain();
            g.gain.value = 0.03 * (strength == null ? 1 : strength);
            src.connect(bp).connect(g).connect(master);
            src.start(now);
        }

        /* ---- тихий тик печатной машинки ---- */
        function type() {
            if (!on) return;
            var c = ensure();
            if (!c) return;
            var now = c.currentTime;
            if (now - lastType < 0.028) return;
            lastType = now;
            tone(1400 + Math.random() * 500, now, 0.02, 'square', 0.012);
        }

        /* ---- клик механической клавиатуры (ввод в консоли) ---- */
        function key() {
            if (!on) return;
            var c = ensure();
            if (!c) return;
            var now = c.currentTime;
            if (now - lastKey < 0.02) return;
            lastKey = now;

            // Сам щелчок: очень короткий шумовой всплеск
            var src = noise(0.016, 'pow', 5);
            var bp = c.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.value = 1700 + Math.random() * 1100;
            bp.Q.value = 1.5;
            var g = c.createGain();
            g.gain.value = 0.016;
            src.connect(bp).connect(g).connect(master);
            src.start(now);

            // «Тело» клавиши: едва слышный низкий стук
            tone(140 + Math.random() * 45, now, 0.045, 'triangle', 0.011);
        }

        /* ---- переворот карточки ---- */
        function flip(opening) {
            if (!on) return;
            var c = ensure();
            if (!c) return;
            var now = c.currentTime;
            var up = opening !== false;

            var src = noise(0.035, 'pow', 3);
            var nf = c.createBiquadFilter();
            nf.type = 'bandpass';
            nf.frequency.value = 2400;
            nf.Q.value = 0.9;
            var ng = c.createGain();
            ng.gain.value = 0.09;
            src.connect(nf).connect(ng).connect(master);
            src.start(now);

            var base = up ? 880 : 660;
            tone(base, now + 0.02, 0.22, 'sine', 0.1);
            tone(base * 1.5, now + 0.06, 0.34, 'sine', 0.07);
            tone(base * 2, now + 0.1, 0.2, 'triangle', 0.035);
        }

        /* ---- клик по магическому шару ----
           vol — общий множитель громкости: 1 для самого шара, ~0.4 для
           обычных кликов по ссылкам/кнопкам/карточкам. */
        function orb(vol) {
            if (!on) return;
            var c = ensure();
            if (!c) return;
            var now = c.currentTime;
            if (now - lastOrb < 0.07) return;   // не плодим узлы при частых кликах
            lastOrb = now;

            var v = vol == null ? 1 : vol;

            var boom = c.createOscillator();
            var bg = c.createGain();
            boom.type = 'sine';
            boom.frequency.setValueAtTime(180, now);
            boom.frequency.exponentialRampToValueAtTime(60, now + 0.35);
            bg.gain.setValueAtTime(0.0001, now);
            bg.gain.exponentialRampToValueAtTime(0.16 * v, now + 0.02);
            bg.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
            boom.connect(bg).connect(master);
            boom.start(now);
            boom.stop(now + 0.42);

            [880, 1108.73, 1318.51, 1760, 2217.46].forEach(function (f, i) {
                tone(f, now + 0.04 + i * 0.055, 0.5 - i * 0.05, 'sine', (0.075 - i * 0.008) * v);
            });
            tone(2637, now + 0.3, 0.55, 'triangle', 0.03 * v);

            var src = noise(0.4, 'pow', 2);
            var hp = c.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.value = 3200;
            var g = c.createGain();
            g.gain.value = 0.03 * v;
            src.connect(hp).connect(g).connect(master);
            src.start(now + 0.05);
        }

        /* ---- скачивание ---- */
        function download() {
            if (!on) return;
            var c = ensure();
            if (!c) return;
            var now = c.currentTime;
            tone(523.25, now, 0.16, 'sine', 0.14);
            tone(659.25, now + 0.08, 0.18, 'sine', 0.12);
            tone(783.99, now + 0.16, 0.26, 'sine', 0.1);
        }

        /* ---- фанфары достижения ---- */
        function fanfare() {
            if (!on) return;
            var c = ensure();
            if (!c) return;
            var now = c.currentTime;

            var lp = c.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 3600;
            lp.Q.value = 0.6;
            lp.connect(master);

            function brass(freq, at, dur, peak, type) {
                var osc = c.createOscillator();
                var g = c.createGain();
                osc.type = type || 'sawtooth';
                osc.frequency.setValueAtTime(freq, at);
                g.gain.setValueAtTime(0.0001, at);
                g.gain.exponentialRampToValueAtTime(peak, at + 0.03);
                g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
                osc.connect(g).connect(lp);
                osc.start(at);
                osc.stop(at + dur + 0.03);
            }

            var notes = [523.25, 659.25, 783.99, 1046.50];
            notes.forEach(function (f, i) {
                brass(f, now + i * 0.10, 0.30, 0.05);
                brass(f * 2, now + i * 0.10, 0.22, 0.018, 'triangle');
            });
            notes.forEach(function (f) { brass(f, now + 0.44, 0.85, 0.032); });

            var src = noise(0.5, 'pow', 3);
            var hp = c.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.value = 5200;
            var g = c.createGain();
            g.gain.value = 0.022;
            src.connect(hp).connect(g).connect(master);
            src.start(now + 0.05);
        }

        /* ---- смена дня и ночи: птицы / сверчки ---- */
        function theme(light) {
            if (!on) return;
            var c = ensure();
            if (!c) return;
            var now = c.currentTime;

            if (light) {
                for (var i = 0; i < 6; i++) {
                    var t = now + 0.05 + i * 0.13 + Math.random() * 0.06;
                    var f0 = 1900 + Math.random() * 900;
                    var osc = c.createOscillator();
                    var g = c.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(f0, t);
                    osc.frequency.exponentialRampToValueAtTime(f0 * 1.5, t + 0.07);
                    osc.frequency.exponentialRampToValueAtTime(f0 * 1.12, t + 0.11);
                    g.gain.setValueAtTime(0.0001, t);
                    g.gain.exponentialRampToValueAtTime(0.03, t + 0.02);
                    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
                    osc.connect(g).connect(master);
                    osc.start(t);
                    osc.stop(t + 0.14);
                }
                var wind = noise(0.9, 'bell');
                var hp = c.createBiquadFilter();
                hp.type = 'highpass';
                hp.frequency.value = 2600;
                var wg = c.createGain();
                wg.gain.value = 0.018;
                wind.connect(hp).connect(wg).connect(master);
                wind.start(now);
            } else {
                for (var b = 0; b < 4; b++) {
                    var base = now + 0.05 + b * 0.30;
                    for (var k = 0; k < 4; k++) {
                        var ct = base + k * 0.042;
                        var osc2 = c.createOscillator();
                        var g3 = c.createGain();
                        osc2.type = 'square';
                        osc2.frequency.value = 4200 + Math.random() * 400;
                        g3.gain.setValueAtTime(0.0001, ct);
                        g3.gain.exponentialRampToValueAtTime(0.012, ct + 0.004);
                        g3.gain.exponentialRampToValueAtTime(0.0001, ct + 0.028);
                        osc2.connect(g3).connect(master);
                        osc2.start(ct);
                        osc2.stop(ct + 0.035);
                    }
                }
                var low = c.createOscillator();
                var lg = c.createGain();
                low.type = 'sine';
                low.frequency.setValueAtTime(150, now);
                low.frequency.exponentialRampToValueAtTime(70, now + 0.9);
                lg.gain.setValueAtTime(0.0001, now);
                lg.gain.exponentialRampToValueAtTime(0.05, now + 0.1);
                lg.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);
                low.connect(lg).connect(master);
                low.start(now);
                low.stop(now + 1.05);
            }
        }

        /* ---- короткий сигнал «доступа» для консоли ---- */
        function beep(freq, peak, dur) {
            if (!on) return;
            var c = ensure();
            if (!c) return;
            tone(freq || 880, c.currentTime, dur || 0.12, 'square', peak || 0.03);
        }

        return {
            isOn: isOn, setOn: setOn, start: start,
            click: click, hover: hover, crackle: crackle, air: air, type: type, key: key,
            flip: flip, orb: orb, download: download, fanfare: fanfare,
            theme: theme, beep: beep
        };
    })();

    /* ================= УВЕДОМЛЕНИЯ / ЭФФЕКТЫ ================= */
    function toastHost() {
        var host = document.getElementById('toastHost');
        if (!host) {
            host = document.createElement('div');
            host.className = 'toast-host';
            host.id = 'toastHost';
            host.setAttribute('aria-live', 'polite');
            document.body.appendChild(host);
        }
        return host;
    }

    function toast(def) {
        var host = toastHost();

        var el = document.createElement('div');
        el.className = 'toast';

        var icon = document.createElement('span');
        icon.className = 'toast-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = def.icon;

        var body = document.createElement('span');
        body.className = 'toast-body';

        var kicker = document.createElement('span');
        kicker.className = 'toast-kicker';
        kicker.textContent = 'Достижение получено';

        var title = document.createElement('span');
        title.className = 'toast-title';
        title.textContent = def.title;

        body.appendChild(kicker);
        body.appendChild(title);

        var counter = document.createElement('span');
        counter.className = 'toast-count';
        counter.textContent = count() + ' / ' + TOTAL;

        el.appendChild(icon);
        el.appendChild(body);
        el.appendChild(counter);
        host.appendChild(el);

        while (host.children.length > 3) host.removeChild(host.firstChild);

        setTimeout(function () {
            el.classList.add('is-out');
            setTimeout(function () { if (el.parentNode) el.remove(); }, 450);
        }, 4200);
    }

    function dance(emoji) {
        var el = document.createElement('div');
        el.className = 'dance-emoji';
        el.textContent = emoji || '💃';
        el.setAttribute('aria-hidden', 'true');
        document.body.appendChild(el);
        setTimeout(function () { el.remove(); }, 2800);
    }

    function whisper() {
        var el = document.createElement('div');
        el.className = 'whisper';
        el.setAttribute('role', 'status');
        el.textContent = '«Эстафета принята. Я присмотрю.»';

        var sign = document.createElement('em');
        sign.textContent = '— Старый Кодер';
        el.appendChild(sign);

        document.body.appendChild(el);
        requestAnimationFrame(function () { el.classList.add('is-on'); });
        setTimeout(function () {
            el.classList.remove('is-on');
            setTimeout(function () { el.remove(); }, 600);
        }, 5200);
    }

    function unlock(id) {
        var def = byId[id];
        if (!def || achieved[id]) return false;

        achieved[id] = Date.now();
        set(K.ach, achieved);
        toast(def);
        Snd.fanfare();

        if (id === 'stormdance') dance('💃');
        if (id === 'onepiece') dance('🏴‍☠️');
        if (id === 'pastvoice') whisper();

        document.dispatchEvent(new CustomEvent('orakul:unlock', { detail: { id: id, def: def } }));
        return true;
    }

    function reset() {
        try {
            localStorage.removeItem(K.ach);
            localStorage.removeItem(K.cards);
            localStorage.removeItem(K.logo);
            localStorage.removeItem(K.clicks);
            localStorage.removeItem(K.time);
        } catch (e) {}
        achieved = {};
        document.dispatchEvent(new CustomEvent('orakul:sync', { detail: { reason: 'reset' } }));
    }

    /* ================= ТЕМА ================= */
    var theme = (function () {
        var btn = null;
        var icon = null;

        function ensureVeil() {
            var veil = document.getElementById('themeVeil');
            if (!veil) {
                veil = document.createElement('div');
                veil.className = 'theme-veil';
                veil.id = 'themeVeil';
                veil.setAttribute('aria-hidden', 'true');
                document.body.appendChild(veil);
            }
            return veil;
        }

        function name() {
            return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
        }

        function apply(next, animate) {
            var root = document.documentElement;

            if (animate) {
                root.classList.add('theme-fade');
                setTimeout(function () { root.classList.remove('theme-fade'); }, 750);

                var veil = ensureVeil();
                veil.classList.remove('is-on', 'is-day', 'is-night');
                veil.classList.add(next === 'light' ? 'is-day' : 'is-night');
                void veil.offsetWidth;
                veil.classList.add('is-on');
            }

            if (next === 'light') root.setAttribute('data-theme', 'light');
            else root.removeAttribute('data-theme');

            var meta = document.querySelector('meta[name="theme-color"]');
            if (meta) meta.setAttribute('content', next === 'light' ? '#f7f4ff' : '#0f0c1b');

            // Пишем строкой, без JSON: этот же ключ читает pre-paint скрипт
            // в <head>, ему нужен ровно 'light', а не '"light"'.
            try { localStorage.setItem(K.theme, next); } catch (e) {}
            sync();
        }

        function sync() {
            if (!btn) return;
            var light = name() === 'light';
            if (icon) icon.textContent = light ? '☀️' : '🌙';
            btn.setAttribute('aria-pressed', light ? 'true' : 'false');
            btn.setAttribute('aria-label', light ? 'Включить тёмную тему' : 'Включить светлую тему');
        }

        function toggle() {
            var next = name() === 'light' ? 'dark' : 'light';
            if (btn) {
                btn.classList.remove('is-swapping');
                void btn.offsetWidth;
                btn.classList.add('is-swapping');
                setTimeout(function () { if (icon) icon.textContent = next === 'light' ? '☀️' : '🌙'; }, 250);
                setTimeout(function () { btn.classList.remove('is-swapping'); }, 660);
            }
            apply(next, true);
            Snd.theme(next === 'light');
        }

        function init() {
            btn = document.getElementById('themeToggle');
            icon = document.getElementById('themeIcon');
            if (!btn) return;
            sync();
            btn.addEventListener('click', toggle);
        }

        return { name: name, apply: apply, sync: sync, toggle: toggle, init: init };
    })();

    /* ================= КНОПКА ЗВУКА ================= */
    function initSoundToggle() {
        var btn = document.getElementById('soundToggle');
        if (!btn) {
            btn = document.createElement('button');
            btn.className = 'sound-toggle';
            btn.id = 'soundToggle';
            btn.type = 'button';
            btn.innerHTML = '<span class="dot" aria-hidden="true"></span><span id="soundLabel"></span>';
            document.body.appendChild(btn);
        }
        var label = document.getElementById('soundLabel');

        function sync() {
            btn.setAttribute('aria-pressed', Snd.isOn() ? 'true' : 'false');
            if (label) label.textContent = Snd.isOn() ? '🔊 Звук вкл' : '🔇 Звук выкл';
        }

        sync();
        btn.addEventListener('click', function () {
            Snd.setOn(!Snd.isOn());
            sync();
            if (Snd.isOn()) { Snd.start(); Snd.flip(true); }
            unlock('melomaniac');
        });

        ['pointerdown', 'keydown', 'touchstart'].forEach(function (evt) {
            document.addEventListener(evt, function () { Snd.start(); }, { once: true, passive: true });
        });
    }

    /* ================= КАСТОМНЫЙ КУРСОР ================= */
    function initCursor() {
        if (!finePointer || reduceMotion) return;

        var glow = document.getElementById('cursorGlow');
        if (!glow) {
            glow = document.createElement('div');
            glow.className = 'cursor-glow';
            glow.id = 'cursorGlow';
            glow.setAttribute('aria-hidden', 'true');
            document.body.appendChild(glow);
        }

        var orb = document.getElementById('cursorOrb');
        if (!orb) {
            orb = document.createElement('div');
            orb.className = 'cursor-orb';
            orb.id = 'cursorOrb';
            orb.setAttribute('aria-hidden', 'true');
            orb.textContent = '🔮';
            document.body.appendChild(orb);
        }

        document.documentElement.classList.add('has-cursor');

        var cur = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        var target = { x: cur.x, y: cur.y };
        var scale = 1;
        var scaleTarget = 1;
        var ticking = false;
        var ROT = -15;

        function loop() {
            ticking = false;
            cur.x += (target.x - cur.x) * 0.22;
            cur.y += (target.y - cur.y) * 0.22;
            scale += (scaleTarget - scale) * 0.18;

            orb.style.transform = 'translate3d(' + cur.x.toFixed(1) + 'px,' + cur.y.toFixed(1) + 'px,0) ' +
                'rotate(' + ROT + 'deg) scale(' + scale.toFixed(3) + ')';
            glow.style.transform = 'translate3d(' + cur.x.toFixed(1) + 'px,' + cur.y.toFixed(1) + 'px,0)';

            if (Math.abs(target.x - cur.x) > 0.4 || Math.abs(target.y - cur.y) > 0.4 ||
                Math.abs(scaleTarget - scale) > 0.002) {
                requestAnimationFrame(loop);
            }
        }

        function kick() {
            if (!ticking) { ticking = true; requestAnimationFrame(loop); }
        }

        window.addEventListener('pointermove', function (e) {
            if (e.pointerType === 'touch') return;
            target.x = e.clientX;
            target.y = e.clientY;
            orb.classList.add('is-on');
            glow.classList.add('is-on');
            kick();
        }, { passive: true });

        // mouseleave на document не всплывает и срабатывает не везде —
        // ловим уход курсора за пределы окна через mouseout без relatedTarget.
        document.addEventListener('mouseout', function (e) {
            if (e.relatedTarget) return;
            orb.classList.remove('is-on');
            glow.classList.remove('is-on');
        });

        var hoverables = 'a, button, .clickable, [role="button"]';
        document.addEventListener('pointerover', function (e) {
            var hit = e.target.closest && e.target.closest(hoverables);
            if (!hit) return;
            // Переход между детьми той же кнопки — не новый ховер
            var from = e.relatedTarget && e.relatedTarget.closest
                ? e.relatedTarget.closest(hoverables) : null;
            if (from === hit) return;
            scaleTarget = 1.3;
            kick();
            Snd.crackle(0.5);
        }, { passive: true });

        document.addEventListener('pointerout', function (e) {
            if (e.target.closest && e.target.closest(hoverables)) {
                scaleTarget = 1;
                kick();
            }
        }, { passive: true });
    }

    /* ================= ПЛАВАЮЩИЕ ЧАСТИЦЫ ================= */
    function initParticles() {
        if (reduceMotion) return;
        if (document.querySelector('.fx-particles')) return;

        var wrap = document.createElement('div');
        wrap.className = 'fx-particles';
        wrap.setAttribute('aria-hidden', 'true');

        var total = window.innerWidth < 720 ? 16 : 30;

        for (var i = 0; i < total; i++) {
            var p = document.createElement('span');
            var star = i % 5 === 0;
            p.className = 'fx-particle' + (star ? ' is-star' : '');
            if (star) p.textContent = '✦';

            p.style.left = (Math.random() * 100).toFixed(2) + '%';
            p.style.animationDelay = (Math.random() * 16).toFixed(2) + 's';
            p.style.animationDuration = (16 + Math.random() * 20).toFixed(1) + 's';
            p.style.setProperty('--drift', (Math.random() * 120 - 60).toFixed(0) + 'px');
            if (!star) {
                var size = 2 + Math.random() * 3;
                p.style.width = size.toFixed(1) + 'px';
                p.style.height = size.toFixed(1) + 'px';
                p.style.opacity = '0';
            } else {
                p.style.fontSize = (7 + Math.random() * 6).toFixed(0) + 'px';
            }
            wrap.appendChild(p);
        }

        document.body.appendChild(wrap);
    }

    /* ================= STEAM-ЭФФЕКТ ================= */
    var tilt = (function () {
        var MAX = 14;      // максимальный наклон, градусы
        var SCALE = 1.1;   // «сильное» увеличение
        var SELECTOR = '.card, .flip, .ach, [data-tilt]';

        function attach(el) {
            if (el.dataset.tiltReady === '1') return;
            el.dataset.tiltReady = '1';
            el.classList.add('tilt');

            var rect = null;
            var enterScroll = 0;
            var active = false;

            function setTilt(rx, ry, s) {
                el.style.transform =
                    'perspective(1000px) rotateX(' + rx.toFixed(2) + 'deg) ' +
                    'rotateY(' + ry.toFixed(2) + 'deg) scale(' + s.toFixed(3) + ')';
            }

            el.addEventListener('pointerenter', function (e) {
                if (e.pointerType === 'touch') return;
                rect = el.getBoundingClientRect();
                enterScroll = window.pageYOffset;   // запоминаем прокрутку
                active = true;
                el.classList.remove('is-returning');
                el.classList.add('is-tilting');
                setTilt(0, 0, SCALE);
                Snd.hover();
            });

            el.addEventListener('pointermove', function (e) {
                if (!active || e.pointerType === 'touch') return;
                if (!rect) rect = el.getBoundingClientRect();

                // Карточка могла уехать при прокрутке — сдвигаем сохранённый
                // прямоугольник на дельту скролла (без лишних layout-чтений).
                var top = rect.top - (window.pageYOffset - enterScroll);

                var nx = (e.clientX - rect.left) / rect.width - 0.5;
                var ny = (e.clientY - top) / rect.height - 0.5;

                // Наклон строго за курсором, без задержек
                setTilt(-ny * MAX * 2, nx * MAX * 2, SCALE);
            }, { passive: true });

            el.addEventListener('pointerleave', function () {
                if (!active) return;
                active = false;
                el.classList.add('is-returning');
                setTilt(0, 0, 1);
                setTimeout(function () {
                    if (active) return;
                    el.classList.remove('is-returning');
                    el.classList.remove('is-tilting');
                    el.style.transform = '';
                }, 480);
            });
        }

        function refresh(root) {
            if (!finePointer || reduceMotion) return;
            var scope = root || document;
            Array.prototype.forEach.call(scope.querySelectorAll(SELECTOR), attach);
        }

        return { refresh: refresh, attach: attach };
    })();

    /* ================= ВЗРЫВ ЧАСТИЦ ================= */
    function burst(el, amount) {
        if (!el || reduceMotion) return;
        var n = amount || 14;
        for (var i = 0; i < n; i++) {
            (function (i) {
                var spark = document.createElement('span');
                spark.className = 'burst-spark';
                var angle = (Math.PI * 2 * i) / n + Math.random() * 0.5;
                var dist = 55 + Math.random() * 70;
                spark.style.setProperty('--dx', (Math.cos(angle) * dist).toFixed(0) + 'px');
                spark.style.setProperty('--dy', (Math.sin(angle) * dist).toFixed(0) + 'px');
                spark.style.animationDelay = (Math.random() * 60).toFixed(0) + 'ms';
                el.appendChild(spark);
                setTimeout(function () { spark.remove(); }, 1000);
            })(i);
        }
    }

    /* ================= ЗВУК КЛИКА ПО «ПУСТОМУ МЕСТУ» ================= */
    // Ссылки, кнопки и карточки озвучивают сами страницы (магический орб),
    // а здесь — только фон: клик по пустому месту даёт тихое «пшшш».
    var SILENT_TARGETS = 'a, button, [role="button"], .flip, .ach, .term, ' +
                         'input, textarea, select, label, [data-no-click-sound]';

    function initClickSound() {
        document.addEventListener('click', function (e) {
            if (e.button) return;
            var el = e.target;
            if (!el || el.nodeType !== 1) return;
            if (el.closest(SILENT_TARGETS)) return;
            // Карточки звучат как кнопки, остальной фон — тихим выдохом
            if (el.closest('.card')) { Snd.orb(0.4); return; }
            Snd.air(0.8);
        });
    }

    /* ================= ВСПЫШКА ПРИ КЛИКЕ ================= */
    function spawnFlash(x, y) {
        var el = document.createElement('span');
        el.className = 'click-flash';
        el.setAttribute('aria-hidden', 'true');
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        document.body.appendChild(el);
        setTimeout(function () { el.remove(); }, 380);
    }

    function initClickFlash() {
        if (reduceMotion) return;

        document.addEventListener('pointerdown', function (e) {
            if (e.button !== undefined && e.button !== 0) return;
            var x = e.clientX;
            var y = e.clientY;

            // Клавиатурный «клик» без координат — вспышка по центру элемента
            if (!x && !y && e.target && e.target.getBoundingClientRect) {
                var r = e.target.getBoundingClientRect();
                x = r.left + r.width / 2;
                y = r.top + r.height / 2;
            }
            if (!x && !y) return;

            spawnFlash(x, y);
        }, { passive: true });
    }

    /* ================= ПЛАВНАЯ ПРОКРУТКА (инерционная лента) ================= */
    var scroll = (function () {
        var enabled = false;
        var target = 0;
        var current = 0;
        var running = false;
        var lastSet = -1;   // последняя позиция, которую выставили мы сами

        function maxScroll() {
            return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        }

        function clamp(v) {
            return Math.max(0, Math.min(maxScroll(), v));
        }

        function applyY(y) {
            lastSet = y;
            window.scrollTo(0, y);
        }

        function loop() {
            current += (target - current) * 0.16;
            if (Math.abs(target - current) < 0.4) {
                current = target;
                running = false;
                applyY(current);
                return;
            }
            applyY(current);
            requestAnimationFrame(loop);
        }

        /* Прокрутить к позиции. Если лента выключена (тач / reduce-motion) —
           работает обычная плавная прокрутка браузера. */
        function to(y) {
            if (!enabled) {
                window.scrollTo({ top: clamp(y), behavior: reduceMotion ? 'auto' : 'smooth' });
                return;
            }
            target = clamp(y);
            current = window.pageYOffset;
            if (!running) {
                running = true;
                requestAnimationFrame(loop);
            }
        }

        function init() {
            if (reduceMotion || !finePointer) return;
            enabled = true;

            target = current = window.pageYOffset;
            lastSet = current;

            // Своя прокрутка узнаётся по совпадению с последней выставленной
            // позицией. Раньше флаг «я только что скроллил» терялся, если
            // браузер не присылал scroll (позиция не изменилась), и тогда
            // первое настоящее событие молча проглатывалось.
            window.addEventListener('scroll', function () {
                var y = window.pageYOffset;
                if (Math.abs(y - lastSet) < 1.5) return;
                target = current = y;
            }, { passive: true });

            window.addEventListener('wheel', function (e) {
                // Внутри своих скролл-контейнеров (например, тело консоли)
                // колесо не перехватываем
                var el = e.target;
                while (el && el.nodeType === 1 && el !== document.body && el !== document.documentElement) {
                    var style = window.getComputedStyle(el);
                    if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1) return;
                    el = el.parentElement;
                }
                if (e.ctrlKey) return;

                e.preventDefault();

                var delta = e.deltaY;
                if (e.deltaMode === 1) {
                    delta *= 32;
                } else if (e.deltaMode === 2) {
                    delta *= window.innerHeight;
                }
                delta = Math.max(-260, Math.min(260, delta));
                to(target + delta);
            }, { passive: false });

            window.addEventListener('keydown', function (e) {
                if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
                var el = e.target;
                var tag = (el && el.tagName) || '';
                // Не перехватываем клавиши у полей ввода и интерактивных
                // элементов: пробел на кнопке обязан нажимать кнопку.
                if (/^(INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY)$/.test(tag)) return;
                if (el && el.isContentEditable) return;
                var vh = window.innerHeight;
                var handled = true;
                switch (e.key) {
                    case 'PageDown': to(window.pageYOffset + vh * 0.9); break;
                    case 'PageUp':   to(window.pageYOffset - vh * 0.9); break;
                    case 'Home':     to(0); break;
                    case 'End':      to(maxScroll()); break;
                    case ' ':
                        if (e.shiftKey) to(window.pageYOffset - vh * 0.9);
                        else to(window.pageYOffset + vh * 0.9);
                        break;
                    default: handled = false;
                }
                if (handled) e.preventDefault();
            });
        }

        return { to: to, init: init, isOn: function () { return enabled; } };
    })();

    /* ================= АКТИВНОСТЬ: клики и время ================= */
    function watchActivity() {
        var clicks = get(K.clicks, 0);
        if (typeof clicks !== 'number' || !isFinite(clicks)) clicks = 0;

        document.addEventListener('click', function () {
            if (clicks >= 100) return;          // уже открыто — не пишем зря
            clicks += 1;
            if (clicks % 10 === 0) set(K.clicks, clicks);
            if (clicks >= 100) unlock('clicker');
        });

        var time = get(K.time, 0);
        if (typeof time !== 'number' || !isFinite(time)) time = 0;

        if (time >= 300) unlock('patient');

        var timer = setInterval(function () {
            if (document.hidden) return;
            time += 5;
            set(K.time, time);
            if (time >= 300) {
                unlock('patient');
                clearInterval(timer);   // дальше считать нечего
            }
        }, 5000);
    }

    /* ================= ИНИЦИАЛИЗАЦИЯ ================= */
    function init() {
        // Синхронизация между вкладками: награда, полученная в одной,
        // сразу видна в другой
        window.addEventListener('storage', function (e) {
            if (e.key && e.key !== K.ach) return;
            var next = get(K.ach, {});
            achieved = (next && typeof next === 'object' && !Array.isArray(next)) ? next : {};
            document.dispatchEvent(new CustomEvent('orakul:sync', { detail: { reason: 'storage' } }));
        });

        initSoundToggle();
        theme.init();
        initCursor();
        initParticles();
        initClickSound();
        initClickFlash();
        scroll.init();
        tilt.refresh();
        watchActivity();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /* ================= ЭКСПОРТ ================= */
    window.Orakul = {
        LIST: LIST,
        TOTAL: TOTAL,
        has: has,
        count: count,
        unlock: unlock,
        reset: reset,
        toast: toast,
        dance: dance,
        whisper: whisper,
        burst: burst,
        flash: spawnFlash,
        Snd: Snd,
        theme: theme,
        scroll: scroll,
        tilt: tilt,
        store: { get: get, set: set, keys: K },
        reduceMotion: reduceMotion,
        finePointer: finePointer
    };
})(window, document);
