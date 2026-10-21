// Homepage sky: the Archive starfield behind the page, plus gold shooting stars and the odd slow comet.
// Needs <canvas class="stars" id="stars"> as the first child of <body>; it only shows through transparent sections.
(function() {
  var c = document.getElementById('stars');
  if (!c || !c.getContext) return;
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ctx = c.getContext('2d');
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var w = 0, h = 0, stars = [], flyers = [], nextShot = 0, nextComet = 0, lastT = 0, raf = 0;

  function seed() {
    var n = Math.min(240, Math.round(w * h / 7000));
    stars = [];
    for (var i = 0; i < n; i++) {
      var r = Math.random();
      stars.push({
        x: Math.random() * w, y: Math.random() * h, z: 0.2 + Math.random() * 0.8,
        r: r < 0.92 ? 0.3 + Math.random() * 1.0 : 1.2 + Math.random() * 1.2,
        p: Math.random() * 6.283, s: 0.4 + Math.random() * 1.4,
        c: r > 0.94 ? '224,184,64' : (r > 0.86 ? '109,200,130' : '228,237,229')
      });
    }
  }
  function size() {
    var nw = window.innerWidth, nh = window.innerHeight, reseed = nw !== w;
    w = nw; h = nh;
    c.width = w * dpr; c.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (reseed) seed();
  }

  // Shooting star: fast, short gold streak. Comet: slow, glowing head, long gold-to-green tail.
  function launch(comet) {
    var fromLeft = Math.random() < 0.5, dir = fromLeft ? 1 : -1;
    var speed = comet ? 1.1 + Math.random() * 0.6 : 5 + Math.random() * 3;
    var ang = (comet ? 0.18 : 0.35) + Math.random() * 0.25;
    flyers.push({
      comet: comet,
      x: fromLeft ? w * Math.random() * 0.4 : w * (0.6 + Math.random() * 0.4),
      y: h * Math.random() * (comet ? 0.5 : 0.35),
      vx: dir * speed * Math.cos(ang), vy: speed * Math.sin(ang),
      life: 0, max: comet ? 420 + Math.random() * 180 : 60 + Math.random() * 20,
      tail: comet ? 70 : 16
    });
  }
  function drawFlyer(f) {
    // Fade in over the first tenth, out over the last third.
    var k = f.life / f.max, a = Math.min(1, k * 10) * Math.min(1, (1 - k) * 3);
    var tx = f.x - f.vx * f.tail, ty = f.y - f.vy * f.tail;
    var g = ctx.createLinearGradient(f.x, f.y, tx, ty);
    if (f.comet) {
      g.addColorStop(0, 'rgba(246,230,191,' + (0.8 * a).toFixed(3) + ')');
      g.addColorStop(0.25, 'rgba(224,184,64,' + (0.45 * a).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(109,200,130,0)');
      ctx.lineWidth = 2.4;
    } else {
      g.addColorStop(0, 'rgba(224,184,64,' + (0.9 * a).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(224,184,64,0)');
      ctx.lineWidth = 1.5;
    }
    ctx.strokeStyle = g; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(tx, ty); ctx.stroke();
    if (f.comet) {
      var glow = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 9);
      glow.addColorStop(0, 'rgba(255,248,225,' + (0.95 * a).toFixed(3) + ')');
      glow.addColorStop(0.35, 'rgba(224,184,64,' + (0.35 * a).toFixed(3) + ')');
      glow.addColorStop(1, 'rgba(224,184,64,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(f.x, f.y, 9, 0, 6.283); ctx.fill();
    }
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    var sy = window.scrollY || 0;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var y = (s.y - sy * s.z * 0.12) % h; if (y < 0) y += h;
      var a = still ? 0.6 * s.z : (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 0.001 * s.s + s.p))) * s.z;
      ctx.fillStyle = 'rgba(' + s.c + ',' + a.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(s.x, y, s.r, 0, 6.283); ctx.fill();
    }
    if (still) return;
    if (t > nextShot) { launch(false); nextShot = t + 3500 + Math.random() * 6000; }
    if (t > nextComet) { if (nextComet) launch(true); nextComet = t + 18000 + Math.random() * 16000; }
    // Move by elapsed time in 60fps frames, so 120/144Hz screens don't run the flyers fast.
    var k = lastT ? Math.min(4, (t - lastT) / 16.667) : 1;
    lastT = t;
    for (var j = flyers.length - 1; j >= 0; j--) {
      var f = flyers[j];
      f.life += k; f.x += f.vx * k; f.y += f.vy * k;
      if (f.life > f.max) { flyers.splice(j, 1); continue; }
      drawFlyer(f);
    }
  }
  function loop(t) { draw(t); raf = document.hidden ? 0 : requestAnimationFrame(loop); }
  var rt;
  window.addEventListener('resize', function() { clearTimeout(rt); rt = setTimeout(function() { size(); if (still) draw(0); }, 120); });
  size();
  if (still) {
    draw(0);
    window.addEventListener('scroll', function() { draw(0); }, { passive: true });
  } else {
    nextShot = 1500; nextComet = 6000;
    raf = requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', function() { if (!document.hidden && !raf) { lastT = 0; raf = requestAnimationFrame(loop); } });
  }
})();
