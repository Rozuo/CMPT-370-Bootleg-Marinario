var total = 0;
var state = {};
// mario model from https://sketchfab.com/3d-models/rigged-mario-free-099c5106369e4e7db70876c320e9a634
// koopa model from https://www.turbosquid.com/FullPreview/Index.cfm/ID/1301668
// goomba model from https://www.turbosquid.com/FullPreview/Index.cfm/ID/1292471
// question mark block texture: https://nintendo.fandom.com/wiki/%3F_Block
// question mark block model: https://sketchfab.com/3d-models/question-mark-block-super-mario-bros-be464a0b81384de79f49d38f5632c3f3


//centroid attribute not needed? Might save time at load to remove if having performance issues
    //eg: it calculates centroid for objects with tens of thousands of verts

var stats = new Stats();
window.onload = () => {
    parseSceneFile("./statefiles/marioScene.json", state, main);
}

/**
 * 
 * @param {object - contains vertex, normal, uv information for the mesh to be made} mesh 
 * @param {object - the game object that will use the mesh information} object 
 * @purpose - Helper function called as a callback function when the mesh is done loading for the object
 */
function createMesh(mesh, object) {
    if (object.type === "mesh") {
        let testModel = new Model(state.gl, object.name, mesh, object.parent, object.enemy, object.material.ambient, object.material.diffuse, object.material.specular, object.material.n, object.material.alpha, object.texture);
        testModel.vertShader = state.vertShaderSample;
        testModel.fragShader = state.fragShaderSample;
        testModel.setup();
        testModel.model.position = object.position;
        if (object.scale) {
            testModel.scale(object.scale);
        }
        addObjectToScene(state, testModel);
    } else {
        let testLight = new Light(state.gl, object.name, mesh, object.parent, object.material.ambient, object.material.diffuse, object.material.specular, object.material.n, object.material.alpha, object.colour, object.strength);
        testLight.vertShader = state.vertShaderSample;
        testLight.fragShader = state.fragShaderSample;
        testLight.setup();
        testLight.model.position = object.position;
        if (object.scale) {
            testLight.scale(object.scale);
        }

        addObjectToScene(state, testLight);
    }
}

/**
 * 
 * @param {string - type of object to be added to the scene} type 
 * @param {string - url of the model being added to the game} url 
 * @purpose **WIP** Adds a new object to the scene from using the gui to add said object 
 */
function addObject(type, url = null) {
    if (type === "Cube") {
        let testCube = new Cube(state.gl, "Cube", null, [0.1, 0.1, 0.1], [0.0, 0.0, 0.0], [0.0, 0.0, 0.0], 10, 1.0);
        testCube.vertShader = state.vertShaderSample;
        testCube.fragShader = state.fragShaderSample;
        testCube.setup();

        addObjectToScene(state, testCube);
        createSceneGui(state);
    }
}

