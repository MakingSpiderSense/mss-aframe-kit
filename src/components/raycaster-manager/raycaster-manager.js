/**
 * Toggle Raycaster
 *
 * This assumes several things are set up in the scene. The controllers should have the ID 'left-hand' and 'right-hand'. The raycasters should be children of the controllers and have the class 'actual-ray'. The styled ray should be a sibling of the actual ray and have the class 'styled-ray'. The raycasters should be disabled by default, although I would like to update this to be able to detect if the raycaster is already active and toggle it accordingly. The styled ray can optionally have a sound component with a sound attached.
 *
 * To Do: Allow for custom selectors for the controllers.
 *
 */

// ✏️ Move raycaster length (styled and actual) to schema as one value.
// 🛠️ This seems like it could be the emulator, but when clicking right trigger to enable raycaster, then clicking again to hide it, it is not hiding and is fully visible. May need to test this in VR.
// 🛠️ When pulling away from two blocks, the raycaster goes through the further one briefly

AFRAME.registerComponent("raycaster-manager", {
    schema: {
        intersectionBuffer: { type: "number", default: 0.02 },
    },

    init: function () {
        console.log("Raycaster Manager initialized");
        const leftController = document.querySelector("#left-hand");
        const rightController = document.querySelector("#right-hand");
        this.defaultLengths = {
            left: { far: null, scale: null },
            right: { far: null, scale: null },
        };
        // Listen for trigger down events on both controllers
        if (leftController && rightController) {
            leftController.addEventListener("triggerdown", () => this.toggleRaycaster("left"));
            rightController.addEventListener("triggerdown", () => this.toggleRaycaster("right"));
        }
        this.storeDefaultLengths("left");
        this.storeDefaultLengths("right");
    },

    tick: function () {
        this.syncRayLength("left");
        this.syncRayLength("right");
    },

    /**
     * Hand elements
     *
     * Returns the actual ray and styled ray elements for the requested controller hand.
     *
     * @param {"left"|"right"} hand The controller side whose ray elements should be retrieved.
     */
    getHandElements: function (hand) {
        return {
            actualRay: document.querySelector(`#${hand}-hand .actual-ray`),
            styledRay: document.querySelector(`#${hand}-hand .styled-ray`),
        };
    },

    /**
     * Stores the original raycaster distance and styled-ray scale for a hand so the ray can be restored after an intersection clears.
     *
     * @param {"left"|"right"} hand The controller side to cache defaults for.
     */
    storeDefaultLengths: function (hand) {
        const defaults = this.defaultLengths[hand];
        const { actualRay, styledRay } = this.getHandElements(hand);
        const raycasterData = actualRay?.getAttribute("raycaster") || {};
        const styledScale = styledRay?.getAttribute("scale");
        // Store the default far distance of actual raycaster if not already stored
        if (typeof defaults.far !== "number" && typeof raycasterData.far === "number") {
            defaults.far = raycasterData.far;
        }
        // Store the default scale of the styled ray if not already stored
        if (!defaults.scale && styledScale) {
            defaults.scale = {
                x: styledScale.x,
                y: styledScale.y,
                z: styledScale.z,
            };
        }
    },

    /**
     * Returns the distance to the closest current intersection for the given controller ray, or null when nothing is being hit.
     *
     * @param {"left"|"right"} hand The controller side to inspect.
     * @returns {number|null} The nearest hit distance, if available.
     */
    getClosestIntersectionDistance: function (hand) {
        const { actualRay } = this.getHandElements(hand);
        const raycasterComponent = actualRay?.components?.raycaster;
        // Return null if no intersections found
        if (!raycasterComponent?.intersections?.length) {
            //
            return null;
        }
        // Otherwise, return the distance to the closest intersection
        return raycasterComponent.intersections[0]?.distance ?? null;
    },

    /**
     * Shortens the active raycaster and styled ray so they stop at the current hit point, while keeping a small buffer on the actual ray for reliable interaction.
     *
     * @param {"left"|"right"} hand The controller side whose ray should be adjusted.
     * @param {number} intersectionDistance The current distance to the nearest hit.
     */
    applyIntersectionLength: function (hand, intersectionDistance) {
        const defaults = this.defaultLengths[hand];
        const { actualRay, styledRay } = this.getHandElements(hand);
        // Ensure defaults are stored before applying intersection lengths
        this.storeDefaultLengths(hand);
        // Return if there is no actual ray or the default far distance isn't stored for some reason
        if (!actualRay || typeof defaults.far !== "number") {
            return;
        }
        // Set buffer from schema and then add to the intersection distance
        const buffer = Math.max(0, this.data.intersectionBuffer);
        const adjustedFar = Math.min(defaults.far, intersectionDistance + buffer);
        // Update actual raycaster's far distance
        actualRay.setAttribute("raycaster", "far", adjustedFar);
        // If there is no styled ray or default scale, return early to avoid errors
        if (!styledRay || !defaults.scale || defaults.far <= 0) {
            return;
        }
        // Update the styled ray's scale.y distance
        const nextScaleY = Math.min(defaults.scale.y, intersectionDistance);
        styledRay.setAttribute("scale", { x: defaults.scale.x, y: nextScaleY, z: defaults.scale.z });
    },

    /**
     * Restores the actual raycaster distance and styled-ray scale for the given controller back to their cached default values.
     *
     * @param {"left"|"right"} hand The controller side whose ray lengths should be reset.
     */
    resetRayLength: function (hand) {
        const defaults = this.defaultLengths[hand];
        const { actualRay, styledRay } = this.getHandElements(hand);
        // Ensure defaults are stored before restoring lengths
        this.storeDefaultLengths(hand);
        // Restore the actual raycaster's far distance if possible
        if (actualRay && typeof defaults.far === "number") {
            actualRay.setAttribute("raycaster", "far", defaults.far);
        }
        // Restore the styled ray's scale if possible
        if (styledRay && defaults.scale) {
            styledRay.setAttribute("scale", { x: defaults.scale.x, y: defaults.scale.y, z: defaults.scale.z });
        }
    },

    /**
     * Updates the active ray to match the nearest current intersection, or restores
     * the cached default lengths when nothing is being hit.
     *
     * @param {"left"|"right"} hand The controller side whose ray should be synced.
     */
    syncRayLength: function (hand) {
        const { actualRay } = this.getHandElements(hand);
        const raycasterData = actualRay?.getAttribute("raycaster");
        if (!actualRay || !raycasterData?.enabled) {
            return;
        }
        // Check the distance to the closest intersection, if any
        const intersectionDistance = this.getClosestIntersectionDistance(hand);
        // If there is a number, that means there is an intersection...
        if (typeof intersectionDistance === "number") {
            // Match the ray lengths to the intersection point
            this.applyIntersectionLength(hand, intersectionDistance);
            return;
        }
        // If there is no intersection, reset to defaults
        this.resetRayLength(hand);
    },

    /**
     * Toggle the raycaster
     *
     * If the raycaster is already enabled, it only disables it when the ray is not currently intersecting any interactable elements as we assume the user intends to interact with them. If the raycaster is disabled, it enables it and lets the component handle switching away from the other hand.
     *
     * @param {"left"|"right"} hand The controller side whose raycaster should be toggled.
     */
    toggleRaycaster: function (hand) {
        const { actualRay } = this.getHandElements(hand);
        if (!actualRay) return;
        const raycasterData = actualRay.getAttribute("raycaster") || {};
        const raycasterComponent = actualRay.components.raycaster;
        // Check if the raycaster is already active on this controller
        if (raycasterData.enabled) {
            console.log("Raycaster already active on this controller:", hand);
            // If not intersecting a interactable, disable it
            if (!raycasterComponent?.intersectedEls?.length) {
                console.log("No intersection detected. Disabling raycaster on:", hand);
                this.disableRaycaster(hand);
            }
        } else {
            // Enable and move the raycaster to this controller
            console.log("Enabling raycaster on:", hand);
            this.enableRaycaster(hand);
        }
    },

    /**
     * Disable raycaster
     *
     * Restores the cached default ray lengths, hides the styled ray, and then disables the actual controller raycaster.
     *
     * @param {"left"|"right"} hand The controller side whose raycaster should be disabled.
     */
    disableRaycaster: function (hand) {
        const { actualRay, styledRay } = this.getHandElements(hand);
        this.resetRayLength(hand);
        styledRay?.setAttribute("visible", false);
        actualRay?.setAttribute("raycaster", "enabled", false);
    },

    /**
     * Enable raycaster
     *
     * Restores the cached default ray lengths, shows the styled ray, enables the actual controller raycaster, plays the optional activation sound, syncs the ray to any current intersection, and disables the other controller's raycaster.
     *
     * @param {"left"|"right"} hand The controller side whose raycaster should be enabled.
     */
    enableRaycaster: function (hand) {
        const { actualRay, styledRay } = this.getHandElements(hand);
        this.resetRayLength(hand);
        styledRay?.setAttribute("visible", true);
        actualRay?.setAttribute("raycaster", { enabled: true });
        // Play sound
        if (styledRay) {
            this.playSound(styledRay);
        }
        this.syncRayLength(hand);
        // Disable the other controller's raycaster
        const otherHand = hand === "left" ? "right" : "left";
        this.disableRaycaster(otherHand);
    },

    /**
     * Play sound
     *
     * Plays the styled ray's attached sound effect if the entity has a sound component.
     *
     * @param {Element} styledRay The styled ray entity that may contain the sound component.
     */
    playSound: function (styledRay) {
        let soundComp = styledRay.components.sound;
        if (soundComp) {
            soundComp.playSound();
        }
    },
});
