import './style.css'
import * as THREE from 'three'
import * as dat from 'lil-gui'
import * as CANNON from 'cannon-es'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import CannonDebugger from 'cannon-es-debugger'

// vars /-/-/-/-/-/-/-/
let helvetikerFont, loraFont, spaceMonoFont, futuraFont, fontsLoaded, styleNum
let world, defaultMaterial, defaultContactMaterial, stonePhysMaterial, stoneContactMaterial, cannonDebugger
let activeCamera
let minX, maxX, minY, maxY  //Stores the min and max X and Y world postions of the edges of the screen
let sleepingBodies = 0
let uiTipHTML, controlsHTML

const fontsToLoad = 4

let useOrtho = true
let fontLoadFlag = false

const objectsToUpdate = []
const fonts = []
const letters  = []
const textures = []     // list of lists of textures

const p_textures = []
const h_textures = []
const o_textures = []
const e_textures = []
const n_textures = []
const i_textures = []
const x_textures = []

const sizes = { width: window.innerWidth, height: window.innerHeight}
const aspectRatio = sizes.width / sizes.height
const mouse = new THREE.Vector2()

const parameters = {
    toggleCam: () => {
        useOrtho = !useOrtho
        updateCamType()
    },
    earthquake: () => {
        earthquake()
    },
    randomise: () => {
        resetAll()
    },
    cannonDebugEnabled: false,
    typeInput: false,
    mouseGravity: false,
    collisionVisualisation: false,
    earthquakeForce: 2,
    gravityLimit: 1,
    userInput: false
}

const colours = [
    new THREE.Color(0x354544),  // grey green
    new THREE.Color(0x3C680F),  // verdant green
    new THREE.Color(0x245F1F),  // letter green
    new THREE.Color(0x201E5D),  // dark purple
    new THREE.Color(0x5D2548),  // strong purple
    new THREE.Color(0x773F86),  // medium purple
    new THREE.Color(0x484677),  // light purple
    new THREE.Color(0xC34B78),  // strong pink
    new THREE.Color(0x1D5B66),  // teal
    new THREE.Color(0x1F7DB3),  // lighter blue
    //new THREE.Color(0x1B273F),  // darkish blue
    new THREE.Color(0x6C462F),  // brown
    new THREE.Color(0xE96D13),  // nba orange
    new THREE.Color(0x6C462F)   //nba purple
]

const bgColours = [
    new THREE.Color(0xBEB3B1),
    new THREE.Color(0xC3BBB0),
    new THREE.Color(0xCAC9C5),
    //new THREE.Color(0x1B273F)       // dark blue
]

const xPositions = [-1, -0.7, -0.4, -0.1, 0.2, 0.5, 0.8, 1.1, 1.4, 1.7, 2]   //List of x positions to cycle through when spawning letters with type input

// render /-/-/-/-/-/-/-/

const canvas = document.querySelector('canvas.webgl')
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
})
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

// scene and cameras /-/-/-/-/-/-/-/

const scene = new THREE.Scene()
scene.background = getRandomListElement(bgColours)

const orthoCamera = new THREE.OrthographicCamera(-1 * aspectRatio, 1 * aspectRatio, 1, -1, 0.1, 2)
scene.add(orthoCamera)
orthoCamera.position.set(0, 0, 1)

const perspectiveCamera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
perspectiveCamera.position.set(- 3, 5, 3)
scene.add(perspectiveCamera)

if(useOrtho) activeCamera = orthoCamera
else activeCamera = perspectiveCamera

const controls = new OrbitControls(perspectiveCamera, canvas)
controls.enableDamping = true

// lights /-/-/-/-/-/-/-/
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
scene.add(ambientLight)

// loaders /-/-/-/-/-/-/-/
const texLoader = new THREE.TextureLoader()

const defaultStaticMat = new THREE.MeshBasicMaterial({ color: colours[2] })
const transparentMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })

// init calls /-/-/-/-/-/-/-/
initPhysics()
loadTextures()

uiTipHTML = document.getElementById("ui_tip")
controlsHTML = document.getElementById("controls")
uiTipHTML.hidden = true
controlsHTML.hidden = true