function main() {
    stats.showPanel(0);
    document.getElementById("fps").appendChild(stats.dom);
    //document.body.appendChild( stats.dom );
    const canvas = document.querySelector("#glCanvas");

    // Initialize the WebGL2 context
    var gl = canvas.getContext("webgl2");

    // Only continue if WebGL2 is available and working
    if (gl === null) {
        printError('WebGL 2 not supported by your browser',
            'Check to see you are using a <a href="https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API#WebGL_2_2" class="alert-link">modern browser</a>.');
        return;
    }

    const vertShaderSample =
        `#version 300 es
        in vec3 aPosition;
        in vec3 aNormal;
        in vec2 aUV;
        in vec3 aVertBitang;

        uniform mat4 uProjectionMatrix;
        uniform mat4 uViewMatrix;
        uniform mat4 uModelMatrix;
        uniform mat4 normalMatrix;
        
        out vec3 oFragPosition;
        out vec3 oCameraPosition;
        out vec3 oNormal;
        out vec3 normalInterp;
        out vec2 oUV;
        out vec3 oVertBitang;

        void main() {
            // Postion of the fragment in world space
            //gl_Position = vec4(aPosition, 1.0);
            gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);

            oFragPosition = (uModelMatrix * vec4(aPosition, 1.0)).xyz;
            oNormal = normalize((uModelMatrix * vec4(aNormal, 1.0)).xyz);
            normalInterp = vec3(normalMatrix * vec4(aNormal, 0.0));
            oUV = aUV;
            oVertBitang = aVertBitang;
        }
        `;

    const fragShaderSample =
        `#version 300 es
        #define MAX_LIGHTS 128
        precision highp float;

        in vec3 oFragPosition;
        in vec3 oNormal;
        in vec3 normalInterp;
        in vec2 oUV;
        in vec3 oVertBitang;
        
        uniform vec3 uCameraPosition;
        uniform int numLights;
        uniform vec3 diffuseVal;
        uniform vec3 ambientVal;
        uniform vec3 specularVal;
        uniform float nVal;
        uniform float alphaVal;
        uniform sampler2D uTexture;
        uniform int samplerExists;
        uniform int uTextureNormExists;
        uniform sampler2D uTextureNorm;
        uniform vec3 uLightPositions[MAX_LIGHTS];
        uniform vec3 uLightColours[MAX_LIGHTS];
        uniform float uLightStrengths[MAX_LIGHTS];
     
        out vec4 fragColor;

        void main() {
            vec3 normal = normalize(normalInterp);
            vec3 ambient = vec3(0,0,0);
            vec3 diffuse = vec3(0,0,0);
            vec3 specular = vec3(0,0,0);
            vec3 lightDirection;
            float lightDistance;

            if (uTextureNormExists == 1) {
                normal = texture(uTextureNorm, oUV).xyz;
                normal = 2.0 * normal - 1.0;
                normal = normal * vec3(5.0, 5.0, 5.0);
                vec3 biTangent = cross(oNormal, oVertBitang);
                mat3 nMatrix = mat3(oVertBitang, biTangent, oNormal);
                normal = normalize(nMatrix * normal);
            }

            for (int i = 0; i < numLights; i++) {
                lightDirection = normalize(uLightPositions[i] - oFragPosition);
                lightDistance = distance(uLightPositions[i], oFragPosition);

                //ambient
                ambient += (ambientVal * uLightColours[i]) * uLightStrengths[i];

                //diffuse
                float NdotL = max(dot(lightDirection, normal), 0.0);
                diffuse += ((diffuseVal * uLightColours[i]) * NdotL * uLightStrengths[i]) / lightDistance;

                //specular
                vec3 nCameraPosition = normalize(uCameraPosition); // Normalize the camera position
                vec3 V = normalize(nCameraPosition - oFragPosition);
                vec3 H = normalize(V + lightDirection); // H = V + L normalized

                if (NdotL > 0.0f)
                {
                    float NDotH = max(dot(normal, H), 0.0);
                    float NHPow = pow(NDotH, nVal); // (N dot H)^n
                    specular += ((specularVal * uLightColours[i]) * NHPow) / lightDistance;
                }
            }

            vec4 textureColor = texture(uTexture, oUV);

            if (samplerExists == 1) {
                fragColor = vec4((ambient + diffuse + specular) * textureColor.rgb, 1.0);
            } else {
                fragColor = vec4(ambient + diffuse + specular, 1.0);
            }
            
        }
        `;

    state = {
        ...state,
        gl,
        vertShaderSample,
        fragShaderSample,
        canvas: canvas,
        objectCount: 0,
        objectTable: {},
        lightIndices: [],
        keyboard: {},
        mouse: { sensitivity: 0.2 },
        gameStarted: false,

        isFirstPerson: false,
        jump: 0,
        swole: false,
        invincible: 0,
        bounce: 0,
        bounceLeft: 0,
        bounceRight: 0,
        collision: 0,
        previous: vec3.fromValues(0.0, 0.0, 0.25),
        camera: {
            name: 'camera',
            position: vec3.fromValues(-10.0, 5.0, 0.0),
            center: vec3.fromValues(0.0, 5.0, 0.0),
            up: vec3.fromValues(0.0, 1.0, 0.0),
            pitch: 0,
            yaw: 0,
            roll: 0
        },
        samplerExists: 0,
        samplerNormExists: 0
    };

    state.numLights = state.lights.length;

    //iterate through the level's objects and add them
    state.level.objects.map((object) => {
        if (object.type === "mesh" || object.type === "light") {
            parseOBJFileToJSON(object.model, createMesh, object);
        } else if (object.type === "cube") {
            let tempCube = new Cube(gl, object.name, object.parent, object.material.ambient, object.material.diffuse, object.material.specular, object.material.n, object.material.alpha, object.texture, object.textureNorm);
            tempCube.vertShader = vertShaderSample;
            tempCube.fragShader = fragShaderSample;
            tempCube.setup();
            tempCube.model.position = vec3.fromValues(object.position[0], object.position[1], object.position[2]);
            if (object.scale) {
                tempCube.scale(object.scale);
            }
            addObjectToScene(state, tempCube);
        } else if (object.type === "plane") {
            let tempPlane = new Plane(gl, object.name, object.parent, object.material.ambient, object.material.diffuse, object.material.specular, object.material.n, object.material.alpha, object.texture, object.textureNorm);
            tempPlane.vertShader = vertShaderSample;
            tempPlane.fragShader = fragShaderSample;
            tempPlane.setup();

            tempPlane.model.position = vec3.fromValues(object.position[0], object.position[1], object.position[2]);
            if (object.scale) {
                tempPlane.scale(object.scale);
            }
            addObjectToScene(state, tempPlane);
        }
    })

    //populate array of platforms for collision checking
    var platforms = [];

    //iterate through object list
    for (let i = 0; i < state.objectCount; i++){
        if (state.objects[i].name.substring(0, 8) === "platform"){  //add all items with platform in their name to the list
            platforms.push(state.objects[i]);
        }
    }

    //do the same for enemies
    var enemies = [];

    for (let i = 0; i < state.level.objects.length; i++){
        //console.log(state.level.objects[i]);
        if (state.level.objects[i].role === "enemy"){     //add all enemies to the list
            enemies.push(state.level.objects[i]);
        }
    } 

    //variable for keeping track of time elapsed
    var d = new Date();
    console.log(d.getTime());

    //separate variable for exit object
    let exit = getObject(state, "exit");

    
    //setup mouse click listener                
    /*
    canvas.addEventListener('click', (event) => {
        getMousePick(event, state);
    }) */

                            //pass collision lists to the render function
    startRendering(gl, state, platforms, enemies, exit);

}

