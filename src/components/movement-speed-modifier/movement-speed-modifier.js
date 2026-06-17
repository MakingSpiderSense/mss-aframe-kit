/**
 * Movement Speed Modifier Component
 *
 * Description: Applies a reusable speed multiplier to both `movement-controls` and `arm-swing-movement`. It can optionally activate the multiplier from the left joystick, keyboard, or manually. It can also show camera-attached speed lines while boosted and play a sound when the speed increases.
 */
const movementSpeedModifierComponent = {
    schema: {
        enabled: { type: "boolean", default: true },
        multiplier: { type: "number", default: 1.5 }, // Multiplier to apply when active
        joystickEnabled: { type: "boolean", default: true }, // If true, left joystick click controls whether the multiplier is active
        keyboardEnabled: { type: "boolean", default: true }, // If true, holding left shift and W on desktop controls whether the multiplier is active
        leftController: { type: "selector", default: '[oculus-touch-controls*="hand: left"], [oculus-touch-controls*="hand:left"], [meta-touch-controls*="hand: left"], [meta-touch-controls*="hand:left"], [hand-controls*="hand: left"], [hand-controls*="hand:left"]' }, // Selector for left controller
        linesEnabled: { type: "boolean", default: true }, // Show speed lines while the applied multiplier is above 1
        lineColor: { type: "color", default: "#ffffff" }, // Color of the speed lines
        lineCount: { type: "number", default: 16 }, // Number of speed line entities to create
        lineOpacity: { type: "number", default: 0.1 }, // Opacity of visible speed lines
        lineDistance: { type: "number", default: 0.5 }, // Distance (meters) in front of the camera for speed lines
        linePatternInterval: { type: "number", default: 100 }, // Time in ms between random speed line pattern changes
        boostSound: { type: "selector", default: "" }, // Optional entity with sound component to play when multiplier increases
    },
    init: function () {
        // If not enabled, return
        if (!this.data.enabled) return;
        // Store base movement values so multiplier updates do not permanently overwrite them
        this.baseMovementControlsSpeed = null;
        this.baseArmSwingSpeedFactor = null;
        // Track input and multiplier state
        this.joystickActive = false; // Will be true while the left joystick is clicked and then held forward (becomes false the moment the joystick is no longer forward)
        this.keyboardShiftActive = false;
        this.keyboardForwardActive = false;
        this.manualBoostActive = false;
        this.currentAppliedMultiplier = 1; // Set to 1 initially as the boost needs to be triggered
        this.axisX = 0;
        this.axisY = 0;
        this.timeSinceLastLinePattern = 0;
        // Bind handlers to this component instance, and store the references so listeners can be removed later
        this.onThumbstickDown = this.onThumbstickDown.bind(this);
        this.onAxisMove = this.onAxisMove.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.onWindowBlur = this.onWindowBlur.bind(this);
        // Set up input listeners
        this.leftControllerEl = this.data.leftController;
        this.addLeftControllerListeners();
        this.addKeyboardListeners();
        // Create the speed line container and line elements
        this.lineContainer = null;
        this.lineElements = [];
        this.createSpeedLines();
        // Apply the initial speed state
        this.cacheBaseSpeeds();
    },
    update: function (oldData) {
        // If disabled, reset and return
        if (!this.data.enabled) {
            this.resetSpeeds();
            this.setSpeedLinesVisible(false);
            return;
        }
        // If the left controller changed, rebuild the listeners
        if (oldData.leftController !== this.data.leftController) {
            this.removeLeftControllerListeners();
            this.joystickActive = false;
            this.leftControllerEl = this.data.leftController;
            this.addLeftControllerListeners();
        }
        // If keyboard input was disabled, immediately clear any held sprint state
        if (oldData.keyboardEnabled && !this.data.keyboardEnabled) {
            this.keyboardShiftActive = false;
            this.keyboardForwardActive = false;
        }
        // If the speed line settings changed, rebuild the speed lines
        if (oldData.lineCount !== this.data.lineCount || oldData.lineDistance !== this.data.lineDistance || oldData.linePatternInterval !== this.data.linePatternInterval) {
            this.removeSpeedLines();
            this.createSpeedLines();
        }
        // If the line color changed, update existing line colors
        if (oldData.lineColor !== this.data.lineColor) {
            this.updateSpeedLineColor();
        }
        // Re-cache in case movement components were attached after this component initialized
        this.cacheBaseSpeeds();
        this.applySpeedMultiplier();
    },
    tick: function (time, timeDelta) {
        // If not enabled, return
        if (!this.data.enabled) return;
        // Once activated, keep the boost active only while the left joystick is still forward at all
        if (this.data.joystickEnabled && this.joystickActive && !this.isJoystickForward()) {
            // Joystick is no longer forward, deactivate boost
            this.joystickActive = false;
            this.applySpeedMultiplier();
        }
        // Animate speed lines while active
        this.updateSpeedLines(time, timeDelta);
    },
    remove: function () {
        this.removeLeftControllerListeners();
        this.removeKeyboardListeners();
        this.resetSpeeds();
        this.removeSpeedLines();
    },

    /**
     * Add left controller input listeners
     *
     * Adds the left joystick click and axis listeners to the left controller.
     */
    addLeftControllerListeners: function () {
        if (!this.leftControllerEl || !this.data.joystickEnabled) return;
        this.leftControllerEl.addEventListener("thumbstickdown", this.onThumbstickDown);
        this.leftControllerEl.addEventListener("axismove", this.onAxisMove);
    },

    /**
     * Remove left controller input listeners
     *
     * Removes the left joystick click and axis listeners from the left controller.
     */
    removeLeftControllerListeners: function () {
        if (!this.leftControllerEl) return;
        this.leftControllerEl.removeEventListener("thumbstickdown", this.onThumbstickDown);
        this.leftControllerEl.removeEventListener("axismove", this.onAxisMove);
    },

    /**
     * Add keyboard listeners
     *
     * Adds desktop keyboard listeners so holding left shift and W enables the boost.
     */
    addKeyboardListeners: function () {
        window.addEventListener("keydown", this.onKeyDown);
        window.addEventListener("keyup", this.onKeyUp);
        window.addEventListener("blur", this.onWindowBlur);
    },

    /**
     * Remove keyboard listeners
     *
     * Removes the desktop keyboard listeners used for keyboard sprint.
     */
    removeKeyboardListeners: function () {
        window.removeEventListener("keydown", this.onKeyDown);
        window.removeEventListener("keyup", this.onKeyUp);
        window.removeEventListener("blur", this.onWindowBlur);
    },

    /**
     * Thumbstick down handler
     *
     * Activates boost only when the left joystick is clicked while it is being pushed forward at all.
     */
    onThumbstickDown: function () {
        if (!this.data.joystickEnabled || !this.isJoystickForward()) return;
        this.joystickActive = true;
        this.applySpeedMultiplier();
    },

    /**
     * Axis move handler
     *
     * Stores the latest joystick axis values so we can make sure the boost can stay active while the stick is forward.
     *
     * @param {Event} event The controller axis event.
     */
    onAxisMove: function (event) {
        const axis = event.detail.axis || [];
        this.axisX = axis[2] || 0; // 2 represents the horizontal axis of the left joystick
        this.axisY = axis[3] || 0; // 3 represents the vertical axis of the left joystick
    },

    /**
     * Key down handler
     *
     * Tracks desktop sprint keys so boost is active only while left shift and W are both held.
     *
     * @param {KeyboardEvent} event The keyboard event.
     */
    onKeyDown: function (event) {
        const wasKeyboardBoostActive = this.keyboardShiftActive && this.keyboardForwardActive;
        let boostKeysChangedState = false;
        if (event.code === "ShiftLeft" && !this.keyboardShiftActive) {
            this.keyboardShiftActive = true;
            boostKeysChangedState = true;
        }
        if (event.code === "KeyW" && !this.keyboardForwardActive) {
            this.keyboardForwardActive = true;
            boostKeysChangedState = true;
        }
        if (!boostKeysChangedState) return; // Other keys may have been pressed
        // If boost state changes, apply the new multiplier
        const isKeyboardBoostActive = this.keyboardShiftActive && this.keyboardForwardActive;
        if (wasKeyboardBoostActive !== isKeyboardBoostActive) {
            this.applySpeedMultiplier();
        }
    },

    /**
     * Key up handler
     *
     * Deactivates boost when either desktop sprint key is released.
     *
     * @param {KeyboardEvent} event The keyboard event.
     */
    onKeyUp: function (event) {
        const wasKeyboardBoostActive = this.keyboardShiftActive && this.keyboardForwardActive;
        let boostKeysChangedState = false;
        if (event.code === "ShiftLeft" && this.keyboardShiftActive) {
            this.keyboardShiftActive = false;
            boostKeysChangedState = true;
        }
        if (event.code === "KeyW" && this.keyboardForwardActive) {
            this.keyboardForwardActive = false;
            boostKeysChangedState = true;
        }
        if (!boostKeysChangedState) return; // Other keys may have been released
        // If boost state changes, apply the new multiplier
        const isKeyboardBoostActive = this.keyboardShiftActive && this.keyboardForwardActive;
        if (wasKeyboardBoostActive !== isKeyboardBoostActive) {
            this.applySpeedMultiplier();
        }
    },

    /**
     * Window blur handler
     *
     * Clears held keyboard sprint state if the window loses focus.
     */
    onWindowBlur: function () {
        if (!this.keyboardShiftActive && !this.keyboardForwardActive) return;
        this.keyboardShiftActive = false;
        this.keyboardForwardActive = false;
        this.applySpeedMultiplier();
    },

    /**
     * Is joystick forward
     *
     * Returns true when the left joystick is pushed forward at all.
     *
     * @returns {boolean} Whether the joystick is forward.
     */
    isJoystickForward: function () {
        return this.axisY < 0;
    },

    /**
     * Cache base speeds
     *
     * Stores the original movement speed values so the multiplier can be applied relative to those values.
     */
    cacheBaseSpeeds: function () {
        const movementControls = this.el.components["movement-controls"];
        const armSwingMovement = this.el.components["arm-swing-movement"];
        if (movementControls && this.baseMovementControlsSpeed === null) {
            this.baseMovementControlsSpeed = movementControls.data.speed;
        }
        if (armSwingMovement && this.baseArmSwingSpeedFactor === null) {
            this.baseArmSwingSpeedFactor = armSwingMovement.data.speedFactor;
        }
    },

    /**
     * Get applied multiplier
     *
     * Returns the multiplier that should currently affect movement.
     *
     * @returns {number} The active movement multiplier.
     */
    getAppliedMultiplier: function () {
        const controllerBoostActive = this.data.joystickEnabled && this.joystickActive;
        const keyboardBoostActive = this.data.keyboardEnabled && this.keyboardShiftActive && this.keyboardForwardActive;
        const manualBoostActive = this.manualBoostActive;
        // There should be no multiplier if boosts have not been activated
        return controllerBoostActive || keyboardBoostActive || manualBoostActive ? this.data.multiplier : 1;
    },

    /**
     * Check if moving forward
     *
     * Checks whether the player is currently moving forward by testing keyboard, joystick, and arm swing movement inputs to determine the active direction of travel.
     *
     * @returns {boolean} True if the player is moving forward using any input method, false otherwise.
     */
    isMovingForward: function () {
        const armSwingMovement = this.el.components["arm-swing-movement"];
        const keyboardMovingForward = this.keyboardForwardActive;
        const joystickMovingForward = this.isJoystickForward();
        const armSwingMovingForward = armSwingMovement && armSwingMovement.moving && !armSwingMovement.reverseHeld;
        return keyboardMovingForward || joystickMovingForward || armSwingMovingForward;
    },

    /**
     * Sync speed lines visibility
     *
     * Shows or hides the speed line effect based on whether speed lines are enabled, the active movement multiplier is greater than 1, and the player is currently moving forward.
     *
     * @returns {void} Does not return a value.
     */
    syncSpeedLinesVisibility: function () {
        this.setSpeedLinesVisible(this.data.linesEnabled && this.currentAppliedMultiplier > 1 && this.isMovingForward());
    },

    /**
     * Set manual boost active
     *
     * Allows another component to manually turn the multiplier on or off.
     *
     * @param {boolean} active Whether the manual boost should be active.
     */
    setManualBoost: function (active) {
        const nextManualBoostState = !!active; // !! Is to default to false if a non-boolean value is passed
        if (this.manualBoostActive === nextManualBoostState) return; // No change, do nothing
        this.manualBoostActive = nextManualBoostState;
        this.applySpeedMultiplier();
    },

    /**
     * Apply speed multiplier
     *
     * Applies the current multiplier to supported movement components and toggles speed line visibility.
     */
    applySpeedMultiplier: function () {
        const appliedMultiplier = this.getAppliedMultiplier();
        const movementControls = this.el.components["movement-controls"];
        const armSwingMovement = this.el.components["arm-swing-movement"];
        const keyboardSprintCompensation = this.data.keyboardEnabled && this.keyboardShiftActive ? 0.5 : 1; // Compensate for movement-controls' built-in 2x keyboard sprint multiplier by cutting in half and applying our own multiplier
        const canAffectMovement = (movementControls && this.baseMovementControlsSpeed !== null) || (armSwingMovement && this.baseArmSwingSpeedFactor !== null);
        const didAppliedMultiplierIncrease = appliedMultiplier > this.currentAppliedMultiplier; // Check for increase to play sound effect later
        this.currentAppliedMultiplier = appliedMultiplier; // Update to new applied multiplier
        // Apply the multipliers
        if (movementControls && this.baseMovementControlsSpeed !== null) {
            this.el.setAttribute("movement-controls", "speed", this.baseMovementControlsSpeed * keyboardSprintCompensation * appliedMultiplier);
        }
        if (armSwingMovement && this.baseArmSwingSpeedFactor !== null) {
            this.el.setAttribute("arm-swing-movement", "speedFactor", this.baseArmSwingSpeedFactor * appliedMultiplier);
        }
        // Play sound effect
        if (didAppliedMultiplierIncrease && canAffectMovement) {
            this.playMultiplierSound();
        }
        this.syncSpeedLinesVisibility();
    },

    /**
     * Reset speeds
     *
     * Restores supported movement components to their cached base speed values.
     */
    resetSpeeds: function () {
        if (this.baseMovementControlsSpeed !== null && this.el.components["movement-controls"]) {
            this.el.setAttribute("movement-controls", "speed", this.baseMovementControlsSpeed);
        }
        if (this.baseArmSwingSpeedFactor !== null && this.el.components["arm-swing-movement"]) {
            this.el.setAttribute("arm-swing-movement", "speedFactor", this.baseArmSwingSpeedFactor);
        }
    },

    /**
     * Create speed lines
     *
     * Creates a camera-attached container with simple line objects arranged like a lampshade opening toward the camera.
     */
    createSpeedLines: function () {
        if (!this.data.linesEnabled) return;
        const camera = this.el.sceneEl.camera?.el || document.querySelector("[camera]");
        if (!camera) return;
        this.lineContainer = document.createElement("a-entity");
        this.lineContainer.setAttribute("class", "movement-speed-lines");
        this.lineContainer.setAttribute("position", `0 0 -${this.data.lineDistance}`);
        this.lineContainer.setAttribute("visible", false);
        camera.appendChild(this.lineContainer);
        this.timeSinceLastLinePattern = 0;
        for (let i = 0; i < this.data.lineCount; i++) {
            const line = document.createElement("a-entity");
            line.setAttribute("class", "movement-speed-line");
            line.setAttribute("geometry", "primitive: icosahedron;"); // Shape of a 20-sided die
            line.setAttribute("scale", "0.003 0.15 0.002"); // Stretch and flatten it
            line.setAttribute("material", `color: ${this.data.lineColor}; transparent: true; opacity: 0; depthWrite: false;`);
            this.lineContainer.appendChild(line);
            this.lineElements.push({
                el: line,
            });
        }
        this.randomizeSpeedLinePattern();
    },

    /**
     * Remove speed lines
     *
     * Removes the camera-attached speed line container.
     */
    removeSpeedLines: function () {
        if (this.lineContainer?.parentNode) {
            this.lineContainer.parentNode.removeChild(this.lineContainer);
        }
        this.lineContainer = null;
        this.lineElements = [];
    },

    /**
     * Update speed line color
     *
     * Applies the configured line color to all existing speed line materials.
     */
    updateSpeedLineColor: function () {
        for (const line of this.lineElements) {
            line.el.setAttribute("material", "color", this.data.lineColor);
        }
    },

    /**
     * Set speed lines visible
     *
     * Shows or hides the speed line container.
     *
     * @param {boolean} visible Whether the speed lines should be visible.
     */
    setSpeedLinesVisible: function (visible) {
        if (!this.lineContainer) return; // Make sure the line container has already been built
        this.lineContainer.setAttribute("visible", visible);
    },

    /**
     * Update speed lines
     *
     * Randomizes the speed line pattern a few times per second instead. The data property `linePatternInterval` controls how often the pattern changes in milliseconds.
     *
     * @param {number} time Current scene time.
     * @param {number} timeDelta Time since the last frame.
     */
    updateSpeedLines: function (time, timeDelta) {
        this.timeSinceLastLinePattern += timeDelta;
        if (this.timeSinceLastLinePattern < this.data.linePatternInterval) return; // Make sure enough time has passed
        this.syncSpeedLinesVisibility();
        if (!this.lineContainer || !this.lineContainer.getAttribute("visible")) return; // Make sure line container is visible
        // Reset time and randomize pattern
        this.timeSinceLastLinePattern = 0;
        this.randomizeSpeedLinePattern();
    },

    /**
     * Randomize speed line pattern
     *
     * Places speed lines along an invisible tapered cone shape, like a lampshade opening toward the camera.
     */
    randomizeSpeedLinePattern: function () {
        const backZ = -0.45; // Furthest depth position for a line segment inside the speed-line volume.
        const frontZ = 0.05; // Nearest depth position, slightly in front of the camera-facing opening.
        const frontRadius = 0.85; // Wider radius at the front
        const backRadius = 0.42; // Narrower radius at the back
        for (const line of this.lineElements) {
            // Randomly hide some lines
            const shouldShow = Math.random() > 0.35;
            if (!shouldShow) {
                line.el.setAttribute("material", "opacity", 0);
                continue;
            }
            //
            const angle = Math.random() * Math.PI * 2; // Pick any direction around the circular cross-section
            const depthPercent = Math.random(); // Pick how far from front to back this line starts
            const z = frontZ + (backZ - frontZ) * depthPercent; // Convert depth percentage into a Z position.
            const radius = frontRadius + (backRadius - frontRadius) * depthPercent; // Shrink radius as the line moves toward the back.
            const x = Math.cos(angle) * radius; // Convert polar coordinates into the X position.
            const y = Math.sin(angle) * radius; // Convert polar coordinates into the Y position.
            const nextDepthPercent = Math.min(1, depthPercent + 0.2); // Move a little deeper to define the line's forward/back direction.
            const nextZ = frontZ + (backZ - frontZ) * nextDepthPercent; // Compute the Z position of that second point.
            const nextRadius = frontRadius + (backRadius - frontRadius) * nextDepthPercent; // Compute the cone radius at that second point.
            const nextX = Math.cos(angle) * nextRadius; // Compute the second point's X position.
            const nextY = Math.sin(angle) * nextRadius; // Compute the second point's Y position.
            const direction = new THREE.Vector3(nextX - x, nextY - y, nextZ - z).normalize(); // Build a unit direction vector from the first point to the second.
            const quaternion = new THREE.Quaternion(); // Create a rotation container for orienting the line entity.
            quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction); // Rotate the line from its default up-axis to face the travel direction.
            line.el.object3D.position.set(x, y, z); // Move the line to its randomized position in the cone.
            line.el.object3D.quaternion.copy(quaternion); // Apply the rotation so the line points along the cone direction.
            line.el.setAttribute("material", "opacity", this.data.lineOpacity);
        }
    },

    /**
     * Play multiplier sound
     *
     * Plays the optional speed boost sound when the multiplier increases.
     */
    playMultiplierSound: function () {
        const soundEntity = this.data.boostSound;
        const soundComponent = soundEntity?.components?.sound;
        if (!soundComponent) return;
        soundComponent.stopSound(); // Stop if already playing so that it can be retriggered immediately
        soundComponent.playSound();
    },
};
AFRAME.registerComponent("movement-speed-modifier", movementSpeedModifierComponent);