// Sounds /////
const hitSound = new Audio('/sounds/hit.mp3')

const playHitSound = (collision) =>
{
    const impactStrength = collision.contact.getImpactVelocityAlongNormal()

    if(impactStrength > 1.5)
    {
        hitSound.volume = Math.random()
        hitSound.currentTime = 0
        hitSound.play()
    }
}

// debug /-/-/-/-/-/-/-/
const debugGui = new dat.GUI()          // debug gui contains stuff for testing purposes
let userInputGui

debugGui.add(parameters, 'earthquake')
debugGui.add(parameters, 'toggleCam')
debugGui.add(parameters, 'randomise')
debugGui.add(parameters, 'cannonDebugEnabled')
debugGui.add(parameters, 'collisionVisualisation')
debugGui.add(parameters, 'earthquakeForce').min(0).max(10).step(1)
debugGui.add(parameters, 'gravityLimit').min(0).max(10).step(1)
userInputGui = debugGui.add(parameters, 'userInput').onChange(toggleUserInput).listen()



debugGui.hide()

function toggleUserInput(){
    console.log("user input: " + parameters.userInput)

    parameters.mouseGravity = parameters.userInput

    if(!parameters.userInput){  // restart randomisation loops
        startLoops()
    }
    else{
        fontLoopActive = false
        earthquakeLoopActive = false
        gravLoopActive = false
        posResetLoopActive = false
    }

    userInputGui.updateDisplay()
}

function initPhysics(){
    // Physics /////
    world = new CANNON.World()
    world.broadphase = new CANNON.SAPBroadphase(world)
    world.allowSleep = true
    let randGrav = new THREE.Vector2(rand(-10, 10), rand(-10, 10))
    randGrav = new THREE.Vector2(randGrav.x / 10, randGrav.y / 10)
    setGravity(randGrav.x, randGrav.y)

    defaultMaterial = new CANNON.Material('default')
    defaultContactMaterial = new CANNON.ContactMaterial(
        defaultMaterial,
        defaultMaterial,
        {
            friction: 0.1,
            restitution: 0.7
        }
    )
    world.defaultContactMaterial = defaultContactMaterial

    stonePhysMaterial = new CANNON.Material('stone')
    stoneContactMaterial = new CANNON.ContactMaterial(
        defaultMaterial,
        stonePhysMaterial,
        {
            friction: 1,
            restitution: 0
        }
    )
    world.addContactMaterial(stoneContactMaterial)

    cannonDebugger = new CannonDebugger(scene, world)
}

function loadTextures(){
    styleNum = 10
    for (var i = 0; i < styleNum; i++){    // 3 == number of styles for each letter
        p_textures.push(texLoader.load('sprites/p/' + i + '.png'))
        h_textures.push(texLoader.load('sprites/h/' + i + '.png'))
        o_textures.push(texLoader.load('sprites/o/' + i + '.png'))
        e_textures.push(texLoader.load('sprites/e/' + i + '.png'))
        n_textures.push(texLoader.load('sprites/n/' + i + '.png'))
        i_textures.push(texLoader.load('sprites/i/' + i + '.png'))
        x_textures.push(texLoader.load('sprites/x/' + i + '.png'))
        textures.push(p_textures)
        textures.push(h_textures)
        textures.push(o_textures)
        textures.push(e_textures)
        textures.push(n_textures)
        textures.push(i_textures)
        textures.push(x_textures)
    }
    console.log("Sprite textures and materials loaded")
}

let fontLoopActive = false
let earthquakeLoopActive = false
let gravLoopActive = false
let posResetLoopActive = false
let randTimeMin = 6
let randTimeMax = 15
startLoops()

function startLoops(){
    console.log("Rand loops started")
    fontLoopActive = true
    earthquakeLoopActive = true
    gravLoopActive = true
    posResetLoopActive = true
    fontLoop(rand(randTimeMin, randTimeMax))
    earthquakeLoop(rand(randTimeMin, randTimeMax))
    gravLoop(rand(3, 10))
    posResetLoop(rand(randTimeMin, randTimeMax))
}