/**
 * 
 * @param {object - object containing scene values} state 
 * @param {object - the object to be added to the scene} object 
 * @purpose - Helper function for adding a new object to the scene and refreshing the GUI
 */
function addObjectToScene(state, object) {
    //console.log(object);
    if (object.type === "light") {
        state.lightIndices.push(state.objectCount);
        state.numLights++;
    }

    object.name = object.name;
    state.objects.push(object);
    state.objectTable[object.name] = state.objectCount;
    state.objectCount++;
    createSceneGui(state);
}

/**
 * 
 * @param {gl context} gl 
 * @param {object - object containing scene values} state 
 * @purpose - Calls the drawscene per frame
 */
function startRendering(gl, state, platforms, enemies, exit) {
    // A variable for keeping track of time between frames
    var then = 0.0;

    // This function is called when we want to render a frame to the canvas
    function render(now) {
        stats.begin();
        now *= 0.001; // convert to seconds
        const deltaTime = now - then;
        then = now;

        state.deltaTime = deltaTime;

        //initialize some objects that aren't passed to function
        let player = getObject(state, "marinario");
        let apple = getObject(state, "apple");

        //wait until the scene is completely loaded to render it
        if (state.numberOfObjectsToLoad <= state.objects.length) {
            if (!state.gameStarted) {
                startGame(state);
                state.gameStarted = true;
            }

            //keeps track of player's position from last frame - for collision direction detection
            state.previous = vec3.fromValues(player.model.position[0], player.model.position[1], player.model.position[2]);

    //PLAYER CONTROLS
            //POTENTIAL TODO: direction facing tag, rotate object to face walking direction

            if (state.keyboard["w"]) {
                //if in first person and not currently bouncing back
                if (state.isFirstPerson && !state.bounceRight){
                    //move forward
                    vec3.add(player.model.position, player.model.position, vec3.fromValues(0.0, 0.0, 0.2));
                }
            }
            if (state.keyboard["s"]) {
                //if in first person and not currently bouncing forward
                if (state.isFirstPerson && !state.bounceRight){
                    //move backward
                    vec3.add(player.model.position, player.model.position, vec3.fromValues(0.0, 0.0, -0.2));
                }
            }
            if (state.keyboard["a"]) {
                //if in "2d" view and not currently bouncing right
                if (!state.isFirstPerson && !state.bounceRight){
                    //move left
                    vec3.add(player.model.position, player.model.position, vec3.fromValues(0.0, 0.0, -0.2));
                }
            }
            if (state.keyboard["d"]) {
                //if in "2d" view and not currently bouncing left
                if (!state.isFirstPerson && !state.bounceLeft){
                    //move right
                    vec3.add(player.model.position, player.model.position, vec3.fromValues(0.0, 0.0, 0.2));
                }
            }

            //JUMP!
            if (state.jump > 0){
                //console.log("jumpu");
                state.jump--;   //decrease jump tick counter - see myGame.js for count
                player.model.position[1] += 0.15;    //y value increase per tick - jump speed
            }

    //PRELIMINARY COLLISIONS
            //pit-checker
            if ((player.model.position[1] < -2.5)){
                for(let i = 0; i < state.keyboard.length; i++){
                    state.keyboard[i] = false;
                }
                //patchwork solution to prevent multiple alerts from playing
                player.model.position[1] += 500;

                //message user, reload game
                alert("Game over");
                document.location.reload();
                }

            //exit-checker - checks player's position z value vs. exit's position
            if (Math.abs(player.model.position[2] - exit.model.position[2]) < 0.15){
                //patchwork solution to prevent multiple alerts from playing
                player.model.position[1] += 500;
                player.model.position[2] += 1;

                //message user, reload game
                alert("Level Clear!");
                document.location.reload();
                }


            //reset collision value before testing
            state.collision = 0;
            //platform collisions, compares player position to each platform in array
            for(let i = 0; i < platforms.length; i++){
                if (player.model.position[2] <= platforms[i].model.position[2] + (platforms[i].model.scale[2] /2) && //2.5 = half scale
                player.model.position[2] >= platforms[i].model.position[2] &&
                player.model.position[1] <= platforms[i].model.position[1] + 0.5 &&
                player.model.position[1] + 0.85 >= platforms[i].model.position[1]) {    //uses 0.85 as player height because of 0.15 move tick
                    //mark that a collision happened
                    state.collision = 1;
                    //variable to identify which platform was collided with
                    var collisionIndex = i;

                    //if stuck in a platform, move to top surface
                    if(Math.abs(player.model.position[1] - (platforms[i].model.position[1] + 0.5)) <
                        Math.abs(player.model.position[1] - platforms[i].model.position[1])){
                            //player.model.position[1] = platforms[i].model.position[1] + 0.65;
                                //currently bugs out apple hitbox
                    }
                }
            }
            
    //EVENTS           
            //gravity 
            //if no collision and not jumping, fall
            if (!state.collision){
                if (!state.jump){
                    player.model.position[1] -= 0.15;   //fall value per tick

                }
            }

            //if bouncing up
            if (state.bounce){
                //continue bounce sequence
                player.model.position[1] += 0.3;
                //decrement bounce counter
                state.bounce--;
            }

            //if bouncing left
            if (state.bounceLeft){
                //continue bounce, reduce counter
                player.model.position[2] -= 0.15;
                state.bounceLeft--;
            }

            //if bouncing right
            if (state.bounceRight){
                //continue bounce, reduce counter
                player.model.position[2] += 0.15;
                state.bounceRight--;
            }

            //if invincible
            if (state.invincible){
                if(state.invincible === 1){
                    //revert back to original appearance if invincibility is about to wear off
                    player.material.diffuse = vec3.fromValues(0.2, 0.2, 0.2);
                }
                //reduce counter
                state.invincible--;
            }

            //apple nom
            if(Math.abs(player.model.position[2] - apple.model.position[2]) < 0.5){
                if(Math.abs((player.model.position[1] + 0.25) - apple.model.position[1]) < 0.2){
                    //get swole
                    player.model.scale[1] *= 1.5;
                    player.model.scale[2] *= 1.2;
                    state.swole = true;
                    //"hide" apple
                    apple.model.position = vec3.fromValues(0.0, -4.0, -2.0);                                
                }
            }

    //ROLE-BASED COLLISION
            //enemy collision
            for (let i = 0; i < enemies.length; i++){
                if (player.model.position[2] <= enemies[i].position[2] + 0.5 && //2.5 = half scale
                player.model.position[2] >= enemies[i].position[2] - 0.5 &&
                player.model.position[1] <= enemies[i].position[1] + 0.5 &&
                player.model.position[1] + 0.85 >= enemies[i].position[1]) {
                    //console.log(enemies[i].name);
                    if (state.previous[1] > player.model.position[1] + 0.01){ //if player is colliding from above
                        console.log("squish");
                        state.bounce = 20;
                        player.model.position[1] += 0.15;
                        //enemies[i].position[1] -= 10; //quick fix to get enemy to disappear when hit
                    } else {
                        if (state.swole){
                            state.swole = false;
                            player.model.scale[1] *= 0.66;
                            player.model.scale[2] *= 0.84;
                            state.invincible = 100;
                            player.material.diffuse = vec3.fromValues(0.8, 0.8, 0.8);
                        } else {
                            if (!state.invincible){
                                for(let i = 0; i < state.keyboard.length; i++){
                                    state.keyboard[i] = false;
                                }
                                alert("Game over");
                                state.invincible = 100;
                                document.location.reload();

                            }
                        }
                    }
                }
            }


            //platform collision
            if (state.collision){

                //if player was moving up
                if (state.previous[1] < player.model.position[1]){

                    //if player collides from bottom
                    if (Math.abs(player.model.position[2] - platforms[collisionIndex].model.position[2] >
                        player.model.position[1] + 0.75 - platforms[collisionIndex].model.position[1]) ||
                        Math.abs(player.model.position[2] - (platforms[collisionIndex].model.position[2] + (platforms[collisionIndex].model.scale/2)) <
                        player.model.position[1] + 0.75 - platforms[collisionIndex].model.position[1])){
                            //headbonk, stop jump
                            state.jump = 0;
                            console.log("bonk");
                    }


                    //release apple from block
                    if(Math.abs(player.model.position[2] - apple.model.position[2]) < 0.5){
                        if(Math.abs(player.model.position[1] - apple.model.position[1]) < 1){
                            apple.model.position[1] += 0.5;
                        }
                    }
                    player.model.position[1] -= 0.15;   //move down slightly to get out of collision
                }

                    
                //if player was moving right (compare with object)
                if (state.previous[2] < platforms[collisionIndex].model.position[2]){
                    player.model.position[2] -= 0.15;
                    //begin bounce-off sequence
                    state.bounceLeft = 15;
                    console.log("right");
                }

                //if player was moving left
                if (state.previous[2] > platforms[collisionIndex].model.position[2] + platforms[collisionIndex].model.scale[2] /2 ){
                    player.model.position[2] += 0.15;
                    //begin bounce-off sequence
                    state.bounceRight = 15;
                    console.log("left");
                }
            }

    //VIEW CHANGE
            //toggle view to first person
            if (state.keyboard["c"]) {
                state.isFirstPerson = true;

                state.camera.position[0] = player.model.position[0];            //center of player
                state.camera.position[1] = player.model.position[1] + 0.80;     //head height
                state.camera.position[2] = player.model.position[2] + 0.2;      //front of player

                //looking in front of player
                state.camera.center = vec3.fromValues(player.model.position[0] + 0.25, 
                                                    player.model.position[1]+1,
                                                    player.model.position[2]+2);
            }

            //return view to "mock 2d"
            if (!state.keyboard["c"]) {
                state.isFirstPerson = false;
                state.camera.position[0] = -10;                                 //at a distance, broad view
                state.camera.position[1] = 5;                                   //positioned above player
                state.camera.position[2] = player.model.position[2];            // = player z value

                //looking straight on, slightly above player, at player z value
                state.camera.center = vec3.fromValues(0, 5, player.model.position[2]);
            }

            //Mouse-camera movement 0 debug
            if (state.mouse['camMove']) {
                //vec3.rotateY(state.camera.center, state.camera.center, state.camera.position, (state.camera.yaw - 0.25) * deltaTime * state.mouse.sensitivity);
                vec3.rotateY(state.camera.center, state.camera.center, state.camera.position, (-state.mouse.rateX * deltaTime * state.mouse.sensitivity));
            }

    //ENEMY MOVEMENT
            enemyPatrol(getObject(state, "goomba0"), 13, 23);
            enemyPatrol(getObject(state, "goomba1"), 30, 48);
            enemyPatrol(getObject(state, "goomba2"), 55, 65);
            enemyPatrol(getObject(state, "goomba3"), 100, 120);

            //enemyPatrol(getObject(state, "koopaBod"),-13, -23);


    //Draw/Render calls
            // Draw our scene
            drawScene(gl, deltaTime, state);
        }
        stats.end();
        // Request another frame when this one is done
        requestAnimationFrame(render);
    }

    // Draw the scene
    requestAnimationFrame(render);
}

