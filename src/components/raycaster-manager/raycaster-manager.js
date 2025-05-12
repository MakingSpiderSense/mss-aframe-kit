/**
 * Toggle Raycaster
 *
 * This assumes several things are set up in the scene. The controllers should have the ID 'left-hand' and 'right-hand'. The raycasters should be children of the controllers and have the class 'actual-ray'. The styled ray should be a sibling of the actual ray and have the class 'styled-ray'. The raycasters should be disabled by default, although I would like to update this to be able to detect if the raycaster is already active and toggle it accordingly. The styled ray can optionally have a sound component with a sound attached.
 *
 * To Do: Allow for custom selectors for the controllers.
 *
 */
AFRAME.registerComponent("raycaster-manager", {
    init: function () {
        console.log("Raycaster Manager initialized");
        const leftController = document.querySelector("#left-hand");
        const rightController = document.querySelector("#right-hand");
        // Listen for trigger down events on both controllers
        if (leftController && rightController) {
            leftController.addEventListener("triggerdown", () => this.toggleRaycaster("left"));
            rightController.addEventListener("triggerdown", () => this.toggleRaycaster("right"));
        }
    },
    // Toggle logic for raycaster
    toggleRaycaster: function (hand) {
        const actualRay = document.querySelector(`#${hand}-hand .actual-ray`);
        // Check if the raycaster is already active on this controller
        if (actualRay.getAttribute("raycaster").enabled) {
            console.log("Raycaster already active on this controller:", hand);
            // If not intersecting a interactable, disable it
            if (!actualRay.components.raycaster.intersectedEls.length) {
                console.log("No intersection detected. Disabling raycaster on:", hand);
                this.disableRaycaster(hand);
            }
        } else {
            // Enable and move the raycaster to this controller
            console.log("Enabling raycaster on:", hand);
            this.enableRaycaster(hand);
        }
    },
    // Disable raycaster
    disableRaycaster: function (hand) {
        const styledRay = document.querySelector(`#${hand}-hand .styled-ray`);
        const actualRay = document.querySelector(`#${hand}-hand .actual-ray`);
        styledRay?.setAttribute("visible", false);
        actualRay?.setAttribute("raycaster", "enabled", false);
    },
    // Enable raycaster
    enableRaycaster: function (hand) {
        const styledRay = document.querySelector(`#${hand}-hand .styled-ray`);
        const actualRay = document.querySelector(`#${hand}-hand .actual-ray`);
        styledRay?.setAttribute("visible", true);
        actualRay?.setAttribute("raycaster", { enabled: true });
        // Play sound
        if (styledRay) {
            this.playSound(styledRay);
        }
        // Disable the other controller's raycaster
        const otherHand = hand === "left" ? "right" : "left";
        this.disableRaycaster(otherHand);
    },
    // Play sound
    playSound: function (styledRay) {
        let soundComp = styledRay.components.sound;
        if (soundComp) {
            soundComp.playSound();
        }
    },
});
