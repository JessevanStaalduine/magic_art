
const trainMm = gsap.matchMedia();
const parts = document.querySelectorAll('#train .loco, #train .spoke, #train .wheel-rotator > *:not(.spoke), #train .loco_smoke, #train .wagon, #train .m_head, #train .m_body, #train .sleeper, #train .rail'); // alle losse onderdelen
const screenWidth = window.innerWidth;
const loadingScreen = document.querySelector("#train .loading-screen");
const scene = document.querySelector("#scene_wrapper");
const dots = document.querySelectorAll("#train .loading-screen .dot");
const wheels = document.querySelectorAll("#train .wheel-rotator");
const allRotators = document.querySelectorAll("#train .wheel-rotator");

// 🔥 Pak alle paths en draai volgorde om (links → rechts fix)
const signaturePaths = gsap.utils.toArray(".signature path").reverse();

let isSmallScreen = window.innerWidth < 1250;

// 🔥 Zet beginstatus (onzichtbaar)
signaturePaths.forEach(path => {
  const length = path.getTotalLength();

  gsap.set(path, {
    strokeDasharray: length,
    strokeDashoffset: length
  });
});

let signaturePlayed = false;

function animateSignature() {

  if (signaturePlayed) return;
  signaturePlayed = true;

  gsap.to(".signature", {
    opacity: 1,
    duration: 0.3
  });

gsap.fromTo(signaturePaths,
  {
    strokeDashoffset: (i, el) => el.getTotalLength()
  },
  {
    strokeDashoffset: 320,
    duration: 16,
    stagger: 0.05,
    ease: "power2.out"
  }
);

gsap.to(".signature path", {
  fillOpacity: 1,
  duration: 3.25,
  delay: 2, // wacht tot tekenen klaar is
  ease: "power1.inOut"
});

}

dots.forEach((dot, i) => {
  gsap.to(dot, {
    y: -5,               // puntje omhoog
    duration: 0.4,
    repeat: -1,           // oneindig herhalen
    yoyo: true,           // omhoog en terug
    ease: "power1.inOut",
    delay: i * 0.5        // stagger-effect zodat puntjes niet tegelijk bewegen
  });
});2
// start loading screen zichtbaar en scene invisible
gsap.set(scene, { opacity: 0 });
gsap.set(loadingScreen, { opacity: 1 });

// na 1 seconde (1000ms) fade-out loading screen en fade-in scene
setTimeout(() => {
  gsap.to(loadingScreen, {
    opacity: 0,
    duration: 0.8,
    ease: "power2.out",
    onComplete: () => {
      loadingScreen.style.display = "none"; // helemaal uit flow
      gsap.to(scene, {
        opacity: 1,
        duration: 0.8,
        ease: "power2.out"
      });
    }
  });
}, 1000);

function startWheelRotation() {

  console.log("=== startWheelRotation ===");
  console.log("Tweens wheel-rotator BEFORE start:", gsap.getTweensOf(".wheel-rotator"));
  console.log("Tweens wheel-rotator-big BEFORE start:", gsap.getTweensOf(".wheel-rotator-big"));
  console.log("Tweens coupler-wrapper BEFORE start:", gsap.getTweensOf(".coupler-wrapper"));

  // stop oude rotaties
  gsap.killTweensOf(".wheel-rotator");
  gsap.killTweensOf(".wheel-rotator-big");
  gsap.killTweensOf(".coupler-wrapper"); // 👈 NIEUW

  // loop over alle wielen
  allRotators.forEach(rotator => {

    let duration = 1.1; // kleine wielen
    if (rotator.classList.contains("wheel-rotator-big")) duration = 1.4;

    // wiel laten draaien
    gsap.to(rotator, {
      rotation: -360,
      duration: duration,
      ease: "none",
      repeat: -1
    });

    // 👉 alleen voor wheel 1: coupler tegengesteld draaien
    if (rotator.closest(".loco_wheel_1")) {

      const wrapper = rotator.querySelector(".coupler-wrapper");

      if (wrapper) {

        const startAngle = 0;

        gsap.set(wrapper, { rotation: startAngle });

        gsap.to(wrapper, {
          rotation: startAngle + 360,
          duration: duration,
          ease: "none",
          repeat: -1
        });
      }
    }

  });

  console.log("Tweens wheel-rotator AFTER start:", gsap.getTweensOf(".wheel-rotator"));
  console.log("Tweens wheel-rotator-big AFTER start:", gsap.getTweensOf(".wheel-rotator-big"));
  console.log("Tweens coupler-wrapper AFTER start:", gsap.getTweensOf(".coupler-wrapper"));
}

// Gebruik onChange zodat animatie telkens afgaat bij verandering
trainMm.add("(max-width: 1249px)", (context) => {
  // context.matches is true als deze query actief is
  if (context.matches) {
    gsap.to(".resize-hint", {
      x: 120,
      opacity: 0,
      duration: 2.5,
      ease: "power2.in"
    });
  }
});

