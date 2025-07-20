const canvas = document.getElementById("simulationCanvas");
const ctx = canvas.getContext("2d");
const sidetabIds = ["infoButton", "configButton", "infoWrapper", "configWrapper"];
const fps = 40;
let lastRefresh = -1;

// Armor constants and classes
let beamWidth, armorLeftX, armorTopY, armorMiddleY;
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
        this.maxHp = stats.hp;
        this.flammability = stats.flammability;
        this.resistance = stats.resistance;
        this.x = x;
        this.y = y;
        this.dead = false;
    }
    damage(damage, intensity) {
        if (this.dead) return;

        // Damage based on intensity and fire resistance
        let damageFactor = min(1, intensity / this.resistance);
        this.hp -= damage * damageFactor;

        if (this.hp <= 0) {
            this.dead = true;
        }
    }
    revive() {
        this.hp = this.maxHp;
        this.dead = false;
    }
    moveTo(x, y) {
        this.x = x;
        this.y = y;
        this.revive();
    }
    changeTo(stats) {
        this.maxHp = stats.hp;
        this.flammability = stats.flammability;
        this.resistance = stats.resistance;
        this.revive();
    }
}

class ArmorWall {
    constructor() {
        this.armorWall = [];
        this.width = -1;
        this.height = -1;
        this.type = undefined;
    }
    generate(width, height, type) {
        // Exit if neither dimension has changed
        if (width == this.width && height == this.height && type == this.type)
            return;

        // Save new parameters
        this.width = width;
        this.height = height;
        this.type = type;

        // Generate walls in column order, top left to bottom right
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                let i = x * height + y;
                let armorBlock;

                if (i < this.armorWall.length) {
                    // Reuse existing instances for blocks in the armor wall
                    armorBlock = this.armorWall[i];
                    armorBlock.moveTo(x, y);
                    armorBlock.changeTo(blockStats[this.type]);
                } else {
                    // Add new armor class instance to the end of this.armorWall if we run out of existing instances
                    armorBlock = new Armor(blockStats[this.type], x, y);
                    this.armorWall.push(armorBlock);
                }
            }
        }

        // Remove excess walls
        this.armorWall = this.armorWall.slice(0, width * height);
    }
    changeTo(type) {
        if (type == this.type) return;

        for (let armor of this.armorWall) {
            armor.changeTo(blockStats[type]);
        }
    }
    revive() {
        for (let armor of this.armorWall) {
            armor.revive();
        }
    }
    drawContiguousColumn(x, y, height, dead) {
        // Draw as translucent fill if dead
        if (dead) {
            ctx.globalAlpha = 0.5;
            ctx.fillRect(armorLeftX + x * beamWidth, armorTopY + y * beamWidth, beamWidth, beamWidth * height);
            ctx.globalAlpha = 1;
        } else {
            ctx.rect(armorLeftX + x * beamWidth, armorTopY + y * beamWidth, beamWidth, beamWidth * height);
            ctx.fill();
            ctx.stroke();

            // Add lines between to turn the column into a grid
            for (let i = 1; i < height; i++) {
                let lineY = armorTopY + (y + i) * beamWidth;
                ctx.moveTo(armorLeftX + x * beamWidth, lineY);
                ctx.lineTo(armorLeftX + (x + 1) * beamWidth, lineY);
                ctx.stroke();
            }
        }
    }
    draw() {
        if (!beamWidth | beamWidth == undefined) return;
        if (this.armorWall == undefined | this.armorWall.length == 0) return;

        // Set stroke and fill based on armor block color
        ctx.beginPath();
        let color = blockStats[config.armor].color;
        ctx.fillStyle = color;
        ctx.strokeStyle = mergeColors(color, '#080808');
        ctx.lineWidth = 4;
        
        // Draw wall as contiguous columns of alive and dead beams
        let segmentIsDead = this.armorWall[0].dead;
        let segmentX = 0;
        let segmentY = 0;
        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                let i = x * this.height + y;
                let currentBeam = this.armorWall[i];

                // Start a new segment if the old one ended or we ended up at the top of the next column
                if ((y == 0 & x > 0) | currentBeam.dead != segmentIsDead) {
                    this.drawContiguousColumn(segmentX, segmentY, (y || this.height) - segmentY, segmentIsDead);
                    segmentX = x;
                    segmentY = y;
                    segmentIsDead = currentBeam.dead;
                }
            }
        }
        // Draw final column because it was left out in the loop
        this.drawContiguousColumn(segmentX, segmentY, this.height - segmentY, segmentIsDead);
    }
}
let armorWall = new ArmorWall();

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
let singleShotDamage = 25;

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
        if (item != 'armor') {
            // Convert all non-armor values to numbers
            config[item] = Number(config[item]);
        }
    }

    // Save single shot damage to config based on Q count
    singleShotDamage = config.dps / [40, 1, 2, 4, 8][config.q];

    // Change armor type
    armorWall.changeTo(config.armor);
}

