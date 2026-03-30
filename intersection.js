

/*prompt: he gpt, hoe is het? ik ga vandaag weer verder werken aan mijn front-end project: "responsive art". 
ik ben een kruispunt vanaf bovenaanzicht aan het maken met html, css en Javascript. 
de term "responsive art" slaat op het effect dat ik het hele kruispunt laten "exploden" met JS GSAP. dit laat ik dan gebeuren vanaf bijvoorbeeld 1024px schermbreedte en groter.  
zodat op groot scherm het één grote chaos is van losse elementen. en zodra je het scherm kleiner maakt wordt het een werkend kruispunt. 
ik probeer hier tijdens het project al zoveel mogelijk rekening mee te houden. 
dus bijvoorbeeld extra wrappers in html, om daar dan de CSS transform op te zetten, zodat ik GSAP explode kan zetten op de children.  
zodat dit niet kan gaan botsen met GSAP explode.  
en ook mijn html heb ik zo proberen op te bouwen zodat alles straks mooi als losse elementen kan exploden.
ik heb maar voor 2 elementen png's gebruikt. voor de voertuigen en de palmbomen. voor de rest heb ik alles met css opgebouwd. 
ik ga je nu zo eerst even mijn html, css en Javascript files sturen, zodat je kan zien hoever ik ben en hoe alles gestructureerd en opgebouwd is.
*/

/*
Wereld 1 → "Functioneel kruispunt"

Cars bewegen
Stoplichten werken
Alles positioneel correct

Wereld 2 → "Exploded chaos"

Animatie staat stil
Cars stoppen met spawnen
Alles krijgt willekeurige x/y/rotation via GSAP
*/

/*Een suggestie voor het explode effect:
  In plaats van random chaos:

  Wegen breken eerst in 4 stukken
  Dan pas exploderen lanes
  Dan pas yield triangles
  Dan pas cars
  Dan pas traffic lights

  Dus gefaseerde destructie.
*/


// ==============================
// TRAFFIC LIGHT SETUP
// ==============================

const DEBUG = false;

const carsLayer = document.querySelector("#intersection-scene .cars_layer");
const intersection = document.getElementById('intersection');

const STOP_DISTANCE = 160; // pixels vóór kruispunt
const MIN_CAR_DISTANCE = 50;

const ORANGE_DECISION_MARGIN = 40;

const ORANGE_GREEN_WINDOW = 1000;

let carSpawner;
let animationRunning = true;

let animationFrameId = null;

let currentPhase = 0;

let phaseTimers = [];

const spawnOffset = 60;
const fadeDistance = 50;

const offset = 100;

const intersectionWidth = carsLayer.offsetWidth;
const intersectionHeight = carsLayer.offsetHeight;

// ------------------------------
// Helpers
// ------------------------------



function isOrangeGreenWindow(light) {
    const elapsed = performance.now() - light.orangeStartTime;
    return elapsed < ORANGE_GREEN_WINDOW;
}

function getAutoBounds() {
  return {
    left: -offset,
    right: intersectionWidth + offset,
    top: -offset,
    bottom: intersectionHeight + offset
  };
}

function getDistanceToIntersection(car) {
  const centerX = intersection.offsetWidth / 2;
  const centerY = intersection.offsetHeight / 2;

  if (car.axis === "vertical") {
    if (car.direction === "forward") {
      return centerY - car.y - car.height;
    } else {
      return car.y - centerY;
    }
  } else {
    if (car.direction === "forward") {
      return centerX - car.x - car.width;
    } else {
      return car.x - centerX;
    }
  }
}

function getCarAhead(car) {
  const lane = lanes[car.laneKey];
  if (!lane || lane.length < 2) return null;

  let carAhead = null;
  let smallestDistance = Infinity;

  for (const other of lane) {
    if (other === car) continue;

    let distance;

    if (car.axis === "vertical") {
      distance =
        car.direction === "forward"
          ? other.y - car.y
          : car.y - other.y;
    } else {
      distance =
        car.direction === "forward"
          ? other.x - car.x
          : car.x - other.x;
    }

    if (distance > 0 && distance < smallestDistance) {
      smallestDistance = distance;
      carAhead = other;
    }
  }

  return carAhead;
}

