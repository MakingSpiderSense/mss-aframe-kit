/**
 * Arm Swing Movement Component
 *
 * Description: `arm-swing-movement` enables intuitive, full-body locomotion in VR by translating natural arm-swinging gestures into forward (or backward) movement. This component is ideal for VR experiences where you want users to physically feel like they're walking or jogging through the environment - without the need for specialized hardware like an omnidirectional treadmill. It uses the Z-axis reversal of each controller to detect "steps", dynamically calculates a target speed, and moves the player rig accordingly. It supports nav-mesh constrained movement, adjustable smoothing, speed limits, and even synchronized footstep sound playback for added realism.
 *
 * Limitations:
 * - The formula that converts steps/sec to m/s to is based on the average adult height. A height parameter could be added to the schema in the future.
 */
AFRAME.registerComponent('arm-swing-movement', {
    schema: {
        enabled: {type: 'boolean', default: true}, // Enable or disable the component
        leftController: {type: 'selector', default: '[oculus-touch-controls*="hand: left"], [oculus-touch-controls*="hand:left"], [meta-touch-controls*="hand: left"], [meta-touch-controls*="hand:left"]'}, // Selector for left controller
        rightController: {type: 'selector', default: '[oculus-touch-controls*="hand: right"], [oculus-touch-controls*="hand:right"], [meta-touch-controls*="hand: right"], [meta-touch-controls*="hand:right"]'}, // Selector for right controller
        speedFactor: {type: 'number', default: 1}, // Multiplier for movement speed
        smoothingTime: {type: 'number', default: 500}, // Time (ms) to smooth speed changes (e.g., at 500ms, a sudden stop from 6 m/s takes 500ms to reach 0)
        minSpeed: {type: 'number', default: null}, // Minimum speed (m/s) to consider the user moving. If null, .6 * speedFactor is used.
        maxSpeed: {type: 'number', default: null}, // Maximum speed (m/s) the user can move. If null, 10 * speedFactor is used.
        swingTimeout: {type: 'number', default: 700}, // Time in ms to wait before stopping movement when no new swings are detected
        avgDirectionSampleInterval: { type: 'number', default: 100 }, // Milliseconds between directional samples
        avgDirectionBufferSize: { type: 'number', default: 20 }, // Number of directional samples to store in buffer
        reverseButtonEvent: { type: 'string', default: '' }, // Event name to hold for reverse movement (any of the events that end in 'down' or 'start' are valid)
        reverseButtonHand: { type: 'string', default: '' }, // Hand to use for reverse button event ('left', 'right', or '' for both)
        debug: { type: 'boolean', default: false }, // Show debug arrows and console logs if true
        soundEntity: { type: 'selector', default: '' }, // Entity with sound component (typically the sound of footsteps)
        soundVolume: { type: 'number', default: 1 }, // Volume of the sound (0 to 1)
        oneStepPlaybackRate: { type: 'number', default: 1 } // Base playback rate when moving at one step per second. Adjusts dynamically based on speed of steps.
    },
    init: function() {
        // If not enabled, return
        if (!this.data.enabled) { return; }
        // Create controller arrows (left and right)
        this.controllerArrows = [];
        const left = this.createControllerArrow('left');
        const right = this.createControllerArrow('right');
        if (left) this.controllerArrows.push(left);
        if (right) this.controllerArrows.push(right);
        // Create main average arrow (averages direction of both hands)
        this.avgArrow = this.createAvgDirectionArrow();
        // Set up buffer of recent directional samples and sampling timer
        this.samples = [];
        this.timeSinceLastSample = 0;
        // Track if reverse button is held
        this.reverseHeld = false;
        if (this.data.reverseButtonEvent) {
            const downEvent = this.data.reverseButtonEvent;
            const upEvent = downEvent.replace(/(?:down|start)$/, match => match === 'down' ? 'up' : 'end');
            let reverseElement;
            if (this.data.reverseButtonHand === 'left') {
                reverseElement = this.data.leftController;
            } else if (this.data.reverseButtonHand === 'right') {
                reverseElement = this.data.rightController;
            } else {
                reverseElement = this.el;
            }
            reverseElement.addEventListener(downEvent, () => { this.reverseHeld = true; });
            reverseElement.addEventListener(upEvent,   () => { this.reverseHeld = false; });
        }
        // Set up sound element and set volume
        this.audioEl = this.data.soundEntity || null;
        if (this.audioEl) { this.audioEl.volume = this.data.soundVolume; }
        // Set up other properties
        this.hands = {
            left: {entity: this.data.leftController, lastZ: null, lastDirection: null, lastSwingTime: null, recentSwings: []},
            right: {entity: this.data.rightController, lastZ: null, lastDirection: null, lastSwingTime: null, recentSwings: []}
        };
        this.currentSpeed = 0;
        this.swingDetectThreshold = 0.01; // Minimum change/frame in meters in z direction to consider movement
        this.moving = false; // Flag to track whether the user is moving
    },
    tick: function(time, timeDelta) {
        // If not enabled, return
        if (!this.data.enabled) { return; }
        // Update direction every so often
        this.timeSinceLastSample += timeDelta;
        //     Update the direction every `avgDirectionSampleInterval` milliseconds
        if (this.timeSinceLastSample >= this.data.avgDirectionSampleInterval) {
            // Reset the sample timer
            this.timeSinceLastSample -= this.data.avgDirectionSampleInterval;
            this.updateDirection();
        }
        // Process each hand.
        for (let handKey in this.hands) {
            let hand = this.hands[handKey];
            if (!hand.entity) { continue; }
            let worldPos = new THREE.Vector3();
            hand.entity.object3D.getWorldPosition(worldPos);
            // Convert world position to rig's (this.el) local space.
            let currentZ;
            if (this.el.avgDirectionVec) {
                // If the direction vector is set, use it to calculate the Z position.
                let rigPos = new THREE.Vector3();
                this.el.object3D.getWorldPosition(rigPos);
                let relativePos = worldPos.clone().sub(rigPos);
                currentZ = relativePos.dot(this.el.avgDirectionVec);
            } else {
                let localPos = this.el.object3D.worldToLocal(worldPos.clone());
                currentZ = localPos.z;
            }
            if (hand.lastZ === null) { hand.lastZ = currentZ; continue; }
            let diff = currentZ - hand.lastZ;
            let newDirection = hand.lastDirection;
            if (diff > this.swingDetectThreshold) { newDirection = 'positive'; }
            else if (diff < -this.swingDetectThreshold) { newDirection = 'negative'; }
            // When a direction reversal is detected, record a swing event.
            if (hand.lastDirection && newDirection && newDirection !== hand.lastDirection) {
                if (hand.lastSwingTime !== null) {
                    let period = time - hand.lastSwingTime;
                    // If the period is less than 150ms, ignore it - it's nearly impossible and probably a controller shake.
                    if (period > 150) {
                        hand.recentSwings.push(period);
                        if (hand.recentSwings.length > 6) { hand.recentSwings.shift(); }
                    }
                }
                hand.lastSwingTime = time;
            }
            hand.lastDirection = newDirection;
            hand.lastZ = currentZ;
        }
        // Clear recentSwings if no new swings are detected within swingTimeout.
        for (let handKey in this.hands) {
            let hand = this.hands[handKey];
            if (hand.lastSwingTime !== null && (time - hand.lastSwingTime > this.data.swingTimeout)) {
                hand.recentSwings = [];
                hand.lastSwingTime = null;
                hand.lastDirection = null;
            }
        }
        // Calculate average swing time from both hands.
        let recentSwings = [];
        for (let handKey in this.hands) {
            recentSwings = recentSwings.concat(this.hands[handKey].recentSwings);
        }
        // Make sure there are at least 10 swings and none are zero.
        const recentSwingsLength = recentSwings.length;
        recentSwings = recentSwings.filter(swingTime => swingTime > 0);
        if (recentSwingsLength < 10) {
            // Push until we have exactly 10 swings.
            let numToAdd = 10 - recentSwingsLength;
            for (let i = 0; i < numToAdd; i++) {
                recentSwings.push(800); // Add 800ms to fill the array.
            }
        }
        let avgSwingTime = 0; // Time it takes to swing arms back to forward and vice versa (direction reversals).
        // Reduce array to sum of swing times and divide by length to get average.
        avgSwingTime = recentSwings.reduce((sum, swingTime) => sum + swingTime, 0) / recentSwings.length;
        // Compute target speed based on swing frequency (if no swings, target speed is 0).
        let targetSpeed = 0;
        const stepsPerSecond = 1000 / avgSwingTime; // Convert avgSwingTime to steps/second, assuming an arm swing is a step.
        if (avgSwingTime > 0) {
            // Use the custom formula based on real-world data: y = 3.45 * x - 3.95, where x is steps/sec and y is speed (m/s).
            targetSpeed = 3.45 * stepsPerSecond - 3.95;
            // Multiply by speedFactor to adjust speed
            targetSpeed *= this.data.speedFactor;
            // Clamp target speed to maxSpeed if set
            if (this.data.maxSpeed) {
                targetSpeed = Math.min(targetSpeed, this.data.maxSpeed);
            } else {
                targetSpeed = Math.min(targetSpeed, 10 * this.data.speedFactor); // Default max speed is 10 m/s
            }
        }
        // If the computed speed is below the minimum, stop moving.
        const minSpeedThreshold = this.data.minSpeed || (0.6 * this.data.speedFactor);
        if (targetSpeed < minSpeedThreshold) {
            targetSpeed = 0;
            this.moving = false;
        } else {
            this.moving = true;
        }
        // Smoothly interpolate current speed toward target speed.
        this.currentSpeed += (targetSpeed - this.currentSpeed) * (timeDelta / this.data.smoothingTime);
        this.currentSpeed = Math.max(0, this.currentSpeed); // Avoid edge case of negative speed
        // Update sound playback rate based on current step rate
        if (this.audioEl) {
            this.audioEl.playbackRate = this.data.oneStepPlaybackRate * stepsPerSecond;
            if (this.moving) {
                if (this.audioEl.paused) { this.audioEl.play(); }
            } else {
                if (!this.audioEl.paused) { this.audioEl.pause(); }
            }
        }
        // Debugging: Output stats
        if (this.data.debug) {
            const recentSwingsString = recentSwings.map(swingTime => Math.round(swingTime)).join(', ');
            console.log(`Steps/sec: ${stepsPerSecond.toFixed(1)}, Target m/s: ${targetSpeed.toFixed(1)}, Current m/s: ${this.currentSpeed.toFixed(1)}, avgSwingTime: ${avgSwingTime.toFixed(1)}, recentSwings: [${recentSwingsString}]`);
        }
        // Move the rig forward.
        let distance = this.currentSpeed * (timeDelta / 1000);
        let forward = new THREE.Vector3();
        if (this.el.avgDirectionVec) {
            // Use direction from the avgDirectionVec if available
            forward.copy(this.el.avgDirectionVec).negate();
        } else {
            // Fallback if avgDirectionVec is not present
            this.el.object3D.getWorldDirection(forward);
            // Update rig's position by moving it forward.
            forward.negate();
        }
        // If movement-controls is using nav-mesh, clamp movement to mesh
        let mc = this.el.components['movement-controls'];
        let navSystem = this.el.sceneEl.systems.nav;
        if (mc && mc.data.constrainToNavMesh && navSystem) {
            let start = this.el.object3D.position.clone(); // Grab rig's current world‑position and make a copy to do the math on
            let end = start.clone().add(forward.clone().multiplyScalar(distance)); // Compute the *desired* end position by moving “forward” by your computed distance
            // Set to movement-controls' navNode and navGroup to the ones that are currently in use, or get them from the nav-mesh system.
            let navGroup = mc.navGroup || navSystem.getGroup(start);
            let navNode  = mc.navNode  || navSystem.getNode(start, navGroup);
            let clampedEnd = new THREE.Vector3(); // Prepare an empty vector to receive the *clamped* end point.
            let newNavNode = navSystem.clampStep(start, end, navGroup, navNode, clampedEnd); // Ask the nav‑mesh system to clamp your straight‑line move onto the mesh surface.
            this.el.object3D.position.copy(clampedEnd);
            // Sync the movement-controls component's navNode and navGroup to the new ones.
            mc.navGroup = navGroup;
            mc.navNode = newNavNode;
        } else {
            // Default unconstrained movement
            this.el.object3D.position.add(forward.multiplyScalar(distance));
        }
    },
    createControllerArrow: function(hand) {
        const controller = this.el.querySelector(`#${hand}-hand`);
        if (!controller) return null;
        const arrow = document.createElement('a-entity');
        arrow.setAttribute('class', 'controller-arrow');
        arrow.setAttribute('position', '0 -0.083 -0.167');
        arrow.setAttribute('rotation', '-30 0 0');
        arrow.innerHTML = `
            <a-cylinder color="#400040" height="0.5" radius="0.01" position="0 0 0" rotation="-90 0 0"></a-cylinder>
            <a-cone color="#400040" height="0.2" radius-bottom="0.05" radius-top="0" position="0 0 -0.2" rotation="-90 0 0"></a-cone>
        `;
        controller.appendChild(arrow);
        if (!this.data.debug) {
            arrow.setAttribute('visible', false);
        }
        return arrow;
    },
    createAvgDirectionArrow: function() {
        const arrow = document.createElement('a-entity');
        arrow.setAttribute('class', 'avg-arrow');
        arrow.setAttribute('position', '0 1 -0.7');
        arrow.setAttribute('rotation', '0 0 0');
        arrow.innerHTML = `
            <a-cylinder color="#FFA500" height="0.3" radius="0.02" position="0 0 0" rotation="-90 0 0"></a-cylinder>
            <a-cone color="#FFA500" height="0.2" radius-bottom="0.05" radius-top="0" position="0 0 -0.25" rotation="-90 0 0"></a-cone>
        `;
        this.el.appendChild(arrow);
        if (!this.data.debug) {
            arrow.setAttribute('visible', false);
        }
        return arrow;
    },
    updateDirection: function() {
        const directions = [];
        // Collect each arrow's forward direction
        for (const arrowEl of this.controllerArrows) {
            if (!arrowEl) continue; // Skip if missing
            const dir = new THREE.Vector3();
            arrowEl.object3D.getWorldDirection(dir); // Get world -Z axis
            dir.y = 0;
            dir.normalize(); // Project onto XZ plane
            directions.push(dir);
        }
        if (directions.length === 0) return; // Nothing to average
        // Average direction of both controllers
        let avgDir = directions
            .reduce((acc, v) => acc.add(v), new THREE.Vector3())
            .divideScalar(directions.length)
            .normalize();
        // If reverse button is held, reverse the direction
        if (this.reverseHeld) { avgDir.negate(); }
        // Store averaged sample in buffer
        this.samples.push(avgDir.clone());
        // Maintain a fixed-length ring buffer
        if (this.samples.length > this.data.avgDirectionBufferSize) {
            this.samples.shift();
        }
        // Average direction over the buffer
        const sum = this.samples
            .reduce((acc, v) => acc.add(v), new THREE.Vector3())
            .divideScalar(this.samples.length);
        // Compute yaw in degrees (world space)
        const worldYaw = Math.atan2(sum.x, sum.z) * (180 / Math.PI);
        // Convert to rig-local yaw so arrow stays aligned regardless of rig rotation
        const rigYaw = this.el.object3D.rotation.y * (180 / Math.PI); // Radians to degrees
        const localYaw = worldYaw - rigYaw;
        // Orient the average arrow based on averaged controller direction
        this.avgArrow.setAttribute('rotation', { x: 0, y: localYaw, z: 0 });
        // Store direction data on the rig element for other components
        this.el.avgDirectionYaw = worldYaw; // Degrees relative to scene
        this.el.avgDirectionVec = sum.clone(); // Normalized XZ vector
    },
});