// Track mouse movements and inputs
let mouse = {
    x: 0,
    y: 0,
    blockX: 0,
    blockY: 0,
    lmb: false,
    rmb: false,
    held: false,
    blockClicks: false,
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

// Disable clicking inputs from registering in sidebars
for (let id of sidetabIds) {
    let element = document.getElementById(id);
    element.addEventListener('mouseover', () => {mouse.blockClicks = true});
    element.addEventListener('mouseout', () => {mouse.blockClicks = false});
}

// Update config when any config element changes
for(let item in config) {
    let documentId = `config${item.charAt(0).toUpperCase() + item.slice(1)}`;
    let element = document.getElementById(documentId);
    element.addEventListener('change', updateConfig);
}

// Reset armor wall when the reset button is pressed
let resetButton = document.getElementById('resetArmor');
resetButton.addEventListener('click', function() {armorWall.revive()});

// Write the Q count to the label of the slider
function updateQSlider() {
    let qSlider = document.getElementById("configQ");
    let qLabel = document.getElementById("qLabel");
    qLabel.innerHTML = `Q Count: ${qSlider.value}`;

    qSlider.oninput = function() {
        qLabel.innerHTML = `Q Count: ${this.value}`;
    }
}

// Merge two colors for armor block borders
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
    // Get top position of armor wall in pixels to place it below the title
    let titleDiv = document.getElementById('title').getBoundingClientRect();
    armorTopY = titleDiv.y + titleDiv.height + armorMargin;

    // Get height of armor wall in pixels
    let wallHeight = ctx.canvas.height - armorTopY - armorMargin;

    // Get width of armor wall in pixels
    let wallWidth = ctx.canvas.width * 0.6;

    // Get width of one beam of armor (the entire width is spanned by the thickness, with a minimum of 10m to preserve some height)
    beamWidth = wallWidth / Math.max(10, config.thickness);

    // Get left position of armor wall in pixels
    armorLeftX = ctx.canvas.width / 2 - beamWidth * config.thickness / 2;

    // Get dimensions of armor wall in beams
    let armorWidth = config.thickness;
    let armorHeight = Math.floor(wallHeight / beamWidth);

    // Get middle y position of armor wall in pixels
    armorMiddleY = armorTopY + armorHeight * beamWidth / 2;

    // Get mouse position in beams
    mouse.blockX = (mouse.x - armorLeftX) / beamWidth;
    mouse.blockY = (mouse.y - armorMiddleY) / beamWidth;

    // Draw armor wall
    armorWall.generate(armorWidth, armorHeight, config.armor);
    armorWall.draw();
}

// Get height in beams or pixels based on pixel position from the left edge of the screen
function laserBeamY(angle, pixelX, returnPixels = false) {
    let rangeBlocks = (pixelX - armorLeftX) / beamWidth + config.range;
    if (returnPixels)
        return (Math.tan(angle) * rangeBlocks) * beamWidth + armorMiddleY;
    return Math.tan(angle) * rangeBlocks;
}