/**
 * 
 * @param {gl context} gl 
 * @param {float - time from now-last} deltaTime 
 * @param {object - contains the state for the scene} state 
 * @purpose Iterate through game objects and render the objects aswell as update uniforms
 */
function drawScene(gl, deltaTime, state) {

    gl.clearColor(0.6, 0.6, 0.99, 1.0);
    gl.enable(gl.DEPTH_TEST); // Enable depth testing
    gl.depthFunc(gl.LEQUAL); // Near things obscure far things
    gl.clearDepth(1.0); // Clear everything
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    let lightPositionArray = [], lightColourArray = [], lightStrengthArray = [];

    for (let i = 0; i < state.lightIndices.length; i++) {
        let light = state.objects[state.lightIndices[i]];
        for (let j = 0; j < 3; j++) {
            lightPositionArray.push(light.model.position[j]);
            lightColourArray.push(light.colour[j]);
        }
        lightStrengthArray.push(light.strength);
    }

    state.objects.map((object) => {
        if (object.loaded) {

            gl.useProgram(object.programInfo.program);
            {

                var projectionMatrix = mat4.create();
                var fovy = 60.0 * Math.PI / 180.0; // Vertical field of view in radians
                var aspect = state.canvas.clientWidth / state.canvas.clientHeight; // Aspect ratio of the canvas
                var near = 0.1; // Near clipping plane
                var far = 100.0; // Far clipping plane

                mat4.perspective(projectionMatrix, fovy, aspect, near, far);

                gl.uniformMatrix4fv(object.programInfo.uniformLocations.projection, false, projectionMatrix);

                state.projectionMatrix = projectionMatrix;

                var viewMatrix = mat4.create();
                mat4.lookAt(
                    viewMatrix,
                    state.camera.position,
                    state.camera.center,
                    state.camera.up,
                );
                gl.uniformMatrix4fv(object.programInfo.uniformLocations.view, false, viewMatrix);

                gl.uniform3fv(object.programInfo.uniformLocations.cameraPosition, state.camera.position);


                state.viewMatrix = viewMatrix;

                var modelMatrix = mat4.create();
                var negCentroid = vec3.fromValues(0.0, 0.0, 0.0);
                vec3.negate(negCentroid, object.centroid);

                mat4.translate(modelMatrix, modelMatrix, object.model.position);
                mat4.translate(modelMatrix, modelMatrix, object.centroid);
                mat4.mul(modelMatrix, modelMatrix, object.model.rotation);
                mat4.translate(modelMatrix, modelMatrix, negCentroid);
                mat4.scale(modelMatrix, modelMatrix, object.model.scale);

                object.modelMatrix = modelMatrix;

                var normalMatrix = mat4.create();
                mat4.invert(normalMatrix, modelMatrix);
                mat4.transpose(normalMatrix, normalMatrix);

                gl.uniformMatrix4fv(object.programInfo.uniformLocations.model, false, modelMatrix);
                gl.uniformMatrix4fv(object.programInfo.uniformLocations.normalMatrix, false, normalMatrix);

                gl.uniform3fv(object.programInfo.uniformLocations.diffuseVal, object.material.diffuse);
                gl.uniform3fv(object.programInfo.uniformLocations.ambientVal, object.material.ambient);
                gl.uniform3fv(object.programInfo.uniformLocations.specularVal, object.material.specular);
                gl.uniform1f(object.programInfo.uniformLocations.nVal, object.material.n);

                gl.uniform1i(object.programInfo.uniformLocations.numLights, state.numLights);



                //use this check to wait until the light meshes are loaded properly
                if (lightColourArray.length > 0 && lightPositionArray.length > 0 && lightStrengthArray.length > 0) {
                    gl.uniform3fv(object.programInfo.uniformLocations.lightPositions, lightPositionArray);
                    gl.uniform3fv(object.programInfo.uniformLocations.lightColours, lightColourArray);
                    gl.uniform1fv(object.programInfo.uniformLocations.lightStrengths, lightStrengthArray);
                }

                {
                    // Bind the buffer we want to draw
                    gl.bindVertexArray(object.buffers.vao);

                    //check for diffuse texture and apply it
                    if (object.model.texture != null) {
                        state.samplerExists = 1;
                        gl.activeTexture(gl.TEXTURE0);
                        gl.uniform1i(object.programInfo.uniformLocations.samplerExists, state.samplerExists);
                        gl.uniform1i(object.programInfo.uniformLocations.sampler, 0);
                        gl.bindTexture(gl.TEXTURE_2D, object.model.texture);
                        
                    } else {
                        gl.activeTexture(gl.TEXTURE0);
                        state.samplerExists = 0;
                        gl.uniform1i(object.programInfo.uniformLocations.samplerExists, state.samplerExists);
                        gl.bindTexture(gl.TEXTURE_2D, null);
                    }

                    //check for normal texture and apply it
                    if (object.model.textureNorm != null) {
                        state.samplerNormExists = 1;
                        gl.activeTexture(gl.TEXTURE1);
                        gl.uniform1i(object.programInfo.uniformLocations.normalSamplerExists, state.samplerNormExists);
                        gl.uniform1i(object.programInfo.uniformLocations.normalSampler, 1);
                        gl.bindTexture(gl.TEXTURE_2D, object.model.textureNorm);
                        //console.log("here")
                    } else {
                        gl.activeTexture(gl.TEXTURE1);
                        state.samplerNormExists = 0;
                        gl.uniform1i(object.programInfo.uniformLocations.normalSamplerExists, state.samplerNormExists);
                        gl.bindTexture(gl.TEXTURE_2D, null);
                    }

                    // Draw the object
                    const offset = 0; // Number of elements to skip before starting

                    //if its a mesh then we don't use an index buffer and use drawArrays instead of drawElements
                    if (object.type === "mesh" || object.type === "light") {
                        gl.drawArrays(gl.TRIANGLES, offset, object.buffers.numVertices / 3);
                    } else {
                        gl.drawElements(gl.TRIANGLES, object.buffers.numVertices, gl.UNSIGNED_SHORT, offset);
                    }
                }
            }
        }
    });
}

/**
 *  This function is to calculate and constantly translate the enemies obj in either left or right directions
 * @param {object} obj 
 * @param {float} min 
 * @param {float} max 
 */

function enemyPatrol(obj, min, max){
    if(typeof obj == "undefined"){
        console.warn("WARNING: there is no objects in the state file");
    }

    var initialPosition = obj.model.position

    var positiveDirection = vec3.fromValues(0.0, 0.0, 0.03);
    var fromWhichWay = true;
    var negativeDirection = vec3.fromValues(0.0, 0.0, -0.03);

    // if we did not put in an enemy obj we leave
    if(obj.enemy != true){
        return;
    }
    
    if(obj.model.position[2] >= max){
        vec3.add(obj.model.position, obj.model.position, negativeDirection);
        obj.fromWhichWay = false;
    }
    else if(obj.model.position[2] <= min){
        vec3.add(obj.model.position, obj.model.position, positiveDirection);
        obj.fromWhichWay = true;
    }
    else{
        if(obj.fromWhichWay == true){
            vec3.add(obj.model.position, obj.model.position, positiveDirection);
        }
        else{
            vec3.add(obj.model.position, obj.model.position, negativeDirection);
        }
    }
}