function normalizeMovement(movement, axis, position) {
  const shouldFlip =
    (axis === 'vertical' && position === 'top') ||
    (axis === 'horizontal' && position === 'right');

  if (!shouldFlip) return movement;

  if (movement === 'left') return 'right';
  if (movement === 'right') return 'left';
  return movement;
}

function resetAllLights() {
  trafficLights.forEach(light => setLightState(light, 'red'));
}

function clearPhaseTimers() {
  phaseTimers.forEach(timer => clearTimeout(timer));
  phaseTimers = [];
}

function getLaneKey(axis, direction, turn = null) {
  let key = `${axis}_${direction}`;

  if (turn) {
    key += `_${turn}`;
  }

  return key;
}

function startLoop() {
  lastTime = performance.now();
  animationRunning = true;
  animationFrameId = requestAnimationFrame(tick);
}

function stopLoop() {
  animationRunning = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

function registerCar(car) {
  cars.push(car);
  checkTrafficLight(car);

  const laneKey = getLaneKey(car.axis, car.direction, car.turn);

  car.laneKey = laneKey;
  lanes[laneKey].push(car);

    /*console.log(
      "REGISTER:",
      car.laneKey,
      "lane size:",
      lanes[car.laneKey].length
    );*/
  

  // ✅ Debug alleen voor de eerste auto van elke lane
  /*if (!car.logged) {
    console.log(`SPAWN: axis=${car.axis}, direction=${car.direction}, x=${car.x}, y=${car.y}, laneKey=${laneKey}, stopDistance=${STOP_DISTANCE}`);
    car.logged = true;
  }*/
}

// Alle rechtdoor testcases
const straightCars = [
  { axis: 'vertical', direction: 'forward' },
  { axis: 'vertical', direction: 'backward' },
  { axis: 'horizontal', direction: 'forward' },
  { axis: 'horizontal', direction: 'backward' }
];

const rightTurnCars = [
  { axis: 'vertical', direction: 'forward', turn: 'right' },
  { axis: 'vertical', direction: 'backward', turn: 'right' },
  { axis: 'horizontal', direction: 'forward', turn: 'right' },
  { axis: 'horizontal', direction: 'backward', turn: 'right' }
];

const leftTurnCars = [
  { axis: 'vertical', direction: 'forward', turn: 'left' },
  { axis: 'vertical', direction: 'backward', turn: 'left' },
  { axis: 'horizontal', direction: 'forward', turn: 'left' },
  { axis: 'horizontal', direction: 'backward', turn: 'left' }
];

const allCars = [
  ...straightCars,
  ...rightTurnCars,
  ...leftTurnCars
];

function startCarSpawner() {
  stopCarSpawner();

  carSpawner = setInterval(() => {
    if (!animationRunning || isExploded) return;

    const config = allCars[currentIndex];

    // 🔹 Check of het de verticale forward auto is
    if (config.axis === 'vertical' && config.direction === 'forward') {
      setTimeout(() => {
        createCar(config); // maak en registreer direct binnen createCar
      }, 50); // 50ms delay voor deze auto
    } else {
      createCar(config); // alle andere auto's gewoon meteen
    }

    currentIndex = (currentIndex + 1) % allCars.length;
  }, 600);
}

function stopCarSpawner() {
  clearInterval(carSpawner);
}


function updateCarState(car, delta) {
  // 0️⃣ Check stoplicht
  const light = getTrafficLightForLane(car.laneKey);

    if (!light) return;

    // Traffic light decision first and final
    checkTrafficLight(car);

  const carAhead = getCarAhead(car);

      if (carAhead) {
        const distance =
          car.axis === "vertical"
            ? Math.abs(carAhead.y - car.y) - carAhead.height
            : Math.abs(carAhead.x - car.x) - carAhead.width;

        const safeDistance = 45;

        if (distance < safeDistance) {
          car.state = "stopping";
        }
      }

  // 1️⃣ Bepaal snelheid op basis van state
  if (car.state === "driving") {
    car.currentSpeed += car.acceleration * delta * 60;
    if (car.currentSpeed > car.maxSpeed) car.currentSpeed = car.maxSpeed;
  }
  else if (car.state === "stopping") {
    car.currentSpeed -= car.deceleration * delta * 60;
    if (car.currentSpeed < 0) car.currentSpeed = 0;
  }
  else if (car.state === "waiting") {
    car.currentSpeed = 0;
  }
}

function updateCarMovement(car, delta) {

  const distance = getDistanceToIntersection(car);

  // ==============================
  // TURN TRIGGERS
  // ==============================

  // 🔹 Rechtsaf trigger
  if (
    car.turn === "right" &&
    !car.hasTurned &&
    !car.isTurning &&
    distance <= 105
  ) {
    car.isTurning = true;
    car.turnStartRotation = car.rotation;
    car.targetRotation = car.rotation + 90;
    // console.log("RIGHT TURN START:", car.laneKey);
  }

  // 🔹 Linksaf trigger
  if (
    car.turn === "left" &&
    !car.hasTurned &&
    !car.isTurning &&
    distance <= 30
  ) {
    car.isTurning = true;
    car.turnStartRotation = car.rotation;
    car.targetRotation = car.rotation - 90;
    // console.log("LEFT TURN START:", car.laneKey);
  }

  // ==============================
  // TURN UPDATE
  // ==============================

  let effectiveSpeed = car.currentSpeed;

  if (car.isTurning) {

    let turnSpeed;
    let MAX_LATERAL_OFFSET;
    let turnDirection; // 1 = clockwise, -1 = counter-clockwise

    if (car.turn === "right") {
      effectiveSpeed *= 0.6;
      turnSpeed = 93;
      MAX_LATERAL_OFFSET = 1;
      turnDirection = 1;

    } else if (car.turn === "left") {
      effectiveSpeed *= 0.65;     // iets meer vertraging 
      turnSpeed = 44;             // langzamere rotatie 
      MAX_LATERAL_OFFSET = 1.75;   // grotere radius  
      turnDirection = -1;

    } else {
      turnSpeed = 0;
      MAX_LATERAL_OFFSET = 0;
      turnDirection = 1;
    }

    car.rotation += turnSpeed * delta * turnDirection;

    // Progress berekenen (werkt voor beide richtingen)
    let turnProgress =
      Math.abs(car.rotation - car.turnStartRotation) / 90;

    turnProgress = Math.max(0, Math.min(1, turnProgress));

    const lateralOffset = turnProgress * MAX_LATERAL_OFFSET;

    // Offset toepassen
    if (car.axis === "vertical") {

      const directionSign =
        car.direction === "forward" ? -1 : 1;

      car.x += lateralOffset * directionSign * turnDirection;

    } else {

      const directionSign =
        car.direction === "forward" ? 1 : -1;

      car.y += lateralOffset * directionSign * turnDirection;
    }

    // ==============================
    // TURN COMPLETE
    // ==============================

    const turnFinished =
      car.turn === "right"
        ? car.rotation >= car.targetRotation
        : car.rotation <= car.targetRotation;

    if (turnFinished) {

      car.rotation = car.targetRotation;
      car.isTurning = false;
      car.hasTurned = true;

      const oldLaneKey = car.laneKey;

      // 🔹 Axis/direction mapping

      if (car.turn === "right") {

        // Clockwise
        if (car.axis === "vertical" && car.direction === "forward") {
          car.axis = "horizontal";
          car.direction = "backward";
        }
        else if (car.axis === "vertical" && car.direction === "backward") {
          car.axis = "horizontal";
          car.direction = "forward";
        }
        else if (car.axis === "horizontal" && car.direction === "forward") {
          car.axis = "vertical";
          car.direction = "forward";
        }
        else if (car.axis === "horizontal" && car.direction === "backward") {
          car.axis = "vertical";
          car.direction = "backward";
        }

      } else if (car.turn === "left") {

        // Counter-clockwise
        if (car.axis === "vertical" && car.direction === "forward") {
          car.axis = "horizontal";
          car.direction = "forward";
        }
        else if (car.axis === "vertical" && car.direction === "backward") {
          car.axis = "horizontal";
          car.direction = "backward";
        }
        else if (car.axis === "horizontal" && car.direction === "forward") {
          car.axis = "vertical";
          car.direction = "backward";
        }
        else if (car.axis === "horizontal" && car.direction === "backward") {
          car.axis = "vertical";
          car.direction = "forward";
        }
      }

      const newLaneKey = getLaneKey(car.axis, car.direction, car.turn);
      car.laneKey = newLaneKey;

      const oldLane = lanes[oldLaneKey];
      if (oldLane) {
        const index = oldLane.indexOf(car);
        if (index !== -1) {
          oldLane.splice(index, 1);
        }
      }

      lanes[newLaneKey].push(car);

      // console.log("TURN COMPLETE:", oldLaneKey, "→", newLaneKey);
    }
  }

  // ==============================
  // NORMALE BEWEGING
  // ==============================

  const moveDistance = effectiveSpeed * delta;

  if (car.axis === "vertical") {
    car.y += moveDistance * (car.direction === "forward" ? 1 : -1);
  } else {
    car.x += moveDistance * (car.direction === "forward" ? 1 : -1);
  }

  car.element.style.transform =
    `translate(${car.x}px, ${car.y}px) rotate(${car.rotation}deg)`;

  // spawn/exit fade
  let opacity = 1;

  if (car.axis === 'vertical') {
    if (car.direction === 'forward') {
      if (car.y < 0) opacity = (car.y + 60) / 60;
      else if (car.y > intersection.offsetHeight - car.height)
        opacity = 1 - ((car.y - (intersection.offsetHeight - car.height)) / 60);
    } else {
      if (car.y > intersection.offsetHeight - car.height)
        opacity = (intersection.offsetHeight - car.y) / 60;
      else if (car.y < 0)
        opacity = 1 - ((0 - car.y) / 60);
    }
  }

  if (car.axis === 'horizontal') {
    if (car.direction === 'forward') {
      if (car.x < 0) opacity = (car.x + 60) / 60;
      else if (car.x > intersection.offsetWidth - car.width)
        opacity = 1 - ((car.x - (intersection.offsetWidth - car.width)) / 60);
    } else {
      if (car.x > intersection.offsetWidth - car.width)
        opacity = (intersection.offsetWidth - car.x) / 60;
      else if (car.x < 0)
        opacity = 1 - ((0 - car.x) / 60);
    }
  }

  car.element.style.opacity = Math.max(0, Math.min(1, opacity));
}

function checkTrafficLight(car) {
  const distance = getDistanceToIntersection(car);
  const light = getTrafficLightForLane(car.laneKey);

  if (!light) return;

  const stopDistance = STOP_DISTANCE;

  if (distance <= 0) {
    car.state = "driving";
    return;
  }

  // 🔴 RED LIGHT
  if (light.state === "red") {

    const STOP_LINE = 121;

    if (distance <= STOP_LINE) {
      car.state = "driving";
      return;
    }

    if (distance <= stopDistance) {
      car.state = "stopping";
    } else {
      car.state = "driving";
    }
  }

  // 🟠 ORANGE LIGHT
  else if (light.state === "orange") {

    const elapsed = performance.now() - light.orangeStartTime;

    if (elapsed < ORANGE_GREEN_WINDOW) {
      car.state = "driving";
    } else {

      const STOP_LINE = 121;

      if (distance <= STOP_LINE) {
        car.state = "driving";
        return;
      }

      if (distance <= stopDistance) {
        car.state = "stopping";
      } else {
        car.state = "driving";
      }
    }
  }

  // 🟢 GREEN LIGHT
  else if (light.state === "green") {
    car.state = "driving";
  }
}

// 1️⃣ Vul trafficLights vanuit de DOM
const trafficLights = [];
document.querySelectorAll('#intersection-scene .traffic_light').forEach(element => {
  const overhang = element.closest('.overhang');
  const axis = element.dataset.axis;
  const position = overhang.dataset.position;
  const movement = normalizeMovement(element.dataset.movement, axis, position);

  trafficLights.push({
    element,
    axis,
    position,
    movement,
    state: 'red'
  });
});

// ------------------------------
// Groups
// ------------------------------

// Groep 1: alle rechtsaf
const group1 = trafficLights.filter(light => light.movement === 'right');

// Groep 2: horizontaal links+rechts rechtdoor
const group2 = trafficLights.filter(
  light =>
    light.movement === 'straight' &&
    light.axis === 'horizontal'
);

// Groep 3: verticaal top+bottom rechtdoor
const group3 = trafficLights.filter(
  light =>
    light.movement === 'straight' &&
    light.axis === 'vertical'
);

// Groep 4: horizontaal links+rechts linksaf
const group4 = trafficLights.filter(
  light =>
    light.movement === 'left' &&
    light.axis === 'horizontal'
);

// Groep 5: verticaal top+bottom linksaf
const group5 = trafficLights.filter(
  light =>
    light.movement === 'left' &&
    light.axis === 'vertical'
);

const cars = [];

const lanes = {
  vertical_forward: [],
  vertical_backward: [],
  horizontal_forward: [],
  horizontal_backward: [],

  vertical_forward_right: [],
  vertical_backward_right: [],
  horizontal_forward_right: [],
  horizontal_backward_right: [],

  vertical_forward_left: [],
  vertical_backward_left: [],
  horizontal_forward_left: [],
  horizontal_backward_left: []
};

const laneLights = new Map();

group1.forEach((light, index) => {
  const keys = [
    "vertical_forward_right",
    "vertical_backward_right",
    "horizontal_forward_right",
    "horizontal_backward_right"
  ];

  laneLights.set(keys[index], light);
});

group2.forEach((light, index) => {
  const keys = [
    "horizontal_forward",
    "horizontal_backward"
  ];

  laneLights.set(keys[index], light);
});

group3.forEach((light, index) => {
  const keys = [
    "vertical_forward",
    "vertical_backward"
  ];

  laneLights.set(keys[index], light);
});

group4.forEach((light, index) => {
  const keys = [
    "horizontal_forward_left",
    "horizontal_backward_left"
  ];

  laneLights.set(keys[index], light);
});

group5.forEach((light, index) => {
  const keys = [
    "vertical_forward_left",
    "vertical_backward_left"
  ];

  laneLights.set(keys[index], light);
});

// console.log('laneLights check:', laneLights);

const TIMING = {
  greenLong: 8000,   // groepen 2 en 3 (rechtdoor) 
  greenShort: 3600,  // groepen 4 en 5 (linksaf)   
  orange: 2250,       // alle groepen
  allRed: 2250         // korte pauze tussen groepen
};

const phaseGroups = [
  { group: group2, greenTime: TIMING.greenLong },
  { group: group3, greenTime: TIMING.greenLong },
  { group: group4, greenTime: TIMING.greenShort },
  { group: group5, greenTime: TIMING.greenShort }
];

function setLightState(light, state) {
  light.state = state;
  light.element.classList.remove('red', 'orange', 'green');
  light.element.classList.add(state);
  if (state === "orange") {
      light.orangeStartTime = performance.now();
  }
}

function runNextPhase() {
  clearPhaseTimers(); // 🔥 voorkomt dubbele schema's
  const phase = phaseGroups[currentPhase];
  group1.forEach(light => setLightState(light, 'green'));

  // 1️⃣ Zet groep op groen
  phase.group.forEach(light => setLightState(light, 'green'));

  // 2️⃣ Zet andere groepen op rood
  phaseGroups.forEach((g, idx) => {
    if (idx !== currentPhase) {
      g.group.forEach(light => setLightState(light, 'red'));
    }
  });

  const greenTimer = setTimeout(() => {
    phase.group.forEach(light => setLightState(light, 'orange'));

    const orangeTimer = setTimeout(() => {
      phase.group.forEach(light => setLightState(light, 'red'));

      const allRedTimer = setTimeout(() => {
        currentPhase = (currentPhase + 1) % phaseGroups.length;
        runNextPhase();
      }, TIMING.allRed);

      phaseTimers.push(allRedTimer);

    }, TIMING.orange);

    phaseTimers.push(orangeTimer);

  }, phase.greenTime);

  phaseTimers.push(greenTimer);
}

resetAllLights();

function getTrafficLightForLane(laneKey) {
    const light = laneLights.get(laneKey) || null;

    if (DEBUG && !window.__laneDebugLogged?.[laneKey]) {
        console.log("LANE LOOKUP:", laneKey, light);
        window.__laneDebugLogged = window.__laneDebugLogged || {};
        window.__laneDebugLogged[laneKey] = true;
    }

    return light;
}

const CAR_IMAGES = [
  './intersection_images/Yellow_striped_car.png',
  './intersection_images/Dark_blue_car.png',
  './intersection_images/Old_white_car.png',
  './intersection_images/Red_car.png',
  './intersection_images/Blue_car.png',
  './intersection_images/Nice_red_car.png',
  './intersection_images/White_car1.png',
  './intersection_images/Other_white_car.png',
  './intersection_images/White_sportscar.png',
  './intersection_images/Yellow_car.png',
  './intersection_images/Black_car.png',
  './intersection_images/Grey_merc.png',
  './intersection_images/Yellow_cab.png',
  './intersection_images/Green_car.png',
  './intersection_images/Pink_car.png',
  './intersection_images/Police_car.png'
];

function randomCarImage() {
  return CAR_IMAGES[Math.floor(Math.random() * CAR_IMAGES.length)];
}

function getLaneCenter(laneIndex, axis) {
  const road = axis === 'vertical'
    ? document.querySelector('#intersection-scene .verti_road')
    : document.querySelector('#intersection-scene .hori_road');

  const roadRect = road.getBoundingClientRect();
  const intersectionRect = intersection.getBoundingClientRect();

  const laneCount = 6;

  if (axis === 'vertical') {
    const laneWidth = roadRect.width / laneCount;

    const laneCenterX =
      roadRect.left - intersectionRect.left +
      laneWidth * (laneIndex - 0.5);

    return laneCenterX;

  } else {
    const laneHeight = roadRect.height / laneCount;
 
    const laneCenterY =
      roadRect.top - intersectionRect.top +
      laneHeight * (laneIndex - 0.5);

    return laneCenterY;
  }
}

function getStartPosition(axis, direction, turn = null) {
  let laneIndex;

  if (axis === 'vertical') {

    if (turn === 'right') {
      // ⭐ Rechtsaf = buitenste banen (1 en 6)
      laneIndex = direction === 'forward' ? 1 : 6;

    } else if (turn === 'left') {
      // ⭐ Linksaf = binnenste banen (3 en 4)
      laneIndex = direction === 'forward' ? 3 : 4;

    } else {
      // ⭐ Rechtdoor
      laneIndex = direction === 'forward' ? 2 : 5;
    }

    const laneCenter = getLaneCenter(laneIndex, 'vertical');
    const x = laneCenter - 30;
    const y = direction === 'forward'
      ? -60
      : intersection.offsetHeight + 60;

    return { x, y };

  } else {

    if (turn === 'right') {
      // ⭐ Rechtsaf = buitenste banen (6 en 1 gespiegeld)
      laneIndex = direction === 'forward' ? 6 : 1;

    } else if (turn === 'left') {
      // ⭐ Linksaf = binnenste banen (4 en 3 gespiegeld)
      laneIndex = direction === 'forward' ? 4 : 3;

    } else {
      // ⭐ Rechtdoor
      laneIndex = direction === 'forward' ? 5 : 2;
    }

    const laneCenter = getLaneCenter(laneIndex, 'horizontal');
    const y = laneCenter - 30;
    const x = direction === 'forward'
      ? -60
      : intersection.offsetWidth + 60;

    return { x, y };
  }
}

function isOutOfBounds(car) {
  const bounds = getAutoBounds();

  return (
    car.x > bounds.right ||
    car.x < bounds.left ||
    car.y > bounds.bottom ||
    car.y < bounds.top
  );
}

function createCar({ axis, direction, turn = null }) {

  const el = document.createElement('img');
  el.src = randomCarImage();
  el.classList.add('car', axis, direction);
  carsLayer.appendChild(el);

  let { x, y } = getStartPosition(axis, direction, turn);

  let rotation = 0;
  if (axis === 'vertical') {
    rotation = direction === 'forward' ? 180 : 0;
  } else {
    rotation = direction === 'forward' ? 90 : -90;
  }

  // 🔹 LaneKey bepalen
  let laneKey = `${axis}_${direction}`;
  if (turn === 'right') {
    laneKey += '_right';
  } else if (turn === 'left') {
    laneKey += '_left';
  }

//  console.log("SPAWN:", axis, direction, turn);
//  console.log("LANEKEY:", laneKey);

  const car = {
    element: el,
    axis,
    direction,
    turn, // ⭐ nieuw
    laneKey, // ⭐ nieuw
    speed: 60,
    x,
    y,
    rotation,
    width: 60,
    height: 60,
    state: "driving",
    maxSpeed: 60,
    currentSpeed: 0,
    acceleration: 0.8,
    deceleration: 0.8,
    orangeDecision: null,
    isTurning: false,
    hasTurned: false 
  };

  const debug = document.createElement("div");
  debug.style.position = "absolute";
  debug.style.fontSize = "10px";
  debug.style.color = "black";
  debug.style.pointerEvents = "none";

  document.body.appendChild(debug);
  car.debugElement = debug;

  checkTrafficLight(car);

  registerCar(car);

  return car;
}

let currentIndex = 0;

let lastTime = performance.now();

function tick(time) {
  if (!animationRunning) return;
  const delta = Math.min((time - lastTime) / 1000, 0.05); // max 0.05 sec
  lastTime = time;

    cars.forEach(car => {
      updateCarState(car, delta);
      updateCarMovement(car, delta);
/*
      if (DEBUG && !car.debugLoggedTest) {
          const light = getTrafficLightForLane(car.laneKey);

          console.log(
              "TEST RIGHT LOG |",
              "laneKey:", car.laneKey,
              "movement:", car.turn,
              "lightMovement:", light?.movement,
              "lightState:", light?.state
          );

          car.debugLoggedTest = true;
      }

          if (DEBUG && !car.debugLogged) {
              const light = getTrafficLightForLane(car.laneKey);

              console.log("LaneKey:", car.laneKey);
              console.log("Light:", light);
              console.log("CAR:", car.laneKey, "LIGHT:", light?.state);

              car.debugLogged = true;
          }*/

      const distance = getDistanceToIntersection(car);

      /*car.debugElement.textContent =
        `d:${Math.round(distance)} | stop:${STOP_DISTANCE} | state:${car.state}`;

      car.debugElement.style.left = car.x + "px";
      car.debugElement.style.top = (car.y - 15) + "px";*/
    });

  // despawn
  for (let i = cars.length - 1; i >= 0; i--) {
    const car = cars[i];
    if (isOutOfBounds(car)) {
      const lane = lanes[car.laneKey];
      if (lane) lane.splice(lane.indexOf(car), 1);
      car.element.remove();
      if (car.debugElement) {
        car.debugElement.remove();
      }
      cars.splice(i, 1);
    }
  }

  animationFrameId = requestAnimationFrame(tick);
}


// ------------------------------
// Debug overview (optioneel)
// ------------------------------
/*
if (DEBUG) {
  console.group('🚦 Traffic Lights Overview');
  trafficLights.forEach(l => {
    console.log(`${l.axis} | ${l.position} | ${l.movement}`, l.element);
  });
  console.groupEnd();
}
*/
// ------------------------------
// Debug: log groepen
// ------------------------------
/*
if (DEBUG) {
  console.log('🟢 Group 1 (right turns):', group1);
  console.log('🟢 Group 2 (horizontal straight):', group2);
  console.log('🟢 Group 3 (vertical straight):', group3);
  console.log('🟢 Group 4 (horizontal left):', group4);
  console.log('🟢 Group 5 (vertical left):', group5);
}
*/

// ==============================
// EXPLODE 
// ==============================
function explode() {
  isExploded = true;

  // console.log("💥 EXPLODE MODE");

  // Auto systeem stoppen
  animationRunning = false;
  stopLoop();
  stopCarSpawner();
  clearPhaseTimers();
  resetAllLights();

    // Verwijder DOM elementen
    cars.forEach(car => car.element.remove());

    // Leeg alle lane arrays
    Object.values(lanes).forEach(lane => {
      lane.length = 0;
    });

    // Leeg cars array
    cars.length = 0;

  // Intersection exploderen
    const elements = gsap.utils.toArray(
      "#intersection *:not(.diag_wrapper):not(.yield-rotate):not(.resize-hint)"
    );

    gsap.to([".hori_road", ".verti_road"], {
      scale: 0.75,
      duration: 2,
      ease: "power2.out"
    });

  gsap.to(elements, {
    x: () => gsap.utils.random(-200, 200),
    y: () => gsap.utils.random(-200, 200),
    rotation: () => gsap.utils.random(-360, 360),
    duration: 2,
    ease: "power3.out"
  });
}

function resetExplosion() {
  isExploded = false;

  // console.log("🔄 RESET MODE");

  // 1️⃣ Intersection visueel resetten
    const elements = gsap.utils.toArray(
      "#intersection *:not(.diag_wrapper):not(.yield-rotate)"
    );

    gsap.to([".hori_road", ".verti_road"], {
      scale: 1,
      duration: 2.5,
      ease: "power2.inOut"
    });

  gsap.to(elements, {
    x: 0,
    y: 0,
    rotation: 0,
    duration: 2.5,
    ease: "power2.out"
  });

  // 2️⃣ Auto systeem opnieuw starten
  setTimeout(() => {
    startLoop();
    startCarSpawner(); // 🔥 dit is nu de enige spawn start

  }, 2500);

  // 3️⃣ Traffic lights opnieuw starten
  clearPhaseTimers();
  resetAllLights();
  group1.forEach(light => setLightState(light, 'green'));
  currentPhase = 0;
  runNextPhase();
}

const mm = window.matchMedia("(min-width: 1250px)");
let isExploded = false;

mm.addEventListener("change", handleBreakpoint);
handleBreakpoint(mm);

function handleBreakpoint(e) {
  if (e.matches && !isExploded) {
    explode();
  } else if (!e.matches && isExploded) {
    resetExplosion();
  }
}

const mmHint = gsap.matchMedia();

mmHint.add("(max-width: 1249px)", () => {
  gsap.to(".resize-hint", {
    x: 120,
    opacity: 0,
    duration: 1.2,
    ease: "power2.in"
  });
});

mmHint.add("(min-width: 1250px)", () => {

  gsap.set(".resize-hint", {
    x: 120,
    opacity: 0
  });

  gsap.to(".resize-hint", {
    x: 0,
    opacity: 1,
    duration: 1.2,
    ease: "power2.out"
  });

});

function init() {
  // console.log("🚦 Simulation init");

  // 🔒 Alleen simulatie starten als scherm kleiner is dan 1250px
  if (mm.matches) return;

  resetAllLights();
  group1.forEach(light => setLightState(light, 'green'));
  currentPhase = 0;
  runNextPhase();
  startLoop();

  // extra delay om race conditions te vermijden
  setTimeout(() => {
    startCarSpawner();
  }, 500);
}

init();