function fontLoop(time){
    //console.log("Font randomising after " + time + " seconds")
    setTimeout(function(){
        randomiseAllTextures()
        let randTime = rand(randTimeMin, randTimeMax)    // between 10 and 30 seconds
        if(fontLoopActive) fontLoop(randTime)   
    }, time * 1000)     // convert seconds to milliseconds
}

function earthquakeLoop(time){
    parameters.earthquakeForce = rand(20,50)
    parameters.earthquakeForce = parameters.earthquakeForce / 10
    //console.log("Earthquake with force " + parameters.earthquakeForce + " after " + time + " seconds")

    setTimeout(function(){
        earthquake()
        let randTime = rand(randTimeMin, randTimeMax)
        if(earthquakeLoopActive) earthquakeLoop(randTime)
    }, time * 1000)
}

function gravLoop(time){
    let randGrav = new THREE.Vector2(rand(-10, 10), rand(-10, 10))
    randGrav = new THREE.Vector2(randGrav.x / 10, randGrav.y / 10)
    //console.log("Randomising gravity to " + randGrav.x + " " + randGrav.y + " after " + time + " seconds")
    
    setTimeout(function(){
        setGravity(randGrav.x, randGrav.y)
        let randTime = rand(3, 10)
        if(gravLoopActive) gravLoop(randTime)
    }, time * 1000)
}

function posResetLoop(time){
    //console.log("Reseting position after " + time + " seconds")
    
    setTimeout(function(){
        resetLetterPosition()
        let randTime = rand(randTimeMin, randTimeMax)
        if(posResetLoopActive) posResetLoop(randTime) 
    }, time * 1000)
}

function onFontsLoaded(){
    if(!parameters.typeInput){
        //createLetter("P", getRandomListElement(fonts), new THREE.Vector3(-1.2, 0, 0))
        //createLetter("h", getRandomListElement(fonts), new THREE.Vector3(0, 0, 0))
        //createLetter("o", getRandomListElement(fonts), new THREE.Vector3(0.2, 0, 0))
        //createLetter("e", getRandomListElement(fonts), new THREE.Vector3(0.2, 0, 0))
        //createLetter("n", getRandomListElement(fonts), new THREE.Vector3(0.2, 0, 0))
        //createLetter("i", getRandomListElement(fonts), new THREE.Vector3(0.2, 0, 0))
        //createLetter("x", getRandomListElement(fonts), new THREE.Vector3(0.2, 0, 0))
    }
}

function getRandomListElement(list){
    var item = list[rand(0,list.length-1)]
    return item
}

function getTextureByLetter(letter){
    letter = letter.toLowerCase()
    if(letter == "p") return getRandomListElement(p_textures)
    else if(letter == "h") return getRandomListElement(h_textures)
    else if(letter == "o") return getRandomListElement(o_textures)
    else if(letter == "e") return getRandomListElement(e_textures)
    else if(letter == "n") return getRandomListElement(n_textures)
    else if(letter == "i") return getRandomListElement(i_textures)
    else if(letter == "x") return getRandomListElement(x_textures)
    else return null
}

function getListByLetter(letter){
    letter = letter.toLowerCase()
    if(letter == "p") return p_textures
    else if(letter == "h") return h_textures
    else if(letter == "o") return o_textures
    else if(letter == "e") return e_textures
    else if(letter == "n") return n_textures
    else if(letter == "i") return i_textures
    else if(letter == "x") return x_textures
    else return null
}

