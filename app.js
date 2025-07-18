const canvas = document.getElementById("simulationCanvas");
const ctx = canvas.getContext("2d");
const mouseTracker = document.querySelector("*");

// Laser config variables
config = {
    range: 1000,
    dps: 1000,
    intensity: 60,
    attenuation: 1,
    stability: 100,
    q: 0,
    armor: 'metal',
    inaccuracy: 0.05,
    expansion: 10000,
}

// Track mouse movements and inputs
let mouse = {
    x: 0,
    y: 0,
    lmb: false,
    rmb: false,
    held: false,
}
let shifting = false;

function updateMousePos(event) {
    let lmbPressed = event.buttons == 1 | mouse.held;

    mouse.x = event.pageX ?? mouse.x;
    mouse.y = event.pageY ?? mouse.y;
    mouse.lmb = lmbPressed & !shifting;
    mouse.rmb = lmbPressed & shifting;
}

function mouseDown(event) {
    mouse.held = true;
    updateMousePos(event);

    // Update config when clicking
    for(let item in config) {
        let documentId = `config${item.charAt(0).toUpperCase() + item.slice(1)}`;
        let value = document.getElementById(documentId).value
        
        // Exit if value is empty
        if (value.length == 0)
            continue;

        // Save value to config
        config[item] = document.getElementById(documentId).value;
    }
}

function mouseUp(event) {
    mouse.held = false;
    updateMousePos(event);
}

function updateShifting(event) {
    if(event.shiftKey == undefined)
        return

    shifting = event.shiftKey;
    updateMousePos(event);
}

document.addEventListener("mousemove", updateMousePos);
document.addEventListener("mousedown", mouseDown);
document.addEventListener("mouseup", mouseUp);
document.addEventListener('keydown', updateShifting);
document.addEventListener('keyup', updateShifting);

// Writing the Q count to the label of the slider
function updateQSlider() {
    let qSlider = document.getElementById("configQ");
    let qLabel = document.getElementById("qLabel");
    qLabel.innerHTML = `Q Count: ${qSlider.value}`;

    qSlider.oninput = function() {
        qLabel.innerHTML = `Q Count: ${this.value}`;
    }
}

function drawStuff() {
    ctx.canvas.width = window.innerWidth;
    ctx.canvas.height = window.innerHeight;
    ctx.fillStyle = "red";
    ctx.fillRect(mouse.x, mouse.y, 150, 100 * config.q);
}

// Main runtime loop
function mainLoop() {
    updateQSlider();
    drawStuff();
    requestAnimationFrame(mainLoop);
}
requestAnimationFrame(mainLoop);