trainMm.add("(min-width: 1250px)", (context) => {
  if (context.matches) {
    gsap.set(".resize-hint", { x: 120, opacity: 0 });
    gsap.to(".resize-hint", {
      x: 0,
      opacity: 1,
      duration: 1,
      ease: "power2.out"
    });
  }
});

function assembleTrain() {
  gsap.to(parts, {
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1,
    duration: 1.5,
    ease: "power2.out",
    onComplete: () => {

      // 👉 alleen op kleine schermen
      if (window.innerWidth < 1250) {
        document.querySelectorAll(".wheel").forEach(w => {
          console.log(w.className, "rotation =", gsap.getProperty(w, "rotation"));
        });
        gsap.set(".wheel-rotator, .wheel-rotator-big, .coupler-wrapper", {
          rotation: 0
        });
        startWheelRotation();
        signaturePlayed = false;
        animateSignature();
      }

    }
  });
}

function explodeParts() {
  console.log("=== explodeParts start ===");
  console.log("Tweens wheel-rotator BEFORE kill:", gsap.getTweensOf(".wheel-rotator"));
  console.log("Tweens wheel-rotator-big BEFORE kill:", gsap.getTweensOf(".wheel-rotator-big"));
  console.log("Tweens coupler BEFORE kill:", gsap.getTweensOf(".loco_wheel_coupler"));

  gsap.killTweensOf(".wheel-rotator");
  gsap.killTweensOf(".wheel-rotator-big");
  gsap.killTweensOf(".coupler-wrapper");

  console.log("Tweens wheel-rotator AFTER kill:", gsap.getTweensOf(".wheel-rotator"));
  console.log("Tweens wheel-rotator-big AFTER kill:", gsap.getTweensOf(".wheel-rotator-big"));
  console.log("Tweens coupler AFTER kill:", gsap.getTweensOf(".loco_wheel_coupler"));
  
  parts.forEach(part => {
    const randomX = gsap.utils.random(-180, 180);
    const randomY = gsap.utils.random(-140, 140);
    const randomRot = gsap.utils.random(-90, 90);

    gsap.to(part, {
      x: randomX,
      y: randomY,
      rotation: "+=" + randomRot,
      duration: 1.5,
      ease: "power2.inOut"
    });
  });
}

// init animatie op basis van schermbreedte
if (screenWidth >= 1250) {
  explodeParts();
} else {
  assembleTrain();
}

// optioneel: bij venster resize ook opnieuw checken
window.addEventListener('resize', () => {
  const nowSmall = window.innerWidth < 1250;

  // 👉 alleen iets doen als je breakpoint verandert
  if (nowSmall !== isSmallScreen) {
    isSmallScreen = nowSmall;

    if (nowSmall) {
      assembleTrain();   // klein scherm → animatie starten
    } else {
      gsap.set(".signature", { opacity: 0 });
      gsap.set(".signature path", { fillOpacity: 0 });
      signaturePlayed = false;

      explodeParts();    // groot scherm → explode
    }
  }
});

// breedte van één set (8 images × 450px)
const oneSetWidth = 450 * 8; // = 3600

// start met de extra set links buiten beeld
gsap.set(".background-loop", { x: -oneSetWidth });

// schuif de strip naar rechts tot x = 0, herhaal oneindig
gsap.to(".background-loop", {
  x: 0,
  duration: 12,
  ease: "none",
  repeat: -1
});

function updateBackgroundVisibility() {
  const background = document.querySelector("#train .background");

  if (window.innerWidth <= 1250) {
    // fade in subtiel
    gsap.to(background, { opacity: 1, duration: 1.5, ease: "power1.inOut" });
  } else {
    // fade out subtiel
    gsap.to(background, { opacity: 0, duration: 1.5, ease: "power1.inOut" });
  }
}

// init bij laden
updateBackgroundVisibility();

// check bij resize
window.addEventListener("resize", updateBackgroundVisibility);


gsap.set(".rails-loop", {
  x: "-100%"       // de extra rails staat nu links buiten beeld
});

gsap.to(".rails-loop", {
  x: "-3600px",   // helft van 7200 → na 3600px begint loop opnieuw
  duration: 12,
  ease: "none",
  repeat: -1
});

const smoke1 = document.querySelector("#train .smoke1");
const smoke2 = document.querySelector("#train .smoke2");
const smoke3 = document.querySelector("#train .smoke3");

// functie om rook te animeren
function animateSmoke(smoke, delay) {
  gsap.fromTo(
    smoke,
    { y: 0, x: 0, opacity: 1 },  // startpositie
    { 
      y: -60,                    // omhoog
      x: 40,                     // subtiele beweging naar rechts
      opacity: 0,                // langzaam vervagen
      duration: 1.3,               // animatie duurt 2 seconden
      repeat: -1,                // oneindig herhalen
      delay: delay,              // startvertraging voor stagger effect
      ease: "power1.out"         // zachte animatie
    }
  );
}

// start animaties met kleine vertragingen voor realistisch effect
animateSmoke(smoke1, 0);
animateSmoke(smoke2, 0.45);
animateSmoke(smoke3, 0.75);