var letterSpawnCount = 0
function createLetter(textString, font, position){

    const size = 0.35
    const textGeometry = new TextGeometry(
        textString,
        {
            font: font,
            size: size,
            height: 0.02,
            curveSegments: 12,
            bevelEnabled: true,
            bevelThickness: 0.001,
            bevelSize: 0.002,
            bevelOffset: 0,
            bevelSegments: 5
        }
    )
    textGeometry.computeBoundingBox()
    textGeometry.center()

    const mat = new THREE.MeshBasicMaterial( { color: getRandomListElement(colours) })
    
    const mesh = new THREE.Mesh(textGeometry, mat)
    mesh.name = textString + "_letter"
    mesh.position.x = xPositions[letterSpawnCount]
    letters.push(mesh)
    scene.add(mesh)

    var start = new THREE.Vector3()
    start.copy(mesh.position)
    mesh.userData = { letter: textString, startPos: start }
 
    letterSpawnCount++
    if(letterSpawnCount > xPositions.length) letterSpawnCount = 0
    
    const helper = new THREE.Box3Helper(textGeometry.boundingBox)
    //scene.add(helper)
    helper.name = textString + "_helper"

    const body = new CANNON.Body({
        mass: rand(1,5),
        angularFactor: new CANNON.Vec3(0,0,1),      //Restricts rotation on x and y axis
        linearFactor: new CANNON.Vec3( 1, 1, 0),     //Restricts movement on z axis 
        angularDamping: 0.7
    })
    body.addShape(
        new CANNON.Box( new CANNON.Vec3(size/4, size/2, size/2)) 
    )

    body.userData = { obj: mesh}
    body.allowSleep = true
    body.sleepSpeedLimit = 0.9      // body will feel sleepy if normalised velocity < 0.1
    body.sleepTimeLimit = 1        //body will sleep after 10 seconds
    body.addEventListener('sleep', function(event){
        sleepingBodies++
        console.log("num of sleeping bodies: " + sleepingBodies)
    })
    body.addEventListener('wakeup', function(event){
        sleepingBodies--
        console.log("num of sleeping bodies: " + sleepingBodies)
    })

    body.position.copy(mesh.position)
    world.addBody(body)
    objectsToUpdate.push({ mesh, body })

    //body.addEventListener('collide', edgeCollision)
}

function createTextString(text, size, position){
    const textGeo = new TextGeometry(
        text,
        {
            font: futuraFont,
            size: size,
            height: 0.02,
            curveSegments: 12,
            bevelEnabled: true,
            bevelThickness: 0.001,
            bevelSize: 0.002,
            bevelOffset: 0,
            bevelSegments: 5
        }
    )

    textGeo.computeBoundingBox()
    textGeo.center()

    const mesh = new THREE.Mesh(textGeo, defaultStaticMat)
    mesh.position.copy(position)
    scene.add(mesh)

    return mesh
}

createLetterPlane("p")
createLetterPlane("h")
createLetterPlane("o")
createLetterPlane("e")
createLetterPlane("n")
createLetterPlane("i")
createLetterPlane("x")

function createLetterPlane(letter){

    letter = letter.toLowerCase()
    let randStyle = rand(0, styleNum - 1)    // randomly chooses a style of letter - (0, 1, 2, 3)
    let tex = getListByLetter(letter)[randStyle]

    const geometry = new THREE.PlaneGeometry(1,1)
    geometry.computeBoundingBox()
    geometry.center()

    const material = new THREE.MeshBasicMaterial({ 
        map: tex, 
        transparent: true, 
        color: getRandomListElement(colours) 
    })
    
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = letter + "_letter"
    letters.push(mesh)
    scene.add(mesh)
    
    mesh.position.x = xPositions[letterSpawnCount]
    letterSpawnCount++
    if(letterSpawnCount > xPositions.length) letterSpawnCount = 0

    if(letter == "p" || letter == "P"){
         mesh.scale.set(0.4, 0.4, 0.4)
         mesh.position.y += 0.05
    }
    else mesh.scale.set(0.3, 0.3, 0.3)
    
    var start = new THREE.Vector3()
    start.copy(mesh.position)
    mesh.userData = { letter: letter, style: randStyle, startPos: start } // for randomising texture and position at runtime  

    const body = new CANNON.Body({
        mass: rand(1,5),
        angularFactor: new CANNON.Vec3(0, 0, 1),      //Restricts rotation on x and y axis
        linearFactor: new CANNON.Vec3( 1, 1, 0),     //Restricts movement on z axis 
        angularDamping: 0.7
    })
    //body.addShape( new CANNON.Box(new CANNON.Vec3(0.1, 0.2, 0.1)))

    createHitbox(body, letter, randStyle)

    body.userData = { obj: mesh }
    body.allowSleep = true
    body.sleepSpeedLimit = 0.1      // body will feel sleepy if normalised velocity < 0.1
    body.sleepTimeLimit = 15        //body will sleep after 10 seconds
    body.addEventListener('sleep', function(event){
        sleepingBodies++
        console.log("num of sleeping bodies: " + sleepingBodies)
    })
    body.addEventListener('wakeup', function(event){
        sleepingBodies--
        console.log("num of sleeping bodies: " + sleepingBodies)
    })

    body.position.copy(mesh.position)
    world.addBody(body)
    objectsToUpdate.push({ mesh, body })
}

