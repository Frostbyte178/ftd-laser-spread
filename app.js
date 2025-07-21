const canvas = document.getElementById("simulationCanvas");
const ctx = canvas.getContext("2d");
const sidetabIds = ["infoButton", "configButton", "infoWrapper", "configWrapper"];
const fps = 40;
let lastRefresh = -1;

// Armor constants and classes
let beamWidth, armorLeftX, armorTopY, armorMiddleY, armorHeight;
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
        this.cachedColor = blockStats[config.armor].color;
    }
    damage(damage) {
        if (this.dead) return 0;

        // Damage based on intensity and fire resistance
        let damageFactor = Math.min(1, config.intensity / this.resistance);
        let damageRequired = Math.min(this.hp / damageFactor, damage); // How much damage was removed from the shot by destroying/damaging this block
        this.hp = Math.max(0, this.hp - damage * damageFactor);

        // Kill the block if it is dead
        if (this.hp <= 0) {
            this.dead = true;
        }

        // Set color based on health fraction
        this.cachedColor = mergeColors(blockStats[config.armor].color, '#000000', this.hp / this.maxHp);

        // Return the amount of damage required to damage/destroy the block
        return damageRequired;
    }
    revive() {
        this.hp = this.maxHp;
        this.dead = false;
        this.cachedColor = blockStats[config.armor].color;
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
    drawContiguousColumn(x, y, height, color, dead) {
        ctx.beginPath();
        ctx.lineWidth = 4;
        let deadColor = blockStats[config.armor].color;
        ctx.strokeStyle = mergeColors(deadColor, '#080808');

        // Draw as translucent fill if dead
        if (dead) {
            // Set fill based on standard armor block color
            ctx.fillStyle = deadColor;

            ctx.globalAlpha = 0.5;
            ctx.fillRect(armorLeftX + x * beamWidth, armorTopY + y * beamWidth, beamWidth, beamWidth * height);
            ctx.globalAlpha = 1;
        } else {
            // Set fill based on current armor block color
            ctx.fillStyle = color;

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
        
        // Draw wall as contiguous columns of alive and dead beams
        let segmentHp = this.armorWall[0].hp;
        let segmentDead = this.armorWall[0].dead;
        let segmentColor = this.armorWall[0].cachedColor;
        let segmentX = 0;
        let segmentY = 0;
        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                let i = x * this.height + y;
                let currentBeam = this.armorWall[i];

                // Start a new segment if the old one ended or we ended up at the top of the next column
                if ((y == 0 & x > 0) | currentBeam.hp != segmentHp) {
                    console.log(segmentHp, currentBeam.hp, currentBeam.dead)
                    this.drawContiguousColumn(segmentX, segmentY, (y || this.height) - segmentY, segmentColor, segmentDead);
                    segmentX = x;
                    segmentY = y;
                    segmentHp = currentBeam.hp;
                    segmentDead = currentBeam.dead;
                    segmentColor = currentBeam.cachedColor;
                }
            }
        }
        // Draw final column because it was left out in the loop
        this.drawContiguousColumn(
            segmentX, segmentY, this.height - segmentY, 
            this.armorWall[this.armorWall.length - 1].cachedColor,
            this.armorWall[this.armorWall.length - 1].dead
        );
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
const shotsPerSecond = [40, 1, 2, 4, 8];

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
    singleShotDamage = config.dps / shotsPerSecond[config.q];

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
function mergeColors(color1, color2, weight = 0.5) {
    let mergedColor = '#'

    // Take the mean of each rgb pair between the two colors
    for(let i = 1; i < 7; i += 2) {
        // Decimal values of the rgb pairs
        let subpixel1 = parseInt(color1.substring(i, i + 2), 16);
        let subpixel2 = parseInt(color2.substring(i, i + 2), 16);

        // Take weighted average of values and convert back to hexadecimal
        let mergedSubpixel = Math.round(subpixel2 + (subpixel1 - subpixel2) * weight).toString(16);
        while (mergedSubpixel.length < 2) {
            mergedSubpixel = "0" + mergedSubpixel;
        }
        mergedColor += mergedSubpixel;
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
    armorHeight = Math.floor(wallHeight / beamWidth);

    // Get middle y position of armor wall in pixels
    armorMiddleY = armorTopY + armorHeight * beamWidth / 2;

    // Get mouse position in beams
    mouse.blockX = (mouse.x - armorLeftX) / beamWidth;
    mouse.blockY = (mouse.y - armorMiddleY) / beamWidth;

    // Draw armor wall
    armorWall.generate(armorWidth, armorHeight, config.armor);
    armorWall.draw();
}

// Get laser Y in pixels based on pixel position from the left edge of the screen
function laserBeamPixelY(angle, pixelX) {
    let rangeBlocks = (pixelX - armorLeftX) / beamWidth + config.range;
    return (Math.tan(angle) * rangeBlocks) * beamWidth + armorMiddleY;
}

// Get laser Y in beams based on range from the left edge of the armor wall
function laserBeamBlockY(angle, depth) {        
    return Math.tan(angle) * (depth + config.range) + armorHeight / 2;
}

// Do laser attenuation damage reduction
function getAttenuation() {
    // remaining damage per 100m to the power of the range divided by 100m
    return (1 - config.attenuation / 100) ** (config.range / 100);
}

function doOldLaserDamage(angle, damage = singleShotDamage) {
    // Damage block by block until the laser's shot runs out of damage
    // Attenuation within the armor wall is ignored as it is negligible
    let remainingDamage = damage * getAttenuation();

    let depth;
    for (depth = 0; depth < config.thickness; depth++) {
        // Exit if we run out of damage
        if (remainingDamage <= 0) break;

        // Exit if we're beyond the confines of the wall
        let blockToDamageY = Math.floor(laserBeamBlockY(angle, depth));
        if (blockToDamageY < 0 | blockToDamageY >= armorHeight) return -1;

        // Damage block we're hitting on the front
        let armorBlockIndex = depth * armorHeight + blockToDamageY;
        remainingDamage -= armorWall.armorWall[armorBlockIndex].damage(remainingDamage);

        // Exit if we run out of damage
        if (remainingDamage <= 0) break;
        
        // Damage adjacent block if going sideways
        let nextBlockToDamageY = Math.floor(laserBeamBlockY(angle, depth + 1));

        // Ignore if we're going off the edge of the armor wall
        if (nextBlockToDamageY < 0 | nextBlockToDamageY >= armorHeight) continue;

        // Damage adjacent block based on Y position
        let nextArmorBlockIndex = armorBlockIndex + nextBlockToDamageY - blockToDamageY;
        remainingDamage -= armorWall.armorWall[nextArmorBlockIndex].damage(remainingDamage);
    }

    // Return how far the laser got into the wall
    return depth;
}

let oldLaserOpacity = 0;
let oldLaserLastShotTime = -1;
let oldLaserAngle;
let oldLaserDepth;
function drawOldLaser() {
    // Do damage and update opacity if it's time to shoot or if the Q count is 0, but only if the fire command was given
    if ((config.q == 0 | (Date.now() - oldLaserLastShotTime >= 1000 / shotsPerSecond[config.q])) & mouse.rmb) {
        // Get laser angle value
        oldLaserAngle = Math.atan2(mouse.blockY, mouse.blockX + config.range);
        oldLaserAngle += (Math.random() * 0.1 - 0.05) * Math.PI / 180; // Inaccuracy in radians

        oldLaserDepth = doOldLaserDamage(oldLaserAngle);
        oldLaserLastShotTime = Date.now();
        oldLaserOpacity = 1;
    } else {
        oldLaserOpacity -= 0.1;
    }

    // Exit if opacity is too low
    if (oldLaserOpacity <= 0) return;

    // Draw laser beam red outline
    let startX = Math.max(0, armorLeftX - config.range * beamWidth);
    let startY = laserBeamPixelY(oldLaserAngle, startX);
    let endX = (oldLaserDepth == -1 | oldLaserDepth == config.thickness) ? 
                    ctx.canvas.width : 
                    (armorLeftX + oldLaserDepth * beamWidth);
    let endY = laserBeamPixelY(oldLaserAngle, endX);
    ctx.beginPath();
    ctx.globalAlpha = oldLaserOpacity;
    ctx.strokeStyle = '#f52727';
    ctx.lineWidth = Math.min(50, beamWidth * 0.6); // Size based on beam size, max of 64px
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    
    // Draw laser beam white center
    ctx.beginPath();
    ctx.strokeStyle = '#dddddd';
    ctx.lineWidth = Math.min(20, beamWidth * 0.24); // Size based on beam size, max of 20px
    ctx.moveTo(endX, endY);
    ctx.lineTo(startX, startY);
    ctx.stroke();

    // Reset opacity
    ctx.globalAlpha = 1;
}

const rayCount = 201; // Must be odd
function doNewLaserDamage(angle) {
    let rayDamage = singleShotDamage * getAttenuation() / rayCount;

    // Fire a bunch of rays where each deals a small proportion of the total damage
    for (let i = -1; i <= 1; i += 2 / (rayCount - 1)) {
        // Evenly space rays based on lateral distance, not angle
        let newAngle = angle + Math.atan2(singleShotDamage / config.expansion * i, 100);
        doOldLaserDamage(newAngle, rayDamage)
    }
}

let newLaserOpacity = 0;
let newLaserLastShotTime = -1;
let newLaserBaseAngle;
let newLaserSpreadAngle;
function drawNewLaser() {
    // Do damage and update opacity if it's time to shoot or if the Q count is 0, but only if the fire command was given
    if ((config.q == 0 | (Date.now() - newLaserLastShotTime >= 1000 / shotsPerSecond[config.q])) & mouse.lmb) {
        // Get laser angle values
        newLaserBaseAngle = Math.atan2(mouse.blockY, mouse.blockX + config.range);
        newLaserBaseAngle += (Math.random() * config.inaccuracy * 2 - config.inaccuracy) * Math.PI / 180; // Inaccuracy in radians

        // Get angles for the top and bottom edges of the beam
        newLaserSpreadAngle = Math.atan2(singleShotDamage / config.expansion, 100);

        doNewLaserDamage(newLaserBaseAngle);
        newLaserLastShotTime = Date.now();
        newLaserOpacity = 0.5;
    } else {
        newLaserOpacity -= 0.05;
    }

    // Exit if opacity is too low
    if (newLaserOpacity <= 0) return;

    // Draw laser beam blue outline as a trapezoid
    let startX = Math.max(0, armorLeftX - config.range * beamWidth);
    ctx.beginPath();
    ctx.globalAlpha = newLaserOpacity;
    ctx.strokeStyle = ctx.fillStyle = '#2727f5';
    ctx.lineWidth = 16; // Use stroke as minimum size of beam
    ctx.moveTo(startX, laserBeamPixelY(newLaserBaseAngle + newLaserSpreadAngle, startX));
    ctx.lineTo(ctx.canvas.width, laserBeamPixelY(newLaserBaseAngle + newLaserSpreadAngle, ctx.canvas.width));
    ctx.lineTo(ctx.canvas.width, laserBeamPixelY(newLaserBaseAngle - newLaserSpreadAngle, ctx.canvas.width));
    ctx.lineTo(startX, laserBeamPixelY(newLaserBaseAngle - newLaserSpreadAngle, startX));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw laser beam white center as a trapezoid
    ctx.beginPath();
    ctx.strokeStyle = ctx.fillStyle = '#dddddd';
    ctx.lineWidth = 6; // Use stroke as minimum size of beam
    ctx.moveTo(startX, laserBeamPixelY(newLaserBaseAngle + newLaserSpreadAngle / 2, startX));
    ctx.lineTo(ctx.canvas.width, laserBeamPixelY(newLaserBaseAngle + newLaserSpreadAngle / 2, ctx.canvas.width));
    ctx.lineTo(ctx.canvas.width, laserBeamPixelY(newLaserBaseAngle - newLaserSpreadAngle / 2, ctx.canvas.width));
    ctx.lineTo(startX, laserBeamPixelY(newLaserBaseAngle - newLaserSpreadAngle / 2, startX));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Reset opacity
    ctx.globalAlpha = 1;
}

function drawLaser() {
    // Exit if clicks shouldn't register
    if (mouse.blockClicks) return;

    drawNewLaser();
    drawOldLaser();
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
