// Animated launch screen of the installed app. It takes over from the
// phone's own splash (plain white + logo, built by Android from
// app/manifest.ts, which can't be animated) and starts from the same
// picture — white, mark in the center — so the hand-off is seamless, then
// comes alive for about two seconds before revealing the app.
//
// No React state or effect: LAUNCH_SCREEN_SCRIPT (app/layout.tsx) adds
// html.kx-launch-on before the first paint, and globals.css plays the whole
// sequence, exit included — the screen goes away on its own even if the
// page's JavaScript is slow. Hidden (display: none) everywhere else, and
// its images are lazy, so the website itself never downloads them.

// Installed app only (never the website in a browser tab), once per launch:
// sessionStorage lives as long as the app stays open.
export const LAUNCH_SCREEN_SCRIPT = `(function(){try{var a=window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;if(a&&!sessionStorage.getItem("kx-launched")){document.documentElement.classList.add("kx-launch-on");sessionStorage.setItem("kx-launched","1")}}catch(e){}})()`;

const PHOTOS = [
  { src: "/launch/photo-1.jpg", className: "kx-photo-1" },
  { src: "/launch/photo-2.jpg", className: "kx-photo-2" },
  { src: "/launch/photo-3.jpg", className: "kx-photo-3" },
];

export function LaunchScreen() {
  return (
    <div className="kx-launch" aria-hidden="true">
      <div className="kx-stage">
        <span className="kx-ring kx-ring-1" />
        <span className="kx-ring kx-ring-2" />
        {PHOTOS.map((photo) => (
          // eslint-disable-next-line @next/next/no-img-element -- tiny pre-cropped files from /public (public/sw.js caches them); next/image would add a server round trip to a screen that must show instantly
          <img
            key={photo.src}
            src={photo.src}
            alt=""
            width={64}
            height={64}
            loading="lazy"
            className={`kx-photo ${photo.className}`}
          />
        ))}
        {/* eslint-disable-next-line @next/next/no-img-element -- same as above */}
        <img
          src="/launch/mark.png"
          alt=""
          width={84}
          height={63}
          loading="lazy"
          className="kx-mark"
        />
        <div className="kx-text">
          <p className="kx-title">Kinetix Africa</p>
          <p className="kx-tagline">Formations · Mentorat · Communauté</p>
          <span className="kx-progress">
            <span />
          </span>
        </div>
      </div>
    </div>
  );
}