function createHitbox(body, letter, type){
    letter = letter.toLowerCase()
    if(letter == "p"){

        body.addShape( new CANNON.Box(new CANNON.Vec3(0.1, 0.2, 0.1)))

        switch(type){
            case 0:
                break;
            case 1:
                break;
            case 2:
                break;
        }
    }
    else{   // default rectangle shape
        body.addShape( new CANNON.Box(new CANNON.Vec3(0.1, 0.15, 0.1)))
    }
}

// function to create each letter, 
// create physics body in function body, switch(font){ add shapes based on font }.
// Most fonts will be similar enough to use the same shapes
// master function createLetter() that calls baby functions

var offset = 0  //offset the edges from the edge of the screen. positive value (0.2) = gap between screen edge and box edge

calculateScreenEdgePositon()
createStaticBox(new THREE.Vector3(0   , maxY - offset, 0), new THREE.Vector3(maxX*2 , 0.01    , 1), false)  // Top
createStaticBox(new THREE.Vector3(maxX - offset, 0   , 0), new THREE.Vector3(0.01    , maxY*2 , 1), true)   // Right
createStaticBox(new THREE.Vector3(0   , minY + offset, 0), new THREE.Vector3(maxX*2 , 0.01    , 1), false)  // Bottom
createStaticBox(new THREE.Vector3(minX + offset, 0   , 0), new THREE.Vector3(0.01    , maxY*2 , 1), true)   // Left

function calculateScreenEdgePositon(){
    // Create a vector for each corner of the screen
    var topLeft = new THREE.Vector3(-1, 1, 0);
    var topRight = new THREE.Vector3(1, 1, 0);
    var bottomLeft = new THREE.Vector3(-1, -1, 0);
    var bottomRight = new THREE.Vector3(1, -1, 0);

    // Create a raycaster object
    var raycaster = new THREE.Raycaster();

    // Use the raycaster to get the world position of each screen corner
    raycaster.setFromCamera(topLeft, activeCamera);
    var worldTopLeft = new THREE.Vector3();
    raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, -1)), worldTopLeft);
    raycaster.setFromCamera(topRight, activeCamera);
    var worldTopRight = new THREE.Vector3();
    raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, -1)), worldTopRight);
    raycaster.setFromCamera(bottomLeft, activeCamera);
    var worldBottomLeft = new THREE.Vector3();
    raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, -1)), worldBottomLeft);
    raycaster.setFromCamera(bottomRight, activeCamera);
    var worldBottomRight = new THREE.Vector3();
    raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, -1)), worldBottomRight);

    // Get the screen edges by taking the minimum and maximum values of the x and y coordinates
    minX = Math.min(worldTopLeft.x, worldTopRight.x, worldBottomLeft.x, worldBottomRight.x);
    maxX = Math.max(worldTopLeft.x, worldTopRight.x, worldBottomLeft.x, worldBottomRight.x);
    minY = Math.min(worldTopLeft.y, worldTopRight.y, worldBottomLeft.y, worldBottomRight.y);
    maxY = Math.max(worldTopLeft.y, worldTopRight.y, worldBottomLeft.y, worldBottomRight.y);

    // Log the screen edges
    //console.log("Min X:", minX, "  Max X:", maxX, "  Min Y:", minY, "  Max Y:", maxY);
}

