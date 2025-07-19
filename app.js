const canvas = document.getElementById("simulationCanvas");
const ctx = canvas.getContext("2d");
const mouseTracker = document.querySelector("*");

// Armor constants and class
let beamWidth;
const blockStats = {
    wood:  {hp: 960,  flammability: 80, resistance: 10, color: '#c9b069'},
    stone: {hp: 1200, flammability: 0,  resistance: 50, color: '#a39260'},
    alloy: {hp: 1440, flammability: 25, resistance: 50, color: '#aeb2b5'},
    metal: {hp: 1680, flammability: 0,  resistance: 40, color: '#7e868c'},
    heavy: {hp: 6000, flammability: 25, resistance: 60, color: '#44515e'},
}

class Armor {
    constructor(stats, x, y) {
        this.hp = stats.hp;
        this.flammability = stats.flammability;
        this.resistance = stats.resistance;
        this.x = x;
        this.y = y;
        this.dead = false;
    }
    damageBlock(damage, intensity) {
        let damageFactor = min(1, intensity / this.resistance);
        this.hp -= damage * damageFactor;

        if (this.hp <= 0) {
            this.dead = true;
        }
    }
    moveTo(x, y) {
        this.x = x;
        this.y = y;
        this.dead = false;
    }
    changeTo(stats) {
        this.hp = stats.hp;
        this.flammability = stats.flammability;
        this.resistance = stats.resistance;
        this.dead = false;
    }
    draw() {
        if (!beamWidth || beamWidth == undefined) return;
        
        // Only draw translucent fill if dead
        if (this.dead) {
            ctx.globalAlpha = 0.3;
            ctx.rect(this.x, this.y, beamWidth, beamWidth);
            ctx.globalAlpha = 1;
            ctx.stroke();
        } else {
            ctx.rect(this.x, this.y, beamWidth, beamWidth);
            ctx.fill();
            ctx.stroke();
        }
    }
}

// Laser config variables
config = {
    range: 1000,
    dps: 1000,
    intensity: 60,
    attenuation: 1,
    stability: 100,
    q: 0,
    armor: 'metal',
    thickness: 40,
    inaccuracy: 0.05,
    expansion: 10000,
}

function updateConfig() {
    // Loop through ids based on config variable names to get data
    for(let item in config) {
        let documentId = `config${item.charAt(0).toUpperCase() + item.slice(1)}`;
        let value = document.getElementById(documentId).value;
        
        // Exit if value is empty
        if (value.length == 0)
            continue;

        // Save value to config
        config[item] = document.getElementById(documentId).value;
    }
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

// Update config when any config element changes
for(let item in config) {
    let documentId = `config${item.charAt(0).toUpperCase() + item.slice(1)}`;
    let element = document.getElementById(documentId);
    element.addEventListener('change', updateConfig);
}

// Write the Q count to the label of the slider
function updateQSlider() {
    let qSlider = document.getElementById("configQ");
    let qLabel = document.getElementById("qLabel");
    qLabel.innerHTML = `Q Count: ${qSlider.value}`;

    qSlider.oninput = function() {
        qLabel.innerHTML = `Q Count: ${this.value}`;
    }
}

// Merge two colors
function mergeColors(color1, color2) {
    let mergedColor = '#'

    // Take the mean of each rgb pair between the two colors
    for(let i = 1; i < 7; i += 2) {
        // Decimal values of the rgb pairs
        let subpixel1 = parseInt(color1.substring(i, i + 2), 16);
        let subpixel2 = parseInt(color2.substring(i, i + 2), 16);

        // Take mean of values and convert back to hexadecimal
        mergedColor += Math.round((subpixel1 + subpixel2) / 2).toString(16);
    }

    return mergedColor;
}

// Draw wall of armor
const armorMargin = 25;  // Empty margins around armor wall, in px
function drawArmor() {
    // Get top position of armor wall to place it below the title
    let titleDiv = document.getElementById('title').getBoundingClientRect();
    let topY = titleDiv.y + titleDiv.height + armorMargin;

    // Get height of armor wall
    let armorHeight = ctx.canvas.height - topY - armorMargin;

    // Get left position and width of armor wall
    let leftX = ctx.canvas.width * 0.2;
    let armorWidth = ctx.canvas.width * 0.6;

    // Get width of one beam of armor (the entire width is spanned by the thickness)
    beamWidth = armorWidth / config.thickness;
    
    // Set stroke and fill based on armor block color
    let color = blockStats[config.armor].color;
    ctx.fillStyle = color;
    ctx.strokeStyle = mergeColors(color, '#080808');
    ctx.lineWidth = 4;
    ctx.rect(leftX, topY, armorWidth, armorHeight);
    ctx.fill();
    ctx.stroke();
}

// Main runtime loop
function mainLoop() {
    updateQSlider();

    ctx.canvas.width = window.innerWidth;
    ctx.canvas.height = window.innerHeight;

    drawArmor();
    requestAnimationFrame(mainLoop);
}

updateConfig();
requestAnimationFrame(mainLoop);