function drawOldLaser() {
    // Get base position values
    let angle = Math.atan2(mouse.blockY, mouse.blockX + config.range);
    angle += (Math.random() * 0.1 - 0.05) * Math.PI / 180; // Inaccuracy in radians

    // Draw laser beam red outline
    let startX = Math.max(0, armorLeftX - config.range * beamWidth);
    let startY = laserBeamY(angle, startX, true);
    let endY = laserBeamY(angle, ctx.canvas.width, true);
    ctx.beginPath();
    ctx.strokeStyle = '#f52727';
    ctx.lineWidth = Math.min(64, beamWidth * 0.8); // Size based on beam size, max of 64px
    ctx.moveTo(startX, startY);
    ctx.lineTo(ctx.canvas.width, endY);
    ctx.stroke();
    
    // Draw laser beam white center
    ctx.beginPath();
    ctx.strokeStyle = '#dddddd';
    ctx.lineWidth = Math.min(20, beamWidth * 0.25); // Size based on beam size, max of 20px
    ctx.moveTo(ctx.canvas.width, endY);
    ctx.lineTo(startX, startY);
    ctx.stroke();
}

function drawNewLaser() {
    // Get base position values
    let baseAngle = Math.atan2(mouse.blockY, mouse.blockX + config.range);
    baseAngle += (Math.random() * config.inaccuracy * 2 - config.inaccuracy) * Math.PI / 180; // Inaccuracy in radians

    // Get angles for the top and bottom edges of the beam
    let spreadAngle = Math.atan2(singleShotDamage / config.expansion, 100);

    // Draw laser beam blue outline as a trapezoid
    let startX = Math.max(0, armorLeftX - config.range * beamWidth);
    ctx.beginPath();
    ctx.strokeStyle = ctx.fillStyle = '#2727f5';
    ctx.moveTo(startX, laserBeamY(baseAngle + spreadAngle, startX, true));
    ctx.lineTo(ctx.canvas.width, laserBeamY(baseAngle + spreadAngle, ctx.canvas.width, true));
    ctx.lineTo(ctx.canvas.width, laserBeamY(baseAngle - spreadAngle, ctx.canvas.width, true));
    ctx.lineTo(startX, laserBeamY(baseAngle - spreadAngle, startX, true));
    ctx.closePath();
    ctx.fill();

    // Draw laser beam white center as a trapezoid
    ctx.beginPath();
    ctx.strokeStyle = ctx.fillStyle = '#dddddd';
    ctx.moveTo(startX, laserBeamY(baseAngle + spreadAngle / 2, startX, true));
    ctx.lineTo(ctx.canvas.width, laserBeamY(baseAngle + spreadAngle / 2, ctx.canvas.width, true));
    ctx.lineTo(ctx.canvas.width, laserBeamY(baseAngle - spreadAngle / 2, ctx.canvas.width, true));
    ctx.lineTo(startX, laserBeamY(baseAngle - spreadAngle / 2, startX, true));
    ctx.closePath();
    ctx.fill();
}

function drawLaser() {
    // Exit if clicks shouldn't register
    if (mouse.blockClicks) return;

    if (mouse.lmb) {
        drawNewLaser();
    } else if (mouse.rmb){
        drawOldLaser();
    }
}

// Poll time to see if we should advance frames
function shouldRender() {
    return Date.now() - lastRefresh >= 1000 / fps;
}

// Main runtime loop
function mainLoop() {
    // Exit loop if it's not yet time to advance to the next tick
    requestAnimationFrame(mainLoop);
    if (!shouldRender()) return;

    // Update last refresh time
    lastRefresh = Date.now();

    // Update Q count slider label in the config menu
    updateQSlider();

    // Reset and resize canvas
    ctx.canvas.width = window.innerWidth;
    ctx.canvas.height = window.innerHeight;

    // Draw the elements
    drawArmor();
    drawLaser();
}

updateConfig();
requestAnimationFrame(mainLoop);