function createStaticBox(position, size = {x:1, y:1, z:1}, vertical){
    const boxGeo = new THREE.BoxGeometry(size.x, size.y, size.z)
    const boxMesh = new THREE.Mesh(boxGeo, transparentMat)

    boxMesh.position.copy(position)
    boxMesh.name = "static_box"
    scene.add(boxMesh)

    const body = new CANNON.Body({
        mass: 0
    })
    body.addShape(new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)))
    body.position.copy(position)
    world.addBody(body)

    body.addEventListener('collide', edgeCollision)
}

function clamp(num, min, max) { return Math.min(Math.max(num, min), max) }

function edgeCollision(collision){

    let velocity = collision.contact.getImpactVelocityAlongNormal()
    let position = new THREE.Vector3(collision.contact.bi.position.x + collision.contact.ri.x, collision.contact.bi.position.y + collision.contact.ri.y, 0) // world position of impact
    let colour = getRandomListElement(colours)

    let intensity = clamp(velocity, 0, 2)
    intensity = normaliseInRange(intensity, 0, 2, 150, 255).toFixed(0)

    
    if(collision.contact.bi.userData != null){      // if it can get the collision object (sometimes it cant???), set the colour to the letter colour
        let collisionObj = collision.contact.bi.userData.obj
        colour = collisionObj.material.color
    }
    
    if(parameters.collisionVisualisation){  // if true, spawn a sphere on collision points
        const geo = new THREE.SphereGeometry(velocity/15)
        const mesh = new THREE.Mesh(geo, new THREE.MeshNormalMaterial())
        mesh.position.set(position.x, position.y, 0)
        scene.add(mesh)
    }
}

function earthquake(){
    var impulse = new THREE.Vector3()
    objectsToUpdate.forEach(element => {
        impulse = new THREE.Vector3(rand(-parameters.earthquakeForce, parameters.earthquakeForce), rand(-parameters.earthquakeForce, parameters.earthquakeForce), 0)
        element.body.applyImpulse( impulse, CANNON.Vec3.ZERO )
    });
}

// Update /////
const clock = new THREE.Clock()
let oldElapsedTime = 0

const tick = () =>
{
    const elapsedTime = clock.getElapsedTime()
    const deltaTime = elapsedTime - oldElapsedTime
    oldElapsedTime = elapsedTime

    if(fontLoadFlag){
        onFontsLoaded()
        fontLoadFlag = false
    }

    // Update physics
    world.step(1 / 60, deltaTime, 3)
    if(objectsToUpdate.length > 0){
        //console.log(objectsToUpdate)
    }
    for(const object of objectsToUpdate)
    {
        object.mesh.position.set(object.body.position.x, object.body.position.y, 0)
        object.mesh.quaternion.copy(object.body.quaternion)

        //var euler = new CANNON.Vec3()         # for sprite rotation
        //object.body.quaternion.toEuler(euler, 'YZX')
        //object.mesh.material.rotation = euler.z

        if(object.mesh.position.x > maxX || object.mesh.position.x < minX || object.mesh.position.y > maxY || object.mesh.position.y < minY){
            // check if any of the letters escape the bounds, reset all
            resetAll()
        }
    }

    if(sleepingBodies >= letters.length){       //check if all the letters are sleeping, then earthquake them
        console.log("all bodies sleeping")
        earthquake()
        //maybe add randomness here
    }

    if(parameters.cannonDebugEnabled) cannonDebugger.update()

    // Render
    renderer.render(scene, activeCamera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()

function rand(min, max){    // inclusive
    return Math.floor(Math.random() * (max - min + 1) + min)
}

function updateCamType(){

    if(useOrtho){    // true == use orthographic camera
        activeCamera = orthoCamera
    }
    else{               // Use perspective camera with orbit controls
        activeCamera = perspectiveCamera
    }
}

function resetAll(){
    resetLetterPosition()
    randomiseAllTextures()
   // randomiseAllFonts()
   // randomiseAllColours()
}

function resetLetterPosition(){
    // reset the position of each body, as well as velocity, angle, and angular velocity
    for(var i = 0; i < letters.length ; i++){
        var pos = objectsToUpdate[i].mesh.userData.startPos
        objectsToUpdate[i].body.position.set(pos.x, pos.y, pos.z)
        objectsToUpdate[i].body.velocity.set(0,0,0)
        objectsToUpdate[i].body.quaternion.setFromEuler(0,0,0, 'XYZ')
        objectsToUpdate[i].body.angularVelocity.set(0,0,0)
    }
}

function randomiseAllTextures(){
    letters.forEach(element =>{
        element.material.map = getTextureByLetter(element.userData.letter)
        element.material.color = getRandomListElement(colours)
    })
}

function setAllStyles(i){       // Set all the letters to a certain style
    letters.forEach(element => {
        element.material.map = getListByLetter(element.userData.letter)[i]
    });
}

function setAllColours(colour){
    letters.forEach(element => {
        element.material.color = colour
    });
}

function randomiseAllFonts(){
    letters.forEach(element => {

        let newGeo = new TextGeometry(
            element.userData.letter,
            {
                font: getRandomListElement(fonts),
                size: 0.35,
                height: 0.02,
                curveSegments: 12,
                bevelEnabled: true,
                bevelThickness: 0.001,
                bevelSize: 0.002,
                bevelOffset: 0,
                bevelSegments: 5
            }
        )
        newGeo.computeBoundingBox()
        newGeo.center()
        
        element.geometry.dispose()
        element.geometry = newGeo
    });
}

function randomiseAllColours(){
    letters.forEach(element => {
        let newMat = new THREE.MeshBasicMaterial( { color: getRandomListElement(colours) })

        element.material.dispose()
        element.material = newMat
    });
}

function setGravity(x, y){
    world.gravity.set(x,y,0)
    //console.log("Gravity set to x: " + x + "  y: " + y)
}

function showUITipHTML(){
    uiTipHTML.hidden = false

    setTimeout(function(){ uiTipHTML.hidden = true }, 10000)
}

let currentStyle = 0

// Events /////
window.addEventListener('keydown', function(event) {
    console.log(event.key)

    if(!parameters.userInput){
        // html prompt to press U to open UI
        showUITipHTML()
    }

    if(event.key == "u"){
        if(debugGui._hidden){
            debugGui.show()
        } 
        else{
            debugGui.hide()
        }
        parameters.userInput = !parameters.userInput
        toggleUserInput()
        uiTipHTML.hidden = true
        controlsHTML.hidden = !parameters.userInput
    }

    if(parameters.userInput){
        switch(event.key){
            case " ":       // space bar
                resetAll()
                break;
            case "ArrowRight":
                setAllStyles(currentStyle)
                currentStyle++
                if(currentStyle >= styleNum) currentStyle = 0
                break;
            case "ArrowLeft":
                setAllStyles(currentStyle)
                currentStyle--
                if(currentStyle < 0) currentStyle = styleNum - 1
                break;
        }   
    }

    if(parameters.typeInput) createLetter(event.key, getRandomListElement(fonts), new THREE.Vector3(0,0,0))    //if type input is enabled, create letter with the input

    if(event.key.charCodeAt(0) >= 48 && event.key.charCodeAt(0) <= 57){     // if input is a number key, send it to microbit with delimiter
        setAllStyles(event.key)
    }
})

window.addEventListener('mousemove', (event) => {
    mouse.x = event.clientX / sizes.width * 2 - 1
    mouse.y = - (event.clientY / sizes.height) * 2 + 1

    if(parameters.mouseGravity) setGravity(mouse.x * parameters.gravityLimit, mouse.y * parameters.gravityLimit)
})

window.addEventListener('click', (event) => {
    console.log("left click")
    if(parameters.userInput) resetAll()

    if(!parameters.userInput){
        showUITipHTML()
    }
})

window.addEventListener('contextmenu', (event) => {
    console.log("right click")
    if(parameters.userInput) earthquake()

    if(!parameters.userInput){
        showUITipHTML()
    }
})

window.addEventListener('resize', () =>
{
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight
    
    // Update camera
    activeCamera.aspect = sizes.width / sizes.height
    activeCamera.updateProjectionMatrix()
    
    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    calculateScreenEdgePositon()
})

function normaliseInRange(val, oldMin, oldMax, newMin, newMax){
    return newMin + (val - oldMin) * (newMax - newMin) / (oldMax - oldMin)
}